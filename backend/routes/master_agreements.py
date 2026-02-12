"""
Master Agreements API - Рамкові договори
Phase 3: Documents Engine
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, date, timedelta
from typing import Optional, List
from pydantic import BaseModel
import json

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/agreements", tags=["master-agreements"])


# ============================================================
# PYDANTIC MODELS
# ============================================================

class MasterAgreementCreate(BaseModel):
    payer_profile_id: int
    template_version: str = "v1"
    valid_from: Optional[str] = None  # ISO date, default = today
    valid_months: int = 12
    note: Optional[str] = None


class MasterAgreementUpdate(BaseModel):
    status: Optional[str] = None  # draft, sent, signed, expired
    signed_at: Optional[str] = None
    note: Optional[str] = None


# ============================================================
# HELPER: Generate Contract Number
# ============================================================

def generate_contract_number(db: Session, year: int) -> str:
    """Generate unique contract number: MA-YYYY-NNN"""
    result = db.execute(text("""
        SELECT COUNT(*) + 1 FROM master_agreements 
        WHERE YEAR(created_at) = :year
    """), {"year": year})
    seq = result.fetchone()[0]
    return f"MA-{year}-{seq:03d}"


# ============================================================
# LIST AGREEMENTS
# ============================================================

@router.get("")
async def list_agreements(
    payer_profile_id: Optional[int] = None,
    status: Optional[str] = None,
    active_only: bool = False,
    db: Session = Depends(get_rh_db)
):
    """List master agreements with filters"""
    query = """
        SELECT 
            ma.id, ma.payer_profile_id, ma.contract_number, ma.template_version,
            ma.signed_at, ma.valid_from, ma.valid_until, ma.status,
            ma.created_at, ma.note,
            pp.company_name, pp.payer_type, pp.director_name
        FROM master_agreements ma
        LEFT JOIN payer_profiles pp ON pp.id = ma.payer_profile_id
        WHERE 1=1
    """
    params = {}
    
    if payer_profile_id:
        query += " AND ma.payer_profile_id = :payer_profile_id"
        params["payer_profile_id"] = payer_profile_id
    
    if status:
        query += " AND ma.status = :status"
        params["status"] = status
    
    if active_only:
        query += " AND ma.status = 'signed' AND ma.valid_until >= CURDATE()"
    
    query += " ORDER BY ma.created_at DESC"
    
    result = db.execute(text(query), params)
    
    agreements = []
    for row in result:
        agreements.append({
            "id": row[0],
            "payer_profile_id": row[1],
            "contract_number": row[2],
            "template_version": row[3],
            "signed_at": row[4].isoformat() if row[4] else None,
            "valid_from": row[5].isoformat() if row[5] else None,
            "valid_until": row[6].isoformat() if row[6] else None,
            "status": row[7],
            "created_at": row[8].isoformat() if row[8] else None,
            "note": row[9],
            "payer": {
                "company_name": row[10],
                "payer_type": row[11],
                "director_name": row[12]
            }
        })
    
    return {"agreements": agreements}


# ============================================================
# GET SINGLE AGREEMENT
# ============================================================

@router.get("/{agreement_id}")
async def get_agreement(agreement_id: int, db: Session = Depends(get_rh_db)):
    """Get single master agreement with full details"""
    result = db.execute(text("""
        SELECT 
            ma.id, ma.payer_profile_id, ma.contract_number, ma.template_version,
            ma.signed_at, ma.valid_from, ma.valid_until, ma.status,
            ma.snapshot_json, ma.pdf_path, ma.created_at, ma.note,
            pp.company_name, pp.payer_type, pp.director_name, pp.edrpou,
            pp.iban, pp.bank_name, pp.address
        FROM master_agreements ma
        LEFT JOIN payer_profiles pp ON pp.id = ma.payer_profile_id
        WHERE ma.id = :id
    """), {"id": agreement_id})
    
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Agreement not found")
    
    # Count annexes
    annex_count = db.execute(text("""
        SELECT COUNT(*) FROM order_annexes WHERE master_agreement_id = :id
    """), {"id": agreement_id}).fetchone()[0]
    
    return {
        "id": row[0],
        "payer_profile_id": row[1],
        "contract_number": row[2],
        "template_version": row[3],
        "signed_at": row[4].isoformat() if row[4] else None,
        "valid_from": row[5].isoformat() if row[5] else None,
        "valid_until": row[6].isoformat() if row[6] else None,
        "status": row[7],
        "snapshot_json": json.loads(row[8]) if row[8] else None,
        "pdf_path": row[9],
        "created_at": row[10].isoformat() if row[10] else None,
        "note": row[11],
        "payer": {
            "company_name": row[12],
            "payer_type": row[13],
            "director_name": row[14],
            "edrpou": row[15],
            "iban": row[16],
            "bank_name": row[17],
            "address": row[18]
        },
        "annex_count": annex_count
    }


# ============================================================
# CREATE AGREEMENT
# ============================================================

@router.post("/create")
async def create_agreement(data: MasterAgreementCreate, db: Session = Depends(get_rh_db)):
    """Create new master agreement"""
    
    # Validate payer profile exists
    payer = db.execute(text("""
        SELECT id, company_name, payer_type, director_name, edrpou, iban, bank_name, address
        FROM payer_profiles WHERE id = :id AND is_active = 1
    """), {"id": data.payer_profile_id}).fetchone()
    
    if not payer:
        raise HTTPException(status_code=400, detail="Payer profile not found")
    
    # Check for existing active agreement
    existing = db.execute(text("""
        SELECT id, contract_number FROM master_agreements 
        WHERE payer_profile_id = :pid AND status IN ('draft', 'sent', 'signed')
        AND (valid_until IS NULL OR valid_until >= CURDATE())
    """), {"pid": data.payer_profile_id}).fetchone()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Active agreement already exists: {existing[1]}"
        )
    
    # Calculate dates
    valid_from = datetime.fromisoformat(data.valid_from).date() if data.valid_from else date.today()
    valid_until = valid_from + timedelta(days=data.valid_months * 30)
    
    # Generate contract number
    contract_number = generate_contract_number(db, valid_from.year)
    
    # Build snapshot
    snapshot = {
        "payer": {
            "id": payer[0],
            "company_name": payer[1],
            "payer_type": payer[2],
            "director_name": payer[3],
            "edrpou": payer[4],
            "iban": payer[5],
            "bank_name": payer[6],
            "address": payer[7]
        },
        "contract_number": contract_number,
        "valid_from": valid_from.isoformat(),
        "valid_until": valid_until.isoformat(),
        "template_version": data.template_version,
        "generated_at": datetime.now().isoformat()
    }
    
    try:
        db.execute(text("""
            INSERT INTO master_agreements (
                payer_profile_id, contract_number, template_version,
                valid_from, valid_until, status, snapshot_json, note
            ) VALUES (
                :payer_profile_id, :contract_number, :template_version,
                :valid_from, :valid_until, 'draft', :snapshot_json, :note
            )
        """), {
            "payer_profile_id": data.payer_profile_id,
            "contract_number": contract_number,
            "template_version": data.template_version,
            "valid_from": valid_from,
            "valid_until": valid_until,
            "snapshot_json": json.dumps(snapshot, ensure_ascii=False),
            "note": data.note
        })
        
        agreement_id = db.execute(text("SELECT LAST_INSERT_ID()")).fetchone()[0]
        db.commit()
        
        return {
            "success": True,
            "agreement_id": agreement_id,
            "contract_number": contract_number,
            "valid_from": valid_from.isoformat(),
            "valid_until": valid_until.isoformat()
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# UPDATE AGREEMENT STATUS
# ============================================================

@router.put("/{agreement_id}")
async def update_agreement(
    agreement_id: int, 
    data: MasterAgreementUpdate, 
    db: Session = Depends(get_rh_db)
):
    """Update agreement status"""
    
    # Check exists
    existing = db.execute(text("""
        SELECT status FROM master_agreements WHERE id = :id
    """), {"id": agreement_id}).fetchone()
    
    if not existing:
        raise HTTPException(status_code=404, detail="Agreement not found")
    
    updates = []
    params = {"id": agreement_id}
    
    if data.status:
        valid_statuses = ["draft", "sent", "signed", "expired", "cancelled"]
        if data.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")
        updates.append("status = :status")
        params["status"] = data.status
        
        # Auto-set signed_at when marking as signed
        if data.status == "signed" and not data.signed_at:
            updates.append("signed_at = NOW()")
    
    if data.signed_at:
        updates.append("signed_at = :signed_at")
        params["signed_at"] = datetime.fromisoformat(data.signed_at)
    
    if data.note is not None:
        updates.append("note = :note")
        params["note"] = data.note
    
    if not updates:
        return {"success": True, "message": "Nothing to update"}
    
    try:
        db.execute(text(f"""
            UPDATE master_agreements SET {', '.join(updates)} WHERE id = :id
        """), params)
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# GET ACTIVE AGREEMENT FOR PAYER
# ============================================================

@router.get("/active/{payer_profile_id}")
async def get_active_agreement(payer_profile_id: int, db: Session = Depends(get_rh_db)):
    """Get active (signed, not expired) agreement for payer"""
    
    result = db.execute(text("""
        SELECT 
            id, contract_number, valid_from, valid_until, signed_at
        FROM master_agreements 
        WHERE payer_profile_id = :pid 
        AND status = 'signed'
        AND valid_until >= CURDATE()
        ORDER BY signed_at DESC
        LIMIT 1
    """), {"pid": payer_profile_id})
    
    row = result.fetchone()
    if not row:
        return {"exists": False, "message": "No active agreement"}
    
    return {
        "exists": True,
        "id": row[0],
        "contract_number": row[1],
        "valid_from": row[2].isoformat() if row[2] else None,
        "valid_until": row[3].isoformat() if row[3] else None,
        "signed_at": row[4].isoformat() if row[4] else None
    }


# ============================================================
# SEND AGREEMENT (mark as sent + email)
# ============================================================

@router.post("/{agreement_id}/send")
async def send_agreement(
    agreement_id: int,
    email: str = Query(..., description="Email to send to"),
    db: Session = Depends(get_rh_db)
):
    """Mark agreement as sent and send email"""
    
    # Get agreement
    agreement = db.execute(text("""
        SELECT ma.id, ma.contract_number, ma.status, pp.email as payer_email
        FROM master_agreements ma
        LEFT JOIN payer_profiles pp ON pp.id = ma.payer_profile_id
        WHERE ma.id = :id
    """), {"id": agreement_id}).fetchone()
    
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    
    try:
        # Update status
        db.execute(text("""
            UPDATE master_agreements SET status = 'sent' WHERE id = :id AND status = 'draft'
        """), {"id": agreement_id})
        
        # Log email send (actual email sending would be here)
        # TODO: Integrate with email service
        
        db.commit()
        return {
            "success": True, 
            "message": f"Agreement {agreement[1]} marked as sent to {email}"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# EXPIRE OLD AGREEMENTS (for cron)
# ============================================================

@router.post("/expire-old")
async def expire_old_agreements(db: Session = Depends(get_rh_db)):
    """Mark expired agreements (for cron job)"""
    try:
        result = db.execute(text("""
            UPDATE master_agreements 
            SET status = 'expired' 
            WHERE status = 'signed' AND valid_until < CURDATE()
        """))
        db.commit()
        return {"success": True, "expired_count": result.rowcount}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
