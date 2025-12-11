import React, { useMemo, useState, useEffect } from 'react'
import { getImageUrl } from '../utils/imageHelper'
import CorporateHeader from '../components/CorporateHeader'
import axios from 'axios'
import { Package, Clock, TrendingUp, CheckCircle2, AlertCircle, Trash2, Plus, RefreshCw, Calendar } from 'lucide-react'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://backrentalhub.farforrent.com.ua'

/*************** Tab Types ***************/
type DamageTab = 'main' | 'washing' | 'restoration' | 'laundry'

/*************** helpers ***************/
const cls = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')
const fmtUA = (n: number) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })

/*************** types ***************/
type DamageSeverity = 'low' | 'medium' | 'high' | 'critical'
type DamageStatus = 'draft' | 'awaiting_client' | 'awaiting_payment' | 'in_repair' | 'closed'
type DamageSource = 'return' | 'reaudit' | 'other'

interface DamageLine {
  id: string
  productName: string
  sku: string
  inventoryCode?: string
  category: string
  ruleLabel?: string
  minAmount?: number
  qty: number
  amountPerUnit: number
  total: number
  note?: string
  fromReauditItemId?: string
  image?: string
}

interface DamageCase {
  id: string
  orderId?: string
  source: DamageSource
  fromReauditItemId?: string | null
  createdAt: string
  createdBy: string
  clientName: string
  eventName?: string
  returnDate?: string
  severity: DamageSeverity
  status: DamageStatus
  depositHold: number
  lines: DamageLine[]
  internalNote?: string
}

/*************** small UI ***************/
function Badge({ tone = 'slate', children }: { tone?: string; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    slate: 'corp-badge corp-badge-neutral',
    green: 'corp-badge corp-badge-success',
    blue: 'corp-badge corp-badge-info',
    amber: 'corp-badge corp-badge-warning',
    red: 'corp-badge corp-badge-error',
    violet: 'corp-badge corp-badge-primary',
  }
  return (
    <span className={tones[tone] || tones.slate}>
      {children}
    </span>
  )
}

function PillButton({
  children,
  onClick,
  tone = 'slate',
}: {
  children: React.ReactNode
  onClick?: () => void
  tone?: 'slate' | 'green' | 'ghost' | 'red' | 'amber'
}) {
  const tones: Record<string, string> = {
    slate: 'corp-btn corp-btn-secondary',
    green: 'corp-btn corp-btn-primary',
    red: 'corp-btn corp-btn-secondary text-corp-error hover:bg-corp-error hover:text-white',
    amber: 'corp-btn corp-btn-gold',
    ghost: 'corp-btn corp-btn-outline',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={tones[tone]}
    >
      {children}
    </button>
  )
}

function SeverityBadge({ severity }: { severity: DamageSeverity }) {
  if (severity === 'low') return <Badge tone="green">Low</Badge>
  if (severity === 'medium') return <Badge tone="amber">Medium</Badge>
  if (severity === 'high') return <Badge tone="red">High</Badge>
  return <Badge tone="red">Critical</Badge>
}

function StatusBadge({ status }: { status: DamageStatus }) {
  const map: Record<DamageStatus, { label: string; tone: string }> = {
    draft: { label: 'Чернетка', tone: 'slate' },
    awaiting_client: { label: 'Очікуємо підтвердження клієнта', tone: 'amber' },
    awaiting_payment: { label: 'Очікуємо оплату', tone: 'amber' },
    in_repair: { label: 'В реставрації', tone: 'blue' },
    closed: { label: 'Закрито', tone: 'green' },
  }
  const x = map[status] || { label: status || 'Невідомо', tone: 'slate' }
  return <Badge tone={x.tone}>{x.label}</Badge>
}

/*************** main component ***************/
export default function DamageCabinetPro({ 
  onBackToDashboard,
  onNavigateToTasks,
  initialDamageId
}: { 
  onBackToDashboard?: () => void
  onNavigateToTasks?: (damageId: string) => void
  initialDamageId?: string
}) {
  // Tab state
  const [activeTab, setActiveTab] = useState<DamageTab>('main')
  
  // Main tab state
  const [cases, setCases] = useState<DamageCase[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(initialDamageId || null)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DamageStatus>('all')
  const [severityFilter, setSeverityFilter] = useState<'all' | DamageSeverity>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | DamageSource>('all')
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  
  // Laundry tab state
  const [laundryBatches, setLaundryBatches] = useState<any[]>([])
  const [laundryStats, setLaundryStats] = useState<any>(null)
  const [laundryLoading, setLaundryLoading] = useState(false)
  const [laundryFilter, setLaundryFilter] = useState('all')
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<any>(null)
  const [showReturnModal, setShowReturnModal] = useState(false)

  useEffect(() => {
    loadCases()
  }, [])

  const loadCases = async () => {
    try {
      setLoading(true)
      
      // Завантажити всі пошкодження з product_damage_history
      const response = await fetch(`${BACKEND_URL}/api/product-damage-history/recent?limit=200`)
      const data = await response.json()
      
      console.log('[DamageCabinet] Loaded damage history:', data.length)
      
      // Трансформувати дані з product_damage_history
      const transformedData = data.map((item: any) => ({
        id: String(item.id),
        orderId: item.order_id ? String(item.order_id) : null,
        clientName: item.product_name || 'Без назви',
        eventName: item.order_number 
          ? `Замовлення ${item.order_number}` 
          : (item.note || 'Кейс пошкодження'),
        status: 'closed', // Всі історичні пошкодження вважаються закритими
        severity: item.severity === 'high' ? 'critical' : 
                  item.severity === 'medium' ? 'medium' : 'low',
        source: item.stage === 'return' ? 'return' : 
                item.stage === 'audit' ? 'reaudit' : 'other',
        depositHold: 0,
        lines: [{
          id: String(item.id),
          productName: item.product_name,
          sku: item.sku,
          category: item.category || 'Unknown',
          qty: 1,
          note: item.note || '',
          amountPerUnit: item.fee || 0,
          total: item.fee || 0,
          image: item.product_image || item.photo_url  // Пріоритет: фото товару, потім фото пошкодження
        }],
        createdAt: item.created_at,
        createdBy: item.created_by || 'Unknown',
        returnDate: item.created_at
      }))
      
      setCases(transformedData)
      if (transformedData.length > 0 && !selectedId) {
        setSelectedId(transformedData[0].id)
      }
    } catch (error) {
      console.error('Error loading cases:', error)
      alert('Помилка завантаження кейсів')
    } finally {
      setLoading(false)
    }
  }

  // ========== Laundry Functions ==========
  const [laundryQueue, setLaundryQueue] = useState<any[]>([])

  const loadLaundryData = async () => {
    try {
      setLaundryLoading(true)
      const token = localStorage.getItem('token')
      const params = laundryFilter !== 'all' ? { status: laundryFilter } : {}
      
      const [batchesRes, statsRes, queueRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/laundry/batches`, {
          params,
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_URL}/api/laundry/statistics`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_URL}/api/laundry/queue`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] })) // Якщо endpoint не існує
      ])
      
      setLaundryBatches(batchesRes.data)
      setLaundryStats(statsRes.data)
      setLaundryQueue(queueRes.data || [])
    } catch (error) {
      console.error('Error loading laundry data:', error)
    } finally {
      setLaundryLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'laundry') {
      loadLaundryData()
    }
  }, [activeTab, laundryFilter])

  const handleDeleteBatch = async (batchId: string) => {
    if (!window.confirm('Видалити партію? Товари повернуться на склад.')) return
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`${BACKEND_URL}/api/laundry/batches/${batchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      alert('Партію видалено')
      loadLaundryData()
    } catch (error: any) {
      alert('Помилка видалення: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleCompleteBatch = async (batchId: string) => {
    if (!window.confirm('Закрити партію?')) return
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${BACKEND_URL}/api/laundry/batches/${batchId}/complete`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      alert('Партію закрито')
      loadLaundryData()
    } catch (error: any) {
      alert('Помилка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const getLaundryStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; tone: string }> = {
      sent: { label: 'Відправлено', tone: 'blue' },
      partial_return: { label: 'Часткове повернення', tone: 'amber' },
      returned: { label: 'Повернено', tone: 'green' },
      completed: { label: 'Закрито', tone: 'slate' }
    }
    const config = statusMap[status] || statusMap.sent
    return <Badge tone={config.tone}>{config.label}</Badge>
  }

  // Створення партії з черги
  const handleCreateBatchFromQueue = async (
    itemIds: string[],
    laundryCompany: string,
    expectedReturnDate: string,
    cost: number | null,
    notes: string
  ) => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${BACKEND_URL}/api/laundry/batches/from-queue`,
        null,
        {
          params: {
            item_ids: itemIds,
            laundry_company: laundryCompany,
            expected_return_date: expectedReturnDate,
            cost: cost,
            notes: notes
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      alert(`✅ ${response.data.message}`)
      loadLaundryData()
    } catch (error: any) {
      alert('Помилка: ' + (error.response?.data?.detail || error.message))
    }
  }

  // Видалення з черги
  const handleRemoveFromQueue = async (itemId: string) => {
    if (!window.confirm('Видалити товар з черги?')) return
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`${BACKEND_URL}/api/laundry/queue/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      loadLaundryData()
    } catch (error: any) {
      alert('Помилка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const selected = useMemo(() => {
    if (!cases.length) return null
    if (!selectedId) return cases[0]
    return cases.find((c) => c.id === selectedId) || cases[0]
  }, [cases, selectedId])

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      const linesText = (c.lines || []).map((l) => l.productName + l.sku + l.category + (l.note || '')).join(' ')
      const text = (
        c.id +
        (c.orderId || '') +
        c.clientName +
        (c.eventName || '') +
        linesText
      ).toLowerCase()
      const okQ = !q || text.includes(q.toLowerCase())
      const okStatus = statusFilter === 'all' || c.status === statusFilter
      const okSeverity = severityFilter === 'all' || c.severity === severityFilter
      const okSource = sourceFilter === 'all' || c.source === sourceFilter
      return okQ && okStatus && okSeverity && okSource
    })
  }, [cases, q, statusFilter, severityFilter, sourceFilter])

  const counters = useMemo(() => {
    const open = cases.filter((c) => c.status !== 'closed').length
    const awaitingClient = cases.filter((c) => c.status === 'awaiting_client').length
    const awaitingPayment = cases.filter((c) => c.status === 'awaiting_payment').length
    const inRepair = cases.filter((c) => c.status === 'in_repair').length
    const closed = cases.filter((c) => c.status === 'closed').length
    return { open, awaitingClient, awaitingPayment, inRepair, closed }
  }, [cases])

  const onStatusChange = async (id: string, status: DamageStatus) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/damages/cases/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (response.ok) {
        setCases((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
        alert('✅ Статус оновлено')
      }
    } catch (error) {
      alert('Помилка оновлення статусу')
    }
  }

  const editLineAmount = async (caseId: string, lineId: string) => {
    const targetCase = cases.find((c) => c.id === caseId)
    if (!targetCase || !targetCase.lines) return
    const line = targetCase.lines.find((l) => l.id === lineId)
    if (!line) return
    const input = prompt(
      `Нова сума за одиницю (мінімум ${line.minAmount} грн) для «${line.productName}»?`,
      String(line.amountPerUnit),
    )
    if (!input) return
    const value = Number(input)
    if (isNaN(value) || value <= 0) {
      alert('Вкажіть коректну суму.')
      return
    }
    const amountPerUnit = Math.max(line.minAmount || 0, value)
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/damages/cases/${caseId}/lines/${lineId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_per_unit: amountPerUnit })
      })
      if (response.ok) {
        setCases((prev) =>
          prev.map((c) =>
            c.id === caseId
              ? {
                  ...c,
                  lines: (c.lines || []).map((ln) =>
                    ln.id === lineId
                      ? { ...ln, amountPerUnit, total: Math.round(amountPerUnit * ln.qty) }
                      : ln,
                  ),
                }
              : c,
          ),
        )
        alert('✅ Суму оновлено')
      }
    } catch (error) {
      alert('Помилка оновлення суми')
    }
  }

  const addLine = async (caseId: string) => {
    const productName = prompt('Назва предмета?')
    if (!productName) return
    const sku = prompt('SKU / код (можна пропустити)?') || ''
    const ruleLabel = prompt('Що трапилось? (коротко)') || 'Пошкодження'
    const minStr = prompt('Мінімальна сума згідно прайсу?', '500') || '500'
    const qtyStr = prompt('Кількість одиниць?', '1') || '1'
    const minAmount = Math.max(0, Number(minStr) || 0)
    const qty = Math.max(1, Number(qtyStr) || 1)

    try {
      const response = await fetch(`${BACKEND_URL}/api/damages/cases/${caseId}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: productName,
          sku,
          rule_label: ruleLabel,
          min_amount: minAmount,
          qty,
          amount_per_unit: minAmount
        })
      })
      if (response.ok) {
        await loadCases()
        alert('✅ Позицію додано')
      }
    } catch (error) {
      alert('Помилка додавання позиції')
    }
  }

  const openInFinance = (c: DamageCase) => {
    alert(
      `Мок: кейс ${c.id} буде відправлено у фінансовий кабінет (manager frontend) з прив'язкою до замовлення ${
        c.orderId || '—'
      }.`,
    )
  }

  const openInReaudit = (c: DamageCase) => {
    if (!c.fromReauditItemId) {
      alert('Для цього кейсу немає привʼязки до переобліку.')
      return
    }
    alert(`Мок: відкриємо кабінет переобліку з позицією ${c.fromReauditItemId}.`)
  }

  // Відправка товару на обробку (хімчистка, мийка, реставрація)
  const onSendToProcess = async (damageCase: DamageCase, line: DamageLine, processType: 'laundry' | 'washing' | 'restoration') => {
    const token = localStorage.getItem('token')
    const processNames = {
      laundry: 'хімчистку',
      washing: 'мийку',
      restoration: 'реставрацію'
    }

    try {
      if (processType === 'laundry') {
        // Додати до черги хімчистки
        const response = await axios.post(`${BACKEND_URL}/api/laundry/queue`, {
          damage_id: damageCase.id,
          order_id: damageCase.orderId ? parseInt(damageCase.orderId) : null,
          order_number: damageCase.orderId ? `Замовлення #${damageCase.orderId}` : null,
          product_name: line.productName,
          sku: line.sku,
          category: line.category || 'textile',
          quantity: line.qty,
          condition: 'dirty',
          notes: line.note || line.ruleLabel || 'З кабінету шкоди',
          source: 'damage_cabinet'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })

        alert(`✅ "${line.productName}" додано до черги хімчистки!\nСтворено завдання в Кабінеті завдань.`)
        
        // Оновити вкладку хімчистки
        if (activeTab === 'laundry') {
          loadLaundryData()
        }
      } else {
        // Для мийки та реставрації - створити завдання
        const taskType = processType === 'washing' ? 'washing' : 'restoration'
        const response = await axios.post(`${BACKEND_URL}/api/tasks`, {
          damage_id: damageCase.id,
          order_id: damageCase.orderId ? parseInt(damageCase.orderId) : null,
          order_number: damageCase.orderId ? `Замовлення #${damageCase.orderId}` : null,
          title: `${processType === 'washing' ? '🚿 Мийка' : '🔧 Реставрація'}: ${line.productName} (${line.sku})`,
          description: `Товар потребує ${processNames[processType]}.\nСтан: ${line.ruleLabel || 'Пошкодження'}.\n${line.note || ''}`,
          task_type: taskType,
          status: 'todo',
          priority: 'medium'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })

        alert(`✅ "${line.productName}" відправлено на ${processNames[processType]}!\nСтворено завдання в Кабінеті завдань.`)
      }
    } catch (error: any) {
      console.error('Error sending to process:', error)
      alert(`❌ Помилка: ${error.response?.data?.detail || error.message}`)
    }
  }

  if (loading && activeTab === 'main') {
    return (
      <div className="min-h-screen bg-corp-bg-main">
        <CorporateHeader cabinetName="Кабінет шкоди" showBackButton={true} onBackClick={onBackToDashboard} />
        <div className="p-6 text-sm text-corp-text-main">Завантаження...</div>
      </div>
    )
  }

  const linesTotal = selected ? (selected.lines || []).reduce((s, l) => s + l.total, 0) : 0
  const chargeFromDeposit = selected ? Math.min(selected.depositHold, linesTotal) : 0
  const extraPayment = Math.max(0, linesTotal - (selected?.depositHold || 0))

  // Tab definitions
  const tabs: { id: DamageTab; label: string; icon: string }[] = [
    { id: 'main', label: 'Головна', icon: '📋' },
    { id: 'washing', label: 'Мийка', icon: '🚿' },
    { id: 'restoration', label: 'Реставрація', icon: '🔧' },
    { id: 'laundry', label: 'Хімчистка', icon: '🧺' },
  ]

  return (
    <div className="min-h-screen bg-corp-bg-main">
      <CorporateHeader cabinetName="Кабінет шкоди" showBackButton={true} onBackClick={onBackToDashboard} />
      
      <div className="mx-auto max-w-7xl p-6 space-y-5">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cls(
                'px-4 py-2 rounded-t-lg text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-corp-primary text-white'
                  : 'bg-slate-100 text-corp-text-muted hover:bg-slate-200'
              )}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'main' && (
          <MainTabContent
            cases={cases}
            filtered={filtered}
            selected={selected}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            q={q}
            setQ={setQ}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            severityFilter={severityFilter}
            setSeverityFilter={setSeverityFilter}
            sourceFilter={sourceFilter}
            setSourceFilter={setSourceFilter}
            counters={counters}
            linesTotal={linesTotal}
            chargeFromDeposit={chargeFromDeposit}
            extraPayment={extraPayment}
            onStatusChange={onStatusChange}
            editLineAmount={editLineAmount}
            addLine={addLine}
            openInFinance={openInFinance}
            openInReaudit={openInReaudit}
            loadCases={loadCases}
            showTaskModal={showTaskModal}
            setShowTaskModal={setShowTaskModal}
            showSendModal={showSendModal}
            setShowSendModal={setShowSendModal}
            onNavigateToTasks={onNavigateToTasks}
            onSendToProcess={onSendToProcess}
          />
        )}

        {activeTab === 'washing' && (
          <WashingTabContent />
        )}

        {activeTab === 'restoration' && (
          <RestorationTabContent />
        )}

        {activeTab === 'laundry' && (
          <LaundryTabContent
            batches={laundryBatches}
            statistics={laundryStats}
            loading={laundryLoading}
            filterStatus={laundryFilter}
            setFilterStatus={setLaundryFilter}
            onDeleteBatch={handleDeleteBatch}
            onCompleteBatch={handleCompleteBatch}
            onRefresh={loadLaundryData}
            setShowCreateModal={setShowCreateBatchModal}
            setSelectedBatch={setSelectedBatch}
            setShowReturnModal={setShowReturnModal}
            getStatusBadge={getLaundryStatusBadge}
            queue={laundryQueue}
            onCreateBatchFromQueue={handleCreateBatchFromQueue}
            onRemoveFromQueue={handleRemoveFromQueue}
          />
        )}
      </div>
    </div>
  )
}

/*************** Main Tab Content ***************/
function MainTabContent({
  cases,
  filtered,
  selected,
  selectedId,
  setSelectedId,
  q,
  setQ,
  statusFilter,
  setStatusFilter,
  severityFilter,
  setSeverityFilter,
  sourceFilter,
  setSourceFilter,
  counters,
  linesTotal,
  chargeFromDeposit,
  extraPayment,
  onStatusChange,
  editLineAmount,
  addLine,
  openInFinance,
  openInReaudit,
  loadCases,
  showTaskModal,
  setShowTaskModal,
  showSendModal,
  setShowSendModal,
  onNavigateToTasks,
  onSendToProcess,
}: any) {
  const [sendingLineId, setSendingLineId] = useState<string | null>(null)

  const handleSendToProcess = async (line: DamageLine, processType: 'laundry' | 'washing' | 'restoration') => {
    setSendingLineId(line.id)
    try {
      await onSendToProcess(selected, line, processType)
    } finally {
      setSendingLineId(null)
    }
  }

  if (!selected) {
    return <div className="text-sm text-corp-text-main">Немає кейсів шкоди.</div>
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <Badge tone="amber">Відкриті кейси: {counters.open}</Badge>
        <Badge tone="amber">Чекаємо клієнта: {counters.awaitingClient}</Badge>
        <Badge tone="amber">Чекаємо оплату: {counters.awaitingPayment}</Badge>
        <Badge tone="blue">В реставрації: {counters.inRepair}</Badge>
        <Badge tone="green">Закрито: {counters.closed}</Badge>
      </div>

      {/* filters & list */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.25fr),minmax(0,1.75fr)]">
        <div className="space-y-3 text-[11px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="block text-corp-text-muted">Пошук</label>
                <input
                  className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-1.5"
                  placeholder="Клієнт, замовлення, товар, кейс..."
                  value={q}
                  onChange={(e: any) => setQ(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-corp-text-muted">Статус</label>
                <select
                  className="mt-1 w-40 rounded-full border border-slate-200 bg-white px-2 py-1.5"
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Усі</option>
                  <option value="draft">Чернетка</option>
                  <option value="awaiting_client">Очікуємо клієнта</option>
                  <option value="awaiting_payment">Очікуємо оплату</option>
                  <option value="in_repair">В реставрації</option>
                  <option value="closed">Закрито</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-end">
              <div>
                <label className="block text-corp-text-muted">Серйозність</label>
                <select
                  className="mt-1 w-32 rounded-full border border-slate-200 bg-white px-2 py-1.5"
                  value={severityFilter}
                  onChange={(e: any) => setSeverityFilter(e.target.value)}
                >
                  <option value="all">Усі</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-corp-text-muted">Джерело</label>
                <select
                  className="mt-1 w-40 rounded-full border border-slate-200 bg-white px-2 py-1.5"
                  value={sourceFilter}
                  onChange={(e: any) => setSourceFilter(e.target.value)}
                >
                  <option value="all">Усі</option>
                  <option value="return">Повернення</option>
                  <option value="reaudit">Переоблік</option>
                  <option value="other">Інше</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-corp-text-muted">
                Показано {filtered.length} з {cases.length} кейсів
              </div>
              <div className="flex gap-2">
                <PillButton tone="ghost" onClick={loadCases}>🔄 Оновити</PillButton>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 px-3 py-2 text-[11px] text-corp-text-muted">Список кейсів</div>
            <div className="max-h-[360px] divide-y divide-slate-100 overflow-auto text-[11px]">
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-corp-text-muted">Кейсів за цими фільтрами немає</div>
              ) : (
                filtered.map((c: DamageCase) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cls(
                      'flex cursor-pointer gap-2 px-3 py-2 hover:bg-slate-50',
                      c.id === selectedId && 'bg-slate-100 ring-1 ring-inset ring-slate-300'
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-semibold text-corp-text-dark">{c.clientName}</span>
                        <SeverityBadge severity={c.severity} />
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-corp-text-muted">
                        <span>Кейс #{c.id}</span>
                        {c.orderId && <span>• Замовлення #{c.orderId}</span>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px]">
                        <StatusBadge status={c.status} />
                        {c.source === 'return' && <Badge tone="blue">з повернення</Badge>}
                        {c.source === 'reaudit' && <Badge tone="violet">з переобліку</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-[10px] text-corp-text-main">
                      <span className="font-semibold">{fmtUA((c.lines || []).reduce((s, l) => s + l.total, 0))} ₴</span>
                      <span className="text-corp-text-muted">{(c.lines || []).length} поз.</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Selected Case Details */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 text-[11px]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-corp-text-dark">
                {selected.clientName}
              </h2>
              <p className="text-corp-text-muted">
                Кейс #{selected.id} • {selected.eventName || 'Без події'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={selected.status} />
              <SeverityBadge severity={selected.severity} />
            </div>
          </div>

          {/* Lines Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 text-[10px] font-semibold text-corp-text-muted uppercase tracking-wide">
              Позиції пошкоджень ({(selected.lines || []).length})
            </div>
            <div className="divide-y divide-slate-100">
              {(selected.lines || []).map((line: DamageLine) => (
                <div key={line.id} className="flex items-center gap-3 px-3 py-2">
                  {line.image && (
                    <img
                      src={getImageUrl(line.image) || ''}
                      alt={line.productName}
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                    />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-corp-text-dark">{line.productName}</div>
                    <div className="text-[10px] text-corp-text-muted">
                      {line.sku && <span>SKU: {line.sku} • </span>}
                      {line.ruleLabel || 'Пошкодження'}
                    </div>
                    {line.note && <div className="text-[10px] text-corp-text-muted italic mt-1">{line.note}</div>}
                  </div>
                  <div className="text-right mr-2">
                    <div className="font-semibold text-corp-text-dark">{fmtUA(line.total)} ₴</div>
                    <div className="text-[10px] text-corp-text-muted">
                      {line.qty} × {fmtUA(line.amountPerUnit)} ₴
                    </div>
                  </div>
                  
                  {/* Action Selector */}
                  <div className="flex items-center gap-1">
                    <select
                      className="text-[10px] rounded-lg border border-slate-200 px-2 py-1 bg-white"
                      disabled={sendingLineId === line.id}
                      defaultValue=""
                      onChange={(e) => {
                        const value = e.target.value as 'laundry' | 'washing' | 'restoration'
                        if (value) {
                          handleSendToProcess(line, value)
                          e.target.value = ''
                        }
                      }}
                    >
                      <option value="" disabled>Відправити →</option>
                      <option value="laundry">🧺 Хімчистка</option>
                      <option value="washing">🚿 Мийка</option>
                      <option value="restoration">🔧 Реставрація</option>
                    </select>
                    {sendingLineId === line.id && (
                      <span className="text-[10px] text-corp-text-muted">⏳</span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => editLineAmount(selected.id, line.id)}
                    className="text-corp-text-muted hover:text-corp-text-dark ml-1"
                  >
                    ✏️
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="flex justify-between items-center bg-slate-50 rounded-xl px-4 py-3">
            <div>
              <div className="text-corp-text-muted">Всього збитків</div>
              <div className="text-xl font-bold text-corp-text-dark">{fmtUA(linesTotal)} ₴</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-corp-text-muted">
                З депозиту: {fmtUA(chargeFromDeposit)} ₴
              </div>
              {extraPayment > 0 && (
                <div className="text-[10px] text-red-600 font-semibold">
                  До оплати: {fmtUA(extraPayment)} ₴
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <PillButton tone="green" onClick={() => onStatusChange(selected.id, 'closed')}>
              ✅ Закрити кейс
            </PillButton>
            <PillButton tone="slate" onClick={() => addLine(selected.id)}>
              ➕ Додати позицію
            </PillButton>
            <PillButton tone="ghost" onClick={() => openInFinance(selected)}>
              💰 До фінансів
            </PillButton>
            {onNavigateToTasks && (
              <PillButton tone="ghost" onClick={() => onNavigateToTasks(selected.id)}>
                📝 Створити завдання
              </PillButton>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/*************** Washing Tab Content ***************/
function WashingTabContent() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
      <div className="text-4xl mb-4">🚿</div>
      <h3 className="text-lg font-semibold text-corp-text-dark mb-2">Мийка товарів</h3>
      <p className="text-sm text-corp-text-muted mb-4">
        Тут буде відображатися список товарів, що потребують мийки після повернення.
      </p>
      <div className="inline-block px-4 py-2 bg-slate-100 rounded-full text-sm text-corp-text-muted">
        🚧 В розробці
      </div>
    </div>
  )
}

/*************** Restoration Tab Content ***************/
function RestorationTabContent() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
      <div className="text-4xl mb-4">🔧</div>
      <h3 className="text-lg font-semibold text-corp-text-dark mb-2">Реставрація</h3>
      <p className="text-sm text-corp-text-muted mb-4">
        Управління товарами, що потребують реставрації або ремонту.
      </p>
      <div className="inline-block px-4 py-2 bg-slate-100 rounded-full text-sm text-corp-text-muted">
        🚧 В розробці
      </div>
    </div>
  )
}

/*************** Laundry Tab Content ***************/
function LaundryTabContent({
  batches,
  statistics,
  loading,
  filterStatus,
  setFilterStatus,
  onDeleteBatch,
  onCompleteBatch,
  onRefresh,
  setShowCreateModal,
  setSelectedBatch,
  setShowReturnModal,
  getStatusBadge,
  queue,
  onCreateBatchFromQueue,
  onRemoveFromQueue,
}: any) {
  const [selectedQueueItems, setSelectedQueueItems] = useState<string[]>([])
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchForm, setBatchForm] = useState({
    laundry_company: '',
    expected_return_date: '',
    cost: '',
    notes: ''
  })

  const toggleQueueItem = (id: string) => {
    setSelectedQueueItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const selectAllQueue = () => {
    if (selectedQueueItems.length === queue?.length) {
      setSelectedQueueItems([])
    } else {
      setSelectedQueueItems(queue?.map((q: any) => q.id) || [])
    }
  }

  const handleCreateBatch = async () => {
    if (selectedQueueItems.length === 0) {
      alert('Виберіть товари для партії')
      return
    }
    if (!batchForm.laundry_company || !batchForm.expected_return_date) {
      alert('Заповніть назву хімчистки та очікувану дату повернення')
      return
    }
    
    await onCreateBatchFromQueue(
      selectedQueueItems,
      batchForm.laundry_company,
      batchForm.expected_return_date,
      batchForm.cost ? parseFloat(batchForm.cost) : null,
      batchForm.notes
    )
    
    setSelectedQueueItems([])
    setShowBatchModal(false)
    setBatchForm({ laundry_company: '', expected_return_date: '', cost: '', notes: '' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-corp-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Queue Section */}
      {queue && queue.length > 0 && (
        <div className="corp-card border-amber-200 bg-amber-50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-corp-text-dark flex items-center gap-2">
                📥 Черга на хімчистку
                <span className="text-sm font-normal text-amber-600">({queue.length} товарів)</span>
              </h3>
              <p className="text-sm text-corp-text-muted">Товари очікують на формування партії для відправки</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={selectAllQueue}
                className="corp-btn corp-btn-secondary text-sm"
              >
                {selectedQueueItems.length === queue.length ? '☐ Зняти всі' : '☑ Вибрати всі'}
              </button>
              {selectedQueueItems.length > 0 && (
                <button
                  onClick={() => setShowBatchModal(true)}
                  className="corp-btn corp-btn-primary text-sm"
                >
                  📦 Створити партію ({selectedQueueItems.length})
                </button>
              )}
            </div>
          </div>
          
          <div className="divide-y divide-amber-200">
            {queue.map((item: any) => (
              <div 
                key={item.id} 
                className={cls(
                  'flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer transition-colors',
                  selectedQueueItems.includes(item.id) ? 'bg-amber-100' : 'hover:bg-amber-100/50'
                )}
                onClick={() => toggleQueueItem(item.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedQueueItems.includes(item.id)}
                  onChange={() => {}}
                  className="w-4 h-4 rounded border-amber-300"
                />
                <div className="flex-1">
                  <div className="font-medium text-corp-text-dark">{item.product_name}</div>
                  <div className="text-xs text-corp-text-muted">
                    SKU: {item.sku} • {item.order_number || 'Без замовлення'} • {item.condition}
                  </div>
                </div>
                <div className="text-xs text-corp-text-muted">
                  {new Date(item.created_at).toLocaleDateString('uk-UA')}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveFromQueue(item.id); }}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Видалити з черги"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBatchModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-corp-text-dark mb-4">
              📦 Створити партію ({selectedQueueItems.length} товарів)
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-corp-text-muted mb-1">Хімчистка *</label>
                <input
                  type="text"
                  value={batchForm.laundry_company}
                  onChange={e => setBatchForm({...batchForm, laundry_company: e.target.value})}
                  placeholder="Назва компанії хімчистки"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-corp-text-muted mb-1">Очікувана дата повернення *</label>
                <input
                  type="date"
                  value={batchForm.expected_return_date}
                  onChange={e => setBatchForm({...batchForm, expected_return_date: e.target.value})}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-corp-text-muted mb-1">Вартість (грн)</label>
                <input
                  type="number"
                  value={batchForm.cost}
                  onChange={e => setBatchForm({...batchForm, cost: e.target.value})}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-corp-text-muted mb-1">Примітки</label>
                <textarea
                  value={batchForm.notes}
                  onChange={e => setBatchForm({...batchForm, notes: e.target.value})}
                  placeholder="Додаткова інформація..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 h-20"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleCreateBatch} className="flex-1 corp-btn corp-btn-primary">
                ✅ Створити
              </button>
              <button onClick={() => setShowBatchModal(false)} className="corp-btn corp-btn-secondary">
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="corp-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-corp-text-muted mb-1">Всього партій</p>
                <p className="text-2xl font-bold text-corp-text-dark">{statistics.total_batches}</p>
              </div>
              <Package className="w-10 h-10 text-corp-primary opacity-50" />
            </div>
          </div>
          <div className="corp-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-corp-text-muted mb-1">Активні партії</p>
                <p className="text-2xl font-bold text-amber-600">{statistics.active_batches}</p>
              </div>
              <Clock className="w-10 h-10 text-amber-500 opacity-50" />
            </div>
          </div>
          <div className="corp-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-corp-text-muted mb-1">Відправлено товарів</p>
                <p className="text-2xl font-bold text-corp-gold">{statistics.total_items_sent}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-corp-gold opacity-50" />
            </div>
          </div>
          <div className="corp-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-corp-text-muted mb-1">Вартість</p>
                <p className="text-2xl font-bold text-emerald-600">{statistics.total_cost?.toFixed(2) || 0} ₴</p>
              </div>
              <CheckCircle2 className="w-10 h-10 text-emerald-500 opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          {['all', 'sent', 'partial_return', 'returned', 'completed'].map(status => (
            <button
              key={status}
              className={cls(
                'corp-btn',
                filterStatus === status ? 'corp-btn-primary' : 'corp-btn-secondary'
              )}
              onClick={() => setFilterStatus(status)}
            >
              {status === 'all' ? 'Всі' :
               status === 'sent' ? 'Відправлено' :
               status === 'partial_return' ? 'Часткове' :
               status === 'returned' ? 'Повернено' : 'Закрито'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="corp-btn corp-btn-secondary">
            <RefreshCw className="w-4 h-4" /> Оновити
          </button>
          <button onClick={() => setShowCreateModal(true)} className="corp-btn corp-btn-primary">
            <Plus className="w-4 h-4" /> Нова партія
          </button>
        </div>
      </div>

      {/* Batches List */}
      <div className="space-y-4">
        {batches.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-corp-text-dark mb-2">Партій не знайдено</h3>
            <p className="text-sm text-corp-text-muted">
              Створіть нову партію для відправки текстилю в хімчистку
            </p>
          </div>
        ) : (
          batches.map((batch: any) => (
            <div key={batch.id} className="corp-card">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-corp-text-dark">{batch.batch_number}</h3>
                  <p className="text-sm text-corp-text-muted mt-1">🏢 {batch.laundry_company}</p>
                </div>
                <div className="text-right">
                  {getStatusBadge(batch.status)}
                  {batch.cost > 0 && (
                    <p className="text-sm font-medium text-corp-gold mt-2">{batch.cost.toFixed(2)} ₴</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pb-4 border-b border-corp-border-light">
                <div>
                  <p className="text-xs text-corp-text-muted uppercase mb-1">📅 Відправлено</p>
                  <p className="font-medium text-corp-text-dark">
                    {new Date(batch.sent_date).toLocaleDateString('uk-UA')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-corp-text-muted uppercase mb-1">📆 Очікується</p>
                  <p className="font-medium text-corp-text-dark">
                    {new Date(batch.expected_return_date).toLocaleDateString('uk-UA')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-corp-text-muted uppercase mb-1">📦 Товарів</p>
                  <p className="font-medium text-corp-text-dark mb-2">{batch.returned_items} / {batch.total_items}</p>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className="bg-corp-primary h-2 rounded-full" 
                      style={{ width: `${(batch.returned_items / batch.total_items) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setSelectedBatch(batch); setShowReturnModal(true); }}
                  className="corp-btn corp-btn-secondary text-sm"
                >
                  📥 Прийняти товари
                </button>
                {batch.status !== 'completed' && (
                  <button
                    onClick={() => onCompleteBatch(batch.id)}
                    className="corp-btn corp-btn-primary text-sm"
                  >
                    ✅ Закрити партію
                  </button>
                )}
                <button
                  onClick={() => onDeleteBatch(batch.id)}
                  className="corp-btn corp-btn-secondary text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" /> Видалити
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
/*************** Send To Client Modal ***************/
function SendToClientModal({
  damageCase,
  onClose,
  onSuccess,
}: {
  damageCase: DamageCase
  onClose: () => void
  onSuccess: (method: 'email' | 'callbell') => void
}) {
  const [selectedMethod, setSelectedMethod] = useState<'email' | 'callbell'>('email')

  const handleSend = async () => {
    if (selectedMethod === 'email') {
      // TODO: Інтеграція з Email
      onSuccess('email')
    } else {
      // TODO: Інтеграція з CallBell
      alert('⚠️ Інтеграція з CallBell ще не налаштована')
      onSuccess('callbell')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-md m-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-corp-text-dark mb-4">📧 Відправити клієнту</h3>
        
        <div className="space-y-3 mb-6">
          <div 
            className={cls(
              "p-4 rounded-xl border-2 cursor-pointer transition",
              selectedMethod === 'email' 
                ? "border-blue-500 bg-blue-50" 
                : "border-slate-200 hover:border-slate-300"
            )}
            onClick={() => setSelectedMethod('email')}
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">📧</div>
              <div>
                <div className="font-semibold text-corp-text-dark">Email (Лист)</div>
                <div className="text-sm text-corp-text-main">Відправити на email клієнта</div>
              </div>
            </div>
          </div>

          <div 
            className={cls(
              "p-4 rounded-xl border-2 cursor-pointer transition",
              selectedMethod === 'callbell' 
                ? "border-green-500 bg-green-50" 
                : "border-slate-200 hover:border-slate-300"
            )}
            onClick={() => setSelectedMethod('callbell')}
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">💬</div>
              <div>
                <div className="font-semibold text-corp-text-dark">CallBell</div>
                <div className="text-sm text-corp-text-main">Через бот і месенджери</div>
                <div className="text-xs text-amber-600 mt-1">⚠️ Інтеграція в розробці</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSend}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700"
          >
            Відправити
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Скасувати
          </button>
        </div>
      </div>
    </div>
  )
}

/*************** Create Task Modal ***************/
function CreateTaskFromDamageModal({
  damageCase,
  onClose,
  onSuccess,
}: {
  damageCase: DamageCase
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    title: `Реставрація - ${damageCase.clientName}`,
    description: `Реставрація пошкоджених позицій з кейсу ${damageCase.id}\n\n` +
      `Кількість позицій: ${(damageCase.lines || []).length}\n` +
      `Загальна сума шкоди: ₴${(damageCase.lines || []).reduce((sum, l) => sum + l.total, 0)}`,
    priority: 'high' as 'low' | 'medium' | 'high',
    assigned_to: '',
    due_date: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          task_type: 'restoration',
          damage_id: damageCase.id,
          status: 'todo',
          due_date: formData.due_date ? new Date(formData.due_date).toISOString() : undefined,
        }),
      })

      if (!response.ok) throw new Error('Failed to create task')
      onSuccess()
    } catch (error) {
      console.error('Error creating task:', error)
      alert('Помилка створення завдання')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-xl m-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-corp-text-dark">🔧 Створити завдання на реставрацію</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-corp-text-main text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700 mb-1">Назва завдання</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-700 mb-1">Опис</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={5}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-700 mb-1">Пріоритет</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="low">Низький</option>
                <option value="medium">Середній</option>
                <option value="high">Високий</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-700 mb-1">Виконавець</label>
              <input
                type="text"
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ім'я виконавця"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-700 mb-1">Термін виконання</label>
            <input
              type="datetime-local"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="flex-1 bg-emerald-600 text-white rounded-lg py-2 font-medium hover:bg-emerald-700 transition"
            >
              ✅ Створити завдання
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 bg-slate-200 text-slate-700 rounded-lg py-2 font-medium hover:bg-slate-300 transition"
            >
              Скасувати
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
