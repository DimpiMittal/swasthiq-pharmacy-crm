# SwasthiQ Pharmacy CRM

A full-stack Pharmacy Module built for the SwasthiQ SDE Intern assignment.
Implements Dashboard (Sales Overview) and Inventory management with a Python FastAPI backend and React frontend.

---

## Live Links

- **Frontend (Netlify):** _Add your Netlify URL here_
- **Backend API (Railway):** _Add your Railway URL here_
- **API Docs (Swagger):** `<backend-url>/docs`

---

## Project Structure

```
swasthiq/
├── backend/
│   ├── main.py           ← FastAPI application (single file, clean architecture)
│   ├── requirements.txt
│   └── railway.toml      ← Railway deployment config
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── _redirects    ← Netlify SPA routing
│   ├── src/
│   │   ├── api/index.js        ← Axios HTTP client
│   │   ├── components/
│   │   │   ├── Sidebar.js
│   │   │   └── MedicineModal.js
│   │   ├── hooks/useToast.js
│   │   ├── pages/
│   │   │   ├── Dashboard.js
│   │   │   └── Inventory.js
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css     ← Full design system (CSS variables, components)
│   └── package.json
└── README.md
```

---

## How to Run Locally

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- API runs at: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

The SQLite database (`pharmacy.db`) is created automatically on first run and seeded with:
- 12 sample medicines (Active, Low Stock, Expired, Out of Stock statuses)
- 5 today's sales
- 8 purchase orders

### 2. Frontend

```bash
cd frontend
npm install
npm start
```

App runs at `http://localhost:3000`. API calls are proxied to `http://localhost:8000` via the `"proxy"` field in `package.json` — no CORS config needed locally.

---

## REST API Structure

### Base URL
- Local: `http://localhost:8000`
- Production: Set `REACT_APP_API_URL` in Netlify environment variables

### Response Format
All endpoints return a consistent JSON envelope:

**Success:**
```json
{
  "success": true,
  "message": "Success",
  "data": { ... }
}
```

**Paginated:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 12,
    "page": 1,
    "per_page": 10,
    "total_pages": 2
  }
}
```

**Error:**
```json
{
  "detail": "Medicine not found"
}
```

---

## API Endpoints

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary` | Today's sales, items sold, low stock count, PO summary |
| GET | `/api/dashboard/recent-sales` | Recent sales list (param: `limit`) |
| GET | `/api/dashboard/sales-chart` | Last 7 days revenue for chart |

#### GET `/api/dashboard/summary`
```json
{
  "success": true,
  "data": {
    "today_sales": {
      "amount": 2220.00,
      "orders_count": 5,
      "growth": 12.5
    },
    "items_sold_today": 28,
    "low_stock_items": 4,
    "purchase_orders": {
      "total_amount": 97850.00,
      "total_count": 8,
      "pending_count": 5
    }
  }
}
```

#### GET `/api/dashboard/recent-sales?limit=8`
```json
{
  "success": true,
  "data": {
    "sales": [
      {
        "id": 1,
        "invoice_no": "INV-2024-1234",
        "patient_name": "Rajesh Kumar",
        "payment_mode": "Cash",
        "total_amount": 340.00,
        "status": "Completed",
        "created_at": "2024-11-01 10:30:00",
        "item_count": 3
      }
    ]
  }
}
```

---

### Inventory

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory/overview` | Stock summary (totals, value) |
| GET | `/api/medicines` | List with pagination + filter + search |
| GET | `/api/medicines/categories` | Distinct categories |
| GET | `/api/medicines/{id}` | Single medicine |
| POST | `/api/medicines` | Add new medicine |
| PUT | `/api/medicines/{id}` | Update medicine |
| PATCH | `/api/medicines/{id}/status` | Mark expired / out of stock |
| DELETE | `/api/medicines/{id}` | Delete medicine |

#### GET `/api/inventory/overview`
```json
{
  "success": true,
  "data": {
    "total_items": 12,
    "active_stock": 7,
    "low_stock": 3,
    "out_of_stock": 1,
    "expired": 1,
    "total_value": 68450.00
  }
}
```

#### GET `/api/medicines?search=para&status=Active&category=Analgesic&page=1&per_page=10`

Query parameters:
| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Searches medicine_name, generic_name, batch_no |
| `status` | string | Active \| Low Stock \| Expired \| Out of Stock |
| `category` | string | Filter by category |
| `page` | int | Page number (default 1) |
| `per_page` | int | Items per page (default 10, max 100) |

#### POST `/api/medicines`
Request body:
```json
{
  "medicine_name": "Paracetamol 500mg",
  "generic_name": "Acetaminophen",
  "category": "Analgesic",
  "batch_no": "PCM-2024-0001",
  "expiry_date": "2026-08-20",
  "quantity": 500,
  "cost_price": 15.00,
  "mrp": 28.00,
  "supplier": "MedSupply Co"
}
```
Response: `201 Created`

#### PUT `/api/medicines/{id}`
All fields optional. Status is **auto-recomputed** (see Data Consistency section below).

#### PATCH `/api/medicines/{id}/status?status=Expired`
Valid values: `Active` | `Low Stock` | `Expired` | `Out of Stock`

---

### Sales

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sales` | Create sale (validates + deducts stock) |
| GET | `/api/sales` | Paginated sales list |

#### POST `/api/sales`
```json
{
  "patient_name": "Rajesh Kumar",
  "payment_mode": "Cash",
  "items": [
    { "medicine_id": 1, "quantity": 5 },
    { "medicine_id": 3, "quantity": 2 }
  ]
}
```
Response `201 Created`:
```json
{
  "success": true,
  "data": {
    "sale_id": 6,
    "invoice_no": "INV-20241101103045",
    "total_amount": 236.00
  }
}
```

---

### Purchase Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/purchase-orders` | List all purchase orders |

---

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request (validation error, insufficient stock) |
| 404 | Not Found |
| 409 | Conflict (duplicate batch number) |
| 422 | Unprocessable Entity (Pydantic validation) |

---

## Data Consistency on Update

When `PUT /api/medicines/{id}` is called, the backend guarantees status consistency using this algorithm:

```python
def _compute_status(quantity: int, expiry_date: str) -> str:
    today = date.today().isoformat()
    if expiry_date < today:   return "Expired"
    if quantity == 0:         return "Out of Stock"
    if quantity <= 50:        return "Low Stock"
    return "Active"
```

**Merge strategy:**
1. Fetch the existing record from the database
2. Apply only the fields provided in the request (partial update)
3. Merge: `final_qty = incoming.quantity ?? existing.quantity`
4. Recompute status from the merged `(quantity, expiry_date)`
5. Write all changes + computed status atomically

This guarantees:
- A medicine with `quantity=0` is **never** `Active`
- A medicine past expiry is **never** `Active` or `Low Stock`
- Partial updates always produce a consistent final state

The same `_compute_status()` function is called in three places:
- `POST /api/medicines` (on create)
- `PUT /api/medicines/{id}` (on update)
- `POST /api/sales` (after deducting stock for each line item)

Manual override is still possible via `PATCH /api/medicines/{id}/status` for edge cases.

---

## Deployment

### Backend → Railway (Free tier, no credit card)

1. Push the `/backend` folder to a GitHub repository
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Railway detects `railway.toml` automatically and deploys with:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
4. Copy the generated domain, e.g. `https://swasthiq.up.railway.app`

### Frontend → Netlify

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. In your `frontend/` folder, set the environment variable then build:
   ```bash
   # Windows PowerShell
   $env:REACT_APP_API_URL="https://swasthiq.up.railway.app"
   $env:CI="false"
   npm run build
   ```
   ```bash
   # Mac / Linux
   REACT_APP_API_URL=https://swasthiq.up.railway.app CI=false npm run build
   ```
3. Drag the generated `build/` folder onto Netlify Drop
4. Live link generated instantly ✓

**The `_redirects` file** inside `public/` ensures React Router works on Netlify (no 404 on page refresh).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend language | Python 3.12 |
| Backend framework | FastAPI 0.115 |
| Database | SQLite (auto-created) |
| Validation | Pydantic v2 |
| Frontend | React 18 |
| State management | React hooks (useState, useEffect, useCallback) |
| HTTP client | Axios |
| Routing | React Router v6 |
| Icons | Lucide React |
| Fonts | DM Sans + DM Mono (Google Fonts) |
| Backend hosting | Railway |
| Frontend hosting | Netlify |

---

## Design Decisions

- **Single-file backend** (`main.py`) — keeps the codebase simple for review while covering all requirements
- **SQLite over PostgreSQL** — zero-config, ships inside Python stdlib, perfect for this scale; swap to PostgreSQL by changing `DB_PATH` and the connection string
- **Consistent JSON envelope** — every endpoint returns `{ success, message, data }` making frontend error handling uniform
- **Auto-seed on first run** — database initialises with realistic demo data so the dashboard shows meaningful numbers immediately
- **`_compute_status()` as single source of truth** — called identically on create, update, and post-sale deduction, preventing any drift between actual stock and displayed status
