/* eslint-disable */
/**
 * New Order View Workspace - Редагування замовлення "Очікує підтвердження"
 * Використовує уніфіковану систему Order Workspace
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../hooks/use-toast'
import { useOrderWebSocket, useOrderSectionUpdate } from '../hooks/useOrderWebSocket'
import axios from 'axios'

import {
  OrderWorkspaceLayout,
  LeftRailClient,
  LeftRailFinance,
  LeftRailDocuments,
  LeftRailTimeline,
  InternalNotesChat,
  getStatusKey,
} from '../components/order-workspace'

import {
  ZoneClientForm,
  ZonePlanDates,
  ZoneAvailabilityGate,
  ZoneItemSearch,
  ZoneItemsList,
  ZoneNotes,
  ZoneDocuments,
  ZoneEventInfo,
} from '../components/order-workspace/zones'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

export default function NewOrderViewWorkspace() {
  const { id: orderId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  
  // === СТАН ЗАМОВЛЕННЯ ===
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [decorOrderStatus, setDecorOrderStatus] = useState(null)
  const [customerStats, setCustomerStats] = useState(null)
  
  // Клієнт
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientType, setClientType] = useState('retail')
  const [managerId, setManagerId] = useState(null)
  const [managerName, setManagerName] = useState('')
  const [discount, setDiscount] = useState(0)
  
  // Дати
  const [issueDate, setIssueDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [issueTime, setIssueTime] = useState('11:30–12:00')
  const [returnTime, setReturnTime] = useState('до 17:00')
  const [rentalDays, setRentalDays] = useState(1)
  
  // Позиції
  const [items, setItems] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  
  // Конфлікти
  const [conflicts, setConflicts] = useState([])
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  
  // Нотатки
  const [managerNotes, setManagerNotes] = useState('')  // Внутрішні нотатки менеджера
  const [clientComment, setClientComment] = useState('') // Коментар клієнта (read-only)
  
  // Email
  const [sendingEmail, setSendingEmail] = useState(false)
  
  // Стан збереження
  const [saving, setSaving] = useState(false)
  
  // Таймлайн
  const [timeline, setTimeline] = useState([])
  
  // === REAL-TIME SYNC STATE ===
  const [issueCardId, setIssueCardId] = useState(null)
  const [assemblyProgress, setAssemblyProgress] = useState({ picked: 0, total: 0, percent: 0 })
  const [newlyAddedItems, setNewlyAddedItems] = useState(new Set()) // IDs of recently added items
  
  // Callback для перезавантаження
  const loadOrderCallback = useCallback(() => loadOrder(), [orderId])
  
  // WebSocket синхронізація
  const {
    connected: wsConnected,
    activeUsers,
    pendingUpdates,
    hasUpdates: wsHasUpdates,
    dismissAllUpdates,
  } = useOrderWebSocket(orderId, {
    enabled: !loading && !!orderId,
    onSectionUpdate: (data) => {
      // Якщо оновлено прогрес - перезавантажити дані прогресу
      if (data.section === 'progress') {
        loadAssemblyProgress()
      }
      toast({
        title: '🔄 Оновлення від складу',
        description: `${data.updated_by_name} оновив прогрес комплектації`,
      })
    },
    onUserJoined: (data) => {
      toast({
        title: '👋',
        description: `${data.user_name} відкрив це замовлення`,
        duration: 2000,
      })
    },
  })
  
  // Хук для оновлення секцій
  const { updateSection } = useOrderSectionUpdate()
  
  // Завантаження прогресу комплектації
  const loadAssemblyProgress = async () => {
    if (!issueCardId) return
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/issue-cards/${issueCardId}`)
      const card = response.data
      
      if (card?.items) {
        const total = card.items.reduce((sum, i) => sum + (i.qty || 1), 0)
        const picked = card.items.reduce((sum, i) => sum + (i.picked_qty || 0), 0)
        const percent = total > 0 ? Math.round((picked / total) * 100) : 0
        
        setAssemblyProgress({ picked, total, percent })
      }
    } catch (e) {
      console.log('[Progress] Could not load assembly progress:', e.message)
    }
  }
  
  // Завантажити прогрес коли є issue card
  useEffect(() => {
    if (issueCardId) {
      loadAssemblyProgress()
      // Оновлювати кожні 30 секунд як fallback
      const interval = setInterval(loadAssemblyProgress, 30000)
      return () => clearInterval(interval)
    }
  }, [issueCardId])
  
  // === ЗАВАНТАЖЕННЯ ЗАМОВЛЕННЯ ===
  useEffect(() => {
    if (!orderId) return
    loadOrder()
  }, [orderId])
  
  const loadOrder = async () => {
    try {
      setLoading(true)
      
      // Спочатку перевірити чи замовлення в decor_orders
      const decorResponse = await axios.get(`${BACKEND_URL}/api/decor-orders/${orderId}`).catch(() => null)
      
      if (decorResponse?.data) {
        // Замовлення вже прийнято
        const decorOrder = decorResponse.data
        console.log('[Workspace] ✅ Завантажено з DecorOrder')
        
        setOrder(decorOrder)
        setClientName(decorOrder.client_name || '')
        setClientPhone(decorOrder.client_phone || '')
        setClientEmail(decorOrder.client_email || '')
        setDiscount(decorOrder.discount || 0)
        setManagerId(decorOrder.manager_id || null)
        setManagerName(decorOrder.manager_name || '')
        
        const issueDateVal = decorOrder.issue_date || decorOrder.rent_date || ''
        const returnDateVal = decorOrder.return_date || decorOrder.rent_return_date || ''
        setIssueDate(issueDateVal)
        setReturnDate(returnDateVal)
        setIssueTime(decorOrder.issue_time || '11:30–12:00')
        setReturnTime(decorOrder.return_time || 'до 17:00')
        setRentalDays(decorOrder.rental_days || 1)
        
        setItems(decorOrder.items || [])
        setManagerNotes(decorOrder.manager_notes || decorOrder.manager_comment || '')
        setClientComment(decorOrder.client_comment || '')
        setDecorOrderStatus(decorOrder.status)
        
        // Встановити issue card ID для завантаження прогресу
        if (decorOrder.issue_card_id) {
          setIssueCardId(decorOrder.issue_card_id)
        }
        
        // Таймлайн
        setTimeline([
          { text: 'Замовлення прийнято', at: formatDateTime(decorOrder.created_at), tone: 'green', user: 'Система' },
          ...(decorOrder.status === 'processing' ? [{ text: 'В обробці', at: 'Зараз', tone: 'blue' }] : [])
        ])
        
      } else {
        // Замовлення ще не прийнято - з OpenCart
        const ocResponse = await axios.get(`${BACKEND_URL}/api/orders/${orderId}`)
        const data = ocResponse.data
        console.log('[Workspace] ✅ Завантажено з OpenCart (нове)')
        
        setOrder(data)
        setClientName(data.client_name || data.customer_name || '')
        setClientPhone(data.client_phone || data.phone || '')
        setClientEmail(data.client_email || data.email || '')
        
        setIssueDate(data.issue_date || '')
        setReturnDate(data.return_date || '')
        setRentalDays(1)
        
        setItems(data.items || [])
        setManagerNotes(data.manager_comment || '')
        setClientComment(data.customer_notes || data.comment || '')
        
        // Таймлайн
        setTimeline([
          { text: 'Замовлення створено', at: formatDateTime(data.date_added), tone: 'blue', user: 'Клієнт' }
        ])
        
        // Завантажити статистику клієнта
        if (data.client_id) {
          try {
            const statsResponse = await axios.get(`${BACKEND_URL}/api/orders/customer/${data.client_id}/stats`)
            setCustomerStats(statsResponse.data)
          } catch (e) {}
        }
      }
      
    } catch (err) {
      console.error('[Workspace] ❌ Error loading order:', err)
      toast({
        title: '❌ Помилка',
        description: 'Не вдалося завантажити замовлення',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }
  
  // === ПЕРЕВІРКА КОНФЛІКТІВ ===
  useEffect(() => {
    if (!issueDate || !returnDate || items.length === 0) {
      setConflicts([])
      return
    }
    checkAvailability()
  }, [issueDate, returnDate, items])
  
  const checkAvailability = async () => {
    setCheckingConflicts(true)
    try {
      const inventoryIds = items.map(i => i.inventory_id).filter(Boolean)
      if (inventoryIds.length === 0) {
        setConflicts([])
        setCheckingConflicts(false)
        return
      }
      
      // Backend очікує POST з body
      // ✅ FIXED: Передаємо exclude_order_id щоб не враховувати товари з ЦЬОГО замовлення
      const response = await axios.post(`${BACKEND_URL}/api/orders/check-availability`, {
        start_date: issueDate,
        end_date: returnDate,
        exclude_order_id: orderId ? parseInt(orderId) : null,  // ✅ Виключити поточне замовлення
        items: items.map(item => ({
          product_id: item.inventory_id,
          quantity: item.quantity || item.qty || 1
        }))
      })
      
      if (response.data?.items) {
        const foundConflicts = response.data.items
          .map(item => {
            let conflictType = null
            let level = 'warning'
            
            if (item.available_quantity === 0) {
              conflictType = 'out_of_stock'
              level = 'error'
            } else if (item.available_quantity < item.requested_quantity) {
              conflictType = 'insufficient'
              level = 'error'
            } else if (item.has_partial_return_risk) {
              // ⚠️ НОВЕ: Товар у частковому поверненні - ще не повернувся
              conflictType = 'partial_return_risk'
              level = 'warning'
            } else if (item.has_tight_schedule) {
              conflictType = 'tight_schedule'
              level = 'warning'
            } else if (item.available_quantity < item.total_quantity * 0.2) {
              conflictType = 'low_stock'
              level = 'warning'
            }
            
            if (conflictType) {
              return {
                sku: item.sku || item.article || item.product_id,
                name: item.product_name || item.name,
                type: conflictType,
                level,
                available: item.available_quantity,
                requested: item.requested_quantity,
                // ✅ Додаємо детальну інформацію про конфліктуючі замовлення
                nearbyOrders: item.nearby_orders || [],
                // ⚠️ НОВЕ: Інформація про часткові повернення
                partialReturnWarnings: item.partial_return_warnings || [],
                partialReturnQty: item.partial_return_qty || 0
              }
            }
            return null
          })
          .filter(Boolean)
        
        setConflicts(foundConflicts)
      } else {
        setConflicts([])
      }
    } catch (error) {
      console.error('Error checking availability:', error)
      // Не блокуємо роботу якщо перевірка не вдалась
      setConflicts([])
    } finally {
      setCheckingConflicts(false)
    }
  }
  
  // === РОЗРАХУНКИ ===
  const calculations = useMemo(() => {
    const days = rentalDays || 1
    
    const totalRent = items.reduce((sum, item) => {
      const price = parseFloat(item.price_per_day || item.price) || 0
      const qty = parseInt(item.quantity || item.qty) || 1
      return sum + (price * qty * days)
    }, 0)
    
    const totalDeposit = items.reduce((sum, item) => {
      const deposit = parseFloat(item.deposit || item.damage_cost) || 0
      const qty = parseInt(item.quantity || item.qty) || 1
      return sum + (deposit * qty)
    }, 0)
    
    const discountAmount = (totalRent * discount) / 100
    const rentAfterDiscount = totalRent - discountAmount
    
    return {
      totalRent,
      totalDeposit,
      discountAmount,
      rentAfterDiscount,
      itemsCount: items.length
    }
  }, [items, rentalDays, discount])
  
  // === ПОШУК ТОВАРІВ ===
  const handleSearch = async (query) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    
    setIsSearching(true)
    try {
      const response = await axios.get(`${BACKEND_URL}/api/orders/inventory/search`, {
        params: { query, limit: 20 }
      })
      
      const results = (response.data.products || []).map(p => ({
        product_id: p.product_id,
        sku: p.sku,
        name: p.name,
        price_per_day: p.rent_price || 0,  // Ціна оренди за день
        deposit: p.price || 0,  // Застава = повна вартість товару
        total_quantity: p.available_quantity || 0
      }))
      
      setSearchResults(results)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }
  
  // === УПРАВЛІННЯ ПОЗИЦІЯМИ ===
  const handleAddItem = async (product) => {
    const existing = items.find(i => i.inventory_id === product.product_id?.toString())
    
    let updatedItems
    const itemId = product.product_id?.toString()
    
    if (existing) {
      updatedItems = items.map(i => 
        i.inventory_id === itemId
          ? { ...i, quantity: (i.quantity || 1) + 1 }
          : i
      )
    } else {
      // Нова позиція - додаємо на початок списку і позначаємо як нову
      const newItem = {
        inventory_id: itemId,
        article: product.sku,
        name: product.name,
        quantity: 1,
        price_per_day: product.price_per_day,
        deposit: product.deposit || 0,
        damage_cost: product.deposit || 0,
        _isNew: true  // Позначка для підсвітки
      }
      updatedItems = [newItem, ...items]  // Додаємо ЗВЕРХУ
      
      // Позначити як нову на 30 секунд
      setNewlyAddedItems(prev => new Set([...prev, itemId]))
      setTimeout(() => {
        setNewlyAddedItems(prev => {
          const next = new Set(prev)
          next.delete(itemId)
          return next
        })
      }, 30000)
    }
    
    setItems(updatedItems)
    setSearchResults([])
    await saveItems(updatedItems)
    
    // Повідомити інших користувачів про зміни
    if (orderId) {
      await updateSection(orderId, 'items', {
        changesSummary: `Додано: ${product.name}`,
        changedFields: ['items']
      })
    }
  }
  
  const handleUpdateQuantity = async (itemId, newQty) => {
    if (newQty < 1) return
    
    const updatedItems = items.map(i => {
      if (i.inventory_id === itemId || i.id === itemId) {
        return { ...i, quantity: newQty }
      }
      return i
    })
    
    setItems(updatedItems)
    await saveItems(updatedItems)
  }
  
  const handleRemoveItem = async (itemId) => {
    const updatedItems = items.filter(i => i.inventory_id !== itemId && i.id !== itemId)
    setItems(updatedItems)
    await saveItems(updatedItems)
  }
  
  // === ЗБЕРЕЖЕННЯ ===
  const saveItems = async (itemsToSave) => {
    try {
      const response = await axios.put(`${BACKEND_URL}/api/decor-orders/${orderId}/items`, {
        items: itemsToSave
      })
      
      if (response.data) {
        // Оновити з сервера
        const freshResponse = await axios.get(`${BACKEND_URL}/api/decor-orders/${orderId}`)
        if (freshResponse.data.items) {
          setItems(freshResponse.data.items)
        }
      }
      return true
    } catch (error) {
      console.error('Error saving items:', error)
      return false
    }
  }
  
  const handleSave = async () => {
    setSaving(true)
    try {
      const endpoint = decorOrderStatus 
        ? `${BACKEND_URL}/api/decor-orders/${orderId}`
        : `${BACKEND_URL}/api/orders/${orderId}`
      
      // Відправляємо ВСІ дані включаючи фінанси
      await axios.put(endpoint, {
        rental_start_date: issueDate,
        rental_end_date: returnDate,
        issue_time: issueTime,
        return_time: returnTime,
        rental_days: rentalDays,
        manager_comment: managerNotes,
        discount: discount, // ✅ FIXED: Відсоток знижки (%)
        discount_amount: calculations.discountAmount, // Сума знижки в грн
        manager_id: managerId,
        // Фінансові дані - ДЖЕРЕЛО ПРАВДИ
        total_price: calculations.rentAfterDiscount,
        deposit_amount: calculations.totalDeposit,
        total_loss_value: calculations.totalDeposit
      })
      
      toast({
        title: '✅ Збережено',
        description: 'Зміни успішно збережено',
      })
    } catch (error) {
      console.error('Error saving:', error)
      toast({
        title: '❌ Помилка',
        description: 'Не вдалося зберегти',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }
  
  // === ВІДПРАВИТИ EMAIL КЛІЄНТУ ===
  const handleSendEmail = async () => {
    if (!clientEmail) {
      toast({
        title: '⚠️ Увага',
        description: 'У клієнта немає email',
        variant: 'destructive',
      })
      return
    }
    
    setSendingEmail(true)
    try {
      await axios.post(`${BACKEND_URL}/api/orders/${orderId}/send-confirmation-email`, {
        email: clientEmail,
        client_name: clientName,
        order_number: order?.order_number || orderId,
        issue_date: issueDate,
        return_date: returnDate,
        issue_time: issueTime,
        return_time: returnTime,
        items: items,
        total_rent: calculations.rentAfterDiscount,
        total_deposit: calculations.totalDeposit,
        manager_notes: managerNotes
      })
      
      toast({
        title: '✉️ Відправлено',
        description: `Email відправлено на ${clientEmail}`,
      })
      
      // Додати в таймлайн
      setTimeline(prev => [...prev, {
        text: 'Відправлено email клієнту',
        at: new Date().toLocaleString('uk-UA'),
        tone: 'green',
        user: managerName || 'Менеджер'
      }])
    } catch (error) {
      console.error('Error sending email:', error)
      toast({
        title: '❌ Помилка',
        description: 'Не вдалося відправити email',
        variant: 'destructive',
      })
    } finally {
      setSendingEmail(false)
    }
  }
  
  // === ВІДПРАВИТИ НА ЗБІР ===
  const handleSendToAssembly = async () => {
    // Валідація
    if (!issueDate || !returnDate) {
      toast({
        title: '⚠️ Увага',
        description: 'Вкажіть дати видачі та повернення',
        variant: 'destructive',
      })
      return
    }
    
    if (items.length === 0) {
      toast({
        title: '⚠️ Увага',
        description: 'Додайте хоча б одну позицію',
        variant: 'destructive',
      })
      return
    }
    
    const hasErrors = conflicts.some(c => c.level === 'error')
    if (hasErrors) {
      toast({
        title: '⚠️ Увага',
        description: 'Є критичні конфлікти доступності. Виправте їх перед відправкою на збір.',
        variant: 'destructive',
      })
      return
    }
    
    setSaving(true)
    try {
      // Спочатку зберігаємо всі зміни
      await axios.put(`${BACKEND_URL}/api/decor-orders/${orderId}`, {
        rental_start_date: issueDate,
        rental_end_date: returnDate,
        issue_time: issueTime,
        return_time: returnTime,
        rental_days: rentalDays,
        manager_comment: managerNotes,
        discount: discount,
        manager_id: managerId
      })
      
      // Заморожуємо декор на ці дати та відправляємо на збір
      await axios.post(`${BACKEND_URL}/api/decor-orders/${orderId}/send-to-assembly`, {
        items: items.map(item => ({
          inventory_id: item.inventory_id,
          name: item.name,
          article: item.article,
          quantity: item.quantity || 1,
          price_per_day: item.price_per_day || 0,
          deposit: item.deposit || item.damage_cost || 0
        }))
      })
      
      toast({
        title: '📦 Відправлено на збір',
        description: 'Замовлення передано реквізиторам. Декор заморожено на вказані дати.',
      })
      
      setTimeout(() => navigate('/'), 1500)
    } catch (error) {
      console.error('Error sending to assembly:', error)
      toast({
        title: '❌ Помилка',
        description: error.response?.data?.detail || 'Не вдалося відправити на збір',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }
  
  // === ПРИЙНЯТИ ЗАМОВЛЕННЯ ===
  const handleAcceptOrder = async () => {
    // Валідація
    if (!issueDate || !returnDate) {
      toast({
        title: '⚠️ Увага',
        description: 'Вкажіть дати видачі та повернення',
        variant: 'destructive',
      })
      return
    }
    
    if (items.length === 0) {
      toast({
        title: '⚠️ Увага',
        description: 'Додайте хоча б одну позицію',
        variant: 'destructive',
      })
      return
    }
    
    const hasErrors = conflicts.some(c => c.level === 'error')
    if (hasErrors) {
      toast({
        title: '⚠️ Увага',
        description: 'Є критичні конфлікти доступності',
        variant: 'destructive',
      })
      return
    }
    
    setSaving(true)
    try {
      await axios.post(`${BACKEND_URL}/api/orders/${orderId}/accept`, {
        rental_start_date: issueDate,
        rental_end_date: returnDate,
        issue_time: issueTime,
        return_time: returnTime,
        rental_days: rentalDays,
        manager_comment: managerNotes,
        discount: discount,
        manager_id: managerId,
        items: items.map(item => ({
          inventory_id: item.inventory_id,
          name: item.name,
          article: item.article,
          quantity: item.quantity || 1,
          price_per_day: item.price_per_day || 0,
          deposit: item.deposit || item.damage_cost || 0
        }))
      })
      
      toast({
        title: '✅ Прийнято',
        description: 'Замовлення прийнято в роботу',
      })
      
      setTimeout(() => navigate('/'), 1500)
    } catch (error) {
      console.error('Error accepting:', error)
      toast({
        title: '❌ Помилка',
        description: error.response?.data?.detail || 'Не вдалося прийняти замовлення',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }
  
  // === HELPERS ===
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    return date.toLocaleString('uk-UA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // Статус для layout
  const workspaceStatus = decorOrderStatus 
    ? getStatusKey(decorOrderStatus) 
    : 'WAITING_CONFIRMATION'
  
  // Визначення чи можна прийняти
  const canAccept = issueDate && returnDate && items.length > 0 && !conflicts.some(c => c.level === 'error')
  
  // Визначення клієнтського тиру
  const clientTier = customerStats?.total_orders > 10 ? 'vip' 
    : customerStats?.total_orders > 3 ? 'regular' 
    : 'new'
  
  // === РЕНДЕР ===
  return (
    <OrderWorkspaceLayout
      orderId={orderId}
      orderNumber={order?.order_number || orderId}
      status={workspaceStatus}
      issueDate={issueDate}
      returnDate={returnDate}
      createdAt={order?.date_added}
      backUrl="/manager"
      loading={loading}
      
      // Real-time sync
      activeUsers={activeUsers}
      hasUpdates={wsHasUpdates}
      onRefresh={async () => {
        await loadOrder()
        await loadAssemblyProgress()
        dismissAllUpdates()
      }}
      
      // Progress info (для відображення в хедері)
      progressInfo={assemblyProgress.total > 0 ? {
        label: `Комплектація: ${assemblyProgress.picked}/${assemblyProgress.total} (${assemblyProgress.percent}%)`,
        value: assemblyProgress.picked,
        percent: assemblyProgress.percent
      } : null}
      
      // Left Rail
      leftRail={
        <>
          <LeftRailClient
            name={clientName || 'Клієнт'}
            phone={clientPhone}
            email={clientEmail}
            tier={clientTier}
            orderCount={customerStats?.total_orders}
          />
          {/* Event Info для IT- замовлень */}
          <ZoneEventInfo order={order} />
          <LeftRailFinance
            orderId={orderId}
            rentAmount={calculations.rentAfterDiscount}
            depositAmount={calculations.totalDeposit}
            discountPercent={order?.discount_percent}
            discountAmount={calculations.totalDiscount}
            rentBeforeDiscount={calculations.totalRent}
            serviceFee={order?.service_fee || 0}
            serviceFeeName={order?.service_fee_name || ""}
            onServiceFeeChange={async (fee, feeName) => {
              try {
                const token = localStorage.getItem('token')
                await fetch(`${BACKEND_URL}/api/orders/${orderId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ service_fee: fee, service_fee_name: feeName })
                })
                // Оновити локальний стан
                setOrder(prev => ({ ...prev, service_fee: fee, service_fee_name: feeName }))
              } catch (err) {
                console.error('Failed to update service fee:', err)
              }
            }}
            isEditable={true}
          />
          <LeftRailDocuments
            orderId={orderId}
            orderNumber={order?.order_number}
            orderStatus={decorOrderStatus ? 'confirmed' : 'awaiting_confirmation'}
            customerEmail={clientEmail}
          />
          <LeftRailTimeline orderId={orderId} events={timeline} />
        </>
      }
      
      // Footer
      onPrimaryAction={decorOrderStatus ? handleSendToAssembly : handleAcceptOrder}
      primaryLabel={decorOrderStatus ? '📦 Відправити на збір' : 'Підтвердити та прийняти'}
      primaryDisabled={saving || !canAccept}
      primaryDisabledReason={!canAccept ? 'Заповніть дати та позиції' : ''}
      onSave={handleSave}
      saving={saving}
      footerActions={[
        { 
          label: sendingEmail ? '⏳...' : '✉️ Email клієнту', 
          onClick: handleSendEmail,
          disabled: sendingEmail || !clientEmail
        },
        { 
          label: '🚫 Відхилити', 
          onClick: () => navigate('/'), 
          variant: 'danger' 
        }
      ]}
    >
      {/* === WORKSPACE ZONES === */}
      
      {/* Клієнт */}
      <ZoneClientForm
        clientName={clientName}
        clientPhone={clientPhone}
        clientEmail={clientEmail}
        clientType={clientType}
        managerId={managerId}
        managerName={managerName}
        discount={discount}
        onUpdate={(data) => {
          setClientName(data.name)
          setClientPhone(data.phone)
          setClientEmail(data.email)
          setClientType(data.type)
          setManagerId(data.managerId)
          setManagerName(data.managerName)
          setDiscount(data.discount)
        }}
        readOnly={!!decorOrderStatus && decorOrderStatus !== 'awaiting_customer'}
      />
      
      {/* Дати */}
      <ZonePlanDates
        issueDate={issueDate}
        returnDate={returnDate}
        issueTime={issueTime}
        returnTime={returnTime}
        rentalDays={rentalDays}
        onUpdate={(dates) => {
          setIssueDate(dates.issueDate)
          setReturnDate(dates.returnDate)
          setIssueTime(dates.issueTime)
          setReturnTime(dates.returnTime)
          setRentalDays(dates.rentalDays)
        }}
      />
      
      {/* Доступність */}
      <ZoneAvailabilityGate
        conflicts={conflicts}
        isChecking={checkingConflicts}
        hasItems={items.length > 0}
        hasDates={!!issueDate && !!returnDate}
        onCheckConflicts={checkAvailability}
      />
      
      {/* Пошук товарів */}
      <ZoneItemSearch
        onSearch={handleSearch}
        onAddItem={handleAddItem}
        searchResults={searchResults}
        isSearching={isSearching}
      />
      
      {/* Позиції */}
      <ZoneItemsList
        items={items}
        rentalDays={rentalDays}
        mode="edit"
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        highlightedItems={newlyAddedItems}  // Підсвітка нових позицій
      />
      
      {/* Документи переміщено в LeftRailDocuments */}
      
      {/* Внутрішній чат команди + коментар клієнта */}
      <InternalNotesChat
        orderId={orderId}
        clientComment={clientComment}
        readOnly={decorOrderStatus === 'completed' || decorOrderStatus === 'cancelled'}
      />
    </OrderWorkspaceLayout>
  )
}
