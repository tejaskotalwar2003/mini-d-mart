import uuid
from typing import Optional
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.db.base_class import Base
from app.db.seed import seed
from app.main import app
from app.models.catalog import Product
from app.models.order import Order, OrderItem, OrderStatus, OrderStatusLog
from app.models.return_request import ReturnRequest, ReturnStatus, ReturnType
from app.models.store import Inventory
from app.services.return_eligibility import check_eligibility

# -----------------------------------------------------------------------------
# PURE UNIT TESTS FOR check_eligibility Engine (No Database)
# -----------------------------------------------------------------------------

def test_eligibility_order_not_completed_fails():
    order = MagicMock(spec=Order, status=OrderStatus.PENDING)
    order_item = MagicMock(spec=OrderItem, quantity=2)
    product = MagicMock(spec=Product, is_returnable=True)

    eligible, reason = check_eligibility(order, order_item, product, 1)
    assert not eligible
    assert reason == "Order must be completed or delivered before requesting a return"


def test_eligibility_product_not_returnable_fails():
    order = MagicMock(spec=Order, status=OrderStatus.DELIVERED)
    order_item = MagicMock(spec=OrderItem, quantity=2)
    product = MagicMock(spec=Product, is_returnable=False)

    eligible, reason = check_eligibility(order, order_item, product, 1)
    assert not eligible
    assert reason == "This product is not eligible for returns"


def test_eligibility_window_expired_fails():
    order = MagicMock(spec=Order, status=OrderStatus.DELIVERED)
    log = MagicMock(spec=OrderStatusLog)
    log.to_status = OrderStatus.DELIVERED
    log.created_at = datetime.now(timezone.utc) - timedelta(days=10)
    order.status_logs = [log]

    order_item = MagicMock(spec=OrderItem, quantity=2)
    product = MagicMock(spec=Product, is_returnable=True)

    eligible, reason = check_eligibility(order, order_item, product, 1)
    assert not eligible
    assert reason == "Return window of 7 days has expired"


def test_eligibility_requested_qty_exceeds_purchased_fails():
    order = MagicMock(spec=Order, status=OrderStatus.DELIVERED)
    log = MagicMock(spec=OrderStatusLog, to_status=OrderStatus.DELIVERED, created_at=datetime.now(timezone.utc))
    order.status_logs = [log]

    order_item = MagicMock(spec=OrderItem, quantity=2)
    product = MagicMock(spec=Product, is_returnable=True)

    eligible, reason = check_eligibility(order, order_item, product, 5)
    assert not eligible
    assert reason == "Requested quantity exceeds purchased quantity"


def test_eligibility_already_requested_fails():
    order = MagicMock(spec=Order, status=OrderStatus.DELIVERED)
    log = MagicMock(spec=OrderStatusLog, to_status=OrderStatus.DELIVERED, created_at=datetime.now(timezone.utc))
    order.status_logs = [log]

    item_id = uuid.uuid4()
    order_item = MagicMock(spec=OrderItem, id=item_id, quantity=2)
    product = MagicMock(spec=Product, is_returnable=True)

    existing_req = MagicMock(spec=ReturnRequest, order_item_id=item_id, requested_qty=2, status=ReturnStatus.REQUESTED)

    eligible, reason = check_eligibility(order, order_item, product, 1, existing_returns=[existing_req])
    assert not eligible
    assert reason == "A return/exchange has already been requested for this item"


# -----------------------------------------------------------------------------
# INTEGRATION TESTS (DB + HTTP API)
# -----------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    future=True,
)
TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="function", autouse=True)
async def setup_test_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        await seed(session)

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client():
    async def override_get_db():
        async with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def customer_headers(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "cust_returns@example.com",
        "password": "Password123",
        "name": "Customer Returns User",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(scope="function")
async def staff_headers(client: AsyncClient):
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "staff@minidmart.com",
        "password": "Staff@123",
    })
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _create_completed_order(client: AsyncClient, cust_headers: dict, staff_headers: dict, product_id: Optional[str] = None) -> dict:
    if not product_id:
        prods = (await client.get("/api/v1/products")).json()["items"]
        p_id = prods[0]["id"]
    else:
        p_id = product_id

    await client.post("/api/v1/cart/items", json={"product_id": p_id, "quantity": 2}, headers=cust_headers)
    checkout_res = await client.post("/api/v1/checkout", json={"fulfillment_type": "PICKUP"}, headers=cust_headers)
    order = checkout_res.json()
    order_id = order["id"]

    # Transition PENDING -> CONFIRMED -> PREPARING -> READY_FOR_PICKUP -> COMPLETED
    for next_st in ["CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "COMPLETED"]:
        await client.patch(f"/api/v1/orders/{order_id}/status", json={"to_status": next_st}, headers=staff_headers)

    get_order_res = await client.get(f"/api/v1/orders/{order_id}", headers=cust_headers)
    return get_order_res.json()


@pytest.mark.asyncio
async def test_full_return_happy_path_restores_inventory(client: AsyncClient, customer_headers: dict, staff_headers: dict):
    order = await _create_completed_order(client, customer_headers, staff_headers)
    order_id = order["id"]
    item_id = order["items"][0]["id"]
    product_id = uuid.UUID(order["items"][0]["product_id"])

    # Get stock before return approval
    async with TestingSessionLocal() as session:
        inv_res = await session.execute(select(Inventory).where(Inventory.product_id == product_id))
        stock_before = inv_res.scalar_one().quantity_available

    # Customer submits return
    ret_res = await client.post(
        f"/api/v1/orders/{order_id}/returns",
        json={"order_item_id": item_id, "type": "RETURN", "requested_qty": 2, "reason": "Defective mangoes"},
        headers=customer_headers,
    )
    assert ret_res.status_code == 201
    return_id = ret_res.json()["id"]

    # Staff approves return
    app_res = await client.patch(f"/api/v1/staff/returns/{return_id}/approve", headers=staff_headers)
    assert app_res.status_code == 200
    assert app_res.json()["status"] == "APPROVED"

    # Verify inventory stock restored (+2)
    async with TestingSessionLocal() as session:
        inv_res = await session.execute(select(Inventory).where(Inventory.product_id == product_id))
        stock_after = inv_res.scalar_one().quantity_available
        assert stock_after == stock_before + 2


@pytest.mark.asyncio
async def test_exchange_for_out_of_stock_product_fails(client: AsyncClient, customer_headers: dict, staff_headers: dict):
    order = await _create_completed_order(client, customer_headers, staff_headers)
    order_id = order["id"]
    item_id = order["items"][0]["id"]

    prods = (await client.get("/api/v1/products")).json()["items"]
    rep_product = prods[1]
    rep_p_id = uuid.UUID(rep_product["id"])

    # Set replacement product stock = 0
    async with TestingSessionLocal() as session:
        inv_res = await session.execute(select(Inventory).where(Inventory.product_id == rep_p_id))
        inv = inv_res.scalar_one()
        inv.quantity_available = 0
        await session.commit()

    ret_res = await client.post(
        f"/api/v1/orders/{order_id}/returns",
        json={
            "order_item_id": item_id,
            "type": "EXCHANGE",
            "requested_qty": 1,
            "reason": "Want different product",
            "exchange_for_product_id": str(rep_p_id),
        },
        headers=customer_headers,
    )
    assert ret_res.status_code == 409
    assert "out of stock" in ret_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_exchange_for_in_stock_product_succeeds_and_updates_inventories(client: AsyncClient, customer_headers: dict, staff_headers: dict):
    order = await _create_completed_order(client, customer_headers, staff_headers)
    order_id = order["id"]
    item_id = order["items"][0]["id"]
    orig_p_id = uuid.UUID(order["items"][0]["product_id"])

    prods = (await client.get("/api/v1/products")).json()["items"]
    rep_prod = next(p for p in prods if p["id"] != str(orig_p_id))
    rep_p_id = uuid.UUID(rep_prod["id"])

    async with TestingSessionLocal() as session:
        orig_inv = (await session.execute(select(Inventory).where(Inventory.product_id == orig_p_id))).scalar_one()
        rep_inv = (await session.execute(select(Inventory).where(Inventory.product_id == rep_p_id))).scalar_one()
        orig_stock_before = orig_inv.quantity_available
        rep_stock_before = rep_inv.quantity_available

    ret_res = await client.post(
        f"/api/v1/orders/{order_id}/returns",
        json={
            "order_item_id": item_id,
            "type": "EXCHANGE",
            "requested_qty": 1,
            "reason": "Exchange for another item",
            "exchange_for_product_id": str(rep_p_id),
        },
        headers=customer_headers,
    )
    assert ret_res.status_code == 201
    return_id = ret_res.json()["id"]

    # Staff approves exchange
    app_res = await client.patch(f"/api/v1/staff/returns/{return_id}/approve", headers=staff_headers)
    assert app_res.status_code == 200

    # Verify original stock incremented and replacement stock decremented
    async with TestingSessionLocal() as session:
        orig_inv_after = (await session.execute(select(Inventory).where(Inventory.product_id == orig_p_id))).scalar_one()
        rep_inv_after = (await session.execute(select(Inventory).where(Inventory.product_id == rep_p_id))).scalar_one()
        assert orig_inv_after.quantity_available == orig_stock_before + 1
        assert rep_inv_after.quantity_available == rep_stock_before - 1


@pytest.mark.asyncio
async def test_rejecting_return_does_not_change_inventory(client: AsyncClient, customer_headers: dict, staff_headers: dict):
    order = await _create_completed_order(client, customer_headers, staff_headers)
    order_id = order["id"]
    item_id = order["items"][0]["id"]
    product_id = uuid.UUID(order["items"][0]["product_id"])

    async with TestingSessionLocal() as session:
        inv_before = (await session.execute(select(Inventory).where(Inventory.product_id == product_id))).scalar_one().quantity_available

    ret_res = await client.post(
        f"/api/v1/orders/{order_id}/returns",
        json={"order_item_id": item_id, "type": "RETURN", "requested_qty": 1, "reason": "Mind changed"},
        headers=customer_headers,
    )
    return_id = ret_res.json()["id"]

    rej_res = await client.patch(f"/api/v1/staff/returns/{return_id}/reject", json={"resolution_note": "Invalid reason"}, headers=staff_headers)
    assert rej_res.status_code == 200
    assert rej_res.json()["status"] == "REJECTED"

    async with TestingSessionLocal() as session:
        inv_after = (await session.execute(select(Inventory).where(Inventory.product_id == product_id))).scalar_one().quantity_available
        assert inv_after == inv_before


@pytest.mark.asyncio
async def test_return_on_non_returnable_product_fails(client: AsyncClient, customer_headers: dict, staff_headers: dict):
    # Get a product and set is_returnable=False
    prods = (await client.get("/api/v1/products")).json()["items"]
    target_p_id = uuid.UUID(prods[0]["id"])
    async with TestingSessionLocal() as session:
        p_res = await session.execute(select(Product).where(Product.id == target_p_id))
        p = p_res.scalar_one()
        p.is_returnable = False
        await session.commit()

    order = await _create_completed_order(client, customer_headers, staff_headers, product_id=str(target_p_id))
    order_id = order["id"]
    item_id = order["items"][0]["id"]

    ret_res = await client.post(
        f"/api/v1/orders/{order_id}/returns",
        json={"order_item_id": item_id, "type": "RETURN", "requested_qty": 1, "reason": "Expired item"},
        headers=customer_headers,
    )
    assert ret_res.status_code == 409
    assert "not eligible for returns" in ret_res.json()["detail"]


@pytest.mark.asyncio
async def test_customer_cannot_approve_own_return(client: AsyncClient, customer_headers: dict, staff_headers: dict):
    order = await _create_completed_order(client, customer_headers, staff_headers)
    order_id = order["id"]
    item_id = order["items"][0]["id"]

    ret_res = await client.post(
        f"/api/v1/orders/{order_id}/returns",
        json={"order_item_id": item_id, "type": "RETURN", "requested_qty": 1, "reason": "Test return"},
        headers=customer_headers,
    )
    return_id = ret_res.json()["id"]

    # Customer attempts staff approve endpoint
    app_res = await client.patch(f"/api/v1/staff/returns/{return_id}/approve", headers=customer_headers)
    assert app_res.status_code == 403
