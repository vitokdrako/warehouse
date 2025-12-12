/* eslint-disable */
import React, { useState, useEffect } from 'react'
import ZoneCard from '../ZoneCard'
import axios from 'axios'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

/**
 * Zone: Client Form - Форма клієнта для нового замовлення
 * Для статусу: DRAFT
 * Дозволяє редагувати всі поля клієнта
 */
export default function ZoneClientForm({
  clientName = '',
  clientPhone = '',
  clientEmail = '',
  clientType = 'retail',
  managerId = null,
  managerName = '',
  discount = 0,
  onUpdate,
  readOnly = false,
}) {
  const [localName, setLocalName] = useState(clientName)
  const [localPhone, setLocalPhone] = useState(clientPhone)
  const [localEmail, setLocalEmail] = useState(clientEmail)
  const [localType, setLocalType] = useState(clientType)
  const [localManagerId, setLocalManagerId] = useState(managerId)
  const [localDiscount, setLocalDiscount] = useState(discount)
  
  // Список менеджерів з API
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
        // Якщо менеджер не вибраний, вибираємо першого
        if (!localManagerId && response.data.managers.length > 0) {
          setLocalManagerId(response.data.managers[0].user_id)
        }
      }
    } catch (error) {
      console.error('Error loading managers:', error)
      // Fallback до порожнього списку
      setManagers([])
    } finally {
      setLoadingManagers(false)
    }
  }
  
  // Оновлення локальних станів при зміні пропсів
  useEffect(() => {
    setLocalName(clientName)
    setLocalPhone(clientPhone)
    setLocalEmail(clientEmail)
    setLocalType(clientType)
    setLocalManagerId(managerId)
    setLocalDiscount(discount)
  }, [clientName, clientPhone, clientEmail, clientType, managerId, discount])
  
  // Автоматичне оновлення при зміні полів
  useEffect(() => {
    const selectedManager = managers.find(m => m.user_id === localManagerId)
    onUpdate?.({
      name: localName,
      phone: localPhone,
      email: localEmail,
      type: localType,
      managerId: localManagerId,
      managerName: selectedManager?.full_name || '',
      discount: localDiscount,
    })
  }, [localName, localPhone, localEmail, localType, localManagerId, localDiscount, managers])
  
  // Отримання імені вибраного менеджера
  const selectedManagerName = managers.find(m => m.user_id === localManagerId)?.full_name || 'Не вибрано'
  
  return (
    <ZoneCard
      title="👤 Клієнт"
      hint="Інформація про клієнта • менеджер • знижка"
      tone={!localName || !localPhone ? 'warn' : 'neutral'}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ліва колонка - основні дані */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Ім'я клієнта *</label>
            {readOnly ? (
              <div className="font-medium text-slate-800">{localName || '—'}</div>
            ) : (
              <input
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="Введіть ім'я клієнта"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:ring-1 outline-none ${
                  !localName ? 'border-amber-300 focus:border-amber-400 focus:ring-amber-400' : 'border-slate-200 focus:border-blue-400 focus:ring-blue-400'
                }`}
              />
            )}
          </div>
          
          <div>
            <label className="text-xs text-slate-500 block mb-1">Телефон *</label>
            {readOnly ? (
              <a href={`tel:${localPhone}`} className="block font-medium text-blue-600 hover:text-blue-800">
                {localPhone || '—'}
              </a>
            ) : (
              <input
                type="tel"
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value)}
                placeholder="+380..."
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:ring-1 outline-none ${
                  !localPhone ? 'border-amber-300 focus:border-amber-400 focus:ring-amber-400' : 'border-slate-200 focus:border-blue-400 focus:ring-blue-400'
                }`}
              />
            )}
          </div>
          
          <div>
            <label className="text-xs text-slate-500 block mb-1">Email</label>
            {readOnly ? (
              <div className="font-medium text-slate-800 text-sm">{localEmail || 'Не вказано'}</div>
            ) : (
              <input
                type="email"
                value={localEmail}
                onChange={(e) => setLocalEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
              />
            )}
          </div>
        </div>
        
        {/* Права колонка - налаштування */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Тип клієнта</label>
            {readOnly ? (
              <div className="font-medium text-slate-800">
                {localType === 'wholesale' ? '🏢 Опт' : '👤 Роздріб'}
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLocalType('retail')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    localType === 'retail' 
                      ? 'bg-blue-50 border-blue-300 text-blue-700' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  👤 Роздріб
                </button>
                <button
                  type="button"
                  onClick={() => setLocalType('wholesale')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    localType === 'wholesale' 
                      ? 'bg-blue-50 border-blue-300 text-blue-700' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🏢 Опт
                </button>
              </div>
            )}
          </div>
          
          <div>
            <label className="text-xs text-slate-500 block mb-1">Менеджер</label>
            {readOnly ? (
              <div className="font-medium text-slate-800">{selectedManagerName}</div>
            ) : (
              <select
                value={localManagerId || ''}
                onChange={(e) => setLocalManagerId(parseInt(e.target.value) || null)}
                disabled={loadingManagers}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none disabled:bg-slate-100"
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
          
          <div>
            <label className="text-xs text-slate-500 block mb-1">Знижка (%)</label>
            {readOnly ? (
              <div className="font-medium text-slate-800">{localDiscount}%</div>
            ) : (
              <input
                type="number"
                min="0"
                max="100"
                value={localDiscount}
                onChange={(e) => setLocalDiscount(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
              />
            )}
          </div>
        </div>
      </div>
    </ZoneCard>
  )
}
