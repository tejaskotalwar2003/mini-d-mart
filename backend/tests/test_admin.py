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
from app.models.catalog import Category, Product
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
async def admin_headers(client: AsyncClient):
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "admin@minidmart.com",
        "password": "Admin@123",
    })
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(scope="function")
async def staff_headers(client: AsyncClient):
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "staff@minidmart.com",
        "password": "Staff@123",
    })
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(scope="function")
async def customer_headers(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "cust_admin_test@example.com",
        "password": "Password123",
        "name": "Customer Admin Tester",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_get_audit_logs_as_non_admin_fails(client: AsyncClient, customer_headers: dict):
    resp = await client.get("/api/v1/admin/audit-logs", headers=customer_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_product_creation_generates_audit_log(client: AsyncClient, admin_headers: dict):
    cats = (await client.get("/api/v1/categories")).json()
    cat_id = cats[0]["id"]

    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Audit Test Product",
        "sku": "SKU-AUDIT-01",
        "price": "149.50",
        "unit": "pack",
    }, headers=admin_headers)
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    logs_res = await client.get("/api/v1/admin/audit-logs?action=PRODUCT_CREATED", headers=admin_headers)
    assert logs_res.status_code == 200
    logs = logs_res.json()
    assert len(logs) >= 1
    match = next(l for l in logs if l["entity_id"] == prod_id)
    assert match["action"] == "PRODUCT_CREATED"
    assert match["metadata"]["sku"] == "SKU-AUDIT-01"


@pytest.mark.asyncio
async def test_return_approval_generates_audit_log(client: AsyncClient, customer_headers: dict, staff_headers: dict, admin_headers: dict):
    # Place order & complete
    prods = (await client.get("/api/v1/products")).json()["items"]
    prod = prods[0]
    p_id = prod["id"]
    await client.post("/api/v1/cart/items", json={"product_id": p_id, "quantity": 1}, headers=customer_headers)
    order = (await client.post("/api/v1/checkout", json={"fulfillment_type": "PICKUP"}, headers=customer_headers)).json()
    order_id = order["id"]
    item_id = order["items"][0]["id"]

    for next_st in ["CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "COMPLETED"]:
        await client.patch(f"/api/v1/orders/{order_id}/status", json={"to_status": next_st}, headers=staff_headers)

    ret_req = (await client.post(f"/api/v1/orders/{order_id}/returns", json={"order_item_id": item_id, "type": "RETURN", "requested_qty": 1, "reason": "Damaged"}, headers=customer_headers)).json()
    ret_id = ret_req["id"]

    # Staff approves
    await client.patch(f"/api/v1/staff/returns/{ret_id}/approve", headers=staff_headers)

    # Admin verifies audit logs
    logs_res = await client.get("/api/v1/admin/audit-logs?action=RETURN_APPROVED", headers=admin_headers)
    assert logs_res.status_code == 200
    logs = logs_res.json()
    assert len(logs) >= 1
    assert any(l["entity_id"] == ret_id for l in logs)


@pytest.mark.asyncio
async def test_get_low_stock_products(client: AsyncClient, admin_headers: dict):
    # Adjust a product's inventory to 5 (reorder_threshold is 10)
    async with TestingSessionLocal() as session:
        inv_res = await session.execute(select(Inventory))
        inv = inv_res.scalars().first()
        inv.quantity_available = 5
        await session.commit()

    low_res = await client.get("/api/v1/admin/inventory/low-stock", headers=admin_headers)
    assert low_res.status_code == 200
    items = low_res.json()
    assert len(items) >= 1
    assert any(item["quantity_available"] <= item["reorder_threshold"] for item in items)


@pytest.mark.asyncio
async def test_adjust_inventory_success_and_creates_audit_log(client: AsyncClient, admin_headers: dict):
    inv_list = (await client.get("/api/v1/admin/inventory", headers=admin_headers)).json()
    inv_id = inv_list[0]["id"]

    adjust_res = await client.patch(
        f"/api/v1/admin/inventory/{inv_id}/adjust",
        json={"new_quantity_available": 150, "reason": "Restocked bulk shipment from distributor"},
        headers=admin_headers,
    )
    assert adjust_res.status_code == 200
    assert adjust_res.json()["quantity_available"] == 150

    # Verify audit log created
    logs_res = await client.get("/api/v1/admin/audit-logs?action=INVENTORY_ADJUSTED", headers=admin_headers)
    assert logs_res.status_code == 200
    logs = logs_res.json()
    assert len(logs) >= 1
    match = next(l for l in logs if l["entity_id"] == inv_id)
    assert match["metadata"]["new_quantity"] == 150
    assert match["metadata"]["reason"] == "Restocked bulk shipment from distributor"


@pytest.mark.asyncio
async def test_adjust_inventory_as_staff_fails(client: AsyncClient, staff_headers: dict, admin_headers: dict):
    inv_list = (await client.get("/api/v1/admin/inventory", headers=admin_headers)).json()
    inv_id = inv_list[0]["id"]

    adjust_res = await client.patch(
        f"/api/v1/admin/inventory/{inv_id}/adjust",
        json={"new_quantity_available": 200, "reason": "Unauthorized attempt"},
        headers=staff_headers,
    )
    assert adjust_res.status_code == 403
