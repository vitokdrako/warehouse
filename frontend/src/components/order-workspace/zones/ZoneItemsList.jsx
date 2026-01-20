/* eslint-disable */
import React, { useState } from 'react'
import ZoneCard from '../ZoneCard'
import { getImageUrl } from '../../../utils/imageHelper'

/**
 * Zone: Items List - Список позицій
 * Універсальний для всіх статусів
 */
export default function ZoneItemsList({
  items = [],
  rentalDays = 1,
  mode = 'view',  // view | edit | pick | return
  onUpdateQuantity,
  onRemoveItem,
  onTogglePicked,
  onOpenDamage,
}) {
  const fmtUA = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })
  
  const canEdit = mode === 'edit'
  const canPick = mode === 'pick'
  const canReturn = mode === 'return'
  
  // Розрахунок сум
  const totals = items.reduce((acc, item) => {
    const qty = parseInt(item.quantity || item.qty) || 0
    const pricePerDay = parseFloat(item.price_per_day || item.price) || 0
    const deposit = parseFloat(item.deposit || item.damage_cost) || 0
    
    acc.rent += pricePerDay * qty * rentalDays
    acc.deposit += deposit * qty
    acc.items += qty
    return acc
  }, { rent: 0, deposit: 0, items: 0 })
  
  return (
    <ZoneCard
      title={`Позиції замовлення (${items.length})`}
      hint={`Всього ${totals.items} од. • Оренда: ₴${fmtUA(totals.rent)} • Застава: ₴${fmtUA(totals.deposit)}`}
      tone="neutral"
    >
      {items.length === 0 ? (
        <div className="text-center py-6 text-corp-text-muted">
          Немає позицій
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <ItemRow 
              key={item.id || idx}
              item={item}
              rentalDays={rentalDays}
              canEdit={canEdit}
              canPick={canPick}
              canReturn={canReturn}
              onUpdateQuantity={onUpdateQuantity}
              onRemoveItem={onRemoveItem}
              onTogglePicked={onTogglePicked}
              onOpenDamage={onOpenDamage}
            />
          ))}
        </div>
      )}
    </ZoneCard>
  )
}

function ItemRow({ 
  item, 
  rentalDays, 
  canEdit, 
  canPick, 
  canReturn,
  onUpdateQuantity,
  onRemoveItem,
  onTogglePicked,
  onOpenDamage,
}) {
  const fmtUA = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })
  
  const qty = parseInt(item.quantity || item.qty) || 0
  const pricePerDay = parseFloat(item.price_per_day || item.price) || 0
  const deposit = parseFloat(item.deposit || item.damage_cost) || 0
  const sku = item.article || item.sku || item.model || ''
  const name = item.name || item.product_name || ''
  const image = item.image || item.photo || ''
  
  // Локація на складі - Зона окремо від Полиці
  const location = item.location || {}
  const validValue = (v) => v && v !== 'None' && v !== 'null'
  const zoneStr = validValue(location.zone) ? location.zone : (validValue(item.zone) ? item.zone : null)
  const shelfParts = [location.aisle, location.shelf].filter(validValue)
  const shelfStr = shelfParts.length > 0 ? shelfParts.join(' / ') : (validValue(item.shelf) ? item.shelf : null)
  const hasLocation = zoneStr || shelfStr
  
  const totalRent = pricePerDay * qty * rentalDays
  const totalDeposit = deposit * qty
  
  // Для комплектації
  const pickedQty = parseInt(item.picked_qty) || 0
  const isFullyPicked = pickedQty >= qty
  
  // Для повернення
  const returnedQty = parseInt(item.returned_qty) || 0
  const hasFindings = (item.findings || []).length > 0
  
  return (
    <div className={`
      rounded-lg border bg-white p-3 flex gap-3
      ${canPick && isFullyPicked ? 'border-corp-primary bg-corp-primary/5' : 'border-corp-border'}
      ${canReturn && hasFindings ? 'border-amber-300 bg-amber-50' : ''}
    `}>
      {/* Зображення */}
      <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-corp-bg-light">
        {image ? (
          <img 
            src={getImageUrl ? getImageUrl(image) : image} 
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-corp-text-muted text-xs">
            Фото
          </div>
        )}
      </div>
      
      {/* Інфо */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-medium text-corp-text-dark text-sm truncate">{name}</div>
            <div className="text-xs text-corp-text-muted">{sku}</div>
            {/* Локація на складі - Зона + Полиця */}
            {hasLocation && (
              <div className="mt-1 inline-flex items-center gap-2 px-2 py-0.5 rounded bg-corp-bg-light text-xs text-corp-text-main">
                {zoneStr && <span>📍 Зона: <b>{zoneStr}</b></span>}
                {shelfStr && <span>Полиця: <b>{shelfStr}</b></span>}
              </div>
            )}
          </div>
          
          {/* Кількість */}
          {canEdit ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdateQuantity?.(item.inventory_id || item.id, Math.max(1, qty - 1))}
                className="w-7 h-7 rounded bg-corp-bg-light hover:bg-corp-border text-corp-text-main"
              >
                −
              </button>
              <span className="w-8 text-center font-medium text-corp-text-dark">{qty}</span>
              <button
                onClick={() => onUpdateQuantity?.(item.inventory_id || item.id, qty + 1)}
                className="w-7 h-7 rounded bg-corp-bg-light hover:bg-corp-border text-corp-text-main"
              >
                +
              </button>
            </div>
          ) : (
            <div className="text-sm font-medium text-corp-text-dark">
              {qty} шт.
            </div>
          )}
        </div>
        
        {/* Ціни */}
        <div className="mt-2 flex items-center gap-3 text-xs">
          <span className="text-corp-text-main">
            ₴{fmtUA(pricePerDay)}/дн. × {rentalDays} = <b className="text-corp-text-dark">₴{fmtUA(totalRent)}</b>
          </span>
          <span className="text-corp-gold">
            Заст: <b>₴{fmtUA(totalDeposit)}</b>
          </span>
        </div>
        
        {/* Комплектація */}
        {canPick && (
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => onTogglePicked?.(item.id)}
              className={`
                px-3 py-1 rounded-lg text-xs font-medium transition-colors
                ${isFullyPicked 
                  ? 'bg-corp-primary text-white' 
                  : 'bg-corp-bg-light text-corp-text-main hover:bg-corp-border'
                }
              `}
            >
              {isFullyPicked ? 'Зібрано' : 'Зібрати'}
            </button>
            <span className="text-xs text-corp-text-muted">
              {pickedQty}/{qty}
            </span>
          </div>
        )}
        
        {/* Повернення */}
        {canReturn && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-corp-text-muted">
              Повернуто: {returnedQty}/{qty}
            </span>
            {onOpenDamage && (
              <button
                onClick={() => onOpenDamage?.(item.id)}
                className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700 hover:bg-amber-200"
              >
                Знахідка
              </button>
            )}
            {hasFindings && (
              <span className="text-xs text-amber-600">
                {item.findings.length} знахідок
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Видалити */}
      {canEdit && onRemoveItem && (
        <button
          onClick={() => onRemoveItem?.(item.inventory_id || item.id)}
          className="text-rose-500 hover:text-rose-700 text-lg font-bold"
          title="Видалити"
        >
          ×
        </button>
      )}
    </div>
  )
}
