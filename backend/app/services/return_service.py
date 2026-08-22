import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.catalog import Product
from app.models.order import Order, OrderItem, OrderStatus, OrderStatusLog
from app.models.return_request import ReturnRequest, ReturnStatus, ReturnType
from app.models.store import Inventory
from app.models.user import User
from app.schemas.return_request import ReturnRequestResponse
from app.services.audit_service import log_action
from app.services.return_eligibility import check_eligibility


async def request_return(
    db: AsyncSession,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
    order_item_id: uuid.UUID,
    type: ReturnType,
    requested_qty: int,
    reason: str,
    exchange_for_product_id: Optional[uuid.UUID] = None,
) -> ReturnRequestResponse:
    """Request a product return or exchange with eligibility verification."""
    # 1. Fetch Order and verify ownership
    order_res = await db.execute(
        select(Order)
        .options(selectinload(Order.status_logs))
        .where(Order.id == order_id)
    )
    order = order_res.scalar_one_or_none()

    if not order or order.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID '{order_id}' not found.",
        )

    # 2. Fetch OrderItem and verify it belongs to this order
    item_res = await db.execute(
        select(OrderItem).where(OrderItem.id == order_item_id)
    )
    order_item = item_res.scalar_one_or_none()

    if not order_item or order_item.order_id != order_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order item with ID '{order_item_id}' not found in order.",
        )

    # 3. Fetch Product
    prod_res = await db.execute(select(Product).where(Product.id == order_item.product_id))
    product = prod_res.scalar_one()

    # 4. Fetch existing return requests for this item
    existing_res = await db.execute(
        select(ReturnRequest).where(ReturnRequest.order_item_id == order_item_id)
    )
    existing_returns = list(existing_res.scalars().all())

    # 5. Run Pure Eligibility Engine check
    is_eligible, rejection_reason = check_eligibility(
        order=order,
        order_item=order_item,
        product=product,
        requested_qty=requested_qty,
        existing_returns=existing_returns,
    )
    if not is_eligible:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=rejection_reason,
        )

    # 6. If type is EXCHANGE, validate replacement product availability
    if type == ReturnType.EXCHANGE:
        if not exchange_for_product_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="exchange_for_product_id is required for EXCHANGE requests.",
            )

        # Query replacement product stock
        rep_inv_res = await db.execute(
            select(Inventory).where(Inventory.product_id == exchange_for_product_id)
        )
        rep_inventories = list(rep_inv_res.scalars().all())
        total_rep_avail = sum(inv.quantity_available for inv in rep_inventories)

        if total_rep_avail < requested_qty:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Replacement product is currently out of stock",
            )

    # 7. Create ReturnRequest
    ret_req = ReturnRequest(
        order_id=order_id,
        order_item_id=order_item_id,
        type=type,
        reason=reason,
        status=ReturnStatus.REQUESTED,
        requested_qty=requested_qty,
        exchange_for_product_id=exchange_for_product_id,
    )
    db.add(ret_req)

    # Update order status to RETURN_REQUESTED if not already recorded
    if order.status in [OrderStatus.COMPLETED, OrderStatus.DELIVERED]:
        from_st = order.status
        order.status = OrderStatus.RETURN_REQUESTED
        db.add(
            OrderStatusLog(
                order_id=order.id,
                from_status=from_st,
                to_status=OrderStatus.RETURN_REQUESTED,
                changed_by=user_id,
                note=f"Return/Exchange requested for item {order_item_id}.",
            )
        )

    await db.commit()
    return await _format_return_response(db, ret_req.id)


async def approve_return(
    db: AsyncSession,
    return_id: uuid.UUID,
    actor: User,
    resolution_note: Optional[str] = None,
) -> ReturnRequestResponse:
    """[Staff/Admin] Approve a return or exchange request and adjust inventory stock."""
    ret_res = await db.execute(
        select(ReturnRequest).where(ReturnRequest.id == return_id)
    )
    ret_req = ret_res.scalar_one_or_none()

    if not ret_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Return request with ID '{return_id}' not found.",
        )

    if ret_req.status != ReturnStatus.REQUESTED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending requests can be approved",
        )

    # Fetch original order item & product
    item_res = await db.execute(select(OrderItem).where(OrderItem.id == ret_req.order_item_id))
    order_item = item_res.scalar_one()

    orig_prod_id = order_item.product_id
    req_qty = ret_req.requested_qty

    if ret_req.type == ReturnType.RETURN:
        # Lock original product inventory and restore available stock
        inv_res = await db.execute(
            select(Inventory)
            .where(Inventory.product_id == orig_prod_id)
            .execution_options(populate_existing=True)
            .with_for_update()
        )
        inventories = list(inv_res.scalars().all())
        for inv in inventories:
            inv.quantity_available += req_qty
            break

    elif ret_req.type == ReturnType.EXCHANGE:
        # DELIBERATE RE-CHECK COMMENT:
        # Stock availability is dynamic and could change between return request creation and staff approval.
        # We lock the replacement product's inventory row and re-verify quantity_available >= requested_qty.
        rep_prod_id = ret_req.exchange_for_product_id
        rep_inv_res = await db.execute(
            select(Inventory)
            .where(Inventory.product_id == rep_prod_id)
            .execution_options(populate_existing=True)
            .with_for_update()
        )
        rep_inventories = list(rep_inv_res.scalars().all())
        total_rep_avail = sum(inv.quantity_available for inv in rep_inventories)

        if total_rep_avail < req_qty:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Replacement product is currently out of stock",
            )

        # Deduct replacement product stock
        rem = req_qty
        for inv in rep_inventories:
            if inv.quantity_available >= rem:
                inv.quantity_available -= rem
                inv.quantity_reserved += rem
                rem = 0
                break

        # Restore original returned product stock
        orig_inv_res = await db.execute(
            select(Inventory)
            .where(Inventory.product_id == orig_prod_id)
            .execution_options(populate_existing=True)
            .with_for_update()
        )
        orig_inventories = list(orig_inv_res.scalars().all())
        for inv in orig_inventories:
            inv.quantity_available += req_qty
            break

    # Update return request status
    ret_req.status = ReturnStatus.APPROVED
    ret_req.resolved_by = actor.id
    ret_req.resolved_at = datetime.now(timezone.utc)
    ret_req.resolution_note = resolution_note or "Return/Exchange request approved."

    # Update order status to RETURN_APPROVED
    order_res = await db.execute(select(Order).where(Order.id == ret_req.order_id))
    order = order_res.scalar_one_or_none()
    if order:
        from_st = order.status
        order.status = OrderStatus.RETURN_APPROVED
        db.add(
            OrderStatusLog(
                order_id=order.id,
                from_status=from_st,
                to_status=OrderStatus.RETURN_APPROVED,
                changed_by=actor.id,
                note=f"Return request {return_id} approved by staff.",
            )
        )

    await db.commit()

    await log_action(
        db,
        user_id=actor.id,
        action="RETURN_APPROVED",
        entity_type="ReturnRequest",
        entity_id=ret_req.id,
        metadata={"order_id": str(ret_req.order_id), "type": ret_req.type.value, "requested_qty": ret_req.requested_qty},
    )
    await db.commit()

    return await _format_return_response(db, ret_req.id)


async def reject_return(
    db: AsyncSession,
    return_id: uuid.UUID,
    actor: User,
    resolution_note: Optional[str] = None,
) -> ReturnRequestResponse:
    """[Staff/Admin] Reject a return or exchange request without modifying inventory."""
    ret_res = await db.execute(
        select(ReturnRequest).where(ReturnRequest.id == return_id)
    )
    ret_req = ret_res.scalar_one_or_none()

    if not ret_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Return request with ID '{return_id}' not found.",
        )

    if ret_req.status != ReturnStatus.REQUESTED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending requests can be rejected.",
        )

    ret_req.status = ReturnStatus.REJECTED
    ret_req.resolved_by = actor.id
    ret_req.resolved_at = datetime.now(timezone.utc)
    ret_req.resolution_note = resolution_note or "Return/Exchange request rejected."

    order_res = await db.execute(select(Order).where(Order.id == ret_req.order_id))
    order = order_res.scalar_one_or_none()
    if order:
        from_st = order.status
        order.status = OrderStatus.RETURN_REJECTED
        db.add(
            OrderStatusLog(
                order_id=order.id,
                from_status=from_st,
                to_status=OrderStatus.RETURN_REJECTED,
                changed_by=actor.id,
                note=f"Return request {return_id} rejected by staff.",
            )
        )

    await db.commit()

    await log_action(
        db,
        user_id=actor.id,
        action="RETURN_REJECTED",
        entity_type="ReturnRequest",
        entity_id=ret_req.id,
        metadata={"order_id": str(ret_req.order_id), "resolution_note": resolution_note},
    )
    await db.commit()
    return await _format_return_response(db, ret_req.id)


async def list_user_returns(db: AsyncSession, user_id: uuid.UUID) -> List[ReturnRequestResponse]:
    """Fetch all return requests for orders owned by the user."""
    res = await db.execute(
        select(ReturnRequest.id)
        .join(Order, ReturnRequest.order_id == Order.id)
        .where(Order.user_id == user_id)
        .order_by(ReturnRequest.created_at.desc())
    )
    ret_ids = list(res.scalars().all())

    response_list = []
    for r_id in ret_ids:
        response_list.append(await _format_return_response(db, r_id))
    return response_list


async def list_all_returns(
    db: AsyncSession,
    status_filter: Optional[ReturnStatus] = None,
) -> List[ReturnRequestResponse]:
    """[Staff/Admin] Fetch all return requests, optionally filtered by status."""
    query = select(ReturnRequest.id)
    if status_filter:
        query = query.where(ReturnRequest.status == status_filter)
    query = query.order_by(ReturnRequest.created_at.desc())

    res = await db.execute(query)
    ret_ids = list(res.scalars().all())

    response_list = []
    for r_id in ret_ids:
        response_list.append(await _format_return_response(db, r_id))
    return response_list


async def _format_return_response(db: AsyncSession, return_id: uuid.UUID) -> ReturnRequestResponse:
    """Format full ReturnRequestResponse with loaded relationship basenames."""
    res = await db.execute(
        select(ReturnRequest)
        .options(
            selectinload(ReturnRequest.order_item).selectinload(OrderItem.product),
            selectinload(ReturnRequest.exchange_product),
            selectinload(ReturnRequest.resolver),
        )
        .where(ReturnRequest.id == return_id)
    )
    ret = res.scalar_one()

    product_name = ret.order_item.product.name if ret.order_item and ret.order_item.product else "Unknown Product"
    exchange_product_name = ret.exchange_product.name if ret.exchange_product else None
    resolved_by_name = ret.resolver.name if ret.resolver else None

    return ReturnRequestResponse(
        id=ret.id,
        order_id=ret.order_id,
        order_item_id=ret.order_item_id,
        product_name=product_name,
        type=ret.type,
        status=ret.status,
        requested_qty=ret.requested_qty,
        reason=ret.reason,
        exchange_for_product_id=ret.exchange_for_product_id,
        exchange_product_name=exchange_product_name,
        resolved_by_name=resolved_by_name,
        resolution_note=ret.resolution_note,
        created_at=ret.created_at,
        resolved_at=ret.resolved_at,
    )
