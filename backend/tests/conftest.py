import pytest
from app.core.rate_limit import auth_rate_limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter_for_tests():
    """Ensure in-memory rate limiter state is completely clean before and after every test."""
    auth_rate_limiter.reset()
    yield
    auth_rate_limiter.reset()
