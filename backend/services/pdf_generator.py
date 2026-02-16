"""
PDF Generator Service - генерація PDF документів
Використовує WeasyPrint та Jinja2
"""
import os
import json
from datetime import datetime
from typing import Optional, Dict, Any
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration
import logging

logger = logging.getLogger(__name__)

# Base paths
TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
PDF_OUTPUT_DIR = Path(__file__).parent.parent / "generated_pdfs"

# Ensure output directory exists
PDF_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Jinja2 environment
jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=True
)

# Executor (company) default data
EXECUTOR_DATA = {
    "name": "ТОВ «ФАРФОР РЕНТ»",
    "edrpou": "44651557",
    "address": "02000, м. Київ, вул. Магнітогорська, буд. 1, корп. 34",
    "bank": "АТ КБ «ПРИВАТБАНК»",
    "iban": "UA913052990000026002015020709",
    "director": "Драко В.А."
}


def format_date_ua(date_str: str) -> str:
    """Format ISO date to Ukrainian format"""
    if not date_str:
        return "—"
    try:
        if isinstance(date_str, str):
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        else:
            dt = date_str
        months = [
            'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
            'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
        ]
        return f"{dt.day} {months[dt.month - 1]} {dt.year} р."
    except:
        return date_str


def generate_master_agreement_pdf(
    agreement_data: Dict[str, Any],
    client_data: Dict[str, Any],
    output_filename: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate PDF for Master Agreement
    
    Args:
        agreement_data: Agreement data from database
        client_data: Client data from database
        output_filename: Optional custom filename
    
    Returns:
        {"success": True, "pdf_path": "...", "pdf_bytes": bytes}
    """
    try:
        # Prepare template data
        template_data = {
            "contract_number": agreement_data.get("contract_number", "—"),
            "valid_from": format_date_ua(agreement_data.get("valid_from")),
            "valid_until": format_date_ua(agreement_data.get("valid_until")),
            "status": agreement_data.get("status", "draft"),
            "signed_at": format_date_ua(agreement_data.get("signed_at")) if agreement_data.get("signed_at") else None,
            "signed_by": agreement_data.get("signed_by"),
            "executor": EXECUTOR_DATA,
            "client": {
                "name": client_data.get("full_name") or client_data.get("email", "—"),
                "email": client_data.get("email", "—"),
                "phone": client_data.get("phone"),
                "payer_type": client_data.get("payer_type", "individual"),
                "tax_id": client_data.get("tax_id"),
                "bank_details": client_data.get("bank_details") if isinstance(client_data.get("bank_details"), dict) else (
                    json.loads(client_data.get("bank_details")) if client_data.get("bank_details") else None
                )
            },
            "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M")
        }
        
        # Load and render template
        template = jinja_env.get_template("legal/master_agreement.html")
        html_content = template.render(**template_data)
        
        # Generate PDF
        font_config = FontConfiguration()
        html = HTML(string=html_content, base_url=str(TEMPLATES_DIR))
        
        # Custom CSS for better PDF rendering
        css = CSS(string='''
            @page {
                size: A4;
                margin: 15mm;
            }
            body {
                font-family: "DejaVu Sans", Arial, sans-serif;
            }
        ''', font_config=font_config)
        
        pdf_bytes = html.write_pdf(stylesheets=[css], font_config=font_config)
        
        # Save to file
        if not output_filename:
            output_filename = f"MA_{agreement_data.get('contract_number', 'unknown').replace('-', '_')}.pdf"
        
        pdf_path = PDF_OUTPUT_DIR / output_filename
        with open(pdf_path, 'wb') as f:
            f.write(pdf_bytes)
        
        logger.info(f"PDF generated: {pdf_path}")
        
        return {
            "success": True,
            "pdf_path": str(pdf_path),
            "pdf_filename": output_filename,
            "pdf_bytes": pdf_bytes
        }
        
    except Exception as e:
        logger.error(f"PDF generation error: {e}")
        return {
            "success": False,
            "error": str(e)
        }


def generate_master_agreement_html(
    agreement_data: Dict[str, Any],
    client_data: Dict[str, Any]
) -> str:
    """
    Generate HTML for Master Agreement (for preview)
    
    Args:
        agreement_data: Agreement data from database
        client_data: Client data from database
    
    Returns:
        HTML string
    """
    try:
        template_data = {
            "contract_number": agreement_data.get("contract_number", "—"),
            "valid_from": format_date_ua(agreement_data.get("valid_from")),
            "valid_until": format_date_ua(agreement_data.get("valid_until")),
            "status": agreement_data.get("status", "draft"),
            "signed_at": format_date_ua(agreement_data.get("signed_at")) if agreement_data.get("signed_at") else None,
            "signed_by": agreement_data.get("signed_by"),
            "executor": EXECUTOR_DATA,
            "client": {
                "name": client_data.get("full_name") or client_data.get("email", "—"),
                "email": client_data.get("email", "—"),
                "phone": client_data.get("phone"),
                "payer_type": client_data.get("payer_type", "individual"),
                "tax_id": client_data.get("tax_id"),
                "bank_details": client_data.get("bank_details") if isinstance(client_data.get("bank_details"), dict) else (
                    json.loads(client_data.get("bank_details")) if client_data.get("bank_details") else None
                )
            },
            "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M")
        }
        
        template = jinja_env.get_template("legal/master_agreement.html")
        return template.render(**template_data)
        
    except Exception as e:
        logger.error(f"HTML generation error: {e}")
        return f"<html><body><h1>Помилка генерації</h1><p>{str(e)}</p></body></html>"
