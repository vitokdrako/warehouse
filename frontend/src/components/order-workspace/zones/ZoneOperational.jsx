/* eslint-disable */
import React, { useState, useEffect } from 'react'
import ZoneCard from '../ZoneCard'
import axios from 'axios'
import { Plus, X, Percent, DollarSign } from 'lucide-react'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

/**
 * Zone: Operational - Операційна інформація замовлення
 * Містить: менеджер, знижка (% або сума), додаткова послуга
 */
export default function ZoneOperational({
  managerId = null,
  managerName = '',
  discountPercent = 0,
  discountAmount = 0,
  serviceFee = 0,
  serviceFeeName = '',
  totalBeforeDiscount = 0, // Для розрахунку знижки
  onUpdate,
  readOnly = false,
}) {
  // Локальні стани
  const [localManagerId, setLocalManagerId] = useState(managerId)
  const [localDiscountPercent, setLocalDiscountPercent] = useState(discountPercent)
  const [localDiscountAmount, setLocalDiscountAmount] = useState(discountAmount)
  const [discountMode, setDiscountMode] = useState(discountAmount > 0 ? 'amount' : 'percent') // 'percent' | 'amount'
  const [localServiceFee, setLocalServiceFee] = useState(serviceFee)
  const [localServiceFeeName, setLocalServiceFeeName] = useState(serviceFeeName)
  const [showServiceFeeForm, setShowServiceFeeForm] = useState(serviceFee > 0)
  
  // Список менеджерів
  const [managers, setManagers] = useState([])
  const [loadingManagers, setLoadingManagers] = useState(false)
  
  // Завантаження менеджерів
  useEffect(() => {
    loadManagers()
  }, [])
  
  const loadManagers = async () => {
    try {
      setLoadingManagers(true)
      const response = await axios.get(`${BACKEND_URL}/api/admin/staff`)
      if (response.data.managers) {
        setManagers(response.data.managers)
      }
    } catch (error) {
      console.error('Error loading managers:', error)
      setManagers([])
    } finally {
      setLoadingManagers(false)
    }
  }
  
  // Оновлення при зміні пропсів
  useEffect(() => {
    setLocalManagerId(managerId)
    setLocalDiscountPercent(discountPercent)
    setLocalDiscountAmount(discountAmount)
    setLocalServiceFee(serviceFee)
    setLocalServiceFeeName(serviceFeeName)
    if (discountAmount > 0 && discountPercent === 0) {
      setDiscountMode('amount')
    }
    if (serviceFee > 0) {
      setShowServiceFeeForm(true)
    }
  }, [managerId, discountPercent, discountAmount, serviceFee, serviceFeeName])
  
  // Розрахунок знижки
  const calculateDiscountAmount = () => {
    if (discountMode === 'percent') {
      return (totalBeforeDiscount * localDiscountPercent) / 100
    }
    return localDiscountAmount
  }
  
  const calculateDiscountPercent = () => {
    if (discountMode === 'amount' && totalBeforeDiscount > 0) {
      return (localDiscountAmount / totalBeforeDiscount) * 100
    }
    return localDiscountPercent
  }
  
  // Callback при зміні
  useEffect(() => {
    const selectedManager = managers.find(m => m.user_id === localManagerId)
    const finalDiscountPercent = discountMode === 'percent' ? localDiscountPercent : calculateDiscountPercent()
    const finalDiscountAmount = discountMode === 'amount' ? localDiscountAmount : calculateDiscountAmount()
    
    onUpdate?.({
      managerId: localManagerId,
      managerName: selectedManager?.full_name || '',
      discountPercent: finalDiscountPercent,
      discountAmount: finalDiscountAmount,
      serviceFee: showServiceFeeForm ? localServiceFee : 0,
      serviceFeeName: showServiceFeeForm ? localServiceFeeName : '',
    })
  }, [localManagerId, localDiscountPercent, localDiscountAmount, discountMode, localServiceFee, localServiceFeeName, showServiceFeeForm, managers])
  
  const selectedManagerName = managers.find(m => m.user_id === localManagerId)?.full_name || 'Не вибрано'
  const fmtUA = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })
  
  return (
    <ZoneCard
      title="⚙️ Операційна"
      hint="Менеджер • знижка • додаткові послуги"
      tone="neutral"
    >
      <div className="space-y-4">
        {/* Менеджер */}
        <div>
          <label className="text-xs text-slate-500 block mb-1.5">Менеджер замовлення</label>
          {readOnly ? (
            <div className="font-medium text-slate-800">{selectedManagerName}</div>
          ) : (
            <select
              value={localManagerId || ''}
              onChange={(e) => setLocalManagerId(parseInt(e.target.value) || null)}
              disabled={loadingManagers}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none disabled:bg-slate-100 transition-all"
            >
              {loadingManagers ? (
                <option>Завантаження...</option>
              ) : managers.length === 0 ? (
                <option value="">Немає менеджерів</option>
              ) : (
                managers.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name} ({m.role === 'admin' ? 'Адмін' : m.role === 'manager' ? 'Менеджер' : m.role === 'office_manager' ? 'Офіс' : m.role})
                  </option>
                ))
              )}
            </select>
          )}
        </div>
        
        {/* Знижка */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
          <label className="text-xs text-amber-700 font-medium block mb-2">Знижка</label>
          
          {readOnly ? (
            <div className="font-semibold text-amber-800">
              {localDiscountPercent > 0 && `${localDiscountPercent}%`}
              {localDiscountAmount > 0 && localDiscountPercent > 0 && ' = '}
              {localDiscountAmount > 0 && `₴${fmtUA(localDiscountAmount)}`}
              {localDiscountPercent === 0 && localDiscountAmount === 0 && 'Без знижки'}
            </div>
          ) : (
            <>
              {/* Перемикач режиму */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setDiscountMode('percent')}
                  className={`flex-1 py-2 text-sm rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    discountMode === 'percent'
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <Percent className="w-4 h-4" />
                  Відсотки
                </button>
                <button
                  onClick={() => setDiscountMode('amount')}
                  className={`flex-1 py-2 text-sm rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    discountMode === 'amount'
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  Сума
                </button>
              </div>
              
              {/* Поле вводу */}
              {discountMode === 'percent' ? (
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={localDiscountPercent}
                    onChange={(e) => setLocalDiscountPercent(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full rounded-lg border border-amber-200 px-3 py-2.5 pr-10 text-lg font-semibold focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 font-medium">%</span>
                </div>
              ) : (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 font-medium">₴</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={localDiscountAmount}
                    onChange={(e) => setLocalDiscountAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full rounded-lg border border-amber-200 pl-8 pr-3 py-2.5 text-lg font-semibold focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
                  />
                </div>
              )}
              
              {/* Підказка */}
              {totalBeforeDiscount > 0 && (discountMode === 'percent' ? localDiscountPercent > 0 : localDiscountAmount > 0) && (
                <div className="mt-2 text-xs text-amber-600">
                  {discountMode === 'percent' 
                    ? `= ₴${fmtUA(calculateDiscountAmount())} від ₴${fmtUA(totalBeforeDiscount)}`
                    : `= ${calculateDiscountPercent().toFixed(1)}% від ₴${fmtUA(totalBeforeDiscount)}`
                  }
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Додаткова послуга */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-purple-700 font-medium">Додаткова послуга</label>
            {!readOnly && !showServiceFeeForm && (
              <button
                onClick={() => setShowServiceFeeForm(true)}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Додати
              </button>
            )}
          </div>
          
          {showServiceFeeForm ? (
            <div className="space-y-2">
              {readOnly ? (
                <>
                  <div className="font-semibold text-purple-800">{localServiceFeeName || 'Додаткова послуга'}</div>
                  <div className="text-purple-700">₴{fmtUA(localServiceFee)}</div>
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={localServiceFeeName}
                      onChange={(e) => setLocalServiceFeeName(e.target.value)}
                      placeholder="Назва послуги (напр. Мінімальне замовлення)"
                      className="flex-1 rounded-lg border border-purple-200 px-3 py-2 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                    />
                    <button
                      onClick={() => {
                        setShowServiceFeeForm(false)
                        setLocalServiceFee(0)
                        setLocalServiceFeeName('')
                      }}
                      className="p-2 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500">₴</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={localServiceFee}
                      onChange={(e) => setLocalServiceFee(parseFloat(e.target.value) || 0)}
                      placeholder="Сума"
                      className="w-full rounded-lg border border-purple-200 pl-8 pr-3 py-2 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-sm text-purple-500 italic">
              Немає додаткових послуг
            </div>
          )}
        </div>
      </div>
    </ZoneCard>
  )
}
