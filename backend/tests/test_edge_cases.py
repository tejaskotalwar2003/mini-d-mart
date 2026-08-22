import uuid
from datetime import date, time, timedelta
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import auth_rate_limiter
from app.db.base_class import Base
from app.db.seed import seed
from app.main import app
from app.models.catalog import Product
from app.models.order import Order, OrderStatus
from app.models.pickup_slot import PickupSlot
from app.models.store import Store

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
    auth_rate_limiter.reset()
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        await seed(session)

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    auth_rate_limiter.reset()


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
async def admin_headers(client: AsyncClient):
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@minidmart.com", "password": "Admin@123"},
    )
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(scope="function")
async def staff_headers(client: AsyncClient):
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "staff@minidmart.com", "password": "Staff@123"},
    )
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(scope="function")
async def customer_client(client: AsyncClient):
    email = f"edge_cust_{uuid.uuid4().hex[:6]}@example.com"
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123", "name": "Edge Customer"},
    )
    token = reg_resp.json()["access_token"]
    return client, {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_add_to_cart_zero_or_negative_quantity_rejected(customer_client):
    ac, headers = customer_client
    products = (await ac.get("/api/v1/products")).json()["items"]
    prod_id = products[0]["id"]

    # 1. Attempt adding quantity 0
    resp_zero = await ac.post(
        "/api/v1/cart/items",
        json={"product_id": prod_id, "quantity": 0},
        headers=headers,
    )
    assert resp_zero.status_code in (400, 422)

    # 2. Attempt adding negative quantity
    resp_neg = await ac.post(
        "/api/v1/cart/items",
        json={"product_id": prod_id, "quantity": -3},
        headers=headers,
    )
    assert resp_neg.status_code in (400, 422)


@pytest.mark.asyncio
async def test_patch_product_negative_price_fails_validation(client: AsyncClient, admin_headers: dict):
    products = (await client.get("/api/v1/products")).json()["items"]
    prod_id = products[0]["id"]

    resp = await client.patch(
        f"/api/v1/products/{prod_id}",
        json={"price": -15.99},
        headers=admin_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_duplicate_email_different_casing_rejected(client: AsyncClient):
    auth_rate_limiter.reset()
    reg_payload_1 = {
        "email": "CaseSensitiveShopper@Example.com",
        "password": "Password123",
        "name": "Case Sensitive User",
    }
    resp1 = await client.post("/api/v1/auth/register", json=reg_payload_1)
    assert resp1.status_code == 201

    reg_payload_2 = {
        "email": "casesensitiveshopper@example.com",
        "password": "Password123",
        "name": "Case Sensitive Duplicate",
    }
    resp2 = await client.post("/api/v1/auth/register", json=reg_payload_2)
    assert resp2.status_code == 409
    assert "already registered" in resp2.json()["detail"]


@pytest.mark.asyncio
async def test_staff_cannot_create_product_forbidden(client: AsyncClient, staff_headers: dict):
    cats = (await client.get("/api/v1/categories")).json()
    cat_id = cats[0]["id"]

    new_prod_payload = {
        "category_id": cat_id,
        "name": "Unauthorized Staff Product",
        "description": "Attempted by staff",
        "sku": f"STAFF-PROD-{uuid.uuid4().hex[:4]}",
        "price": 49.99,
        "unit": "pack",
        "is_returnable": True,
    }
    resp = await client.post("/api/v1/products", json=new_prod_payload, headers=staff_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_return_request_qty_exceeding_ordered_fails(customer_client, staff_headers: dict):
    ac, headers = customer_client
    products = (await ac.get("/api/v1/products")).json()["items"]
    returnable_prod = next(p for p in products if p["is_returnable"])

    # 1. Add 2 units to cart
    await ac.post(
        "/api/v1/cart/items",
        json={"product_id": returnable_prod["id"], "quantity": 2},
        headers=headers,
    )

    # 2. Checkout
    order_resp = await ac.post(
        "/api/v1/checkout",
        json={"fulfillment_type": "PICKUP"},
        headers=headers,
    )
    assert order_resp.status_code == 201
    order_id = order_resp.json()["id"]
    order_item_id = order_resp.json()["items"][0]["id"]

    # 3. Transition order to COMPLETED
    await ac.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"to_status": "CONFIRMED"},
        headers=staff_headers,
    )
    await ac.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"to_status": "PREPARING"},
        headers=staff_headers,
    )
    await ac.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"to_status": "READY_FOR_PICKUP"},
        headers=staff_headers,
    )
    await ac.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"to_status": "COMPLETED"},
        headers=staff_headers,
    )

    # 4. Attempt to return 5 units when only 2 were ordered
    return_resp = await ac.post(
        f"/api/v1/orders/{order_id}/returns",
        json={
            "order_item_id": order_item_id,
            "type": "RETURN",
            "requested_qty": 5,
            "reason": "Exceeding quantity return test",
        },
        headers=headers,
    )
    assert return_resp.status_code == 409
    assert "exceeds purchased quantity" in return_resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_expired_or_malformed_jwt_returns_401_not_500(client: AsyncClient):
    # 1. Malformed string
    malformed_headers = {"Authorization": "Bearer not.a.valid.jwt.token"}
    resp1 = await client.get("/api/v1/auth/me", headers=malformed_headers)
    assert resp1.status_code == 401
    assert "Could not validate credentials" in resp1.json()["detail"]

    # 2. Expired JWT
    expired_payload = {
        "sub": str(uuid.uuid4()),
        "role": "CUSTOMER",
        "type": "access",
        "exp": 1000000000,  # Ancient timestamp
    }
    expired_token = jwt.encode(expired_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    expired_headers = {"Authorization": f"Bearer {expired_token}"}
    resp2 = await client.get("/api/v1/auth/me", headers=expired_headers)
    assert resp2.status_code == 401
    assert "Could not validate credentials" in resp2.json()["detail"]


@pytest.mark.asyncio
async def test_book_pickup_slot_for_cancelled_order_rejected(customer_client, staff_headers: dict):
    ac, headers = customer_client
    products = (await ac.get("/api/v1/products")).json()["items"]
    prod_id = products[0]["id"]

    # 1. Add to cart & checkout
    await ac.post(
        "/api/v1/cart/items",
        json={"product_id": prod_id, "quantity": 1},
        headers=headers,
    )
    order_resp = await ac.post(
        "/api/v1/checkout",
        json={"fulfillment_type": "PICKUP"},
        headers=headers,
    )
    assert order_resp.status_code == 201
    order_id = order_resp.json()["id"]

    # 2. Cancel order
    cancel_resp = await ac.post(f"/api/v1/orders/{order_id}/cancel", headers=headers)
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "CANCELLED"

    # 3. Create a pickup slot
    async with TestingSessionLocal() as session:
        store_res = await session.execute(select(Store))
        store = store_res.scalars().first()
        slot = PickupSlot(
            store_id=store.id,
            date=date.today() + timedelta(days=1),
            start_time=time(10, 0),
            end_time=time(12, 0),
            capacity=10,
            booked_count=0,
        )
        session.add(slot)
        await session.commit()
        await session.refresh(slot)
        slot_id = str(slot.id)

    # 4. Attempt to book slot for CANCELLED order
    book_resp = await ac.post(
        f"/api/v1/orders/{order_id}/pickup-slot",
        json={"slot_id": slot_id},
        headers=headers,
    )
    assert book_resp.status_code == 409
    assert "only be booked for PENDING or CONFIRMED" in book_resp.json()["detail"]


@pytest.mark.asyncio
async def test_delivery_checkout_with_address_note_success(customer_client):
    ac, headers = customer_client
    products = (await ac.get("/api/v1/products")).json()["items"]
    prod_id = products[0]["id"]

    await ac.post(
        "/api/v1/cart/items",
        json={"product_id": prod_id, "quantity": 1},
        headers=headers,
    )

    # Checkout with DELIVERY and text address in note
    order_resp = await ac.post(
        "/api/v1/checkout",
        json={
            "fulfillment_type": "DELIVERY",
            "note": "Flat 402, Sunshine Heights, MG Road, Pune",
        },
        headers=headers,
    )
    assert order_resp.status_code == 201
    assert order_resp.json()["fulfillment_type"] == "DELIVERY"


@pytest.mark.asyncio
async def test_delivery_checkout_without_address_fails(customer_client):
    ac, headers = customer_client
    products = (await ac.get("/api/v1/products")).json()["items"]
    prod_id = products[0]["id"]

    await ac.post(
        "/api/v1/cart/items",
        json={"product_id": prod_id, "quantity": 1},
        headers=headers,
    )

    # Checkout with DELIVERY but no note or address ID
    order_resp = await ac.post(
        "/api/v1/checkout",
        json={"fulfillment_type": "DELIVERY"},
        headers=headers,
    )
    assert order_resp.status_code == 400
    assert "Delivery address or instructions are required" in order_resp.json()["detail"]


@pytest.mark.asyncio
async def test_stock_reservation_automatic_expiration(customer_client):
    ac, headers = customer_client
    from datetime import datetime, timezone, timedelta
    from app.services.order_service import expire_abandoned_orders
    from app.models.order import Order, OrderStatus
    from app.models.store import Inventory

    # 1. Add item to cart and checkout to create a PENDING order
    products = (await ac.get("/api/v1/products")).json()["items"]
    prod_id = products[0]["id"]

    await ac.post(
        "/api/v1/cart/items",
        json={"product_id": prod_id, "quantity": 2},
        headers=headers,
    )

    order_resp = await ac.post(
        "/api/v1/checkout",
        json={"fulfillment_type": "PICKUP", "note": "Cleanup test"},
        headers=headers,
    )
    assert order_resp.status_code == 201
    order_id = order_resp.json()["id"]

    async with TestingSessionLocal() as session:
        # Verify order is PENDING
        order_db = await session.get(Order, uuid.UUID(order_id))
        assert order_db.status == OrderStatus.PENDING

        # Check inventory: stock is reserved (quantity_reserved > 0)
        inv_res = await session.execute(
            select(Inventory).where(Inventory.product_id == uuid.UUID(prod_id))
        )
        inv = inv_res.scalars().first()
        initial_avail = inv.quantity_available
        initial_reserved = inv.quantity_reserved
        assert initial_reserved >= 2

        # 2. Run cleanup now. Since order is fresh, it should NOT expire.
        expired_count = await expire_abandoned_orders(session)
        assert expired_count == 0

        # Reload order
        session.expire(order_db)
        order_db = await session.get(Order, uuid.UUID(order_id))
        assert order_db.status == OrderStatus.PENDING

        # 3. Artificially backdate the order's created_at by 20 minutes
        order_db.created_at = datetime.now(timezone.utc) - timedelta(minutes=20)
        await session.commit()

    async with TestingSessionLocal() as session:
        # 4. Run cleanup again. This time it should expire the order.
        expired_count = await expire_abandoned_orders(session)
        assert expired_count == 1

        # Verify order status is CANCELLED and stock was released
        order_db = await session.get(Order, uuid.UUID(order_id))
        assert order_db.status == OrderStatus.CANCELLED

        inv_res = await session.execute(
            select(Inventory).where(Inventory.product_id == uuid.UUID(prod_id))
        )
        inv = inv_res.scalars().first()
        # Reserved stock should be decremented and available stock incremented
        assert inv.quantity_reserved == initial_reserved - 2
        assert inv.quantity_available == initial_avail + 2
