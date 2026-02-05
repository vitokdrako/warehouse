import React, { useState } from 'react';
import './BoardItemCard.css';

const BoardItemCard = ({ item, boardDates, rentalDays, onUpdate, onRemove }) => {
  const [quantity, setQuantity] = useState(item.quantity);
  const [isUpdating, setIsUpdating] = useState(false);

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

  return (
    <div className="board-item-card">
      <div className="board-item-header">
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
          🗑️
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
          <p className="board-item-notes-text">📝 {item.notes}</p>
        </div>
      )}
    </div>
  );
};

export default BoardItemCard;
