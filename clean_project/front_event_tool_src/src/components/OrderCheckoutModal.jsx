/**
 * Order Checkout Modal - Спрощена версія
 * Дані автоматично підтягуються з профілю та мудборду
 */

import React, { useState, useMemo, useEffect } from 'react';
import { calculateRentalDays, formatDateRange } from '../utils/rentalDaysCalculator';

// Типи платників згідно правил
const PAYER_TYPES = [
  { id: 'individual', label: 'Фізична особа', description: 'Оплата як приватна особа' },
  { id: 'fop', label: 'ФОП', description: 'Фізична особа-підприємець' },
  { id: 'company', label: 'Юридична особа', description: 'Компанія/організація' }
];

const OrderCheckoutModal = ({
  isOpen,
  onClose,
  board,
  items,
  totalPrice,
  depositAmount,
  rentalDays: initialRentalDays,
  onSubmit,
  userProfile // Дані користувача з профілю
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // Дані автоматично заповнюються з профілю
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Тип платника - єдине що клієнт обирає
  const [payerType, setPayerType] = useState('individual');
  
  // Коментар (опціонально)
  const [customerComment, setCustomerComment] = useState('');
  
  // Автозаповнення з профілю при відкритті
  useEffect(() => {
    if (isOpen && userProfile) {
      const fullName = `${userProfile.firstname || ''} ${userProfile.lastname || ''}`.trim();
      setCustomerName(fullName || '');
      setPhone(userProfile.telephone || '');
    }
  }, [isOpen, userProfile]);
  
  // Розрахунок діб оренди
  const rentalCalculation = useMemo(() => {
    if (board?.rental_start_date && board?.rental_end_date) {
      return calculateRentalDays(board.rental_start_date, board.rental_end_date);
    }
    return { days: initialRentalDays || 1, isApproximate: true, explanation: '' };
  }, [board?.rental_start_date, board?.rental_end_date, initialRentalDays]);
  
  const rentalDays = rentalCalculation.days;
  
  // Форматування дати
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };
  
  if (!isOpen) return null;
  
  const handleSubmit = async () => {
    if (!customerName.trim()) {
      setError("Введіть ім'я");
      return;
    }
    if (!phone.trim()) {
      setError("Введіть телефон");
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      // Мінімальний набір даних - все інше береться з мудборду/профілю на бекенді
      const orderData = {
        customer_name: customerName.trim(),
        phone: phone.trim(),
        payer_type: payerType,
        customer_comment: customerComment.trim() || null
      };
      
      await onSubmit(orderData);
    } catch (err) {
      setError(err.message || 'Помилка створення замовлення');
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '440px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: '18px', 
            fontWeight: '600',
            color: '#1a1a1a'
          }}>
            Оформлення замовлення
          </h2>
          <button
            onClick={onClose}
            style={{
              background: '#f5f5f5',
              border: 'none',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '20px',
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#e5e5e5'}
            onMouseOut={(e) => e.target.style.background = '#f5f5f5'}
          >
            ×
          </button>
        </div>
        
        {/* Content */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: '24px',
          WebkitOverflowScrolling: 'touch'
        }}>
          {/* Інформація з мудборду */}
          <div style={{ 
            background: 'linear-gradient(135deg, #fdf2f2 0%, #fff5f5 100%)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            border: '1px solid #fecaca'
          }}>
            <div style={{ 
              fontSize: '13px', 
              color: '#8B0000', 
              fontWeight: '600',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {board?.board_name || 'Мудборд'}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {board?.event_date && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#666' }}>Дата події:</span>
                  <span style={{ fontWeight: '500' }}>{formatDate(board.event_date)}</span>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#666' }}>Період оренди:</span>
                <span style={{ fontWeight: '500' }}>
                  {formatDateRange(board?.rental_start_date, board?.rental_end_date)}
                </span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#666' }}>Діб оренди:</span>
                <span style={{ 
                  fontWeight: '600', 
                  color: '#8B0000',
                  background: '#fff',
                  padding: '2px 10px',
                  borderRadius: '12px'
                }}>
                  ~{rentalDays}
                </span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#666' }}>Позицій:</span>
                <span style={{ fontWeight: '500' }}>{items?.length || 0}</span>
              </div>
            </div>
          </div>
          
          {/* Контактні дані */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px', 
              fontWeight: '500',
              color: '#333'
            }}>
              Ім'я та прізвище
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Іван Петренко"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #e5e5e5',
                borderRadius: '10px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#8B0000'}
              onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
            />
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px', 
              fontWeight: '500',
              color: '#333'
            }}>
              Телефон
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+380 XX XXX XX XX"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #e5e5e5',
                borderRadius: '10px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#8B0000'}
              onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
            />
          </div>
          
          {/* Тип платника */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '12px', 
              fontSize: '14px', 
              fontWeight: '500',
              color: '#333'
            }}>
              Тип платника
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {PAYER_TYPES.map(type => (
                <label
                  key={type.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    border: payerType === type.id ? '2px solid #8B0000' : '2px solid #e5e5e5',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: payerType === type.id ? '#fef7f7' : '#fff',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: payerType === type.id ? '6px solid #8B0000' : '2px solid #ccc',
                    background: '#fff',
                    transition: 'all 0.2s'
                  }} />
                  <input
                    type="radio"
                    name="payerType"
                    value={type.id}
                    checked={payerType === type.id}
                    onChange={(e) => setPayerType(e.target.value)}
                    style={{ display: 'none' }}
                  />
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '14px', color: '#1a1a1a' }}>
                      {type.label}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                      {type.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          
          {/* Коментар */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px', 
              fontWeight: '500',
              color: '#333'
            }}>
              Коментар <span style={{ color: '#999', fontWeight: '400' }}>(необов'язково)</span>
            </label>
            <textarea
              value={customerComment}
              onChange={(e) => setCustomerComment(e.target.value)}
              placeholder="Додаткові побажання..."
              rows={3}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #e5e5e5',
                borderRadius: '10px',
                fontSize: '16px',
                outline: 'none',
                resize: 'vertical',
                minHeight: '80px',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => e.target.style.borderColor = '#8B0000'}
              onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
            />
          </div>
          
          {/* Підсумок */}
          <div style={{ 
            background: '#f9fafb', 
            borderRadius: '12px', 
            padding: '16px',
            marginBottom: '8px'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <span style={{ fontSize: '14px', color: '#666' }}>Орієнтовна сума:</span>
              <span style={{ fontSize: '20px', fontWeight: '700', color: '#1a1a1a' }}>
                ~₴{totalPrice?.toFixed(0) || '0'}
              </span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              fontSize: '13px',
              color: '#888'
            }}>
              <span>Депозит (~30%):</span>
              <span>~₴{depositAmount?.toFixed(0) || '0'}</span>
            </div>
          </div>
          
          {rentalCalculation.isApproximate && (
            <div style={{ 
              fontSize: '12px', 
              color: '#92400e', 
              background: '#fffbeb',
              padding: '10px 12px',
              borderRadius: '8px',
              marginBottom: '8px'
            }}>
              💡 Точну суму та кількість діб оренди підтвердить менеджер
            </div>
          )}
          
          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '12px',
              color: '#dc2626',
              fontSize: '14px',
              marginTop: '12px'
            }}>
              {error}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div style={{
          padding: '16px 24px 24px',
          borderTop: '1px solid #f0f0f0'
        }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: '100%',
              padding: '16px',
              border: 'none',
              borderRadius: '12px',
              background: submitting ? '#ccc' : '#8B0000',
              color: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'background 0.2s',
              boxShadow: submitting ? 'none' : '0 4px 12px rgba(139, 0, 0, 0.3)'
            }}
          >
            {submitting ? 'Оформлення...' : 'Оформити замовлення'}
          </button>
          
          <div style={{ 
            textAlign: 'center', 
            marginTop: '12px',
            fontSize: '12px',
            color: '#888'
          }}>
            Менеджер зв'яжеться з вами для підтвердження
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderCheckoutModal;
