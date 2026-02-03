"""
Dashboard Overview API - єдиний ендпоінт для всіх даних дашборду
Замість 6-8 окремих запитів - один швидкий
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta
import json

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/manager/dashboard", tags=["dashboard"])


def parse_issue_card_simple(row, db: Session):
    """Спрощений парсер issue card для дашборду"""
    items = []
    if row[6]:  # items JSON column
        try:
            items = json.loads(row[6]) if isinstance(row[6], str) else row[6]
        except:
            items = []
    
    # Отримати дані замовлення
    order_data = {}
    if row[1]:  # order_id
        order_result = db.execute(text("""
            SELECT customer_name, customer_phone, customer_email,
                   total_price, deposit_amount, rental_days,
                   rental_start_date, rental_end_date, status
            FROM orders WHERE order_id = :order_id
        """), {"order_id": row[1]})
        order_row = order_result.fetchone()
        if order_row:
            order_data = {
                "customer_name": order_row[0],
                "customer_phone": order_row[1],
                "customer_email": order_row[2],
                "total_rental": float(order_row[3]) if order_row[3] else 0.0,
                "deposit_amount": float(order_row[4]) if order_row[4] else 0.0,
                "rental_days": order_row[5] or 0,
                "rental_start_date": order_row[6].strftime('%Y-%m-%d') if order_row[6] else None,
                "rental_end_date": order_row[7].strftime('%Y-%m-%d') if order_row[7] else None,
                "order_status": order_row[8]
            }
    
    return {
        "id": row[0],
        "order_id": row[1],
        "order_number": row[2],
        "status": row[3],
        "prepared_by": row[4],
        "issued_by": row[5],
        "items": items,
        "items_count": len(items),
        "preparation_notes": row[7] if len(row) > 7 else None,
        "issue_notes": row[8] if len(row) > 8 else None,
        "prepared_at": row[9].isoformat() if len(row) > 9 and row[9] else None,
        "issued_at": row[10].isoformat() if len(row) > 10 and row[10] else None,
        "created_at": row[11].isoformat() if len(row) > 11 and row[11] else None,
        **order_data
    }


@router.get("/overview")
async def get_dashboard_overview(
    date: str = "today",
    db: Session = Depends(get_rh_db)
):
    """
    Єдиний ендпоінт для всіх даних дашборду.
    Повертає все необхідне в одному запиті.
    """
    try:
        result = {
            "orders_awaiting": [],
            "decor_orders": [],
            "issue_cards": [],
            "finance_summary": {},
            "cleaning_stats": {},
            "timestamp": datetime.now().isoformat()
        }
        
        # 1. Orders awaiting customer confirmation
        try:
            awaiting_result = db.execute(text("""
                SELECT order_id, order_number, customer_name, customer_phone,
                       total_price, deposit_amount, status, created_at,
                       rental_start_date, rental_end_date, rental_days,
                       delivery_type, city, event_type, source,
                       COALESCE(discount_amount, 0) as discount_amount,
                       COALESCE(discount_percent, 0) as discount_percent
                FROM orders 
                WHERE status = 'awaiting_customer' AND is_archived = 0
                ORDER BY created_at DESC
                LIMIT 50
            """))
            
            for row in awaiting_result:
                discount = float(row[15] or 0)
                total_after_discount = float(row[4] or 0) - discount
                result["orders_awaiting"].append({
                    "order_id": row[0],
                    "order_number": row[1],
                    "customer_name": row[2],
                    "customer_phone": row[3],
                    "total_price": float(row[4] or 0),
                    "total_after_discount": total_after_discount,
                    "discount_amount": discount,
                    "discount_percent": float(row[16] or 0),
                    "deposit_amount": float(row[5] or 0),
                    "status": row[6],
                    "created_at": row[7].isoformat() if row[7] else None,
                    "rental_start_date": str(row[8]) if row[8] else None,
                    "rental_end_date": str(row[9]) if row[9] else None,
                    "rental_days": row[10],
                    "delivery_type": row[11],
                    "city": row[12],
                    "event_type": row[13],
                    "source": row[14]
                })
        except Exception as e:
            print(f"[Dashboard] Error loading awaiting orders: {e}")
        
        # 2. Active decor orders (processing, ready_for_issue, issued, etc.)
        try:
            decor_result = db.execute(text("""
                SELECT order_id, order_number, customer_name, customer_phone,
                       total_price, deposit_amount, status, created_at,
                       rental_start_date, rental_end_date, rental_days,
                       delivery_type, city, event_type, issue_date, return_date,
                       COALESCE(discount_amount, 0) as discount_amount,
                       COALESCE(discount_percent, 0) as discount_percent
                FROM orders 
                WHERE status IN ('processing', 'ready_for_issue', 'issued', 'on_rent', 'shipped', 'delivered', 'returning')
                AND is_archived = 0
                ORDER BY 
                    CASE status 
                        WHEN 'returning' THEN 1
                        WHEN 'issued' THEN 2
                        WHEN 'ready_for_issue' THEN 3
                        WHEN 'processing' THEN 4
                        ELSE 5
                    END,
                    created_at DESC
                LIMIT 100
            """))
            
            for row in decor_result:
                discount = float(row[16] or 0)
                total_after_discount = float(row[4] or 0) - discount
                result["decor_orders"].append({
                    "order_id": row[0],
                    "order_number": row[1],
                    "customer_name": row[2],
                    "customer_phone": row[3],
                    "total_price": float(row[4] or 0),
                    "total_after_discount": total_after_discount,
                    "discount_amount": discount,
                    "discount_percent": float(row[17] or 0),
                    "deposit_amount": float(row[5] or 0),
                    "status": row[6],
                    "created_at": row[7].isoformat() if row[7] else None,
                    "rental_start_date": str(row[8]) if row[8] else None,
                    "rental_end_date": str(row[9]) if row[9] else None,
                    "rental_days": row[10],
                    "delivery_type": row[11],
                    "city": row[12],
                    "event_type": row[13],
                    "issue_date": str(row[14]) if row[14] else None,
                    "return_date": str(row[15]) if row[15] else None
                })
        except Exception as e:
            print(f"[Dashboard] Error loading decor orders: {e}")
        
        # 3. Issue cards (з повними даними замовлення)
        try:
            cards_result = db.execute(text("""
                SELECT ic.* 
                FROM issue_cards ic
                JOIN orders o ON ic.order_id = o.order_id
                WHERE o.status != 'cancelled' 
                AND o.is_archived = 0
                ORDER BY ic.created_at DESC
                LIMIT 100
            """))
            
            for row in cards_result:
                result["issue_cards"].append(parse_issue_card_simple(row, db))
        except Exception as e:
            print(f"[Dashboard] Error loading issue cards: {e}")
        
        # 4. Finance summary
        try:
            # Total revenue (completed payments for rent)
            revenue_result = db.execute(text("""
                SELECT COALESCE(SUM(amount), 0) 
                FROM fin_payments 
                WHERE payment_type = 'rent' AND status IN ('completed', 'confirmed')
            """))
            rent_paid = float(revenue_result.fetchone()[0] or 0)
            
            # Active deposits count
            deposits_result = db.execute(text("""
                SELECT COUNT(*) 
                FROM fin_deposit_holds 
                WHERE status IN ('holding', 'partially_used')
            """))
            deposits_count = deposits_result.fetchone()[0] or 0
            
            result["finance_summary"] = {
                "total_revenue": rent_paid,
                "rent_paid": rent_paid,
                "deposits_count": deposits_count
            }
        except Exception as e:
            print(f"[Dashboard] Error loading finance: {e}")
            result["finance_summary"] = {"total_revenue": 0, "rent_paid": 0, "deposits_count": 0}
        
        # 5. Cleaning stats
        try:
            cleaning_result = db.execute(text("""
                SELECT COUNT(*) 
                FROM product_cleaning 
                WHERE status = 'in_progress' AND cleaning_type = 'repair'
            """))
            repair_count = cleaning_result.fetchone()[0] or 0
            
            result["cleaning_stats"] = {
                "repair": repair_count
            }
        except Exception as e:
            print(f"[Dashboard] Error loading cleaning stats: {e}")
            result["cleaning_stats"] = {"repair": 0}
        
        return result
        
    except Exception as e:
        print(f"[Dashboard] Critical error: {e}")
        return {
            "orders_awaiting": [],
            "decor_orders": [],
            "issue_cards": [],
            "finance_summary": {"total_revenue": 0, "rent_paid": 0, "deposits_count": 0},
            "cleaning_stats": {"repair": 0},
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
