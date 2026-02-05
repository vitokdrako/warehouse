/* eslint-disable */
import React from 'react'
import ZoneCard from '../ZoneCard'

/**
 * Zone: Commercial Summary - Комерційна зведена
 * Для статусів: WAITING_CONFIRMATION, PROCESSING
 */
export default function ZoneCommercialSummary({
  rentAmount = 0,
  depositAmount = 0,
  discountPercent = 0,
  rentalDays = 1,
  itemsCount = 0,
  onRecalculate,
}) {
  const fmtUA = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })
  
  const discountAmount = (rentAmount * discountPercent) / 100
  const rentAfterDiscount = rentAmount - discountAmount
  const totalToPay = rentAfterDiscount + depositAmount
  
  return (
    <ZoneCard
      title="💰 Комерційна зведена"
      hint="Оренда • знижка • застава • до оплати"
      tone="info"
      actions={onRecalculate ? [
        { label: '🔄 Перерахувати', onClick: onRecalculate }
      ] : []}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Оренда */}
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <div className="text-xs text-slate-500">Оренда ({rentalDays} дн.)</div>
          <div className="text-lg font-bold text-slate-800">₴ {fmtUA(rentAmount)}</div>
        </div>
        
        {/* Знижка */}
        {discountPercent > 0 && (
          <div className="rounded-xl bg-emerald-50 p-3 text-center">
            <div className="text-xs text-emerald-600">Знижка ({discountPercent}%)</div>
            <div className="text-lg font-bold text-emerald-700">−₴ {fmtUA(discountAmount)}</div>
          </div>
        )}
        
        {/* Застава */}
        <div className="rounded-xl bg-amber-50 p-3 text-center">
          <div className="text-xs text-amber-600">Застава (холд)</div>
          <div className="text-lg font-bold text-amber-700">₴ {fmtUA(depositAmount)}</div>
        </div>
        
        {/* До оплати */}
        <div className="rounded-xl bg-blue-50 p-3 text-center border-2 border-blue-200">
          <div className="text-xs text-blue-600">До оплати</div>
          <div className="text-lg font-bold text-blue-800">₴ {fmtUA(totalToPay)}</div>
        </div>
      </div>
      
      {/* Підсумок */}
      <div className="mt-4 pt-3 border-t border-slate-100 text-sm text-slate-600">
        📦 {itemsCount} позицій • 
        {discountPercent > 0 
          ? ` Оренда зі знижкою: ₴${fmtUA(rentAfterDiscount)}` 
          : ` Оренда: ₴${fmtUA(rentAmount)}`
        } • 
        Застава: ₴{fmtUA(depositAmount)}
      </div>
    </ZoneCard>
  )
}
