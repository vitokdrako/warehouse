/* eslint-disable */
/**
 * Return Order Workspace - Приймання повернення
 * Використовує уніфіковану систему Order Workspace
 * ✅ Підтримує часткове повернення
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../hooks/use-toast'
import { useOrderSync } from '../hooks/useAutoRefresh'
import { useOrderWebSocket, useOrderSectionUpdate } from '../hooks/useOrderWebSocket'
import axios from 'axios'

import {
  OrderWorkspaceLayout,
  LeftRailClient,
  LeftRailFinance,
  LeftRailDocuments,
  LeftRailTimeline,
  InternalNotesChat,
} from '../components/order-workspace'

import {
  ZoneItemsReturn,
  ZoneReturnFees,
  ZoneRequisitors,
} from '../components/order-workspace/zones'
// FinanceStatusCard тепер тільки в LeftRailFinance

import DamageModal from '../components/DamageModal'
import PartialReturnModal from '../components/modals/PartialReturnModal'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

const todayISO = () => new Date().toISOString().slice(0, 10)
const nowISO = () => new Date().toISOString().slice(0, 19)

export default function ReturnOrderWorkspace() {
  const { id: orderId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  
  // === СТАН ===
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  
  // Клієнт
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  
  // Дати
  const [issueDate, setIssueDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  
  // Фінанси
  const [totalRent, setTotalRent] = useState(0)
  const [totalDeposit, setTotalDeposit] = useState(0)
  
  // Штрафи
  const [lateFee, setLateFee] = useState(0)
  const [cleaningFee, setCleaningFee] = useState(0)
  const [damageFee, setDamageFee] = useState(0)
  
  // Нотатки та таймлайн
  const [notes, setNotes] = useState('')
  const [timeline, setTimeline] = useState([])
  
  // Модалка пошкоджень
  const [damageModal, setDamageModal] = useState({ open: false, itemId: null })
  
  // Модалка часткового повернення
  const [partialReturnModal, setPartialReturnModal] = useState({ open: false, items: [] })
  
  // Статус завершення приймання (для візуального блокування повернених товарів)
  const [isReturnCompleted, setIsReturnCompleted] = useState(false)
  
  // Приймальники (хто приймає повернення)
  const [selectedReceivers, setSelectedReceivers] = useState([])

  // === ЗАВАНТАЖЕННЯ ===
  const loadOrder = async () => {
    try {
      setLoading(true)
      
      let orderData
      try {
        const res = await axios.get(`${BACKEND_URL}/api/decor-orders/${orderId}`)
        orderData = res.data
      } catch {
        const res = await axios.get(`${BACKEND_URL}/api/orders/${orderId}`)
        orderData = res.data
      }
      
      setOrder(orderData)
      
      // Перевірити статус - якщо partial_return, то приймання вже завершено
      const orderStatus = orderData.status || ''
      const isAlreadyPartialReturn = orderStatus === 'partial_return'
      setIsReturnCompleted(isAlreadyPartialReturn)
      
      // Клієнт
      setClientName(orderData.client_name || orderData.customer_name || '')
      setClientPhone(orderData.client_phone || orderData.telephone || '')
      setClientEmail(orderData.client_email || orderData.email || '')
      
      // Дати
      setIssueDate(orderData.issue_date || orderData.rental_start_date || orderData.rent_date || '')
      setReturnDate(orderData.return_date || orderData.rental_end_date || orderData.rent_return_date || todayISO())
      
      // Фінанси
      setTotalRent(parseFloat(orderData.total_rental || orderData.total || 0))
      setTotalDeposit(parseFloat(orderData.deposit_held || orderData.total_deposit || 0))
      
      // Нотатки
      setNotes(orderData.manager_comment || orderData.notes || '')
      
      // Завантажити дані про продовження (які товари ще в оренді)
      let extensionsMap = {}
      if (isAlreadyPartialReturn) {
        try {
          const extRes = await axios.get(`${BACKEND_URL}/api/partial-returns/order/${orderId}/extensions`)
          const extensions = extRes.data?.extensions || []
          // Створити мапу product_id -> кількість в оренді
          extensions.filter(e => e.status === 'active').forEach(ext => {
            extensionsMap[ext.product_id] = (extensionsMap[ext.product_id] || 0) + ext.qty
          })
          console.log('[ReturnWorkspace] Active extensions:', extensionsMap)
        } catch (err) {
          console.warn('[ReturnWorkspace] Could not load extensions:', err)
        }
      }
      
      // Товари
      const transformedItems = (orderData.items || []).map((p, idx) => {
        const productId = p.product_id || p.inventory_id || p.id || idx
        const rentedQty = parseInt(p.quantity || p.qty) || 0
        
        // Якщо є активне продовження - товар ще в оренді (не повернуто)
        const inRentQty = extensionsMap[productId] || 0
        // Повернуто = орендовано - в оренді
        const returnedQty = isAlreadyPartialReturn ? Math.max(0, rentedQty - inRentQty) : 0
        
        const item = {
          id: p.id || p.order_product_id || p.inventory_id || idx,
          product_id: productId,
          sku: p.article || p.sku || p.model || '',
          name: p.name || p.product_name || '',
          image: p.image || p.photo || '',
          image_url: p.image || p.photo || p.image_url || '',
          rented_qty: rentedQty,
          returned_qty: returnedQty,
          serials: p.serials || [],
          ok_serials: [],
          findings: [],
          // Ціни для часткового повернення
          price: parseFloat(p.damage_cost || p.price || p.full_price || 0),
          rental_price: parseFloat(p.price_per_day || p.rental_price || p.daily_rate || 0),
          // Додаткова інформація для часткового повернення
          in_rent_qty: inRentQty,
          // ✅ Локація на складі
          location: p.location || { zone: p.zone || null },
          // ✅ Категорія для автовизначення в DamageModal
          category_name: p.category_name || p.category || '',
        }
        console.log(`[ReturnWorkspace] Item ${item.sku}: rented=${rentedQty}, returned=${returnedQty}, inRent=${inRentQty}`)
        return item
      })
      
      setItems(transformedItems)
      
      // === Завантажити історію пошкоджень для кожного товару ===
      // Це важливо, щоб приймальник бачив попередні дефекти
      const loadDamageHistory = async () => {
        const updatedItems = await Promise.all(transformedItems.map(async (item) => {
          try {
            const sku = item.sku
            if (!sku) return item
            
            const response = await axios.get(`${BACKEND_URL}/api/product-damage-history/by-sku?sku=${encodeURIComponent(sku)}`)
            const data = response.data
            
            if (data.history && data.history.length > 0) {
              return {
                ...item,
                damage_history: data.history,
                has_damage_history: true,
                total_damages: data.total_damages || data.history.length
              }
            }
          } catch (err) {
            console.warn(`[ReturnWorkspace] Could not load damage history for ${item.sku}:`, err.message)
          }
          return item
        }))
        
        setItems(updatedItems)
        console.log('[ReturnWorkspace] Damage history loaded for items')
      }
      
      // Завантажуємо історію асинхронно (не блокуємо UI)
      loadDamageHistory()
      
      // Таймлайн
      if (isAlreadyPartialReturn) {
        setTimeline([
          { text: 'Часткове повернення (є товари в оренді)', at: nowISO(), tone: 'amber' }
        ])
      } else {
        setTimeline([
          { text: 'Повернення розпочато', at: nowISO(), tone: 'blue' }
        ])
      }
      
    } catch (err) {
      console.error('[ReturnOrderWorkspace] Error loading:', err)
      toast({
        title: '❌ Помилка',
        description: 'Не вдалося завантажити замовлення',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Обгортаємо в useCallback для автооновлення
  const loadOrderCallback = useCallback(loadOrder, [orderId])

  // Автооновлення кожні 15 секунд
  // Синхронізація змін з іншими користувачами
  const { hasNewChanges, lastModifiedBy, markMyUpdate, dismissChanges } = useOrderSync(
    orderId,
    loadOrderCallback,
    10000,
    !loading && !!orderId
  )
  
  // WebSocket синхронізація (real-time)
  const {
    connected: wsConnected,
    activeUsers,
    pendingUpdates,
    hasUpdates: wsHasUpdates,
    dismissAllUpdates,
  } = useOrderWebSocket(orderId, {
    enabled: !loading && !!orderId,
    onSectionUpdate: (data) => {
      toast({
        title: '🔄 Зміни від іншого користувача',
        description: `${data.updated_by_name} оновив ${data.section}`,
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
  
  // Хук для повідомлення про збереження
  const { updateSection } = useOrderSectionUpdate()

  useEffect(() => {
    if (!orderId) return
    loadOrder()
  }, [orderId])

  // Показуємо toast коли хтось інший зберіг
  useEffect(() => {
    if (hasNewChanges && lastModifiedBy) {
      toast({
        title: '🔄 Дані оновлено',
        description: `${lastModifiedBy} зберіг зміни`,
      })
      dismissChanges()
    }
  }, [hasNewChanges, lastModifiedBy])

  // === ОБРОБНИКИ ===
  const handleSetReturnedQty = (itemId, qty) => {
    setItems(items => items.map(it => 
      it.id === itemId ? { ...it, returned_qty: qty } : it
    ))
  }
  
  const handleToggleSerial = (itemId, serial) => {
    setItems(items => items.map(it => {
      if (it.id !== itemId) return it
      const okSerials = it.ok_serials.includes(serial)
        ? it.ok_serials.filter(s => s !== serial)
        : [...it.ok_serials, serial]
      const returned_qty = Math.max(it.returned_qty, okSerials.length)
      return { ...it, ok_serials: okSerials, returned_qty }
    }))
  }
  
  const handleOpenDamage = (itemId) => {
    setDamageModal({ open: true, itemId })
  }
  
  const handleSaveDamage = (damageRecord) => {
    setItems(items => items.map(it => 
      it.id === damageModal.itemId 
        ? { ...it, findings: [...it.findings, damageRecord] } 
        : it
    ))
    setDamageFee(prev => prev + (Number(damageRecord.fee) || 0))
    setTimeline(prev => [
      { text: `Зафіксовано пошкодження: ${damageRecord.category} - ${damageRecord.kind}`, at: nowISO(), tone: 'amber' },
      ...prev
    ])
    setDamageModal({ open: false, itemId: null })
  }

  // === РОЗРАХУНКИ ===
  const totalFees = lateFee + cleaningFee + damageFee
  const allReturned = useMemo(() => items.every(it => it.returned_qty >= it.rented_qty), [items])
  const allSerialsOk = useMemo(() => items.every(it => 
    it.serials.length === 0 || it.ok_serials.length >= it.rented_qty
  ), [items])
  
  // Список неповернених товарів (для часткового повернення)
  const notReturnedItems = useMemo(() => {
    return items
      .filter(it => it.returned_qty < it.rented_qty)
      .map(it => {
        const notReturnedQty = it.rented_qty - it.returned_qty
        const fullPrice = it.price || 0  // damage_cost = повна вартість
        const dailyRate = it.rental_price || 0  // price_per_day = добова ставка
        
        return {
          product_id: it.product_id || it.id,
          sku: it.sku,
          name: it.name,
          rented_qty: it.rented_qty,
          returned_qty: it.returned_qty,
          not_returned_qty: notReturnedQty,
          full_price: fullPrice,
          daily_rate: dailyRate,
          loss_amount: fullPrice * notReturnedQty,  // Сума втрати = повна ціна × кількість
          image_url: it.image_url || it.image || ''
        }
      })
  }, [items])
  
  // Можна завершити якщо всі повернуті АБО є серійники (часткове дозволено)
  const canComplete = allSerialsOk && items.length > 0

  // === ЗБЕРЕЖЕННЯ ПРОГРЕСУ ===
  const saveProgress = async () => {
    setSaving(true)
    try {
      await axios.put(`${BACKEND_URL}/api/decor-orders/${orderId}/return-progress`, {
        items: items.map(item => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          rented_qty: item.rented_qty,
          returned_qty: item.returned_qty,
          ok_serials: item.ok_serials || [],
          findings: item.findings || [],
        })),
        receivers: selectedReceivers,
        notes: notes,
        fees: {
          late_fee: lateFee,
          cleaning_fee: cleaningFee,
          damage_fee: damageFee,
        }
      })
      
      // Повідомляємо інших користувачів про зміни
      await markMyUpdate()
      
      toast({ title: '✅ Збережено', description: 'Прогрес повернення збережено' })
    } catch (err) {
      console.error('Save error:', err)
      toast({ title: 'Помилка збереження', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // === ЗАВЕРШЕННЯ ===
  const completeReturn = async () => {
    if (!canComplete) {
      toast({
        title: '⚠️ Увага',
        description: 'Перевірте всі позиції та серійні номери',
        variant: 'destructive'
      })
      return
    }
    
    // Якщо є неповернені товари - показати модалку часткового повернення
    if (notReturnedItems.length > 0) {
      setPartialReturnModal({ open: true, items: notReturnedItems })
      return
    }
    
    // Повне повернення
    await executeFullReturn()
  }
  
  // Обробник підтвердження часткового повернення
  const handlePartialReturnConfirm = async (result) => {
    console.log('[ReturnWorkspace] Часткове повернення оброблено:', result)
    
    // Позначити що приймання завершено (для візуального блокування)
    setIsReturnCompleted(true)
    
    setTimeline(prev => [
      { 
        text: result.status === 'partial_return' 
          ? `Часткове повернення: ${result.extensions_created} позицій в оренді` 
          : 'Повернення завершено', 
        at: nowISO(), 
        tone: result.status === 'partial_return' ? 'amber' : 'green' 
      },
      ...prev
    ])
    
    if (result.status === 'partial_return') {
      toast({ 
        title: '🟡 Часткове повернення', 
        description: `${result.extensions_created} позицій залишено в оренді` 
      })
      // Перезавантажити дані (залишаємося на сторінці)
      loadOrder()
    } else {
      toast({ title: '✅ Успіх', description: 'Повернення завершено' })
      setTimeout(() => navigate('/manager'), 2000)
    }
  }
  
  // Повне повернення (всі товари повернуті)
  const executeFullReturn = async () => {
    setSaving(true)
    try {
      let depositAction = 'release'
      if (totalFees > 0 && totalDeposit > 0) {
        depositAction = 'part-release'
      }
      
      await axios.post(`${BACKEND_URL}/api/decor-orders/${orderId}/complete-return`, {
        items_returned: items.map(item => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          rented_qty: item.rented_qty,
          returned_qty: item.returned_qty,
          ok_serials: item.ok_serials,
          findings: item.findings
        })),
        late_fee: lateFee,
        cleaning_fee: cleaningFee,
        damage_fee: damageFee,
        deposit_action: depositAction,
        manager_notes: notes
      })
      
      // Позначити що приймання завершено
      setIsReturnCompleted(true)
      
      setTimeline(prev => [
        { text: 'Повернення завершено', at: nowISO(), tone: 'green' },
        ...prev
      ])
      
      toast({ title: '✅ Успіх', description: 'Повернення завершено' })
      setTimeout(() => navigate('/manager'), 2000)
      
    } catch (err) {
      console.error('Error completing return:', err)
      toast({
        title: '❌ Помилка',
        description: err.response?.data?.detail || 'Не вдалося завершити повернення',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  // === РЕНДЕР ===
  const totalRentedQty = items.reduce((s, it) => s + it.rented_qty, 0)
  const totalReturnedQty = items.reduce((s, it) => s + it.returned_qty, 0)
  const totalFindings = items.reduce((s, it) => s + it.findings.length, 0)
  const currentItem = items.find(i => i.id === damageModal.itemId)

  return (
    <>
      <OrderWorkspaceLayout
        orderId={orderId}
        orderNumber={order?.order_number || `#${orderId}`}
        status="INTAKE"
        issueDate={issueDate}
        returnDate={returnDate}
        createdAt={order?.created_at}
        headerTitle={`Повернення #${orderId}`}
        backUrl="/manager"
        loading={loading}
        
        // Real-time sync
        activeUsers={activeUsers}
        hasUpdates={wsHasUpdates || hasNewChanges}
        onRefresh={async () => {
          await loadOrder()
          dismissAllUpdates()
          dismissChanges()
        }}
        
        // Left Rail
        leftRail={
          <>
            <LeftRailClient
              name={clientName}
              phone={clientPhone}
              email={clientEmail}
              tier="regular"
            />
            <LeftRailFinance
              orderId={order?.order_id}
              rentAmount={totalRent}
              depositAmount={totalDeposit}
            />
            <LeftRailDocuments
              orderId={order?.order_id}
              orderNumber={order?.order_number}
              orderStatus="returning"
              customerEmail={clientEmail}
            />
            <LeftRailTimeline orderId={order?.order_id} events={timeline} />
          </>
        }
        
        // Footer
        onPrimaryAction={completeReturn}
        primaryLabel="✅ Завершити приймання"
        primaryDisabled={saving || !canComplete}
        primaryDisabledReason={!canComplete ? 'Перевірте всі позиції' : ''}
        showSave={true}
        onSave={saveProgress}
        saving={saving}
        footerActions={[]}
        footerChildren={
          <div className="text-sm text-slate-600">
            Повернуто: <b>{totalReturnedQty}/{totalRentedQty}</b> · 
            Пошкоджень: <b className={totalFindings > 0 ? 'text-amber-600' : ''}>{totalFindings}</b> · 
            До доплати: <b className={totalFees > 0 ? 'text-amber-600' : ''}>₴{totalFees.toLocaleString('uk-UA')}</b>
          </div>
        }
      >
        {/* === WORKSPACE ZONES === */}
        
        {/* Приймальники (хто приймає повернення) */}
        <ZoneRequisitors
          title="Приймальники"
          hint="Оберіть хто приймає повернення"
          selectedIds={selectedReceivers}
          onSelectionChange={setSelectedReceivers}
          readOnly={false}
        />
        
        {/* Приймання товарів */}
        <ZoneItemsReturn
          items={items}
          onSetReturnedQty={handleSetReturnedQty}
          onToggleSerial={handleToggleSerial}
          onOpenDamage={handleOpenDamage}
          readOnly={false}
          isCompleted={isReturnCompleted}
        />
        
        {/* Нарахування штрафів */}
        <ZoneReturnFees
          lateFee={lateFee}
          cleaningFee={cleaningFee}
          damageFee={damageFee}
          onSetLateFee={setLateFee}
          onSetCleaningFee={setCleaningFee}
          onSetDamageFee={setDamageFee}
          readOnly={false}
        />
        
        {/* Документи переміщено в LeftRailDocuments */}
        
        {/* Внутрішній чат команди */}
        <InternalNotesChat
          orderId={orderId}
          clientComment={order?.customer_comment || order?.client_comment}
        />
      </OrderWorkspaceLayout>
      
      {/* Модалка пошкоджень */}
      <DamageModal
        isOpen={damageModal.open}
        onClose={() => setDamageModal({ open: false, itemId: null })}
        item={currentItem}
        order={{ order_id: orderId, order_number: order?.order_number || orderId }}
        stage="return"
        onSave={handleSaveDamage}
        existingHistory={currentItem?.findings || []}
      />
      
      {/* Модалка часткового повернення */}
      <PartialReturnModal
        isOpen={partialReturnModal.open}
        onClose={() => setPartialReturnModal({ open: false, items: [] })}
        orderId={orderId}
        notReturnedItems={partialReturnModal.items}
        onConfirm={handlePartialReturnConfirm}
      />
    </>
  )
}
