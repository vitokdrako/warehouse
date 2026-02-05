from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
import os
import uuid
import logging

from database import get_db
from models import Customer, Product, Category, EventBoard, EventBoardItem, SoftReservation, ProductReservation
from schemas import (
    CustomerRegister, CustomerLogin, Token, CustomerResponse,
    ProductListItem, ProductDetail,
    CategoryResponse, EventBoardCreate, EventBoardUpdate,
    EventBoardResponse, EventBoardItemCreate, EventBoardItemUpdate,
    EventBoardItemResponse, AvailabilityCheckRequest, AvailabilityCheckResponse
)
from auth import (
    get_password_hash, authenticate_customer, create_access_token,
    create_refresh_token, get_current_user
)
from color_translator import translate_color

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="FarforDecor Event Planning API")

# Create API router with /api prefix
api_router = APIRouter(prefix="/api")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# AUTH ENDPOINTS
# ============================================================================

@api_router.post("/auth/register", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def register(customer_data: CustomerRegister, db: AsyncSession = Depends(get_db)):
    """Реєстрація нового клієнта"""
    
    # Check if email exists
    result = await db.execute(select(Customer).where(Customer.email == customer_data.email))
    existing_customer = result.scalar_one_or_none()
    
    if existing_customer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new customer
    new_customer = Customer(
        email=customer_data.email,
        password_hash=get_password_hash(customer_data.password),
        firstname=customer_data.firstname,
        lastname=customer_data.lastname,
        telephone=customer_data.telephone,
        is_active=True,
        email_verified=False,
        created_at=datetime.utcnow(),
        synced_at=datetime.utcnow()
    )
    
    db.add(new_customer)
    await db.commit()
    await db.refresh(new_customer)
    
    logger.info(f"New customer registered: {new_customer.email}")
    return new_customer

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: CustomerLogin, db: AsyncSession = Depends(get_db)):
    """Вхід клієнта"""
    
    customer = await authenticate_customer(db, credentials.email, credentials.password)
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Update last login
    customer.last_login = datetime.utcnow()
    await db.commit()
    
    # Create tokens
    access_token = create_access_token(data={"sub": customer.customer_id})
    refresh_token = create_refresh_token(data={"sub": customer.customer_id})
    
    logger.info(f"Customer logged in: {customer.email}")
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@api_router.get("/auth/me", response_model=CustomerResponse)
async def get_me(current_user: Customer = Depends(get_current_user)):
    """Отримати інформацію про поточного користувача"""
    return current_user

# ============================================================================
# CATEGORIES ENDPOINTS
# ============================================================================

@api_router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(
    parent_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """Отримати список категорій"""
    
    query = select(Category).where(Category.is_active == True)
    
    if parent_id is not None:
        query = query.where(Category.parent_id == parent_id)
    else:
        query = query.where(Category.parent_id.is_(None))
    
    query = query.order_by(Category.sort_order, Category.name)
    
    result = await db.execute(query)
    categories = result.scalars().all()
    
    return categories

@api_router.get("/subcategories")
async def get_subcategories(
    category_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Отримати список підкатегорій з продуктів"""
    
    # Build query
    query = select(Product.category_name, Product.subcategory_name).where(
        and_(
            Product.status == 1,
            Product.category_name.isnot(None),
            Product.subcategory_name.isnot(None),
            Product.subcategory_name != ''
        )
    ).distinct()
    
    # Filter by category if provided
    if category_name:
        query = query.where(Product.category_name == category_name)
    
    result = await db.execute(query)
    rows = result.all()
    
    # Build response
    if category_name:
        # Return just subcategory names for a specific category
        subcategories = sorted(set(row.subcategory_name for row in rows if row.subcategory_name))
        return {"category": category_name, "subcategories": subcategories}
    else:
        # Return all category-subcategory pairs
        category_subcategories = {}
        for row in rows:
            # Skip if category_name is None
            if row.category_name and row.subcategory_name:
                if row.category_name not in category_subcategories:
                    category_subcategories[row.category_name] = set()
                category_subcategories[row.category_name].add(row.subcategory_name)
        
        # Convert to list format
        result_list = []
        for cat_name in sorted(category_subcategories.keys()):
            result_list.append({
                "category": cat_name,
                "subcategories": sorted(list(category_subcategories[cat_name]))
            })
        
        return result_list

# ============================================================================
# PRODUCTS ENDPOINTS
# ============================================================================

@api_router.get("/products", response_model=List[ProductListItem])
async def get_products(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    color: Optional[str] = None,
    material: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    skip: int = 0,
    limit: int = 10000,  # Збільшено для завантаження всіх товарів (6668)
    include_availability: bool = True,  # Додано опція для розрахунку доступності
    db: AsyncSession = Depends(get_db)
):
    """
    Отримати список товарів з фільтрами
    ✅ Розраховує available з врахуванням:
       - SoftReservation (резерви в мудбордах)
       - Статус чистки (мийка, хімчистка, реставрація)
    """
    
    query = select(Product).where(Product.status == 1)
    
    # Search
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                Product.name.like(search_pattern),
                Product.sku.like(search_pattern),
                Product.category_name.like(search_pattern)
            )
        )
    
    # Filters
    if category_id:
        query = query.where(Product.category_id == category_id)
    
    if color:
        query = query.where(Product.color.like(f"%{color}%"))
    
    if material:
        query = query.where(Product.material.like(f"%{material}%"))
    
    if min_price:
        query = query.where(Product.rental_price >= min_price)
    
    if max_price:
        query = query.where(Product.rental_price <= max_price)
    
    # Sort by product_id DESC to show latest added products first
    query = query.order_by(Product.product_id.desc())
    
    # Pagination
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    products = result.scalars().all()
    
    # Якщо потрібна статистика доступності - рахуємо batch
    if include_availability and products:
        # Batch запит: підрахунок SoftReservation для всіх товарів одразу
        product_ids = [p.product_id for p in products]
        
        # Активні м'які резервації (в мудбордах з датами оренди)
        soft_reservations_query = select(
            SoftReservation.product_id,
            func.sum(SoftReservation.quantity).label('reserved')
        ).where(
            and_(
                SoftReservation.product_id.in_(product_ids),
                SoftReservation.status == 'active',
                SoftReservation.expires_at >= datetime.utcnow()
            )
        ).group_by(SoftReservation.product_id)
        
        soft_result = await db.execute(soft_reservations_query)
        soft_reserved_dict = {row.product_id: int(row.reserved) for row in soft_result}
        
        # TODO: Додати підрахунок товарів на мийці/хімчистці/реставрації
        # Якщо буде таблиця product_cleaning_status:
        # cleaning_query = select(product_id, 1).where(status IN ('washing', 'repair', 'dry_cleaning'))
        # cleaning_dict = {row[0]: 1 for row in cleaning_result}
        
        # Додати доступність до кожного продукту
        products_with_availability = []
        for product in products:
            product_dict = {
                "product_id": product.product_id,
                "sku": product.sku,
                "name": product.name,
                "category_id": product.category_id,
                "category_name": product.category_name,
                "subcategory_id": product.subcategory_id,
                "subcategory_name": product.subcategory_name,
                "rental_price": float(product.rental_price) if product.rental_price else 0.0,
                "image_url": product.image_url,
                "color": translate_color(product.color) if product.color else None,
                "material": product.material,
                "size": product.size,
                "status": product.status,
                
                # Статистика доступності
                "quantity": product.quantity or 0,
                "frozen_quantity": product.frozen_quantity or 0,
                "reserved": soft_reserved_dict.get(product.product_id, 0),
                "available": max(0, 
                    (product.quantity or 0) - 
                    (product.frozen_quantity or 0) - 
                    soft_reserved_dict.get(product.product_id, 0)
                ),
                # TODO: додати in_cleaning, in_repair коли буде таблиця
            }
            products_with_availability.append(ProductListItem(**product_dict))
        
        return products_with_availability
    
    return products

@api_router.get("/products/{product_id}", response_model=ProductDetail)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    """Отримати деталі товару"""
    
    result = await db.execute(select(Product).where(Product.product_id == product_id))
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return product

@api_router.post("/products/check-availability", response_model=AvailabilityCheckResponse)
async def check_product_availability(
    request: AvailabilityCheckRequest,
    db: AsyncSession = Depends(get_db)
):
    """Перевірити доступність товару на дати"""
    
    # Get product
    result = await db.execute(select(Product).where(Product.product_id == request.product_id))
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    total_quantity = product.quantity
    frozen_quantity = product.frozen_quantity or 0
    
    # Get hard reservations (from orders)
    hard_reservations_query = select(func.sum(ProductReservation.quantity)).where(
        and_(
            ProductReservation.product_id == request.product_id,
            ProductReservation.status == 'active',
            or_(
                and_(
                    ProductReservation.reserved_from <= request.reserved_until,
                    ProductReservation.reserved_until >= request.reserved_from
                )
            )
        )
    )
    result = await db.execute(hard_reservations_query)
    hard_reserved = result.scalar() or 0
    
    # Get soft reservations (from event boards)
    soft_reservations_query = select(func.sum(SoftReservation.quantity)).where(
        and_(
            SoftReservation.product_id == request.product_id,
            SoftReservation.status == 'active',
            SoftReservation.expires_at > datetime.utcnow(),
            or_(
                and_(
                    SoftReservation.reserved_from <= request.reserved_until,
                    SoftReservation.reserved_until >= request.reserved_from
                )
            )
        )
    )
    result = await db.execute(soft_reservations_query)
    soft_reserved = result.scalar() or 0
    
    # Calculate available quantity
    available_quantity = total_quantity - frozen_quantity - hard_reserved - soft_reserved
    is_available = available_quantity >= request.quantity
    
    message = None
    if not is_available:
        if available_quantity > 0:
            message = f"Доступно лише {available_quantity} шт на ці дати"
        else:
            message = "Товар недоступний на ці дати"
    
    return {
        "product_id": request.product_id,
        "requested_quantity": request.quantity,
        "available_quantity": max(0, available_quantity),
        "is_available": is_available,
        "message": message
    }

# ============================================================================
# EVENT BOARDS ENDPOINTS  
# ============================================================================

@api_router.get("/boards", response_model=List[EventBoardResponse])
async def get_event_boards(
    status: Optional[str] = None,
    current_user: Customer = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Отримати список мудбордів користувача"""
    
    query = select(EventBoard).where(EventBoard.customer_id == current_user.customer_id)
    
    if status:
        query = query.where(EventBoard.status == status)
    
    query = query.order_by(EventBoard.updated_at.desc())
    
    result = await db.execute(query)
    boards = result.scalars().all()
    
    # Manually construct response with items
    response_boards = []
    for board in boards:
        items_result = await db.execute(
            select(EventBoardItem).where(EventBoardItem.board_id == board.id).order_by(EventBoardItem.position)
        )
        items = items_result.scalars().all()
        
        # Load product details for each item
        item_list = []
        for item in items:
            product_result = await db.execute(
                select(Product).where(Product.product_id == item.product_id)
            )
            product = product_result.scalar_one_or_none()
            
            # Create dict with item and product
            item_dict = {
                'id': item.id,
                'board_id': item.board_id,
                'product_id': item.product_id,
                'quantity': item.quantity,
                'notes': item.notes,
                'section': item.section,
                'position': item.position,
                'added_at': item.added_at,
                'product': product
            }
            item_list.append(item_dict)
        
        # Create board dict with items
        board_dict = {
            'id': board.id,
            'customer_id': board.customer_id,
            'board_name': board.board_name,
            'event_date': board.event_date,
            'event_type': board.event_type,
            'rental_start_date': board.rental_start_date,
            'rental_end_date': board.rental_end_date,
            'rental_days': board.rental_days,
            'status': board.status,
            'notes': board.notes,
            'cover_image': board.cover_image,
            'budget': board.budget,
            'estimated_total': board.estimated_total,
            'canvas_layout': board.canvas_layout,
            'created_at': board.created_at,
            'updated_at': board.updated_at,
            'converted_to_order_id': board.converted_to_order_id,
            'items': item_list
        }
        response_boards.append(board_dict)
    
    return response_boards

@api_router.post("/boards", response_model=EventBoardResponse, status_code=status.HTTP_201_CREATED)
async def create_event_board(
    board_data: EventBoardCreate,
    current_user: Customer = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Створити новий мудборд"""
    
    # Calculate rental days
    rental_days = None
    if board_data.rental_start_date and board_data.rental_end_date:
        rental_days = (board_data.rental_end_date - board_data.rental_start_date).days + 1
    
    new_board = EventBoard(
        id=str(uuid.uuid4()),
        customer_id=current_user.customer_id,
        board_name=board_data.board_name,
        event_date=board_data.event_date,
        event_type=board_data.event_type,
        rental_start_date=board_data.rental_start_date,
        rental_end_date=board_data.rental_end_date,
        rental_days=rental_days,
        notes=board_data.notes,
        budget=board_data.budget,
        status='draft',
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(new_board)
    await db.commit()
    await db.refresh(new_board)
    
    logger.info(f"Event board created: {new_board.id} by customer {current_user.customer_id}")
    
    # Return board as dict with empty items list
    return {
        'id': new_board.id,
        'customer_id': new_board.customer_id,
        'board_name': new_board.board_name,
        'event_date': new_board.event_date,
        'event_type': new_board.event_type,
        'rental_start_date': new_board.rental_start_date,
        'rental_end_date': new_board.rental_end_date,
        'rental_days': new_board.rental_days,
        'status': new_board.status,
        'notes': new_board.notes,
        'cover_image': new_board.cover_image,
        'budget': new_board.budget,
        'estimated_total': new_board.estimated_total,
        'canvas_layout': new_board.canvas_layout,
        'created_at': new_board.created_at,
        'updated_at': new_board.updated_at,
        'converted_to_order_id': new_board.converted_to_order_id,
        'items': []
    }

@api_router.get("/boards/{board_id}", response_model=EventBoardResponse)
async def get_event_board(
    board_id: str,
    current_user: Customer = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Отримати деталі мудборду"""
    
    result = await db.execute(
        select(EventBoard).where(
            and_(
                EventBoard.id == board_id,
                EventBoard.customer_id == current_user.customer_id
            )
        )
    )
    board = result.scalar_one_or_none()
    
    if not board:
        raise HTTPException(status_code=404, detail="Event board not found")
    
    # Load items
    items_result = await db.execute(
        select(EventBoardItem).where(EventBoardItem.board_id == board.id).order_by(EventBoardItem.position)
    )
    items = items_result.scalars().all()
    
    # Load product details
    item_list = []
    for item in items:
        product_result = await db.execute(
            select(Product).where(Product.product_id == item.product_id)
        )
        product = product_result.scalar_one_or_none()
        
        item_dict = {
            'id': item.id,
            'board_id': item.board_id,
            'product_id': item.product_id,
            'quantity': item.quantity,
            'notes': item.notes,
            'section': item.section,
            'position': item.position,
            'added_at': item.added_at,
            'product': product
        }
        item_list.append(item_dict)
    
    # Return board as dict
    return {
        'id': board.id,
        'customer_id': board.customer_id,
        'board_name': board.board_name,
        'event_date': board.event_date,
        'event_type': board.event_type,
        'rental_start_date': board.rental_start_date,
        'rental_end_date': board.rental_end_date,
        'rental_days': board.rental_days,
        'status': board.status,
        'notes': board.notes,
        'cover_image': board.cover_image,
        'budget': board.budget,
        'estimated_total': board.estimated_total,
        'canvas_layout': board.canvas_layout,
        'created_at': board.created_at,
        'updated_at': board.updated_at,
        'converted_to_order_id': board.converted_to_order_id,
        'items': item_list
    }

@api_router.patch("/boards/{board_id}", response_model=EventBoardResponse)
async def update_event_board(
    board_id: str,
    board_data: EventBoardUpdate,
    current_user: Customer = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Оновити мудборд"""
    
    result = await db.execute(
        select(EventBoard).where(
            and_(
                EventBoard.id == board_id,
                EventBoard.customer_id == current_user.customer_id
            )
        )
    )
    board = result.scalar_one_or_none()
    
    if not board:
        raise HTTPException(status_code=404, detail="Event board not found")
    
    # Update fields
    update_data = board_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(board, field, value)
    
    # Recalculate rental days if dates changed
    if board.rental_start_date and board.rental_end_date:
        board.rental_days = (board.rental_end_date - board.rental_start_date).days + 1
    
    board.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(board)
    
    # Load items
    items_result = await db.execute(
        select(EventBoardItem).where(EventBoardItem.board_id == board.id)
    )
    items = items_result.scalars().all()
    
    # Load product details
    item_list = []
    for item in items:
        product_result = await db.execute(
            select(Product).where(Product.product_id == item.product_id)
        )
        product = product_result.scalar_one_or_none()
        
        item_dict = {
            'id': item.id,
            'board_id': item.board_id,
            'product_id': item.product_id,
            'quantity': item.quantity,
            'notes': item.notes,
            'section': item.section,
            'position': item.position,
            'added_at': item.added_at,
            'product': product
        }
        item_list.append(item_dict)
    
    # Return board as dict
    return {
        'id': board.id,
        'customer_id': board.customer_id,
        'board_name': board.board_name,
        'event_date': board.event_date,
        'event_type': board.event_type,
        'rental_start_date': board.rental_start_date,
        'rental_end_date': board.rental_end_date,
        'rental_days': board.rental_days,
        'status': board.status,
        'notes': board.notes,
        'cover_image': board.cover_image,
        'budget': board.budget,
        'estimated_total': board.estimated_total,
        'canvas_layout': board.canvas_layout,
        'created_at': board.created_at,
        'updated_at': board.updated_at,
        'converted_to_order_id': board.converted_to_order_id,
        'items': item_list
    }

@api_router.delete("/boards/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event_board(
    board_id: str,
    current_user: Customer = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Видалити мудборд"""
    
    result = await db.execute(
        select(EventBoard).where(
            and_(
                EventBoard.id == board_id,
                EventBoard.customer_id == current_user.customer_id
            )
        )
    )
    board = result.scalar_one_or_none()
    
    if not board:
        raise HTTPException(status_code=404, detail="Event board not found")
    
    await db.delete(board)
    await db.commit()
    
    logger.info(f"Event board deleted: {board_id}")
    return

# ============================================================================
# EVENT BOARD ITEMS ENDPOINTS
# ============================================================================

@api_router.post("/boards/{board_id}/items", response_model=EventBoardItemResponse, status_code=status.HTTP_201_CREATED)
async def add_item_to_board(
    board_id: str,
    item_data: EventBoardItemCreate,
    current_user: Customer = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Додати товар до мудборду"""
    
    # Check if board exists and belongs to user
    board_result = await db.execute(
        select(EventBoard).where(
            and_(
                EventBoard.id == board_id,
                EventBoard.customer_id == current_user.customer_id
            )
        )
    )
    board = board_result.scalar_one_or_none()
    
    if not board:
        raise HTTPException(status_code=404, detail="Event board not found")
    
    # Check if product exists
    product_result = await db.execute(
        select(Product).where(Product.product_id == item_data.product_id)
    )
    product = product_result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if item already exists in board
    existing_item_result = await db.execute(
        select(EventBoardItem).where(
            and_(
                EventBoardItem.board_id == board_id,
                EventBoardItem.product_id == item_data.product_id
            )
        )
    )
    existing_item = existing_item_result.scalar_one_or_none()
    
    if existing_item:
        # Update quantity
        existing_item.quantity += item_data.quantity
        existing_item.notes = item_data.notes or existing_item.notes
        existing_item.section = item_data.section or existing_item.section
        await db.commit()
        await db.refresh(existing_item)
        
        # Create/update soft reservation if dates are set
        if board.rental_start_date and board.rental_end_date:
            await _create_or_update_soft_reservation(
                db, board, product, existing_item.quantity, current_user.customer_id
            )
        
        # Return as dict
        return {
            'id': existing_item.id,
            'board_id': existing_item.board_id,
            'product_id': existing_item.product_id,
            'quantity': existing_item.quantity,
            'notes': existing_item.notes,
            'section': existing_item.section,
            'position': existing_item.position,
            'added_at': existing_item.added_at,
            'product': product
        }
    
    # Create new item
    new_item = EventBoardItem(
        id=str(uuid.uuid4()),
        board_id=board_id,
        product_id=item_data.product_id,
        quantity=item_data.quantity,
        notes=item_data.notes,
        section=item_data.section,
        position=0,
        added_at=datetime.utcnow()
    )
    
    db.add(new_item)
    
    # Update board estimated total
    if product.rental_price and board.rental_days:
        board.estimated_total = (board.estimated_total or 0) + (product.rental_price * item_data.quantity * board.rental_days)
    
    board.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(new_item)
    
    # Create soft reservation if dates are set
    if board.rental_start_date and board.rental_end_date:
        await _create_or_update_soft_reservation(
            db, board, product, new_item.quantity, current_user.customer_id
        )
    
    logger.info(f"Item added to board: {board_id}, product: {item_data.product_id}")
    
    # Return as dict
    return {
        'id': new_item.id,
        'board_id': new_item.board_id,
        'product_id': new_item.product_id,
        'quantity': new_item.quantity,
        'notes': new_item.notes,
        'section': new_item.section,
        'position': new_item.position,
        'added_at': new_item.added_at,
        'product': product
    }

@api_router.patch("/boards/{board_id}/items/{item_id}", response_model=EventBoardItemResponse)
async def update_board_item(
    board_id: str,
    item_id: str,
    item_data: EventBoardItemUpdate,
    current_user: Customer = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Оновити товар в мудборді"""
    
    # Check board ownership
    board_result = await db.execute(
        select(EventBoard).where(
            and_(
                EventBoard.id == board_id,
                EventBoard.customer_id == current_user.customer_id
            )
        )
    )
    board = board_result.scalar_one_or_none()
    
    if not board:
        raise HTTPException(status_code=404, detail="Event board not found")
    
    # Get item
    item_result = await db.execute(
        select(EventBoardItem).where(
            and_(
                EventBoardItem.id == item_id,
                EventBoardItem.board_id == board_id
            )
        )
    )
    item = item_result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Update fields
    update_data = item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
    
    board.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(item)
    
    # Load product
    product_result = await db.execute(
        select(Product).where(Product.product_id == item.product_id)
    )
    product = product_result.scalar_one_or_none()
    
    # Update soft reservation
    if board.rental_start_date and board.rental_end_date:
        await _create_or_update_soft_reservation(
            db, board, product, item.quantity, current_user.customer_id
        )
    
    logger.info(f"Item {item_id} quantity updated to {item.quantity} in board {board_id}")
    
    # Return as dict
    return {
        'id': item.id,
        'board_id': item.board_id,
        'product_id': item.product_id,
        'quantity': item.quantity,
        'notes': item.notes,
        'section': item.section,
        'position': item.position,
        'added_at': item.added_at,
        'product': product
    }

@api_router.delete("/boards/{board_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_board_item(
    board_id: str,
    item_id: str,
    current_user: Customer = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Видалити товар з мудборду"""
    
    # Check board ownership
    board_result = await db.execute(
        select(EventBoard).where(
            and_(
                EventBoard.id == board_id,
                EventBoard.customer_id == current_user.customer_id
            )
        )
    )
    board = board_result.scalar_one_or_none()
    
    if not board:
        raise HTTPException(status_code=404, detail="Event board not found")
    
    # Get item
    item_result = await db.execute(
        select(EventBoardItem).where(
            and_(
                EventBoardItem.id == item_id,
                EventBoardItem.board_id == board_id
            )
        )
    )
    item = item_result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Delete associated soft reservation
    soft_reservation_result = await db.execute(
        select(SoftReservation).where(
            and_(
                SoftReservation.board_id == board_id,
                SoftReservation.product_id == item.product_id
            )
        )
    )
    soft_reservation = soft_reservation_result.scalar_one_or_none()
    
    if soft_reservation:
        await db.delete(soft_reservation)
        logger.info(f"Soft reservation deleted for product {item.product_id} from board {board_id}")
    
    await db.delete(item)
    board.updated_at = datetime.utcnow()
    await db.commit()
    
    logger.info(f"Item {item_id} deleted from board {board_id}")
    
    return

# Helper function
async def _create_or_update_soft_reservation(
    db: AsyncSession,
    board: EventBoard,
    product: Product,
    quantity: int,
    customer_id: int
):
    """Create or update soft reservation"""
    
    result = await db.execute(
        select(SoftReservation).where(
            and_(
                SoftReservation.board_id == board.id,
                SoftReservation.product_id == product.product_id
            )
        )
    )
    reservation = result.scalar_one_or_none()
    
    expires_at = datetime.utcnow() + timedelta(minutes=int(os.getenv('SOFT_RESERVATION_MINUTES', '30')))
    
    if reservation:
        old_quantity = reservation.quantity
        reservation.quantity = quantity
        reservation.reserved_from = board.rental_start_date
        reservation.reserved_until = board.rental_end_date
        reservation.expires_at = expires_at
        reservation.status = 'active'
        logger.info(f"Soft reservation updated: product {product.product_id}, quantity {old_quantity} → {quantity}")
    else:
        reservation = SoftReservation(
            id=str(uuid.uuid4()),
            board_id=board.id,
            product_id=product.product_id,
            quantity=quantity,
            reserved_from=board.rental_start_date,
            reserved_until=board.rental_end_date,
            expires_at=expires_at,
            customer_id=customer_id,
            status='active',
            created_at=datetime.utcnow()
        )
        db.add(reservation)
        logger.info(f"Soft reservation created: product {product.product_id}, quantity {quantity}")
    
    await db.commit()

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

# Include router
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
