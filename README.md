# Mini D-Mart — Full-Stack Grocery Store Application

A modern, high-performance full-stack grocery store web application monorepo for **Mini D-Mart**.

---

## 🛠️ Tech Stack

### Backend
- **Framework**: Python FastAPI
- **Database**: PostgreSQL (via Async SQLAlchemy 2.0 & `asyncpg`)
- **Migrations**: Alembic (configured for async SQLAlchemy)
- **Configuration & Validation**: Pydantic v2 & `pydantic-settings`
- **Authentication**: JWT (`python-jose`) with bcrypt password hashing (`passlib`)

### Frontend
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM (v7)
- **HTTP Client**: Axios

---

## 📁 Repository Structure

```
mini-dmart/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI entry point & CORS
│   │   ├── core/              # Config (pydantic-settings) & Async Database engine
│   │   ├── models/            # SQLAlchemy models (placeholder)
│   │   ├── schemas/           # Pydantic request/response schemas (placeholder)
│   │   ├── api/v1/            # API endpoints router (placeholder)
│   │   └── services/          # Business logic services (placeholder)
│   ├── alembic/               # Async Alembic migrations
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── .env.example
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts      # Axios client with VITE_API_BASE_URL
│   │   ├── App.tsx            # React Router navigation & route views
│   │   └── index.css          # Tailwind CSS styles
│   ├── .env.example
│   ├── .env
│   └── package.json
├── README.md
└── .gitignore
```

---

## 🚀 Quick Start & Setup Instructions

### 1. Backend Setup

Navigate to the `backend` directory:
```bash
cd backend
```

Create and activate a Python virtual environment:
```bash
# Windows (PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

Install backend dependencies:
```bash
pip install -r requirements.txt
```

Set up environment variables:
```bash
cp .env.example .env
```

Start the FastAPI development server:
```bash
uvicorn app.main:app --reload --port 8000
```
- Health Check Endpoint: [http://localhost:8000/health](http://localhost:8000/health)
- Interactive API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 2. Frontend Setup

Navigate to the `frontend` directory:
```bash
cd frontend
```

Install node dependencies:
```bash
npm install
```

Set up environment variables:
```bash
cp .env.example .env
```

Start the Vite development server:
```bash
npm run dev
```
- Application Web App: [http://localhost:5173](http://localhost:5173)

---

## 🚦 Available Frontend Routes

- `/login` — User & Staff Login
- `/register` — Customer Registration
- `/products` — Product Catalog & Search
- `/cart` — Shopping Cart
- `/checkout` — Slot Selection & Checkout
- `/orders` — Customer Order History
- `/staff/dashboard` — Staff Order & Pickup Operations
- `/admin/dashboard` — Admin Inventory & Slot Management
