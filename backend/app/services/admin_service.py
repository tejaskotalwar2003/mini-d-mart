import uuid
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.catalog import Product
from app.models.store import Inventory, Store
from app.models.user import User
from app.schemas.admin import InventoryOverviewResponse, LowStockItemResponse
from app.services.audit_service import log_action


async def get_inventory_overview(
    db: AsyncSession,
    store_id: Optional[uuid.UUID] = None,
) -> List[InventoryOverviewResponse]:
    """[Admin] Fetch per-product per-store inventory records (auto-linking any unassigned products)."""
    store_res = await db.execute(select(Store))
    default_store = store_res.scalars().first()

    # Find any products without inventory in this store and create default 0-stock inventory records
    if default_store:
        target_store_id = store_id or default_store.id
        missing_products_res = await db.execute(
            select(Product).where(
                ~Product.id.in_(
                    select(Inventory.product_id).where(Inventory.store_id == target_store_id)
                )
            )
        )
        missing_products = list(missing_products_res.scalars().all())
        if missing_products:
            for p in missing_products:
                db.add(
                    Inventory(
                        product_id=p.id,
                        store_id=target_store_id,
                        quantity_available=0,
                        quantity_reserved=0,
                        reorder_threshold=10,
                    )
                )
            await db.commit()

    query = (
        select(Inventory)
        .options(selectinload(Inventory.product), selectinload(Inventory.store))
    )
    if store_id:
        query = query.where(Inventory.store_id == store_id)

    query = query.order_by(Inventory.created_at.desc())
    res = await db.execute(query)
    inventories = list(res.scalars().all())

    return [
        InventoryOverviewResponse(
            id=inv.id,
            product_id=inv.product_id,
            product_name=inv.product.name,
            store_id=inv.store_id,
            store_name=inv.store.name,
            quantity_available=inv.quantity_available,
            quantity_reserved=inv.quantity_reserved,
            reorder_threshold=inv.reorder_threshold,
        )
        for inv in inventories
        if inv.product is not None
    ]


async def get_low_stock_products(
    db: AsyncSession,
    threshold_override: Optional[int] = None,
) -> List[LowStockItemResponse]:
    """[Admin] Fetch products where quantity_available <= reorder_threshold (or threshold_override)."""
    await get_inventory_overview(db)

    query = (
        select(Inventory)
        .options(selectinload(Inventory.product), selectinload(Inventory.store))
    )
    if threshold_override is not None:
        query = query.where(Inventory.quantity_available <= threshold_override)
    else:
        query = query.where(Inventory.quantity_available <= Inventory.reorder_threshold)

    query = query.order_by(Inventory.quantity_available.asc())
    res = await db.execute(query)
    inventories = list(res.scalars().all())

    return [
        LowStockItemResponse(
            product_id=inv.product_id,
            product_name=inv.product.name,
            sku=inv.product.sku,
            store_name=inv.store.name,
            quantity_available=inv.quantity_available,
            reorder_threshold=inv.reorder_threshold,
        )
        for inv in inventories
        if inv.product is not None
    ]


async def adjust_inventory(
    db: AsyncSession,
    inventory_id: uuid.UUID,
    new_quantity_available: int,
    actor: User,
    reason: str,
) -> InventoryOverviewResponse:
    """[Admin] Manually correct inventory stock levels and record an audit log entry."""
    inv_res = await db.execute(
        select(Inventory)
        .options(selectinload(Inventory.product), selectinload(Inventory.store))
        .where(Inventory.id == inventory_id)
        .execution_options(populate_existing=True)
        .with_for_update()
    )
    inventory = inv_res.scalar_one_or_none()

    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory record with ID '{inventory_id}' not found.",
        )

    old_quantity = inventory.quantity_available
    inventory.quantity_available = new_quantity_available
    await db.commit()

    await log_action(
        db,
        user_id=actor.id,
        action="INVENTORY_ADJUSTED",
        entity_type="Inventory",
        entity_id=inventory.id,
        metadata={
            "product_name": inventory.product.name,
            "store_name": inventory.store.name,
            "old_quantity": old_quantity,
            "new_quantity": new_quantity_available,
            "reason": reason,
        },
    )
    await db.commit()

    return InventoryOverviewResponse(
        id=inventory.id,
        product_id=inventory.product_id,
        product_name=inventory.product.name,
        store_id=inventory.store_id,
        store_name=inventory.store.name,
        quantity_available=inventory.quantity_available,
        quantity_reserved=inventory.quantity_reserved,
        reorder_threshold=inventory.reorder_threshold,
    )
