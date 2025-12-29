/* eslint-disable */
/**
 * Issue Card Workspace - Картка комплектації/видачі
 * Використовує уніфіковану систему Order Workspace
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../hooks/use-toast'
import { useOrderSync } from '../hooks/useAutoRefresh'
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
  ZoneItemsPickup,
  ZoneChecklist,
  ZoneDocuments,
  ZoneNotes,
  ZoneRequisitors,
} from '../components/order-workspace/zones'
// FinanceStatusCard тепер тільки в LeftRailFinance

import DamageModal from '../components/DamageModal'
import OrderItemsModification from '../components/order-workspace/OrderItemsModification'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

const todayISO = () => new Date().toISOString().slice(0, 10)
const nowISO = () => new Date().toISOString().slice(0, 19)

export default function IssueCardWorkspace() {
  const { id } = useParams()  // issue_card.id
  const navigate = useNavigate()
  const { toast } = useToast()
  
  console.log('[IssueCardWorkspace] Rendering with id:', id)
  
  // === СТАН ===
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [order, setOrder] = useState(null)
  const [issueCard, setIssueCard] = useState(null)
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
  const [prepayment, setPrepayment] = useState(0)
  
  // Нотатки та чеклист
  const [notes, setNotes] = useState('')
  const [checklist, setChecklist] = useState([
    { id: 'stretch', label: 'Стрейчування', checked: false, required: false },
    { id: 'labels', label: 'Маркування/стікери', checked: false, required: false },
    { id: 'photos_before', label: 'Фото стану (до видачі)', checked: false, required: true },
    { id: 'docs_printed', label: 'Роздруковано документи', checked: false, required: true },
  ])
  
  // Документи
  const [documents, setDocuments] = useState({ waybill: false, act: false })
  
  // Реквізитори (комплектувальники)
  const [selectedRequisitors, setSelectedRequisitors] = useState([])
  
  // Таймлайн
  const [timeline, setTimeline] = useState([])
  
  // Модалка пошкоджень
  const [damageModal, setDamageModal] = useState({ open: false, itemId: null })

  // === ЗАВАНТАЖЕННЯ ===
  const loadIssueCard = async () => {
    try {
      setLoading(true)
      
      // Завантажуємо issue_card
      const issueRes = await axios.get(`${BACKEND_URL}/api/issue-cards/${id}`)
      const issueCardData = issueRes.data
      setIssueCard(issueCardData)
      
      // Завантажуємо замовлення
      const orderId = issueCardData.order_id
      let orderData
      
      try {
        const res = await axios.get(`${BACKEND_URL}/api/decor-orders/${orderId}`)
        orderData = res.data
      } catch {
        const res = await axios.get(`${BACKEND_URL}/api/orders/${orderId}`)
        orderData = res.data
      }
      
      setOrder(orderData)
      
      // Клієнт
      const names = (orderData.client_name || '').split(' ')
      setClientName(orderData.client_name || `${names[0] || ''} ${names.slice(1).join(' ')}`)
      setClientPhone(orderData.client_phone || orderData.telephone || '')
      setClientEmail(orderData.client_email || orderData.email || '')
      
      // Дати
      setIssueDate(orderData.rent_date || orderData.rental_start_date || orderData.issue_date || todayISO())
      setReturnDate(orderData.rent_return_date || orderData.rental_end_date || orderData.return_date || todayISO())
      
      // Фінанси
      setTotalRent(parseFloat(orderData.total_rental || orderData.total || 0))
      setTotalDeposit(parseFloat(orderData.deposit_held || orderData.total_deposit || 0))
      setPrepayment(parseFloat(orderData.prepayment || 0))
      
      // Нотатки
      setNotes(issueCardData.preparation_notes || orderData.manager_comment || '')
      
      // Чеклист
      if (issueCardData.checklist) {
        setChecklist(prev => prev.map(item => ({
          ...item,
          checked: issueCardData.checklist[item.id] || false
        })))
      }
      
      // Реквізитори (комплектувальники)
      if (issueCardData.requisitors) {
        setSelectedRequisitors(issueCardData.requisitors)
      }
      
      // Товари
      const itemsSource = (issueCardData.items?.length > 0) 
        ? issueCardData.items 
        : (orderData.items || [])
      
      const transformedItems = itemsSource.map((p, idx) => ({
        id: p.id || p.order_product_id || p.inventory_id || idx,
        sku: p.article || p.sku || p.model || '',
        name: p.name || p.product_name || '',
        image: p.image || p.photo || '',
        qty: parseInt(p.quantity || p.qty) || 0,
        picked_qty: parseInt(p.picked_qty) || 0,
        available: parseInt(p.available_qty || p.available) || 0,
        reserved: parseInt(p.reserved_qty || p.reserved) || 0,
        in_rent: parseInt(p.in_rent_qty || p.in_rent) || 0,
        in_restore: parseInt(p.in_restore_qty || p.in_restore) || 0,
        damage_cost: parseFloat(p.damage_cost || 0),
        deposit: parseFloat(p.deposit || 0),
        serials: p.serials || [],
        scanned: p.scanned || [],
        packaging: p.packaging || { cover: false, box: false, stretch: false, black_case: false },
        location: { zone: p.location?.zone || '', state: p.location?.state || 'shelf' },
        pre_damage: p.pre_damage || []
      }))
      
      setItems(transformedItems)
      
      // Таймлайн
      try {
        const lifecycleRes = await axios.get(`${BACKEND_URL}/api/orders/${orderId}/lifecycle`)
        const lifecycleEvents = lifecycleRes.data || []
        
        const timelineEvents = lifecycleEvents.map(evt => ({
          text: evt.notes || evt.stage || 'Подія',
          at: evt.created_at || nowISO(),
          tone: evt.stage === 'accepted' ? 'green' : evt.stage === 'completed' ? 'green' : 'blue',
          user: evt.created_by || evt.manager || null
        }))
        
        if (timelineEvents.length === 0) {
          timelineEvents.push({
            text: 'Картку видачі створено',
            at: orderData.created_at || nowISO(),
            tone: 'blue'
          })
        }
        
        setTimeline(timelineEvents)
      } catch {
        setTimeline([{ text: 'Картку видачі створено', at: orderData.created_at || nowISO(), tone: 'blue' }])
      }
      
    } catch (err) {
      console.error('[IssueCardWorkspace] Error loading:', err)
      toast({
        title: '❌ Помилка',
        description: 'Не вдалося завантажити картку',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Обгортаємо в useCallback для синхронізації
  const loadIssueCardCallback = useCallback(loadIssueCard, [id])

  // Синхронізація змін з іншими користувачами
  const { hasNewChanges, lastModifiedBy, markMyUpdate, dismissChanges } = useOrderSync(
    order?.order_id,
    loadIssueCardCallback,
    10000, // перевірка кожні 10 секунд
    !loading && !!order?.order_id
  )

  useEffect(() => {
    if (!id) return
    loadIssueCard()
  }, [id])

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
  const handlePick = (itemId, newPickedQty) => {
    setItems(items => items.map(it => 
      it.id === itemId ? { ...it, picked_qty: newPickedQty } : it
    ))
  }
  
  const handleScan = (itemId, serial) => {
    setItems(items => items.map(it => {
      if (it.id !== itemId) return it
      const scanned = it.scanned.includes(serial) 
        ? it.scanned.filter(s => s !== serial) 
        : [...it.scanned, serial]
      return { ...it, scanned }
    }))
  }
  
  const handlePackagingChange = (itemId, packType, value) => {
    setItems(items => items.map(it => {
      if (it.id !== itemId) return it
      return { 
        ...it, 
        packaging: { ...it.packaging, [packType]: value } 
      }
    }))
  }
  
  const handleOpenDamage = (itemId) => {
    setDamageModal({ open: true, itemId })
  }
  
  const handleChecklistToggle = (itemId) => {
    setChecklist(prev => prev.map(item => 
      item.id === itemId ? { ...item, checked: !item.checked } : item
    ))
  }

  // === РОЗРАХУНКИ ===
  const allPicked = useMemo(() => items.every(it => it.picked_qty >= it.qty), [items])
  const allSerialsOk = useMemo(() => items.every(it => it.serials.length === 0 || it.scanned.length >= it.qty), [items])
  const checklistOk = useMemo(() => checklist.filter(c => c.required).every(c => c.checked), [checklist])
  const hasRequisitors = selectedRequisitors.length > 0
  
  // Логіка "Готово до видачі" - документи та платежі НЕ блокують
  // Критично: allPicked (комплектація) та hasRequisitors (комплектувальник)
  // checklistOk та allSerialsOk - рекомендовано, але не блокує
  const canMarkReady = allPicked && hasRequisitors
  
  const issueCardStatus = issueCard?.status || 'preparation'
  const isProcessing = issueCardStatus === 'preparation'
  const isReadyForIssue = issueCardStatus === 'ready'
  const isIssued = issueCardStatus === 'issued'
  
  const workspaceStatus = isIssued ? 'ISSUED' : isReadyForIssue ? 'READY_FOR_ISSUE' : 'PROCESSING'

  // === ЗБЕРЕЖЕННЯ ===
  const saveProgress = async () => {
    setSaving(true)
    try {
      const checklistObj = {}
      checklist.forEach(item => { checklistObj[item.id] = item.checked })
      
      await axios.put(`${BACKEND_URL}/api/issue-cards/${id}`, {
        items: items.map(it => ({
          id: it.id,
          sku: it.sku,
          name: it.name,
          qty: it.qty,
          picked_qty: it.picked_qty,
          scanned: it.scanned,
          serials: it.serials,
          packaging: it.packaging,
          pre_damage: it.pre_damage || [],
          location_zone: it.location_zone || it.location?.zone,
          location_state: it.location_state || it.location?.state
        })),
        checklist: checklistObj,
        preparation_notes: notes,
        requisitors: selectedRequisitors
      })
      
      // Повідомляємо інших користувачів про зміни
      await markMyUpdate()
      
      toast({ title: '✅ Успіх', description: 'Прогрес збережено' })
    } catch (err) {
      console.error('Error saving:', err)
      toast({ title: '❌ Помилка', description: 'Не вдалося зберегти', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const markReady = async () => {
    if (!canMarkReady) {
      toast({
        title: '⚠️ Увага',
        description: 'Завершіть комплектування та обовʼязкові пункти чеклисту',
        variant: 'destructive'
      })
      return
    }
    
    setSaving(true)
    try {
      await saveProgress()
      
      const checklistObj = {}
      checklist.forEach(item => { checklistObj[item.id] = item.checked })
      
      await axios.put(`${BACKEND_URL}/api/issue-cards/${id}`, { 
        status: 'ready',
        prepared_by: 'Warehouse Staff',
        items: items.map(it => ({
          id: it.id,
          sku: it.sku,
          name: it.name,
          qty: it.qty,
          picked_qty: it.picked_qty,
          scanned: it.scanned,
          packaging: it.packaging
        })),
        checklist: checklistObj,
        preparation_notes: notes
      })
      
      setIssueCard(prev => ({ ...prev, status: 'ready' }))
      setTimeline(prev => [{ text: 'Укомплектовано і готово до видачі', at: nowISO(), tone: 'blue' }, ...prev])
      
      toast({ title: '✅ Успіх', description: 'Замовлення готове до видачі' })
      setTimeout(() => navigate('/manager'), 1500)
    } catch (err) {
      console.error('Error marking ready:', err)
      toast({ title: '❌ Помилка', description: 'Не вдалося оновити статус', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const markIssued = async () => {
    setSaving(true)
    try {
      await axios.post(`${BACKEND_URL}/api/issue-cards/${id}/complete`, {
        issued_by: 'Manager',
        issue_notes: notes || ''
      })
      
      setIssueCard(prev => ({ ...prev, status: 'issued' }))
      setTimeline(prev => [{ text: 'Видано клієнту', at: nowISO(), tone: 'green' }, ...prev])
      
      toast({ title: '✅ Успіх', description: 'Замовлення видано клієнту. Return Card створено.' })
      setTimeout(() => navigate('/manager'), 2000)
    } catch (err) {
      console.error('Error marking issued:', err)
      toast({ title: '❌ Помилка', description: err.response?.data?.detail || 'Не вдалося підтвердити видачу', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // === ДРУК ===
  const printWarehouseSlip = () => {
    window.open(`${BACKEND_URL}/api/pdf/pick-list/${order?.order_id || issueCard?.order_id}`, '_blank')
    setDocuments(prev => ({ ...prev, waybill: true }))
  }

  const printQRCodes = () => {
    // Реалізація з оригінального IssueCard
    const qrWindow = window.open('', '_blank')
    const html = `<!doctype html>
<html><head><title>QR Коди</title>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
<style>body{font-family:system-ui;margin:20px}.item{display:inline-block;width:45%;margin:10px;padding:15px;border:1px dashed #ccc;text-align:center}</style>
</head><body>
<h2>QR коди для товарів - Замовлення #${order?.order_id || issueCard?.order_id}</h2>
<div>${items.map((item, i) => `
<div class="item">
<div style="font-weight:600">${item.name}</div>
<div style="font-size:11px;color:#666">SKU: ${item.sku || '—'}</div>
<canvas id="qr-${i}" style="margin:10px 0"></canvas>
</div>`).join('')}</div>
<script>
${items.map((item, i) => `QRCode.toCanvas(document.getElementById('qr-${i}'), '${window.location.origin}/inventory/${item.sku || item.id}', {width:80});`).join('\n')}
setTimeout(()=>window.print(),500);
</script></body></html>`
    qrWindow.document.write(html)
    qrWindow.document.close()
  }

  // === РЕНДЕР ===
  const pickedCount = items.filter(it => it.picked_qty >= it.qty).length
  const pickedQty = items.reduce((s, it) => s + (it.picked_qty || 0), 0)
  const totalQty = items.reduce((s, it) => s + (it.qty || 0), 0)

  return (
    <>
      <OrderWorkspaceLayout
        orderId={issueCard?.order_id || id}
        orderNumber={order?.order_number || `IC-${id}`}
        status={workspaceStatus}
        issueDate={issueDate}
        returnDate={returnDate}
        createdAt={order?.created_at}
        headerTitle={`Видача #${issueCard?.order_id || id}`}
        backUrl="/manager"
        loading={loading}
        
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
              orderStatus={isIssued ? 'issued' : isReadyForIssue ? 'ready_for_issue' : 'processing'}
              issueCardId={issueCard?.id}
              customerEmail={clientEmail}
            />
            <LeftRailTimeline orderId={order?.order_id} events={timeline} />
          </>
        }
        
        // Footer
        onPrimaryAction={isProcessing ? markReady : isReadyForIssue ? markIssued : undefined}
        primaryLabel={isProcessing ? '✅ Готово до видачі' : isReadyForIssue ? '🚚 Видати клієнту' : undefined}
        primaryDisabled={saving || (isProcessing && !canMarkReady)}
        primaryDisabledReason={isProcessing && !canMarkReady 
          ? (!hasRequisitors ? 'Оберіть комплектувальника' : 'Скомплектуйте всі позиції') 
          : ''}
        onSave={!isIssued ? saveProgress : undefined}
        saving={saving}
        showSave={!isIssued}
        footerActions={[
          { label: '🖨️ Накладна', onClick: printWarehouseSlip },
          { label: '📱 QR коди', onClick: printQRCodes },
        ]}
        footerChildren={
          <div className="text-sm text-slate-600 flex items-center gap-3">
            <span>Позицій: <b>{pickedCount}/{items.length}</b> · Одиниць: <b>{pickedQty}/{totalQty}</b></span>
            {lastUpdate && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                {isRefreshing && <span className="animate-spin">⟳</span>}
                Оновлено: {formatLastUpdate(lastUpdate)}
              </span>
            )}
          </div>
        }
      >
        {/* === WORKSPACE ZONES === */}
        
        {/* Реквізитори (комплектувальники) */}
        <ZoneRequisitors
          selectedIds={selectedRequisitors}
          onSelectionChange={setSelectedRequisitors}
          readOnly={isIssued}
        />
        
        {/* Дозамовлення - редагування позицій */}
        {!isIssued && (
          <OrderItemsModification
            orderId={order?.order_id || order?.id}
            orderStatus={issueCard?.status || 'processing'}
            items={items}
            onItemsChange={setItems}
            onTotalsChange={(totals) => {
              if (totals.total_price !== undefined) setTotalRent(totals.total_price)
              if (totals.deposit_amount !== undefined) setTotalDeposit(totals.deposit_amount)
            }}
          />
        )}
        
        {/* Комплектування */}
        <ZoneItemsPickup
          items={items}
          onPick={handlePick}
          onScan={handleScan}
          onOpenDamage={handleOpenDamage}
          onPackagingChange={handlePackagingChange}
          readOnly={isIssued}
        />
        
        {/* Чеклист */}
        <ZoneChecklist
          items={checklist}
          onToggle={handleChecklistToggle}
          title="✅ Чеклист перед видачею"
          hint="Обов'язкові пункти для завершення"
          readOnly={isIssued}
        />
        
        {/* Документи переміщено в LeftRailDocuments */}
        
        {/* Внутрішній чат команди */}
        <InternalNotesChat
          orderId={order?.order_id || issueCard?.order_id}
          clientComment={order?.customer_comment || order?.client_comment}
          readOnly={isIssued}
        />
      </OrderWorkspaceLayout>
      
      {/* Модалка пошкоджень */}
      <DamageModal
        isOpen={damageModal.open}
        onClose={() => setDamageModal({ open: false, itemId: null })}
        item={items.find(i => i.id === damageModal.itemId)}
        order={order}
        stage="pre_issue"
        onSave={async (damageRecord) => {
          // Оновлюємо items з новим пошкодженням
          const updatedItems = items.map(it => 
            it.id === damageModal.itemId ? {
              ...it,
              pre_damage: [...(it.pre_damage || []), damageRecord]
            } : it
          )
          setItems(updatedItems)
          setDamageModal({ open: false, itemId: null })
          
          // Автоматично зберігаємо картку
          try {
            await api.put(`/api/issue-cards/${issueCard.id}`, {
              items: updatedItems.map(it => ({
                id: it.id,
                sku: it.sku,
                name: it.name,
                qty: it.qty,
                picked_qty: it.picked_qty,
                scanned: it.scanned,
                serials: it.serials,
                packaging: it.packaging,
                pre_damage: it.pre_damage || []
              }))
            })
            toast({ title: '✅ Пошкодження зафіксовано та збережено', variant: 'default' })
          } catch (err) {
            console.error('Error saving damage:', err)
            toast({ title: 'Пошкодження додано, натисніть "Зберегти"', variant: 'warning' })
          }
        }}
      />
    </>
  )
}
