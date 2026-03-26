/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import ZoneCard from '../ZoneCard'
import { getImageUrl } from '../../../utils/imageHelper'

// Debounce хук для відкладеного збереження
function useDebounce(callback, delay) {
  const timeoutRef = useRef(null)
  
  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return debouncedCallback
}

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
  highlightedItems = new Set(), // IDs нових позицій для підсвітки
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
          {items.map((item, idx) => {
            const itemId = item.inventory_id || item.id
            const isHighlighted = highlightedItems instanceof Set 
              ? highlightedItems.has(itemId) 
              : false
            
            return (
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
                isHighlighted={isHighlighted}
              />
            )
          })}
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
  isHighlighted = false,
}) {
  const fmtUA = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })
  
  const qty = parseInt(item.quantity || item.qty) || 0
  const pricePerDay = parseFloat(item.price_per_day || item.price) || 0
  const deposit = parseFloat(item.deposit || item.damage_cost) || 0
  const sku = item.article || item.sku || item.model || ''
  const name = item.name || item.product_name || ''
  const image = item.image || item.photo || ''
  
  // Локація - тепер тільки zone
  const location = item.location || {}
  const validValue = (v) => v && v !== 'None' && v !== 'null'
  const zoneStr = validValue(location.zone) ? location.zone : (validValue(item.zone) ? item.zone : null)
  
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
      relative rounded-lg border bg-white p-3 flex gap-3 transition-all duration-500
      ${canPick && isFullyPicked ? 'border-corp-primary bg-corp-primary/5' : 'border-corp-border'}
      ${canReturn && hasFindings ? 'border-amber-300 bg-amber-50' : ''}
      ${isHighlighted ? 'ring-2 ring-green-400 border-green-400 bg-green-50 animate-pulse' : ''}
    `}>
      {/* Позначка NEW для нових */}
      {isHighlighted && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          NEW
        </div>
      )}
      
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
            {/* Локація - тільки zone */}
            {zoneStr && (
              <div className="mt-1 inline-flex items-center gap-2 px-2 py-0.5 rounded bg-corp-bg-light text-xs text-corp-text-main">
                📍 <b>{zoneStr}</b>
              </div>
            )}
            {/* ⚠️ Попередження про пошкодження з журналу стану */}
            {item.has_damage_history && item.damage_history?.length > 0 && (
              <div className="mt-1 flex items-center gap-1 px-2 py-1 rounded bg-amber-50 border border-amber-200 text-xs text-amber-700">
                <span>⚠️</span>
                <span className="font-medium">Пошкодження ({item.damage_history.length})</span>
                <span className="text-amber-500">·</span>
                <span className="truncate">{item.damage_history[0]?.notes || item.damage_history[0]?.type || ''}</span>
              </div>
            )}
          </div>
          
          {/* Кількість */}
          {canEdit ? (
            <QuantityInput
              value={qty}
              onChange={(newQty) => onUpdateQuantity?.(item.inventory_id || item.id, newQty)}
            />
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

/**
 * QuantityInput - Компонент для редагування кількості
 * - Кнопки +/- для швидкого редагування
 * - Можливість ввести число вручну
 * - Debounce 800ms перед збереженням
 */
function QuantityInput({ value, onChange, min = 1, max = 999 }) {
  const [localValue, setLocalValue] = useState(value)
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef(null)
  
  // Синхронізація з зовнішнім значенням
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value)
    }
  }, [value, isEditing])
  
  // Debounced save - зберігати через 800ms після останньої зміни
  const debouncedSave = useDebounce((newValue) => {
    const numValue = parseInt(newValue) || min
    const clampedValue = Math.min(Math.max(numValue, min), max)
    if (clampedValue !== value) {
      onChange(clampedValue)
    }
  }, 800)
  
  // Обробник зміни input
  const handleInputChange = (e) => {
    const newValue = e.target.value
    // Дозволити тільки цифри
    if (/^\d*$/.test(newValue)) {
      setLocalValue(newValue)
      if (newValue !== '') {
        debouncedSave(newValue)
      }
    }
  }
  
  // Обробник кнопок +/-
  const handleButtonClick = (delta) => {
    const newValue = Math.min(Math.max((parseInt(localValue) || min) + delta, min), max)
    setLocalValue(newValue)
    debouncedSave(newValue)
  }
  
  // При фокусі - виділити весь текст
  const handleFocus = () => {
    setIsEditing(true)
    setTimeout(() => {
      inputRef.current?.select()
    }, 0)
  }
  
  // При втраті фокусу - зберегти одразу
  const handleBlur = () => {
    setIsEditing(false)
    const numValue = parseInt(localValue) || min
    const clampedValue = Math.min(Math.max(numValue, min), max)
    setLocalValue(clampedValue)
    if (clampedValue !== value) {
      onChange(clampedValue)
    }
  }
  
  // Enter - зберегти і зняти фокус
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur()
    }
    if (e.key === 'Escape') {
      setLocalValue(value)
      inputRef.current?.blur()
    }
  }
  
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => handleButtonClick(-1)}
        disabled={parseInt(localValue) <= min}
        className="w-7 h-7 rounded bg-corp-bg-light hover:bg-corp-border text-corp-text-main disabled:opacity-40 disabled:cursor-not-allowed"
      >
        −
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={localValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-12 h-7 text-center font-medium text-corp-text-dark bg-white border border-corp-border rounded focus:outline-none focus:ring-2 focus:ring-corp-primary focus:border-transparent"
      />
      <button
        type="button"
        onClick={() => handleButtonClick(1)}
        disabled={parseInt(localValue) >= max}
        className="w-7 h-7 rounded bg-corp-bg-light hover:bg-corp-border text-corp-text-main disabled:opacity-40 disabled:cursor-not-allowed"
      >
        +
      </button>
    </div>
  )
}

