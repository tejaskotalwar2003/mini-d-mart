from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.rate_limit import auth_rate_limiter
from app.models.user import User
from app.schemas.auth import RefreshRequest, TokenResponse, UserLogin, UserRegister, UserResponse
from app.services.auth_service import authenticate_user, refresh_access_token, register_user

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(auth_rate_limiter)],
)
async def register(
    data: UserRegister,
    db: AsyncSession = Depends(get_db),
):
    """Register a new customer account.

    Registers user with role=CUSTOMER and immediately returns access and refresh JWT tokens.
    """
    user, access_token, refresh_token = await register_user(db, data)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(auth_rate_limiter)],
)
async def login(
    data: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user with email and password.

    Returns access and refresh JWT tokens on successful authentication.
    """
    user, access_token, refresh_token = await authenticate_user(db, data.email, data.password)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Obtain new access and refresh JWT tokens using a valid refresh token."""
    new_access_token, new_refresh_token = await refresh_access_token(db, data.refresh_token)
    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Fetch profile details for the current authenticated user."""
    return current_user
