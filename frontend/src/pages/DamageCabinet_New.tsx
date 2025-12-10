/* eslint-disable */
/**
 * Damage Cabinet - Кабінет Шкоди
 * Корпоративний стиль, без емодзі
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import MobileLayout from '../components/MobileLayout'

const API_URL = process.env.REACT_APP_BACKEND_URL

type TabType = 'main' | 'wash' | 'restoration' | 'laundry'

interface DamageCase {
  order_id: number
  order_number: string
  items_count: number
  total_fee: number
  latest_damage: string
  processing_types: string[]
  first_damage: string
}

interface DamageItem {
  id: string
  product_id: number
  sku: string
  product_name: string
  category: string
  order_id: number
  order_number: string
  damage_type: string
  severity: string
  fee: number
  photo_url: string | null
  note: string | null
  processing_status: string
  processing_type?: string
  sent_to_processing_at: string | null
  returned_from_processing_at: string | null
  processing_notes: string | null
  product_image: string | null
  laundry_batch_id?: string | null
  laundry_company?: string | null
  batch_status?: string | null
  created_at: string
  created_by: string
}

export default function DamageCabinetNew() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('main')
  const [loading, setLoading] = useState(false)
  
  const [damageCases, setDamageCases] = useState<DamageCase[]>([])
  const [washItems, setWashItems] = useState<DamageItem[]>([])
  const [restorationItems, setRestorationItems] = useState<DamageItem[]>([])
  const [laundryItems, setLaundryItems] = useState<DamageItem[]>([])
  
  const [selectedCase, setSelectedCase] = useState<number | null>(null)
  const [caseDetails, setCaseDetails] = useState<DamageItem[]>([])

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'main') {
        const res = await axios.get(`${API_URL}/api/product-damage-history/cases/grouped`)
        setDamageCases(res.data.cases || [])
      } else if (activeTab === 'wash') {
        const res = await axios.get(`${API_URL}/api/product-damage-history/processing/wash`)
        setWashItems(res.data.items || [])
      } else if (activeTab === 'restoration') {
        const res = await axios.get(`${API_URL}/api/product-damage-history/processing/restoration`)
        setRestorationItems(res.data.items || [])
      } else if (activeTab === 'laundry') {
        const res = await axios.get(`${API_URL}/api/product-damage-history/processing/laundry`)
        setLaundryItems(res.data.items || [])
      }
    } catch (error) {
      console.error('Помилка завантаження:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCaseDetails = async (orderId: number) => {
    try {
      const res = await axios.get(`${API_URL}/api/product-damage-history/cases/${orderId}/details`)
      setCaseDetails(res.data.items || [])
      setSelectedCase(orderId)
    } catch (error) {
      console.error('Помилка завантаження деталей:', error)
    }
  }

  const sendToWash = async (damageId: string) => {
    try {
      await axios.post(`${API_URL}/api/product-damage-history/${damageId}/send-to-wash`, {
        notes: 'Відправлено на мийку'
      })
      alert('Товар відправлено на мийку')
      loadData()
      if (selectedCase) loadCaseDetails(selectedCase)
    } catch (error) {
      console.error('Помилка:', error)
      alert('Помилка відправлення')
    }
  }

  const sendToRestoration = async (damageId: string) => {
    try {
      await axios.post(`${API_URL}/api/product-damage-history/${damageId}/send-to-restoration`, {
        notes: 'Відправлено в реставрацію'
      })
      alert('Товар відправлено в реставрацію')
      loadData()
      if (selectedCase) loadCaseDetails(selectedCase)
    } catch (error) {
      console.error('Помилка:', error)
      alert('Помилка відправлення')
    }
  }

  const sendToLaundry = async (damageId: string) => {
    const company = prompt('Назва хімчистки:', 'Хімчистка №1')
    if (!company) return
    
    try {
      await axios.post(`${API_URL}/api/product-damage-history/${damageId}/send-to-laundry`, {
        laundry_company: company,
        notes: 'Відправлено в хімчистку'
      })
      alert('Товар відправлено в хімчистку')
      loadData()
      if (selectedCase) loadCaseDetails(selectedCase)
    } catch (error) {
      console.error('Помилка:', error)
      alert('Помилка відправлення')
    }
  }

  const completeProcessing = async (damageId: string) => {
    try {
      await axios.post(`${API_URL}/api/product-damage-history/${damageId}/complete-processing`, {
        notes: 'Повернуто на склад'
      })
      alert('Обробку завершено')
      loadData()
    } catch (error) {
      console.error('Помилка:', error)
      alert('Помилка')
    }
  }

  const markFailed = async (damageId: string) => {
    const reason = prompt('Причина невдачі:')
    if (!reason) return
    
    try {
      await axios.post(`${API_URL}/api/product-damage-history/${damageId}/mark-failed`, {
        notes: reason
      })
      alert('Позначено як невдалу обробку')
      loadData()
    } catch (error) {
      console.error('Помилка:', error)
      alert('Помилка')
    }
  }

  return (
    <MobileLayout currentPage="Кабінет Шкоди">
      <div className="min-h-screen bg-corp-bg-page font-montserrat">
        {/* Header */}
        <header className="corp-header sticky top-0 z-30">
          <div className="mx-auto max-w-7xl flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-corp-primary grid place-content-center text-white font-bold text-sm">ШК</div>
              <div>
                <h1 className="text-lg font-semibold text-corp-text-dark">Кабінет Шкоди</h1>
                <p className="text-xs text-corp-text-muted">Управління пошкодженнями</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/manager-dashboard')}
              className="ml-auto corp-button-secondary"
            >
              Назад
            </button>
          </div>
        </header>

        {/* Tabs */}
        <section className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            <TabButton active={activeTab === 'main'} onClick={() => setActiveTab('main')}>
              Головна
            </TabButton>
            <TabButton active={activeTab === 'wash'} onClick={() => setActiveTab('wash')}>
              Мийка
            </TabButton>
            <TabButton active={activeTab === 'restoration'} onClick={() => setActiveTab('restoration')}>
              Реставрація
            </TabButton>
            <TabButton active={activeTab === 'laundry'} onClick={() => setActiveTab('laundry')}>
              Хімчистка
            </TabButton>
          </div>
        </section>

        {/* Content */}
        <main className="mx-auto max-w-7xl px-6 py-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Завантаження...</div>
          ) : (
            <>
              {activeTab === 'main' && (
                <MainTab 
                  cases={damageCases} 
                  selectedCase={selectedCase}
                  caseDetails={caseDetails}
                  onSelectCase={loadCaseDetails}
                  onCloseDetails={() => setSelectedCase(null)}
                  onSendToWash={sendToWash}
                  onSendToRestoration={sendToRestoration}
                  onSendToLaundry={sendToLaundry}
                />
              )}
              
              {activeTab === 'wash' && (
                <ProcessingTab 
                  items={washItems}
                  type="wash"
                  onComplete={completeProcessing}
                  onMarkFailed={markFailed}
                />
              )}
              
              {activeTab === 'restoration' && (
                <ProcessingTab 
                  items={restorationItems}
                  type="restoration"
                  onComplete={completeProcessing}
                  onMarkFailed={markFailed}
                />
              )}
              
              {activeTab === 'laundry' && (
                <LaundryTab 
                  items={laundryItems}
                  onComplete={completeProcessing}
                  onMarkFailed={markFailed}
                />
              )}
            </>
          )}
        </main>
      </div>
    </MobileLayout>
  )
}

// ============ COMPONENTS ============

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap
        ${active 
          ? 'bg-corp-primary text-white shadow-lg' 
          : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-corp-primary'
        }
      `}
    >
      {children}
    </button>
  )
}

function Kpi({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-corp-border bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-1 text-sm font-medium text-corp-text-muted">{title}</div>
      <div className="mb-1 text-2xl font-bold text-corp-text-dark">{value}</div>
      {note && <div className="text-xs text-corp-text-muted">{note}</div>}
    </div>
  )
}

function MainTab({ 
  cases, 
  selectedCase,
  caseDetails,
  onSelectCase,
  onCloseDetails,
  onSendToWash,
  onSendToRestoration,
  onSendToLaundry
}: {
  cases: DamageCase[]
  selectedCase: number | null
  caseDetails: DamageItem[]
  onSelectCase: (orderId: number) => void
  onCloseDetails: () => void
  onSendToWash: (id: string) => void
  onSendToRestoration: (id: string) => void
  onSendToLaundry: (id: string) => void
}) {
  if (selectedCase && caseDetails.length > 0) {
    return (
      <div>
        <button 
          onClick={onCloseDetails}
          className="mb-4 corp-button-secondary"
        >
          ← Назад до списку
        </button>
        
        <div className="rounded-2xl border border-corp-border bg-white p-6 shadow-lg mb-6">
          <h2 className="text-2xl font-bold text-corp-text-dark mb-2">Замовлення {caseDetails[0].order_number}</h2>
          <div className="flex gap-4 text-sm text-corp-text-muted">
            <span>Товарів: {caseDetails.length}</span>
            <span>Загальна сума: ₴{caseDetails.reduce((sum, item) => sum + item.fee, 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-4">
          {caseDetails.map(item => (
            <DamageItemCard
              key={item.id}
              item={item}
              onSendToWash={onSendToWash}
              onSendToRestoration={onSendToRestoration}
              onSendToLaundry={onSendToLaundry}
            />
          ))}
        </div>
      </div>
    )
  }

  if (cases.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 p-12 text-center">
        <div className="text-6xl mb-4 text-slate-300">✓</div>
        <div className="text-xl text-corp-text-muted">Немає активних кейсів шкоди</div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cases.map(caseItem => (
        <DamageCaseCard 
          key={caseItem.order_id} 
          caseData={caseItem}
          onClick={() => onSelectCase(caseItem.order_id)}
        />
      ))}
    </div>
  )
}

function DamageCaseCard({ caseData, onClick }: { caseData: DamageCase; onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="rounded-2xl border-2 border-corp-border bg-white p-5 shadow-sm hover:shadow-xl hover:border-corp-primary transition-all cursor-pointer"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-xs text-corp-text-muted mb-1">Замовлення</div>
          <div className="font-bold text-lg text-corp-primary">{caseData.order_number}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-red-600">₴{caseData.total_fee.toLocaleString()}</div>
          <div className="text-xs text-corp-text-muted">{caseData.items_count} поз.</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {caseData.processing_types.map(type => (
          <ProcessingBadge key={type} type={type} />
        ))}
      </div>

      <div className="text-xs text-corp-text-muted">
        {new Date(caseData.latest_damage).toLocaleString('uk-UA')}
      </div>
    </div>
  )
}

function DamageItemCard({ 
  item, 
  onSendToWash,
  onSendToRestoration,
  onSendToLaundry
}: {
  item: DamageItem
  onSendToWash: (id: string) => void
  onSendToRestoration: (id: string) => void
  onSendToLaundry: (id: string) => void
}) {
  const imageUrl = item.product_image || item.photo_url || '/placeholder.png'
  const processingType = item.processing_type || 'none'
  
  return (
    <div className="rounded-2xl border-2 border-corp-border bg-white p-5 shadow-sm">
      <div className="flex gap-4 mb-4">
        <img 
          src={imageUrl}
          alt={item.product_name}
          className="w-24 h-24 object-cover rounded-lg"
        />
        
        <div className="flex-1">
          <h3 className="font-bold text-lg text-corp-text-dark mb-1">{item.product_name}</h3>
          <div className="text-sm text-corp-text-muted mb-2">SKU: {item.sku}</div>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={item.severity} />
            <span className="text-sm text-corp-text-muted">{item.damage_type}</span>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-red-600">₴{item.fee.toLocaleString()}</div>
        </div>
      </div>

      {item.note && (
        <div className="bg-corp-bg-light rounded-lg p-3 mb-4 text-sm border border-corp-border">
          <div className="text-corp-text-muted mb-1">Примітка:</div>
          <div className="text-corp-text-dark">{item.note}</div>
        </div>
      )}

      {processingType === 'none' && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onSendToWash(item.id)}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-medium text-sm transition-colors"
          >
            На мийку
          </button>
          <button
            onClick={() => onSendToRestoration(item.id)}
            className="flex-1 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-xl font-medium text-sm transition-colors"
          >
            Реставрація
          </button>
          <button
            onClick={() => onSendToLaundry(item.id)}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-xl font-medium text-sm transition-colors"
          >
            Хімчистка
          </button>
        </div>
      )}

      {processingType !== 'none' && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
          <ProcessingBadge type={processingType} />
          <div className="text-sm text-corp-text-muted mt-2">
            Статус: {item.processing_status}
          </div>
        </div>
      )}
    </div>
  )
}

function ProcessingTab({ 
  items, 
  type,
  onComplete,
  onMarkFailed
}: {
  items: DamageItem[]
  type: 'wash' | 'restoration'
  onComplete: (id: string) => void
  onMarkFailed: (id: string) => void
}) {
  const title = type === 'wash' ? 'Мийка' : 'Реставрація'
  
  const pending = items.filter(i => i.processing_status === 'pending')
  const inProgress = items.filter(i => i.processing_status === 'in_progress')
  const completed = items.filter(i => i.processing_status === 'completed')
  const failed = items.filter(i => i.processing_status === 'failed')

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-corp-border bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-corp-text-dark mb-4">{title}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi title="Очікують" value={pending.length.toString()} />
          <Kpi title="В обробці" value={inProgress.length.toString()} />
          <Kpi title="Готово" value={completed.length.toString()} />
          <Kpi title="Невдалі" value={failed.length.toString()} />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-corp-text-muted">Немає товарів</div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <ProcessingItemCard
              key={item.id}
              item={item}
              onComplete={onComplete}
              onMarkFailed={onMarkFailed}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProcessingItemCard({
  item,
  onComplete,
  onMarkFailed
}: {
  item: DamageItem
  onComplete: (id: string) => void
  onMarkFailed: (id: string) => void
}) {
  const imageUrl = item.product_image || item.photo_url || '/placeholder.png'
  
  return (
    <div className="rounded-2xl border-2 border-corp-border bg-white p-5 shadow-sm">
      <div className="flex gap-4">
        <img 
          src={imageUrl}
          alt={item.product_name}
          className="w-24 h-24 object-cover rounded-lg"
        />
        
        <div className="flex-1">
          <h3 className="font-bold text-lg text-corp-text-dark mb-1">{item.product_name}</h3>
          <div className="text-sm text-corp-text-muted mb-2">
            SKU: {item.sku} | Замовлення: {item.order_number}
          </div>
          
          <div className="flex items-center gap-2 mb-3">
            <StatusBadge status={item.processing_status} />
            {item.sent_to_processing_at && (
              <span className="text-xs text-corp-text-muted">
                Відправлено: {new Date(item.sent_to_processing_at).toLocaleDateString('uk-UA')}
              </span>
            )}
          </div>

          {item.processing_notes && (
            <div className="bg-corp-bg-light rounded p-2 text-sm mb-3 border border-corp-border">
              {item.processing_notes}
            </div>
          )}

          {item.processing_status === 'in_progress' && (
            <div className="flex gap-2">
              <button
                onClick={() => onComplete(item.id)}
                className="corp-button-primary"
              >
                Готово
              </button>
              <button
                onClick={() => onMarkFailed(item.id)}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm transition-colors"
              >
                Невдало
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LaundryTab({
  items,
  onComplete,
  onMarkFailed
}: {
  items: DamageItem[]
  onComplete: (id: string) => void
  onMarkFailed: (id: string) => void
}) {
  const batches = items.reduce((acc, item) => {
    const batchId = item.laundry_batch_id || 'unknown'
    if (!acc[batchId]) {
      acc[batchId] = []
    }
    acc[batchId].push(item)
    return acc
  }, {} as Record<string, DamageItem[]>)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-corp-border bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-corp-text-dark mb-2">Хімчистка</h2>
        <div className="text-corp-text-muted">Партій: {Object.keys(batches).length} | Товарів: {items.length}</div>
      </div>

      {Object.entries(batches).map(([batchId, batchItems]) => (
        <div key={batchId} className="rounded-2xl border border-corp-border bg-white p-6 shadow-sm">
          <div className="mb-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-corp-text-dark">Партія {batchId}</h3>
              <div className="text-sm">
                {batchItems[0]?.laundry_company && (
                  <span className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full font-medium">
                    {batchItems[0].laundry_company}
                  </span>
                )}
              </div>
            </div>
            <div className="text-sm text-corp-text-muted mt-1">
              Товарів: {batchItems.length}
            </div>
          </div>

          <div className="space-y-3">
            {batchItems.map(item => (
              <ProcessingItemCard
                key={item.id}
                item={item}
                onComplete={onComplete}
                onMarkFailed={onMarkFailed}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ProcessingBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; color: string }> = {
    wash: { label: 'Мийка', color: 'bg-blue-100 text-blue-700' },
    restoration: { label: 'Реставрація', color: 'bg-purple-100 text-purple-700' },
    laundry: { label: 'Хімчистка', color: 'bg-teal-100 text-teal-700' },
    none: { label: 'Штраф', color: 'bg-gray-100 text-gray-700' }
  }
  
  const { label, color } = config[type] || config.none
  
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${color}`}>
      {label}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { color: string }> = {
    low: { color: 'bg-yellow-100 text-yellow-700' },
    medium: { color: 'bg-orange-100 text-orange-700' },
    high: { color: 'bg-red-100 text-red-700' },
    critical: { color: 'bg-red-600 text-white' }
  }
  
  const { color } = config[severity] || config.low
  
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${color}`}>
      {severity}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    pending: { label: 'Очікує', color: 'bg-yellow-100 text-yellow-700' },
    in_progress: { label: 'В обробці', color: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Готово', color: 'bg-green-100 text-green-700' },
    failed: { label: 'Невдало', color: 'bg-red-100 text-red-700' }
  }
  
  const { label, color } = config[status] || config.pending
  
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${color}`}>
      {label}
    </span>
  )
}
