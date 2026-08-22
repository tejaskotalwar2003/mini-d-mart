import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import Role, User
from app.schemas.admin import (
    AuditLogResponse,
    InventoryAdjustRequest,
    InventoryOverviewResponse,
    LowStockItemResponse,
)
from app.services.admin_service import (
    adjust_inventory,
    get_inventory_overview,
    get_low_stock_products,
)
from app.services.audit_service import list_audit_logs

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get(
    "/audit-logs",
    response_model=List[AuditLogResponse],
    dependencies=[Depends(require_role(Role.ADMIN))],
)
async def get_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action string"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    db: AsyncSession = Depends(get_db),
):
    """[Admin Only] Fetch paginated audit log history with user details."""
    logs, total = await list_audit_logs(
        db=db,
        action_filter=action,
        entity_type_filter=entity_type,
        page=page,
        page_size=page_size,
    )

    response_list = []
    for log in logs:
        user_email = log.user.email if log.user else None
        response_list.append(
            AuditLogResponse(
                id=log.id,
                user_email=user_email,
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                metadata=log.metadata_json or {},
                created_at=log.created_at,
            )
        )
    return response_list


@router.get(
    "/inventory",
    response_model=List[InventoryOverviewResponse],
    dependencies=[Depends(require_role(Role.ADMIN))],
)
async def get_store_inventory_overview(
    store_id: Optional[uuid.UUID] = Query(None, description="Filter by store UUID"),
    db: AsyncSession = Depends(get_db),
):
    """[Admin Only] Fetch store-level inventory levels across products."""
    return await get_inventory_overview(db, store_id)


@router.get(
    "/inventory/low-stock",
    response_model=List[LowStockItemResponse],
    dependencies=[Depends(require_role(Role.ADMIN))],
)
async def get_low_stock_items(
    threshold: Optional[int] = Query(None, description="Override reorder threshold"),
    db: AsyncSession = Depends(get_db),
):
    """[Admin Only] View low stock items at or below reorder threshold."""
    return await get_low_stock_products(db, threshold_override=threshold)


@router.patch(
    "/inventory/{id}/adjust",
    response_model=InventoryOverviewResponse,
)
async def adjust_store_inventory(
    id: uuid.UUID,
    payload: InventoryAdjustRequest,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """[Admin Only] Manually adjust product inventory stock with audit tracking."""
    return await adjust_inventory(
        db=db,
        inventory_id=id,
        new_quantity_available=payload.new_quantity_available,
        actor=current_user,
        reason=payload.reason,
    )
