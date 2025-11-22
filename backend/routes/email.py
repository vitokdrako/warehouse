"""
Email service for sending order confirmations
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

from database import get_db
from models_sqlalchemy import OpenCartOrder

router = APIRouter(prefix="/api/email", tags=["email"])

class EmailConfirmation(BaseModel):
    order_id: int
    client_comment: str
    discount_percent: Optional[float] = 0
    rental_days: Optional[int] = None
    
@router.post("/send-confirmation")
async def send_order_confirmation(
    email_data: EmailConfirmation,
    db: Session = Depends(get_db)
):
    """
    Відправити підтвердження замовлення клієнту на email
    """
    try:
        # Отримати замовлення
        order = db.query(OpenCartOrder).filter(
            OpenCartOrder.order_id == email_data.order_id
        ).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        # Згенерувати токен підтвердження
        import uuid
        confirmation_token = str(uuid.uuid4())
        
        # Створити HTML email
        confirmation_url = f"https://backrentalhub.farforrent.com.ua/api/email/confirm/{confirmation_token}"
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Підтвердження змін у замовленні #{order.order_id}</h2>
            
            <p>Шановний(а) {order.firstname} {order.lastname},</p>
            
            <p>Ми внесли зміни до вашого замовлення. Будь ласка, перевірте деталі:</p>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Коментар менеджера:</strong></p>
                <p>{email_data.client_comment}</p>
                
                {f'<p><strong>Знижка:</strong> {email_data.discount_percent}%</p>' if email_data.discount_percent else ''}
                {f'<p><strong>Кількість днів оренди:</strong> {email_data.rental_days} діб</p>' if email_data.rental_days else ''}
            </div>
            
            <p>Якщо ви згодні з цими змінами, будь ласка, натисніть кнопку нижче:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{confirmation_url}" 
                   style="background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    ✓ Підтверджую зміни
                </a>
            </div>
            
            <p style="color: #666; font-size: 12px;">
                Якщо у вас є питання, зв'яжіться з нами за телефоном або email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #999; font-size: 11px;">
                RentalHub © 2025. Це автоматичний email, будь ласка не відповідайте на нього.
            </p>
        </body>
        </html>
        """
        
        # Відправити email (mock для тестування)
        # В production треба використати SMTP
        print(f"[EMAIL] Sending to {order.email}")
        print(f"[EMAIL] Subject: Підтвердження змін у замовленні #{order.order_id}")
        print(f"[EMAIL] Token: {confirmation_token}")
        
        # TODO: Зберегти токен в базі для верифікації
        # TODO: Налаштувати SMTP для реальної відправки
        
        return {
            "success": True,
            "message": "Email відправлено",
            "email": order.email,
            "confirmation_token": confirmation_token,
            "mock": True  # Видалити коли буде реальний SMTP
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка відправки email: {str(e)}"
        )

@router.get("/confirm/{token}")
async def confirm_order_changes(token: str):
    """
    Підтвердження змін клієнтом через email link
    """
    # TODO: Перевірити токен в базі
    # TODO: Оновити статус замовлення
    
    return {
        "success": True,
        "message": "Дякуємо! Ваше підтвердження отримано.",
        "token": token
    }
