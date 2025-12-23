"""
Export API - Експорт даних в Excel/CSV
Endpoints для експорту фінансових даних та кейсів шкоди
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from datetime import datetime, date
import csv
import io

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/export", tags=["Export"])


def make_csv_response(data: list, filename: str, columns: list) -> StreamingResponse:
    """Create CSV response from data with UTF-8 BOM for Excel compatibility"""
    output = io.StringIO()
    
    # Write UTF-8 BOM for Excel compatibility
    output.write('\ufeff')
    
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    
    # Write header with Ukrainian column names
    writer.writerow(columns)
    
    # Write data rows
    for row in data:
        writer.writerow(row)
    
    output.seek(0)
    
    # Create response with proper headers for download
    response = StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8"
    )
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    response.headers["Access-Control-Expose-Headers"] = "Content-Disposition"
    
    return response


# ============================================
# FINANCE CONSOLE EXPORTS
# ============================================

@router.get("/ledger")
async def export_ledger(
    month: Optional[str] = None,  # YYYY-MM
    db: Session = Depends(get_rh_db)
):
    """Експорт головної книги (Ledger) в CSV"""
    
    where_clause = ""
    params = {}
    
    if month:
        where_clause = "WHERE DATE_FORMAT(t.occurred_at, '%Y-%m') = :month"
        params["month"] = month
    
    query = f"""
        SELECT 
            DATE_FORMAT(t.occurred_at, '%Y-%m-%d %H:%i') as date,
            t.tx_type,
            t.amount,
            t.note,
            o.order_number,
            t.created_by_name
        FROM fin_transactions t
        LEFT JOIN orders o ON t.order_id = o.id
        {where_clause}
        ORDER BY t.occurred_at DESC
    """
    
    rows = db.execute(text(query), params).fetchall()
    
    data = []
    for row in rows:
        data.append([
            row[0] or "",  # date
            row[1] or "",  # tx_type
            str(row[2]) if row[2] else "0",  # amount
            row[3] or "",  # note
            row[4] or "",  # order_number
            row[5] or "",  # created_by_name
        ])
    
    columns = ["Дата", "Тип операції", "Сума (₴)", "Примітка", "Номер ордера", "Автор"]
    filename = f"ledger_{month or 'all'}_{datetime.now().strftime('%Y%m%d')}.csv"
    
    return make_csv_response(data, filename, columns)


@router.get("/expenses")
async def export_expenses(
    month: Optional[str] = None,  # YYYY-MM
    db: Session = Depends(get_rh_db)
):
    """Експорт витрат в CSV"""
    
    where_clause = ""
    params = {}
    
    if month:
        where_clause = "WHERE DATE_FORMAT(e.occurred_at, '%Y-%m') = :month"
        params["month"] = month
    
    query = f"""
        SELECT 
            DATE_FORMAT(e.occurred_at, '%Y-%m-%d') as date,
            e.expense_type,
            c.name as category_name,
            e.amount,
            e.method,
            COALESCE(e.funding_source, 'general') as funding_source,
            e.note,
            e.status
        FROM fin_expenses e
        LEFT JOIN fin_categories c ON e.category_id = c.id
        {where_clause}
        ORDER BY e.occurred_at DESC
    """
    
    rows = db.execute(text(query), params).fetchall()
    
    funding_map = {"general": "Каса", "damage_pool": "Бюджет шкоди"}
    method_map = {"cash": "Готівка", "bank": "Безготівка"}
    
    data = []
    for row in rows:
        data.append([
            row[0] or "",  # date
            row[1] or "",  # expense_type
            row[2] or "Без категорії",  # category_name
            str(row[3]) if row[3] else "0",  # amount
            method_map.get(row[4], row[4] or ""),  # method
            funding_map.get(row[5], row[5] or ""),  # funding_source
            row[6] or "",  # note
            row[7] or "",  # status
        ])
    
    columns = ["Дата", "Тип", "Категорія", "Сума (₴)", "Метод", "Джерело", "Примітка", "Статус"]
    filename = f"expenses_{month or 'all'}_{datetime.now().strftime('%Y%m%d')}.csv"
    
    return make_csv_response(data, filename, columns)


@router.get("/orders-finance")
async def export_orders_finance(
    status: Optional[str] = None,
    db: Session = Depends(get_rh_db)
):
    """Експорт ордерів з фінансовими даними"""
    
    where_clause = "WHERE o.is_archived = FALSE"
    params = {}
    
    if status:
        where_clause += " AND o.status = :status"
        params["status"] = status
    
    query = f"""
        SELECT 
            o.order_number,
            o.status,
            c.full_name as customer_name,
            c.telephone as customer_phone,
            o.total_rental,
            COALESCE(SUM(CASE WHEN p.payment_type = 'rent' THEN p.amount ELSE 0 END), 0) as rent_paid,
            o.total_deposit,
            COALESCE(d.held_amount, 0) as deposit_held,
            DATE_FORMAT(o.created_at, '%Y-%m-%d') as created_date
        FROM orders o
        LEFT JOIN clients c ON o.customer_id = c.id
        LEFT JOIN fin_payments p ON o.id = p.order_id
        LEFT JOIN deposits d ON o.id = d.order_id
        {where_clause}
        GROUP BY o.id, o.order_number, o.status, c.full_name, c.telephone, 
                 o.total_rental, o.total_deposit, d.held_amount, o.created_at
        ORDER BY o.created_at DESC
    """
    
    rows = db.execute(text(query), params).fetchall()
    
    status_map = {
        "draft": "Чернетка",
        "confirmed": "Підтверджено",
        "active": "Активне",
        "returned": "Повернено",
        "completed": "Завершено",
        "cancelled": "Скасовано"
    }
    
    data = []
    for row in rows:
        rent_due = max(0, (row[4] or 0) - (row[5] or 0))
        deposit_due = max(0, (row[6] or 0) - (row[7] or 0))
        
        data.append([
            row[0] or "",  # order_number
            status_map.get(row[1], row[1] or ""),  # status
            row[2] or "",  # customer_name
            row[3] or "",  # customer_phone
            str(row[4]) if row[4] else "0",  # total_rental
            str(row[5]) if row[5] else "0",  # rent_paid
            str(rent_due),  # rent_due
            str(row[6]) if row[6] else "0",  # total_deposit
            str(row[7]) if row[7] else "0",  # deposit_held
            str(deposit_due),  # deposit_due
            row[8] or "",  # created_date
        ])
    
    columns = [
        "Номер ордера", "Статус", "Клієнт", "Телефон", 
        "Нараховано (₴)", "Оплачено (₴)", "Борг оренди (₴)",
        "Очік. застава (₴)", "Факт. застава (₴)", "Борг застави (₴)",
        "Дата створення"
    ]
    filename = f"orders_finance_{datetime.now().strftime('%Y%m%d')}.csv"
    
    return make_csv_response(data, filename, columns)


# ============================================
# DAMAGE HUB EXPORTS
# ============================================

@router.get("/damage-cases")
async def export_damage_cases(
    status: Optional[str] = None,
    db: Session = Depends(get_rh_db)
):
    """Експорт кейсів шкоди"""
    
    where_clause = ""
    params = {}
    
    if status:
        where_clause = "WHERE pdh.status = :status"
        params["status"] = status
    
    query = f"""
        SELECT 
            o.order_number,
            c.full_name as customer_name,
            p.sku,
            p.name as product_name,
            pdh.damage_type,
            pdh.description,
            pdh.fee,
            pdh.status,
            DATE_FORMAT(pdh.created_at, '%Y-%m-%d') as created_date
        FROM product_damage_history pdh
        LEFT JOIN orders o ON pdh.order_id = o.id
        LEFT JOIN clients c ON o.customer_id = c.id
        LEFT JOIN products p ON pdh.product_id = p.id
        {where_clause}
        ORDER BY pdh.created_at DESC
    """
    
    rows = db.execute(text(query), params).fetchall()
    
    damage_type_map = {
        "broken": "Зламано",
        "scratched": "Подряпано",
        "stained": "Плями",
        "missing_parts": "Відсутні частини",
        "other": "Інше"
    }
    
    status_map = {
        "open": "Відкрито",
        "awaiting_client": "Чекаємо клієнта",
        "awaiting_payment": "Чекаємо оплату",
        "in_repair": "В ремонті",
        "closed": "Закрито"
    }
    
    data = []
    for row in rows:
        data.append([
            row[0] or "",  # order_number
            row[1] or "",  # customer_name
            row[2] or "",  # sku
            row[3] or "",  # product_name
            damage_type_map.get(row[4], row[4] or ""),  # damage_type
            row[5] or "",  # description
            str(row[6]) if row[6] else "0",  # fee
            status_map.get(row[7], row[7] or ""),  # status
            row[8] or "",  # created_date
        ])
    
    columns = [
        "Номер ордера", "Клієнт", "SKU", "Товар", 
        "Тип шкоди", "Опис", "Компенсація (₴)", "Статус", "Дата"
    ]
    filename = f"damage_cases_{datetime.now().strftime('%Y%m%d')}.csv"
    
    return make_csv_response(data, filename, columns)


@router.get("/tasks")
async def export_tasks(
    task_type: Optional[str] = None,  # washing, restoration
    status: Optional[str] = None,
    db: Session = Depends(get_rh_db)
):
    """Експорт задач (мийка, реставрація)"""
    
    where_clauses = []
    params = {}
    
    if task_type:
        where_clauses.append("t.task_type = :task_type")
        params["task_type"] = task_type
    
    if status:
        where_clauses.append("t.status = :status")
        params["status"] = status
    
    where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
    
    query = f"""
        SELECT 
            t.id,
            t.task_type,
            p.sku,
            p.name as product_name,
            o.order_number,
            t.description,
            t.status,
            t.priority,
            DATE_FORMAT(t.created_at, '%Y-%m-%d') as created_date,
            DATE_FORMAT(t.completed_at, '%Y-%m-%d') as completed_date
        FROM tasks t
        LEFT JOIN products p ON t.product_id = p.id
        LEFT JOIN orders o ON t.order_id = o.id
        {where_clause}
        ORDER BY t.created_at DESC
    """
    
    rows = db.execute(text(query), params).fetchall()
    
    task_type_map = {
        "washing": "Мийка",
        "restoration": "Реставрація",
        "laundry": "Хімчистка"
    }
    
    status_map = {
        "pending": "Очікує",
        "in_progress": "В роботі",
        "completed": "Завершено",
        "cancelled": "Скасовано"
    }
    
    priority_map = {
        "low": "Низький",
        "normal": "Звичайний",
        "high": "Високий",
        "urgent": "Терміновий"
    }
    
    data = []
    for row in rows:
        data.append([
            str(row[0]) if row[0] else "",  # id
            task_type_map.get(row[1], row[1] or ""),  # task_type
            row[2] or "",  # sku
            row[3] or "",  # product_name
            row[4] or "",  # order_number
            row[5] or "",  # description
            status_map.get(row[6], row[6] or ""),  # status
            priority_map.get(row[7], row[7] or ""),  # priority
            row[8] or "",  # created_date
            row[9] or "",  # completed_date
        ])
    
    columns = [
        "ID", "Тип", "SKU", "Товар", "Ордер", 
        "Опис", "Статус", "Пріоритет", "Створено", "Завершено"
    ]
    
    type_suffix = task_type or "all"
    filename = f"tasks_{type_suffix}_{datetime.now().strftime('%Y%m%d')}.csv"
    
    return make_csv_response(data, filename, columns)


@router.get("/laundry-queue")
async def export_laundry_queue(
    db: Session = Depends(get_rh_db)
):
    """Експорт черги хімчистки"""
    
    query = """
        SELECT 
            lq.id,
            p.sku,
            p.name as product_name,
            o.order_number,
            lq.status,
            lq.priority,
            DATE_FORMAT(lq.created_at, '%Y-%m-%d') as created_date,
            DATE_FORMAT(lq.sent_at, '%Y-%m-%d') as sent_date
        FROM laundry_queue lq
        LEFT JOIN products p ON lq.product_id = p.id
        LEFT JOIN orders o ON lq.order_id = o.id
        ORDER BY lq.created_at DESC
    """
    
    rows = db.execute(text(query)).fetchall()
    
    status_map = {
        "pending": "В черзі",
        "sent": "Відправлено",
        "completed": "Повернуто",
        "cancelled": "Скасовано"
    }
    
    data = []
    for row in rows:
        data.append([
            str(row[0]) if row[0] else "",  # id
            row[1] or "",  # sku
            row[2] or "",  # product_name
            row[3] or "",  # order_number
            status_map.get(row[4], row[4] or ""),  # status
            str(row[5]) if row[5] else "1",  # priority
            row[6] or "",  # created_date
            row[7] or "",  # sent_date
        ])
    
    columns = [
        "ID", "SKU", "Товар", "Ордер", "Статус", "Пріоритет", "Створено", "Відправлено"
    ]
    filename = f"laundry_queue_{datetime.now().strftime('%Y%m%d')}.csv"
    
    return make_csv_response(data, filename, columns)
