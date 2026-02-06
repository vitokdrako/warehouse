/**
 * Image Utilities
 * Утиліти для роботи із зображеннями
 */

const BACKEND_URL = 'https://backrentalhub.farforrent.com.ua';
const OPENCART_URL = 'https://www.farforrent.com.ua';

/**
 * Отримати правильний URL зображення товару
 */
export const getProductImageUrl = (imagePath, size = '300x200') => {
  if (!imagePath) return null;
  
  // Якщо вже повний URL
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Шляхи з uploads/ або static/
  if (imagePath.startsWith('uploads/') || imagePath.startsWith('static/')) {
    return `${BACKEND_URL}/${imagePath}`;
  }
  
  // OpenCart структура (catalog/)
  if (imagePath.startsWith('catalog/')) {
    const pathWithoutExt = imagePath.replace(/\.(png|jpg|jpeg|webp)$/i, '');
    const ext = imagePath.match(/\.(png|jpg|jpeg|webp)$/i)?.[0] || '.png';
    return `${OPENCART_URL}/image/cache/${pathWithoutExt}-${size}${ext}`;
  }
  
  // За замовчуванням
  return `${BACKEND_URL}/${imagePath}`;
};

/**
 * Отримати великий URL зображення (для canvas)
 */
export const getLargeImageUrl = (imagePath) => {
  return getProductImageUrl(imagePath, '500x500');
};

/**
 * Отримати thumbnail URL
 */
export const getThumbnailUrl = (imagePath) => {
  return getProductImageUrl(imagePath, '100x100');
};

/**
 * Завантажити зображення як Image об'єкт
 */
export const loadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

/**
 * Перевірити чи зображення завантажене
 */
export const isImageLoaded = (img) => {
  return img && img.complete && img.naturalWidth > 0;
};

/**
 * Отримати розміри зображення зі збереженням пропорцій
 */
export const getScaledDimensions = (imgWidth, imgHeight, maxWidth, maxHeight) => {
  const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
  return {
    width: imgWidth * ratio,
    height: imgHeight * ratio
  };
};

/**
 * Конвертувати data URL в Blob
 */
export const dataURLtoBlob = (dataURL) => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

/**
 * Завантажити файл
 */
export const downloadFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default {
  getProductImageUrl,
  getLargeImageUrl,
  getThumbnailUrl,
  loadImage,
  isImageLoaded,
  getScaledDimensions,
  dataURLtoBlob,
  downloadFile
};
