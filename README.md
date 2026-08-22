# Mini D-Mart — Full-Stack Grocery E-Commerce Platform

Mini D-Mart is a full-stack, enterprise-grade online grocery and supermarket web application featuring multi-role access control (Customer, Store Staff, System Admin). It provides a seamless e-commerce customer experience (browsing, real-time stock-aware shopping cart, scheduled pickup slot reservation, and order return/exchange workflows), an operational Staff Control Center (order lifecycle state machine management and return verification), and an administrative control panel (product catalog CRUD, inventory adjustments, and immutable audit logging).

---

## 🛠 Tech Stack

- **Backend**: Python 3.13, [FastAPI](https://fastapi.tiangolo.com/) (async REST API), [Pydantic v2](https://docs.pydantic.dev/) (strict validation & schemas), [SlowAPI / Custom In-Memory Sliding Window](https://fastapi.tiangolo.com/) (rate limiting)
- **Database & ORM**: [SQLAlchemy 2.0](https://www.sqlalchemy.org/) (Async ORM with transactional `with_for_update` row locking), [Alembic](https://alembic.sqlalchemy.org/) (schema migrations), [SQLite (`aiosqlite`)](https://github.com/omnilib/aiosqlite) / [PostgreSQL (`asyncpg`)](https://github.com/MagicStack/asyncpg)
- **Authentication & Security**: JWT (HMAC-SHA256 access & refresh tokens), [Passlib](https://passlib.readthedocs.io/) with `bcrypt` password hashing, Role-Based Access Control (RBAC) dependency injection, defensive HTTP security headers middleware
- **Frontend**: React 18, TypeScript, [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/) (icons), [Axios](https://axios-http.com/) (with JWT token auto-refresh interceptors), [React Router v6](https://reactrouter.com/)
- **Testing**: [Pytest](https://docs.pytest.org/), `pytest-asyncio`, `httpx` (in-memory async database fixtures)

---

## 🏛 Architecture Diagram

```
+-------------------------------------------------------------------------+
|                           BROWSER CLIENT                                |
|                                                                         |
|  +--------------------+  +--------------------+  +--------------------+  |
|  |  Customer Portal   |  |    Staff Portal    |  |    Admin Portal    |  |
|  | (Catalog, Cart,    |  |  (Order Queue,     |  | (Product CRUD,     |  |
|  |  Checkout, Orders) |  |   Returns Desk)    |  |  Inventory, Logs)  |  |
|  +--------------------+  +--------------------+  +--------------------+  |
|            |                        |                       |           |
|            +------------------------+-----------------------+           |
|                                     |                                   |
|                React 18 + TypeScript SPA (Vite Dev Server)              |
|                     Axios Client (Bearer Auth & Refresh)                |
+-------------------------------------+-----------------------------------+
                                      | HTTP REST / JSON
                                      v (CORS Filtered + Rate Limited)
+-------------------------------------------------------------------------+
|                            FASTAPI BACKEND                              |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | Middleware: Security Headers, CORS, Global 500 Sanitizer, RateLim |  |
|  +-------------------------------------------------------------------+  |
|  | Dependency Injection Layer:                                       |  |
|  |  - get_db (AsyncSession)                                          |  |
|  |  - get_current_user (JWT Bearer Token -> User)                    |  |
|  |  - require_role(CUSTOMER, STAFF, ADMIN)                           |  |
|  +-------------------------------------------------------------------+  |
|  | API Routers:                                                      |  |
|  |  /auth         - Registration, Login, Token Refresh, Me Profile   |  |
|  |  /catalog      - Public Category & Product Browsing, Admin Setup  |  |
|  |  /cart         - Real-time Cart Management & Stock Bounds Check   |  |
|  |  /orders       - Atomic Checkout (FOR UPDATE), Order Lifecycle    |  |
|  |  /pickup-slots - Capacity-tracked Scheduled Store Pickup Slots    |  |
|  |  /returns      - Return/Exchange Policy Engine & Approvals        |  |
|  |  /admin        - Inventory Adjustments & Immutable Audit Logs     |  |
|  +-------------------------------------------------------------------+  |
|  | Core Domain Services & Explicit State Machine Engine              |  |
|  |  - order_state.py (Enforces valid status graph transitions)       |  |
|  |  - return_eligibility.py (7-day window, qty, & returnable checks) |  |
|  |  - audit_service.py (Structured immutable action auditing)        |  |
+-------------------------------------+-----------------------------------+
                                      | Async SQLAlchemy 2.0 (ORM)
                                      v
+-------------------------------------------------------------------------+
|                           DATABASE ENGINE                               |
|        SQLite (aiosqlite: mini_dmart.db) / PostgreSQL (asyncpg)         |
|                                                                         |
| [users] [categories] [products] [stores] [inventory] [pickup_slots]    |
| [carts] [cart_items] [orders] [order_items] [order_status_logs]         |
| [return_requests] [audit_logs]                                          |
+-------------------------------------------------------------------------+
```

---

## 🗄 Database Schema Overview

The relational database schema is structured into 13 tables:

1. **`users`**: User identity accounts with unique email, bcrypt password hash, profile metadata, active status, and assigned system role (`CUSTOMER`, `STAFF`, `ADMIN`).
2. **`categories`**: Product taxonomy categories with hierarchical parent-child support and URL-friendly slugs.
3. **`products`**: Grocery catalog items containing SKU, name, description, unit price, unit measurement, returnability flag, and soft-delete active state.
4. **`stores`**: Physical retail store branches with addresses and contact details.
5. **`inventory`**: Store-level product inventory tracking `quantity_available`, `quantity_reserved`, and `reorder_threshold`.
6. **`pickup_slots`**: Scheduled store pickup time windows with date, start/end time, total customer capacity, and booked reservation counter.
7. **`carts`**: Active shopping cart sessions (enforcing a strict 1-to-1 relationship per registered user).
8. **`cart_items`**: Line items inside a cart referencing products and requested quantities with unique `(cart_id, product_id)` constraints.
9. **`orders`**: Placed customer orders with generated order numbers (`ORD-...`), total/tax breakdown, fulfillment type (`PICKUP` / `DELIVERY`), and linked pickup slot / delivery address.
10. **`order_items`**: Immutable line item snapshots capturing product details and `unit_price_at_order` at the precise moment of checkout.
11. **`order_status_logs`**: Immutable audit logs capturing every state machine transition with timestamp, previous status, next status, actor ID, and explanatory notes.
12. **`return_requests`**: Customer return and exchange requests tracking item ID, return type (`RETURN` / `EXCHANGE`), requested quantity, replacement product ID, resolution state, and staff notes.
13. **`audit_logs`**: Immutable administrative and system audit trails recording action types (`PRODUCT_CREATED`, `ORDER_STATUS_CHANGED`, `RETURN_APPROVED`, `INVENTORY_ADJUSTED`), actor ID, entity UUID, and JSON diff metadata.

---

## 🔐 Role-Based Access Control (RBAC) Matrix

| Endpoint / Action | Unauthenticated / Guest | CUSTOMER | STAFF | ADMIN |
|---|:---:|:---:|:---:|:---:|
| `POST /api/v1/auth/register` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/v1/auth/login` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/auth/me` | ❌ | ✅ | ✅ | ✅ |
| `GET /api/v1/categories` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/products` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/products/{id}` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/cart` | ❌ | ✅ (Own Cart) | ✅ (Own Cart) | ✅ (Own Cart) |
| `POST /api/v1/cart/items` | ❌ | ✅ | ✅ | ✅ |
| `PATCH /api/v1/cart/items/{id}` | ❌ | ✅ (Own Item) | ✅ (Own Item) | ✅ (Own Item) |
| `DELETE /api/v1/cart/items/{id}` | ❌ | ✅ (Own Item) | ✅ (Own Item) | ✅ (Own Item) |
| `POST /api/v1/checkout` | ❌ | ✅ | ✅ | ✅ |
| `GET /api/v1/orders` | ❌ | ✅ (Own Orders) | ✅ (Own Orders) | ✅ (Own Orders) |
| `GET /api/v1/orders/{id}` | ❌ | ✅ (Own Order) | ✅ (Own Order) | ✅ (Own Order) |
| `POST /api/v1/orders/{id}/cancel` | ❌ | ✅ (If PENDING/CONFIRMED) | ❌ | ❌ |
| `GET /api/v1/pickup-slots` | ❌ | ✅ | ✅ | ✅ |
| `POST /api/v1/orders/{id}/pickup-slot` | ❌ | ✅ (Own Order) | ❌ | ❌ |
| `POST /api/v1/orders/{id}/returns` | ❌ | ✅ (Own Order Item) | ❌ | ❌ |
| `GET /api/v1/returns` | ❌ | ✅ (Own Returns) | ❌ | ❌ |
| `GET /api/v1/staff/orders` | ❌ | ❌ | ✅ | ✅ |
| `GET /api/v1/staff/orders/upcoming-pickups` | ❌ | ❌ | ✅ | ✅ |
| `PATCH /api/v1/orders/{id}/status` | ❌ | ❌ | ✅ | ✅ |
| `GET /api/v1/staff/returns` | ❌ | ❌ | ✅ | ✅ |
| `PATCH /api/v1/staff/returns/{id}/approve` | ❌ | ❌ | ✅ | ✅ |
| `PATCH /api/v1/staff/returns/{id}/reject` | ❌ | ❌ | ✅ | ✅ |
| `POST /api/v1/categories` | ❌ | ❌ | ❌ | ✅ |
| `POST /api/v1/products` | ❌ | ❌ | ❌ | ✅ |
| `PATCH /api/v1/products/{id}` | ❌ | ❌ | ❌ | ✅ |
| `DELETE /api/v1/products/{id}` | ❌ | ❌ | ❌ | ✅ |
| `GET /api/v1/admin/products` | ❌ | ❌ | ❌ | ✅ |
| `GET /api/v1/admin/inventory` | ❌ | ❌ | ❌ | ✅ |
| `GET /api/v1/admin/inventory/low-stock` | ❌ | ❌ | ❌ | ✅ |
| `PATCH /api/v1/admin/inventory/{id}/adjust` | ❌ | ❌ | ❌ | ✅ |
| `GET /api/v1/admin/audit-logs` | ❌ | ❌ | ❌ | ✅ |

---

## 🔄 Order Lifecycle State Machine

The order lifecycle is implemented as a strict, deterministic finite state machine (`app/services/order_state.py`). Invalid transitions raise `409 Conflict`.

```
                        [ PENDING ] (Order Placed, Stock Reserved)
                             |
                   +---------+---------+
                   |                   |
                   v                   v
             [ CONFIRMED ]       [ CANCELLED ] (Stock Released)
                   |
                   v
             [ PREPARING ]
                   |
         +---------+---------+
         | (PICKUP)          | (DELIVERY)
         v                   v
[ READY_FOR_PICKUP ]   [ OUT_FOR_DELIVERY ]
         |                   |
         v                   v
   [ COMPLETED ]       [ DELIVERED ]
         |                   |
         +---------+---------+
                   |
                   v (Customer requests return within 7 days)
          [ RETURN_REQUESTED ]
                   |
         +---------+---------+
         |                   |
         v (Staff Approval)  v (Staff Rejection)
  [ RETURN_APPROVED ]   [ RETURN_REJECTED ]
         |
    +----+----+
    |         |
    v         v
[ RETURNED ] [ EXCHANGED ]
```

---

## 🚀 Setup Instructions

### Prerequisites
- Python 3.10+ (tested on Python 3.13)
- Node.js 18+ and npm
- Git

### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment file
cp .env.example .env

# Run database migrations
alembic upgrade head

# Seed initial store catalog, users, products, and inventory
python -m app.db.seed

# Start FastAPI server (runs at http://localhost:8000)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup
```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Configure environment file
cp .env.example .env

# Start Vite development server (runs at http://localhost:5173)
npm run dev
```

---

## ⚙️ Environment Variables Reference

### Backend (`backend/.env`)
| Variable | Description | Example Value |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy async connection string | `sqlite+aiosqlite:///./mini_dmart.db` |
| `JWT_SECRET_KEY` | Cryptographic secret key for signing JWT tokens | `09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7` |
| `JWT_ALGORITHM` | Algorithm used for JWT token signing | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Lifetime of short-lived JWT access tokens | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Lifetime of long-lived JWT refresh tokens | `7` |
| `CORS_ORIGINS` | JSON array or comma-separated list of allowed frontend client origins | `["http://localhost:5173","http://127.0.0.1:5173"]` |

### Frontend (`frontend/.env`)
| Variable | Description | Example Value |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the running FastAPI backend server | `http://localhost:8000` |

---

## 👥 Test Credentials

| Role | Email Address | Password | Permissions & Purpose |
|---|---|---|---|
| **ADMIN** | `admin@minidmart.com` | `Admin@123` | Full access: Product CRUD, store inventory adjustments, low-stock monitoring, system audit logging. |
| **STAFF** | `staff@minidmart.com` | `Staff@123` | Operational access: Order processing queue, state machine advances, pickup schedule overview, return request review. |
| **CUSTOMER** | `customer@minidmart.com` | `Customer@123` | Public shopper access: Catalog browsing, cart management, checkout, slot booking, order tracking, returns. |
| **CUSTOMER (Alt)** | `end2end_customer@example.com` | `Password123` | Secondary test customer account. |

---

## 📖 Key API Endpoints Reference

Interactive documentation is automatically generated by FastAPI and accessible at `http://localhost:8000/docs`. Below is a condensed reference of core endpoints:

| Method | Endpoint Path | Authentication / Role Required | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | None (Rate Limited: 5/min) | Register a new customer account |
| `POST` | `/api/v1/auth/login` | None (Rate Limited: 5/min) | Authenticate user & receive access + refresh JWTs |
| `POST` | `/api/v1/auth/refresh` | None | Refresh access token using refresh token |
| `GET` | `/api/v1/auth/me` | Bearer Token (Any Role) | Fetch profile & role of current user |
| `GET` | `/api/v1/categories` | Public | List all grocery taxonomy categories |
| `GET` | `/api/v1/products` | Public | Paginated product search, filtering, and stock counts |
| `GET` | `/api/v1/cart` | Bearer Token (Customer) | Retrieve active shopping cart with subtotal |
| `POST` | `/api/v1/cart/items` | Bearer Token (Customer) | Add product to cart with inventory validation |
| `PATCH` | `/api/v1/cart/items/{id}` | Bearer Token (Customer) | Update cart item quantity (0 removes item) |
| `DELETE` | `/api/v1/cart/items/{id}` | Bearer Token (Customer) | Remove item from cart |
| `POST` | `/api/v1/checkout` | Bearer Token (Customer) | Atomic checkout with `FOR UPDATE` stock locking |
| `GET` | `/api/v1/orders` | Bearer Token (Customer) | Retrieve personal order history |
| `GET` | `/api/v1/orders/{id}` | Bearer Token (Owner / Staff) | Fetch single order details & transition history |
| `POST` | `/api/v1/orders/{id}/cancel` | Bearer Token (Owner) | Cancel own order (PENDING/CONFIRMED only) |
| `GET` | `/api/v1/pickup-slots` | Bearer Token (Customer) | List available scheduled pickup time slots |
| `POST` | `/api/v1/orders/{id}/pickup-slot` | Bearer Token (Owner) | Reserve a pickup slot for an order |
| `POST` | `/api/v1/orders/{id}/returns` | Bearer Token (Owner) | Submit a return or exchange request |
| `GET` | `/api/v1/returns` | Bearer Token (Customer) | View own return/exchange requests |
| `GET` | `/api/v1/staff/orders` | Bearer Token (Staff / Admin) | View store order queue with status filter |
| `GET` | `/api/v1/staff/orders/upcoming-pickups` | Bearer Token (Staff / Admin) | View scheduled pickup orders sorted by slot time |
| `PATCH` | `/api/v1/orders/{id}/status` | Bearer Token (Staff / Admin) | Transition order status through lifecycle graph |
| `GET` | `/api/v1/staff/returns` | Bearer Token (Staff / Admin) | View store return/exchange requests |
| `PATCH` | `/api/v1/staff/returns/{id}/approve` | Bearer Token (Staff / Admin) | Approve return/exchange & adjust inventory |
| `PATCH` | `/api/v1/staff/returns/{id}/reject` | Bearer Token (Staff / Admin) | Reject return/exchange with resolution note |
| `POST` | `/api/v1/products` | Bearer Token (Admin) | Create a new catalog product |
| `PATCH` | `/api/v1/products/{id}` | Bearer Token (Admin) | Update product price, SKU, or details |
| `DELETE` | `/api/v1/products/{id}` | Bearer Token (Admin) | Soft-delete product (`is_active = False`) |
| `GET` | `/api/v1/admin/inventory` | Bearer Token (Admin) | Store-level stock overview |
| `GET` | `/api/v1/admin/inventory/low-stock` | Bearer Token (Admin) | Low-stock items at or below reorder threshold |
| `PATCH` | `/api/v1/admin/inventory/{id}/adjust` | Bearer Token (Admin) | Adjust inventory quantity with reason & audit log |
| `GET` | `/api/v1/admin/audit-logs` | Bearer Token (Admin) | Paginated immutable system audit log entries |

---

## ⚠️ Known Limitations

1. **Delivery Address Model**: Delivery addresses are currently captured as a delivery address ID / note during checkout rather than an extensive multi-address user address book.
2. **Single-Store Demonstration**: The seed data and default checkout flow operate against the primary Central Store; multi-store inventory routing exists at the schema layer but checkout defaults to primary inventory.
3. **Simulated Payment Gateway**: Checkout completes atomically with inventory reservation and order creation; third-party payment gateway webhooks (e.g. Razorpay/Stripe) are not integrated.
4. **Notifications**: Order status updates and return approvals are tracked in-app via state history; SMS/Email outbound webhook dispatchers are omitted.
5. **In-Memory Rate Limiting**: Auth rate limiting is implemented via an in-memory sliding window, suitable for single-instance deployments rather than distributed multi-node clusters requiring Redis.
6. **Product Exchange Selector**: The customer exchange UI allows searching catalog items by name/category; it does not perform automated algorithmic product recommendations.

---

## 🤖 AI Usage & Pair Programming Disclosure

This project was built with the assistance of AI coding assistants (Claude / Claude Code / Antigravity):

### Areas where AI was utilized:
- **Scaffolding & Boilerplate**: Initial generation of FastAPI schemas, Alembic migration templates, and React component structures.
- **Business Logic Implementation**: Accelerating the drafting of transactional ORM queries, inventory reservation logic, and Pydantic field validators.
- **Automated Test Generation**: Creating comprehensive test fixtures, parameterized edge case suites, and async HTTP test clients.
- **Documentation Drafting**: Structuring markdown outlines and formatting API specification tables.

### Areas Manually Reviewed, Architected, and Decided:
- **Relational Schema & Architecture**: Deciding table normalization, snapshotting prices at order time on `order_items`, and establishing unique constraints on cart line items.
- **RBAC Matrix Design**: Strict principle-of-least-privilege model enforced via dependency injection (`require_role`), ensuring public registration never allows privilege escalation.
- **State Machine Guardrails**: Formulating the strict directed graph of order status transitions in `order_state.py` to prevent illegal state jumps.
- **Security & Concurrency Controls**: Enforcing non-leaking 404s for IDOR prevention, implementing `with_for_update` row-level locking to prevent checkout overbooking and return race conditions, and setting strict CORS origins.
