"""
Centralized image URL helper for backend
All product image URLs should be processed through this helper
"""

def normalize_image_url(image_path: str | None) -> str | None:
    """
    Convert image path from database to proper URL
    
    Args:
        image_path: Image path from database (can be relative or full URL)
        
    Returns:
        Full image URL or None
        
    Examples:
        - "static/images/products/image.jpg" -> "static/images/products/image.jpg"
        - "catalog/product/image.jpg" -> "static/images/catalog/product/image.jpg"
        - "https://example.com/image.jpg" -> "https://example.com/image.jpg"
        - None -> None
    """
    if not image_path:
        return None
    
    # Already a full URL or starts with static/, uploads/ or /
    if (image_path.startswith('http://') or 
        image_path.startswith('https://') or 
        image_path.startswith('static/') or
        image_path.startswith('uploads/') or  # ✅ Додано uploads/
        image_path.startswith('/')):
        return image_path
    
    # Relative path from old OpenCart structure - convert to new static path
    # Example: "catalog/product/image.jpg" -> "static/images/catalog/product/image.jpg"
    return f"static/images/{image_path}"
