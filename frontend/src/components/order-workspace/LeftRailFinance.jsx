/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import TonePill from './TonePill'
import eventBus, { EVENTS } from '../../utils/eventBus'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

// Auth fetch helper
const authFetch = (url) => {
  const token = localStorage.getItem('token');
  return fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
  });
};

const fmtUA = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })

// Debounce utility
const debounce = (fn, delay) => {
  let timeoutId;
  const debouncedFn = (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
  debouncedFn.cancel = () => clearTimeout(timeoutId);
  return debouncedFn;
};

/**
 * LeftRailFinance - Фінансовий блок в лівій панелі
 * Читає РЕАЛЬНІ дані з фінансової системи
 * 
 * ОПТИМІЗОВАНО:
 * - Використовує новий endpoint /api/finance/deposit-hold?order_id={id} замість /api/finance/deposits
 * - Debounce для EventBus (300ms) щоб уникнути "шторму" рефетчів
 */
export default function LeftRailFinance({
  orderId,             // ID замовлення для завантаження реальних даних
  rentAmount = 0,      // Очікувана сума оренди (після знижки)
  depositAmount = 0,   // Очікувана сума застави (fallback)
  discountPercent = 0, // Відсоток знижки
  discountAmount = 0,  // Сума знижки
  rentBeforeDiscount = 0, // Сума оренди до знижки
  serviceFee = 0,      // Додаткова послуга (мінімальне замовлення)
  serviceFeeName = "", // Назва послуги
  onServiceFeeChange,  // Callback для зміни додаткової послуги
  isEditable = true,   // Завжди редагується
}) {
  const [editingServiceFee, setEditingServiceFee] = useState(false)
  const [serviceFeeInput, setServiceFeeInput] = useState(serviceFee || 0)
  const [serviceFeeNameInput, setServiceFeeNameInput] = useState(serviceFeeName || "Мінімальний платіж")
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState([])
  const [deposit, setDeposit] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Ref для debounced функції
  const debouncedRefreshRef = useRef(null)

  // Функція завантаження даних - ОПТИМІЗОВАНА
  const fetchData = useCallback(() => {
    if (!orderId) {
      setLoading(false)
      return
    }

    setLoading(true)
    
    // ОПТИМІЗАЦІЯ P0.1: Використовуємо новий endpoint для одного депозиту
    Promise.all([
      authFetch(`${BACKEND_URL}/api/finance/payments?order_id=${orderId}`).then(r => r.json()),
      authFetch(`${BACKEND_URL}/api/finance/deposit-hold?order_id=${orderId}`).then(r => r.json())
    ])
    .then(([paymentsData, depositData]) => {
      setPayments(paymentsData.payments || [])
      // depositData вже є депозитом для цього замовлення або null
      setDeposit(depositData || null)
      setLoading(false)
    })
    .catch(err => {
      console.error('Failed to load finance data:', err)
      setLoading(false)
    })
  }, [orderId])

  // Початкове завантаження
  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  // ОПТИМІЗАЦІЯ P0.3: Debounced refresh для EventBus
  useEffect(() => {
    // Створюємо debounced функцію
    debouncedRefreshRef.current = debounce(() => {
      setRefreshKey(k => k + 1)
    }, 300)
    
    return () => {
      // Cleanup debounce при unmount
      if (debouncedRefreshRef.current?.cancel) {
        debouncedRefreshRef.current.cancel()
      }
    }
  }, [])

  // Підписка на події оновлення з DEBOUNCE
  useEffect(() => {
    const handleFinanceUpdate = (data) => {
      // Оновлюємо тільки якщо це наше замовлення або глобальне оновлення
      if (!data || !data.orderId || data.orderId === orderId) {
        // ОПТИМІЗАЦІЯ P0.3: Використовуємо debounced refresh
        if (debouncedRefreshRef.current) {
          debouncedRefreshRef.current()
        }
      }
    }

    const unsubFinance = eventBus.on(EVENTS.FINANCE_UPDATED, handleFinanceUpdate)
    const unsubPayment = eventBus.on(EVENTS.PAYMENT_CREATED, handleFinanceUpdate)
    const unsubDeposit = eventBus.on(EVENTS.DEPOSIT_CREATED, handleFinanceUpdate)
    const unsubRefund = eventBus.on(EVENTS.DEPOSIT_REFUNDED, handleFinanceUpdate)
    const unsubGlobal = eventBus.on(EVENTS.REFETCH_ALL, handleFinanceUpdate)

    return () => {
      unsubFinance()
      unsubPayment()
      unsubDeposit()
      unsubRefund()
      unsubGlobal()
    }
  }, [orderId])

  // Розрахунок реального статусу
  const rentPayments = payments.filter(p => p.payment_type === 'rent')
  const rentPaid = rentPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
  
  // Фактична застава - ТІЛЬКИ якщо є запис у fin_deposit_holds
  const hasDeposit = deposit !== null && deposit !== undefined
  const depositHeld = hasDeposit ? (deposit.held_amount || 0) : 0
  const depositCurrency = hasDeposit ? (deposit.currency || 'UAH') : 'UAH'
  const depositActual = hasDeposit ? (deposit.actual_amount || depositHeld) : 0
  
  // Статуси
  const rentStatus = rentPaid >= rentAmount ? 'paid' : rentPaid > 0 ? 'partial' : 'pending'
  const depositStatus = hasDeposit && depositHeld > 0 ? 'received' : 'pending'
  
  // Загальний статус
  const isFullyPaid = rentStatus === 'paid' && depositStatus === 'received'
  const rentDue = Math.max(0, rentAmount - rentPaid)
  
  // Форматування застави у валюті
  const depositDisplay = depositCurrency === 'UAH' 
    ? `₴ ${fmtUA(depositActual)}` 
    : `${depositActual} ${depositCurrency}`

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-500">⏳ Завантаження...</div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800">💰 Фінансовий статус</h3>
        <TonePill tone={isFullyPaid ? 'ok' : 'warn'}>
          {isFullyPaid ? '✅ Все оплачено' : rentDue > 0 ? `До сплати ₴${fmtUA(rentDue)}` : 'Очікується застава'}
        </TonePill>
      </div>
      
      <div className="space-y-3 text-sm">
        {/* Оренда */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Оренда</span>
            <span className="font-semibold text-slate-800">₴ {fmtUA(rentAmount)}</span>
          </div>
          
          {/* Показати знижку якщо є */}
          {discountPercent > 0 && (
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-green-600">
                🏷️ Знижка {discountPercent}%
              </span>
              <span className="text-green-600 font-medium">
                -₴ {fmtUA(discountAmount)}
              </span>
            </div>
          )}
          
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {rentStatus === 'paid' && '✅ Оплачено'}
              {rentStatus === 'partial' && `⚠️ Сплачено ₴${fmtUA(rentPaid)}`}
              {rentStatus === 'pending' && '⏳ Не оплачено'}
            </span>
            {rentStatus === 'paid' && <TonePill tone="ok" size="sm">Оплачено</TonePill>}
            {rentStatus === 'partial' && <TonePill tone="warn" size="sm">Частково</TonePill>}
            {rentStatus === 'pending' && <TonePill tone="danger" size="sm">Не оплачено</TonePill>}
          </div>
        </div>
        
        {/* Застава */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Застава</span>
            <span className="font-semibold text-slate-800">
              {depositStatus === 'received' ? depositDisplay : `₴ ${fmtUA(depositAmount)}`}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {depositStatus === 'received' && '✅ Прийнято'}
              {depositStatus === 'pending' && depositAmount > 0 ? '⏳ Очікується' : '—'}
            </span>
            {depositStatus === 'received' && <TonePill tone="ok" size="sm">Прийнято</TonePill>}
            {depositStatus === 'pending' && depositAmount > 0 && <TonePill tone="warn" size="sm">Очікується</TonePill>}
          </div>
          {depositStatus === 'received' && depositCurrency !== 'UAH' && (
            <div className="mt-1 text-xs text-slate-400">≈ ₴ {fmtUA(depositHeld)}</div>
          )}
        </div>
        
        {/* Додаткова послуга (мінімальне замовлення) */}
        {(isEditable || serviceFee > 0) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Додаткова послуга</span>
              {isEditable && !editingServiceFee ? (
                <button
                  onClick={() => { setEditingServiceFee(true); setServiceFeeInput(serviceFee || 0); }}
                  className="font-semibold text-amber-700 hover:underline"
                >
                  {serviceFee > 0 ? `₴ ${fmtUA(serviceFee)}` : '+ Додати'}
                </button>
              ) : isEditable && editingServiceFee ? (
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">₴</span>
                  <input
                    type="number"
                    value={serviceFeeInput}
                    onChange={(e) => setServiceFeeInput(Number(e.target.value) || 0)}
                    className="w-20 px-2 py-1 text-sm border rounded text-right"
                    min="0"
                    step="100"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (onServiceFeeChange) onServiceFeeChange(serviceFeeInput);
                      setEditingServiceFee(false);
                    }}
                    className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => setEditingServiceFee(false)}
                    className="px-2 py-1 text-xs bg-slate-300 text-slate-700 rounded hover:bg-slate-400"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <span className="font-semibold text-amber-700">₴ {fmtUA(serviceFee)}</span>
              )}
            </div>
            <div className="mt-1 text-xs text-amber-600">
              💡 Мінімальне замовлення 2000 грн
            </div>
          </div>
        )}

        {/* Деталі оплат */}
        {payments.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-800">
              📋 Деталі оплат ({payments.length})
            </summary>
            <div className="mt-2 space-y-1 text-xs border-l-2 border-slate-200 pl-2">
              {payments.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between py-1">
                  <div>
                    <span className="font-medium">{p.payment_type === 'rent' ? 'Оренда' : 'Застава'}</span>
                    {p.accepted_by_name && <span className="text-slate-400 ml-1">• {p.accepted_by_name}</span>}
                  </div>
                  <div className="font-mono text-slate-700">
                    {p.currency && p.currency !== 'UAH' ? `${p.amount} ${p.currency}` : `₴ ${fmtUA(p.amount)}`}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
