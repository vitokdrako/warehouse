"""
Universal Calendar Events API
Єдиний endpoint для всіх подій системи - дзеркало операцій
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta
from typing import List, Optional
import json

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/calendar", tags=["calendar"])

# ============================================================
# ТИПИ ПОДІЙ
# ============================================================
EVENT_TYPES = {
    # Замовлення
    "issue": {"label": "Видача", "color": "#22c55e", "icon": "📤", "group": "orders"},
    "return": {"label": "Повернення", "color": "#eab308", "icon": "📥", "group": "orders"},
    "on_rent": {"label": "В оренді", "color": "#3b82f6", "icon": "📦", "group": "orders"},
    "awaiting": {"label": "Очікує підтвердження", "color": "#8b5cf6", "icon": "⏳", "group": "orders"},
    
    # Операції
    "packing": {"label": "Комплектація", "color": "#f59e0b", "icon": "📋", "group": "operations"},
    "ready_issue": {"label": "Готово до видачі", "color": "#10b981", "icon": "✅", "group": "operations"},
    
    # Обслуговування
    "cleaning": {"label": "Мийка", "color": "#06b6d4", "icon": "🧹", "group": "maintenance"},
    "laundry": {"label": "Прання", "color": "#0ea5e9", "icon": "🧺", "group": "maintenance"},
    "repair": {"label": "Реставрація", "color": "#f97316", "icon": "🔧", "group": "maintenance"},
    
    # Проблеми
    "damage": {"label": "Шкода", "color": "#ef4444", "icon": "⚠️", "group": "issues"},
    "overdue": {"label": "Прострочено", "color": "#dc2626", "icon": "🚨", "group": "issues"},
    
    # Фінанси
    "payment_due": {"label": "Очікується оплата", "color": "#a855f7", "icon": "💰", "group": "finance"},
    "payment_received": {"label": "Оплата отримана", "color": "#22c55e", "icon": "💵", "group": "finance"},
    "deposit_hold": {"label": "Застава утримана", "color": "#6366f1", "icon": "🔒", "group": "finance"},
    "deposit_return": {"label": "Повернення застави", "color": "#14b8a6", "icon": "🔓", "group": "finance"},
    
    # Завдання
    "task": {"label": "Завдання", "color": "#8b5cf6", "icon": "📝", "group": "tasks"},
}

EVENT_GROUPS = {
    "orders": {"label": "Замовлення", "icon": "📦"},
    "operations": {"label": "Операції", "icon": "⚙️"},
    "maintenance": {"label": "Обслуговування", "icon": "🔧"},
    "issues": {"label": "Проблеми", "icon": "⚠️"},
    "finance": {"label": "Фінанси", "icon": "💰"},
    "tasks": {"label": "Завдання", "icon": "📝"},
}


@router.get("/event-types")
async def get_event_types():
    """Отримати всі типи подій з метаданими"""
    return {
        "types": EVENT_TYPES,
        "groups": EVENT_GROUPS
    }


@router.get("/events")
async def get_calendar_events(
    date_from: str = Query(..., description="Start date YYYY-MM-DD"),
    date_to: str = Query(..., description="End date YYYY-MM-DD"),
    types: Optional[str] = Query(None, description="Comma-separated event types"),
    groups: Optional[str] = Query(None, description="Comma-separated groups"),
    search: Optional[str] = Query(None, description="Search query"),
    db: Session = Depends(get_rh_db)
):
    """
    Універсальний endpoint для всіх подій календаря.
    Агрегує дані з усіх частин системи.
    """
    events = []
    
    # Парсимо фільтри
    type_filter = set(types.split(",")) if types else None
    group_filter = set(groups.split(",")) if groups else None
    
    def should_include(event_type: str) -> bool:
        if type_filter and event_type not in type_filter:
            return False
        if group_filter:
            event_group = EVENT_TYPES.get(event_type, {}).get("group")
            if event_group not in group_filter:
                return False
        return True
    
    # ============================================================
    # 1. ЗАМОВЛЕННЯ - Видача, Повернення, В оренді
    # ============================================================
    try:
        orders_query = """
            SELECT 
                o.order_id, o.order_number, o.customer_name, o.customer_phone,
                o.status, o.total_price, o.deposit_amount,
                o.rental_start_date, o.rental_end_date, o.rental_days,
                o.issue_date, o.return_date, o.delivery_type, o.city,
                o.event_type as order_event_type, o.created_at
            FROM orders o
            WHERE o.is_archived = 0
            AND (
                (o.rental_start_date BETWEEN :date_from AND :date_to)
                OR (o.rental_end_date BETWEEN :date_from AND :date_to)
                OR (o.issue_date BETWEEN :date_from AND :date_to)
                OR (o.return_date BETWEEN :date_from AND :date_to)
                OR (o.rental_start_date <= :date_from AND o.rental_end_date >= :date_to)
            )
            ORDER BY o.rental_start_date
        """
        
        orders_result = db.execute(text(orders_query), {
            "date_from": date_from,
            "date_to": date_to
        })
        
        for row in orders_result:
            order_id = row[0]
            order_number = row[1]
            customer_name = row[2]
            customer_phone = row[3]
            status = row[4]
            total_price = float(row[5] or 0)
            deposit = float(row[6] or 0)
            start_date = row[7]
            end_date = row[8]
            rental_days = row[9]
            issue_date = row[10]
            return_date = row[11]
            delivery_type = row[12]
            city = row[13]
            event_type = row[14]
            created_at = row[15]
            
            base_event = {
                "order_id": order_id,
                "order_number": order_number,
                "customer_name": customer_name,
                "customer_phone": customer_phone,
                "total_price": total_price,
                "deposit": deposit,
                "delivery_type": delivery_type,
                "city": city,
                "rental_days": rental_days,
                "order_status": status,
                "order_event_type": event_type,
            }
            
            # Очікує підтвердження
            if status == "awaiting_customer" and should_include("awaiting"):
                events.append({
                    **base_event,
                    "id": f"order-awaiting-{order_id}",
                    "type": "awaiting",
                    "date": str(start_date) if start_date else str(created_at)[:10],
                    "date_end": str(end_date) if end_date else None,
                    "title": f"#{order_number} {customer_name}",
                    "subtitle": f"Очікує підтвердження · ₴{total_price:,.0f}",
                    "priority": 1,
                })
            
            # Видача
            issue_dt = issue_date or start_date
            if issue_dt and should_include("issue"):
                issue_str = str(issue_dt)
                if date_from <= issue_str <= date_to:
                    events.append({
                        **base_event,
                        "id": f"order-issue-{order_id}",
                        "type": "issue" if status in ("ready_for_issue", "processing") else "ready_issue",
                        "date": issue_str,
                        "title": f"#{order_number} {customer_name}",
                        "subtitle": f"Видача · {delivery_type or 'самовивіз'}",
                        "priority": 2 if status == "ready_for_issue" else 3,
                    })
            
            # Повернення
            return_dt = return_date or end_date
            if return_dt and should_include("return"):
                return_str = str(return_dt)
                if date_from <= return_str <= date_to:
                    is_overdue = return_str < date_from and status == "issued"
                    events.append({
                        **base_event,
                        "id": f"order-return-{order_id}",
                        "type": "overdue" if is_overdue else "return",
                        "date": return_str,
                        "title": f"#{order_number} {customer_name}",
                        "subtitle": f"Повернення · {rental_days or '?'} дн.",
                        "priority": 1 if is_overdue else 2,
                    })
            
            # В оренді (діапазон) - ПРИБРАНО: дублює повернення
            # if status == "issued" and start_date and end_date and should_include("on_rent"):
            #     events.append({...})
                
    except Exception as e:
        print(f"[Calendar] Error loading orders: {e}")
    
    # ============================================================
    # 2. ISSUE CARDS - Комплектація
    # ============================================================
    if should_include("packing") or should_include("ready_issue"):
        try:
            cards_query = """
                SELECT 
                    ic.id, ic.order_id, ic.order_number, ic.status,
                    ic.prepared_at, ic.issued_at, ic.created_at,
                    o.customer_name, o.rental_start_date
                FROM issue_cards ic
                LEFT JOIN orders o ON ic.order_id = o.order_id
                WHERE ic.status IN ('pending', 'preparing', 'ready')
                AND (
                    DATE(ic.created_at) BETWEEN :date_from AND :date_to
                    OR DATE(o.rental_start_date) BETWEEN :date_from AND :date_to
                )
            """
            
            cards_result = db.execute(text(cards_query), {
                "date_from": date_from,
                "date_to": date_to
            })
            
            for row in cards_result:
                card_date = row[8] or row[6]  # rental_start_date or created_at
                if card_date:
                    event_type = "ready_issue" if row[3] == "ready" else "packing"
                    if should_include(event_type):
                        events.append({
                            "id": f"card-{row[0]}",
                            "type": event_type,
                            "date": str(card_date)[:10],
                            "title": f"#{row[2]} {row[7] or ''}",
                            "subtitle": f"Комплектація · {row[3]}",
                            "order_id": row[1],
                            "order_number": row[2],
                            "card_id": row[0],
                            "card_status": row[3],
                            "priority": 2,
                        })
        except Exception as e:
            print(f"[Calendar] Error loading issue cards: {e}")
    
    # ============================================================
    # 3. CLEANING / LAUNDRY - Мийка, Прання, Реставрація
    # ============================================================
    if should_include("cleaning") or should_include("laundry") or should_include("repair"):
        try:
            cleaning_query = """
                SELECT 
                    id, product_id, cleaning_type, status,
                    started_at, completed_at, notes, priority
                FROM product_cleaning
                WHERE status IN ('pending', 'in_progress')
                AND (
                    DATE(started_at) BETWEEN :date_from AND :date_to
                    OR DATE(created_at) BETWEEN :date_from AND :date_to
                )
            """
            
            cleaning_result = db.execute(text(cleaning_query), {
                "date_from": date_from,
                "date_to": date_to
            })
            
            for row in cleaning_result:
                cleaning_type = row[2]
                event_type = "repair" if cleaning_type == "repair" else (
                    "laundry" if cleaning_type == "laundry" else "cleaning"
                )
                
                if should_include(event_type):
                    events.append({
                        "id": f"cleaning-{row[0]}",
                        "type": event_type,
                        "date": str(row[4])[:10] if row[4] else date_from,
                        "title": f"#{row[1]} {cleaning_type}",
                        "subtitle": f"{row[3]} · {row[6] or ''}",
                        "cleaning_id": row[0],
                        "product_id": row[1],
                        "status": row[3],
                        "priority": row[7] or 3,
                    })
        except Exception as e:
            print(f"[Calendar] Error loading cleaning: {e}")
    
    # ============================================================
    # 4. DAMAGE CASES - Шкода
    # ============================================================
    if should_include("damage"):
        try:
            damage_query = """
                SELECT 
                    dc.id, dc.order_id, dc.status, dc.total_damage_amount,
                    dc.created_at, dc.resolved_at,
                    o.order_number, o.customer_name
                FROM damage_cases dc
                LEFT JOIN orders o ON dc.order_id = o.order_id
                WHERE dc.status IN ('open', 'pending_payment', 'in_review')
                AND DATE(dc.created_at) BETWEEN :date_from AND :date_to
            """
            
            damage_result = db.execute(text(damage_query), {
                "date_from": date_from,
                "date_to": date_to
            })
            
            for row in damage_result:
                events.append({
                    "id": f"damage-{row[0]}",
                    "type": "damage",
                    "date": str(row[4])[:10] if row[4] else date_from,
                    "title": f"DMG #{row[6] or row[1]}",
                    "subtitle": f"Шкода ₴{float(row[3] or 0):,.0f} · {row[2]}",
                    "damage_id": row[0],
                    "order_id": row[1],
                    "order_number": row[6],
                    "customer_name": row[7],
                    "amount": float(row[3] or 0),
                    "status": row[2],
                    "priority": 1,
                })
        except Exception as e:
            print(f"[Calendar] Error loading damage cases: {e}")
    
    # ============================================================
    # 5. FINANCE - Платежі, Застави
    # ============================================================
    if should_include("payment_due") or should_include("deposit_return"):
        try:
            # Очікувані платежі
            if should_include("payment_due"):
                payments_query = """
                    SELECT 
                        fp.id, fp.order_id, fp.amount, fp.payment_type, fp.status,
                        fp.created_at, o.order_number, o.customer_name
                    FROM fin_payments fp
                    LEFT JOIN orders o ON fp.order_id = o.order_id
                    WHERE fp.status = 'pending'
                    AND DATE(fp.created_at) BETWEEN :date_from AND :date_to
                """
                
                payments_result = db.execute(text(payments_query), {
                    "date_from": date_from,
                    "date_to": date_to
                })
                
                for row in payments_result:
                    events.append({
                        "id": f"payment-{row[0]}",
                        "type": "payment_due",
                        "date": str(row[5])[:10] if row[5] else date_from,
                        "title": f"#{row[6]} {row[7] or ''}",
                        "subtitle": f"Очікується ₴{float(row[2] or 0):,.0f} · {row[3]}",
                        "payment_id": row[0],
                        "order_id": row[1],
                        "amount": float(row[2] or 0),
                        "payment_type": row[3],
                        "priority": 2,
                    })
            
            # Повернення застав
            if should_include("deposit_return"):
                deposits_query = """
                    SELECT 
                        dh.id, dh.order_id, dh.amount, dh.status,
                        dh.created_at, o.order_number, o.customer_name, o.return_date
                    FROM fin_deposit_holds dh
                    LEFT JOIN orders o ON dh.order_id = o.order_id
                    WHERE dh.status = 'holding'
                    AND o.status = 'returned'
                """
                
                deposits_result = db.execute(text(deposits_query), {
                    "date_from": date_from,
                    "date_to": date_to
                })
                
                for row in deposits_result:
                    event_date = row[7] or row[4]  # return_date or created_at
                    if event_date:
                        events.append({
                            "id": f"deposit-{row[0]}",
                            "type": "deposit_return",
                            "date": str(event_date)[:10],
                            "title": f"#{row[5]} {row[6] or ''}",
                            "subtitle": f"Повернути заставу ₴{float(row[2] or 0):,.0f}",
                            "deposit_id": row[0],
                            "order_id": row[1],
                            "amount": float(row[2] or 0),
                            "priority": 2,
                        })
        except Exception as e:
            print(f"[Calendar] Error loading finance: {e}")
    
    # ============================================================
    # 6. TASKS - Завдання
    # ============================================================
    if should_include("task"):
        try:
            tasks_query = """
                SELECT 
                    id, title, description, status, priority,
                    due_date, created_at, assigned_to
                FROM tasks
                WHERE status NOT IN ('completed', 'cancelled')
                AND (
                    DATE(due_date) BETWEEN :date_from AND :date_to
                    OR DATE(created_at) BETWEEN :date_from AND :date_to
                )
            """
            
            tasks_result = db.execute(text(tasks_query), {
                "date_from": date_from,
                "date_to": date_to
            })
            
            for row in tasks_result:
                task_date = row[5] or row[6]  # due_date or created_at
                if task_date:
                    events.append({
                        "id": f"task-{row[0]}",
                        "type": "task",
                        "date": str(task_date)[:10],
                        "title": row[1] or "Завдання",
                        "subtitle": row[2][:50] if row[2] else row[3],
                        "task_id": row[0],
                        "status": row[3],
                        "priority": row[4] or 3,
                    })
        except Exception as e:
            print(f"[Calendar] Error loading tasks: {e}")
    
    # ============================================================
    # Фільтрація по пошуку
    # ============================================================
    if search:
        search_lower = search.lower()
        events = [
            e for e in events
            if search_lower in (e.get("title", "") or "").lower()
            or search_lower in (e.get("subtitle", "") or "").lower()
            or search_lower in (e.get("order_number", "") or "").lower()
            or search_lower in (e.get("customer_name", "") or "").lower()
        ]
    
    # Сортування по даті та пріоритету
    def get_priority_value(p):
        if p is None:
            return 5
        if isinstance(p, int):
            return p
        priority_map = {'high': 1, 'medium': 3, 'low': 5}
        return priority_map.get(str(p).lower(), 5)
    
    events.sort(key=lambda e: (str(e.get("date", "") or ""), get_priority_value(e.get("priority"))))
    
    # Додаємо метадані до кожної події
    for event in events:
        event_type = event.get("type")
        if event_type in EVENT_TYPES:
            event["_meta"] = EVENT_TYPES[event_type]
    
    return {
        "events": events,
        "total": len(events),
        "date_from": date_from,
        "date_to": date_to,
        "filters": {
            "types": list(type_filter) if type_filter else None,
            "groups": list(group_filter) if group_filter else None,
            "search": search
        }
    }


@router.get("/stats")
async def get_calendar_stats(
    date: str = Query(..., description="Date YYYY-MM-DD"),
    db: Session = Depends(get_rh_db)
):
    """Статистика подій на конкретну дату"""
    stats = {}
    
    for event_type in EVENT_TYPES:
        stats[event_type] = 0
    
    # Отримуємо всі події на цю дату
    events_response = await get_calendar_events(
        date_from=date,
        date_to=date,
        types=None,
        groups=None,
        search=None,
        db=db
    )
    
    for event in events_response.get("events", []):
        event_type = event.get("type")
        if event_type in stats:
            stats[event_type] += 1
    
    return {
        "date": date,
        "stats": stats,
        "total": sum(stats.values())
    }
