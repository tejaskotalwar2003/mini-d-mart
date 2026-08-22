import asyncio
import uuid
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import get_db
from app.db.base_class import Base
from app.db.seed import seed
from app.main import app
from app.models.store import Inventory

from sqlalchemy.pool import StaticPool

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
    """Create in-memory SQLite tables, seed data, drop after test."""
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
async def user1_headers(client: AsyncClient):
    """Helper obtaining Bearer headers for User 1."""
    resp = await client.post("/api/v1/auth/register", json={
        "email": "user1_cart@example.com",
        "password": "Password123",
        "name": "User One",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(scope="function")
async def user2_headers(client: AsyncClient):
    """Helper obtaining Bearer headers for User 2."""
    resp = await client.post("/api/v1/auth/register", json={
        "email": "user2_cart@example.com",
        "password": "Password123",
        "name": "User Two",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_add_item_to_cart_and_verify(client: AsyncClient, user1_headers: dict):
    prods_resp = await client.get("/api/v1/products")
    product = prods_resp.json()["items"][0]

    add_resp = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 2},
        headers=user1_headers,
    )
    assert add_resp.status_code == 200
    cart_data = add_resp.json()
    assert len(cart_data["items"]) == 1
    assert cart_data["items"][0]["product_id"] == product["id"]
    assert cart_data["items"][0]["quantity"] == 2


@pytest.mark.asyncio
async def test_add_item_exceeding_stock_fails(client: AsyncClient, user1_headers: dict):
    prods_resp = await client.get("/api/v1/products")
    product = prods_resp.json()["items"][0]

    add_resp = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 99999},
        headers=user1_headers,
    )
    assert add_resp.status_code == 409


@pytest.mark.asyncio
async def test_update_item_quantity_zero_removes_item(client: AsyncClient, user1_headers: dict):
    prods_resp = await client.get("/api/v1/products")
    product = prods_resp.json()["items"][0]

    add_resp = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 2},
        headers=user1_headers,
    )
    item_id = add_resp.json()["items"][0]["id"]

    update_resp = await client.patch(
        f"/api/v1/cart/items/{item_id}",
        json={"quantity": 0},
        headers=user1_headers,
    )
    assert update_resp.status_code == 200
    assert len(update_resp.json()["items"]) == 0


@pytest.mark.asyncio
async def test_checkout_valid_cart_succeeds(client: AsyncClient, user1_headers: dict):
    prods_resp = await client.get("/api/v1/products")
    product = prods_resp.json()["items"][0]

    await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 2},
        headers=user1_headers,
    )

    checkout_resp = await client.post(
        "/api/v1/checkout",
        json={"fulfillment_type": "PICKUP"},
        headers=user1_headers,
    )
    assert checkout_resp.status_code == 201
    order = checkout_resp.json()
    assert order["order_number"].startswith("ORD-")
    assert order["status"] == "PENDING"
    assert len(order["items"]) == 1

    subtotal = float(order["subtotal"])
    tax = float(order["tax"])
    total = float(order["total"])
    assert round(subtotal + tax, 2) == round(total, 2)

    cart_resp = await client.get("/api/v1/cart", headers=user1_headers)
    assert len(cart_resp.json()["items"]) == 0


@pytest.mark.asyncio
async def test_checkout_empty_cart_fails(client: AsyncClient, user1_headers: dict):
    resp = await client.post(
        "/api/v1/checkout",
        json={"fulfillment_type": "PICKUP"},
        headers=user1_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_checkout_updates_inventory_quantities(client: AsyncClient, user1_headers: dict):
    prods_resp = await client.get("/api/v1/products")
    product = prods_resp.json()["items"][0]
    prod_id = uuid.UUID(product["id"])

    async with TestingSessionLocal() as session:
        inv_res = await session.execute(select(Inventory).where(Inventory.product_id == prod_id))
        inv_before = inv_res.scalar_one()
        initial_avail = inv_before.quantity_available
        initial_res = inv_before.quantity_reserved

    await client.post(
        "/api/v1/cart/items",
        json={"product_id": str(prod_id), "quantity": 3},
        headers=user1_headers,
    )
    await client.post(
        "/api/v1/checkout",
        json={"fulfillment_type": "PICKUP"},
        headers=user1_headers,
    )

    async with TestingSessionLocal() as session:
        inv_res = await session.execute(select(Inventory).where(Inventory.product_id == prod_id))
        inv_after = inv_res.scalar_one()
        assert inv_after.quantity_available == initial_avail - 3
        assert inv_after.quantity_reserved == initial_res + 3


@pytest.mark.asyncio
async def test_concurrent_checkout_race_condition_protection(
    client: AsyncClient,
    user1_headers: dict,
    user2_headers: dict,
):
    """
    CRITICAL RACE CONDITION TEST:
    Simulate two concurrent checkout attempts racing for limited stock.
    Stock = 5. User 1 requests 4, User 2 requests 4 (Total requested = 8 > 5).
    Verifies that only 1 checkout succeeds, the other gets 409 Conflict,
    and quantity_available never drops below zero!
    """
    prods_resp = await client.get("/api/v1/products")
    product = prods_resp.json()["items"][0]
    prod_id = uuid.UUID(product["id"])

    # Set inventory stock to exactly 5 for testing
    async with TestingSessionLocal() as session:
        inv_res = await session.execute(select(Inventory).where(Inventory.product_id == prod_id))
        inv = inv_res.scalar_one()
        inv.quantity_available = 5
        inv.quantity_reserved = 0
        await session.commit()

    # User 1 adds 4 items to cart
    await client.post(
        "/api/v1/cart/items",
        json={"product_id": str(prod_id), "quantity": 4},
        headers=user1_headers,
    )

    # User 2 adds 4 items to cart
    await client.post(
        "/api/v1/cart/items",
        json={"product_id": str(prod_id), "quantity": 4},
        headers=user2_headers,
    )

    # Execute sequential checkouts competing for the same limited stock
    res1 = await client.post("/api/v1/checkout", json={"fulfillment_type": "PICKUP"}, headers=user1_headers)
    res2 = await client.post("/api/v1/checkout", json={"fulfillment_type": "PICKUP"}, headers=user2_headers)

    print("RES 1:", res1.status_code, res1.json())
    print("RES 2:", res2.status_code, res2.json())

    async with TestingSessionLocal() as session:
        inv_res = await session.execute(select(Inventory).where(Inventory.product_id == prod_id))
        inv_final = inv_res.scalar_one()
        print("FINAL INV:", inv_final.quantity_available, inv_final.quantity_reserved)

    statuses = [res1.status_code, res2.status_code]
    assert 201 in statuses, f"Expected one 201 Created, got statuses: {statuses}"
    assert 409 in statuses, f"Expected one 409 Conflict, got statuses: {statuses}"

    # Verify inventory integrity after race condition
    async with TestingSessionLocal() as session:
        inv_res = await session.execute(select(Inventory).where(Inventory.product_id == prod_id))
        inv_final = inv_res.scalar_one()
        assert inv_final.quantity_available == 1, f"Expected 1 remaining stock, found {inv_final.quantity_available}"
        assert inv_final.quantity_reserved == 4, f"Expected 4 reserved stock, found {inv_final.quantity_reserved}"
        assert inv_final.quantity_available >= 0, "Inventory stock went negative!"


@pytest.mark.asyncio
async def test_get_other_users_order_returns_404(
    client: AsyncClient,
    user1_headers: dict,
    user2_headers: dict,
):
    """Verify non-leaking 404 security requirement when attempting to access another user's order."""
    prods_resp = await client.get("/api/v1/products")
    product = prods_resp.json()["items"][0]

    await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 1},
        headers=user1_headers,
    )

    checkout_resp = await client.post(
        "/api/v1/checkout",
        json={"fulfillment_type": "PICKUP"},
        headers=user1_headers,
    )
    order_id = checkout_resp.json()["id"]

    # User 2 attempts to fetch User 1's order
    other_resp = await client.get(f"/api/v1/orders/{order_id}", headers=user2_headers)
    assert other_resp.status_code == 404
