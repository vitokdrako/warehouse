from sqlalchemy import Column, Integer, String, Text, Date, DateTime, Numeric, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class Customer(Base):
    __tablename__ = 'customers'
    
    customer_id = Column(Integer, primary_key=True, autoincrement=True)
    firstname = Column(String(255))
    lastname = Column(String(255))
    email = Column(String(255), unique=True, index=True)
    telephone = Column(String(50))
    password_hash = Column(String(255))
    status = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)
    synced_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    event_boards = relationship('EventBoard', back_populates='customer', cascade='all, delete-orphan')

class Category(Base):
    __tablename__ = 'categories'
    
    category_id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    parent_id = Column(Integer, ForeignKey('categories.category_id'))
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    products = relationship('Product', back_populates='category')

class Product(Base):
    __tablename__ = 'products'
    
    product_id = Column(Integer, primary_key=True)
    sku = Column(String(100), index=True)
    name = Column(String(500))
    category_id = Column(Integer, ForeignKey('categories.category_id'))
    category_name = Column(String(255))
    subcategory_id = Column(Integer)
    subcategory_name = Column(String(255))
    description = Column(Text)
    care_instructions = Column(Text)
    color = Column(String(100))
    material = Column(String(100))
    size = Column(String(100))
    price = Column(Numeric(10, 2))
    rental_price = Column(Numeric(10, 2))
    status = Column(Integer, default=1, index=True)
    quantity = Column(Integer, default=0)
    frozen_quantity = Column(Integer, default=0)
    image_url = Column(String(500))
    zone = Column(String(50))
    aisle = Column(String(50))
    shelf = Column(String(50))
    cleaning_status = Column(String(50))
    product_state = Column(String(50))
    last_audit_date = Column(Date)
    family_id = Column(Integer, ForeignKey('product_families.id'))
    synced_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    category = relationship('Category', back_populates='products')
    tags = relationship('ProductTag', back_populates='product')
    event_board_items = relationship('EventBoardItem', back_populates='product')

class ProductTag(Base):
    __tablename__ = 'product_tags'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey('products.product_id', ondelete='CASCADE'), nullable=False)
    tag = Column(String(100), nullable=False, index=True)
    tag_type = Column(String(50), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    product = relationship('Product', back_populates='tags')

class ProductFamily(Base):
    __tablename__ = 'product_families'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class EventBoard(Base):
    __tablename__ = 'event_boards'
    
    id = Column(String(36), primary_key=True)
    customer_id = Column(Integer, ForeignKey('customers.customer_id', ondelete='CASCADE'), nullable=False)
    board_name = Column(String(255), nullable=False)
    event_date = Column(Date)
    event_type = Column(String(100))
    rental_start_date = Column(Date)
    rental_end_date = Column(Date)
    rental_days = Column(Integer)
    status = Column(String(50), default='draft', index=True)
    notes = Column(Text)
    cover_image = Column(String(500))
    budget = Column(Numeric(10, 2))
    estimated_total = Column(Numeric(10, 2), default=0.00)
    canvas_layout = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    converted_to_order_id = Column(Integer)
    
    # Relationships
    customer = relationship('Customer', back_populates='event_boards', lazy='raise')
    items = relationship('EventBoardItem', back_populates='board', cascade='all, delete-orphan', lazy='raise')
    soft_reservations = relationship('SoftReservation', back_populates='board', cascade='all, delete-orphan', lazy='raise')

class EventBoardItem(Base):
    __tablename__ = 'event_board_items'
    
    id = Column(String(36), primary_key=True)
    board_id = Column(String(36), ForeignKey('event_boards.id', ondelete='CASCADE'), nullable=False)
    product_id = Column(Integer, ForeignKey('products.product_id', ondelete='CASCADE'), nullable=False)
    quantity = Column(Integer, default=1)
    notes = Column(Text)
    section = Column(String(100), index=True)
    position = Column(Integer, default=0)
    added_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    board = relationship('EventBoard', back_populates='items', lazy='raise')
    product = relationship('Product', back_populates='event_board_items', lazy='raise')

class SoftReservation(Base):
    __tablename__ = 'soft_reservations'
    
    id = Column(String(36), primary_key=True)
    board_id = Column(String(36), ForeignKey('event_boards.id', ondelete='CASCADE'), nullable=False)
    product_id = Column(Integer, ForeignKey('products.product_id', ondelete='CASCADE'), nullable=False)
    quantity = Column(Integer, nullable=False)
    reserved_from = Column(Date, nullable=False, index=True)
    reserved_until = Column(Date, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey('customers.customer_id', ondelete='CASCADE'), nullable=False)
    status = Column(String(20), default='active', index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    board = relationship('EventBoard', back_populates='soft_reservations')

class ProductReservation(Base):
    __tablename__ = 'product_reservations'
    
    id = Column(String(36), primary_key=True)
    product_id = Column(Integer, ForeignKey('products.product_id'), nullable=False, index=True)
    sku = Column(String(255), index=True)
    order_id = Column(Integer, nullable=False, index=True)
    order_number = Column(String(50))
    quantity = Column(Integer, nullable=False, default=1)
    reserved_from = Column(Date, nullable=False, index=True)
    reserved_until = Column(Date, nullable=False)
    status = Column(String(20), default='active', index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    released_at = Column(DateTime)

class RefreshToken(Base):
    __tablename__ = 'refresh_tokens'
    
    id = Column(String(36), primary_key=True)
    customer_id = Column(Integer, ForeignKey('customers.customer_id', ondelete='CASCADE'), nullable=False)
    token_hash = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked = Column(Boolean, default=False)