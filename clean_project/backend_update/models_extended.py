"""
Additional models for Issue Cards, Return Cards, and Photos
"""
from sqlalchemy import Column, Integer, String, Text, DECIMAL, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.sql import func
from database import Base


class DecorIssueCard(Base):
    """Картка видачі замовлення"""
    __tablename__ = 'decor_issue_cards'
    
    id = Column(String(50), primary_key=True)
    order_id = Column(Integer, nullable=False, index=True)
    order_number = Column(String(50), nullable=False)
    
    # Статус картки
    status = Column(String(20), default='preparation')  # preparation, ready, issued, archived
    
    # Відповідальні особи
    prepared_by = Column(String(100))
    issued_by = Column(String(100))
    
    # Позиції (JSON)
    items = Column(JSON)  # [{sku, name, quantity, status: prepared/ready/issued, photos: []}]
    
    # Коментарі
    preparation_notes = Column(Text)
    issue_notes = Column(Text)
    
    # Дати
    prepared_at = Column(DateTime)
    issued_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class DecorReturnCard(Base):
    """Картка повернення замовлення"""
    __tablename__ = 'decor_return_cards'
    
    id = Column(String(50), primary_key=True)
    order_id = Column(Integer, nullable=False, index=True)
    order_number = Column(String(50), nullable=False)
    issue_card_id = Column(String(50))  # Зв'язок з карткою видачі
    
    # Статус картки
    status = Column(String(20), default='pending')  # pending, active, checking, resolved, closed
    
    # Відповідальні особи
    received_by = Column(String(100))
    checked_by = Column(String(100))
    
    # Позиції (JSON)
    items_expected = Column(JSON)  # [{sku, name, quantity, photos_before: []}]
    items_returned = Column(JSON)  # [{sku, name, quantity_returned, condition, photos_after: [], notes}]
    
    # Статистика
    total_items_expected = Column(Integer, default=0)
    total_items_returned = Column(Integer, default=0)
    items_ok = Column(Integer, default=0)
    items_dirty = Column(Integer, default=0)
    items_damaged = Column(Integer, default=0)
    items_missing = Column(Integer, default=0)
    
    # Додаткові витрати
    cleaning_fee = Column(DECIMAL(10, 2), default=0.00)
    late_fee = Column(DECIMAL(10, 2), default=0.00)
    
    # Коментарі
    return_notes = Column(Text)
    
    # Дати
    returned_at = Column(DateTime)
    checked_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class DecorPhoto(Base):
    """Фото для замовлень, карток, товарів"""
    __tablename__ = 'decor_photos'
    
    id = Column(String(50), primary_key=True)
    
    # Прив'язка до об'єкту
    entity_type = Column(String(50), nullable=False)  # order, issue_card, return_card, damage_case, product
    entity_id = Column(String(50), nullable=False, index=True)
    
    # SKU товару (якщо фото товару)
    sku = Column(String(100))
    
    # Тип фото
    photo_type = Column(String(50))  # before, after, damage, general
    
    # Файл
    filename = Column(String(255), nullable=False)
    filepath = Column(String(500), nullable=False)
    file_size = Column(Integer)  # в байтах
    mime_type = Column(String(50))
    
    # Мета-дані
    caption = Column(Text)
    uploaded_by = Column(String(100))
    
    # Дати
    uploaded_at = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())


class DecorQRCode(Base):
    """QR коди для товарів"""
    __tablename__ = 'decor_qr_codes'
    
    id = Column(String(50), primary_key=True)
    
    # SKU товару
    sku = Column(String(100), nullable=False, unique=True, index=True)
    product_id = Column(Integer)
    
    # QR код
    qr_code_data = Column(Text, nullable=False)  # Дані що кодуються в QR
    qr_image_path = Column(String(500))  # Шлях до зображення QR
    
    # Мета-дані
    generated_by = Column(String(100))
    times_scanned = Column(Integer, default=0)
    last_scanned_at = Column(DateTime)
    
    # Дати
    generated_at = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
