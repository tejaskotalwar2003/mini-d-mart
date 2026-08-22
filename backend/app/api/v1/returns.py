import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.return_request import ReturnStatus
from app.models.user import Role, User
from app.schemas.return_request import (
    ReturnRequestCreate,
    ReturnRequestResponse,
    ReturnResolveRequest,
)
from app.services.return_service import (
    approve_return,
    list_all_returns,
    list_user_returns,
    reject_return,
    request_return,
)

router = APIRouter(tags=["Returns"])


@router.post(
    "/orders/{order_id}/returns",
    response_model=ReturnRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_return_request(
    order_id: uuid.UUID,
    payload: ReturnRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """[Customer] Submit a product return or exchange request for an eligible order item."""
    return await request_return(
        db=db,
        user_id=current_user.id,
        order_id=order_id,
        order_item_id=payload.order_item_id,
        type=payload.type,
        requested_qty=payload.requested_qty,
        reason=payload.reason,
        exchange_for_product_id=payload.exchange_for_product_id,
    )


@router.get("/returns", response_model=List[ReturnRequestResponse])
async def get_my_return_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """[Customer] View list of return/exchange requests for the authenticated user."""
    return await list_user_returns(db, current_user.id)


@router.get(
    "/staff/returns",
    response_model=List[ReturnRequestResponse],
    dependencies=[Depends(require_role(Role.STAFF, Role.ADMIN))],
)
async def get_staff_returns(
    status_filter: Optional[ReturnStatus] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
):
    """[Staff/Admin] Browse all store return and exchange requests, optionally filtered by status."""
    return await list_all_returns(db, status_filter)


@router.patch(
    "/staff/returns/{id}/approve",
    response_model=ReturnRequestResponse,
    dependencies=[Depends(require_role(Role.STAFF, Role.ADMIN))],
)
async def approve_return_request(
    id: uuid.UUID,
    payload: ReturnResolveRequest = ReturnResolveRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """[Staff/Admin] Approve a pending return/exchange request and update store inventory."""
    return await approve_return(
        db=db,
        return_id=id,
        actor=current_user,
        resolution_note=payload.resolution_note,
    )


@router.patch(
    "/staff/returns/{id}/reject",
    response_model=ReturnRequestResponse,
    dependencies=[Depends(require_role(Role.STAFF, Role.ADMIN))],
)
async def reject_return_request(
    id: uuid.UUID,
    payload: ReturnResolveRequest = ReturnResolveRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """[Staff/Admin] Reject a pending return/exchange request."""
    return await reject_return(
        db=db,
        return_id=id,
        actor=current_user,
        resolution_note=payload.resolution_note,
    )
