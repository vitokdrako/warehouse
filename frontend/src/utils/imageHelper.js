/**
 * Централізована функція для роботи з URL зображень
 * Обробляє всі типи шляхів з БД та мапить їх на реальну структуру файлів
 * 
 * Для роботи з одного домену (rentalhub.farforrent.com.ua):
 * - В production: зображення доступні локально через /static/
 * - В preview: використовуємо production домен для зображень
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://backrentalhub.farforrent.com.ua';
// Production сервер де знаходяться всі зображення
const PRODUCTION_IMAGE_URL = 'https://rentalhub.farforrent.com.ua';
// Визначаємо чи це preview середовище
const isPreview = window.location.hostname.includes('preview.emergentagent.com') || window.location.hostname.includes('localhost');

/**
 * Перетворює шлях до зображення з БД в повний URL
 * @param {string} url - Шлях до зображення з БД
 * @returns {string|null} - Повний URL або null
 * 
 * Приклади шляхів в БД та їх мапування:
 * - catalog/NEW2/IMG_4710.png → /static/images/products/NEW2/IMG_4710.png
 * - static/images/catalog/products/... → /static/images/catalog/products/...
 * - image/catalog/... → використовуємо OpenCart для preview
 * 
 * Реальна структура на сервері rentalhub.farforrent.com.ua:
 * /home/farforre/farforrent.com.ua/rentalhub/backend/static/images/products/NEW2/IMG_4710.png
 */
export const getImageUrl = (url) => {
  if (!url) return null;
  
  // Вже повний URL (http:// або https://)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Debug: log environment
  if (window.location.hostname.includes('preview')) {
    console.log('[ImageHelper] Preview mode detected, using proxy for:', url);
  }
  
  let mappedPath = '';
  
  // ПРІОРИТЕТ 1: Шляхи що починаються з 'uploads/' (наші завантажені фото - найвища якість)
  if (url.startsWith('uploads/')) {
    mappedPath = url;
  }
  // ПРІОРИТЕТ 2: Шляхи що починаються з 'static/' (локальні файли)
  else if (url.startsWith('static/')) {
    mappedPath = url;
  }
  // ПРІОРИТЕТ 3: Шляхи що починаються з 'image/catalog/' (OpenCart - запасний варіант)
  else if (url.startsWith('image/catalog/')) {
    mappedPath = url;
  }
  // Конвертація: static/images/catalog/ → image/catalog/ (для старих записів)
  else if (url.startsWith('static/images/catalog/')) {
    mappedPath = url.replace('static/images/', 'image/');
  }
  // Конвертація: catalog/ → image/catalog/ (формат з БД без префіксу)
  else if (url.startsWith('catalog/')) {
    mappedPath = `image/${url}`;
  }
  // Шляхи що починаються з '/'
  else if (url.startsWith('/')) {
    mappedPath = url.substring(1);
  }
  // Відносний шлях - додаємо OpenCart префікс
  else {
    mappedPath = `image/catalog/products/${url}`;
  }
  
  // Для preview - використовуємо API проксі щоб уникнути CORS
  // Для production - використовуємо backend домен
  if (isPreview) {
    const finalUrl = `/api/image-proxy/${mappedPath}`;
    console.log(`[ImageHelper] ${url} → ${finalUrl}`);
    return finalUrl;
  } else {
    // Production: завжди використовуємо backend URL
    return `${BACKEND_URL}/${mappedPath}`;
  }
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
