"""
Tasks routes
✅ MIGRATED: Using RentalHub DB
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import uuid

from database_rentalhub import get_rh_db  # ✅ Using RentalHub DB

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
    task_type: Optional[str] = None,
    order_id: Optional[int] = None,
    assigned_to: Optional[str] = None,
    db: Session = Depends(get_rh_db)  # ✅ MIGRATED
):
    """
    Get all tasks
    ✅ MIGRATED: Using RentalHub DB (tasks table)
    """
    sql_query = """
        SELECT 
            t.*,
            d.case_number as damage_case_number
        FROM tasks t
        LEFT JOIN damages d ON t.damage_id = d.id
        WHERE 1=1
    """
    params = {}
    
    if status:
        sql_query += " AND t.status = :status"
        params['status'] = status
    if task_type:
        sql_query += " AND t.task_type = :task_type"
        params['task_type'] = task_type
    if order_id:
        sql_query += " AND t.order_id = :order_id"
        params['order_id'] = order_id
    if assigned_to:
        sql_query += " AND t.assigned_to = :assigned_to"
        params['assigned_to'] = assigned_to
    
    sql_query += " ORDER BY t.created_at DESC"
    
    result = db.execute(text(sql_query), params)
    
    tasks = []
    for row in result:
        tasks.append({
            "id": row[0],
            "order_id": row[1],
            "order_number": row[2],
            "damage_id": row[3],
            "title": row[4],
            "description": row[5],
            "task_type": row[6],
            "status": row[7],
            "priority": row[8],
            "assigned_to": row[9],
            "due_date": row[10].isoformat() if row[10] else None,
            "completed_at": row[11].isoformat() if row[11] else None,
            "created_by": row[12],
            "created_at": row[13].isoformat() if row[13] else None,
            "updated_at": row[14].isoformat() if row[14] else None,
            "damage_case_number": row[15]
        })
    
    return tasks

@router.post("")
async def create_task(
    task: TaskCreate,
    db: Session = Depends(get_rh_db)  # ✅ MIGRATED
):
    """
    Create new task
    ✅ MIGRATED: Using RentalHub DB
    """
    task_id = str(uuid.uuid4())
    
    db.execute(text("""
        INSERT INTO tasks (
            id, order_id, order_number, damage_id, title, description,
            task_type, status, priority, assigned_to, due_date,
            created_by, created_at, updated_at
        )
        VALUES (
            :id, :order_id, :order_number, :damage_id, :title, :description,
            :task_type, :status, :priority, :assigned_to, :due_date,
            :created_by, NOW(), NOW()
        )
    """), {
        "id": task_id,
        "order_id": task.order_id,
        "order_number": task.order_number,
        "damage_id": task.damage_id,
        "title": task.title,
        "description": task.description,
        "task_type": task.task_type,
        "status": task.status,
        "priority": task.priority,
        "assigned_to": task.assigned_to,
        "due_date": task.due_date,
        "created_by": "system"
    })
    
    db.commit()
    
    return {"id": task_id, "message": "Task created successfully"}

@router.get("/{task_id}")
async def get_task(
    task_id: str,
    db: Session = Depends(get_rh_db)  # ✅ MIGRATED
):
    """
    Get single task
    ✅ MIGRATED: Using RentalHub DB
    """
    result = db.execute(text("""
        SELECT * FROM tasks WHERE id = :task_id
    """), {"task_id": task_id})
    
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {
        "id": row[0],
        "order_id": row[1],
        "order_number": row[2],
        "damage_id": row[3],
        "title": row[4],
        "description": row[5],
        "task_type": row[6],
        "status": row[7],
        "priority": row[8],
        "assigned_to": row[9],
        "due_date": row[10].isoformat() if row[10] else None,
        "completed_at": row[11].isoformat() if row[11] else None,
        "created_by": row[12],
        "created_at": row[13].isoformat() if row[13] else None,
        "updated_at": row[14].isoformat() if row[14] else None
    }

@router.put("/{task_id}")
async def update_task(
    task_id: str,
    task: TaskUpdate,
    db: Session = Depends(get_rh_db)  # ✅ MIGRATED
):
    """
    Update task
    ✅ MIGRATED: Using RentalHub DB
    """
    # Check if exists
    result = db.execute(text("SELECT id FROM tasks WHERE id = :task_id"), {"task_id": task_id})
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Build update query dynamically
    updates = []
    params = {"task_id": task_id}
    
    if task.title is not None:
        updates.append("title = :title")
        params['title'] = task.title
    if task.description is not None:
        updates.append("description = :description")
        params['description'] = task.description
    if task.task_type is not None:
        updates.append("task_type = :task_type")
        params['task_type'] = task.task_type
    if task.status is not None:
        updates.append("status = :status")
        params['status'] = task.status
    if task.priority is not None:
        updates.append("priority = :priority")
        params['priority'] = task.priority
    if task.assigned_to is not None:
        updates.append("assigned_to = :assigned_to")
        params['assigned_to'] = task.assigned_to
    if task.due_date is not None:
        updates.append("due_date = :due_date")
        params['due_date'] = task.due_date
    if task.completed_at is not None:
        updates.append("completed_at = :completed_at")
        params['completed_at'] = task.completed_at
    
    if updates:
        updates.append("updated_at = NOW()")
        sql = f"UPDATE tasks SET {', '.join(updates)} WHERE id = :task_id"
        db.execute(text(sql), params)
        db.commit()
    
    return {"message": "Task updated successfully"}

@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    db: Session = Depends(get_rh_db)  # ✅ MIGRATED
):
    """
    Delete task
    ✅ MIGRATED: Using RentalHub DB
    """
    result = db.execute(text("DELETE FROM tasks WHERE id = :task_id"), {"task_id": task_id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"message": "Task deleted successfully"}
