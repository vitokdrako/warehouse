"""
Admin Panel API - Адмін-панель
Управління користувачами та категоріями
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import text
from database_rentalhub import get_rh_db
from datetime import datetime
import bcrypt
import jwt
import os

router = APIRouter(prefix="/api/admin", tags=["admin"])

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"

def get_current_user(authorization: str = Header(None)):
    """Extract user info from JWT token"""
    if not authorization or not authorization.startswith('Bearer '):
        return None
    
    try:
        token = authorization.split(' ')[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {
            'email': payload.get('email'),
            'username': payload.get('username') or payload.get('sub'),
            'user_id': payload.get('user_id'),
            'role': payload.get('role')
        }
    except Exception as e:
        return None

def require_admin(authorization: str = Header(None)):
    """Require admin role"""
    user = get_current_user(authorization)
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Доступ тільки для адміністраторів")
    return user


# ============= КОРИСТУВАЧІ =============

@router.get("/users")
async def get_users(
    authorization: str = Header(None),
    rh_db: Session = Depends(get_rh_db)
):
    """Отримати всіх користувачів (тільки для адмінів)"""
    require_admin(authorization)
    
    try:
        query = text("""
            SELECT 
                user_id, username, email, firstname, lastname, 
                role, is_active, created_at, last_login
            FROM users
            ORDER BY created_at DESC
        """)
        
        results = rh_db.execute(query).fetchall()
        
        users = []
        for row in results:
            users.append({
                'user_id': row[0],
                'username': row[1],
                'email': row[2],
                'firstname': row[3],
                'lastname': row[4],
                'role': row[5],
                'is_active': bool(row[6]),
                'created_at': row[7].isoformat() if row[7] else None,
                'last_login': row[8].isoformat() if row[8] else None
            })
        
        return users
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.post("/users")
async def create_user(
    data: dict,
    authorization: str = Header(None),
    rh_db: Session = Depends(get_rh_db)
):
    """Створити нового користувача"""
    require_admin(authorization)
    
    try:
        username = data.get('username')
        email = data.get('email')
        password = data.get('password', 'temp123')
        firstname = data.get('firstname')
        lastname = data.get('lastname')
        role = data.get('role', 'requisitor')
        
        if not username or not email:
            raise HTTPException(status_code=400, detail="Username та email обов'язкові")
        
        # Хешуємо пароль
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        query = text("""
            INSERT INTO users (username, email, password_hash, firstname, lastname, role)
            VALUES (:username, :email, :password_hash, :firstname, :lastname, :role)
        """)
        
        rh_db.execute(query, {
            'username': username,
            'email': email,
            'password_hash': password_hash,
            'firstname': firstname,
            'lastname': lastname,
            'role': role
        })
        
        rh_db.commit()
        
        return {
            'success': True,
            'message': f'Користувача {username} створено'
        }
        
    except Exception as e:
        rh_db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    data: dict,
    authorization: str = Header(None),
    rh_db: Session = Depends(get_rh_db)
):
    """Оновити користувача"""
    require_admin(authorization)
    
    try:
        updates = []
        params = {'user_id': user_id}
        
        if 'username' in data:
            updates.append("username = :username")
            params['username'] = data['username']
        
        if 'email' in data:
            updates.append("email = :email")
            params['email'] = data['email']
        
        if 'firstname' in data:
            updates.append("firstname = :firstname")
            params['firstname'] = data['firstname']
        
        if 'lastname' in data:
            updates.append("lastname = :lastname")
            params['lastname'] = data['lastname']
        
        if 'role' in data:
            updates.append("role = :role")
            params['role'] = data['role']
        
        if 'is_active' in data:
            updates.append("is_active = :is_active")
            params['is_active'] = data['is_active']
        
        if 'password' in data:
            password_hash = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            updates.append("password_hash = :password_hash")
            params['password_hash'] = password_hash
        
        if not updates:
            raise HTTPException(status_code=400, detail="Немає даних для оновлення")
        
        query = text(f"UPDATE users SET {', '.join(updates)} WHERE user_id = :user_id")
        rh_db.execute(query, params)
        rh_db.commit()
        
        return {
            'success': True,
            'message': 'Користувача оновлено'
        }
        
    except Exception as e:
        rh_db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    authorization: str = Header(None),
    rh_db: Session = Depends(get_rh_db)
):
    """Видалити користувача"""
    admin = require_admin(authorization)
    
    # Не можна видалити себе
    if admin.get('user_id') == user_id:
        raise HTTPException(status_code=400, detail="Не можна видалити свій власний акаунт")
    
    try:
        query = text("DELETE FROM users WHERE user_id = :user_id")
        result = rh_db.execute(query, {'user_id': user_id})
        rh_db.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Користувача не знайдено")
        
        return {
            'success': True,
            'message': 'Користувача видалено'
        }
        
    except Exception as e:
        rh_db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


# ============= КАТЕГОРІЇ =============

@router.get("/categories")
async def get_categories(
    authorization: str = Header(None),
    rh_db: Session = Depends(get_rh_db)
):
    """Отримати всі категорії (дерево)"""
    require_admin(authorization)
    
    try:
        query = text("""
            SELECT 
                category_id, name, parent_id, description, 
                sort_order, is_active, created_at
            FROM categories
            ORDER BY parent_id, sort_order, name
        """)
        
        results = rh_db.execute(query).fetchall()
        
        categories = []
        for row in results:
            categories.append({
                'category_id': row[0],
                'name': row[1],
                'parent_id': row[2],
                'description': row[3],
                'sort_order': row[4],
                'is_active': bool(row[5]),
                'created_at': row[6].isoformat() if row[6] else None
            })
        
        return categories
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.post("/categories")
async def create_category(
    data: dict,
    authorization: str = Header(None),
    rh_db: Session = Depends(get_rh_db)
):
    """Створити нову категорію та синхронізувати з OpenCart"""
    require_admin(authorization)
    
    try:
        name = data.get('name')
        parent_id = data.get('parent_id')
        description = data.get('description', '')
        sort_order = data.get('sort_order', 0)
        
        if not name:
            raise HTTPException(status_code=400, detail="Назва категорії обов'язкова")
        
        # Створюємо в RentalHub
        query = text("""
            INSERT INTO categories (name, parent_id, description, sort_order)
            VALUES (:name, :parent_id, :description, :sort_order)
        """)
        
        rh_db.execute(query, {
            'name': name,
            'parent_id': parent_id,
            'description': description,
            'sort_order': sort_order
        })
        
        rh_db.commit()
        
        # Отримуємо новий ID
        new_id = rh_db.execute(text("SELECT LAST_INSERT_ID()")).fetchone()[0]
        
        # Синхронізація з OpenCart
        try:
            from database import get_db
            oc_db = next(get_db())
            
            # Знаходимо OpenCart parent_id
            oc_parent_id = 0
            if parent_id:
                parent_query = text("SELECT category_id FROM categories WHERE category_id = :id")
                parent_result = rh_db.execute(parent_query, {'id': parent_id}).fetchone()
                if parent_result:
                    oc_parent_id = parent_result[0]
            
            # Створюємо в oc_category
            oc_insert = text("""
                INSERT INTO oc_category (parent_id, top, sort_order, status, date_added, date_modified)
                VALUES (:parent_id, 0, :sort_order, 1, NOW(), NOW())
            """)
            
            oc_db.execute(oc_insert, {
                'parent_id': oc_parent_id,
                'sort_order': sort_order
            })
            
            oc_category_id = oc_db.execute(text("SELECT LAST_INSERT_ID()")).fetchone()[0]
            
            # Додаємо опис (українська мова - language_id 1)
            oc_desc_insert = text("""
                INSERT INTO oc_category_description (category_id, language_id, name, description, meta_title)
                VALUES (:category_id, 1, :name, :description, :name)
            """)
            
            oc_db.execute(oc_desc_insert, {
                'category_id': oc_category_id,
                'name': name,
                'description': description
            })
            
            oc_db.commit()
            
            return {
                'success': True,
                'message': f'Категорію "{name}" створено та синхронізовано з OpenCart'
            }
        except Exception as oc_error:
            print(f"OpenCart sync error: {oc_error}")
            return {
                'success': True,
                'message': f'Категорію "{name}" створено (помилка синхронізації з OpenCart)'
            }
        
    except Exception as e:
        rh_db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.put("/categories/{category_id}")
async def update_category(
    category_id: int,
    data: dict,
    authorization: str = Header(None),
    rh_db: Session = Depends(get_rh_db)
):
    """Оновити категорію та синхронізувати з OpenCart"""
    require_admin(authorization)
    
    try:
        updates = []
        params = {'category_id': category_id}
        
        if 'name' in data:
            updates.append("name = :name")
            params['name'] = data['name']
        
        if 'parent_id' in data:
            updates.append("parent_id = :parent_id")
            params['parent_id'] = data['parent_id']
        
        if 'description' in data:
            updates.append("description = :description")
            params['description'] = data['description']
        
        if 'sort_order' in data:
            updates.append("sort_order = :sort_order")
            params['sort_order'] = data['sort_order']
        
        if 'is_active' in data:
            updates.append("is_active = :is_active")
            params['is_active'] = data['is_active']
        
        if not updates:
            raise HTTPException(status_code=400, detail="Немає даних для оновлення")
        
        # Оновлюємо в RentalHub
        query = text(f"UPDATE categories SET {', '.join(updates)} WHERE category_id = :category_id")
        rh_db.execute(query, params)
        rh_db.commit()
        
        # Синхронізація з OpenCart
        try:
            from database import get_db
            oc_db = next(get_db())
            
            # Оновлюємо в oc_category
            oc_updates = []
            oc_params = {'category_id': category_id}
            
            if 'sort_order' in data:
                oc_updates.append("sort_order = :sort_order")
                oc_params['sort_order'] = data['sort_order']
            
            if 'is_active' in data:
                oc_updates.append("status = :status")
                oc_params['status'] = 1 if data['is_active'] else 0
            
            if oc_updates:
                oc_query = text(f"UPDATE oc_category SET {', '.join(oc_updates)}, date_modified = NOW() WHERE category_id = :category_id")
                oc_db.execute(oc_query, oc_params)
            
            # Оновлюємо опис
            if 'name' in data or 'description' in data:
                oc_desc_updates = []
                oc_desc_params = {'category_id': category_id}
                
                if 'name' in data:
                    oc_desc_updates.append("name = :name, meta_title = :name")
                    oc_desc_params['name'] = data['name']
                
                if 'description' in data:
                    oc_desc_updates.append("description = :description")
                    oc_desc_params['description'] = data['description']
                
                oc_desc_query = text(f"UPDATE oc_category_description SET {', '.join(oc_desc_updates)} WHERE category_id = :category_id AND language_id = 1")
                oc_db.execute(oc_desc_query, oc_desc_params)
            
            oc_db.commit()
            
            return {
                'success': True,
                'message': 'Категорію оновлено та синхронізовано з OpenCart'
            }
        except Exception as oc_error:
            print(f"OpenCart sync error: {oc_error}")
            return {
                'success': True,
                'message': 'Категорію оновлено (помилка синхронізації з OpenCart)'
            }
        
    except Exception as e:
        rh_db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: int,
    authorization: str = Header(None),
    rh_db: Session = Depends(get_rh_db)
):
    """Видалити категорію"""
    require_admin(authorization)
    
    try:
        # Перевіряємо чи є підкатегорії
        check_query = text("SELECT COUNT(*) FROM categories WHERE parent_id = :category_id")
        result = rh_db.execute(check_query, {'category_id': category_id}).fetchone()
        
        if result[0] > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Не можна видалити категорію, яка має {result[0]} підкатегорій"
            )
        
        query = text("DELETE FROM categories WHERE category_id = :category_id")
        result = rh_db.execute(query, {'category_id': category_id})
        rh_db.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Категорію не знайдено")
        
        return {
            'success': True,
            'message': 'Категорію видалено'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        rh_db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")
