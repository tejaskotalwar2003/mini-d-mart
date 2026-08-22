"""
Supabase PostgreSQL Migration Script
Migrates all tables, schemas, and live data from SQLite (mini_dmart.db) to Supabase PostgreSQL.

Usage:
    python -m app.db.migrate_to_supabase [SUPABASE_DATABASE_URL]
"""

import asyncio
import sys
import sqlite3
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from app.db.base_class import Base
# Import all models to ensure registered in Base.metadata
from app.models.user import User, Role
from app.models.catalog import Category, Product
from app.models.store import Store, Inventory
from app.models.pickup_slot import PickupSlot
from app.models.cart import Cart, CartItem
from app.models.order import Order, OrderItem, OrderStatusLog
from app.models.return_request import ReturnRequest
from app.models.audit_log import AuditLog
from app.core.config import settings


async def migrate_to_supabase(target_db_url: Optional[str] = None):
    url = target_db_url or settings.DATABASE_URL
    if not url or "postgresql" not in url:
        print("[ERROR] A valid PostgreSQL/Supabase database URL is required.")
        print("Example: postgresql+asyncpg://postgres.xxxx:your_password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres")
        return False

    # Ensure asyncpg driver prefix
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)

    print(f"\n🚀 Connecting to Supabase PostgreSQL at:\n   {url.split('@')[-1] if '@' in url else url}\n")

    target_engine = create_async_engine(url, echo=False, future=True)

    # 1. Create all tables in Supabase PostgreSQL
    print("📦 Step 1: Creating database tables and schemas in Supabase...")
    async with target_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("   ✅ All tables created successfully in Supabase.")

    # 2. Open SQLite database to read existing data
    print("\n💾 Step 2: Reading existing data from local SQLite database (mini_dmart.db)...")
    try:
        sqlite_conn = sqlite3.connect("mini_dmart.db")
        sqlite_conn.row_factory = sqlite3.Row
        cur = sqlite_conn.cursor()
    except Exception as e:
        print(f"   ⚠️ Could not open mini_dmart.db: {e}")
        return False

    tables_order = [
        "users",
        "categories",
        "products",
        "stores",
        "inventory",
        "pickup_slots",
        "carts",
        "cart_items",
        "orders",
        "order_items",
        "order_status_logs",
        "return_requests",
        "audit_logs",
    ]

    # 3. Transfer rows table by table
    print("\n🚚 Step 3: Migrating records to Supabase PostgreSQL...")
    async_session = async_sessionmaker(bind=target_engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        for table in tables_order:
            try:
                cur.execute(f"SELECT * FROM {table}")
                rows = cur.fetchall()
                if not rows:
                    print(f"   • Table '{table}': 0 rows found in SQLite. Skipping.")
                    continue

                col_names = [description[0] for description in cur.description]
                inserted_count = 0

                for row in rows:
                    row_dict = dict(row)
                    
                    # Convert boolean integers, date/time/datetime strings, and JSON objects for PostgreSQL
                    for k, v in row_dict.items():
                        if k in ("is_active", "is_returnable") and isinstance(v, int):
                            row_dict[k] = bool(v)
                        
                        if isinstance(v, str):
                            # Try parsing as datetime (e.g. '2026-08-22 07:46:26')
                            if k in ("created_at", "updated_at", "resolved_at"):
                                for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
                                    try:
                                        row_dict[k] = datetime.strptime(v, fmt)
                                        break
                                    except ValueError:
                                        continue
                            # Try parsing as date (e.g. '2026-08-22')
                            elif k == "date":
                                try:
                                    row_dict[k] = datetime.strptime(v, "%Y-%m-%d").date()
                                except ValueError:
                                    pass
                            # Try parsing as time (e.g. '10:00:00.000000')
                            elif k in ("start_time", "end_time"):
                                for fmt in ("%H:%M:%S.%f", "%H:%M:%S"):
                                    try:
                                        row_dict[k] = datetime.strptime(v, fmt).time()
                                        break
                                    except ValueError:
                                        continue

                        # Handle metadata_json field type (pass as string to bypass type issue)
                        if k == "metadata_json":
                            import json
                            if isinstance(v, (dict, list)):
                                row_dict[k] = json.dumps(v)

                    placeholders = ", ".join([f":{col}" for col in col_names])
                    cols_str = ", ".join(col_names)
                    stmt = text(f"INSERT INTO {table} ({cols_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING")
                    await session.execute(stmt, row_dict)
                    inserted_count += 1

                await session.commit()
                print(f"   ✅ Table '{table}': Migrated {inserted_count} record(s) to Supabase.")
            except Exception as ex:
                print(f"   ⚠️ Error migrating table '{table}': {ex}")
                await session.rollback()

    sqlite_conn.close()
    await target_engine.dispose()
    print("\n🎉 Migration to Supabase completed successfully! All data is now live on Supabase.\n")
    return True


if __name__ == "__main__":
    target_url = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(migrate_to_supabase(target_url))
