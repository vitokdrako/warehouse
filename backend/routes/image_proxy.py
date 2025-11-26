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

# OpenCart сайт який має доступ до всіх зображень
PRODUCTION_URL = "https://www.farforrent.com.ua"

@router.get("/{path:path}")
async def proxy_image(path: str):
    """
    Проксує зображення з production сервера
    Використовується тільки для preview середовища
    
    ВАЖЛИВО: Production backend не має mount для /static директорії,
    тому повертаємо placeholder зображення для preview.
    """
    try:
        image_url = f"{PRODUCTION_URL}/{path}"
        logger.info(f"Attempting to proxy image: {image_url}")
        
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            response = await client.get(image_url)
            
            if response.status_code == 200:
                content_type = response.headers.get("content-type", "image/jpeg")
                
                # Перевірка чи це справді зображення, а не HTML
                if "text/html" in content_type or "application/json" in content_type:
                    logger.warning(f"Production returned {content_type} instead of image for {path}")
                    # Повертаємо placeholder SVG
                    return StreamingResponse(
                        iter([generate_placeholder_svg(path)]),
                        media_type="image/svg+xml",
                        headers={
                            "Cache-Control": "public, max-age=3600",
                            "Access-Control-Allow-Origin": "*"
                        }
                    )
                
                return StreamingResponse(
                    iter([response.content]),
                    media_type=content_type,
                    headers={
                        "Cache-Control": "public, max-age=86400",
                        "Access-Control-Allow-Origin": "*"
                    }
                )
            else:
                logger.warning(f"Production returned {response.status_code} for {path}")
                return StreamingResponse(
                    iter([generate_placeholder_svg(path)]),
                    media_type="image/svg+xml",
                    headers={
                        "Cache-Control": "public, max-age=3600",
                        "Access-Control-Allow-Origin": "*"
                    }
                )
                
    except httpx.TimeoutException as e:
        logger.error(f"Timeout proxying image {path}: {str(e)}")
        return StreamingResponse(
            iter([generate_placeholder_svg(path)]),
            media_type="image/svg+xml"
        )
    except Exception as e:
        logger.error(f"Error proxying image {path}: {type(e).__name__} - {str(e)}")
        return StreamingResponse(
            iter([generate_placeholder_svg(path)]),
            media_type="image/svg+xml"
        )


def generate_placeholder_svg(path: str) -> bytes:
    """
    Генерує placeholder SVG зображення для випадків коли справжнє зображення недоступне
    """
    # Отримати ім'я файлу з шляху
    filename = path.split('/')[-1] if '/' in path else path
    filename = filename[:20] + '...' if len(filename) > 20 else filename
    
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#f1f5f9"/>
  <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="16" fill="#64748b" font-weight="bold">
    Зображення недоступне
  </text>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="12" fill="#94a3b8">
    {filename}
  </text>
  <circle cx="200" cy="170" r="30" fill="none" stroke="#cbd5e1" stroke-width="3"/>
  <circle cx="200" cy="170" r="8" fill="#cbd5e1"/>
  <path d="M 180 190 L 200 170 L 220 190" stroke="#cbd5e1" stroke-width="3" 
        fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''
    return svg.encode('utf-8')
