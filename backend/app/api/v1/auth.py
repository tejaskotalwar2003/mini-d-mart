from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.rate_limit import auth_rate_limiter
from app.core.security import get_password_hash, verify_password
from app.models.user import Address, User
from app.schemas.auth import (
    AddressResponse,
    RefreshRequest,
    TokenResponse,
    UserLogin,
    UserProfileResponse,
    UserProfileUpdate,
    UserRegister,
)
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


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch full profile details including addresses for the current authenticated user."""
    addr_res = await db.execute(
        select(Address).where(Address.user_id == current_user.id).order_by(Address.is_default.desc())
    )
    addresses = list(addr_res.scalars().all())

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        phone=current_user.phone,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        addresses=[
            AddressResponse(
                id=a.id,
                line1=a.line1,
                line2=a.line2,
                city=a.city,
                pincode=a.pincode,
                is_default=a.is_default,
            )
            for a in addresses
        ],
    )


@router.patch("/me", response_model=UserProfileResponse)
async def update_me(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update profile information (name, phone, email, address, password) for the current user."""
    # 1. Update name
    if payload.name is not None and payload.name.strip():
        current_user.name = payload.name.strip()

    # 2. Update phone
    if payload.phone is not None:
        current_user.phone = payload.phone.strip() if payload.phone.strip() else None

    # 3. Update email if changed
    if payload.email is not None:
        new_email = payload.email.strip().lower()
        if new_email != current_user.email:
            existing = await db.execute(select(User).where(User.email == new_email))
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This email address is already taken by another account.",
                )
            current_user.email = new_email

    # 4. Update address if provided
    if (
        payload.address_line1 is not None
        or payload.city is not None
        or payload.pincode is not None
    ):
        addr_res = await db.execute(
            select(Address)
            .where(Address.user_id == current_user.id)
            .order_by(Address.is_default.desc())
        )
        existing_address = addr_res.scalars().first()

        line1 = payload.address_line1.strip() if payload.address_line1 else (existing_address.line1 if existing_address else "Default Address")
        line2 = payload.address_line2.strip() if payload.address_line2 is not None else (existing_address.line2 if existing_address else None)
        city = payload.city.strip() if payload.city else (existing_address.city if existing_address else "Pune")
        pincode = payload.pincode.strip() if payload.pincode else (existing_address.pincode if existing_address else "411001")

        if existing_address:
            existing_address.line1 = line1
            existing_address.line2 = line2
            existing_address.city = city
            existing_address.pincode = pincode
            existing_address.is_default = True
        else:
            new_address = Address(
                user_id=current_user.id,
                line1=line1,
                line2=line2,
                city=city,
                pincode=pincode,
                is_default=True,
            )
            db.add(new_address)

    # 5. Update password if requested
    if payload.new_password is not None and payload.new_password.strip():
        if not payload.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required to set a new password.",
            )
        if not verify_password(payload.current_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password verification failed. Please enter your correct password.",
            )
        if len(payload.new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 8 characters long.",
            )
        current_user.password_hash = get_password_hash(payload.new_password)

    await db.commit()
    await db.refresh(current_user)

    # Fetch updated addresses
    addr_res = await db.execute(
        select(Address).where(Address.user_id == current_user.id).order_by(Address.is_default.desc())
    )
    addresses = list(addr_res.scalars().all())

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        phone=current_user.phone,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        addresses=[
            AddressResponse(
                id=a.id,
                line1=a.line1,
                line2=a.line2,
                city=a.city,
                pincode=a.pincode,
                is_default=a.is_default,
            )
            for a in addresses
        ],
    )
