/* eslint-disable */
/**
 * PartialReturnVersionWorkspace - Робочий простір версії часткового повернення
 * 
 * ВАЖЛИВО: Використовує ті ж компоненти що і ReturnOrderWorkspace:
 * - ZoneItemsReturn - приймання товарів з +/- та фіксацією шкоди
 * - ZoneReturnFees - нарахування (пеня, чистка, шкода)
 * - ZoneRequisitors - вибір приймальників
 * - DamageModal - модалка шкоди
 * - InternalNotesChat - внутрішній чат
 * 
 * Дані беруться з partial_return_versions + partial_return_version_items
 * Шкода синхронізується через parent_order_id
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../hooks/use-toast'
import axios from 'axios'

import {
  OrderWorkspaceLayout,
  LeftRailClient,
  InternalNotesChat,
} from '../components/order-workspace'

import {
  ZoneItemsReturn,
  ZoneReturnFees,
  ZoneRequisitors,
} from '../components/order-workspace/zones'

import DamageModal from '../components/DamageModal'
import { ArrowLeft, History, ChevronDown, Package } from 'lucide-react'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token')
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  })
}

export default function PartialReturnVersionWorkspace() {
  const { versionId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  
  // === СТАН ===
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [version, setVersion] = useState(null)
  const [items, setItems] = useState([])
  const [isCompleted, setIsCompleted] = useState(false)
  
  // Нарахування
  const [lateFee, setLateFee] = useState(0)
  const [cleaningFee, setCleaningFee] = useState(0)
  const [damageFee, setDamageFee] = useState(0)
  
  // Фінансовий summary
  const [financeSummary, setFinanceSummary] = useState(null)
  
  // Приймальники
  const [selectedRequisitors, setSelectedRequisitors] = useState([])
  
  // Модалка шкоди
  const [damageModal, setDamageModal] = useState({ open: false, item: null })
  
  // Історія версій
  const [showHistory, setShowHistory] = useState(false)
  
  // === ЗАВАНТАЖЕННЯ ДАНИХ ===
  const loadVersion = useCallback(async () => {
    try {
      const response = await authFetch(`${BACKEND_URL}/api/return-versions/version/${versionId}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Помилка завантаження')
      }
      
      const data = await response.json()
      setVersion(data)
      
      // Конвертуємо items до формату ZoneItemsReturn
      const formattedItems = (data.items || []).map(item => ({
        id: item.item_id,
        item_id: item.item_id,
        product_id: item.product_id,
        sku: item.sku,
        name: item.name,
        rented_qty: item.qty,
        returned_qty: item.status === 'returned' ? item.qty : 0,
        daily_rate: item.daily_rate,
        status: item.status,
        findings: [],  // Завантажити з damage_records через parent_order_id
        ok_serials: [],
        serials: [],
        image: item.image_url || null,
        image_url: item.image_url || null,
        damage_history: []
      }))
      
      setItems(formattedItems)
      setIsCompleted(data.status === 'returned')
      
      // Рахуємо пеню за прострочення
      if (data.days_overdue > 0) {
        setLateFee(data.total_price * data.days_overdue)
      }
      
      // Завантажуємо фінансовий summary
      try {
        const finResponse = await authFetch(`${BACKEND_URL}/api/return-versions/version/${versionId}/finance-summary`)
        if (finResponse.ok) {
          const finData = await finResponse.json()
          setFinanceSummary(finData)
          console.log('[VersionWorkspace] Finance summary loaded:', finData)
        }
      } catch (finErr) {
        console.log('[VersionWorkspace] Finance summary not available')
      }
      
      setLoading(false)
      
    } catch (err) {
      console.error('[VersionWorkspace] Error loading version:', err)
      toast({
        title: '❌ Помилка',
        description: err.message,
        variant: 'destructive'
      })
      setLoading(false)
    }
  }, [versionId, toast])
  
  useEffect(() => {
    loadVersion()
  }, [loadVersion])
  
  // === ОБРОБНИКИ ТОВАРІВ ===
  
  // Змінити кількість повернених
  const handleSetReturnedQty = useCallback(async (itemId, qty) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, returned_qty: qty } : item
    ))
    
    // Зберегти на сервер
    try {
      const item = items.find(i => i.id === itemId)
      if (qty >= item.rented_qty) {
        // Товар повністю повернено
        await authFetch(`${BACKEND_URL}/api/return-versions/version/${versionId}/return-item`, {
          method: 'POST',
          body: JSON.stringify({ item_id: itemId, qty })
        })
      }
    } catch (err) {
      console.error('[VersionWorkspace] Error updating qty:', err)
    }
  }, [items, versionId])
  
  // Відкрити модалку шкоди
  const handleOpenDamage = useCallback((itemId) => {
    const item = items.find(i => i.id === itemId)
    if (item) {
      setDamageModal({ open: true, item })
    }
  }, [items])
  
  // Зберегти шкоду
  const handleSaveDamage = async (damageData) => {
    try {
      // Зберігаємо шкоду через parent_order_id (синхронізація з основним замовленням)
      await axios.post(`${BACKEND_URL}/api/orders/${version.parent_order_id}/damage`, {
        ...damageData,
        source: 'partial_return_version',
        version_id: versionId
      })
      
      // Оновлюємо локальний стан
      setItems(prev => prev.map(item => {
        if (item.id === damageModal.item?.id) {
          return {
            ...item,
            findings: [...(item.findings || []), damageData],
            has_damage_history: true
          }
        }
        return item
      }))
      
      // Оновлюємо суму шкоди
      setDamageFee(prev => prev + (damageData.amount || 0))
      
      setDamageModal({ open: false, item: null })
      toast({ title: '✅ Шкоду зафіксовано' })
      
    } catch (err) {
      console.error('[VersionWorkspace] Error saving damage:', err)
      toast({
        title: '❌ Помилка',
        description: 'Не вдалося зберегти шкоду',
        variant: 'destructive'
      })
    }
  }
  
  // === НАРАХУВАННЯ ПРОСТРОЧЕННЯ В ФІН СИСТЕМУ ===
  const handleChargeLate = async () => {
    if (!financeSummary || financeSummary.calculated_late_fee <= 0) {
      toast({
        title: '⚠️ Увага',
        description: 'Немає прострочення для нарахування',
        variant: 'destructive'
      })
      return
    }
    
    const amount = financeSummary.calculated_late_fee
    if (!confirm(`Нарахувати прострочення ₴${amount.toFixed(2)} у фінансову систему?`)) {
      return
    }
    
    setSaving(true)
    try {
      const response = await authFetch(`${BACKEND_URL}/api/return-versions/version/${versionId}/charge-late`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amount,
          note: `Прострочення ${version?.display_number} (${financeSummary.days_overdue} дн.)`,
          method: 'cash'
        })
      })
      
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Помилка')
      }
      
      const result = await response.json()
      
      // Оновлюємо фінансовий summary
      setFinanceSummary(prev => ({
        ...prev,
        charged_amount: prev.charged_amount + amount,
        due_amount: prev.due_amount + amount
      }))
      
      toast({
        title: '✅ Прострочення нараховано',
        description: `₴${amount.toFixed(2)} додано до фінансової системи`
      })
      
    } catch (err) {
      toast({
        title: '❌ Помилка',
        description: err.message,
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }
  
  // === ЗАВЕРШЕННЯ ПРИЙМАННЯ ===
  const handleComplete = async () => {
    // Перевірити чи всі товари повернуто
    const allReturned = items.every(item => item.returned_qty >= item.rented_qty)
    
    if (!allReturned) {
      // Є неповернені товари - запитати підтвердження
      const notReturned = items.filter(i => i.returned_qty < i.rented_qty)
      if (!confirm(`Не всі товари повернено (${notReturned.length} позицій). Створити нову версію?`)) {
        return
      }
      
      // Створити нову версію з неповерненими товарами
      setSaving(true)
      try {
        const response = await authFetch(`${BACKEND_URL}/api/return-versions/order/${version.parent_order_id}/create-version`, {
          method: 'POST',
          body: JSON.stringify({
            not_returned_items: notReturned.map(item => ({
              product_id: item.product_id,
              sku: item.sku,
              name: item.name,
              qty: item.rented_qty - item.returned_qty,
              daily_rate: item.daily_rate
            }))
          })
        })
        
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.detail || 'Помилка')
        }
        
        const result = await response.json()
        toast({ 
          title: '✅ Створено нову версію', 
          description: result.display_number 
        })
        
        // Перейти на нову версію
        navigate(result.redirect_url)
        
      } catch (err) {
        toast({
          title: '❌ Помилка',
          description: err.message,
          variant: 'destructive'
        })
      } finally {
        setSaving(false)
      }
      return
    }
    
    // Всі товари повернено - закрити версію
    setSaving(true)
    try {
      const response = await authFetch(`${BACKEND_URL}/api/return-versions/version/${versionId}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          late_fee: lateFee,
          cleaning_fee: cleaningFee,
          damage_fee: damageFee,
          requisitors: selectedRequisitors
        })
      })
      
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Помилка')
      }
      
      setIsCompleted(true)
      toast({ 
        title: '✅ Версію закрито', 
        description: 'Всі товари прийнято' 
      })
      
      setTimeout(() => navigate('/manager'), 2000)
      
    } catch (err) {
      toast({
        title: '❌ Помилка',
        description: err.message,
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }
  
  // === РЕНДЕР ===
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-corp-primary border-t-transparent rounded-full" />
      </div>
    )
  }
  
  const totalFees = lateFee + cleaningFee + damageFee
  const totalReturned = items.reduce((s, i) => s + i.returned_qty, 0)
  const totalRented = items.reduce((s, i) => s + i.rented_qty, 0)
  const canComplete = totalReturned > 0
  
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-6 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/manager')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-800">
                {version?.display_number}
              </h1>
              <p className="text-sm text-slate-500">
                Часткове повернення • {version?.version_number > 1 ? `Версія ${version.version_number}` : 'Перша версія'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Історія версій */}
            {version?.version_history?.length > 1 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <History className="w-4 h-4" />
                Версії ({version.version_history.length})
                <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
              </button>
            )}
            
            {/* Статус */}
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              version?.status === 'active' ? 'bg-amber-100 text-amber-800' :
              version?.status === 'returned' ? 'bg-green-100 text-green-800' :
              'bg-slate-100 text-slate-600'
            }`}>
              {version?.status === 'active' ? '⏳ Активна' :
               version?.status === 'returned' ? '✓ Закрита' :
               '📦 Архів'}
            </span>
            
            {/* Кнопка завершення */}
            {!isCompleted && (
              <button
                onClick={handleComplete}
                disabled={saving || !canComplete}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  saving || !canComplete
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {saving ? 'Обробка...' : 'Завершити приймання'}
              </button>
            )}
          </div>
        </div>
        
        {/* Dropdown історії версій */}
        {showHistory && version?.version_history && (
          <div className="absolute top-full right-6 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-30 w-64">
            {version.version_history.map(v => (
              <button
                key={v.version_id}
                onClick={() => {
                  if (v.version_id !== parseInt(versionId)) {
                    navigate(`/partial-return/${v.version_id}`)
                  }
                  setShowHistory(false)
                }}
                className={`w-full px-4 py-2 text-left hover:bg-slate-50 flex justify-between items-center ${
                  v.version_id === parseInt(versionId) ? 'bg-blue-50' : ''
                }`}
              >
                <span className="font-medium text-slate-800">{v.display_number}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  v.status === 'active' ? 'bg-amber-100 text-amber-800' :
                  v.status === 'returned' ? 'bg-green-100 text-green-800' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {v.status === 'active' ? 'Активна' : v.status === 'returned' ? 'Закрита' : 'Архів'}
                </span>
              </button>
            ))}
          </div>
        )}
      </header>
      
      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Ліва колонка - Інфо та чат */}
          <div className="lg:col-span-3 space-y-4">
            {/* Клієнт */}
            <LeftRailClient
              name={version?.customer?.name || '—'}
              phone={version?.customer?.phone || '—'}
              email={version?.customer?.email}
            />
            
            {/* Інфо про замовлення */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-800 mb-3">📋 Інформація</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Оригінал:</span>
                  <button 
                    onClick={() => navigate(`/return/${version?.parent_order_id}`)}
                    className="text-blue-600 hover:underline"
                  >
                    #{version?.parent_order_number}
                  </button>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Початок:</span>
                  <span className="text-slate-800">{version?.rental_start_date || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Закінчення:</span>
                  <span className="text-slate-800">{version?.rental_end_date || '—'}</span>
                </div>
                {version?.days_overdue > 0 && (
                  <div className="flex justify-between pt-2 border-t border-slate-100">
                    <span className="text-red-600 font-medium">Прострочення:</span>
                    <span className="text-red-600 font-bold">+{version.days_overdue} дн.</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Внутрішній чат */}
            <InternalNotesChat
              orderId={version?.parent_order_id}
              notes={[]}
              onSendNote={() => {}}
            />
          </div>
          
          {/* Центр - Товари */}
          <div className="lg:col-span-6 space-y-4">
            {/* Приймальники */}
            <ZoneRequisitors
              selectedIds={selectedRequisitors}
              onSelectionChange={setSelectedRequisitors}
              readOnly={isCompleted}
              title="Приймальники"
              hint="Оберіть хто приймає повернення"
            />
            
            {/* Товари */}
            <ZoneItemsReturn
              items={items}
              onSetReturnedQty={handleSetReturnedQty}
              onToggleSerial={() => {}}
              onOpenDamage={handleOpenDamage}
              readOnly={isCompleted}
              isCompleted={isCompleted}
            />
          </div>
          
          {/* Права колонка - Нарахування */}
          <div className="lg:col-span-3 space-y-4">
            {/* Нарахування */}
            <ZoneReturnFees
              lateFee={lateFee}
              cleaningFee={cleaningFee}
              damageFee={damageFee}
              onSetLateFee={setLateFee}
              onSetCleaningFee={setCleaningFee}
              onSetDamageFee={setDamageFee}
              readOnly={isCompleted}
            />
            
            {/* Підсумок */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-800 mb-3">💵 Підсумок</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Добова ставка:</span>
                  <span className="text-slate-800">₴{version?.total_price?.toFixed(2) || '0.00'}</span>
                </div>
                {financeSummary?.days_overdue > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">× {financeSummary.days_overdue} дн. прострочення:</span>
                      <span className="text-red-600 font-medium">₴{financeSummary.calculated_late_fee?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Нараховано в фін систему:</span>
                      <span className={financeSummary.charged_amount > 0 ? 'text-green-600' : 'text-slate-400'}>
                        ₴{financeSummary.charged_amount?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    {financeSummary.paid_amount > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Оплачено:</span>
                        <span className="text-green-600">₴{financeSummary.paid_amount?.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                {totalFees > 0 && (
                  <div className="flex justify-between pt-2 border-t border-slate-100">
                    <span className="text-slate-700 font-medium">До оплати:</span>
                    <span className="text-lg font-bold text-slate-800">₴{totalFees.toFixed(2)}</span>
                  </div>
                )}
              </div>
              
              {/* Кнопка нарахування прострочення */}
              {!isCompleted && financeSummary?.calculated_late_fee > 0 && financeSummary?.charged_amount < financeSummary?.calculated_late_fee && (
                <button
                  onClick={handleChargeLate}
                  disabled={saving}
                  className="w-full mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {saving ? 'Обробка...' : `💰 Нарахувати прострочення ₴${(financeSummary.calculated_late_fee - financeSummary.charged_amount).toFixed(2)}`}
                </button>
              )}
              
              {financeSummary?.charged_amount >= financeSummary?.calculated_late_fee && financeSummary?.calculated_late_fee > 0 && (
                <div className="mt-4 text-center text-sm text-green-600 bg-green-50 rounded-lg py-2">
                  ✓ Прострочення нараховано у фін систему
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      {/* Модалка шкоди */}
      <DamageModal
        isOpen={damageModal.open}
        onClose={() => setDamageModal({ open: false, item: null })}
        item={damageModal.item}
        orderId={version?.parent_order_id}
        onSave={handleSaveDamage}
      />
    </div>
  )
}
