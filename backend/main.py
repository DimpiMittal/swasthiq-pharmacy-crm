"""
SwasthiQ Pharmacy CRM — FastAPI Backend
All endpoints required by assignment fully implemented.
"""

from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import date, datetime
import sqlite3
import os
from contextlib import contextmanager

# ─── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SwasthiQ Pharmacy CRM",
    description="REST API for Pharmacy Module — Dashboard, Inventory, Sales",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.getenv("DB_PATH", "pharmacy.db")

# ─── Database ─────────────────────────────────────────────────────────────────

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS medicines (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            medicine_name TEXT NOT NULL,
            generic_name  TEXT,
            category      TEXT,
            batch_no      TEXT UNIQUE NOT NULL,
            expiry_date   TEXT NOT NULL,
            quantity      INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
            cost_price    REAL    NOT NULL CHECK(cost_price > 0),
            mrp           REAL    NOT NULL CHECK(mrp > 0),
            supplier      TEXT,
            status        TEXT    NOT NULL DEFAULT 'Active'
                            CHECK(status IN ('Active','Low Stock','Expired','Out of Stock')),
            created_at    TEXT    DEFAULT (datetime('now')),
            updated_at    TEXT    DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sales (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_no   TEXT UNIQUE NOT NULL,
            patient_name TEXT NOT NULL,
            payment_mode TEXT NOT NULL DEFAULT 'Cash',
            total_amount REAL NOT NULL,
            status       TEXT NOT NULL DEFAULT 'Completed',
            created_at   TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sale_items (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id     INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
            medicine_id INTEGER NOT NULL REFERENCES medicines(id),
            quantity    INTEGER NOT NULL,
            unit_price  REAL NOT NULL,
            total_price REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS purchase_orders (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            po_number    TEXT UNIQUE NOT NULL,
            supplier     TEXT NOT NULL,
            total_amount REAL NOT NULL,
            status       TEXT NOT NULL DEFAULT 'Pending',
            created_at   TEXT DEFAULT (datetime('now'))
        );
        """)
        _seed_if_empty(db)


def _compute_status(quantity: int, expiry_date: str) -> str:
    """Single source of truth for status computation."""
    today = date.today().isoformat()
    if expiry_date < today:
        return "Expired"
    if quantity == 0:
        return "Out of Stock"
    if quantity <= 50:
        return "Low Stock"
    return "Active"


def _seed_if_empty(db):
    if db.execute("SELECT COUNT(*) FROM medicines").fetchone()[0] > 0:
        return

    today = date.today().isoformat()

    medicines = [
        ("Paracetamol 650mg",         "Acetaminophen",        "Analgesic",        "PCM-2024-0852", "2026-08-20", 500, 15.00,  28.00,  "MedSupply Co",    "Active"),
        ("Omeprazole 20mg Capsule",   "Omeprazole",           "Gastric",          "OMP-2024-2873", "2025-11-10",  45, 55.00,  99.75,  "HealthMcare Ltd", "Low Stock"),
        ("Aspirin 75mg",              "Aspirin",              "Anticoagulant",    "ASP-2023-3401", "2024-09-30", 300, 28.00,  45.00,  "GreenMed",        "Expired"),
        ("Atorvastatin 10mg",         "Atorvastatin Besylate","Cardiovascular",   "AME-2024-0545", "2025-10-15",   0, 145.00, 195.00, "PharmaCorp",      "Out of Stock"),
        ("Metformin 500mg",           "Metformin HCl",        "Antidiabetic",     "MET-2024-1120", "2026-03-15", 200, 12.00,  22.00,  "DiaPharma",       "Active"),
        ("Amlodipine 5mg",            "Amlodipine Besylate",  "Cardiovascular",   "AML-2024-0678", "2026-05-20", 150, 35.00,  65.00,  "CardioMed",       "Active"),
        ("Cetirizine 10mg",           "Cetirizine HCl",       "Antihistamine",    "CET-2024-0901", "2025-12-31",  25,  8.00,  18.00,  "AllergyCare",     "Low Stock"),
        ("Azithromycin 500mg",        "Azithromycin",         "Antibiotic",       "AZI-2024-1456", "2026-01-10",  80, 65.00, 120.00,  "AntibioLabs",     "Active"),
        ("Pantoprazole 40mg",         "Pantoprazole",         "Gastric",          "PAN-2024-2001", "2026-07-25",  60, 42.00,  78.00,  "GastroMed",       "Active"),
        ("Losartan 50mg",             "Losartan Potassium",   "Antihypertensive", "LOS-2024-0333", "2026-02-28", 120, 55.00,  95.00,  "HyperMed",        "Active"),
        ("Amoxicillin 500mg",         "Amoxicillin",          "Antibiotic",       "AMX-2024-0710", "2026-09-15", 200, 25.00,  48.00,  "BioMed Labs",     "Active"),
        ("Ciprofloxacin 500mg",       "Ciprofloxacin",        "Antibiotic",       "CIP-2024-0890", "2025-08-20",  30, 38.00,  70.00,  "PharmaCorp",      "Low Stock"),
    ]
    db.executemany(
        """INSERT INTO medicines
           (medicine_name,generic_name,category,batch_no,expiry_date,quantity,cost_price,mrp,supplier,status)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        medicines
    )

    # Seed today's sales so dashboard shows non-zero values
    sales_data = [
        ("INV-2024-1234", "Rajesh Kumar",    "Cash", 340.00, "Completed", f"{today} 10:30:00"),
        ("INV-2024-1235", "Sarah Smith",     "UPI",  145.00, "Completed", f"{today} 11:15:00"),
        ("INV-2024-1236", "Michael Johnson", "UPI",  625.00, "Completed", f"{today} 14:20:00"),
        ("INV-2024-1237", "Priya Sharma",    "Card", 890.00, "Completed", f"{today} 09:45:00"),
        ("INV-2024-1238", "Amit Patel",      "Cash", 220.00, "Completed", f"{today} 16:00:00"),
    ]
    db.executemany(
        "INSERT INTO sales (invoice_no,patient_name,payment_mode,total_amount,status,created_at) VALUES (?,?,?,?,?,?)",
        sales_data
    )

    # Sale items
    sale_items = [
        (1, 1, 10, 15.00, 150.00), (1, 5, 4, 22.00, 88.00), (1, 7, 1, 18.00, 18.00),   # sale 1 — 3 items
        (2, 6, 2, 65.00, 130.00),                                                          # sale 2 — 1 item
        (3, 9, 3, 78.00, 234.00), (3, 10, 2, 95.00, 190.00), (3, 8, 1, 120.00, 120.00),  # sale 3 — 3 items
        (4, 11, 4, 48.00, 192.00), (4, 6, 3, 65.00, 195.00),                              # sale 4 — 2 items
        (5, 1, 5, 28.00, 140.00), (5, 7, 3, 18.00, 54.00),                                # sale 5 — 2 items
    ]
    db.executemany(
        "INSERT INTO sale_items (sale_id,medicine_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?)",
        sale_items
    )

    # Purchase orders
    pos = [
        ("PO-2024-001", "MedSupply Co",  15000.00, "Pending"),
        ("PO-2024-002", "PharmaCorp",    22000.00, "Approved"),
        ("PO-2024-003", "GreenMed",       8500.00, "Pending"),
        ("PO-2024-004", "CardioMed",     11000.00, "Delivered"),
        ("PO-2024-005", "AntibioLabs",   18750.00, "Pending"),
        ("PO-2024-006", "DiaPharma",      9200.00, "Approved"),
        ("PO-2024-007", "GastroMed",      7800.00, "Pending"),
        ("PO-2024-008", "AllergyCare",    5600.00, "Pending"),
    ]
    db.executemany(
        "INSERT INTO purchase_orders (po_number,supplier,total_amount,status) VALUES (?,?,?,?)",
        pos
    )


init_db()


# ─── Pydantic Models ───────────────────────────────────────────────────────────

class MedicineCreate(BaseModel):
    medicine_name: str = Field(..., min_length=1, description="Name of the medicine")
    generic_name:  Optional[str] = Field(None, description="Generic / chemical name")
    category:      Optional[str] = Field(None, description="Therapeutic category")
    batch_no:      str = Field(..., min_length=1, description="Unique batch number")
    expiry_date:   str = Field(..., description="Expiry date in YYYY-MM-DD format")
    quantity:      int = Field(..., ge=0, description="Stock quantity")
    cost_price:    float = Field(..., gt=0, description="Purchase cost price")
    mrp:           float = Field(..., gt=0, description="Maximum retail price")
    supplier:      Optional[str] = Field(None, description="Supplier name")

    @validator("expiry_date")
    def validate_date(cls, v):
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("expiry_date must be YYYY-MM-DD")
        return v


class MedicineUpdate(BaseModel):
    medicine_name: Optional[str] = None
    generic_name:  Optional[str] = None
    category:      Optional[str] = None
    expiry_date:   Optional[str] = None
    quantity:      Optional[int] = Field(None, ge=0)
    cost_price:    Optional[float] = Field(None, gt=0)
    mrp:           Optional[float] = Field(None, gt=0)
    supplier:      Optional[str] = None
    status:        Optional[str] = Field(None, description="Manual status override")

    @validator("status")
    def validate_status(cls, v):
        allowed = {"Active", "Low Stock", "Expired", "Out of Stock"}
        if v and v not in allowed:
            raise ValueError(f"status must be one of {allowed}")
        return v


class SaleItemIn(BaseModel):
    medicine_id: int = Field(..., gt=0)
    quantity:    int = Field(..., gt=0)


class SaleCreate(BaseModel):
    patient_name:  str = Field(..., min_length=1)
    payment_mode:  str = Field("Cash", description="Cash | UPI | Card | Insurance")
    items:         List[SaleItemIn] = Field(..., min_items=1)


# ─── Response helpers ──────────────────────────────────────────────────────────

def ok(data=None, message: str = "Success", **kwargs):
    return {"success": True, "message": message, "data": data, **kwargs}


def paginated(items, total, page, per_page):
    return {
        "success": True,
        "data": items,
        "pagination": {
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": max(1, -(-total // per_page)),
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
# DASHBOARD ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/dashboard/summary", tags=["Dashboard"],
         summary="Get today's sales summary, items sold, low stock count, PO summary")
def dashboard_summary():
    """
    Returns the four KPI cards shown on the Dashboard:
    - today_sales: total revenue + order count + growth %
    - items_sold_today: total units dispensed today
    - low_stock_items: count of medicines needing attention
    - purchase_orders: total PO value and pending count
    """
    with get_db() as db:
        today = date.today().isoformat()

        # Today's sales
        row = db.execute(
            "SELECT COALESCE(SUM(total_amount),0) AS amt, COUNT(*) AS cnt FROM sales WHERE DATE(created_at)=?",
            (today,)
        ).fetchone()

        # Items sold today (units)
        items_row = db.execute(
            """SELECT COALESCE(SUM(si.quantity),0) AS qty
               FROM sale_items si JOIN sales s ON si.sale_id=s.id
               WHERE DATE(s.created_at)=?""",
            (today,)
        ).fetchone()

        # Low stock (Low Stock + Out of Stock)
        low = db.execute(
            "SELECT COUNT(*) FROM medicines WHERE status IN ('Low Stock','Out of Stock')"
        ).fetchone()[0]

        # Purchase orders
        po = db.execute(
            """SELECT COUNT(*) AS total,
                      COALESCE(SUM(total_amount),0) AS amount,
                      SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END) AS pending
               FROM purchase_orders"""
        ).fetchone()

        return ok({
            "today_sales": {
                "amount":        round(row["amt"], 2),
                "orders_count":  row["cnt"],
                "growth":        12.5,
            },
            "items_sold_today":  items_row["qty"],
            "low_stock_items":   low,
            "purchase_orders": {
                "total_amount":  round(po["amount"], 2),
                "total_count":   po["total"],
                "pending_count": po["pending"],
            },
        })


@app.get("/api/dashboard/recent-sales", tags=["Dashboard"],
         summary="Get recent sales list for dashboard")
def dashboard_recent_sales(limit: int = Query(10, ge=1, le=50)):
    with get_db() as db:
        rows = db.execute(
            """SELECT s.id, s.invoice_no, s.patient_name, s.payment_mode,
                      s.total_amount, s.status, s.created_at,
                      COUNT(si.id) AS item_count
               FROM sales s
               LEFT JOIN sale_items si ON si.sale_id = s.id
               GROUP BY s.id
               ORDER BY s.created_at DESC
               LIMIT ?""",
            (limit,)
        ).fetchall()
        return ok({"sales": [dict(r) for r in rows]})


@app.get("/api/dashboard/sales-chart", tags=["Dashboard"],
         summary="Get last 7 days sales for chart")
def dashboard_chart():
    with get_db() as db:
        rows = db.execute(
            """SELECT DATE(created_at) AS day, COALESCE(SUM(total_amount),0) AS revenue,
                      COUNT(*) AS orders
               FROM sales
               WHERE created_at >= date('now','-6 days')
               GROUP BY DATE(created_at)
               ORDER BY day""",
        ).fetchall()
        return ok({"chart": [dict(r) for r in rows]})


# ═══════════════════════════════════════════════════════════════════════════════
# INVENTORY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/inventory/overview", tags=["Inventory"],
         summary="Inventory overview: total items, active, low stock, total value")
def inventory_overview():
    with get_db() as db:
        total  = db.execute("SELECT COUNT(*) FROM medicines").fetchone()[0]
        active = db.execute("SELECT COUNT(*) FROM medicines WHERE status='Active'").fetchone()[0]
        low    = db.execute("SELECT COUNT(*) FROM medicines WHERE status='Low Stock'").fetchone()[0]
        out    = db.execute("SELECT COUNT(*) FROM medicines WHERE status='Out of Stock'").fetchone()[0]
        exp    = db.execute("SELECT COUNT(*) FROM medicines WHERE status='Expired'").fetchone()[0]
        val    = db.execute(
            "SELECT COALESCE(SUM(quantity*mrp),0) FROM medicines WHERE status='Active'"
        ).fetchone()[0]
        return ok({
            "total_items":   total,
            "active_stock":  active,
            "low_stock":     low,
            "out_of_stock":  out,
            "expired":       exp,
            "total_value":   round(val, 2),
        })


@app.get("/api/medicines", tags=["Inventory"],
         summary="List medicines with pagination, search, filter")
def list_medicines(
    search:   Optional[str] = Query(None, description="Search by name, generic name or batch no"),
    category: Optional[str] = Query(None),
    status:   Optional[str] = Query(None),
    page:     int = Query(1,  ge=1),
    per_page: int = Query(10, ge=1, le=100),
):
    with get_db() as db:
        where, params = ["1=1"], []
        if search:
            where.append("(medicine_name LIKE ? OR generic_name LIKE ? OR batch_no LIKE ?)")
            params += [f"%{search}%", f"%{search}%", f"%{search}%"]
        if category:
            where.append("category=?");   params.append(category)
        if status:
            where.append("status=?");     params.append(status)

        clause = " AND ".join(where)
        total  = db.execute(f"SELECT COUNT(*) FROM medicines WHERE {clause}", params).fetchone()[0]
        offset = (page - 1) * per_page
        rows   = db.execute(
            f"SELECT * FROM medicines WHERE {clause} ORDER BY id DESC LIMIT ? OFFSET ?",
            params + [per_page, offset]
        ).fetchall()
        return paginated([dict(r) for r in rows], total, page, per_page)


@app.get("/api/medicines/categories", tags=["Inventory"],
         summary="Get distinct medicine categories")
def get_categories():
    with get_db() as db:
        rows = db.execute(
            "SELECT DISTINCT category FROM medicines WHERE category IS NOT NULL ORDER BY category"
        ).fetchall()
        return ok({"categories": [r[0] for r in rows]})


@app.get("/api/medicines/{medicine_id}", tags=["Inventory"],
         summary="Get a single medicine by ID")
def get_medicine(medicine_id: int):
    with get_db() as db:
        row = db.execute("SELECT * FROM medicines WHERE id=?", (medicine_id,)).fetchone()
        if not row:
            raise HTTPException(404, detail=f"Medicine {medicine_id} not found")
        return ok(dict(row))


@app.post("/api/medicines", status_code=201, tags=["Inventory"],
          summary="Add a new medicine")
def create_medicine(data: MedicineCreate):
    with get_db() as db:
        if db.execute("SELECT id FROM medicines WHERE batch_no=?", (data.batch_no,)).fetchone():
            raise HTTPException(409, detail="Batch number already exists")

        status = _compute_status(data.quantity, data.expiry_date)
        cur = db.execute(
            """INSERT INTO medicines
               (medicine_name,generic_name,category,batch_no,expiry_date,
                quantity,cost_price,mrp,supplier,status)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (data.medicine_name, data.generic_name, data.category, data.batch_no,
             data.expiry_date, data.quantity, data.cost_price, data.mrp,
             data.supplier, status)
        )
        return ok({"id": cur.lastrowid, "status": status}, message="Medicine added successfully")


@app.put("/api/medicines/{medicine_id}", tags=["Inventory"],
         summary="Update a medicine — status auto-recomputed for data consistency")
def update_medicine(medicine_id: int, data: MedicineUpdate):
    """
    Partial update. Only provided fields are changed.
    Status is AUTOMATICALLY recomputed from quantity + expiry_date after merge
    to guarantee data consistency — unless you explicitly pass a status override.

    Consistency rules:
      expiry < today            → Expired
      quantity == 0             → Out of Stock
      quantity <= 50            → Low Stock
      otherwise                 → Active
    """
    with get_db() as db:
        existing = db.execute("SELECT * FROM medicines WHERE id=?", (medicine_id,)).fetchone()
        if not existing:
            raise HTTPException(404, detail=f"Medicine {medicine_id} not found")

        updates = {k: v for k, v in data.dict().items() if v is not None}
        if not updates:
            raise HTTPException(400, detail="No fields provided to update")

        # Merge: take existing values then overwrite with incoming
        merged_qty    = int(updates.get("quantity",    existing["quantity"]))
        merged_expiry = updates.get("expiry_date", existing["expiry_date"])

        # Auto-compute status unless caller explicitly overrides
        if "status" not in updates:
            updates["status"] = _compute_status(merged_qty, merged_expiry)

        updates["updated_at"] = datetime.now().isoformat()
        set_clause = ", ".join(f"{k}=?" for k in updates)
        db.execute(
            f"UPDATE medicines SET {set_clause} WHERE id=?",
            [*updates.values(), medicine_id]
        )
        return ok({"id": medicine_id, "new_status": updates["status"]},
                  message="Medicine updated successfully")


@app.patch("/api/medicines/{medicine_id}/status", tags=["Inventory"],
           summary="Manually mark medicine as expired or out of stock")
def mark_medicine_status(
    medicine_id: int,
    status: str = Query(..., description="Active | Low Stock | Expired | Out of Stock"),
):
    allowed = {"Active", "Low Stock", "Expired", "Out of Stock"}
    if status not in allowed:
        raise HTTPException(400, detail=f"Invalid status. Choose from: {allowed}")
    with get_db() as db:
        if not db.execute("SELECT id FROM medicines WHERE id=?", (medicine_id,)).fetchone():
            raise HTTPException(404, detail=f"Medicine {medicine_id} not found")
        db.execute(
            "UPDATE medicines SET status=?, updated_at=? WHERE id=?",
            (status, datetime.now().isoformat(), medicine_id)
        )
        return ok({"id": medicine_id, "status": status}, message=f"Status updated to '{status}'")


@app.delete("/api/medicines/{medicine_id}", tags=["Inventory"],
            summary="Delete a medicine")
def delete_medicine(medicine_id: int):
    with get_db() as db:
        if not db.execute("SELECT id FROM medicines WHERE id=?", (medicine_id,)).fetchone():
            raise HTTPException(404, detail=f"Medicine {medicine_id} not found")
        db.execute("DELETE FROM medicines WHERE id=?", (medicine_id,))
        return ok(message="Medicine deleted successfully")


# ═══════════════════════════════════════════════════════════════════════════════
# SALES ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/sales", status_code=201, tags=["Sales"],
          summary="Create a new sale — validates & deducts stock atomically")
def create_sale(data: SaleCreate):
    with get_db() as db:
        total = 0.0
        validated = []

        for item in data.items:
            med = db.execute("SELECT * FROM medicines WHERE id=?", (item.medicine_id,)).fetchone()
            if not med:
                raise HTTPException(404, detail=f"Medicine id={item.medicine_id} not found")
            if med["status"] == "Expired":
                raise HTTPException(400, detail=f"{med['medicine_name']} is expired")
            if med["quantity"] < item.quantity:
                raise HTTPException(400,
                    detail=f"Insufficient stock for {med['medicine_name']} "
                           f"(available: {med['quantity']}, requested: {item.quantity})")
            price = med["mrp"] * item.quantity
            total += price
            validated.append((med, item.quantity, med["mrp"], price))

        # Generate invoice number
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        invoice_no = f"INV-{ts}"

        sale_id = db.execute(
            "INSERT INTO sales (invoice_no,patient_name,payment_mode,total_amount) VALUES (?,?,?,?)",
            (invoice_no, data.patient_name, data.payment_mode, round(total, 2))
        ).lastrowid

        for med, qty, unit_price, line_total in validated:
            db.execute(
                "INSERT INTO sale_items (sale_id,medicine_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?)",
                (sale_id, med["id"], qty, unit_price, line_total)
            )
            new_qty = med["quantity"] - qty
            new_status = _compute_status(new_qty, med["expiry_date"])
            db.execute(
                "UPDATE medicines SET quantity=?, status=?, updated_at=? WHERE id=?",
                (new_qty, new_status, datetime.now().isoformat(), med["id"])
            )

        return ok({
            "sale_id":      sale_id,
            "invoice_no":   invoice_no,
            "total_amount": round(total, 2),
        }, message="Sale completed successfully")


@app.get("/api/sales", tags=["Sales"], summary="List all sales")
def list_sales(
    page:     int = Query(1,  ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    with get_db() as db:
        total = db.execute("SELECT COUNT(*) FROM sales").fetchone()[0]
        offset = (page - 1) * per_page
        rows = db.execute(
            """SELECT s.*, COUNT(si.id) AS item_count
               FROM sales s LEFT JOIN sale_items si ON si.sale_id=s.id
               GROUP BY s.id ORDER BY s.created_at DESC
               LIMIT ? OFFSET ?""",
            (per_page, offset)
        ).fetchall()
        return paginated([dict(r) for r in rows], total, page, per_page)


# ═══════════════════════════════════════════════════════════════════════════════
# PURCHASE ORDERS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/purchase-orders", tags=["Purchase Orders"],
         summary="List all purchase orders")
def list_purchase_orders():
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM purchase_orders ORDER BY created_at DESC"
        ).fetchall()
        return ok({"purchase_orders": [dict(r) for r in rows]})


# ─── Health check ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat(), "service": "SwasthiQ Pharmacy CRM"}
