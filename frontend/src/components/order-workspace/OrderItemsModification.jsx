/* eslint-disable */
/**
 * OrderItemsModification - Компонент для дозамовлення та редагування позицій
 * Дозволяє додавати, змінювати кількість та видаляти товари на етапі комплектації
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { Plus, Minus, X, RotateCcw, Search, Package, AlertTriangle, History, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '../ui/button'
import { getImageUrl, handleImageError } from '../../utils/imageHelper'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog'
import { useToast } from '../../hooks/use-toast'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

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
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return debouncedCallback
}

export default function OrderItemsModification({ 
  orderId, 
  orderStatus,
  items = [], 
  onItemsChange,
  onTotalsChange 
}) {
  const { toast } = useToast()
  
  // Дозволені статуси для редагування (order status або issue card status)
  // Маппінг: preparation -> processing, ready -> ready_for_issue
  const allowedStatuses = ['processing', 'ready_for_issue', 'preparation', 'ready']
  const canModify = allowedStatuses.includes(orderStatus)
  
  // Стан
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [modifications, setModifications] = useState([])
  const [refusedItems, setRefusedItems] = useState([])
  const [showRefused, setShowRefused] = useState(false)
  const [selectedQuantities, setSelectedQuantities] = useState({}) // Вибрана кількість для кожного товару
  
  // Завантаження історії та відмовлених
  useEffect(() => {
    if (orderId) {
      loadModifications()
      loadRefusedItems()
    }
  }, [orderId])
  
  const loadModifications = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${BACKEND_URL}/api/orders/${orderId}/modifications`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setModifications(res.data.modifications || [])
    } catch (err) {
      console.log('Could not load modifications:', err)
    }
  }
  
  const loadRefusedItems = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${BACKEND_URL}/api/orders/${orderId}/items/refused`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setRefusedItems(res.data.refused_items || [])
    } catch (err) {
      console.log('Could not load refused items:', err)
    }
  }
  
  // Пошук товарів - використовуємо той самий API що і на сторінці створення замовлення
  const searchProducts = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }
    
    setSearching(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${BACKEND_URL}/api/orders/inventory/search`, {
        params: { query, limit: 20 },
        headers: { Authorization: `Bearer ${token}` }
      })
      
      // Трансформуємо результати
      const results = (res.data.products || []).map(p => ({
        product_id: p.product_id,
        sku: p.sku,
        name: p.name,
        rental_price: p.rent_price || 0,
        price: p.price || 0,
        quantity: p.available_quantity || 0,
        image_url: p.image_url
      }))
      
      setSearchResults(results)
    } catch (err) {
      console.error('Search error:', err)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }
  
  // Додати товар з вибраною кількістю
  const handleAddItem = async (product) => {
    const quantity = selectedQuantities[product.product_id] || 1
    
    // Перевірка наявності
    if (quantity > product.quantity) {
      toast({
        title: '⚠️ Недостатня кількість',
        description: `На складі лише ${product.quantity} шт`,
        variant: 'destructive'
      })
      return
    }
    
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${BACKEND_URL}/api/orders/${orderId}/items`,
        {
          product_id: product.product_id,
          quantity: quantity,
          note: `Дозамовлення: ${quantity} шт`
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      toast({
        title: '✅ Товар додано',
        description: `${product.name} (${quantity} шт) додано до замовлення`
      })
      
      // Оновлюємо дані
      if (onTotalsChange && res.data.totals) {
        onTotalsChange(res.data.totals)
      }
      
      // Закриваємо модалку
      setShowAddModal(false)
      setSearchQuery('')
      setSearchResults([])
      setSelectedQuantities({})
      
      // Перезавантажуємо сторінку для отримання оновлених items
      window.location.reload()
      
    } catch (err) {
      toast({
        title: '❌ Помилка',
        description: err.response?.data?.detail || 'Не вдалося додати товар',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Змінити кількість
  const handleUpdateQuantity = async (itemId, newQuantity) => {
    if (newQuantity < 0) return
    
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.patch(
        `${BACKEND_URL}/api/orders/${orderId}/items/${itemId}`,
        {
          quantity: newQuantity,
          note: `Зміна кількості`
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      toast({
        title: '✅ Кількість оновлено',
        description: res.data.message
      })
      
      if (onTotalsChange && res.data.totals) {
        onTotalsChange(res.data.totals)
      }
      
      loadModifications()
      
      // Оновлюємо локальний стан items
      if (onItemsChange) {
        onItemsChange(items.map(item => 
          item.id === itemId ? { ...item, qty: newQuantity } : item
        ))
      }
      
    } catch (err) {
      toast({
        title: '❌ Помилка',
        description: err.response?.data?.detail || 'Не вдалося оновити кількість',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Відмовити позицію
  const handleRemoveItem = async (itemId, productName) => {
    if (!confirm(`Відмовити позицію "${productName}"?`)) return
    
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.delete(
        `${BACKEND_URL}/api/orders/${orderId}/items/${itemId}`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          data: { reason: 'Відмова клієнта' }
        }
      )
      
      toast({
        title: '🚫 Позицію відмовлено',
        description: `${productName} позначено як відмова`
      })
      
      if (onTotalsChange && res.data.totals) {
        onTotalsChange(res.data.totals)
      }
      
      loadModifications()
      loadRefusedItems()
      
      // Оновлюємо локальний стан - прибираємо item
      if (onItemsChange) {
        onItemsChange(items.filter(item => item.id !== itemId))
      }
      
    } catch (err) {
      toast({
        title: '❌ Помилка',
        description: err.response?.data?.detail || 'Не вдалося відмовити позицію',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Відновити відмовлену позицію
  const handleRestoreItem = async (itemId, productName) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${BACKEND_URL}/api/orders/${orderId}/items/${itemId}/restore`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      toast({
        title: '✅ Позицію відновлено',
        description: `${productName} повернено до замовлення`
      })
      
      if (onTotalsChange && res.data.totals) {
        onTotalsChange(res.data.totals)
      }
      
      loadModifications()
      loadRefusedItems()
      
      // Перезавантажуємо сторінку
      window.location.reload()
      
    } catch (err) {
      toast({
        title: '❌ Помилка',
        description: err.response?.data?.detail || 'Не вдалося відновити позицію',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }
  
  if (!canModify) {
    return null // Не показуємо якщо не можна редагувати
  }
  
  return (
    <div className="space-y-3">
      {/* Панель дій */}
      <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
        <Package className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium text-amber-800">Дозамовлення</span>
        <div className="flex-1" />
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddModal(true)}
          disabled={loading}
          className="gap-1"
        >
          <Plus className="h-3 w-3" />
          Додати товар
        </Button>
        
        {modifications.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowHistoryModal(true)}
            className="gap-1"
          >
            <History className="h-3 w-3" />
            Історія ({modifications.length})
          </Button>
        )}
      </div>
      
      {/* Відмовлені позиції */}
      {refusedItems.length > 0 && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowRefused(!showRefused)}
            className="w-full flex items-center gap-2 p-2 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-700">
              Відмовлені позиції ({refusedItems.length})
            </span>
            <div className="flex-1" />
            {showRefused ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          {showRefused && (
            <div className="p-2 space-y-2">
              {refusedItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 p-2 bg-red-50/50 rounded">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.product_name}</div>
                    <div className="text-xs text-gray-500">
                      {item.original_quantity || item.quantity} шт • {item.refusal_reason || 'Відмова клієнта'}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRestoreItem(item.id, item.product_name)}
                    disabled={loading}
                    className="gap-1 text-green-600 hover:text-green-700"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Відновити
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Модалка додавання товару */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Додати товар до замовлення</DialogTitle>
            <DialogDescription>
              Пошук та додавання товарів до поточного замовлення
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Пошук за назвою або SKU..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  searchProducts(e.target.value)
                }}
                className="pl-10"
              />
            </div>
            
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {searching && (
                <div className="text-center text-gray-500 py-4">Пошук...</div>
              )}
              
              {!searching && searchResults.length === 0 && searchQuery.length >= 2 && (
                <div className="text-center text-gray-500 py-4">Товари не знайдено</div>
              )}
              
              {searchResults.map(product => {
                const qty = selectedQuantities[product.product_id] || 1
                const available = product.quantity || 0
                
                return (
                  <div
                    key={product.product_id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50"
                  >
                    {product.image_url ? (
                      <img 
                        src={getImageUrl(product.image_url)} 
                        alt={product.name}
                        className="w-14 h-14 object-cover rounded"
                        onError={handleImageError}
                      />
                    ) : (
                      <div className="w-14 h-14 bg-gray-100 rounded flex items-center justify-center">
                        <Package className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <div className="font-medium text-sm">{product.name}</div>
                      <div className="text-xs text-gray-500">
                        {product.sku} • <span className={available > 0 ? 'text-green-600' : 'text-red-500'}>{available} шт на складі</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {product.rental_price || 0} ₴/день • Застава: {product.price || 0} ₴
                      </div>
                    </div>
                    
                    {/* Вибір кількості */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedQuantities(prev => ({
                            ...prev,
                            [product.product_id]: Math.max(1, qty - 1)
                          }))
                        }}
                        disabled={qty <= 1}
                        className="h-8 w-8 p-0"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      
                      <span className="w-8 text-center font-medium">{qty}</span>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedQuantities(prev => ({
                            ...prev,
                            [product.product_id]: Math.min(available, qty + 1)
                          }))
                        }}
                        disabled={qty >= available}
                        className="h-8 w-8 p-0"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {/* Кнопка додати */}
                    <Button
                      size="sm"
                      onClick={() => handleAddItem(product)}
                      disabled={loading || available === 0}
                      className="gap-1 bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="h-3 w-3" />
                      Додати
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddModal(false)
              setSelectedQuantities({})
            }}>
              Закрити
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Модалка історії змін */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Історія змін замовлення</DialogTitle>
            <DialogDescription>
              Перелік всіх змін позицій замовлення
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {modifications.map(mod => (
              <div 
                key={mod.id} 
                className={`p-3 rounded-lg border ${
                  mod.modification_type === 'add' ? 'bg-green-50 border-green-200' :
                  mod.modification_type === 'update' ? 'bg-amber-50 border-amber-200' :
                  'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {mod.modification_type === 'add' && <Plus className="h-4 w-4 text-green-600" />}
                  {mod.modification_type === 'update' && <Package className="h-4 w-4 text-amber-600" />}
                  {mod.modification_type === 'remove' && <X className="h-4 w-4 text-red-600" />}
                  <span className="font-medium text-sm">{mod.product_name}</span>
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  {mod.modification_type === 'add' && `Додано: ${mod.new_quantity} шт`}
                  {mod.modification_type === 'update' && `${mod.old_quantity} → ${mod.new_quantity} шт`}
                  {mod.modification_type === 'remove' && `Відмова: ${mod.old_quantity} шт`}
                </div>
                <div className="mt-1 text-xs text-gray-500 flex justify-between">
                  <span>{mod.reason}</span>
                  <span>{mod.created_by} • {mod.created_at}</span>
                </div>
                <div className="mt-1 text-xs">
                  <span className={mod.price_change > 0 ? 'text-green-600' : mod.price_change < 0 ? 'text-red-600' : ''}>
                    Оренда: {mod.price_change > 0 ? '+' : ''}{mod.price_change?.toFixed(2)} ₴
                  </span>
                  <span className="mx-2">|</span>
                  <span className={mod.deposit_change > 0 ? 'text-green-600' : mod.deposit_change < 0 ? 'text-red-600' : ''}>
                    Застава: {mod.deposit_change > 0 ? '+' : ''}{mod.deposit_change?.toFixed(2)} ₴
                  </span>
                </div>
              </div>
            ))}
            
            {modifications.length === 0 && (
              <div className="text-center text-gray-500 py-8">Змін немає</div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryModal(false)}>
              Закрити
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Компонент для кнопок редагування в списку товарів
export function ItemModificationControls({ item, orderId, orderStatus, onUpdate }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [localQty, setLocalQty] = useState(item.qty || 0)
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef(null)
  
  const allowedStatuses = ['processing', 'ready_for_issue', 'preparation', 'ready']
  const canModify = allowedStatuses.includes(orderStatus)
  
  // Синхронізація з зовнішнім значенням
  useEffect(() => {
    if (!isEditing) {
      setLocalQty(item.qty || 0)
    }
  }, [item.qty, isEditing])
  
  if (!canModify) return null
  
  // API виклик для збереження
  const saveQuantity = async (newQty) => {
    if (newQty < 0 || newQty === item.qty) return
    
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.patch(
        `${BACKEND_URL}/api/orders/${orderId}/items/${item.id}`,
        {
          quantity: newQty,
          note: `Зміна кількості: ${item.qty} → ${newQty}`
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      toast({
        title: '✅ Кількість оновлено',
        description: `${item.qty} → ${newQty}`
      })
      
      if (onUpdate) onUpdate(res.data.totals)
      
    } catch (err) {
      toast({
        title: '❌ Помилка',
        description: err.response?.data?.detail || 'Не вдалося оновити',
        variant: 'destructive'
      })
      // Повернути попереднє значення
      setLocalQty(item.qty || 0)
    } finally {
      setLoading(false)
    }
  }
  
  // Debounced save - зберігати через 800ms після останньої зміни
  const debouncedSave = useDebounce(saveQuantity, 800)
  
  // Кнопки +/-
  const handleButtonClick = (delta) => {
    const newQty = Math.max(0, localQty + delta)
    setLocalQty(newQty)
    debouncedSave(newQty)
  }
  
  // Ручний ввід
  const handleInputChange = (e) => {
    const value = e.target.value
    if (/^\d*$/.test(value)) {
      const numValue = value === '' ? 0 : parseInt(value)
      setLocalQty(numValue)
      if (value !== '') {
        debouncedSave(numValue)
      }
    }
  }
  
  const handleFocus = () => {
    setIsEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }
  
  const handleBlur = () => {
    setIsEditing(false)
    const numValue = Math.max(0, parseInt(localQty) || 0)
    setLocalQty(numValue)
    if (numValue !== item.qty) {
      saveQuantity(numValue)
    }
  }
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') inputRef.current?.blur()
    if (e.key === 'Escape') {
      setLocalQty(item.qty || 0)
      inputRef.current?.blur()
    }
  }
  
  const handleRemove = async () => {
    if (!confirm(`Відмовити "${item.name}"?`)) return
    
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.delete(
        `${BACKEND_URL}/api/orders/${orderId}/items/${item.id}`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          data: { reason: 'Відмова клієнта' }
        }
      )
      
      toast({
        title: '🚫 Позицію відмовлено',
        description: item.name
      })
      
      if (onUpdate) onUpdate(res.data.totals)
      
    } catch (err) {
      toast({
        title: '❌ Помилка',
        description: err.response?.data?.detail || 'Не вдалося відмовити',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleButtonClick(-1)}
        disabled={loading || localQty <= 0}
        className="h-6 w-6 p-0"
      >
        <Minus className="h-3 w-3" />
      </Button>
      
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={localQty}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={loading}
        className="w-10 h-6 text-center text-sm font-medium border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleButtonClick(1)}
        disabled={loading}
        className="h-6 w-6 p-0"
      >
        <Plus className="h-3 w-3" />
      </Button>
      
      <Button
        size="sm"
        variant="ghost"
        onClick={handleRemove}
        disabled={loading}
        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 ml-2"
        title="Відмовити позицію"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}
