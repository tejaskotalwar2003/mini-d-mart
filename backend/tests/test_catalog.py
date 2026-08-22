import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import get_db
from app.db.base_class import Base
from app.db.seed import seed
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, future=True)
TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="function", autouse=True)
async def setup_test_db():
    """Create tables, seed sample data before each test, drop after."""
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
    """Helper fixture obtaining JWT Bearer headers for Admin user (seeded admin@minidmart.com)."""
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "admin@minidmart.com",
        "password": "Admin@123",
    })
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(scope="function")
async def customer_headers(client: AsyncClient):
    """Helper fixture obtaining JWT Bearer headers for a registered CUSTOMER."""
    reg_resp = await client.post("/api/v1/auth/register", json={
        "email": "customer_catalog@example.com",
        "password": "Password123",
        "name": "Customer Catalog",
    })
    token = reg_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_get_products_returns_seeded_items(client: AsyncClient):
    response = await client.get("/api/v1/products?page_size=100")
    assert response.status_code == 200
    data = response.json()
    # New seed: 350 base products (parent_id IS NULL) across 7 categories
    assert data["total"] == 350
    assert len(data["items"]) == 100  # page_size=100


@pytest.mark.asyncio
async def test_get_products_search_filter(client: AsyncClient):
    response = await client.get("/api/v1/products?search=mango&page_size=20")
    assert response.status_code == 200
    data = response.json()
    # At least 1 mango product (base product only, not variants)
    assert data["total"] >= 1
    assert any("Mango" in item["name"] or "mango" in item["name"].lower() for item in data["items"])


@pytest.mark.asyncio
async def test_get_products_category_filter(client: AsyncClient):
    cats_resp = await client.get("/api/v1/categories")
    assert cats_resp.status_code == 200
    categories = cats_resp.json()
    # New seed: 7 categories
    assert len(categories) == 7

    target_cat = categories[0]
    cat_id = target_cat["id"]

    response = await client.get(f"/api/v1/products?category_id={cat_id}&page_size=50")
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["category_id"] == cat_id


@pytest.mark.asyncio
async def test_get_products_price_range_filter(client: AsyncClient):
    response = await client.get("/api/v1/products?min_price=100&max_price=300")
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        price = float(item["price"])
        assert 100.0 <= price <= 300.0


@pytest.mark.asyncio
async def test_post_product_as_customer_fails(client: AsyncClient, customer_headers: dict):
    cats_resp = await client.get("/api/v1/categories")
    cat_id = cats_resp.json()[0]["id"]

    payload = {
        "category_id": cat_id,
        "name": "Unauthorized Product",
        "sku": "PROD-UNAUTH-01",
        "price": 100.0,
        "unit": "pack",
    }
    response = await client.post("/api/v1/products", json=payload, headers=customer_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_post_product_as_admin_success(client: AsyncClient, admin_headers: dict):
    cats_resp = await client.get("/api/v1/categories")
    cat_id = cats_resp.json()[0]["id"]

    payload = {
        "category_id": cat_id,
        "name": "New Admin Product",
        "description": "Created by admin test",
        "sku": "PROD-NEW-ADMIN-01",
        "price": 199.50,
        "unit": "pack",
        "is_returnable": True,
    }
    response = await client.post("/api/v1/products", json=payload, headers=admin_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "New Admin Product"
    assert data["sku"] == "PROD-NEW-ADMIN-01"


@pytest.mark.asyncio
async def test_post_product_duplicate_sku_fails(client: AsyncClient, admin_headers: dict):
    cats_resp = await client.get("/api/v1/categories")
    cat_id = cats_resp.json()[0]["id"]

    # Get an existing SKU from the seeded products
    prods_resp = await client.get("/api/v1/products")
    existing_sku = prods_resp.json()["items"][0]["sku"]

    payload = {
        "category_id": cat_id,
        "name": "Duplicate SKU Product",
        "sku": existing_sku,
        "price": 100.0,
        "unit": "kg",
    }
    response = await client.post("/api/v1/products", json=payload, headers=admin_headers)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_patch_product_updates_field(client: AsyncClient, admin_headers: dict):
    prods_resp = await client.get("/api/v1/products")
    product_id = prods_resp.json()["items"][0]["id"]

    patch_payload = {"name": "Updated Alphonso Mangoes Extra Fresh", "price": 449.00}
    response = await client.patch(f"/api/v1/products/{product_id}", json=patch_payload, headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Alphonso Mangoes Extra Fresh"
    assert float(data["price"]) == 449.00


@pytest.mark.asyncio
async def test_delete_product_soft_deletes(client: AsyncClient, admin_headers: dict):
    prods_resp = await client.get("/api/v1/products")
    product_id = prods_resp.json()["items"][0]["id"]

    del_resp = await client.delete(f"/api/v1/products/{product_id}", headers=admin_headers)
    assert del_resp.status_code == 204

    public_resp = await client.get("/api/v1/products")
    public_items = public_resp.json()["items"]
    assert not any(p["id"] == product_id for p in public_items)

    admin_resp = await client.get("/api/v1/admin/products", headers=admin_headers)
    admin_items = admin_resp.json()["items"]
    deleted_p = next(p for p in admin_items if p["id"] == product_id)
    assert deleted_p["is_active"] is False
