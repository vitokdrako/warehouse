"""
Email Provider Abstraction Layer
Supports: Resend, SendGrid, Dummy (for testing)

Usage:
    provider = get_email_provider()
    result = await provider.send(to, subject, html, attachments)

Environment Variables:
    EMAIL_PROVIDER=resend|sendgrid|dummy (default: dummy)
    RESEND_API_KEY=re_...
    SENDGRID_API_KEY=SG....
    EMAIL_FROM=noreply@example.com
"""
import os
import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ============================================================
# DATA MODELS
# ============================================================

class EmailAttachment(BaseModel):
    filename: str
    content: str  # base64 encoded
    content_type: str = "application/pdf"


class EmailResult(BaseModel):
    success: bool
    provider: str
    email_id: Optional[str] = None
    error: Optional[str] = None
    sent_at: str = None
    
    def __init__(self, **data):
        if "sent_at" not in data:
            data["sent_at"] = datetime.now().isoformat()
        super().__init__(**data)


# ============================================================
# ABSTRACT EMAIL PROVIDER
# ============================================================

class EmailProvider(ABC):
    """Abstract base class for email providers"""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name for logging"""
        pass
    
    @abstractmethod
    async def send(
        self,
        to: str,
        subject: str,
        html: str,
        from_email: Optional[str] = None,
        attachments: Optional[List[EmailAttachment]] = None,
        cc: Optional[str] = None,
        bcc: Optional[str] = None
    ) -> EmailResult:
        """Send an email"""
        pass
    
    @abstractmethod
    def is_configured(self) -> bool:
        """Check if provider is properly configured"""
        pass


# ============================================================
# DUMMY PROVIDER (for development/testing)
# ============================================================

class DummyEmailProvider(EmailProvider):
    """
    Dummy provider that logs emails without sending.
    Use for development and testing.
    """
    
    @property
    def name(self) -> str:
        return "dummy"
    
    def is_configured(self) -> bool:
        return True
    
    async def send(
        self,
        to: str,
        subject: str,
        html: str,
        from_email: Optional[str] = None,
        attachments: Optional[List[EmailAttachment]] = None,
        cc: Optional[str] = None,
        bcc: Optional[str] = None
    ) -> EmailResult:
        """Log email details without actually sending"""
        
        logger.info(f"[DUMMY EMAIL] To: {to}")
        logger.info(f"[DUMMY EMAIL] Subject: {subject}")
        logger.info(f"[DUMMY EMAIL] From: {from_email or 'default'}")
        logger.info(f"[DUMMY EMAIL] HTML length: {len(html)} chars")
        if attachments:
            logger.info(f"[DUMMY EMAIL] Attachments: {[a.filename for a in attachments]}")
        
        # Simulate a slight delay
        await asyncio.sleep(0.1)
        
        return EmailResult(
            success=True,
            provider="dummy",
            email_id=f"dummy_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            error=None
        )


# ============================================================
# RESEND PROVIDER
# ============================================================

class ResendEmailProvider(EmailProvider):
    """
    Resend email provider.
    https://resend.com/docs
    """
    
    def __init__(self):
        self.api_key = os.environ.get("RESEND_API_KEY")
        self.default_from = os.environ.get("EMAIL_FROM", "onboarding@resend.dev")
    
    @property
    def name(self) -> str:
        return "resend"
    
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.startswith("re_"))
    
    async def send(
        self,
        to: str,
        subject: str,
        html: str,
        from_email: Optional[str] = None,
        attachments: Optional[List[EmailAttachment]] = None,
        cc: Optional[str] = None,
        bcc: Optional[str] = None
    ) -> EmailResult:
        """Send email via Resend API"""
        
        if not self.is_configured():
            return EmailResult(
                success=False,
                provider="resend",
                error="Resend API key not configured"
            )
        
        try:
            import resend
            resend.api_key = self.api_key
            
            params: Dict[str, Any] = {
                "from": from_email or self.default_from,
                "to": [to],
                "subject": subject,
                "html": html
            }
            
            if cc:
                params["cc"] = [cc]
            if bcc:
                params["bcc"] = [bcc]
            
            if attachments:
                params["attachments"] = [
                    {
                        "filename": att.filename,
                        "content": att.content,
                        "content_type": att.content_type
                    }
                    for att in attachments
                ]
            
            # Run sync SDK in thread for non-blocking
            email = await asyncio.to_thread(resend.Emails.send, params)
            
            logger.info(f"[RESEND] Email sent to {to}, id: {email.get('id')}")
            
            return EmailResult(
                success=True,
                provider="resend",
                email_id=email.get("id")
            )
            
        except Exception as e:
            logger.error(f"[RESEND] Failed to send email: {str(e)}")
            return EmailResult(
                success=False,
                provider="resend",
                error=str(e)
            )


# ============================================================
# SENDGRID PROVIDER
# ============================================================

class SendGridEmailProvider(EmailProvider):
    """
    SendGrid email provider.
    https://docs.sendgrid.com/
    """
    
    def __init__(self):
        self.api_key = os.environ.get("SENDGRID_API_KEY")
        self.default_from = os.environ.get("EMAIL_FROM", "noreply@example.com")
    
    @property
    def name(self) -> str:
        return "sendgrid"
    
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.startswith("SG."))
    
    async def send(
        self,
        to: str,
        subject: str,
        html: str,
        from_email: Optional[str] = None,
        attachments: Optional[List[EmailAttachment]] = None,
        cc: Optional[str] = None,
        bcc: Optional[str] = None
    ) -> EmailResult:
        """Send email via SendGrid API"""
        
        if not self.is_configured():
            return EmailResult(
                success=False,
                provider="sendgrid",
                error="SendGrid API key not configured"
            )
        
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import (
                Mail, Attachment, FileContent, FileName, 
                FileType, Disposition, Cc, Bcc
            )
            
            message = Mail(
                from_email=from_email or self.default_from,
                to_emails=to,
                subject=subject,
                html_content=html
            )
            
            if cc:
                message.add_cc(Cc(cc))
            if bcc:
                message.add_bcc(Bcc(bcc))
            
            if attachments:
                for att in attachments:
                    attachment = Attachment(
                        FileContent(att.content),
                        FileName(att.filename),
                        FileType(att.content_type),
                        Disposition("attachment")
                    )
                    message.add_attachment(attachment)
            
            sg = SendGridAPIClient(self.api_key)
            response = await asyncio.to_thread(sg.send, message)
            
            logger.info(f"[SENDGRID] Email sent to {to}, status: {response.status_code}")
            
            return EmailResult(
                success=response.status_code in [200, 201, 202],
                provider="sendgrid",
                email_id=response.headers.get("X-Message-Id")
            )
            
        except Exception as e:
            logger.error(f"[SENDGRID] Failed to send email: {str(e)}")
            return EmailResult(
                success=False,
                provider="sendgrid",
                error=str(e)
            )


# ============================================================
# PROVIDER FACTORY
# ============================================================

_provider_instance: Optional[EmailProvider] = None

def get_email_provider() -> EmailProvider:
    """
    Get configured email provider based on EMAIL_PROVIDER env var.
    Uses singleton pattern for efficiency.
    """
    global _provider_instance
    
    if _provider_instance is not None:
        return _provider_instance
    
    provider_name = os.environ.get("EMAIL_PROVIDER", "dummy").lower()
    
    if provider_name == "resend":
        provider = ResendEmailProvider()
        if not provider.is_configured():
            logger.warning("Resend not configured, falling back to dummy provider")
            provider = DummyEmailProvider()
    elif provider_name == "sendgrid":
        provider = SendGridEmailProvider()
        if not provider.is_configured():
            logger.warning("SendGrid not configured, falling back to dummy provider")
            provider = DummyEmailProvider()
    else:
        provider = DummyEmailProvider()
    
    _provider_instance = provider
    logger.info(f"Email provider initialized: {provider.name}")
    
    return provider


def reset_provider():
    """Reset provider instance (useful for testing)"""
    global _provider_instance
    _provider_instance = None
