/* eslint-disable */
import React from 'react'
import TonePill from './TonePill'

/**
 * LeftRailFinance - Фінансовий блок в лівій панелі
 */
export default function LeftRailFinance({
  rentAmount = 0,      // Сума оренди
  depositAmount = 0,   // Сума застави
  prepayment = 0,      // Передплата
  discount = 0,        // Знижка %
  lateFee = 0,         // Пеня за прострочення
  damageFee = 0,       // Збитки
  cleaningFee = 0,     // Чистка
  isPaid = false,      // Чи повністю оплачено
  showGate = false,    // Показувати UI gate
  gateMessage,         // Повідомлення gate
  gateTone = 'warn',   // Тон gate: ok | warn | danger
}) {
  const fmtUA = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })
  
  const discountAmount = (rentAmount * discount) / 100
  const rentAfterDiscount = rentAmount - discountAmount
  const totalDue = rentAfterDiscount - prepayment + lateFee + damageFee + cleaningFee
  const remaining = Math.max(0, totalDue)
  
  const isFullyPaid = isPaid || remaining <= 0
  
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800">Фінансовий статус</h3>
        <TonePill tone={isFullyPaid ? 'ok' : 'warn'}>
          {isFullyPaid ? 'Оплачено' : `До сплати ₴${fmtUA(remaining)}`}
        </TonePill>
      </div>
      
      <div className="space-y-2 text-sm">
        {/* Основні суми */}
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Оренда</span>
          <span className="font-medium text-slate-800">₴ {fmtUA(rentAmount)}</span>
        </div>
        
        {discount > 0 && (
          <div className="flex items-center justify-between text-emerald-600">
            <span>Знижка ({discount}%)</span>
            <span className="font-medium">−₴ {fmtUA(discountAmount)}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Застава</span>
          <span className="font-medium text-slate-800">₴ {fmtUA(depositAmount)}</span>
        </div>
        
        {prepayment > 0 && (
          <div className="flex items-center justify-between text-emerald-600">
            <span>Передплата</span>
            <span className="font-medium">−₴ {fmtUA(prepayment)}</span>
          </div>
        )}
        
        {/* Додаткові нарахування */}
        {(lateFee > 0 || damageFee > 0 || cleaningFee > 0) && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            {lateFee > 0 && (
              <div className="flex items-center justify-between text-rose-600">
                <span>Пеня за прострочення</span>
                <span className="font-medium">+₴ {fmtUA(lateFee)}</span>
              </div>
            )}
            {damageFee > 0 && (
              <div className="flex items-center justify-between text-rose-600">
                <span>Збитки</span>
                <span className="font-medium">+₴ {fmtUA(damageFee)}</span>
              </div>
            )}
            {cleaningFee > 0 && (
              <div className="flex items-center justify-between text-amber-600">
                <span>Чистка</span>
                <span className="font-medium">+₴ {fmtUA(cleaningFee)}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Підсумок */}
        <div className="pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">До сплати</span>
            <span className={`font-bold text-lg ${isFullyPaid ? 'text-emerald-600' : 'text-slate-900'}`}>
              ₴ {fmtUA(remaining)}
            </span>
          </div>
        </div>
      </div>
      
      {/* UI Gate */}
      {showGate && gateMessage && (
        <div className={`
          mt-3 rounded-xl border p-3 text-sm
          ${gateTone === 'danger' ? 'bg-rose-50 border-rose-200' : 
            gateTone === 'ok' ? 'bg-emerald-50 border-emerald-200' : 
            'bg-amber-50 border-amber-200'}
        `}>
          <div className="font-medium">UI Gate</div>
          <div className="mt-1 text-slate-700">{gateMessage}</div>
        </div>
      )}
    </div>
  )
}
