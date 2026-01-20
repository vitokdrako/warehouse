/* eslint-disable */
import React from 'react'
import ZoneCard from '../ZoneCard'
import { getImageUrl } from '../../../utils/imageHelper'
import { QRCodeSVG } from 'qrcode.react'
import { Trash2 } from 'lucide-react'

/**
 * Zone: Items Pickup - Комплектування товарів для видачі
 * Для статусу: PROCESSING, READY_FOR_ISSUE
 */
export default function ZoneItemsPickup({
  items = [],
  onPick,           // (itemId, newPickedQty) => void
  onScan,           // (itemId, serial) => void
  onOpenDamage,     // (itemId) => void
  onPackagingChange, // (itemId, packType, value) => void
  onRemoveItem,     // (itemId, itemName) => void - видалення товару
  readOnly = false,
}) {
  const fmtUA = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })
  
  // Підрахунки
  const totalItems = items.length
  const pickedItems = items.filter(it => it.picked_qty >= it.qty).length
  const totalQty = items.reduce((s, it) => s + (it.qty || 0), 0)
  const pickedQty = items.reduce((s, it) => s + (it.picked_qty || 0), 0)
  
  const tone = pickedItems === totalItems ? 'ok' : pickedItems > 0 ? 'info' : 'neutral'
  
  return (
    <ZoneCard
      title={`Комплектування (${pickedItems}/${totalItems})`}
      hint={`Зібрано ${pickedQty} з ${totalQty} одиниць`}
      tone={tone}
    >
      {items.length === 0 ? (
        <div className="text-center py-6 text-slate-400">
          Немає позицій для комплектування
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ItemPickupCard
              key={item.id}
              item={item}
              onPick={onPick}
              onScan={onScan}
              onOpenDamage={onOpenDamage}
              onPackagingChange={onPackagingChange}
              onRemoveItem={onRemoveItem}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </ZoneCard>
  )
}

function ItemPickupCard({ 
  item, 
  onPick, 
  onScan, 
  onOpenDamage, 
  onPackagingChange,
  onRemoveItem,
  readOnly 
}) {
  const fmtUA = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })
  
  const photoUrl = getImageUrl(item.image || item.image_url)
  const qty = item.qty || 0
  const pickedQty = item.picked_qty || 0
  const isComplete = pickedQty >= qty
  const isOver = pickedQty > qty
  const hasPreDamage = (item.pre_damage?.length || 0) > 0
  const missing = Math.max(0, qty - (item.available || 0))
  
  return (
    <div className={`
      rounded-xl border bg-white p-4
      ${isComplete ? 'border-emerald-300 bg-emerald-50' : missing > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}
    `}>
      {/* Header з фото та інформацією */}
      <div className="flex gap-4 mb-4">
        {/* Фото */}
        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
          {photoUrl ? (
            <img 
              src={photoUrl} 
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
              Фото
            </div>
          )}
        </div>
        
        {/* Інформація */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 mb-1 line-clamp-2">{item.name}</div>
          <div className="text-xs text-slate-500">SKU: {item.sku || item.article || '—'}</div>
          {/* Локація на складі - Зона + Полиця */}
          {(item.location?.zone || item.location?.aisle || item.location?.shelf) && (() => {
            const zone = item.location.zone && item.location.zone !== 'None' && item.location.zone !== 'null' ? item.location.zone : null
            const shelfParts = [item.location.aisle, item.location.shelf].filter(v => v && v !== 'None' && v !== 'null')
            const shelf = shelfParts.length > 0 ? shelfParts.join('/') : null
            if (!zone && !shelf) return null
            return (
              <div className="text-xs text-corp-primary font-medium mt-0.5">
                {zone && <span>📍 Зона: <b>{zone}</b></span>}
                {zone && shelf && <span> • </span>}
                {shelf && <span>Полиця: <b>{shelf}</b></span>}
              </div>
            )
          })()}
          
          <div className="flex flex-wrap gap-1 mt-2">
            {isComplete && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
                ✓ Готово
              </span>
            )}
            {hasPreDamage && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
                {item.pre_damage.length} пошкодж.
              </span>
            )}
            {missing > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-xs font-medium">
                Бракує {missing}
              </span>
            )}
          </div>
        </div>
        
        {/* QR код */}
        <div className="flex-shrink-0 hidden sm:block">
          <div className="p-1 bg-white border border-slate-200 rounded-lg">
            <QRCodeSVG 
              value={`${window.location.origin}/inventory/${item.sku || item.id}`}
              size={50}
              level="L"
            />
          </div>
        </div>
        
        {/* Кнопка видалення */}
        {onRemoveItem && !readOnly && (
          <button
            onClick={() => {
              if (window.confirm(`Видалити "${item.name}" із замовлення?\nТовар повернеться в наявність.`)) {
                onRemoveItem(item.id, item.name)
              }
            }}
            className="flex-shrink-0 p-2 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Видалити товар із замовлення"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </div>
      
      {/* Лічильник комплектування */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 p-3 bg-slate-100 rounded-xl">
        <span className="text-sm font-medium text-slate-700">Укомплектовано:</span>
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={() => !readOnly && onPick?.(item.id, Math.max(0, pickedQty - 1))} 
            disabled={readOnly || pickedQty === 0}
            className="w-10 h-10 rounded-xl border-2 border-slate-300 bg-white text-lg font-bold disabled:opacity-50 active:bg-slate-100"
          >
            −
          </button>
          <div className={`
            w-12 text-center text-xl font-bold py-1 rounded-lg
            ${isComplete ? 'text-emerald-600 bg-emerald-100' : isOver ? 'text-rose-600 bg-rose-100' : 'bg-white'}
          `}>
            {pickedQty}
          </div>
          <button 
            onClick={() => !readOnly && onPick?.(item.id, pickedQty + 1)} 
            disabled={readOnly}
            className="w-10 h-10 rounded-xl border-2 border-slate-300 bg-white text-lg font-bold disabled:opacity-50 active:bg-slate-100"
          >
            +
          </button>
          <span className="text-sm text-slate-500">/ {qty}</span>
          
          {/* Кнопка швидкого "Зібрано" */}
          {!isComplete && !readOnly && (
            <button 
              onClick={() => onPick?.(item.id, qty)}
              className="px-3 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 active:bg-emerald-700 transition-colors"
            >
              ✓
            </button>
          )}
        </div>
      </div>
      
      {/* Серійні номери */}
      {item.serials && item.serials.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-slate-500 mb-2">Серійні номери:</div>
          <div className="flex flex-wrap gap-2">
            {item.serials.map(serial => {
              const isScanned = item.scanned?.includes(serial)
              return (
                <button 
                  key={serial}
                  onClick={() => !readOnly && onScan?.(item.id, serial)}
                  disabled={readOnly}
                  className={`
                    rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-all
                    ${isScanned 
                      ? 'border-emerald-400 bg-emerald-100 text-emerald-700' 
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                    }
                    disabled:opacity-50
                  `}
                >
                  {serial} {isScanned && '✓'}
                </button>
              )
            })}
          </div>
        </div>
      )}
      
      {/* Інформація про наявність */}
      <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
        <div className="text-center p-2 bg-slate-50 rounded-lg">
          <div className="text-slate-500">Наявність</div>
          <div className="font-bold mt-0.5">{item.available || 0}</div>
        </div>
        <div className="text-center p-2 bg-slate-50 rounded-lg">
          <div className="text-slate-500">Резерв</div>
          <div className="font-bold mt-0.5">{item.reserved || 0}</div>
        </div>
        <div className="text-center p-2 bg-slate-50 rounded-lg">
          <div className="text-slate-500">В оренді</div>
          <div className="font-bold mt-0.5">{item.in_rent || 0}</div>
        </div>
        <div className="text-center p-2 bg-slate-50 rounded-lg">
          <div className="text-slate-500">Реставр.</div>
          <div className="font-bold mt-0.5">{item.in_restore || 0}</div>
        </div>
      </div>
      
      {/* Пакування */}
      <div className="flex flex-wrap gap-2 mb-3">
        <label className="flex items-center gap-2 cursor-pointer bg-slate-50 rounded-lg px-3 py-2 border flex-1 min-w-[90px]">
          <input 
            type="checkbox" 
            checked={item.packaging?.cover || false} 
            onChange={(e) => !readOnly && onPackagingChange?.(item.id, 'cover', e.target.checked)} 
            disabled={readOnly}
            className="w-4 h-4 rounded" 
          />
          <span className="text-sm">Чохол</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer bg-slate-50 rounded-lg px-3 py-2 border flex-1 min-w-[90px]">
          <input 
            type="checkbox" 
            checked={item.packaging?.box || false} 
            onChange={(e) => !readOnly && onPackagingChange?.(item.id, 'box', e.target.checked)} 
            disabled={readOnly}
            className="w-4 h-4 rounded" 
          />
          <span className="text-sm">Коробка</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer bg-slate-50 rounded-lg px-3 py-2 border flex-1 min-w-[90px]">
          <input 
            type="checkbox" 
            checked={item.packaging?.stretch || false} 
            onChange={(e) => !readOnly && onPackagingChange?.(item.id, 'stretch', e.target.checked)} 
            disabled={readOnly}
            className="w-4 h-4 rounded" 
          />
          <span className="text-sm">Стретч</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer bg-slate-50 rounded-lg px-3 py-2 border flex-1 min-w-[90px]">
          <input 
            type="checkbox" 
            checked={item.packaging?.black_case || false} 
            onChange={(e) => !readOnly && onPackagingChange?.(item.id, 'black_case', e.target.checked)} 
            disabled={readOnly}
            className="w-4 h-4 rounded" 
          />
          <span className="text-sm">Чорний кейс</span>
        </label>
      </div>
      
      {/* Кнопка пошкодження */}
      {onOpenDamage && !readOnly && (
        <button 
          onClick={() => onOpenDamage(item.id)} 
          className="w-full py-2.5 rounded-lg bg-amber-500 text-white font-medium text-sm active:bg-amber-600"
        >
          Зафіксувати пошкодження
        </button>
      )}
    </div>
  )
}
