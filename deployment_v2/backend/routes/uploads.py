"""
Uploads API - роздача завантажених файлів через API
Використовується коли nginx не налаштований для статичних файлів
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import mimetypes

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_ROOT = Path(__file__).parent.parent / "uploads"

@router.get("/damage_photos/{filename}")
async def get_damage_photo(filename: str):
    """Віддає фото пошкодження"""
    file_path = UPLOAD_ROOT / "damage_photos" / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Файл не знайдено")
    
    # Визначаємо MIME тип
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if not mime_type:
        mime_type = "application/octet-stream"
    
    return FileResponse(
        path=file_path,
        media_type=mime_type,
        filename=filename
    )

@router.get("/products/{filename}")
async def get_product_image(filename: str):
    """Віддає фото товару"""
    file_path = UPLOAD_ROOT / "products" / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Файл не знайдено")
    
    mime_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(path=file_path, media_type=mime_type or "image/jpeg")

@router.get("/products/thumbnails/{filename}")
async def get_product_thumbnail(filename: str):
    """Віддає thumbnail товару"""
    file_path = UPLOAD_ROOT / "products" / "thumbnails" / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Файл не знайдено")
    
    mime_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(path=file_path, media_type=mime_type or "image/jpeg")
