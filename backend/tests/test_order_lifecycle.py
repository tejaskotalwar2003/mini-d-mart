import uuid
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
from app.models.pickup_slot import PickupSlot
from app.models.store import Inventory

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
async def customer1_headers(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "cust1_lifecycle@example.com",
        "password": "Password123",
        "name": "Customer Lifecycle One",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(scope="function")
async def customer2_headers(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "cust2_lifecycle@example.com",
        "password": "Password123",
        "name": "Customer Lifecycle Two",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(scope="function")
async def staff_headers(client: AsyncClient):
    """Obtain staff headers from seeded staff@minidmart.com."""
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "staff@minidmart.com",
        "password": "Staff@123",
    })
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _create_test_order(client: AsyncClient, headers: dict) -> dict:
    prods = (await client.get("/api/v1/products")).json()["items"]
    p_id = prods[0]["id"]
    await client.post("/api/v1/cart/items", json={"product_id": p_id, "quantity": 2}, headers=headers)
    checkout_res = await client.post("/api/v1/checkout", json={"fulfillment_type": "PICKUP"}, headers=headers)
    return checkout_res.json()


@pytest.mark.asyncio
async def test_valid_transition_pending_to_confirmed_as_staff(client: AsyncClient, customer1_headers: dict, staff_headers: dict):
    order = await _create_test_order(client, customer1_headers)
    order_id = order["id"]

    resp = await client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"to_status": "CONFIRMED", "note": "Order verified by staff"},
        headers=staff_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "CONFIRMED"
    assert len(data["order_status_history"]) >= 2
    assert data["order_status_history"][-1]["to_status"] == "CONFIRMED"


@pytest.mark.asyncio
async def test_invalid_transition_pending_to_delivered_fails(client: AsyncClient, customer1_headers: dict, staff_headers: dict):
    order = await _create_test_order(client, customer1_headers)
    order_id = order["id"]

    resp = await client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"to_status": "DELIVERED"},
        headers=staff_headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_customer_cannot_patch_status_directly(client: AsyncClient, customer1_headers: dict):
    order = await _create_test_order(client, customer1_headers)
    order_id = order["id"]

    resp = await client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"to_status": "CONFIRMED"},
        headers=customer1_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_customer_can_cancel_pending_order_and_inventory_restored(client: AsyncClient, customer1_headers: dict):
    prods = (await client.get("/api/v1/products")).json()["items"]
    p_id = uuid.UUID(prods[0]["id"])

    async with TestingSessionLocal() as session:
        inv_res = await session.execute(select(Inventory).where(Inventory.product_id == p_id))
        inv_before = inv_res.scalar_one()
        initial_avail = inv_before.quantity_available

    await client.post("/api/v1/cart/items", json={"product_id": str(p_id), "quantity": 3}, headers=customer1_headers)
    checkout_res = await client.post("/api/v1/checkout", json={"fulfillment_type": "PICKUP"}, headers=customer1_headers)
    order_id = checkout_res.json()["id"]

    # Cancel order
    cancel_res = await client.post(f"/api/v1/orders/{order_id}/cancel", headers=customer1_headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    # Verify inventory restored
    async with TestingSessionLocal() as session:
        inv_res = await session.execute(select(Inventory).where(Inventory.product_id == p_id))
        inv_after = inv_res.scalar_one()
        assert inv_after.quantity_available == initial_avail


@pytest.mark.asyncio
async def test_customer_cannot_cancel_another_users_order(client: AsyncClient, customer1_headers: dict, customer2_headers: dict):
    order = await _create_test_order(client, customer1_headers)
    order_id = order["id"]

    cancel_res = await client.post(f"/api/v1/orders/{order_id}/cancel", headers=customer2_headers)
    assert cancel_res.status_code == 404


@pytest.mark.asyncio
async def test_customer_cannot_cancel_preparing_order(client: AsyncClient, customer1_headers: dict, staff_headers: dict):
    order = await _create_test_order(client, customer1_headers)
    order_id = order["id"]

    # Staff transitions to CONFIRMED -> PREPARING
    await client.patch(f"/api/v1/orders/{order_id}/status", json={"to_status": "CONFIRMED"}, headers=staff_headers)
    await client.patch(f"/api/v1/orders/{order_id}/status", json={"to_status": "PREPARING"}, headers=staff_headers)

    # Customer attempts cancel on PREPARING order
    cancel_res = await client.post(f"/api/v1/orders/{order_id}/cancel", headers=customer1_headers)
    assert cancel_res.status_code == 403


@pytest.mark.asyncio
async def test_booking_pickup_slot_succeeds(client: AsyncClient, customer1_headers: dict):
    slots = (await client.get("/api/v1/pickup-slots", headers=customer1_headers)).json()
    assert len(slots) > 0
    slot = slots[0]

    order = await _create_test_order(client, customer1_headers)
    order_id = order["id"]

    book_res = await client.post(
        f"/api/v1/orders/{order_id}/pickup-slot",
        json={"slot_id": slot["id"]},
        headers=customer1_headers,
    )
    assert book_res.status_code == 200

    # Verify booked_count incremented
    slots_after = (await client.get("/api/v1/pickup-slots", headers=customer1_headers)).json()
    updated_slot = next(s for s in slots_after if s["id"] == slot["id"])
    assert updated_slot["booked_count"] == slot["booked_count"] + 1


@pytest.mark.asyncio
async def test_booking_full_slot_fails(client: AsyncClient, customer1_headers: dict):
    slots = (await client.get("/api/v1/pickup-slots", headers=customer1_headers)).json()
    slot_id = uuid.UUID(slots[0]["id"])

    # Set slot booked_count = capacity (5)
    async with TestingSessionLocal() as session:
        slot_res = await session.execute(select(PickupSlot).where(PickupSlot.id == slot_id))
        s_obj = slot_res.scalar_one()
        s_obj.booked_count = s_obj.capacity
        await session.commit()

    order = await _create_test_order(client, customer1_headers)
    order_id = order["id"]

    book_res = await client.post(
        f"/api/v1/orders/{order_id}/pickup-slot",
        json={"slot_id": str(slot_id)},
        headers=customer1_headers,
    )
    assert book_res.status_code == 409


@pytest.mark.asyncio
async def test_get_staff_orders_as_customer_fails(client: AsyncClient, customer1_headers: dict):
    resp = await client.get("/api/v1/staff/orders", headers=customer1_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_staff_orders_as_staff_succeeds(client: AsyncClient, customer1_headers: dict, staff_headers: dict):
    # Customer 1 creates an order
    await _create_test_order(client, customer1_headers)

    # Staff lists all orders
    resp = await client.get("/api/v1/staff/orders", headers=staff_headers)
    assert resp.status_code == 200
    orders = resp.json()
    assert len(orders) >= 1
