"""
Tasks routes - MySQL version
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from database import get_db
from models_sqlalchemy import DecorTask

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

# ============================================================
# PYDANTIC MODELS
# ============================================================

class TaskCreate(BaseModel):
    order_id: Optional[int] = None
    order_number: Optional[str] = None
    damage_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    task_type: str = "general"
    status: str = "todo"
    priority: str = "medium"
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    task_type: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None

# ============================================================
# API ENDPOINTS
# ============================================================

@router.get("")
async def get_tasks(
    status: Optional[str] = None,
    order_id: Optional[int] = None,
    assigned_to: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all tasks"""
    query = db.query(DecorTask)
    
    if status:
        query = query.filter(DecorTask.status == status)
    if order_id:
        query = query.filter(DecorTask.order_id == order_id)
    if assigned_to:
        query = query.filter(DecorTask.assigned_to == assigned_to)
    
    tasks = query.order_by(DecorTask.created_at.desc()).all()
    
    return [
        {
            "id": task.id,
            "order_id": task.order_id,
            "order_number": task.order_number,
            "damage_id": task.damage_id,
            "title": task.title,
            "description": task.description,
            "task_type": task.task_type,
            "status": task.status,
            "priority": task.priority,
            "assigned_to": task.assigned_to,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "created_by": task.created_by,
            "created_at": task.created_at.isoformat(),
            "updated_at": task.updated_at.isoformat()
        }
        for task in tasks
    ]

@router.get("/{task_id}")
async def get_task(task_id: str, db: Session = Depends(get_db)):
    """Get single task"""
    task = db.query(DecorTask).filter(DecorTask.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {
        "id": task.id,
        "order_id": task.order_id,
        "order_number": task.order_number,
        "damage_id": task.damage_id,
        "title": task.title,
        "description": task.description,
        "task_type": task.task_type,
        "status": task.status,
        "priority": task.priority,
        "assigned_to": task.assigned_to,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "created_by": task.created_by,
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat()
    }

@router.post("")
async def create_task(task_data: TaskCreate, db: Session = Depends(get_db)):
    """Create new task"""
    task_id = f"TASK-{str(uuid.uuid4())[:8].upper()}"
    
    new_task = DecorTask(
        id=task_id,
        order_id=task_data.order_id,
        order_number=task_data.order_number,
        damage_id=task_data.damage_id,
        title=task_data.title,
        description=task_data.description,
        task_type=task_data.task_type,
        status=task_data.status,
        priority=task_data.priority,
        assigned_to=task_data.assigned_to,
        due_date=task_data.due_date,
        created_by="Manager"
    )
    
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    
    return await get_task(task_id, db)

@router.put("/{task_id}")
async def update_task(task_id: str, task_data: TaskUpdate, db: Session = Depends(get_db)):
    """Update task"""
    task = db.query(DecorTask).filter(DecorTask.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task_data.title is not None:
        task.title = task_data.title
    if task_data.description is not None:
        task.description = task_data.description
    if task_data.task_type is not None:
        task.task_type = task_data.task_type
    if task_data.status is not None:
        task.status = task_data.status
        if task_data.status == "done" and not task.completed_at:
            task.completed_at = datetime.utcnow()
    if task_data.priority is not None:
        task.priority = task_data.priority
    if task_data.assigned_to is not None:
        task.assigned_to = task_data.assigned_to
    if task_data.due_date is not None:
        task.due_date = task_data.due_date
    if task_data.completed_at is not None:
        task.completed_at = task_data.completed_at
    
    db.commit()
    db.refresh(task)
    
    return await get_task(task_id, db)

@router.delete("/{task_id}")
async def delete_task(task_id: str, db: Session = Depends(get_db)):
    """Delete task"""
    task = db.query(DecorTask).filter(DecorTask.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(task)
    db.commit()
    
    return {"message": "Task deleted successfully"}
