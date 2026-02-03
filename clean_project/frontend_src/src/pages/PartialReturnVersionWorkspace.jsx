/* eslint-disable */
/**
 * PartialReturnVersionWorkspace - Робочий простір для версій часткового повернення
 * 
 * Показує деталі версії (OC-7266(1), OC-7266(2), тощо) з товарами що залишились у клієнта.
 * Дозволяє:
 * - Переглянути товари що залишились
 * - Прийняти товари (позначити як повернені)
 * - Створити нову версію (ще одне часткове повернення)
 * - Переглянути історію версій
 */

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Package, Clock, User, Phone, Mail, Calendar, History, Check, AlertTriangle, ChevronDown } from 'lucide-react'

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
  
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(null)
  const [error, setError] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [returning, setReturning] = useState({})  // { item_id: true } для індикатора завантаження
  
  // Завантажити дані версії
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await authFetch(`${BACKEND_URL}/api/return-versions/version/${versionId}`)
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.detail || 'Помилка завантаження')
        }
        const data = await response.json()
        setVersion(data)
        setLoading(false)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }
    
    fetchVersion()
  }, [versionId])
  
  // Позначити товар як повернений
  const handleReturnItem = async (itemId, sku) => {
    setReturning(prev => ({ ...prev, [itemId]: true }))
    
    try {
      const response = await authFetch(`${BACKEND_URL}/api/return-versions/version/${versionId}/return-item`, {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId, sku })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Помилка')
      }
      
      const result = await response.json()
      
      // Оновити локальний стан
      setVersion(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item.item_id === itemId 
            ? { ...item, status: 'returned', returned_at: new Date().toISOString() }
            : item
        ),
        status: result.all_returned ? 'returned' : prev.status
      }))
      
      if (result.all_returned) {
        alert('✅ Всі товари повернено! Версія закрита.')
        navigate('/manager')
      }
      
    } catch (err) {
      alert(`❌ Помилка: ${err.message}`)
    } finally {
      setReturning(prev => ({ ...prev, [itemId]: false }))
    }
  }
  
  // Завершити версію (всі товари повернено)
  const handleCompleteVersion = async () => {
    if (!confirm('Підтвердити що всі товари повернено?')) return
    
    try {
      const response = await authFetch(`${BACKEND_URL}/api/return-versions/version/${versionId}/complete`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Помилка')
      }
      
      alert('✅ Версія закрита. Всі товари повернено!')
      navigate('/manager')
      
    } catch (err) {
      alert(`❌ Помилка: ${err.message}`)
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-corp-primary border-t-transparent rounded-full" />
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Помилка</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <button 
            onClick={() => navigate('/manager')}
            className="px-4 py-2 bg-corp-primary text-white rounded-lg hover:bg-corp-primary/90"
          >
            На дашборд
          </button>
        </div>
      </div>
    )
  }
  
  const pendingItems = version?.items?.filter(i => i.status === 'pending') || []
  const returnedItems = version?.items?.filter(i => i.status === 'returned') || []
  
  return (
    <div className="min-h-screen bg-slate-50 font-montserrat">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/manager')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                {version?.display_number}
              </h1>
              <p className="text-sm text-slate-500">
                Часткове повернення • Версія {version?.version_number}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {version?.status === 'active' && pendingItems.length === 0 && (
              <button
                onClick={handleCompleteVersion}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Закрити версію
              </button>
            )}
            
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              version?.status === 'active' ? 'bg-amber-100 text-amber-800' :
              version?.status === 'returned' ? 'bg-green-100 text-green-800' :
              'bg-slate-100 text-slate-600'
            }`}>
              {version?.status === 'active' ? '⏳ Активна' :
               version?.status === 'returned' ? '✓ Закрита' :
               '📦 Архів'}
            </span>
          </div>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Ліва колонка - Інформація */}
          <div className="space-y-6">
            {/* Клієнт */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-corp-primary" />
                Клієнт
              </h3>
              <div className="space-y-3">
                <div className="font-medium text-slate-800">{version?.customer?.name}</div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4" />
                  <a href={`tel:${version?.customer?.phone}`} className="hover:text-corp-primary">
                    {version?.customer?.phone}
                  </a>
                </div>
                {version?.customer?.email && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-4 h-4" />
                    <a href={`mailto:${version?.customer?.email}`} className="hover:text-corp-primary">
                      {version?.customer?.email}
                    </a>
                  </div>
                )}
              </div>
            </div>
            
            {/* Дати та прострочення */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-corp-primary" />
                Період оренди
              </h3>
              <div className="space-y-3 text-sm">
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
                    <span className="text-red-600 font-bold">+{version.days_overdue} днів</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Історія версій */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between font-semibold text-slate-800"
              >
                <span className="flex items-center gap-2">
                  <History className="w-5 h-5 text-corp-primary" />
                  Історія версій ({version?.version_history?.length || 0})
                </span>
                <ChevronDown className={`w-5 h-5 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
              </button>
              
              {showHistory && (
                <div className="mt-4 space-y-2">
                  {version?.version_history?.map(v => (
                    <div 
                      key={v.version_id}
                      onClick={() => v.version_id !== parseInt(versionId) && navigate(`/partial-return/${v.version_id}`)}
                      className={`p-3 rounded-lg border transition-colors ${
                        v.version_id === parseInt(versionId) 
                          ? 'bg-corp-primary/5 border-corp-primary' 
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100 cursor-pointer'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-slate-800">{v.display_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          v.status === 'active' ? 'bg-amber-100 text-amber-800' :
                          v.status === 'returned' ? 'bg-green-100 text-green-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {v.status === 'active' ? 'Активна' : v.status === 'returned' ? 'Закрита' : 'Архів'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {v.created_at ? new Date(v.created_at).toLocaleString('uk-UA') : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Посилання на батьківське замовлення */}
            <button
              onClick={() => navigate(`/return/${version?.parent_order_id}`)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl p-4 text-sm transition-colors"
            >
              Переглянути оригінальне замовлення #{version?.parent_order_number}
            </button>
          </div>
          
          {/* Права колонка - Товари */}
          <div className="lg:col-span-2 space-y-6">
            {/* Товари що залишились */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-600" />
                Товари у клієнта ({pendingItems.length})
              </h3>
              
              {pendingItems.length > 0 ? (
                <div className="space-y-3">
                  {pendingItems.map(item => (
                    <div 
                      key={item.item_id}
                      className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-slate-800">{item.name}</div>
                        <div className="text-sm text-slate-500">
                          SKU: {item.sku} • {item.qty} шт • ₴{item.daily_rate?.toFixed(2)}/день
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleReturnItem(item.item_id, item.sku)}
                        disabled={returning[item.item_id]}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          returning[item.item_id]
                            ? 'bg-slate-200 text-slate-500 cursor-wait'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {returning[item.item_id] ? 'Обробка...' : '✓ Прийняти'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Check className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>Всі товари прийнято</p>
                </div>
              )}
            </div>
            
            {/* Вже повернені товари */}
            {returnedItems.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  Прийнято ({returnedItems.length})
                </h3>
                
                <div className="space-y-2">
                  {returnedItems.map(item => (
                    <div 
                      key={item.item_id}
                      className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg opacity-75"
                    >
                      <div>
                        <div className="font-medium text-slate-700">{item.name}</div>
                        <div className="text-sm text-slate-500">
                          SKU: {item.sku} • {item.qty} шт
                        </div>
                      </div>
                      <span className="text-green-600 text-sm">
                        ✓ {item.returned_at ? new Date(item.returned_at).toLocaleDateString('uk-UA') : 'Повернено'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Сума */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Очікувана добова ставка:</span>
                <span className="text-2xl font-bold text-slate-800">
                  ₴ {version?.total_price?.toFixed(2) || '0.00'}
                </span>
              </div>
              {version?.days_overdue > 0 && (
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                  <span className="text-red-600">Прострочення ({version.days_overdue} дн.):</span>
                  <span className="text-xl font-bold text-red-600">
                    ₴ {(version.total_price * version.days_overdue).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
