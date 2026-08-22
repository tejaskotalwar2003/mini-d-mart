import uuid
from typing import Tuple
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import create_access_token, create_refresh_token, decode_token, get_password_hash, verify_password
from app.models.user import Role, User
from app.schemas.auth import UserRegister


async def register_user(db: AsyncSession, data: UserRegister) -> Tuple[User, str, str]:
    """Register a new customer account and return (user, access_token, refresh_token)."""
    # 1. Check email uniqueness
    result = await db.execute(select(User).where(User.email == data.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email address is already registered.",
        )

    # SECURITY DECISION: Always hardcode role=Role.CUSTOMER for public registration.
    # Public registration endpoints must never accept or assign STAFF or ADMIN roles from user payload
    # to prevent privilege escalation attacks.
    new_user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        name=data.name,
        phone=data.phone,
        role=Role.CUSTOMER,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    access_token = create_access_token(subject=str(new_user.id), role=new_user.role.value)
    refresh_token = create_refresh_token(subject=str(new_user.id))
    return new_user, access_token, refresh_token


async def authenticate_user(db: AsyncSession, email: str, password: str) -> Tuple[User, str, str]:
    """Authenticate user credentials and return (user, access_token, refresh_token)."""
    normalized_email = email.strip().lower()
    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive. Please contact support.",
        )

    access_token = create_access_token(subject=str(user.id), role=user.role.value)
    refresh_token = create_refresh_token(subject=str(user.id))
    return user, access_token, refresh_token


async def refresh_access_token(db: AsyncSession, refresh_token: str) -> Tuple[str, str]:
    """Validate refresh token and issue a new pair of access & refresh tokens."""
    try:
        payload = decode_token(refresh_token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    token_type = payload.get("type")
    user_id_str = payload.get("sub")

    if token_type != "refresh" or not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type for refresh endpoint.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = uuid.UUID(str(user_id_str))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    new_access_token = create_access_token(subject=str(user.id), role=user.role.value)
    new_refresh_token = create_refresh_token(subject=str(user.id))
    return new_access_token, new_refresh_token
