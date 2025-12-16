"""
Clients routes - MySQL version
Reads from OpenCart oc_customer
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from database import get_db
from models_sqlalchemy import OpenCartCustomer, OpenCartOrder

router = APIRouter(prefix="/api/clients", tags=["clients"])

# ============================================================
# PYDANTIC MODELS
# ============================================================

class Client(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    status: str
    total_orders: int
    date_added: str

# ============================================================
# API ENDPOINTS
# ============================================================

@router.get("")
async def get_clients(
    search: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all clients from OpenCart customers"""
    query = db.query(OpenCartCustomer)
    
    # Search by name, email or phone
    if search:
        query = query.filter(
            or_(
                OpenCartCustomer.firstname.like(f"%{search}%"),
                OpenCartCustomer.lastname.like(f"%{search}%"),
                OpenCartCustomer.email.like(f"%{search}%"),
                OpenCartCustomer.telephone.like(f"%{search}%")
            )
        )
    
    customers = query.limit(limit).all()
    
    result = []
    for customer in customers:
        # Count orders for this customer
        order_count = db.query(func.count(OpenCartOrder.order_id)).filter(
            OpenCartOrder.customer_id == customer.customer_id
        ).scalar() or 0
        
        result.append({
            "id": str(customer.customer_id),
            "name": f"{customer.firstname} {customer.lastname}",
            "email": customer.email,
            "phone": customer.telephone or "",
            "status": "active" if customer.status == 1 else "inactive",
            "total_orders": order_count,
            "date_added": customer.date_added.isoformat() if customer.date_added else None
        })
    
    return result

@router.get("/{client_id}")
async def get_client(client_id: str, db: Session = Depends(get_db)):
    """Get single client"""
    try:
        customer = db.query(OpenCartCustomer).filter(
            OpenCartCustomer.customer_id == int(client_id)
        ).first()
    except ValueError:
        customer = None
    
    if not customer:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get client orders
    orders = db.query(OpenCartOrder).filter(
        OpenCartOrder.customer_id == customer.customer_id
    ).order_by(OpenCartOrder.date_added.desc()).limit(10).all()
    
    order_list = [
        {
            "order_id": order.order_id,
            "total": float(order.total),
            "date": order.date_added.isoformat() if order.date_added else None
        }
        for order in orders
    ]
    
    return {
        "id": str(customer.customer_id),
        "name": f"{customer.firstname} {customer.lastname}",
        "email": customer.email,
        "phone": customer.telephone or "",
        "status": "active" if customer.status == 1 else "inactive",
        "total_orders": len(orders),
        "recent_orders": order_list,
        "date_added": customer.date_added.isoformat() if customer.date_added else None
    }
