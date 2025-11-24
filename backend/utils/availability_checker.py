"""
Utility для перевірки доступності товарів
Використовується в різних частинах системи для консистентної логіки
"""
from sqlalchemy import text
from typing import List, Dict, Optional

def check_product_availability(
    db,
    product_id: int,
    quantity: int,
    start_date: str,
    end_date: str,
    exclude_order_id: Optional[int] = None
) -> Dict:
    """
    Перевірити доступність товару на період
    
    Логіка заморожування:
    - ЗАМОРОЖЕНО: orders.status IN ('processing', 'ready_for_issue', 'issued', 'on_rent')
    - РОЗМОРОЖЕНО: orders.status IN ('returned', 'cancelled', 'completed')
    
    Returns:
        {
            "product_id": int,
            "sku": str,
            "product_name": str,
            "total_quantity": int,
            "reserved_quantity": int,
            "available_quantity": int,
            "requested_quantity": int,
            "is_available": bool
        }
    """
    # Отримати загальну кількість, SKU та назву
    total_result = db.execute(text("""
        SELECT quantity, sku, name FROM products WHERE product_id = :product_id
    """), {"product_id": product_id})
    total_row = total_result.fetchone()
    total_result.close()  # Закрити результат
    
    total_qty = int(total_row[0]) if total_row else 0
    sku = total_row[1] if total_row else None
    product_name = total_row[2] if total_row else None
    
    # Підрахувати зарезервовані (заморожені) товари
    # ВАЖЛИВО: Товари 'issued'/'on_rent' блокують ВСЕ після rental_start_date
    query = """
        SELECT COALESCE(SUM(oi.quantity), 0) as reserved
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        WHERE oi.product_id = :product_id
        AND (
            (o.status IN ('processing', 'ready_for_issue') 
             AND o.rental_start_date <= :end_date 
             AND o.rental_end_date >= :start_date)
            OR
            (o.status IN ('issued', 'on_rent')
             AND o.rental_start_date <= :end_date)
        )
    """
    
    params = {
        "product_id": product_id,
        "start_date": start_date,
        "end_date": end_date
    }
    
    # Виключити поточне замовлення (якщо потрібно)
    if exclude_order_id:
        query += " AND o.order_id != :exclude_order_id"
        params["exclude_order_id"] = exclude_order_id
    
    reserved_result = db.execute(text(query), params)
    reserved_qty = int(reserved_result.fetchone()[0])
    reserved_result.close()  # Закрити результат
    
    # Підрахувати кількість товару що саме "в оренді" (статус issued або on_rent)
    # Ці товари блокують ВСЕ, поки не будуть повернуті
    on_rent_query = """
        SELECT COALESCE(SUM(oi.quantity), 0) as on_rent
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        WHERE oi.product_id = :product_id
        AND o.status IN ('issued', 'on_rent')
    """
    
    on_rent_params = {
        "product_id": product_id
    }
    
    if exclude_order_id:
        on_rent_query += " AND o.order_id != :exclude_order_id"
        on_rent_params["exclude_order_id"] = exclude_order_id
    
    on_rent_result = db.execute(text(on_rent_query), on_rent_params)
    on_rent_qty = int(on_rent_result.fetchone()[0])
    on_rent_result.close()  # Закрити результат
    
    # Отримати список замовлень що блокують товар
    blocking_orders_query = """
        SELECT o.order_id, o.order_number, o.status, o.rental_start_date, o.rental_end_date, oi.quantity
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        WHERE oi.product_id = :product_id
        AND (
            (o.status IN ('processing', 'ready_for_issue') 
             AND o.rental_start_date <= :end_date 
             AND o.rental_end_date >= :start_date)
            OR
            (o.status IN ('issued', 'on_rent'))
        )
    """
    
    blocking_params = {
        "product_id": product_id,
        "start_date": start_date,
        "end_date": end_date
    }
    
    if exclude_order_id:
        blocking_orders_query += " AND o.order_id != :exclude_order_id"
        blocking_params["exclude_order_id"] = exclude_order_id
    
    blocking_result = db.execute(text(blocking_orders_query), blocking_params)
    blocking_orders = []
    for row in blocking_result:
        blocking_orders.append({
            "order_id": row[0],
            "order_number": row[1],
            "status": row[2],
            "rental_start_date": row[3].isoformat() if row[3] else None,
            "rental_end_date": row[4].isoformat() if row[4] else None,
            "quantity": row[5]
        })
    blocking_result.close()
    
    available_qty = max(0, total_qty - reserved_qty)
    is_available = available_qty >= quantity
    
    return {
        "product_id": product_id,
        "sku": sku,
        "product_name": product_name,
        "total_quantity": total_qty,
        "reserved_quantity": reserved_qty,
        "in_rent": on_rent_qty,
        "available_quantity": available_qty,
        "requested_quantity": quantity,
        "is_available": is_available,
        "blocking_orders": blocking_orders
    }


def check_order_availability(
    db,
    items: List[Dict],
    start_date: str,
    end_date: str,
    exclude_order_id: Optional[int] = None
) -> Dict:
    """
    Перевірити доступність для всіх товарів замовлення
    
    Args:
        items: [{product_id, quantity}, ...]
        start_date: YYYY-MM-DD
        end_date: YYYY-MM-DD
        exclude_order_id: ID замовлення для виключення (при оновленні)
    
    Returns:
        {
            "all_available": bool,
            "items": [...],
            "unavailable_items": [...]
        }
    """
    results = []
    unavailable = []
    
    for item in items:
        result = check_product_availability(
            db,
            product_id=item["product_id"],
            quantity=item["quantity"],
            start_date=start_date,
            end_date=end_date,
            exclude_order_id=exclude_order_id
        )
        
        results.append(result)
        
        if not result["is_available"]:
            unavailable.append(result)
    
    return {
        "all_available": len(unavailable) == 0,
        "items": results,
        "unavailable_items": unavailable
    }
