from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(
    title="Mini D-Mart API",
    description="Full-stack grocery store API",
    version="0.1.0",
)

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


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok"}

# Router inclusion placeholder:
# from app.api.v1.api import api_router
# app.include_router(api_router, prefix="/api/v1")
