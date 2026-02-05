import React, { useState } from 'react';
import './ProductCard.css';

const ProductCard = ({ product, onAddToBoard, boardDates }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Доступність тепер приходить напряму з API (як в RentalHub)
  const isAvailable = product.is_available !== false && product.available > 0;

  const handleAdd = async () => {
    if (!boardDates?.startDate || !boardDates?.endDate) {
      alert('Спочатку оберіть дати оренди в мудборді!');
      return;
    }

    if (!isAvailable) {
      alert('Товар недоступний на вибрані дати');
      return;
    }

    setIsAdding(true);
    try {
      await onAddToBoard(product);
    } catch (error) {
      console.error('Failed to add:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const getImageUrl = () => {
    if (!product.image_url) return null;
    
    let imagePath = product.image_url;
    
    // Якщо шлях вже повний URL - використовуємо як є
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // Шляхи з uploads/ або static/ - додаємо базовий URL бекенду
    if (imagePath.startsWith('uploads/') || imagePath.startsWith('static/')) {
      return `https://backrentalhub.farforrent.com.ua/${imagePath}`;
    }
    
    // Шляхи з catalog/ - OpenCart структура з кешованими thumbnails
    if (imagePath.startsWith('catalog/')) {
      const pathWithoutExt = imagePath.replace(/\.(png|jpg|jpeg|webp)$/i, '');
      const ext = imagePath.match(/\.(png|jpg|jpeg|webp)$/i)?.[0] || '.png';
      return `https://www.farforrent.com.ua/image/cache/${pathWithoutExt}-300x200${ext}`;
    }
    
    // За замовчуванням - через бекенд
    return `https://backrentalhub.farforrent.com.ua/${imagePath}`;
  };

  const imageUrl = getImageUrl();

  return (
    <div className="product-card">
      <div className="product-card-image">
        {imageUrl && !imageError ? (
          <>
            {!imageLoaded && (
              <div className="product-card-image-placeholder loading">
                <span className="spinner" style={{fontSize: '20px', color: '#ccc'}}>●</span>
              </div>
            )}
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              style={{ opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </>
        ) : (
          <div className="product-card-image-placeholder">
            <span style={{fontSize: '40px', color: '#ddd'}}>●</span>
          </div>
        )}
        
        {/* Availability badge overlay - м'який сірий стиль */}
        {boardDates?.startDate && boardDates?.endDate && (
          <div className="product-availability-badge" style={{
            background: 'rgba(255, 255, 255, 0.95)',
            color: isAvailable ? '#666' : '#999',
            border: '1px solid #eee'
          }}>
            {isAvailable ? `${product.available}/${product.quantity}` : '0'}
          </div>
        )}
      </div>
      
      <div className="product-card-body">
        <h3 className="product-card-title" title={product.name}>
          {product.name}
        </h3>
        <p className="product-card-sku">{product.sku}</p>
        
        {/* Availability info - м'який стиль */}
        <div style={{
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          marginTop: '6px',
          fontSize: '11px',
          flexWrap: 'wrap'
        }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: '12px',
            background: isAvailable ? '#f5f5f5' : '#fafafa',
            color: isAvailable ? '#666' : '#999',
            fontWeight: '400'
          }}>
            {isAvailable ? `Доступно: ${product.available}` : 'Недоступно'}
          </span>
          {product.in_rent > 0 && (
            <span style={{
              padding: '2px 6px',
              borderRadius: '10px',
              background: '#fafafa',
              color: '#999',
              fontSize: '10px'
            }}>
              {product.in_rent} в оренді
            </span>
          )}
          {product.reserved > 0 && (
            <span style={{
              padding: '2px 6px',
              borderRadius: '10px',
              background: '#fafafa',
              color: '#999',
              fontSize: '10px'
            }}>
              {product.reserved} в резерві
            </span>
          )}
        </div>
        
        <div className="product-card-info">
          <span className="product-card-price">
            ₴{product.rental_price}
            <span className="product-card-price-unit">/день</span>
          </span>
          <span className="product-card-quantity">
            {product.quantity} шт
          </span>
        </div>
        
        <button
          onClick={handleAdd}
          disabled={isAdding || !isAvailable}
          className={`product-card-button ${isAdding ? 'adding' : ''} ${!isAvailable ? 'unavailable' : ''}`}
        >
          {isAdding ? 'Додавання...' : isAvailable ? 'Додати в підбірку' : 'Недоступно'}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
