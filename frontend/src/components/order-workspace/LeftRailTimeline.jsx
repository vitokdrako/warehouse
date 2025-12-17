/* eslint-disable */
import React, { useState, useEffect } from 'react'

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

/**
 * LeftRailTimeline - Таймлайн подій в лівій панелі
 * Завантажує реальні дані з фінансової системи
 */
export default function LeftRailTimeline({
  orderId,            // ID замовлення для завантаження реальних даних
  events: externalEvents = [],  // Зовнішні події (fallback)
  maxVisible = 5,
}) {
  const [showAll, setShowAll] = useState(false)
  const [financeEvents, setFinanceEvents] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!orderId) return

    setLoading(true)
    
    // Завантажити реальні дані з фінансової системи
    authFetch(`${BACKEND_URL}/api/finance/payments?order_id=${orderId}`)
      .then(r => r.json())
      .then(data => {
        const payments = data.payments || []
        
        // Перетворити платежі в події
        const paymentEvents = payments.map(p => {
          const paymentTypes = {
            'rent': { text: 'Оплата оренди', tone: 'green', icon: '💵' },
            'deposit': { text: 'Прийом застави', tone: 'blue', icon: '🔒' },
            'damage': { text: 'Оплата шкоди', tone: 'amber', icon: '⚠️' },
            'refund': { text: 'Повернення застави', tone: 'slate', icon: '↩️' },
          }
          
          const typeInfo = paymentTypes[p.payment_type] || { text: 'Платіж', tone: 'slate', icon: '💰' }
          
          // Форматування суми
          const amountDisplay = p.currency && p.currency !== 'UAH' 
            ? `${p.amount} ${p.currency}` 
            : `₴ ${fmtUA(p.amount)}`
          
          return {
            text: `${typeInfo.icon} ${typeInfo.text}: ${amountDisplay}`,
            at: p.occurred_at ? new Date(p.occurred_at).toLocaleString('uk-UA', { 
              day: '2-digit', 
              month: '2-digit', 
              hour: '2-digit', 
              minute: '2-digit' 
            }) : '',
            tone: typeInfo.tone,
            user: p.accepted_by_name || null,
          }
        })
        
        setFinanceEvents(paymentEvents)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load finance events:', err)
        setLoading(false)
      })
  }, [orderId])

  // Об'єднати фінансові події з зовнішніми
  const allEvents = [...financeEvents, ...externalEvents]
  
  const visibleEvents = showAll ? allEvents : allEvents.slice(0, maxVisible)
  const hasMore = allEvents.length > maxVisible
  
  const toneColors = {
    green: 'bg-emerald-500',
    red: 'bg-rose-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    slate: 'bg-slate-400',
  }
  
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-slate-800 mb-3">📋 Журнал операцій</h3>
      
      {loading ? (
        <div className="text-sm text-slate-400 text-center py-4">
          ⏳ Завантаження...
        </div>
      ) : allEvents.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-4">
          Немає записів
        </div>
      ) : (
        <>
          <ol className="space-y-3 text-sm max-h-60 overflow-auto">
            {visibleEvents.map((event, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <div 
                  className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${toneColors[event.tone] || toneColors.slate}`} 
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800">{event.text}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                    {event.at && <span>{event.at}</span>}
                    {event.user && <span className="text-slate-600">• {event.user}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          
          {hasMore && (
            <button 
              onClick={() => setShowAll(!showAll)}
              className="mt-3 w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showAll ? 'Згорнути' : `Показати ще ${allEvents.length - maxVisible}`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
