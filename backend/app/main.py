import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.v1.api import api_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.order_service import run_stock_reservation_cleanup

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start periodic background task for stock reservation cleanup
    cleanup_task = asyncio.create_task(run_stock_reservation_cleanup(AsyncSessionLocal))
    yield
    # Cleanup task on shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Mini D-Mart API",
    description="Full-stack grocery store API with role-based access control, atomic checkout, and returns",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration - restricted strictly to known frontend origins
origins = settings.CORS_ORIGINS
if isinstance(origins, str):
    origins = [origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add defensive HTTP security headers to all outgoing responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler to prevent leaking internal stack traces, DB errors, or server paths."""
    # Let standard FastAPI HTTPExceptions pass through untouched
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=exc.headers,
        )
    if isinstance(exc, RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": exc.errors()},
        )

    logger.exception("Unhandled server exception processing %s %s: %s", request.method, request.url, str(exc))
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": f"Server Error: {str(exc)}"},
    )


@app.get("/health", tags=["Health"])
async def health_check():
    db_status = "ok"
    error_msg = None
    try:
        from sqlalchemy import text
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception as e:
        db_status = "error"
        error_msg = str(e)
    return {"status": "ok", "database": db_status, "error": error_msg}


app.include_router(api_router, prefix="/api/v1")
