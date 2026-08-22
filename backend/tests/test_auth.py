import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import get_db
from app.db.base_class import Base
from app.main import app

# In-memory SQLite async test database for isolated, fast test execution
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
    """Create all tables before each test and drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client():
    """Override get_db dependency and return AsyncClient."""
    async def override_get_db():
        async with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_register_user_success(client: AsyncClient):
    payload = {
        "email": "testuser@example.com",
        "password": "Password123",
        "name": "Test User",
        "phone": "+919876543210",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email_fails(client: AsyncClient):
    payload = {
        "email": "duplicate@example.com",
        "password": "Password123",
        "name": "First User",
    }
    resp1 = await client.post("/api/v1/auth/register", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/v1/auth/register", json=payload)
    assert resp2.status_code == 409
    assert resp2.json()["detail"] == "Email address is already registered."


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    reg_payload = {
        "email": "loginuser@example.com",
        "password": "Password123",
        "name": "Login User",
    }
    await client.post("/api/v1/auth/register", json=reg_payload)

    login_payload = {
        "email": "loginuser@example.com",
        "password": "Password123",
    }
    response = await client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password_fails(client: AsyncClient):
    reg_payload = {
        "email": "wrongpass@example.com",
        "password": "Password123",
        "name": "Wrong Pass User",
    }
    await client.post("/api/v1/auth/register", json=reg_payload)

    login_payload = {
        "email": "wrongpass@example.com",
        "password": "WrongPassword999",
    }
    response = await client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."


@pytest.mark.asyncio
async def test_get_me_without_token_fails(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_get_me_with_valid_token_success(client: AsyncClient):
    reg_payload = {
        "email": "meuser@example.com",
        "password": "Password123",
        "name": "Profile User",
    }
    reg_resp = await client.post("/api/v1/auth/register", json=reg_payload)
    tokens = reg_resp.json()
    token = tokens["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    user_data = response.json()
    assert user_data["email"] == "meuser@example.com"
    assert user_data["name"] == "Profile User"
    assert user_data["role"] == "CUSTOMER"
    assert "password_hash" not in user_data
