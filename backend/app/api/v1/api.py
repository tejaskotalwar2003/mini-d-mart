from fastapi import APIRouter
from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.cart import router as cart_router
from app.api.v1.catalog import router as catalog_router
from app.api.v1.orders import router as orders_router
from app.api.v1.pickup_slots import router as pickup_slots_router
from app.api.v1.returns import router as returns_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(catalog_router)
api_router.include_router(cart_router)
api_router.include_router(orders_router)
api_router.include_router(pickup_slots_router)
api_router.include_router(returns_router)
api_router.include_router(admin_router)
