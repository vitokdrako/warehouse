import React, { useState } from 'react';
import AvailabilityBadge from './AvailabilityBadge';
import { useAvailability } from '../hooks/useAvailability';
import './ProductCard.css';

const ProductCard = ({ product, onAddToBoard, boardDates }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const { availability, loading } = useAvailability(
    product.product_id,
    1,
    boardDates?.startDate,
    boardDates?.endDate
  );

  const handleAdd = async () => {
    if (!boardDates?.startDate || !boardDates?.endDate) {
      alert('Спочатку оберіть дати оренди в мудборді!');
      return;
    }

    if (availability && !availability.is_available) {
      alert(availability.message || 'Товар недоступний на вибрані дати');
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
                <span className="spinner">⏳</span>
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
            <span>📦</span>
          </div>
        )}
        
        {/* Availability badge overlay */}
        {boardDates?.startDate && boardDates?.endDate && (
          <div className="product-availability-badge">
            {loading ? (
              <span>⏳</span>
            ) : availability ? (
              <AvailabilityBadge
                available={availability.available_quantity}
                total={product.quantity}
                requested={1}
                compact={true}
              />
            ) : null}
          </div>
        )}
      </div>
      
      <div className="product-card-body">
        <h3 className="product-card-title" title={product.name}>
          {product.name}
        </h3>
        <p className="product-card-sku">{product.sku}</p>
        
        {/* Availability info */}
        {product.available !== undefined && (
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            marginTop: '6px',
            fontSize: '11px',
            color: '#666'
          }}>
            <span style={{
              padding: '2px 8px',
              borderRadius: '12px',
              background: product.available > 0 ? '#e8f5e9' : '#ffebee',
              color: product.available > 0 ? '#2e7d32' : '#c62828',
              fontWeight: '500'
            }}>
              {product.available > 0 ? `✓ Доступно: ${product.available}` : '✗ Недоступно'}
            </span>
            {product.reserved > 0 && (
              <span style={{color: '#999', fontSize: '10px'}}>
                ({product.reserved} в резерві)
              </span>
            )}
          </div>
        )}
        
        <div className="product-card-info">
          <span className="product-card-price">
            ₴{product.rental_price}
            <span className="product-card-price-unit">/день</span>
          </span>
          <span className="product-card-quantity">
            {product.quantity} шт
          </span>
        </div>

        {/* Full availability info */}
        {boardDates?.startDate && boardDates?.endDate && availability && (
          <div className="product-card-availability">
            <AvailabilityBadge
              available={availability.available_quantity}
              total={product.quantity}
              requested={1}
            />
          </div>
        )}
        
        <button
          onClick={handleAdd}
          disabled={isAdding || (availability && !availability.is_available)}
          className={`product-card-button ${isAdding ? 'adding' : ''}`}
        >
          {isAdding ? 'Додавання...' : 'Додати в підбірку'}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;