"""
Finance routes - Фінансовий кабінет
Повна підтримка:
- Застави в валюті (UAH/USD/EUR)
- Внутрішні витрати компанії
- Регулярні платежі та нагадування
- ЗП
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from datetime import datetime, date, timedelta
import uuid

from database import get_db
from models_sqlalchemy import FinanceTransaction, RegularPayment, OpenCartOrder

router = APIRouter(prefix="/api/finance", tags=["finance"])

# Додатковий роутер для сумісності зі старим URL
manager_router = APIRouter(prefix="/api/manager/finance", tags=["finance"])

# ============================================================
# MAIN ENDPOINTS
# ============================================================

@router.get("/transactions")
@manager_router.get("/transactions")
@manager_router.get("/ledger")  # Додатковий alias для сумісності
async def get_transactions(
    order_id: Optional[int] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Отримати список фінансових транзакцій
    """
    try:
        query = db.query(FinanceTransaction)
        
        # Фільтри
        if order_id:
            query = query.filter(FinanceTransaction.order_id == order_id)
        if type:
            query = query.filter(FinanceTransaction.type == type)
        if status:
            query = query.filter(FinanceTransaction.status == status)
        if from_date:
            query = query.filter(FinanceTransaction.transaction_date >= from_date)
        if to_date:
            query = query.filter(FinanceTransaction.transaction_date <= to_date)
        
        transactions = query.order_by(
            FinanceTransaction.transaction_date.desc()
        ).limit(limit).all()
        
        result = []
        for t in transactions:
            # Get client name from order
            client_name = None
            if t.order_id:
                order = db.query(OpenCartOrder).filter(
                    OpenCartOrder.order_id == t.order_id
                ).first()
                if order:
                    client_name = f"{order.firstname} {order.lastname}"
            
            result.append({
                "id": t.id,
                "date": str(t.transaction_date.date()) if t.transaction_date else None,
                "order_id": t.order_id,
                "order_number": t.order_number,
                "client_name": client_name,
                "type": t.type,
                "title": t.title,
                "debit": float(t.debit) if t.debit else 0,
                "credit": float(t.credit) if t.credit else 0,
                "currency": t.currency,
                "status": t.status,
                "counterparty": t.counterparty,
                "payment_method": t.payment_method,
                "tag": t.tag
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка завантаження транзакцій: {str(e)}"
        )

@router.get("/summary")
@manager_router.get("/summary")
async def get_finance_summary(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Фінансовий підсумок (KPI)
    """
    try:
        query = db.query(FinanceTransaction)
        
        # Фільтр по датах
        if from_date:
            query = query.filter(FinanceTransaction.transaction_date >= from_date)
        if to_date:
            query = query.filter(FinanceTransaction.transaction_date <= to_date)
        
        transactions = query.all()
        
        # Рахуємо підсумки (ТІЛЬКИ підтверджені платежі!)
        # Виручка = тільки оплачені транзакції
        total_debit = sum([float(t.debit) for t in transactions if t.debit and t.status == 'paid'])
        total_credit = sum([float(t.credit) for t in transactions if t.credit and t.status == 'paid'])
        
        # За типами
        rent_accrued = sum([float(t.debit) for t in transactions if t.type == 'rent_accrual' and t.debit])
        rent_paid = sum([float(t.debit) for t in transactions if t.type == 'rent_accrual' and t.status == 'paid' and t.debit])
        deposits_held = sum([float(t.credit) for t in transactions if t.type == 'deposit_hold' and t.status == 'held' and t.credit])
        unpaid_balance = sum([float(t.debit) for t in transactions if t.status == 'unpaid' and t.debit])
        prepayments = sum([float(t.credit) for t in transactions if t.type == 'prepayment' and t.credit])
        
        return {
            "total_debit": total_debit,  # Тільки оплачені
            "total_credit": total_credit,  # Тільки оплачені
            "balance": total_debit - total_credit,
            "rent_accrued": rent_accrued,  # Всього нараховано
            "rent_paid": rent_paid,  # Виручка = тільки оплачені
            "deposits_held": deposits_held,
            "unpaid_balance": unpaid_balance,
            "prepayments": prepayments,
            "transaction_count": len(transactions)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка отримання підсумку: {str(e)}"
        )

@router.post("/mark-paid/{transaction_id}")
@manager_router.post("/mark-paid/{transaction_id}")
async def mark_transaction_paid(
    transaction_id: str,
    payment_data: dict,
    db: Session = Depends(get_db)
):
    """
    Позначити транзакцію як оплачену
    """
    try:
        transaction = db.query(FinanceTransaction).filter(
            FinanceTransaction.id == transaction_id
        ).first()
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Транзакція не знайдена")
        
        # Оновити статус
        transaction.status = "paid"
        transaction.payment_method = payment_data.get('payment_method', transaction.payment_method)
        
        # Створити кредитну транзакцію якщо була дебетна
        if transaction.debit > 0:
            payment_transaction = FinanceTransaction(
                id=f"{transaction.id}-PAID",
                opencart_order_id=transaction.opencart_order_id,
                decor_order_id=transaction.decor_order_id,
                order_number=transaction.order_number,
                type="payment",
                payment_method=payment_data.get('payment_method', 'cash'),
                title=f"Оплата: {transaction.title}",
                debit=0,
                credit=transaction.debit,
                currency=transaction.currency,
                status="paid",
                counterparty=transaction.counterparty,
                tag=transaction.tag,
                date=datetime.now().date()
            )
            db.add(payment_transaction)
        
        db.commit()
        
        return {"success": True, "message": "Транзакцію позначено як оплачену"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка оновлення транзакції: {str(e)}"
        )


@router.get("/deposits")
@manager_router.get("/deposits")
async def get_deposits(
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Отримати список застав
    """
    try:
        query = db.query(FinanceTransaction).filter(
            FinanceTransaction.type == 'deposit_hold'
        )
        
        # Фільтри
        if status:
            query = query.filter(FinanceTransaction.status == status)
        if from_date:
            query = query.filter(FinanceTransaction.transaction_date >= from_date)
        if to_date:
            query = query.filter(FinanceTransaction.transaction_date <= to_date)
        
        deposits = query.order_by(
            FinanceTransaction.transaction_date.desc()
        ).limit(limit).all()
        
        result = []
        for d in deposits:
            result.append({
                "id": d.id,
                "date": str(d.transaction_date.date()) if d.transaction_date else None,
                "order_id": d.order_id,
                "order_number": d.order_number,
                "counterparty": d.counterparty,
                "amount": float(d.credit) if d.credit else 0,
                "currency": d.currency,
                "status": d.status,
                "payment_method": d.payment_method
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка завантаження застав: {str(e)}"
        )


@router.post("/transactions")
@manager_router.post("/transactions")
async def create_transaction(
    transaction_data: dict,
    db: Session = Depends(get_db)
):
    """
    Створити нову фінансову транзакцію
    """
    try:
        # Generate ID
        trans_id = f"L-{transaction_data.get('order_id', 0)}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        new_transaction = FinanceTransaction(
            id=trans_id,
            opencart_order_id=transaction_data.get('opencart_order_id') or transaction_data.get('order_id'),
            decor_order_id=transaction_data.get('decor_order_id'),
            order_number=f"#{transaction_data.get('order_id', '')}",
            type=transaction_data.get('type'),
            payment_method=transaction_data.get('payment_method'),
            title=transaction_data.get('title'),
            notes=transaction_data.get('notes', ''),
            debit=transaction_data.get('debit', 0),
            credit=transaction_data.get('credit', 0),
            currency=transaction_data.get('currency', 'UAH'),
            status=transaction_data.get('status', 'pending'),
            counterparty=transaction_data.get('counterparty'),
            tag=transaction_data.get('type'),  # Use type as tag
            date=datetime.now().date()
        )
        
        db.add(new_transaction)
        db.commit()
        db.refresh(new_transaction)
        
        return {
            "success": True,
            "transaction_id": new_transaction.id,
            "message": "Транзакцію створено"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка створення транзакції: {str(e)}"
        )


@router.get("/report/{order_id}/pdf")
@manager_router.get("/report/{order_id}/pdf")
async def generate_finance_report_pdf(
    order_id: int,
    db: Session = Depends(get_db)
):
    """
    Генерувати PDF фінансового звіту для замовлення
    """
    try:
        from fastapi.responses import StreamingResponse
        from pdf_generator import finance_report_generator
        
        # Get order
        order = db.query(OpenCartOrder).filter(
            OpenCartOrder.order_id == order_id
        ).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        # Get transactions
        transactions = db.query(FinanceTransaction).filter(
            FinanceTransaction.order_id == order_id
        ).order_by(FinanceTransaction.transaction_date.desc()).all()
        
        # Prepare data
        order_data = {
            'order_id': order_id,
            'client_name': f"{order.firstname} {order.lastname}",
            'client_email': order.email,
            'client_phone': order.telephone
        }
        
        trans_data = []
        for t in transactions:
            trans_data.append({
                'date': str(t.transaction_date.date()) if t.transaction_date else None,
                'type': t.type,
                'title': t.title,
                'debit': float(t.debit) if t.debit else 0,
                'credit': float(t.credit) if t.credit else 0,
                'status': t.status
            })
        
        # Generate PDF
        pdf_buffer = finance_report_generator(order_data, trans_data)
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=finance_report_{order_id}.pdf"
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка генерації PDF: {str(e)}"
        )


@router.post("/report/{order_id}/email")
@manager_router.post("/report/{order_id}/email")
async def send_finance_report_email(
    order_id: int,
    email_data: dict,
    db: Session = Depends(get_db)
):
    """
    Відправити фінансовий звіт на email клієнта
    """
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        from email.mime.base import MIMEBase
        from email import encoders
        from pdf_generator import finance_report_generator
        import os
        
        # Get order
        order = db.query(OpenCartOrder).filter(
            OpenCartOrder.order_id == order_id
        ).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        # Get transactions
        transactions = db.query(FinanceTransaction).filter(
            FinanceTransaction.order_id == order_id
        ).order_by(FinanceTransaction.transaction_date.desc()).all()
        
        # Prepare data
        order_data = {
            'order_id': order_id,
            'client_name': f"{order.firstname} {order.lastname}",
            'client_email': email_data.get('email') or order.email,
            'client_phone': order.telephone
        }
        
        trans_data = []
        for t in transactions:
            trans_data.append({
                'date': str(t.transaction_date.date()) if t.transaction_date else None,
                'type': t.type,
                'title': t.title,
                'debit': float(t.debit) if t.debit else 0,
                'credit': float(t.credit) if t.credit else 0,
                'status': t.status
            })
        
        # Generate PDF
        pdf_buffer = finance_report_generator(order_data, trans_data)
        
        # Create email
        msg = MIMEMultipart()
        msg['From'] = os.environ.get('EMAIL_FROM', 'noreply@rentalhub.com')
        msg['To'] = order_data['client_email']
        msg['Subject'] = f"Фінансовий звіт - Замовлення #{order_id}"
        
        # Email body
        body = f"""
        Доброго дня, {order_data['client_name']}!
        
        Надсилаємо Вам фінансовий звіт по замовленню #{order_id}.
        
        У додатку знаходиться детальна інформація про всі фінансові операції.
        
        Якщо у Вас виникли питання, будь ласка, зв'яжіться з нами.
        
        З повагою,
        Команда Rental Hub
        """
        
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        # Attach PDF
        pdf_part = MIMEBase('application', 'pdf')
        pdf_part.set_payload(pdf_buffer.read())
        encoders.encode_base64(pdf_part)
        pdf_part.add_header(
            'Content-Disposition',
            f'attachment; filename=finance_report_{order_id}.pdf'
        )
        msg.attach(pdf_part)
        
        # Send email (mock for now - would need SMTP config)
        # For production, configure SMTP settings in environment
        smtp_host = os.environ.get('SMTP_HOST')
        smtp_port = int(os.environ.get('SMTP_PORT', 587))
        smtp_user = os.environ.get('SMTP_USER')
        smtp_pass = os.environ.get('SMTP_PASS')
        
        if smtp_host and smtp_user and smtp_pass:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
            
            return {
                "success": True,
                "message": f"Фінансовий звіт відправлено на {order_data['client_email']}"
            }
        else:
            # Mock mode - just confirm PDF generation works
            return {
                "success": True,
                "message": f"[DEMO MODE] Фінансовий звіт готовий для відправки на {order_data['client_email']}. Налаштуйте SMTP для реальної відправки.",
                "note": "Додайте SMTP_HOST, SMTP_USER, SMTP_PASS в .env для реальної відправки"
            }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка відправки email: {str(e)}"
        )


@router.post("/receive-payment")
@manager_router.post("/receive-payment")
async def receive_payment(
    payment_data: dict,
    db: Session = Depends(get_db)
):
    """
    Прийняти платіж (оренда або застава)
    """
    try:
        order_id = payment_data.get('order_id')
        amount = payment_data.get('amount', 0)
        payment_type = payment_data.get('type', 'payment')  # payment, deposit
        payment_method = payment_data.get('payment_method', 'cash')
        currency = payment_data.get('currency', 'UAH')
        notes = payment_data.get('notes', '')
        
        if not order_id or amount <= 0:
            raise HTTPException(status_code=400, detail="order_id та amount обов'язкові")
        
        # Знайти замовлення
        order = db.query(OpenCartOrder).filter(
            OpenCartOrder.order_id == order_id
        ).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        client_name = f"{order.firstname} {order.lastname}"
        
        # Створити транзакцію
        trans_id = f"PAY-{order_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        if payment_type == 'deposit':
            # Застава
            transaction = FinanceTransaction(
                id=trans_id,
                opencart_order_id=order_id,
                order_number=f"#{order_id}",
                type='deposit_hold',
                payment_method=payment_method,
                title=f"Застава: {client_name}",
                notes=notes,
                debit=0,
                credit=amount,
                currency=currency,
                status='held',  # Застава утримується
                counterparty=client_name,
                tag='deposit',
                date=datetime.now().date(),
                transaction_date=datetime.now()
            )
        else:
            # Оплата оренди
            transaction = FinanceTransaction(
                id=trans_id,
                opencart_order_id=order_id,
                order_number=f"#{order_id}",
                type='payment',
                payment_method=payment_method,
                title=f"Оплата оренди: {client_name}",
                notes=notes,
                debit=0,
                credit=amount,
                currency=currency,
                status='paid',  # Оплачено
                counterparty=client_name,
                tag='rental',
                date=datetime.now().date(),
                transaction_date=datetime.now()
            )
        
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        
        return {
            "success": True,
            "transaction_id": transaction.id,
            "message": f"{'Заставу' if payment_type == 'deposit' else 'Оплату'} прийнято: {amount} {currency}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка прийняття платежу: {str(e)}"
        )


@router.post("/return-deposit/{transaction_id}")
@manager_router.post("/return-deposit/{transaction_id}")
async def return_deposit(
    transaction_id: str,
    return_data: dict,
    db: Session = Depends(get_db)
):
    """
    Повернути заставу
    """
    try:
        # Знайти застава
        deposit = db.query(FinanceTransaction).filter(
            FinanceTransaction.id == transaction_id,
            FinanceTransaction.type == 'deposit_hold'
        ).first()
        
        if not deposit:
            raise HTTPException(status_code=404, detail="Заставу не знайдено")
        
        # Оновити статус
        deposit.status = 'returned'
        
        # Створити транзакцію повернення
        return_trans = FinanceTransaction(
            id=f"{transaction_id}-RETURN",
            opencart_order_id=deposit.opencart_order_id,
            order_number=deposit.order_number,
            type='deposit_return',
            payment_method=return_data.get('payment_method', deposit.payment_method),
            title=f"Повернення застави: {deposit.counterparty}",
            notes=return_data.get('notes', ''),
            debit=deposit.credit,
            credit=0,
            currency=deposit.currency,
            status='paid',
            counterparty=deposit.counterparty,
            tag='deposit_return',
            date=datetime.now().date(),
            transaction_date=datetime.now()
        )
        
        db.add(return_trans)
        db.commit()
        
        return {
            "success": True,
            "message": "Заставу повернуто"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка повернення застави: {str(e)}"
        )

