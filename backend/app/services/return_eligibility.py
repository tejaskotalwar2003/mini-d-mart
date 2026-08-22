from datetime import datetime, timezone
from typing import List, Optional, Tuple
from app.models.catalog import Product
from app.models.order import Order, OrderItem, OrderStatus
from app.models.return_request import ReturnRequest, ReturnStatus

# BUSINESS RULE ASSUMPTION:
# Customers may request a product return or exchange within 7 calendar days
# after their order status transitions to COMPLETED or DELIVERED.
RETURN_WINDOW_DAYS = 7


def check_eligibility(
    order: Order,
    order_item: OrderItem,
    product: Product,
    requested_qty: int,
    existing_returns: Optional[List[ReturnRequest]] = None,
) -> Tuple[bool, Optional[str]]:
    """Pure eligibility function that validates if an item can be returned or exchanged.

    Returns:
        (is_eligible, rejection_reason)
    """
    # a. Order status check
    if order.status not in [OrderStatus.COMPLETED, OrderStatus.DELIVERED]:
        return False, "Order must be completed or delivered before requesting a return"

    # b. Product returnability check
    if not product.is_returnable:
        return False, "This product is not eligible for returns"

    # c. 7-day Return Window check based on completion/delivery timestamp
    completion_time = None
    if getattr(order, "status_logs", None):
        for log in sorted(order.status_logs, key=lambda l: l.created_at, reverse=True):
            if log.to_status in [OrderStatus.COMPLETED, OrderStatus.DELIVERED]:
                completion_time = log.created_at
                break

    if not completion_time:
        completion_time = order.updated_at or order.created_at

    now = datetime.now(timezone.utc)
    if completion_time.tzinfo is None:
        completion_time = completion_time.replace(tzinfo=timezone.utc)

    days_elapsed = (now - completion_time).total_seconds() / 86400.0
    if days_elapsed > RETURN_WINDOW_DAYS:
        return False, "Return window of 7 days has expired"

    # d. Requested quantity bounds check
    if requested_qty <= 0 or requested_qty > order_item.quantity:
        return False, "Requested quantity exceeds purchased quantity"

    # e. Previous non-rejected return requests collision check
    if existing_returns:
        already_requested_qty = sum(
            r.requested_qty
            for r in existing_returns
            if r.order_item_id == order_item.id and r.status != ReturnStatus.REJECTED
        )
        if already_requested_qty + requested_qty > order_item.quantity:
            return False, "A return/exchange has already been requested for this item"

    return True, None
