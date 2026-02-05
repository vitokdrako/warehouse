"""
Event Tool API Routes
Інтеграція каталогу декораторів з RentalHub
Всі endpoints під /api/event/*
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header, Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
import uuid
import logging
import os
import json
from functools import lru_cache
import time

from database_rentalhub import get_rh_db
from utils.image_helper import normalize_image_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/event", tags=["Event Tool"])

# ============================================================================
# CACHE для швидкої роботи
# ============================================================================
_categories_cache = {"data": None, "expires": 0}
_subcategories_cache = {"data": None, "expires": 0}
CACHE_TTL = 300  # 5 хвилин

# ============================================================================
# SCHEMAS
# ============================================================================

class CustomerRegister(BaseModel):
    email: str
    password: str
    firstname: str
    lastname: Optional[str] = None
    telephone: Optional[str] = None

class CustomerLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class EventBoardCreate(BaseModel):
    board_name: str
    event_date: Optional[str] = None
    event_type: Optional[str] = None
    rental_start_date: Optional[str] = None
    rental_end_date: Optional[str] = None
    notes: Optional[str] = None
    budget: Optional[float] = None

class EventBoardUpdate(BaseModel):
    board_name: Optional[str] = None
    event_date: Optional[str] = None
    event_type: Optional[str] = None
    rental_start_date: Optional[str] = None
    rental_end_date: Optional[str] = None
    notes: Optional[str] = None
    budget: Optional[float] = None
    status: Optional[str] = None
    cover_image: Optional[str] = None
    canvas_layout: Optional[dict] = None

class EventBoardItemCreate(BaseModel):
    product_id: int
    quantity: int = 1
    notes: Optional[str] = None
    section: Optional[str] = None

class EventBoardItemUpdate(BaseModel):
    quantity: Optional[int] = None
    notes: Optional[str] = None
    section: Optional[str] = None

class OrderCreate(BaseModel):
    customer_name: str
    phone: str
    delivery_address: Optional[str] = None
    city: Optional[str] = None
    delivery_type: str = "self_pickup"
    customer_comment: Optional[str] = None
    event_type: Optional[str] = None
    guests_count: Optional[int] = None

# ============================================================================
# AUTH HELPERS
# ============================================================================

import hashlib
import jwt

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = 30

def get_secret_key():
    """Отримати JWT секрет"""
    return os.getenv("JWT_SECRET_KEY", os.getenv("EVENT_JWT_SECRET", "event-tool-secret-key-change-in-production"))

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    # Конвертуємо sub в string
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, get_secret_key(), algorithm=ALGORITHM)

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    # Конвертуємо sub в string
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, get_secret_key(), algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, get_secret_key(), algorithms=[ALGORITHM])
        # Конвертуємо sub назад в int
        if "sub" in payload:
            payload["sub"] = int(payload["sub"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logger.error(f"JWT decode error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_customer(token: str, db: Session):
    """Отримати поточного користувача з токена"""
    payload = decode_token(token)
    customer_id = payload.get("sub")
    if not customer_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    result = db.execute(text("SELECT * FROM event_customers WHERE customer_id = :id"), {"id": customer_id})
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Customer not found")
    
    return {
        "customer_id": row[0],
        "email": row[1],
        "firstname": row[3],
        "lastname": row[4],
        "telephone": row[5]
    }

def get_token_from_header(authorization: Optional[str] = Header(None)) -> str:
    """Витягти токен з Authorization header"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format. Use: Bearer <token>")
    
    return authorization.replace("Bearer ", "")

# ============================================================================
# INIT TABLES (create if not exist)
# ============================================================================

def init_event_tables(db: Session):
    """Створити таблиці для Event Tool якщо не існують"""
    
    # Event Customers (декоратори)
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS event_customers (
            customer_id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            firstname VARCHAR(255),
            lastname VARCHAR(255),
            telephone VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )
    """))
    
    # Event Boards (мудборди) - БЕЗ FK для сумісності
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS event_boards (
            id VARCHAR(36) PRIMARY KEY,
            customer_id INT NOT NULL,
            board_name VARCHAR(255) NOT NULL,
            event_date DATE NULL,
            event_type VARCHAR(100) NULL,
            rental_start_date DATE NULL,
            rental_end_date DATE NULL,
            rental_days INT NULL,
            status VARCHAR(50) DEFAULT 'draft',
            notes TEXT NULL,
            budget DECIMAL(10,2) NULL,
            estimated_total DECIMAL(10,2) DEFAULT 0,
            cover_image VARCHAR(500) NULL,
            canvas_layout JSON NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            converted_to_order_id INT NULL,
            INDEX idx_event_boards_customer (customer_id),
            INDEX idx_event_boards_status (status)
        )
    """))
    
    # Event Board Items - БЕЗ FK для сумісності
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS event_board_items (
            id VARCHAR(36) PRIMARY KEY,
            board_id VARCHAR(36) NOT NULL,
            product_id INT NOT NULL,
            quantity INT DEFAULT 1,
            notes TEXT NULL,
            section VARCHAR(100) NULL,
            position INT DEFAULT 0,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_event_board_items_board (board_id),
            INDEX idx_event_board_items_product (product_id)
        )
    """))
    
    # Soft Reservations (тимчасові резервації в мудбордах)
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS event_soft_reservations (
            id VARCHAR(36) PRIMARY KEY,
            board_id VARCHAR(36) NOT NULL,
            product_id INT NOT NULL,
            quantity INT NOT NULL,
            reserved_from DATE NOT NULL,
            reserved_until DATE NOT NULL,
            expires_at DATETIME NOT NULL,
            customer_id INT NOT NULL,
            status VARCHAR(20) DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_soft_res_board (board_id),
            INDEX idx_soft_res_product (product_id),
            INDEX idx_soft_res_dates (reserved_from, reserved_until),
            INDEX idx_soft_res_expires (expires_at)
        )
    """))
    
    db.commit()
    logger.info("✅ Event Tool tables initialized")

# ============================================================================
# AUTH ENDPOINTS
# ============================================================================

@router.post("/auth/register")
async def register(data: CustomerRegister, db: Session = Depends(get_rh_db)):
    """Реєстрація декоратора"""
    init_event_tables(db)
    
    # Перевірити чи email існує
    result = db.execute(text("SELECT customer_id FROM event_customers WHERE email = :email"), {"email": data.email})
    if result.fetchone():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Створити користувача
    db.execute(text("""
        INSERT INTO event_customers (email, password_hash, firstname, lastname, telephone)
        VALUES (:email, :password_hash, :firstname, :lastname, :telephone)
    """), {
        "email": data.email,
        "password_hash": hash_password(data.password),
        "firstname": data.firstname,
        "lastname": data.lastname,
        "telephone": data.telephone
    })
    db.commit()
    
    # Отримати створеного користувача
    result = db.execute(text("SELECT customer_id, email, firstname FROM event_customers WHERE email = :email"), {"email": data.email})
    row = result.fetchone()
    
    logger.info(f"✅ New decorator registered: {data.email}")
    
    return {
        "customer_id": row[0],
        "email": row[1],
        "firstname": row[2],
        "message": "Registration successful"
    }

@router.post("/auth/login", response_model=Token)
async def login(data: CustomerLogin, db: Session = Depends(get_rh_db)):
    """Вхід декоратора"""
    init_event_tables(db)
    
    result = db.execute(text("""
        SELECT customer_id, password_hash FROM event_customers 
        WHERE email = :email AND is_active = TRUE
    """), {"email": data.email})
    row = result.fetchone()
    
    if not row or not verify_password(data.password, row[1]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    customer_id = row[0]
    
    # Оновити last_login
    db.execute(text("UPDATE event_customers SET last_login = NOW() WHERE customer_id = :id"), {"id": customer_id})
    db.commit()
    
    access_token = create_access_token({"sub": customer_id})
    refresh_token = create_refresh_token({"sub": customer_id})
    
    logger.info(f"✅ Decorator logged in: {data.email}")
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.get("/auth/me")
async def get_me(
    db: Session = Depends(get_rh_db),
    token: str = Depends(get_token_from_header)
):
    """Отримати профіль поточного декоратора"""
    customer = get_current_customer(token, db)
    return customer

# ============================================================================
# PRODUCTS ENDPOINTS (читає з RentalHub products)
# ============================================================================

@router.get("/products")
async def get_products(
    response: Response,
    search: Optional[str] = None,
    category_name: Optional[str] = None,
    subcategory_name: Optional[str] = None,
    color: Optional[str] = None,
    date_from: Optional[str] = None,  # YYYY-MM-DD - для перевірки доступності
    date_to: Optional[str] = None,    # YYYY-MM-DD
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_rh_db)
):
    """Отримати каталог товарів з перевіркою доступності на дати (як RentalHub)"""
    
    response.headers["Cache-Control"] = "public, max-age=30"
    
    sql = """
        SELECT product_id, sku, name, category_name, subcategory_name,
               rental_price, image_url, color, material, size,
               quantity, frozen_quantity, description, price
        FROM products
        WHERE status = 1
    """
    params = {}
    
    if search:
        sql += " AND (name LIKE :search OR sku LIKE :search OR color LIKE :search OR material LIKE :search)"
        params["search"] = f"%{search}%"
    
    if category_name:
        sql += " AND category_name = :category_name"
        params["category_name"] = category_name
    
    if subcategory_name:
        sql += " AND subcategory_name = :subcategory_name"
        params["subcategory_name"] = subcategory_name
    
    if color:
        sql += " AND color LIKE :color"
        params["color"] = f"%{color}%"
    
    sql += " ORDER BY category_name, subcategory_name, name LIMIT :limit OFFSET :skip"
    params["limit"] = limit
    params["skip"] = skip
    
    result = db.execute(text(sql), params)
    rows = result.fetchall()
    
    if not rows:
        return []
    
    product_ids = [row[0] for row in rows]
    
    # Перевірка доступності на дати (як в RentalHub каталозі)
    reserved_dict = {}
    in_rent_dict = {}
    
    if date_from and date_to:
        # Резерви на конкретний період (перетинання дат)
        reserved_result = db.execute(text("""
            SELECT oi.product_id, COALESCE(SUM(oi.quantity), 0) as reserved
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            WHERE oi.product_id IN :product_ids
            AND o.status IN ('processing', 'ready_for_issue', 'awaiting_customer', 'pending')
            AND o.rental_start_date <= :date_to
            AND o.rental_end_date >= :date_from
            GROUP BY oi.product_id
        """), {"product_ids": tuple(product_ids), "date_from": date_from, "date_to": date_to})
        reserved_dict = {row[0]: int(row[1]) for row in reserved_result}
        
        # В оренді на конкретний період
        in_rent_result = db.execute(text("""
            SELECT oi.product_id, COALESCE(SUM(oi.quantity), 0) as in_rent
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            WHERE oi.product_id IN :product_ids
            AND o.status IN ('issued', 'on_rent')
            AND o.rental_start_date <= :date_to
            AND o.rental_end_date >= :date_from
            GROUP BY oi.product_id
        """), {"product_ids": tuple(product_ids), "date_from": date_from, "date_to": date_to})
        in_rent_dict = {row[0]: int(row[1]) for row in in_rent_result}
    else:
        # Без дат - поточний стан
        reserved_result = db.execute(text("""
            SELECT oi.product_id, COALESCE(SUM(oi.quantity), 0) as reserved
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            WHERE oi.product_id IN :product_ids
            AND o.status IN ('processing', 'ready_for_issue', 'awaiting_customer', 'pending')
            AND o.rental_end_date >= CURDATE()
            GROUP BY oi.product_id
        """), {"product_ids": tuple(product_ids)})
        reserved_dict = {row[0]: int(row[1]) for row in reserved_result}
        
        in_rent_result = db.execute(text("""
            SELECT oi.product_id, COALESCE(SUM(oi.quantity), 0) as in_rent
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            WHERE oi.product_id IN :product_ids
            AND o.status IN ('issued', 'on_rent')
            AND o.rental_end_date >= CURDATE()
            GROUP BY oi.product_id
        """), {"product_ids": tuple(product_ids)})
        in_rent_dict = {row[0]: int(row[1]) for row in in_rent_result}
    
    # Побудова результату
    products = []
    for row in rows:
        product_id = row[0]
        total_qty = row[10] or 0
        frozen_qty = row[11] or 0
        
        reserved = reserved_dict.get(product_id, 0)
        in_rent = in_rent_dict.get(product_id, 0)
        
        # Доступно = загальна кількість - заморожено - в оренді - в резерві
        available = max(0, total_qty - frozen_qty - in_rent - reserved)
        
        products.append({
            "product_id": product_id,
            "sku": row[1],
            "name": row[2],
            "category_name": row[3],
            "subcategory_name": row[4],
            "rental_price": float(row[5]) if row[5] else 0,
            "image_url": normalize_image_url(row[6]),
            "color": row[7],
            "material": row[8],
            "size": row[9],
            "quantity": total_qty,
            "frozen_quantity": frozen_qty,
            "reserved": reserved,
            "in_rent": in_rent,
            "available": available,
            "is_available": available > 0,
            "description": row[12],
            "price": float(row[13]) if row[13] else 0
        })
    
    return products

@router.get("/products/{product_id}")
async def get_product(product_id: int, db: Session = Depends(get_rh_db)):
    """Деталі товару"""
    result = db.execute(text("""
        SELECT product_id, sku, name, category_name, subcategory_name,
               rental_price, image_url, color, material, size, description,
               quantity, frozen_quantity, price
        FROM products WHERE product_id = :id
    """), {"id": product_id})
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return {
        "product_id": row[0],
        "sku": row[1],
        "name": row[2],
        "category_name": row[3],
        "subcategory_name": row[4],
        "rental_price": float(row[5]) if row[5] else 0,
        "image_url": normalize_image_url(row[6]),
        "color": row[7],
        "material": row[8],
        "size": row[9],
        "description": row[10],
        "quantity": row[11] or 0,
        "frozen_quantity": row[12] or 0,
        "available": max(0, (row[11] or 0) - (row[12] or 0)),
        "price": float(row[13]) if row[13] else 0
    }

@router.get("/categories")
async def get_categories(response: Response, db: Session = Depends(get_rh_db)):
    """
    Отримати дерево категорій та підкатегорій з кількістю товарів (як RentalHub)
    Повертає також кольори та матеріали для фільтрів
    """
    global _categories_cache
    
    now = time.time()
    if _categories_cache["data"] and _categories_cache["expires"] > now:
        response.headers["X-Cache"] = "HIT"
        response.headers["Cache-Control"] = "public, max-age=300"
        return _categories_cache["data"]
    
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = "public, max-age=300"
    
    # Отримати всі категорії з підкатегоріями та кількістю товарів
    result = db.execute(text("""
        SELECT 
            p.category_name,
            p.subcategory_name,
            COUNT(DISTINCT p.product_id) as product_count,
            SUM(p.quantity) as total_qty
        FROM products p
        WHERE p.status = 1 AND p.category_name IS NOT NULL AND p.category_name != ''
        GROUP BY p.category_name, p.subcategory_name
        ORDER BY p.category_name, p.subcategory_name
    """))
    
    categories_map = {}
    for row in result:
        cat_name = row[0] or "Без категорії"
        subcat_name = row[1]
        count = row[2]
        qty = row[3] or 0
        
        if cat_name not in categories_map:
            categories_map[cat_name] = {
                "name": cat_name,
                "product_count": 0,
                "total_qty": 0,
                "subcategories": []
            }
        
        categories_map[cat_name]["product_count"] += count
        categories_map[cat_name]["total_qty"] += qty
        
        if subcat_name:
            categories_map[cat_name]["subcategories"].append({
                "name": subcat_name,
                "product_count": count,
                "total_qty": qty
            })
    
    # Отримати унікальні кольори
    colors_result = db.execute(text("""
        SELECT DISTINCT color FROM products 
        WHERE status = 1 AND color IS NOT NULL AND color != ''
        ORDER BY color
    """))
    colors = [row[0] for row in colors_result]
    
    # Отримати унікальні матеріали
    materials_result = db.execute(text("""
        SELECT DISTINCT material FROM products 
        WHERE status = 1 AND material IS NOT NULL AND material != ''
        ORDER BY material
    """))
    materials = [row[0] for row in materials_result]
    
    data = {
        "categories": list(categories_map.values()),
        "colors": colors,
        "materials": materials
    }
    
    # Зберегти в кеш
    _categories_cache = {"data": data, "expires": now + CACHE_TTL}
    return data

@router.get("/subcategories")
async def get_subcategories(response: Response, category_name: Optional[str] = None, db: Session = Depends(get_rh_db)):
    """Отримати підкатегорії для конкретної категорії"""
    response.headers["Cache-Control"] = "public, max-age=300"
    
    sql = """
        SELECT subcategory_name, COUNT(*) as product_count, SUM(quantity) as total_qty
        FROM products 
        WHERE status = 1 AND subcategory_name IS NOT NULL AND subcategory_name != ''
    """
    params = {}
    
    if category_name:
        sql += " AND category_name = :category_name"
        params["category_name"] = category_name
    
    sql += " GROUP BY subcategory_name ORDER BY subcategory_name"
    
    result = db.execute(text(sql), params)
    return [{"name": row[0], "product_count": row[1], "total_qty": row[2] or 0} for row in result]

# ============================================================================
# AVAILABILITY CHECK
# ============================================================================

class AvailabilityCheck(BaseModel):
    product_id: int
    quantity: int
    reserved_from: str
    reserved_until: str

@router.post("/products/check-availability")
async def check_availability(data: AvailabilityCheck, db: Session = Depends(get_rh_db)):
    """Перевірити доступність товару на вказані дати"""
    
    # Отримати інформацію про товар
    product_result = db.execute(text("""
        SELECT product_id, name, quantity, frozen_quantity
        FROM products WHERE product_id = :id AND status = 1
    """), {"id": data.product_id})
    product = product_result.fetchone()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    total_quantity = product[2] or 0
    frozen_quantity = product[3] or 0
    base_available = total_quantity - frozen_quantity
    
    # Перевірити перетин з існуючими замовленнями
    reserved_result = db.execute(text("""
        SELECT COALESCE(SUM(oi.quantity), 0) as reserved_qty
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        WHERE oi.product_id = :product_id
        AND o.status NOT IN ('cancelled', 'returned', 'completed')
        AND o.rental_start_date <= :end_date
        AND o.rental_end_date >= :start_date
    """), {
        "product_id": data.product_id,
        "start_date": data.reserved_from,
        "end_date": data.reserved_until
    })
    reserved_qty = reserved_result.fetchone()[0] or 0
    
    # Перевірити soft reservations з інших бордів
    soft_reserved_result = db.execute(text("""
        SELECT COALESCE(SUM(quantity), 0) as soft_reserved
        FROM event_soft_reservations
        WHERE product_id = :product_id
        AND status = 'active'
        AND expires_at > NOW()
        AND reserved_from <= :end_date
        AND reserved_until >= :start_date
    """), {
        "product_id": data.product_id,
        "start_date": data.reserved_from,
        "end_date": data.reserved_until
    })
    soft_reserved = soft_reserved_result.fetchone()[0] or 0
    
    available_for_dates = base_available - reserved_qty - soft_reserved
    is_available = available_for_dates >= data.quantity
    
    return {
        "product_id": data.product_id,
        "requested_quantity": data.quantity,
        "total_quantity": total_quantity,
        "reserved_quantity": int(reserved_qty),
        "soft_reserved": int(soft_reserved),
        "available": max(0, available_for_dates),
        "is_available": is_available,
        "reserved_from": data.reserved_from,
        "reserved_until": data.reserved_until
    }

# ============================================================================
# EVENT BOARDS ENDPOINTS
# ============================================================================

@router.get("/boards")
async def get_boards(
    status: Optional[str] = None,
    db: Session = Depends(get_rh_db),
    token: str = Depends(get_token_from_header)
):
    """Отримати мудборди декоратора"""
    customer = get_current_customer(token, db)
    
    sql = """
        SELECT id, customer_id, board_name, event_date, event_type,
               rental_start_date, rental_end_date, rental_days, status,
               notes, budget, estimated_total, cover_image, canvas_layout,
               created_at, updated_at, converted_to_order_id
        FROM event_boards WHERE customer_id = :customer_id
    """
    params = {"customer_id": customer["customer_id"]}
    
    if status:
        sql += " AND status = :status"
        params["status"] = status
    
    sql += " ORDER BY updated_at DESC"
    
    result = db.execute(text(sql), params)
    boards = []
    
    for row in result:
        board = {
            "id": row[0],
            "customer_id": row[1],
            "board_name": row[2],
            "event_date": row[3].isoformat() if row[3] else None,
            "event_type": row[4],
            "rental_start_date": row[5].isoformat() if row[5] else None,
            "rental_end_date": row[6].isoformat() if row[6] else None,
            "rental_days": row[7],
            "status": row[8],
            "notes": row[9],
            "budget": float(row[10]) if row[10] else None,
            "estimated_total": float(row[11]) if row[11] else 0,
            "cover_image": row[12],
            "canvas_layout": row[13],
            "created_at": row[14].isoformat() if row[14] else None,
            "updated_at": row[15].isoformat() if row[15] else None,
            "converted_to_order_id": row[16]
        }
        
        # Завантажити items
        items_result = db.execute(text("""
            SELECT ebi.id, ebi.board_id, ebi.product_id, ebi.quantity, ebi.notes, 
                   ebi.section, ebi.position, ebi.added_at,
                   p.sku, p.name, p.rental_price, p.image_url, p.color, p.material
            FROM event_board_items ebi
            JOIN products p ON ebi.product_id = p.product_id
            WHERE ebi.board_id = :board_id
            ORDER BY ebi.position
        """), {"board_id": row[0]})
        
        board["items"] = [{
            "id": item[0],
            "board_id": item[1],
            "product_id": item[2],
            "quantity": item[3],
            "notes": item[4],
            "section": item[5],
            "position": item[6],
            "added_at": item[7].isoformat() if item[7] else None,
            "product": {
                "sku": item[8],
                "name": item[9],
                "rental_price": float(item[10]) if item[10] else 0,
                "image_url": normalize_image_url(item[11]),
                "color": item[12],
                "material": item[13]
            }
        } for item in items_result]
        
        boards.append(board)
    
    return boards

@router.post("/boards")
async def create_board(
    data: EventBoardCreate,
    db: Session = Depends(get_rh_db),
    token: str = Depends(get_token_from_header)
):
    """Створити новий мудборд"""
    customer = get_current_customer(token, db)
    board_id = str(uuid.uuid4())
    
    rental_days = None
    if data.rental_start_date and data.rental_end_date:
        start = datetime.strptime(data.rental_start_date, "%Y-%m-%d")
        end = datetime.strptime(data.rental_end_date, "%Y-%m-%d")
        rental_days = (end - start).days + 1
    
    db.execute(text("""
        INSERT INTO event_boards (id, customer_id, board_name, event_date, event_type,
                                  rental_start_date, rental_end_date, rental_days, notes, budget, status)
        VALUES (:id, :customer_id, :board_name, :event_date, :event_type,
                :rental_start_date, :rental_end_date, :rental_days, :notes, :budget, 'draft')
    """), {
        "id": board_id,
        "customer_id": customer["customer_id"],
        "board_name": data.board_name,
        "event_date": data.event_date,
        "event_type": data.event_type,
        "rental_start_date": data.rental_start_date,
        "rental_end_date": data.rental_end_date,
        "rental_days": rental_days,
        "notes": data.notes,
        "budget": data.budget
    })
    db.commit()
    
    logger.info(f"✅ Event board created: {board_id}")
    
    return {"id": board_id, "board_name": data.board_name, "status": "draft", "items": []}

@router.get("/boards/{board_id}")
async def get_board(
    board_id: str,
    db: Session = Depends(get_rh_db),
    token: str = Depends(get_token_from_header)
):
    """Отримати мудборд з товарами"""
    customer = get_current_customer(token, db)
    
    result = db.execute(text("""
        SELECT id, customer_id, board_name, event_date, event_type,
               rental_start_date, rental_end_date, rental_days, status,
               notes, budget, estimated_total, cover_image, canvas_layout,
               created_at, updated_at, converted_to_order_id
        FROM event_boards WHERE id = :id AND customer_id = :customer_id
    """), {"id": board_id, "customer_id": customer["customer_id"]})
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Board not found")
    
    board = {
        "id": row[0],
        "customer_id": row[1],
        "board_name": row[2],
        "event_date": row[3].isoformat() if row[3] else None,
        "event_type": row[4],
        "rental_start_date": row[5].isoformat() if row[5] else None,
        "rental_end_date": row[6].isoformat() if row[6] else None,
        "rental_days": row[7],
        "status": row[8],
        "notes": row[9],
        "budget": float(row[10]) if row[10] else None,
        "estimated_total": float(row[11]) if row[11] else 0,
        "cover_image": row[12],
        "canvas_layout": row[13],
        "created_at": row[14].isoformat() if row[14] else None,
        "updated_at": row[15].isoformat() if row[15] else None,
        "converted_to_order_id": row[16]
    }
    
    # Items з повною інформацією про товар
    items_result = db.execute(text("""
        SELECT ebi.id, ebi.board_id, ebi.product_id, ebi.quantity, ebi.notes, 
               ebi.section, ebi.position, ebi.added_at,
               p.sku, p.name, p.rental_price, p.image_url, p.color, p.material
        FROM event_board_items ebi
        JOIN products p ON ebi.product_id = p.product_id
        WHERE ebi.board_id = :board_id
        ORDER BY ebi.position
    """), {"board_id": board_id})
    
    board["items"] = [{
        "id": item[0],
        "board_id": item[1],
        "product_id": item[2],
        "quantity": item[3],
        "notes": item[4],
        "section": item[5],
        "position": item[6],
        "added_at": item[7].isoformat() if item[7] else None,
        "product": {
            "sku": item[8],
            "name": item[9],
            "rental_price": float(item[10]) if item[10] else 0,
            "image_url": normalize_image_url(item[11]),
            "color": item[12],
            "material": item[13]
        }
    } for item in items_result]
    
    return board

@router.patch("/boards/{board_id}")
async def update_board(
    board_id: str,
    data: EventBoardUpdate,
    db: Session = Depends(get_rh_db),
    token: str = Depends(get_token_from_header)
):
    """Оновити мудборд"""
    customer = get_current_customer(token, db)
    
    # Перевірити права
    result = db.execute(text("""
        SELECT id FROM event_boards WHERE id = :id AND customer_id = :customer_id
    """), {"id": board_id, "customer_id": customer["customer_id"]})
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Build update
    updates = []
    params = {"id": board_id}
    
    if data.board_name is not None:
        updates.append("board_name = :board_name")
        params["board_name"] = data.board_name
    if data.event_date is not None:
        updates.append("event_date = :event_date")
        params["event_date"] = data.event_date
    if data.event_type is not None:
        updates.append("event_type = :event_type")
        params["event_type"] = data.event_type
    if data.rental_start_date is not None:
        updates.append("rental_start_date = :rental_start_date")
        params["rental_start_date"] = data.rental_start_date
    if data.rental_end_date is not None:
        updates.append("rental_end_date = :rental_end_date")
        params["rental_end_date"] = data.rental_end_date
    if data.notes is not None:
        updates.append("notes = :notes")
        params["notes"] = data.notes
    if data.budget is not None:
        updates.append("budget = :budget")
        params["budget"] = data.budget
    if data.status is not None:
        updates.append("status = :status")
        params["status"] = data.status
    if data.cover_image is not None:
        updates.append("cover_image = :cover_image")
        params["cover_image"] = data.cover_image
    if data.canvas_layout is not None:
        updates.append("canvas_layout = :canvas_layout")
        params["canvas_layout"] = json.dumps(data.canvas_layout)
    
    # Перерахувати rental_days якщо оновлені дати
    if data.rental_start_date is not None or data.rental_end_date is not None:
        updates.append("rental_days = DATEDIFF(COALESCE(:rental_end_date, rental_end_date), COALESCE(:rental_start_date, rental_start_date)) + 1")
    
    if updates:
        sql = f"UPDATE event_boards SET {', '.join(updates)}, updated_at = NOW() WHERE id = :id"
        db.execute(text(sql), params)
        db.commit()
    
    return await get_board(board_id, db=db, token=token)

@router.delete("/boards/{board_id}")
async def delete_board(
    board_id: str,
    db: Session = Depends(get_rh_db),
    token: str = Depends(get_token_from_header)
):
    """Видалити мудборд"""
    customer = get_current_customer(token, db)
    
    result = db.execute(text("""
        DELETE FROM event_boards WHERE id = :id AND customer_id = :customer_id
    """), {"id": board_id, "customer_id": customer["customer_id"]})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Board not found")
    
    logger.info(f"✅ Event board deleted: {board_id}")
    return {"message": "Board deleted"}

# ============================================================================
# BOARD ITEMS ENDPOINTS
# ============================================================================

@router.post("/boards/{board_id}/items")
async def add_item_to_board(
    board_id: str,
    data: EventBoardItemCreate,
    db: Session = Depends(get_rh_db),
    token: str = Depends(get_token_from_header)
):
    """Додати товар до мудборду"""
    customer = get_current_customer(token, db)
    
    # Перевірити права на board
    board_result = db.execute(text("""
        SELECT id, rental_start_date, rental_end_date, rental_days 
        FROM event_boards WHERE id = :id AND customer_id = :customer_id
    """), {"id": board_id, "customer_id": customer["customer_id"]})
    board = board_result.fetchone()
    
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Перевірити товар
    product_result = db.execute(text("""
        SELECT product_id, rental_price FROM products WHERE product_id = :id
    """), {"id": data.product_id})
    product = product_result.fetchone()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Перевірити чи вже є в борді
    existing = db.execute(text("""
        SELECT id, quantity FROM event_board_items WHERE board_id = :board_id AND product_id = :product_id
    """), {"board_id": board_id, "product_id": data.product_id})
    existing_item = existing.fetchone()
    
    if existing_item:
        # Оновити кількість
        new_qty = existing_item[1] + data.quantity
        db.execute(text("""
            UPDATE event_board_items SET quantity = :qty, notes = COALESCE(:notes, notes)
            WHERE id = :id
        """), {"id": existing_item[0], "qty": new_qty, "notes": data.notes})
        item_id = existing_item[0]
    else:
        # Створити новий item
        item_id = str(uuid.uuid4())
        db.execute(text("""
            INSERT INTO event_board_items (id, board_id, product_id, quantity, notes, section)
            VALUES (:id, :board_id, :product_id, :quantity, :notes, :section)
        """), {
            "id": item_id,
            "board_id": board_id,
            "product_id": data.product_id,
            "quantity": data.quantity,
            "notes": data.notes,
            "section": data.section
        })
    
    # Оновити estimated_total
    if product[1] and board[3]:
        db.execute(text("""
            UPDATE event_boards 
            SET estimated_total = (
                SELECT COALESCE(SUM(ebi.quantity * p.rental_price * :days), 0)
                FROM event_board_items ebi
                JOIN products p ON ebi.product_id = p.product_id
                WHERE ebi.board_id = :board_id
            )
            WHERE id = :board_id
        """), {"board_id": board_id, "days": board[3]})
    
    # Створити soft reservation якщо є дати
    if board[1] and board[2]:
        expires_at = datetime.utcnow() + timedelta(minutes=30)
        db.execute(text("""
            INSERT INTO event_soft_reservations (id, board_id, product_id, quantity, reserved_from, reserved_until, expires_at, customer_id, status)
            VALUES (:id, :board_id, :product_id, :quantity, :reserved_from, :reserved_until, :expires_at, :customer_id, 'active')
            ON DUPLICATE KEY UPDATE quantity = :quantity, expires_at = :expires_at
        """), {
            "id": str(uuid.uuid4()),
            "board_id": board_id,
            "product_id": data.product_id,
            "quantity": data.quantity,
            "reserved_from": board[1],
            "reserved_until": board[2],
            "expires_at": expires_at,
            "customer_id": customer["customer_id"]
        })
    
    db.commit()
    
    logger.info(f"✅ Item added to board: {board_id}, product: {data.product_id}")
    
    return {"id": item_id, "product_id": data.product_id, "quantity": data.quantity}

@router.patch("/boards/{board_id}/items/{item_id}")
async def update_board_item(
    board_id: str,
    item_id: str,
    data: EventBoardItemUpdate,
    db: Session = Depends(get_rh_db),
    token: str = Depends(get_token_from_header)
):
    """Оновити товар в мудборді"""
    customer = get_current_customer(token, db)
    
    # Перевірити права
    board_result = db.execute(text("""
        SELECT eb.id FROM event_boards eb
        JOIN event_board_items ebi ON eb.id = ebi.board_id
        WHERE eb.id = :board_id AND eb.customer_id = :customer_id AND ebi.id = :item_id
    """), {"board_id": board_id, "customer_id": customer["customer_id"], "item_id": item_id})
    
    if not board_result.fetchone():
        raise HTTPException(status_code=404, detail="Item not found")
    
    updates = []
    params = {"id": item_id}
    
    if data.quantity is not None:
        updates.append("quantity = :quantity")
        params["quantity"] = data.quantity
    if data.notes is not None:
        updates.append("notes = :notes")
        params["notes"] = data.notes
    if data.section is not None:
        updates.append("section = :section")
        params["section"] = data.section
    
    if updates:
        sql = f"UPDATE event_board_items SET {', '.join(updates)} WHERE id = :id"
        db.execute(text(sql), params)
        db.commit()
    
    return {"id": item_id, "updated": True}

@router.delete("/boards/{board_id}/items/{item_id}")
async def delete_board_item(
    board_id: str,
    item_id: str,
    db: Session = Depends(get_rh_db),
    token: str = Depends(get_token_from_header)
):
    """Видалити товар з мудборду"""
    customer = get_current_customer(token, db)
    
    # Отримати product_id перед видаленням
    item_result = db.execute(text("""
        SELECT ebi.product_id FROM event_board_items ebi
        JOIN event_boards eb ON ebi.board_id = eb.id
        WHERE ebi.id = :item_id AND eb.id = :board_id AND eb.customer_id = :customer_id
    """), {"item_id": item_id, "board_id": board_id, "customer_id": customer["customer_id"]})
    item = item_result.fetchone()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Видалити soft reservation
    db.execute(text("""
        DELETE FROM event_soft_reservations WHERE board_id = :board_id AND product_id = :product_id
    """), {"board_id": board_id, "product_id": item[0]})
    
    # Видалити item
    db.execute(text("DELETE FROM event_board_items WHERE id = :id"), {"id": item_id})
    db.commit()
    
    logger.info(f"✅ Item deleted from board: {board_id}")
    return {"message": "Item deleted"}

# ============================================================================
# CONVERT TO ORDER
# ============================================================================

@router.post("/boards/{board_id}/convert-to-order")
async def convert_to_order(
    board_id: str,
    data: OrderCreate,
    db: Session = Depends(get_rh_db),
    token: str = Depends(get_token_from_header)
):
    """Конвертувати мудборд у замовлення RentalHub"""
    customer = get_current_customer(token, db)
    
    # Отримати board
    board_result = db.execute(text("""
        SELECT * FROM event_boards WHERE id = :id AND customer_id = :customer_id
    """), {"id": board_id, "customer_id": customer["customer_id"]})
    board = board_result.fetchone()
    
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    if board[14]:  # converted_to_order_id
        raise HTTPException(status_code=400, detail="Board already converted")
    
    if not board[5] or not board[6]:  # rental dates
        raise HTTPException(status_code=400, detail="Rental dates required")
    
    # Отримати items
    items_result = db.execute(text("""
        SELECT ebi.product_id, ebi.quantity, p.rental_price, p.name, p.image_url
        FROM event_board_items ebi
        JOIN products p ON ebi.product_id = p.product_id
        WHERE ebi.board_id = :board_id
    """), {"board_id": board_id})
    items = items_result.fetchall()
    
    if not items:
        raise HTTPException(status_code=400, detail="Board has no items")
    
    # Розрахувати total
    rental_days = board[7] or 1
    total_price = sum(float(item[2] or 0) * item[1] * rental_days for item in items)
    deposit_amount = total_price * 0.3
    
    # Генерувати order_number
    max_id_result = db.execute(text("SELECT MAX(order_id) FROM orders"))
    max_id = max_id_result.fetchone()[0] or 0
    new_order_id = max_id + 1
    order_number = f"OC-{new_order_id}"
    
    # Створити order в RentalHub
    db.execute(text("""
        INSERT INTO orders (order_id, order_number, status, rental_start_date, rental_end_date,
                           total_price, deposit_amount, customer_name, customer_phone, customer_email,
                           delivery_address, delivery_type, notes, source, created_at)
        VALUES (:order_id, :order_number, 'awaiting_customer', :start_date, :end_date,
                :total_price, :deposit_amount, :customer_name, :phone, :email,
                :delivery_address, :delivery_type, :notes, 'event_tool', NOW())
    """), {
        "order_id": new_order_id,
        "order_number": order_number,
        "start_date": board[5],
        "end_date": board[6],
        "total_price": total_price,
        "deposit_amount": deposit_amount,
        "customer_name": data.customer_name,
        "phone": data.phone,
        "email": customer["email"],
        "delivery_address": data.delivery_address,
        "delivery_type": data.delivery_type,
        "notes": data.customer_comment
    })
    
    # Створити order_items
    for item in items:
        db.execute(text("""
            INSERT INTO order_items (order_id, product_id, product_name, quantity, price, total_rental, image_url)
            VALUES (:order_id, :product_id, :name, :quantity, :price, :total, :image_url)
        """), {
            "order_id": new_order_id,
            "product_id": item[0],
            "name": item[3],
            "quantity": item[1],
            "price": float(item[2] or 0),
            "total": float(item[2] or 0) * item[1] * rental_days,
            "image_url": item[4]
        })
    
    # Видалити soft reservations
    db.execute(text("DELETE FROM event_soft_reservations WHERE board_id = :board_id"), {"board_id": board_id})
    
    # Оновити board
    db.execute(text("""
        UPDATE event_boards SET converted_to_order_id = :order_id, status = 'converted', updated_at = NOW()
        WHERE id = :board_id
    """), {"order_id": new_order_id, "board_id": board_id})
    
    db.commit()
    
    logger.info(f"✅ Board {board_id} converted to order {order_number}")
    
    return {
        "order_id": new_order_id,
        "order_number": order_number,
        "total_price": total_price,
        "deposit_amount": deposit_amount,
        "status": "awaiting_customer",
        "message": "Order created successfully"
    }

# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def health():
    return {"status": "ok", "service": "event-tool", "timestamp": datetime.utcnow().isoformat()}
