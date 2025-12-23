/**
 * 🖼️ ЄДИНЕ ДЖЕРЕЛО ПРАВДИ для зображень товарів
 * 
 * Тільки uploads/products/ - найвища якість, 3 розміри
 * Структура: /home/farforre/farforrent.com.ua/rentalhub/backend/uploads/products/
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Перетворює шлях до зображення з БД в повний URL
 * @param {string} url - Шлях до зображення з БД (має бути uploads/products/...)
 * @returns {string|null} - Повний URL або null
 */
export const getImageUrl = (url) => {
  if (!url) return null;
  
  // Вже повний URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Тільки uploads/ - всі фото мають бути тут
  if (url.startsWith('uploads/')) {
    return `${BACKEND_URL}/${url}`;
  }
  
  // Якщо не починається з uploads/ - це старий формат, ігноруємо
  console.warn('[ImageHelper] ⚠️ Image path should start with "uploads/products/":', url);
  return null;
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
