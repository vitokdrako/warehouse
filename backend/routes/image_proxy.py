"""
Image proxy route для отримання зображень з production сервера
Використовується тільки для preview, в production зображення локальні
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import httpx
import logging

router = APIRouter(prefix="/api/image-proxy", tags=["image-proxy"])
logger = logging.getLogger(__name__)

# Backend сервер де знаходяться зображення в /home/farforre/farforrent.com.ua/rentalhub/backend/static/images/products
PRODUCTION_URL = "https://backrentalhub.farforrent.com.ua"

@router.get("/{path:path}")
async def proxy_image(path: str):
    """
    Проксує зображення з production сервера
    Використовується тільки для preview середовища
    """
    try:
        image_url = f"{PRODUCTION_URL}/{path}"
        logger.info(f"Proxying image: {image_url}")
        
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            response = await client.get(image_url)
            
            if response.status_code == 200:
                # Визначити content-type
                content_type = response.headers.get("content-type", "image/jpeg")
                
                return StreamingResponse(
                    iter([response.content]),
                    media_type=content_type,
                    headers={
                        "Cache-Control": "public, max-age=86400",  # 24 години
                        "Access-Control-Allow-Origin": "*"
                    }
                )
            else:
                raise HTTPException(status_code=response.status_code, detail="Image not found")
                
    except httpx.TimeoutException as e:
        logger.error(f"Timeout proxying image {path}: {str(e)}")
        raise HTTPException(status_code=504, detail="Image proxy timeout")
    except httpx.HTTPError as e:
        logger.error(f"HTTP error proxying image {path}: {str(e)}")
        raise HTTPException(status_code=502, detail="Image proxy HTTP error")
    except Exception as e:
        logger.error(f"Error proxying image {path}: {type(e).__name__} - {str(e)}")
        raise HTTPException(status_code=500, detail=f"Image proxy error: {type(e).__name__}")
