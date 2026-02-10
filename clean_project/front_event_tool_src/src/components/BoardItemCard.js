import React, { useState } from 'react';
import './BoardItemCard.css';

const BACKEND_URL = 'https://backrentalhub.farforrent.com.ua';

// Отримати повний URL зображення
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  const cleanPath = imagePath.replace(/^\/+/, '');
  return `${BACKEND_URL}/${cleanPath}`;
};

const BoardItemCard = ({ item, boardDates, rentalDays, onUpdate, onRemove }) => {
  const [quantity, setQuantity] = useState(item.quantity);
  const [isUpdating, setIsUpdating] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleQuantityChange = async (newQuantity) => {
    if (newQuantity < 1) return;
    
    // Перевірка доступності на основі даних товару
    const maxAvailable = item.product?.quantity || 10;
    if (newQuantity > maxAvailable) {
      alert(`Доступно лише ${maxAvailable} шт`);
      return;
    }

    setQuantity(newQuantity);
    setIsUpdating(true);
    
    try {
      await onUpdate(item.id, { quantity: newQuantity });
    } catch (error) {
      console.error('Failed to update quantity:', error);
      setQuantity(item.quantity); // Revert on error
    } finally {
      setIsUpdating(false);
    }
  };

  const calculateItemTotal = () => {
    const price = item.product?.rental_price || 0;
    const days = rentalDays || 1;
    return price * quantity * days;
  };

  const imageUrl = getImageUrl(item.product?.image_url);

  return (
    <div className="board-item-card">
      {/* Product Image + Info Row */}
      <div className="board-item-header">
        {/* Thumbnail */}
        <div className="board-item-thumb">
          {imageUrl && !imageError ? (
            <img 
              src={imageUrl} 
              alt={item.product?.name}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="board-item-thumb-placeholder">
              {item.product?.name?.charAt(0) || '?'}
            </div>
          )}
        </div>
        
        <div className="board-item-info">
          <h4 className="board-item-title">
            {item.product?.name}
          </h4>
          <p className="board-item-sku">{item.product?.sku}</p>
        </div>
        <button
          onClick={() => onRemove(item.id)}
          className="board-item-remove"
          title="Видалити"
        >
          ×
        </button>
      </div>

      {/* Quantity Controls */}
      <div className="board-item-quantity">
        <span className="board-item-quantity-label">Кількість:</span>
        <div className="board-item-quantity-controls">
          <button
            onClick={() => handleQuantityChange(quantity - 1)}
            disabled={quantity <= 1 || isUpdating}
            className="board-item-quantity-btn"
          >
            −
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 1;
              if (val > 0) handleQuantityChange(val);
            }}
            disabled={isUpdating}
            className="board-item-quantity-input"
            min="1"
          />
          <button
            onClick={() => handleQuantityChange(quantity + 1)}
            disabled={isUpdating}
            className="board-item-quantity-btn"
          >
            +
          </button>
        </div>
      </div>

      {/* Price */}
      <div className="board-item-price">
        <span className="board-item-price-calculation">
          ₴{item.product?.rental_price} × {quantity} шт × {rentalDays || 1} дн
        </span>
        <span className="board-item-price-total">
          ₴{calculateItemTotal().toFixed(2)}
        </span>
      </div>

      {/* Notes */}
      {item.notes && (
        <div className="board-item-notes">
          <p className="board-item-notes-text">{item.notes}</p>
        </div>
      )}
    </div>
  );
};

export default BoardItemCard;
