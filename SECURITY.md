# Security Policy & Architecture Documentation

This document outlines the security architecture, design decisions, threat mitigations, testing verification, and known security considerations for the **Mini D-Mart** full-stack application.

---

## 1. Authentication Approach

Mini D-Mart implements a stateless, token-based authentication mechanism using JSON Web Tokens (JWT) adhering to RFC 7519 standards:

- **Password Hashing**: Passwords are never stored in plaintext. They are hashed using **`bcrypt`** via Passlib with an auto-generated salt and work factor.
- **Dual-Token System**:
  - **Access Token**: Short-lived (30 minutes default) JWT containing user identifier (`sub`), assigned system role (`role`), and token type (`access`). Signed with HMAC-SHA256 (`HS256`).
  - **Refresh Token**: Long-lived (7 days default) JWT containing user identifier and token type (`refresh`), used exclusively at `/api/v1/auth/refresh` to obtain new access tokens without requiring re-entry of credentials.
- **Email Normalization**: To prevent account spoofing and duplicate registration bypasses via varied letter casing (e.g. `User@example.com` vs `user@example.com`), all email inputs are strictly validated via Pydantic `EmailStr` and canonically converted to lowercase prior to database persistence and credential matching.
- **Brute-Force & Rate Limiting**: The `/api/v1/auth/login` and `/api/v1/auth/register` endpoints are protected by an in-memory sliding window rate limiter (`app/core/rate_limit.py`) restricting clients to 5 attempts per minute per IP address, responding with `HTTP 429 Too Many Requests` and a standard `Retry-After` header.

---

## 2. Authorization & Role-Based Access Control (RBAC)

Authorization is enforced at the route level via FastAPI's Dependency Injection system:

- **Identity Resolution**: `get_current_user` extracts and cryptographically verifies the `Bearer` token from the `Authorization` header, confirms token type (`access`), and loads the active user entity from the database.
- **RBAC Guard (`require_role`)**: Dependency factory that validates the authenticated user possesses one of the allowed roles (`CUSTOMER`, `STAFF`, `ADMIN`). Unauthorized attempts are rejected immediately with `HTTP 403 Forbidden`.
- **Privilege Escalation Prevention**: The public registration endpoint (`POST /api/v1/auth/register`) hardcodes `role = Role.CUSTOMER`. Administrative and staff roles can only be provisioned through seed scripts or administrative database management, eliminating payload parameter tampering.

---

## 3. Key Security Decisions & Threat Mitigations

### 3.1 Non-Leaking 404 Responses for IDOR Mitigation
- **Risk**: Insecure Direct Object References (IDOR), where attackers query UUIDs belonging to other users. Returning `403 Forbidden` confirms to an attacker that an object exists but belongs to someone else.
- **Mitigation**: All user-scoped resource queries (e.g., `GET /orders/{id}`, `POST /orders/{id}/cancel`, `POST /orders/{id}/pickup-slot`, `PATCH /cart/items/{id}`) verify ownership within the `WHERE` clause. If a record does not exist or belongs to another customer, the server returns `HTTP 404 Not Found`.

### 3.2 Transactional Concurrency & Row-Level Locking (`FOR UPDATE`)
- **Risk**: Race conditions during high-volume checkout or return requests causing inventory overselling or pickup slot overbooking.
- **Mitigation**: Critical transactional workflows acquire pessimistic row locks (`with_for_update()`) on `Inventory` and `PickupSlot` rows within SQLAlchemy async transactions. The system locks rows, re-evaluates remaining stock/capacity under the lock, deducts or reserves units, and commits atomically. Competing requests are queued sequentially, raising `HTTP 409 Conflict` if inventory is depleted.

### 3.3 Historical Price Snapshotting
- **Risk**: If product prices are updated in the catalog, historical order totals or customer invoices could dynamically change.
- **Mitigation**: When an order is placed, unit prices are snapshotted onto the `order_items` table as `unit_price_at_order`. Subsequent price modifications to the catalog never alter historical order items or financial records.

### 3.4 Immutable Audit Logging
- **Risk**: Lack of accountability for administrative actions or stock tampering.
- **Mitigation**: High-impact actions (`PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRODUCT_DEACTIVATED`, `ORDER_STATUS_CHANGED`, `RETURN_APPROVED`, `RETURN_REJECTED`, `INVENTORY_ADJUSTED`) are recorded in an append-only `audit_logs` table capturing timestamp, actor user ID, entity type, entity UUID, and before/after metadata JSON diffs.

### 3.5 SQL Injection Prevention
- All database queries strictly utilize SQLAlchemy 2.0 ORM expressions (`select()`, `where()`, `func()`, parameterized bound variables). Raw SQL string concatenation or format strings are prohibited throughout the codebase.

### 3.6 Defensive HTTP Security Headers Middleware
All HTTP responses include security headers to protect browser clients:
- `X-Content-Type-Options: nosniff` (prevents MIME-sniffing)
- `X-Frame-Options: DENY` (prevents Clickjacking)
- `X-XSS-Protection: 1; mode=block` (enables legacy XSS filters)
- `Referrer-Policy: strict-origin-when-cross-origin` (protects referrer privacy)
- `Content-Security-Policy: default-src 'self'; frame-ancestors 'none';` (restricts execution contexts)

### 3.7 Global Unhandled Exception Sanitization
A top-level exception handler in `app/main.py` catches all unhandled exceptions, logs the full traceback server-side via logger, and emits a sanitized `HTTP 500 {"detail": "An unexpected error occurred. Please try again later."}` to prevent leaking stack traces, database schemas, or internal server paths to API consumers.

---

## 4. Security Testing & Verification

The automated test suite (`backend/tests/`) contains 57 automated tests covering security, authorization, IDOR, input validation, and race conditions:

| Test File | Security Scenarios Tested |
|---|---|
| `test_auth.py` | Registration validation, password complexity enforcement, duplicate email rejection, invalid password rejection, missing/invalid token rejection on `/auth/me`. |
| `test_catalog.py` | Public read access vs admin-only write access, soft-deletion verification, input validation. |
| `test_admin.py` | Non-admin 403 Forbidden checks on `/admin/audit-logs`, `/admin/inventory`, `/admin/inventory/low-stock`, `/admin/inventory/{id}/adjust`. |
| `test_cart_and_checkout.py` | Cross-user cart isolation (IDOR checks), stock over-allocation rejection (409 Conflict), atomic inventory reservation. |
| `test_order_lifecycle.py` | Invalid state transition rejections (409 Conflict), unauthorized status transition rejection (403 Forbidden), customer cancellation boundaries. |
| `test_returns.py` | Non-returnable product rejection, post-7-day return window rejection, return quantity exceeding purchase quantity rejection, staff approval inventory restoration, exchange stock re-verification. |
| `test_edge_cases.py` | Zero/negative quantity rejection, negative price update rejection (422), case-insensitive duplicate email rejection (409), staff attempt on admin endpoints (403), malformed/expired JWT handling (401 without 500), pickup slot booking on cancelled orders (409). |

---

## 5. Known Security Limitations

1. **Two-Factor Authentication (2FA)**: 2FA/TOTP is not implemented; authentication relies solely on email and password.
2. **Email Verification**: User registration activates accounts immediately without sending an email verification token or confirmation link.
3. **Token Revocation / Blacklisting**: Refresh tokens are validated cryptographically against their signature and expiration; a distributed token revocation blacklist (e.g. in Redis) for immediate logout invalidation is not included.
4. **Distributed Rate Limiting**: The current rate limiter uses an in-memory sliding window per application process. In a distributed multi-node production deployment with a load balancer, this should be backed by a centralized Redis instance.
5. **CAPTCHA / Bot Protection**: Public endpoints do not integrate CAPTCHA widgets (e.g., Cloudflare Turnstile / reCAPTCHA).

---

## 6. Vulnerability Reporting

This project is an educational and portfolio demonstration application. To report a security vulnerability or concern:

- Please do not open public GitHub issues for sensitive security vulnerabilities.
- Send a detailed vulnerability report with reproduction steps to `security@minidmart.local` (or reach out directly to the repository maintainer).
