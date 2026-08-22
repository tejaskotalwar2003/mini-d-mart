import logging
import uuid
from typing import Dict, List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


async def log_action(
    db: AsyncSession,
    user_id: Optional[uuid.UUID],
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID],
    metadata: Optional[Dict] = None,
) -> None:
    """Non-blocking helper function to record structured system audit entries."""
    # NON-BLOCKING AUDIT LOGGING TRADEOFF:
    # Audit logging is a secondary concern compared to core business transactions.
    # An issue inserting an audit entry (such as a database transient error or constraint)
    # should NEVER break or abort the primary business operation (e.g., product creation, checkout, return approval).
    # Therefore, we wrap the audit insertion in a try/except block, flushing it safely or logging a warning if it fails.
    try:
        audit_entry = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=metadata or {},
        )
        db.add(audit_entry)
        await db.flush()
    except Exception as exc:
        logger.warning(f"Failed to record audit log action '{action}': {exc}")


async def list_audit_logs(
    db: AsyncSession,
    action_filter: Optional[str] = None,
    entity_type_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> Tuple[List[AuditLog], int]:
    """[Admin] Fetch paginated audit log entries with optional filters."""
    query = select(AuditLog).options(selectinload(AuditLog.user))

    if action_filter:
        query = query.where(AuditLog.action == action_filter)

    if entity_type_filter:
        query = query.where(AuditLog.entity_type == entity_type_filter)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size)

    res = await db.execute(query)
    items = list(res.scalars().all())

    return items, total
