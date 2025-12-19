"""
Email Service - Відправка email через SMTP
"""
import os
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)

# SMTP Configuration from environment
SMTP_HOST = os.getenv("SMTP_HOST", "mail.adm.tools")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "True").lower() == "true"
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "info@farforrent.com.ua")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "FarforRent")


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    plain_content: Optional[str] = None,
    attachments: Optional[List[dict]] = None,
    reply_to: Optional[str] = None
) -> dict:
    """
    Відправити email
    
    Args:
        to_email: Email отримувача
        subject: Тема листа
        html_content: HTML вміст листа
        plain_content: Текстовий вміст (опціонально)
        attachments: Список вкладень [{"filename": "doc.pdf", "content": bytes, "content_type": "application/pdf"}]
        reply_to: Email для відповіді
    
    Returns:
        {"success": True/False, "message": "..."}
    """
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.error("SMTP credentials not configured")
        return {"success": False, "message": "SMTP не налаштовано"}
    
    try:
        # Створюємо повідомлення
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        
        if reply_to:
            msg["Reply-To"] = reply_to
        
        # Додаємо текстову версію
        if plain_content:
            part1 = MIMEText(plain_content, "plain", "utf-8")
            msg.attach(part1)
        
        # Додаємо HTML версію
        part2 = MIMEText(html_content, "html", "utf-8")
        msg.attach(part2)
        
        # Додаємо вкладення
        if attachments:
            for attachment in attachments:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(attachment["content"])
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    f"attachment; filename={attachment['filename']}"
                )
                msg.attach(part)
        
        # Відправляємо
        context = ssl.create_default_context()
        
        if SMTP_USE_SSL:
            # SSL з'єднання (порт 465)
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as server:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM_EMAIL, to_email, msg.as_string())
        else:
            # TLS з'єднання (порт 587)
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls(context=context)
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM_EMAIL, to_email, msg.as_string())
        
        logger.info(f"Email sent successfully to {to_email}")
        return {"success": True, "message": f"Email відправлено на {to_email}"}
        
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP authentication failed: {e}")
        return {"success": False, "message": "Помилка автентифікації SMTP"}
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error: {e}")
        return {"success": False, "message": f"Помилка SMTP: {str(e)}"}
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return {"success": False, "message": f"Помилка відправки: {str(e)}"}


def send_document_email(
    to_email: str,
    document_type: str,
    document_html: str,
    order_number: str,
    customer_name: Optional[str] = None
) -> dict:
    """
    Відправити документ клієнту
    
    Args:
        to_email: Email клієнта
        document_type: Тип документа (invoice_offer, contract_rent, etc.)
        document_html: HTML вміст документа
        order_number: Номер замовлення
        customer_name: Ім'я клієнта
    """
    # Назви документів українською
    doc_names = {
        "invoice_offer": "Рахунок-оферта",
        "contract_rent": "Договір оренди",
        "issue_act": "Акт передачі",
        "return_act": "Акт повернення",
        "damage_invoice": "Рахунок за пошкодження",
        "deposit_refund_act": "Акт повернення застави",
        "picking_list": "Лист комплектації",
        "issue_checklist": "Чеклист видачі",
    }
    
    doc_name = doc_names.get(document_type, document_type)
    greeting = f"Шановний(а) {customer_name}," if customer_name else "Шановний клієнте,"
    
    subject = f"{doc_name} - Замовлення {order_number} | FarforRent"
    
    # Обгортаємо документ в email шаблон
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .header {{ background: #1e3a5f; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; }}
            .document {{ border: 1px solid #ddd; margin: 20px 0; }}
            .footer {{ background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>FarforRent</h1>
            <p>Оренда декору для свят</p>
        </div>
        
        <div class="content">
            <p>{greeting}</p>
            <p>Дякуємо за ваше замовлення! Надсилаємо вам документ <strong>{doc_name}</strong> 
               для замовлення <strong>{order_number}</strong>.</p>
            
            <div class="document">
                {document_html}
            </div>
            
            <p>Якщо у вас є питання, звертайтесь:</p>
            <ul>
                <li>📞 Телефон: +380 XX XXX XX XX</li>
                <li>📧 Email: info@farforrent.com.ua</li>
                <li>🌐 Сайт: farforrent.com.ua</li>
            </ul>
            
            <p>З повагою,<br>Команда FarforRent</p>
        </div>
        
        <div class="footer">
            <p>© 2025 FarforRent. Оренда декору для свят.</p>
            <p>Цей лист відправлено автоматично. Будь ласка, не відповідайте на нього.</p>
        </div>
    </body>
    </html>
    """
    
    plain_content = f"""
{greeting}

Дякуємо за ваше замовлення!
Надсилаємо вам документ "{doc_name}" для замовлення {order_number}.

Якщо у вас є питання, звертайтесь:
- Телефон: +380 XX XXX XX XX
- Email: info@farforrent.com.ua
- Сайт: farforrent.com.ua

З повагою,
Команда FarforRent
    """
    
    return send_email(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        plain_content=plain_content
    )
