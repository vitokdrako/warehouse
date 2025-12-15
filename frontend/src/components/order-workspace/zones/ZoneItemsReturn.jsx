/* eslint-disable */
import React from 'react'
import ZoneCard from '../ZoneCard'
import { getImageUrl } from '../../../utils/imageHelper'

/**
 * Zone: Items Return - Приймання товарів при поверненні
 * Для статусу: INTAKE
 */
export default function ZoneItemsReturn({
  items = [],
  onSetReturnedQty,     // (itemId, qty) => void
  onToggleSerial,       // (itemId, serial) => void
  onOpenDamage,         // (itemId) => void
  readOnly = false,
}) {
  const totalRented = items.reduce((s, it) => s + (it.rented_qty || 0), 0)
  const totalReturned = items.reduce((s, it) => s + (it.returned_qty || 0), 0)
  const totalFindings = items.reduce((s, it) => s + (it.findings?.length || 0), 0)
  
  const allReturned = items.every(it => it.returned_qty >= it.rented_qty)
  const tone = allReturned && totalFindings === 0 ? 'ok' : totalFindings > 0 ? 'warn' : 'info'

  return (
    <ZoneCard
      title={`Приймання (${totalReturned}/${totalRented})`}
      hint={totalFindings > 0 ? `${totalFindings} зауважень` : 'Перевірте стан товарів'}
      tone={tone}
    >
      {items.length === 0 ? (
        <div className="text-center py-6 text-slate-400">Немає позицій</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ReturnItemCard
              key={item.id}
              item={item}
              onSetReturnedQty={onSetReturnedQty}
              onToggleSerial={onToggleSerial}
              onOpenDamage={onOpenDamage}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </ZoneCard>
  )
}

function ReturnItemCard({ item, onSetReturnedQty, onToggleSerial, onOpenDamage, readOnly }) {
  const photoUrl = getImageUrl(item.image)
  const rentedQty = item.rented_qty || 0
  const returnedQty = item.returned_qty || 0
  const findings = item.findings || []
  const serials = item.serials || []
  const okSerials = item.ok_serials || []
  
  const isComplete = returnedQty >= rentedQty
  const hasDamage = findings.length > 0
  
  return (
    <div className={`
      rounded-xl border bg-white p-4
      ${isComplete && !hasDamage ? 'border-emerald-300 bg-emerald-50' : 
        hasDamage ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}
    `}>
      {/* Header */}
      <div className="flex gap-4 mb-4">
        {/* Фото */}
        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
          {photoUrl ? (
            <img src={photoUrl} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">Фото</div>
          )}
        </div>
        
        {/* Інформація */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 mb-1 line-clamp-2">{item.name}</div>
          <div className="text-xs text-slate-500">SKU: {item.sku || '—'}</div>
          {/* Локація на складі */}
          {(item.location?.zone || item.location?.aisle || item.location?.shelf) && (
            <div className="text-xs text-corp-primary font-medium mt-0.5">
              Полиця: {[item.location.zone, item.location.aisle, item.location.shelf].filter(Boolean).join('-')}
            </div>
          )}
          
          <div className="flex flex-wrap gap-1 mt-2">
            {isComplete && !hasDamage && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
                OK
              </span>
            )}
            {hasDamage && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
                {findings.length} пошкодж.
              </span>
            )}
            {!isComplete && !hasDamage && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
                Часткове
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Лічильник повернення */}
      <div className="flex items-center justify-between mb-4 p-3 bg-slate-100 rounded-xl">
        <div className="text-sm">
          <span className="text-slate-600">Оренда:</span>{' '}
          <span className="font-bold">{rentedQty}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Повернуто:</span>
          <button 
            onClick={() => !readOnly && onSetReturnedQty?.(item.id, Math.max(0, returnedQty - 1))}
            disabled={readOnly || returnedQty === 0}
            className="w-10 h-10 rounded-xl border-2 border-slate-300 bg-white text-lg font-bold disabled:opacity-50 active:bg-slate-100"
          >
            −
          </button>
          <div className={`
            w-14 text-center text-xl font-bold py-1 rounded-lg
            ${isComplete ? 'text-emerald-600 bg-emerald-100' : 'bg-white'}
          `}>
            {returnedQty}
          </div>
          <button 
            onClick={() => !readOnly && onSetReturnedQty?.(item.id, Math.min(rentedQty, returnedQty + 1))}
            disabled={readOnly || returnedQty >= rentedQty}
            className="w-10 h-10 rounded-xl border-2 border-slate-300 bg-white text-lg font-bold disabled:opacity-50 active:bg-slate-100"
          >
            +
          </button>
        </div>
      </div>
      
      {/* Серійні номери */}
      {serials.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-slate-500 mb-2">Серійні номери:</div>
          <div className="flex flex-wrap gap-2">
            {serials.map(serial => {
              const isOk = okSerials.includes(serial)
              return (
                <button
                  key={serial}
                  onClick={() => !readOnly && onToggleSerial?.(item.id, serial)}
                  disabled={readOnly}
                  className={`
                    rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-all
                    ${isOk 
                      ? 'border-emerald-400 bg-emerald-100 text-emerald-700' 
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                    }
                    disabled:opacity-50
                  `}
                >
                  {serial} {isOk && '✓'}
                </button>
              )
            })}
          </div>
        </div>
      )}
      
      {/* Пошкодження */}
      {findings.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="text-xs text-amber-700 font-medium mb-1">Зафіксовані пошкодження:</div>
          {findings.map((f, idx) => (
            <div key={idx} className="text-sm text-amber-800">
              • {f.category || f.type} - {f.kind || f.description} {f.fee > 0 && `(₴${f.fee})`}
            </div>
          ))}
        </div>
      )}
      
      {/* Кнопка пошкодження */}
      {onOpenDamage && !readOnly && (
        <button 
          onClick={() => onOpenDamage(item.id)} 
          className="w-full py-2.5 rounded-lg bg-amber-500 text-white font-medium text-sm active:bg-amber-600"
        >
          📷 Зафіксувати пошкодження
        </button>
      )}
    </div>
  )
}
