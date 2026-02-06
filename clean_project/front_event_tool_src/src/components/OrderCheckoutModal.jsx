/**
 * Order Checkout Modal
 * Модальне вікно для оформлення замовлення з мудборду
 */

import React, { useState, useMemo } from 'react';
import { calculateRentalDays, formatDateRange } from '../utils/rentalDaysCalculator';

const DELIVERY_TYPES = [
  { id: 'self_pickup', label: 'Самовивіз', description: 'Забрати зі складу' },
  { id: 'delivery', label: 'Доставка', description: 'Доставка за адресою' },
  { id: 'event_delivery', label: 'Доставка на подію', description: 'Доставка + монтаж на місці' }
];

const EVENT_TYPES = [
  { id: 'wedding', label: 'Весілля' },
  { id: 'corporate', label: 'Корпоратив' },
  { id: 'birthday', label: 'День народження' },
  { id: 'baby_shower', label: 'Baby Shower' },
  { id: 'graduation', label: 'Випускний' },
  { id: 'anniversary', label: 'Річниця' },
  { id: 'photoshoot', label: 'Фотосесія' },
  { id: 'other', label: 'Інше' }
];

const OrderCheckoutModal = ({
  isOpen,
  onClose,
  board,
  items,
  totalPrice,
  depositAmount,
  rentalDays: initialRentalDays,
  onSubmit
}) => {
  const [step, setStep] = useState(1); // 1 = contact, 2 = delivery, 3 = event, 4 = confirm
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // Форма контактів
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Форма доставки
  const [deliveryType, setDeliveryType] = useState('self_pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [city, setCity] = useState('Київ');
  
  // Форма події
  const [eventType, setEventType] = useState('');
  const [eventName, setEventName] = useState(''); // Назва події
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [guestsCount, setGuestsCount] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupNotes, setSetupNotes] = useState('');
  
  // Коментар
  const [customerComment, setCustomerComment] = useState('');
  
  // Платник
  const [payerType, setPayerType] = useState('individual');
  const [companyName, setCompanyName] = useState('');
  const [companyEdrpou, setCompanyEdrpou] = useState('');
  
  // Розрахунок діб оренди за правилами
  const rentalCalculation = useMemo(() => {
    if (board?.rental_start_date && board?.rental_end_date) {
      return calculateRentalDays(board.rental_start_date, board.rental_end_date);
    }
    return { days: initialRentalDays || 1, isApproximate: true, explanation: '' };
  }, [board?.rental_start_date, board?.rental_end_date, initialRentalDays]);
  
  const rentalDays = rentalCalculation.days;
  
  if (!isOpen) return null;
  
  const handleSubmit = async () => {
    if (!customerName.trim() || !phone.trim()) {
      setError("Введіть ім'я та телефон");
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const orderData = {
        customer_name: customerName.trim(),
        phone: phone.trim(),
        delivery_type: deliveryType,
        delivery_address: deliveryAddress.trim() || null,
        city: city.trim() || null,
        event_type: eventType || null,
        event_name: eventName.trim() || null, // Назва події
        event_location: eventLocation.trim() || null,
        event_date: eventDate || null,
        event_time: eventTime || null,
        guests_count: guestsCount ? parseInt(guestsCount) : null,
        setup_required: setupRequired,
        setup_notes: setupNotes.trim() || null,
        customer_comment: customerComment.trim() || null,
        payer_type: payerType,
        company_name: payerType === 'company' ? companyName.trim() : null,
        company_edrpou: payerType === 'company' ? companyEdrpou.trim() : null
      };
      
      await onSubmit(orderData);
    } catch (err) {
      setError(err.message || 'Помилка створення замовлення');
    } finally {
      setSubmitting(false);
    }
  };
  
  const nextStep = () => {
    if (step === 1 && (!customerName.trim() || !phone.trim())) {
      setError("Введіть ім'я та телефон");
      return;
    }
    setError(null);
    setStep(prev => Math.min(prev + 1, 4));
  };
  
  const prevStep = () => {
    setError(null);
    setStep(prev => Math.max(prev - 1, 1));
  };
  
  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s'
  };
  
  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#444'
  };
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
              Оформлення замовлення
            </h2>
            <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
              Крок {step} з 4
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#999',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>
        
        {/* Progress bar */}
        <div style={{ padding: '0 24px' }}>
          <div style={{
            display: 'flex',
            gap: '4px',
            marginTop: '16px'
          }}>
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: s <= step ? '#8B0000' : '#e0e0e0',
                  transition: 'background 0.3s'
                }}
              />
            ))}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#999',
            marginTop: '8px',
            marginBottom: '16px'
          }}>
            <span style={{ color: step >= 1 ? '#8B0000' : '#999' }}>Контакти</span>
            <span style={{ color: step >= 2 ? '#8B0000' : '#999' }}>Доставка</span>
            <span style={{ color: step >= 3 ? '#8B0000' : '#999' }}>Подія</span>
            <span style={{ color: step >= 4 ? '#8B0000' : '#999' }}>Підтвердження</span>
          </div>
        </div>
        
        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
          {/* Step 1: Contacts */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Ім'я та прізвище *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Іван Петренко"
                  style={inputStyle}
                  autoFocus
                />
              </div>
              
              <div>
                <label style={labelStyle}>Телефон *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+380 XX XXX XX XX"
                  style={inputStyle}
                />
              </div>
              
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
                <label style={labelStyle}>Тип платника</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    padding: '12px',
                    border: payerType === 'individual' ? '2px solid #8B0000' : '1px solid #e0e0e0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: payerType === 'individual' ? '#fef7f7' : '#fff'
                  }}>
                    <input
                      type="radio"
                      name="payerType"
                      value="individual"
                      checked={payerType === 'individual'}
                      onChange={(e) => setPayerType(e.target.value)}
                    />
                    <span style={{ fontSize: '14px' }}>Фізична особа</span>
                  </label>
                  <label style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    padding: '12px',
                    border: payerType === 'company' ? '2px solid #8B0000' : '1px solid #e0e0e0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: payerType === 'company' ? '#fef7f7' : '#fff'
                  }}>
                    <input
                      type="radio"
                      name="payerType"
                      value="company"
                      checked={payerType === 'company'}
                      onChange={(e) => setPayerType(e.target.value)}
                    />
                    <span style={{ fontSize: '14px' }}>Юридична особа</span>
                  </label>
                </div>
              </div>
              
              {payerType === 'company' && (
                <>
                  <div>
                    <label style={labelStyle}>Назва компанії</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="ТОВ 'Назва'"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>ЄДРПОУ</label>
                    <input
                      type="text"
                      value={companyEdrpou}
                      onChange={(e) => setCompanyEdrpou(e.target.value)}
                      placeholder="12345678"
                      style={inputStyle}
                    />
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Step 2: Delivery */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Спосіб отримання</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {DELIVERY_TYPES.map(type => (
                    <label
                      key={type.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '14px',
                        border: deliveryType === type.id ? '2px solid #8B0000' : '1px solid #e0e0e0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: deliveryType === type.id ? '#fef7f7' : '#fff'
                      }}
                    >
                      <input
                        type="radio"
                        name="deliveryType"
                        value={type.id}
                        checked={deliveryType === type.id}
                        onChange={(e) => setDeliveryType(e.target.value)}
                        style={{ marginTop: '2px' }}
                      />
                      <div>
                        <div style={{ fontWeight: '500', fontSize: '14px' }}>{type.label}</div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                          {type.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              
              {deliveryType !== 'self_pickup' && (
                <>
                  <div>
                    <label style={labelStyle}>Місто</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Київ"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Адреса доставки</label>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="вул. Хрещатик, 1"
                      style={inputStyle}
                    />
                  </div>
                </>
              )}
              
              {deliveryType === 'event_delivery' && (
                <div style={{ 
                  background: '#fffbeb', 
                  padding: '12px', 
                  borderRadius: '8px',
                  border: '1px solid #fde68a'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={setupRequired}
                      onChange={(e) => setSetupRequired(e.target.checked)}
                    />
                    <span style={{ fontSize: '14px' }}>Потрібен монтаж/оформлення</span>
                  </label>
                  
                  {setupRequired && (
                    <textarea
                      value={setupNotes}
                      onChange={(e) => setSetupNotes(e.target.value)}
                      placeholder="Опишіть що потрібно змонтувати..."
                      style={{
                        ...inputStyle,
                        marginTop: '12px',
                        minHeight: '80px',
                        resize: 'vertical'
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Step 3: Event */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Інформація про дати оренди */}
              <div style={{ 
                background: '#f0f9ff', 
                padding: '14px', 
                borderRadius: '8px',
                border: '1px solid #bae6fd'
              }}>
                <div style={{ fontSize: '12px', color: '#0369a1', marginBottom: '6px', fontWeight: '500' }}>
                  Дати оренди (з мудборду)
                </div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>
                  {formatDateRange(board?.rental_start_date, board?.rental_end_date)}
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  marginTop: '8px',
                  fontSize: '13px'
                }}>
                  <span style={{ color: '#666' }}>Приблизно:</span>
                  <span style={{ 
                    fontWeight: '600', 
                    color: '#8B0000',
                    background: '#fef2f2',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}>
                    {rentalDays} {rentalDays === 1 ? 'доба' : 'доби'}
                  </span>
                </div>
                {rentalCalculation.isApproximate && (
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#92400e', 
                    marginTop: '6px',
                    background: '#fffbeb',
                    padding: '6px 8px',
                    borderRadius: '4px'
                  }}>
                    Це приблизний розрахунок. Менеджер уточнить кількість діб згідно з правилами оренди.
                  </div>
                )}
              </div>
              
              <div>
                <label style={labelStyle}>Назва події (необов'язково)</label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Весілля Олени та Максима"
                  style={inputStyle}
                />
              </div>
              
              <div>
                <label style={labelStyle}>Тип події</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Оберіть тип події</option>
                  {EVENT_TYPES.map(type => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={labelStyle}>Місце проведення</label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="Назва локації або адреса"
                  style={inputStyle}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Дата події</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    style={inputStyle}
                  />
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                    Це інформативна дата (може відрізнятись від дат оренди)
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Час початку</label>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
              
              <div>
                <label style={labelStyle}>Кількість гостей</label>
                <input
                  type="number"
                  value={guestsCount}
                  onChange={(e) => setGuestsCount(e.target.value)}
                  placeholder="50"
                  style={inputStyle}
                />
              </div>
              
              <div>
                <label style={labelStyle}>Коментар до замовлення</label>
                <textarea
                  value={customerComment}
                  onChange={(e) => setCustomerComment(e.target.value)}
                  placeholder="Додаткові побажання, особливі вимоги, деталі..."
                  style={{
                    ...inputStyle,
                    minHeight: '100px',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>
          )}
          
          {/* Step 4: Confirm */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ 
                background: '#f9fafb', 
                borderRadius: '12px', 
                padding: '16px'
              }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600' }}>
                  Підсумок замовлення
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Клієнт:</span>
                    <span style={{ fontWeight: '500' }}>{customerName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Телефон:</span>
                    <span>{phone}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Доставка:</span>
                    <span>{DELIVERY_TYPES.find(t => t.id === deliveryType)?.label}</span>
                  </div>
                  {eventType && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#666' }}>Подія:</span>
                      <span>{EVENT_TYPES.find(t => t.id === eventType)?.label}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Позицій:</span>
                    <span>{items?.length || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Днів оренди:</span>
                    <span>{rentalDays}</span>
                  </div>
                </div>
              </div>
              
              <div style={{ 
                background: '#fef7f7', 
                borderRadius: '12px', 
                padding: '16px',
                border: '1px solid #fecaca'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>Сума оренди:</span>
                  <span style={{ fontSize: '16px', fontWeight: '600' }}>
                    ₴ {totalPrice?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>Депозит (30%):</span>
                  <span style={{ fontSize: '14px' }}>
                    ₴ {depositAmount?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
              
              <div style={{ 
                background: '#ecfdf5', 
                borderRadius: '8px', 
                padding: '12px',
                fontSize: '13px',
                color: '#065f46'
              }}>
                Після оформлення з вами зв'яжеться менеджер для підтвердження замовлення та узгодження деталей.
              </div>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '12px',
              color: '#dc2626',
              fontSize: '14px',
              marginTop: '16px'
            }}>
              {error}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          gap: '12px'
        }}>
          {step > 1 && (
            <button
              onClick={prevStep}
              disabled={submitting}
              style={{
                padding: '12px 24px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Назад
            </button>
          )}
          
          <div style={{ flex: 1 }} />
          
          {step < 4 ? (
            <button
              onClick={nextStep}
              style={{
                padding: '12px 32px',
                border: 'none',
                borderRadius: '8px',
                background: '#8B0000',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Далі
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: '12px 32px',
                border: 'none',
                borderRadius: '8px',
                background: submitting ? '#ccc' : '#16a34a',
                color: '#fff',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {submitting ? 'Оформлення...' : 'Оформити замовлення'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderCheckoutModal;
