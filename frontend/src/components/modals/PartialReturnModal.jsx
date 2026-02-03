/* eslint-disable */
/**
 * PartialReturnModal - Модальне вікно для обробки часткового повернення
 * Показується коли клієнт повернув не всі товари
 */
import React, { useState, useEffect, useMemo } from 'react'
import { X, AlertTriangle, Clock, Package, DollarSign } from 'lucide-react'
import { getImageUrl } from '../../utils/imageHelper'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

// Форматування грошей
const fmtMoney = (val) => {
  const num = parseFloat(val) || 0
  return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PartialReturnModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,              // ✅ Додаємо номер замовлення для версії
  notReturnedItems = [],  // Список неповернених товарів з кількостями
  onConfirm,              // Callback після підтвердження
  onVersionCreated,       // ✅ Callback з version_id для редіректу
}) {
  // Стан для кожного товару: { productId: { action: 'loss'|'extend', adjustedRate: number } }
  const [itemDecisions, setItemDecisions] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Ініціалізувати рішення для кожного товару
  useEffect(() => {
    if (isOpen && notReturnedItems.length > 0) {
      const initial = {}
      notReturnedItems.forEach(item => {
        initial[item.product_id] = {
          action: 'extend', // За замовчуванням - продовження
          adjustedRate: item.daily_rate || 0,
          lossAmount: item.loss_amount || item.full_price * item.not_returned_qty
        }
      })
      setItemDecisions(initial)
    }
  }, [isOpen, notReturnedItems])

  // Оновити рішення для товару
  const updateDecision = (productId, field, value) => {
    setItemDecisions(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }))
  }

  // Підрахунок підсумків
  const summary = useMemo(() => {
    let totalLoss = 0
    let extendedItems = 0
    let lostItems = 0

    notReturnedItems.forEach(item => {
      const decision = itemDecisions[item.product_id]
      if (decision?.action === 'loss') {
        totalLoss += decision.lossAmount || item.loss_amount
        lostItems += item.not_returned_qty
      } else {
        extendedItems += item.not_returned_qty
      }
    })

    return { totalLoss, extendedItems, lostItems }
  }, [notReturnedItems, itemDecisions])

  // Підтвердження - створює НОВУ версію замовлення з неповерненими товарами
  // Оригінальне замовлення закривається і йде в архів
  const handleConfirm = async () => {
    setLoading(true)
    setError(null)

    try {
      // Збираємо товари що НЕ повернулись (action='extend')
      const itemsToKeep = notReturnedItems
        .filter(item => {
          const decision = itemDecisions[item.product_id] || { action: 'extend' }
          return decision.action === 'extend'
        })
        .map(item => {
          const decision = itemDecisions[item.product_id] || {}
          return {
            product_id: item.product_id,
            sku: item.sku,
            name: item.name,
            qty: item.not_returned_qty,
            daily_rate: decision.adjustedRate || item.daily_rate
          }
        })

      // Створюємо нову версію замовлення
      const response = await fetch(`${BACKEND_URL}/api/return-versions/order/${orderId}/create-version`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ not_returned_items: itemsToKeep })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Помилка створення версії')
      }

      const result = await response.json()
      
      onConfirm?.({
        ...result,
        message: `Створено ${result.display_number} з ${result.items_count} позиціями`
      })
      
      // Редірект на версію часткового повернення
      onVersionCreated?.(result.version_id, result.redirect_url)
      
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Часткове повернення</h2>
              <p className="text-sm text-slate-500">
                {notReturnedItems.length} позицій не повернуто
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {notReturnedItems.map(item => {
              const decision = itemDecisions[item.product_id] || { action: 'extend' }
              
              return (
                <div 
                  key={item.product_id}
                  className={`
                    border rounded-xl p-4 transition-all
                    ${decision.action === 'loss' 
                      ? 'border-red-200 bg-red-50' 
                      : 'border-amber-200 bg-amber-50'}
                  `}
                >
                  {/* Item Header */}
                  <div className="flex gap-4 mb-4">
                    {/* Photo */}
                    <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
                      {item.image_url ? (
                        <img 
                          src={getImageUrl(item.image_url)} 
                          alt={item.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-slate-400" />
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 line-clamp-1">{item.name}</div>
                      <div className="text-sm text-slate-500">SKU: {item.sku}</div>
                      <div className="flex gap-4 mt-1 text-sm">
                        <span className="text-slate-600">
                          Не повернуто: <span className="font-bold text-red-600">{item.not_returned_qty} шт</span>
                        </span>
                        <span className="text-slate-500">
                          Ціна: ₴{fmtMoney(item.full_price)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Selection */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Extend Option */}
                    <label 
                      className={`
                        flex-1 flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                        ${decision.action === 'extend' 
                          ? 'border-amber-400 bg-amber-100' 
                          : 'border-slate-200 bg-white hover:border-amber-200'}
                      `}
                    >
                      <input
                        type="radio"
                        name={`action-${item.product_id}`}
                        checked={decision.action === 'extend'}
                        onChange={() => updateDecision(item.product_id, 'action', 'extend')}
                        className="sr-only"
                      />
                      <div className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center
                        ${decision.action === 'extend' ? 'border-amber-500 bg-amber-500' : 'border-slate-300'}
                      `}>
                        {decision.action === 'extend' && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 font-medium text-slate-800">
                          <Clock className="w-4 h-4 text-amber-600" />
                          Продовжити оренду
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Нараховувати прострочення
                        </div>
                      </div>
                    </label>

                    {/* Loss Option */}
                    <label 
                      className={`
                        flex-1 flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                        ${decision.action === 'loss' 
                          ? 'border-red-400 bg-red-100' 
                          : 'border-slate-200 bg-white hover:border-red-200'}
                      `}
                    >
                      <input
                        type="radio"
                        name={`action-${item.product_id}`}
                        checked={decision.action === 'loss'}
                        onChange={() => updateDecision(item.product_id, 'action', 'loss')}
                        className="sr-only"
                      />
                      <div className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center
                        ${decision.action === 'loss' ? 'border-red-500 bg-red-500' : 'border-slate-300'}
                      `}>
                        {decision.action === 'loss' && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 font-medium text-slate-800">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          Повна втрата
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Нарахувати повну вартість
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Rate/Amount Adjustment */}
                  <div className="mt-3 p-3 bg-white/50 rounded-xl">
                    {decision.action === 'extend' ? (
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-4 h-4 text-amber-600" />
                        <span className="text-sm text-slate-600">Добова ставка:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">₴</span>
                          <input
                            type="number"
                            value={decision.adjustedRate || ''}
                            onChange={(e) => updateDecision(item.product_id, 'adjustedRate', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-center font-medium"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <span className="text-xs text-slate-500">× {item.not_returned_qty} шт/день</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-slate-600">Сума втрати:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">₴</span>
                          <input
                            type="number"
                            value={decision.lossAmount || ''}
                            onChange={(e) => updateDecision(item.product_id, 'lossAmount', parseFloat(e.target.value) || 0)}
                            className="w-32 px-2 py-1 border border-slate-200 rounded-lg text-center font-medium"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          {/* Summary */}
          <div className="flex flex-wrap gap-4 mb-4 text-sm">
            {summary.extendedItems > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg">
                <Clock className="w-4 h-4" />
                <span>Продовжено: <strong>{summary.extendedItems} шт</strong></span>
              </div>
            )}
            {summary.lostItems > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-800 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
                <span>Втрата: <strong>{summary.lostItems} шт</strong> (₴{fmtMoney(summary.totalLoss)})</span>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Скасувати
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`
                flex-1 px-4 py-2.5 rounded-xl font-medium text-white transition-colors
                ${loading 
                  ? 'bg-slate-400 cursor-wait' 
                  : 'bg-corp-primary hover:bg-corp-primary/90'}
              `}
            >
              {loading ? 'Обробка...' : 'Підтвердити'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
