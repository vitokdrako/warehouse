/**
 * 🖼️ ЄДИНЕ ДЖЕРЕЛО ПРАВДИ для зображень товарів
 * 
 * Підтримувані формати:
 * 1. uploads/products/ - нові фото (3 розміри)
 * 2. static/images/ - старі фото (legacy)
 * 3. catalog/ - шляхи з OpenCart
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Перетворює шлях до зображення з БД в повний URL
 * @param {string} url - Шлях до зображення з БД
 * @returns {string|null} - Повний URL або null
 */
export const getImageUrl = (url) => {
  if (!url) return null;
  
  // Вже повний URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Новий формат - uploads/ → використовуємо /api/uploads/ для сумісності з nginx
  if (url.startsWith('uploads/')) {
    // uploads/products/file.jpg → /api/uploads/products/file.jpg
    const path = url.replace('uploads/', '');
    return `${BACKEND_URL}/api/uploads/${path}`;
  }
  
  // Формат /uploads/ (з початковим слешем)
  if (url.startsWith('/uploads/')) {
    const path = url.replace('/uploads/', '');
    return `${BACKEND_URL}/api/uploads/${path}`;
  }
  
  // Старий формат - static/images/ (legacy фото на production)
  if (url.startsWith('static/images/')) {
    return `${BACKEND_URL}/${url}`;
  }
  
  // OpenCart формат - catalog/
  if (url.startsWith('catalog/')) {
    return `https://www.farforrent.com.ua/image/${url}`;
  }
  
  // Невідомий формат - спробуємо як відносний шлях
  return `${BACKEND_URL}/${url}`;
};

// Fallback зображення для помилок завантаження
export const FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23f1f5f9"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%2394a3b8"%3EНема фото%3C/text%3E%3C/svg%3E';

/**
 * Обробник помилок завантаження зображення
 */
export const handleImageError = (e) => {
  e.target.src = FALLBACK_IMAGE;
  e.target.crossOrigin = null; // Видалити crossOrigin атрибут
};
