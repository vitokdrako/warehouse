import React, { useMemo, useState, useEffect } from 'react'
import ImageUpload from '../components/ImageUpload'
import CorporateHeader from '../components/CorporateHeader'
import ProductConditionPanel from '../components/ProductConditionPanel'

const cls = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')
const fmtUA = (n: number) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })
const todayISO = () => new Date().toISOString().slice(0, 10)

type AuditStatus = 'ok' | 'minor' | 'critical' | 'lost'

interface AuditItem {
  id: string
  product_id: number
  code: string
  name: string
  description?: string
  careInstructions?: string
  category: string
  categoryName?: string      // ✅ NEW: Окрема категорія для редагування
  subcategoryName?: string   // ✅ NEW: Окрема підкатегорія
  zone: string  // ✅ Єдине поле для локації (напр. "6 / A / 12")
  qty: number
  status: AuditStatus
  lastAuditDate: string
  lastAuditBy?: string
  nextAuditDate?: string
  daysFromLastAudit: number
  rentalsCount: number
  lastOrderId?: string
  damagesCount: number
  totalProfit: number
  notes?: string
  color?: string
  material?: string
  size?: string
  // ✅ NEW: Розміри окремо
  heightCm?: number
  widthCm?: number
  depthCm?: number
  diameterCm?: number
  // ✅ NEW: Форма та хештеги
  shape?: string
  hashtags?: string[]
  imageUrl?: string
  price?: number
  rentalPrice?: number
}

function Badge({ tone = 'slate', children }: { tone?: string; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    blue: 'bg-sky-100 text-sky-700 border-sky-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    red: 'bg-rose-100 text-rose-700 border-rose-200',
  }
  return (
    <span className={cls('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]', tones[tone] || tones.slate)}>
      {children}
    </span>
  )
}

function PillButton({ children, onClick, tone = 'slate' }: { children: React.ReactNode; onClick?: () => void; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-900 text-white hover:bg-slate-800',
    green: 'bg-emerald-600 text-white hover:bg-emerald-700',
    red: 'bg-rose-600 text-white hover:bg-rose-700',
    amber: 'bg-amber-500 text-corp-text-dark hover:bg-amber-600',
    ghost: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
  }
  return (
    <button type="button" onClick={onClick} className={cls('rounded-full px-3 py-1 text-[11px] font-medium transition', tones[tone])}>
      {children}
    </button>
  )
}

function StatusCell({ status }: { status: AuditStatus }) {
  if (status === 'ok') return <span className="text-emerald-700">✅ задовільний</span>
  if (status === 'minor') return <span className="text-amber-700">⚠️ потребує уваги</span>
  if (status === 'critical') return <span className="text-rose-700">❗ критично</span>
  return <span className="font-semibold text-rose-800">⛔ втрачено</span>
}

function RiskBadge({ item }: { item: AuditItem }) {
  const overdue = item.daysFromLastAudit > 180
  const manyDamages = item.damagesCount >= 3

  if (item.status === 'lost') return <Badge tone="red">Ризик: втрачено</Badge>
  if (item.status === 'critical') return <Badge tone="red">Ризик: критичний стан</Badge>
  if (overdue && manyDamages) return <Badge tone="red">Ризик: перевірити негайно</Badge>
  if (overdue) return <Badge tone="amber">Потрібен переоблік</Badge>
  if (manyDamages) return <Badge tone="amber">Часта шкода</Badge>
  return <Badge tone="green">Ризик низький</Badge>
}

interface RentalHistoryItem {
  order_id: number
  order_number: string
  client_name: string
  client_phone: string
  rent_date: string
  rent_return_date: string
  rental_days: number
  quantity: number
  total_rental: number
  deposit: number
  status: string
  created_at: string
}

export default function ReauditCabinetFull({ 
  onBackToDashboard,
  onNavigateToTasks
}: { 
  onBackToDashboard: () => void
  onNavigateToTasks?: (itemId: string) => void
}) {
  const [items, setItems] = useState<AuditItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all')
  const [subcategoryFilter, setSubcategoryFilter] = useState<'all' | string>('all')
  const [stats, setStats] = useState({ total: 0, ok: 0, minor: 0, crit: 0, lost: 0, overdueCnt: 0 })
  const [sortByAudit, setSortByAudit] = useState<'all' | 'audited' | 'notAudited' | 'critical'>('all')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<{path: string; url: string} | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [rentalHistory, setRentalHistory] = useState<RentalHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  
  // Панель журналу стану
  const [showConditionPanel, setShowConditionPanel] = useState(false)
  
  // Стан для редагування
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    code: '',
    price: 0,
    rentalPrice: 0,
    color: '',
    material: '',
    // Розміри окремо
    height: '',
    width: '',
    depth: '',
    diameter: '',
    // Категорії
    category: '',
    subcategory: '',
    // Форма та хештеги
    shape: '',
    hashtags: [] as string[],
    qty: 0,
    zone: ''
  })
  
  // Словники для автозаповнення
  const [hashtagsDict, setHashtagsDict] = useState<{tag: string; display_name: string; category: string}[]>([])
  const [shapesDict, setShapesDict] = useState<string[]>([])
  const [categoriesDict, setCategoriesDict] = useState<{name: string; count: number}[]>([])
  const [subcategoriesDict, setSubcategoriesDict] = useState<Record<string, {name: string; count: number}[]>>({})
  const [newHashtag, setNewHashtag] = useState('')

  // Стан для пошкоджень
  const [showDamageForm, setShowDamageForm] = useState(false)
  const [damageData, setDamageData] = useState({
    description: '',
    severity: 'minor',
    estimated_cost: 0,
    create_damage_case: false,
    photo_url: '',
    action_type: 'restoration',
    qty: 1
  })
  const [damages, setDamages] = useState<any[]>([])
  
  // Категорії та підкатегорії з API
  const [categories, setCategories] = useState<string[]>([])
  const [subcategoriesMap, setSubcategoriesMap] = useState<Record<string, string[]>>({})
  
  // Стан для форми створення нового товару
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  // Use backend URL from environment
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

  const loadItems = async (overrideFilters?: { category?: string; subcategory?: string; search?: string; statusFilter?: string }) => {
    console.log('[ReauditCabinet] BACKEND_URL:', BACKEND_URL)
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const searchQuery = overrideFilters?.search !== undefined ? overrideFilters.search : q
      const catFilter = overrideFilters?.category !== undefined ? overrideFilters.category : categoryFilter
      const subcatFilter = overrideFilters?.subcategory !== undefined ? overrideFilters.subcategory : subcategoryFilter
      const statFilter = overrideFilters?.statusFilter !== undefined ? overrideFilters.statusFilter : sortByAudit
      
      if (searchQuery) params.append('q', searchQuery)
      if (catFilter !== 'all') params.append('category', catFilter)
      if (subcatFilter !== 'all') params.append('subcategory', subcatFilter)
      
      // Передаємо статус фільтр на бекенд
      if (statFilter === 'critical') {
        params.append('status_filter', 'critical')
      } else if (statFilter === 'notAudited') {
        params.append('status_filter', 'needs_recount')
      }
      
      const response = await fetch(`${BACKEND_URL}/api/audit/items?${params}`)
      const data = await response.json()
      
      // API повертає масив напряму, а не об'єкт з полем items
      const itemsList = Array.isArray(data) ? data : (data.items || [])
      
      setItems(itemsList)
      if (itemsList.length > 0 && !selectedId) {
        setSelectedId(itemsList[0].id)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/audit/stats`)
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  // Завантаження словників для редагування
  const loadDictionaries = async () => {
    try {
      // Хештеги
      const hashRes = await fetch(`${BACKEND_URL}/api/audit/hashtags`)
      const hashData = await hashRes.json()
      setHashtagsDict(hashData.hashtags || [])
      
      // Форми
      const shapeRes = await fetch(`${BACKEND_URL}/api/audit/shapes`)
      const shapeData = await shapeRes.json()
      setShapesDict((shapeData.shapes || []).map((s: any) => s.shape))
      
      // Категорії
      const catRes = await fetch(`${BACKEND_URL}/api/audit/categories-list`)
      const catData = await catRes.json()
      setCategoriesDict(catData.categories || [])
      setSubcategoriesDict(catData.subcategories_by_category || {})
    } catch (e) {
      console.error('Error loading dictionaries:', e)
    }
  }

  const loadRentalHistory = async (itemId: string) => {
    setLoadingHistory(true)
    try {
      const response = await fetch(`${BACKEND_URL}/api/audit/items/${itemId}/rental-history`)
      const data = await response.json()
      setRentalHistory(data)
    } catch (e) {
      console.error('Error loading rental history:', e)
      setRentalHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const loadDamages = async (itemId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/audit/items/${itemId}/damages`)
      const data = await response.json()
      setDamages(data)
    } catch (e) {
      console.error('Error loading damages:', e)
      setDamages([])
    }
  }

  const loadCategories = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/audit/categories`)
      const data = await response.json()
      const totalSubcats = Object.values(data.subcategories || {}).reduce((sum: number, arr: any) => sum + arr.length, 0)
      console.log('[ReauditCabinet] Categories loaded:', data.categories?.length, 'main categories |', totalSubcats, 'total subcategories |', Object.keys(data.subcategories || {}).length, 'categories with subcategories')
      setCategories(data.categories || [])
      setSubcategoriesMap(data.subcategories || {})
    } catch (e) {
      console.error('Error loading categories:', e)
      setCategories([])
      setSubcategoriesMap({})
    }
  }

  useEffect(() => {
    loadItems()
    loadStats()
    loadCategories()
    loadDictionaries()  // ✅ Завантажити словники
  }, [q, categoryFilter, subcategoryFilter])

  // Перезавантажити при зміні фільтра статусу
  useEffect(() => {
    if (sortByAudit === 'critical' || sortByAudit === 'notAudited') {
      loadItems({ statusFilter: sortByAudit })
    } else {
      loadItems()
    }
  }, [sortByAudit])

  useEffect(() => {
    if (selectedId) {
      loadRentalHistory(selectedId)
      loadDamages(selectedId)
    }
  }, [selectedId])

  const selected = useMemo(() => {
    if (!selectedId) return items[0] || null
    return items.find((i) => i.id === selectedId) || items[0] || null
  }, [items, selectedId])

  const filtered = useMemo(() => {
    return items.filter((it) => {
      const okCategory = categoryFilter === 'all' || it.category?.includes(categoryFilter)
      const okSubcategory = subcategoryFilter === 'all' || it.category?.includes(subcategoryFilter)
      
      // Фільтр по статусу переобліку
      let okAudit = true
      if (sortByAudit === 'audited') {
        // Переоблікований = дата останнього переобліку є і не більше 180 днів
        okAudit = Boolean(it.lastAuditDate && it.daysFromLastAudit <= 180)
      } else if (sortByAudit === 'notAudited') {
        // Не переоблікований = немає дати або більше 180 днів
        okAudit = Boolean(!it.lastAuditDate || it.daysFromLastAudit > 180)
      } else if (sortByAudit === 'critical') {
        // Критичний - статус critical з бази
        okAudit = it.status === 'critical'
      }
      
      return okCategory && okSubcategory && okAudit
    })
  }, [items, categoryFilter, subcategoryFilter, sortByAudit])

  // Підкатегорії для обраної категорії
  const subcategories = useMemo(() => {
    if (categoryFilter === 'all') return []
    return subcategoriesMap[categoryFilter] || []
  }, [categoryFilter, subcategoriesMap])

  const overdue = filtered.filter((i) => i.daysFromLastAudit > 180)
  const critical = filtered.filter((i) => i.status === 'critical' || i.status === 'lost')

  const uploadImage = async (file: File) => {
    try {
      setUploadingImage(true)
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(`${BACKEND_URL}/api/products/upload-image`, {
        method: 'POST',
        body: formData
      })
      
      const result = await response.json()
      
      if (response.ok) {
        setUploadedImage({ path: result.path, url: result.url })
        return result.path
      } else {
        throw new Error(result.detail || 'Помилка завантаження')
      }
    } catch (error) {
      alert('Помилка завантаження фото: ' + String(error))
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  const createNewProduct = async (formData: any) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/products/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          image: uploadedImage?.path || '',
          created_by: 'Реквізитор'
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        alert(`✅ ${result.message}`)
        setShowCreateForm(false)
        setUploadedImage(null)
        setSelectedCategory('')
        
        // Встановити фільтр на категорію створеного товару і перезавантажити
        const newCategory = formData.category || 'all'
        const newSubcategory = formData.subcategory || 'all'
        
        setCategoryFilter(newCategory)
        setSubcategoryFilter(newSubcategory)
        setQ('')
        
        // Завантажити items з новими фільтрами
        await loadItems({
          category: newCategory,
          subcategory: newSubcategory,
          search: ''
        })
        
        // Відкрити створений товар
        if (result.item_id) {
          setSelectedId(result.item_id)
        }
      } else {
        throw new Error(result.detail || 'Помилка створення')
      }
    } catch (error) {
      alert('Помилка створення товару: ' + String(error))
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      params.append('category', categoryFilter)
      params.append('subcategory', subcategoryFilter)
      if (q) params.append('q', q)
      
      const response = await fetch(`${BACKEND_URL}/api/audit/export?${params}`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Переоблік_${new Date().toISOString().slice(0, 10)}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        alert('✅ Файл експортовано успішно!')
      } else {
        throw new Error('Помилка експорту')
      }
    } catch (error) {
      console.error('Export error:', error)
      alert('❌ Помилка експорту: ' + String(error))
    }
  }
  
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(`${BACKEND_URL}/api/audit/import`, {
        method: 'POST',
        body: formData
      })
      
      const result = await response.json()
      
      if (response.ok) {
        alert(
          `✅ ${result.message}\n\n` +
          `Оновлено: ${result.updated}\n` +
          `Створено: ${result.created}\n` +
          (result.errors.length > 0 ? `\nПомилки:\n${result.errors.join('\n')}` : '')
        )
        await loadItems()
        await loadStats()
      } else {
        throw new Error(result.detail || 'Помилка імпорту')
      }
    } catch (error) {
      console.error('Import error:', error)
      alert('❌ Помилка імпорту: ' + String(error))
    }
    
    // Скинути input
    event.target.value = ''
  }

  const markCategoryAsAudited = async () => {
    if (categoryFilter === 'all') {
      alert('Оберіть конкретну категорію, щоб зафіксувати переоблік.')
      return
    }
    
    const confirm = window.confirm(
      `Зафіксувати переоблік для категорії "${categoryFilter}"${subcategoryFilter !== 'all' ? ` · ${subcategoryFilter}` : ''}?\n\n` +
      `Всі товари в цій категорії будуть позначені як переоблікені.`
    )
    
    if (!confirm) return
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/audit/mark-category-audited`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: categoryFilter,
          subcategory: subcategoryFilter !== 'all' ? subcategoryFilter : null,
          audited_by: 'Менеджер'
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        alert(`✅ ${result.message}\nПереоблікено товарів: ${result.updated_count}`)
        await loadItems()
        await loadStats()
      } else {
        throw new Error(result.detail || 'Помилка')
      }
    } catch (error) {
      console.error('Error marking category:', error)
      alert('❌ Помилка фіксації переобліку: ' + String(error))
    }
  }

  const markZoneAsAudited = () => {
    alert('Мок: зона позначена як переоблікована.')
  }

  const markItemAudited = async (item: AuditItem) => {
    const days = prompt('Наступний переоблік через (днів)?', '180')
    
    try {
      // Використовуємо НОВИЙ робочий endpoint
      const response = await fetch(`${BACKEND_URL}/api/audit/items/${item.id}/mark-as-audited`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audited_by: 'Реквізитор',
          audit_status: 'ok',
          notes: 'Переоблік проведено',
          next_audit_days: days || '180'
        })
      })
      
      const data = await response.json()
      if (data.success) {
        // Оновити локально дані товару
        const today = new Date().toISOString().split('T')[0]
        const nextDate = new Date()
        nextDate.setDate(nextDate.getDate() + parseInt(days || '180'))
        const nextDateStr = nextDate.toISOString().split('T')[0]
        
        setItems(prevItems => prevItems.map(i => 
          i.id === item.id 
            ? { ...i, lastAuditDate: today, lastAuditBy: 'Реквізитор', nextAuditDate: nextDateStr, daysFromLastAudit: 0 }
            : i
        ))
        
        alert('✅ Переоблік зафіксовано!')
        // Також перезавантажити для sync з backend
        loadItems()
      }
    } catch (error) {
      alert('❌ Помилка')
    }
  }

  const totalProfit = items.reduce((s, i) => s + i.totalProfit, 0)

  if (!selected && !loading) {
    return <div className="p-6 text-sm text-corp-text-main">Немає даних для переобліку.</div>
  }

  return (
    <div className="min-h-screen bg-corp-bg-page font-montserrat">
      <CorporateHeader 
        cabinetName="Кабінет переобліку" 
        showBackButton={true}
        onBackClick={onBackToDashboard}
      />
      
      <div className="mx-auto max-w-7xl px-6 py-4">
        {/* Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-sm text-corp-text-muted">
            Контроль стану декору, циклу використання та ризиків
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <PillButton tone="green" onClick={handleExport}>
              Експорт в Excel
            </PillButton>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                className="hidden"
              />
              <PillButton tone="blue" onClick={() => {}}>
                Імпорт з Excel
              </PillButton>
            </label>
          </div>
        </div>
      </div>
      
      <div className="mx-auto max-w-7xl px-6 pb-6 space-y-5">

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-5 text-[11px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="text-corp-text-muted">Позицій в аудиті</div>
          <div className="mt-1 text-xl font-semibold">{stats.total}</div>
          <div className="mt-1 text-slate-400">зараз у вибірці</div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-emerald-700">✅ Переоблікавані</div>
          <div className="mt-1 text-xl font-semibold">{stats.ok}</div>
          <div className="mt-0.5 text-xs text-emerald-600">Переобліковані протягом 180 днів</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <div className="text-amber-700">⏰ Потребують переобліку</div>
          <div className="mt-1 text-xl font-semibold">{stats.minor}</div>
          <div className="mt-0.5 text-xs text-amber-600">Непереоблікені або прострочені</div>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
          <div className="text-rose-700">⚠️ Критичні (шкоди)</div>
          <div className="mt-1 text-xl font-semibold">{stats.crit}</div>
          <div className="mt-0.5 text-xs text-rose-600">Товари з активними шкодами</div>
        </div>
      </div>

      {/* main grid */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.25fr),minmax(0,1.75fr)]">
        {/* left: list & filters */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 text-[11px] space-y-3">
            {/* Пошукова строка окремо */}
            <div>
              <label className="block text-corp-text-muted font-medium mb-1">🔍 Пошук</label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Назва, код, категорія, зона..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            
            {/* Фільтри в окремому рядку */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-corp-text-muted font-medium mb-1">Категорія</label>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value)
                    setSubcategoryFilter('all')
                  }}
                >
                  <option value="all">Усі категорії</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-corp-text-muted font-medium mb-1">Підкатегорія</label>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:bg-slate-100 disabled:text-slate-400"
                  value={subcategoryFilter}
                  onChange={(e) => setSubcategoryFilter(e.target.value)}
                  disabled={categoryFilter === 'all' || subcategories.length === 0}
                >
                  <option value="all">Усі підкатегорії</option>
                  {subcategories.map((subcat: string) => (
                    <option key={subcat} value={subcat}>
                      {subcat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-corp-text-muted font-medium mb-1">Статус</label>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                  value={sortByAudit}
                  onChange={(e) => setSortByAudit(e.target.value as any)}
                >
                  <option value="all">Усі</option>
                  <option value="audited">✅ Переоблікований</option>
                  <option value="notAudited">⏰ Не переоблікований</option>
                  <option value="critical">🔴 Критичний</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-corp-text-muted">
                У вибірці: <span className="font-semibold text-corp-text-dark">{filtered.length}</span> позицій
              </div>
              <PillButton tone="ghost" onClick={markCategoryAsAudited}>
                ✅ Зафіксувати переоблік категорії
              </PillButton>
              <PillButton tone="green" onClick={() => setShowCreateForm(true)}>
                ➕ Новий товар
              </PillButton>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden text-[11px]">
            <div className="border-b border-slate-100 px-3 py-2 text-corp-text-muted">Позиції для переобліку</div>
            {loading ? (
              <div className="p-8 text-center text-sm text-corp-text-muted">Завантаження...</div>
            ) : (
              <div className="max-h-[360px] overflow-auto divide-y divide-slate-100">
                {filtered.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => setSelectedId(it.id)}
                    className={cls(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50',
                      selected?.id === it.id && 'bg-slate-900/5'
                    )}
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-corp-text-dark">{it.name}</div>
                      <div className="mt-0.5 text-[10px] text-corp-text-muted">
                        <span className="font-mono text-slate-700">{it.code}</span>
                        <span> · {it.category}</span>
                        {it.zone && <span> · 📍 {it.zone}</span>}
                      </div>
                      <div className="mt-1 flex gap-2">
                        <StatusCell status={it.status} />
                        <RiskBadge item={it} />
                      </div>
                    </div>
                    <div className="text-[10px] text-corp-text-muted text-right">
                      <div>К-сть: {it.qty}</div>
                      <div>Останній: {it.lastAuditDate}</div>
                      <div>{it.daysFromLastAudit} днів тому</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* right: details */}
        {selected && (
          <div className="space-y-3 text-[11px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-4">
                <div className="text-xs font-medium text-slate-700 mb-2">📸 Фото товару</div>
                <ImageUpload
                  sku={selected.code}
                  currentImageUrl={selected.imageUrl}
                  onUploadSuccess={(newImageUrl: string) => {
                    // Update in items list - selected буде автоматично оновлено через useMemo
                    setItems(items.map(item => 
                      item.code === selected.code 
                        ? { ...item, imageUrl: newImageUrl }
                        : item
                    ));
                  }}
                />
              </div>
              
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-sm font-semibold text-corp-text-dark">{selected.name}</div>
                    <div className="text-[10px] text-corp-text-muted">
                      {selected.category} {selected.zone && <> · 📍 {selected.zone}</>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-[10px]">
                  <StatusCell status={selected.status} />
                  <RiskBadge item={selected} />
                  <div className="text-corp-text-muted">
                    Останній переоблік: {selected.lastAuditDate}
                    {selected.lastAuditBy && <> · {selected.lastAuditBy}</>}
                  </div>
                  {selected.nextAuditDate && (
                    <div className="text-slate-400">Наступний: {selected.nextAuditDate}</div>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-corp-text-muted">Кількість на складі</div>
                  <div className="mt-1 text-lg font-semibold text-corp-text-dark">{selected.qty}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-corp-text-muted">Було в оренді</div>
                  <div className="mt-1 text-lg font-semibold text-corp-text-dark">{selected.rentalsCount} разів</div>
                  <div className="mt-1 text-slate-400">останній: {selected.lastOrderId || '—'}</div>
                </div>
                <div 
                  className="rounded-xl bg-slate-50 p-3 cursor-pointer hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-colors"
                  onClick={() => setShowConditionPanel(true)}
                >
                  <div className="text-corp-text-muted flex items-center justify-between">
                    <span>📋 Журнал стану</span>
                    <span className="text-blue-600 text-xs">Деталі →</span>
                  </div>
                  <div className="mt-1 text-lg font-semibold text-corp-text-dark">{selected.damagesCount}</div>
                  <div className="mt-1 text-slate-400">записів у журналі</div>
                </div>
              </div>

              {/* Блок редагування */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-semibold text-corp-text-dark">📝 Редагування картки</div>
                  {!isEditing && (
                    <PillButton tone="slate" onClick={() => {
                      setIsEditing(true)
                      // Парсинг розміру "50x50x50" -> окремі поля
                      setEditData({
                        name: selected.name,
                        code: selected.code,
                        price: selected.price || 0,
                        rentalPrice: selected.rentalPrice || 0,
                        color: selected.color || '',
                        material: selected.material || '',
                        // Розміри - пріоритет окремим полям, fallback на size
                        height: selected.heightCm?.toString() || (selected.size?.split('x')[0]) || '',
                        width: selected.widthCm?.toString() || (selected.size?.split('x')[1]) || '',
                        depth: selected.depthCm?.toString() || (selected.size?.split('x')[2]) || '',
                        diameter: selected.diameterCm?.toString() || '',
                        // Категорії
                        category: selected.categoryName || selected.category?.split(' · ')[0] || '',
                        subcategory: selected.subcategoryName || selected.category?.split(' · ')[1] || '',
                        // Форма та хештеги
                        shape: selected.shape || '',
                        hashtags: selected.hashtags || [],
                        qty: selected.qty,
                        zone: selected.zone || ''
                      })
                    }}>
                      ✏️ Редагувати
                    </PillButton>
                  )}
                </div>
                
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-corp-text-main mb-1">📝 Назва товару</label>
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData({...editData, name: e.target.value})}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-corp-text-main mb-1">🏷️ Код товару (SKU)</label>
                      <input
                        type="text"
                        value={editData.code}
                        onChange={(e) => setEditData({...editData, code: e.target.value})}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-corp-text-main mb-1">💰 Ціна купівлі</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editData.price}
                          onChange={(e) => setEditData({...editData, price: parseFloat(e.target.value) || 0})}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-corp-text-main mb-1">💵 Ціна оренди за день</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editData.rentalPrice}
                          onChange={(e) => setEditData({...editData, rentalPrice: parseFloat(e.target.value) || 0})}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-corp-text-main mb-1">🎨 Колір</label>
                        <input
                          type="text"
                          value={editData.color}
                          onChange={(e) => setEditData({...editData, color: e.target.value})}
                          placeholder="напр. золото, чорний"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-corp-text-main mb-1">🔨 Матеріал</label>
                        <input
                          type="text"
                          value={editData.material}
                          onChange={(e) => setEditData({...editData, material: e.target.value})}
                          placeholder="напр. метал, скло"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    
                    {/* ✅ NEW: Категорія та підкатегорія */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-corp-text-main mb-1">📁 Категорія</label>
                        <input
                          type="text"
                          list="categories-list"
                          value={editData.category}
                          onChange={(e) => setEditData({...editData, category: e.target.value})}
                          placeholder="Вази"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        <datalist id="categories-list">
                          {categoriesDict.map(c => (
                            <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <label className="block text-[10px] text-corp-text-main mb-1">📂 Підкатегорія</label>
                        <input
                          type="text"
                          list="subcategories-list"
                          value={editData.subcategory}
                          onChange={(e) => setEditData({...editData, subcategory: e.target.value})}
                          placeholder="Скляні вази"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        <datalist id="subcategories-list">
                          {(subcategoriesDict[editData.category] || []).map(s => (
                            <option key={s.name} value={s.name}>{s.name} ({s.count})</option>
                          ))}
                        </datalist>
                      </div>
                    </div>
                    
                    {/* ✅ NEW: Розміри окремими полями */}
                    <div>
                      <label className="block text-[10px] text-corp-text-main mb-2">📏 Розміри (см)</label>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[9px] text-corp-text-muted mb-1">Висота</label>
                          <input
                            type="number"
                            step="0.1"
                            value={editData.height}
                            onChange={(e) => setEditData({...editData, height: e.target.value})}
                            placeholder="50"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-corp-text-muted mb-1">Ширина</label>
                          <input
                            type="number"
                            step="0.1"
                            value={editData.width}
                            onChange={(e) => setEditData({...editData, width: e.target.value})}
                            placeholder="50"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-corp-text-muted mb-1">Довжина</label>
                          <input
                            type="number"
                            step="0.1"
                            value={editData.depth}
                            onChange={(e) => setEditData({...editData, depth: e.target.value})}
                            placeholder="50"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-corp-text-muted mb-1">⌀ Діаметр</label>
                          <input
                            type="number"
                            step="0.1"
                            value={editData.diameter}
                            onChange={(e) => setEditData({...editData, diameter: e.target.value})}
                            placeholder="30"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* ✅ NEW: Форма виробу */}
                    <div>
                      <label className="block text-[10px] text-corp-text-main mb-1">🔷 Форма виробу</label>
                      <input
                        type="text"
                        list="shapes-list"
                        value={editData.shape}
                        onChange={(e) => setEditData({...editData, shape: e.target.value})}
                        placeholder="круглий, квадратний, овальний..."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <datalist id="shapes-list">
                        {shapesDict.map(s => <option key={s} value={s} />)}
                      </datalist>
                    </div>
                    
                    {/* ✅ NEW: Хештеги */}
                    <div>
                      <label className="block text-[10px] text-corp-text-main mb-1">#️⃣ Хештеги (для фільтрації)</label>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {editData.hashtags.map(tag => (
                          <span 
                            key={tag} 
                            className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px]"
                          >
                            #{tag}
                            <button 
                              type="button"
                              onClick={() => setEditData({
                                ...editData, 
                                hashtags: editData.hashtags.filter(t => t !== tag)
                              })}
                              className="text-blue-500 hover:text-blue-700"
                            >×</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          list="hashtags-list"
                          value={newHashtag}
                          onChange={(e) => setNewHashtag(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newHashtag.trim()) {
                              e.preventDefault()
                              const tag = newHashtag.toLowerCase().trim().replace(/[^a-zа-яіїєґ0-9_]/gi, '_')
                              if (!editData.hashtags.includes(tag)) {
                                setEditData({...editData, hashtags: [...editData.hashtags, tag]})
                              }
                              setNewHashtag('')
                            }
                          }}
                          placeholder="Введіть тег і Enter"
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newHashtag.trim()) {
                              const tag = newHashtag.toLowerCase().trim().replace(/[^a-zа-яіїєґ0-9_]/gi, '_')
                              if (!editData.hashtags.includes(tag)) {
                                setEditData({...editData, hashtags: [...editData.hashtags, tag]})
                              }
                              setNewHashtag('')
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm"
                        >+</button>
                      </div>
                      <datalist id="hashtags-list">
                        {hashtagsDict.map(h => (
                          <option key={h.tag} value={h.tag}>{h.display_name} ({h.category})</option>
                        ))}
                      </datalist>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="text-[9px] text-slate-400">Популярні:</span>
                        {hashtagsDict.slice(0, 10).map(h => (
                          <button
                            key={h.tag}
                            type="button"
                            onClick={() => {
                              if (!editData.hashtags.includes(h.tag)) {
                                setEditData({...editData, hashtags: [...editData.hashtags, h.tag]})
                              }
                            }}
                            className="text-[9px] text-blue-600 hover:underline"
                          >#{h.tag}</button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-corp-text-main mb-1">📦 Кількість</label>
                        <input
                          type="number"
                          value={editData.qty}
                          onChange={(e) => setEditData({...editData, qty: parseInt(e.target.value) || 0})}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-corp-text-main mb-1">📍 Зона / Місце на складі</label>
                        <input
                          type="text"
                          value={editData.zone}
                          onChange={(e) => setEditData({...editData, zone: e.target.value})}
                          placeholder="напр. 6 / A / 12"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <PillButton tone="green" onClick={async () => {
                        try {
                          const response = await fetch(`${BACKEND_URL}/api/audit/items/${selected.id}/edit-full`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              name: editData.name,
                              code: editData.code,
                              price: editData.price,
                              rentalPrice: editData.rentalPrice,
                              color: editData.color,
                              material: editData.material,
                              // ✅ NEW: Окремі поля розмірів
                              height: editData.height,
                              width: editData.width,
                              depth: editData.depth,
                              diameter: editData.diameter,
                              // ✅ NEW: Категорія, форма, хештеги
                              category: editData.category,
                              subcategory: editData.subcategory,
                              shape: editData.shape,
                              hashtags: editData.hashtags,
                              qty: editData.qty,
                              zone: editData.zone,
                              actor: 'Реквізитор'
                            })
                          })
                          const result = await response.json()
                          if (result.success) {
                            alert(`✅ Зміни збережено!\n${result.changes.join('\n')}`)
                            setIsEditing(false)
                            loadItems()
                          } else {
                            alert('Помилка: ' + JSON.stringify(result))
                          }
                        } catch (e) {
                          alert('Помилка: ' + String(e))
                        }
                      }}>
                        💾 Зберегти зміни
                      </PillButton>
                      <PillButton tone="slate" onClick={() => setIsEditing(false)}>
                        ❌ Скасувати
                      </PillButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-corp-text-main">🏷️ Код:</span>
                      <span className="font-medium text-corp-text-dark font-mono">{selected.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-corp-text-main">💰 Ціна купівлі:</span>
                      <span className="font-medium text-corp-text-dark">{selected.price ? `₴${selected.price.toFixed(2)}` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-corp-text-main">💵 Ціна оренди:</span>
                      <span className="font-medium text-corp-text-dark">{selected.rentalPrice ? `₴${selected.rentalPrice.toFixed(2)}/день` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-corp-text-main">🎨 Колір:</span>
                      <span className="font-medium text-corp-text-dark">{selected.color || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-corp-text-main">🔨 Матеріал:</span>
                      <span className="font-medium text-corp-text-dark">{selected.material || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-corp-text-main">📏 Розміри (см):</span>
                      <span className="font-medium text-corp-text-dark">
                        {(selected.heightCm || selected.widthCm || selected.depthCm || selected.diameterCm) ? (
                          [
                            selected.heightCm ? `В:${selected.heightCm}` : null,
                            selected.widthCm ? `Ш:${selected.widthCm}` : null,
                            selected.depthCm ? `Д:${selected.depthCm}` : null,
                            selected.diameterCm ? `⌀${selected.diameterCm}` : null,
                          ].filter(Boolean).join(' × ')
                        ) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-corp-text-main">📍 Місце:</span>
                      <span className="font-medium text-corp-text-dark">{selected.zone || '—'}</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Опис товару та інструкція - завжди показувати */}
              {(selected.description || selected.careInstructions) && (
                <div className="mt-4 space-y-3">
                  {selected.description && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-1 text-[10px] font-semibold text-corp-text-main">📄 Опис товару</div>
                      <div className="text-[11px] text-slate-700" dangerouslySetInnerHTML={{ __html: selected.description }} />
                    </div>
                  )}
                  {selected.careInstructions && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <div className="mb-1 text-[10px] font-semibold text-emerald-700">💡 Інструкція по догляду</div>
                      <div className="text-[11px] text-emerald-800" dangerouslySetInnerHTML={{ __html: selected.careInstructions }} />
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.4fr),minmax(0,1.6fr)]">
                {/* left: checklist & actions */}
                <div className="space-y-3">
                  {/* Редагування опису та інструкції */}
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-corp-text-dark">📄 Опис товару</label>
                      <textarea
                        id="description-field"
                        rows={4}
                        defaultValue={selected.description?.replace(/<[^>]*>/g, '') || ''}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px]"
                        placeholder="Детальний опис товару, особливості, призначення..."
                      />
                    </div>
                    
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-emerald-700">💡 Інструкція по догляду</label>
                      <textarea
                        id="care-field"
                        rows={3}
                        defaultValue={selected.careInstructions?.replace(/<[^>]*>/g, '') || ''}
                        className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px]"
                        placeholder="Як мити, зберігати, доглядати за товаром..."
                      />
                    </div>
                    
                    <div className="flex justify-end">
                      <PillButton tone="green" onClick={async () => {
                        const descEl = document.getElementById('description-field') as HTMLTextAreaElement
                        const careEl = document.getElementById('care-field') as HTMLTextAreaElement
                        if (!descEl || !careEl) return
                        try {
                          const response = await fetch(`${BACKEND_URL}/api/audit/items/${selected.id}/update-info`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              description: descEl.value,
                              care_instructions: careEl.value
                            })
                          })
                          const result = await response.json()
                          if (result.success) {
                            alert('✅ Опис і інструкцію збережено!')
                            loadItems()
                          }
                        } catch (e) {
                          alert('Помилка: ' + String(e))
                        }
                      }}>
                        💾 Зберегти опис і інструкцію
                      </PillButton>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 font-semibold text-corp-text-dark">Швидкі дії</div>
                    <div className="flex flex-wrap gap-2">
                      <PillButton tone="green" onClick={() => markItemAudited(selected)}>
                        ✅ Зафіксувати переоблік
                      </PillButton>
                      <PillButton tone="red" onClick={() => setShowDamageForm(true)}>
                        💥 Кейс шкоди
                      </PillButton>
                    </div>
                  </div>

                  {/* Блок "Інструкція чистки" видалено - інформація відображається в картці та фіксується в життєвому циклі */}

                  {/* Блок фіксації пошкоджень */}
                  <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="font-semibold text-orange-900">⚠️ Пошкодження</div>
                      {!showDamageForm && (
                        <PillButton tone="amber" onClick={() => setShowDamageForm(true)}>
                          + Додати
                        </PillButton>
                      )}
                    </div>

                    {showDamageForm ? (
                      <div className="space-y-2">
                        {/* 4 кнопки дій */}
                        {!damageData.action_type && (
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setDamageData({...damageData, action_type: 'washing'})}
                              className="py-2.5 px-2 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
                              🧼 Мийка
                            </button>
                            <button onClick={() => setDamageData({...damageData, action_type: 'restoration'})}
                              className="py-2.5 px-2 text-xs font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition">
                              🔧 Реставрація
                            </button>
                            <button onClick={() => setDamageData({...damageData, action_type: 'laundry'})}
                              className="py-2.5 px-2 text-xs font-medium rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition">
                              👔 Пральня
                            </button>
                            <button onClick={() => setDamageData({...damageData, action_type: 'total_loss'})}
                              className="py-2.5 px-2 text-xs font-medium rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition">
                              💔 Повна втрата
                            </button>
                          </div>
                        )}

                        {/* Форма після вибору дії */}
                        {damageData.action_type && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700">
                                {damageData.action_type === 'washing' && '🧼 Мийка'}
                                {damageData.action_type === 'restoration' && '🔧 Реставрація'}
                                {damageData.action_type === 'laundry' && '👔 Пральня'}
                                {damageData.action_type === 'total_loss' && '💔 Повна втрата'}
                              </span>
                              <button onClick={() => setDamageData({...damageData, action_type: ''})}
                                className="text-[10px] text-slate-400 hover:text-slate-600">← Назад</button>
                            </div>

                            <textarea
                              value={damageData.description}
                              onChange={(e) => setDamageData({...damageData, description: e.target.value})}
                              placeholder="Причина..."
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                              rows={2}
                            />

                            <div className={`grid ${damageData.action_type === 'total_loss' ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                              <div>
                                <label className="block text-[10px] text-corp-text-main mb-1">Кількість</label>
                                <input type="number" min="1" max={selected?.qty || 1}
                                  value={damageData.qty}
                                  onChange={(e) => setDamageData({...damageData, qty: parseInt(e.target.value) || 1})}
                                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                                />
                                <div className="mt-0.5 text-[9px] text-corp-text-muted">Макс: {selected?.qty || 0}</div>
                              </div>
                              {damageData.action_type !== 'total_loss' && (
                                <div>
                                  <label className="block text-[10px] text-corp-text-main mb-1">Ступінь</label>
                                  <select value={damageData.severity}
                                    onChange={(e) => setDamageData({...damageData, severity: e.target.value})}
                                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                                    <option value="minor">Незначне</option>
                                    <option value="critical">Критичне</option>
                                  </select>
                                </div>
                              )}
                            </div>

                            {damageData.action_type === 'total_loss' ? (
                              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-[11px] text-rose-700">
                                ⚠️ {damageData.qty} од. буде списано назавжди
                              </div>
                            ) : (
                              <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 text-[11px] text-blue-700">
                                ℹ️ {damageData.qty} од. буде заморожено
                              </div>
                            )}

                            <div className="flex gap-2">
                              <PillButton tone="amber" onClick={async () => {
                                if (!damageData.description.trim()) {
                                  alert('Введіть причину')
                                  return
                                }
                                if (damageData.qty <= 0 || damageData.qty > (selected?.qty || 0)) {
                                  alert(`Некоректна кількість. Доступно: ${selected?.qty || 0}`)
                                  return
                                }
                                try {
                                  const token = localStorage.getItem('token')
                                  const headers: any = { 'Content-Type': 'application/json' }
                                  if (token) headers['Authorization'] = `Bearer ${token}`

                                  if (damageData.action_type === 'total_loss') {
                                    // Повна втрата: quick-add + write-off
                                    const addRes = await fetch(`${BACKEND_URL}/api/product-damage-history/quick-add-to-queue`, {
                                      method: 'POST', headers,
                                      body: JSON.stringify({
                                        product_id: selected.product_id,
                                        sku: selected.sku || `SKU-${selected.product_id}`,
                                        product_name: selected.name,
                                        category: selected.categoryName || '',
                                        queue_type: 'wash',
                                        quantity: damageData.qty,
                                        notes: damageData.description
                                      })
                                    })
                                    const addResult = await addRes.json()
                                    if (!addResult.success) { alert('❌ ' + (addResult.detail || 'Помилка')); return }
                                    // Одразу списуємо
                                    const woRes = await fetch(`${BACKEND_URL}/api/product-damage-history/${addResult.damage_id}/write-off`, {
                                      method: 'POST', headers,
                                      body: JSON.stringify({ qty: damageData.qty, reason: damageData.description })
                                    })
                                    const woResult = await woRes.json()
                                    if (woRes.ok) {
                                      alert(`✅ Списано ${damageData.qty} од.`)
                                    } else {
                                      alert('❌ ' + (woResult.detail || 'Помилка списання'))
                                      return
                                    }
                                  } else {
                                    // Мийка / Реставрація / Пральня — quick-add-to-queue
                                    const queueMap: any = { washing: 'wash', restoration: 'restoration', laundry: 'laundry' }
                                    const response = await fetch(`${BACKEND_URL}/api/product-damage-history/quick-add-to-queue`, {
                                      method: 'POST', headers,
                                      body: JSON.stringify({
                                        product_id: selected.product_id,
                                        sku: selected.sku || `SKU-${selected.product_id}`,
                                        product_name: selected.name,
                                        category: selected.categoryName || '',
                                        queue_type: queueMap[damageData.action_type] || damageData.action_type,
                                        quantity: damageData.qty,
                                        notes: `[${damageData.severity}] ${damageData.description}`
                                      })
                                    })
                                    const result = await response.json()
                                    if (result.success) {
                                      const labels: any = { washing: 'мийку', restoration: 'реставрацію', laundry: 'пральню' }
                                      alert(`✅ Відправлено на ${labels[damageData.action_type] || damageData.action_type}`)
                                    } else {
                                      alert('❌ ' + (result.detail || 'Помилка'))
                                      return
                                    }
                                  }
                                  setShowDamageForm(false)
                                  setDamageData({ description: '', severity: 'minor', estimated_cost: 0, create_damage_case: false, photo_url: '', action_type: '', qty: 1 })
                                  loadItems(); loadStats()
                                } catch (e) { alert('Помилка: ' + String(e)) }
                              }}>
                                ✅ Підтвердити
                              </PillButton>
                              <PillButton tone="slate" onClick={() => {
                                setShowDamageForm(false)
                                setDamageData({ description: '', severity: 'minor', estimated_cost: 0, create_damage_case: false, photo_url: '', action_type: '', qty: 1 })
                              }}>
                                Скасувати
                              </PillButton>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {damages.length > 0 ? (
                          <div className="space-y-2 text-xs">
                            {damages.slice(0, 3).map((damage, idx) => (
                              <div key={idx} className="rounded-lg bg-white border border-orange-100 p-2">
                                <div className="flex gap-2">
                                  {damage.photo_url && (
                                    <img 
                                      src={`${BACKEND_URL}${damage.photo_url}`}
                                      alt="Пошкодження" 
                                      className="h-16 w-16 rounded-lg border border-orange-200 object-cover flex-shrink-0"
                                    />
                                  )}
                                  <div className="flex-1">
                                    <div className="font-medium text-orange-900">
                                      {new Date(damage.date).toLocaleDateString('uk-UA')}
                                    </div>
                                    <div className="text-corp-text-main mt-1">{damage.notes}</div>
                                    <div className="text-[10px] text-slate-400 mt-1">
                                      Зафіксував: {damage.actor}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {damages.length > 3 && (
                              <div className="text-center text-[10px] text-slate-400">
                                Ще {damages.length - 3} записів...
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-corp-text-muted">
                            Пошкоджень не зафіксовано
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* right: lifecycle & history */}
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-1 font-semibold text-corp-text-dark">Життєвий цикл предмета</div>
                    <div className="text-corp-text-main">
                      <p>
                        Цей предмет був в оренді <strong>{selected.rentalsCount}</strong> разів та приніс{' '}
                        <strong>₴ {fmtUA(selected.totalProfit)}</strong> доходу. Кейсів шкоди:{' '}
                        <strong>{selected.damagesCount}</strong>.
                      </p>
                      <p className="mt-1">
                        Останній переоблік був <strong>{selected.daysFromLastAudit}</strong> днів тому.
                      </p>
                      <p className="mt-1">
                        Якщо предмет часто повертається з пошкодженнями або майже не здається, система може підказати
                        списання або заміну.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 font-semibold text-corp-text-dark">Історія оренд</div>
                    {loadingHistory ? (
                      <div className="text-sm text-corp-text-muted">Завантаження...</div>
                    ) : rentalHistory.length > 0 ? (
                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {rentalHistory.map((rental, idx) => (
                          <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-[11px]">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="font-semibold text-corp-text-dark">{rental.order_number}</span>
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">
                                ₴ {fmtUA(rental.total_rental)}
                              </span>
                            </div>
                            <div className="text-corp-text-main">
                              <div>📅 {rental.rent_date ? new Date(rental.rent_date).toLocaleDateString('uk-UA') : 'Н/Д'} 
                                {rental.rent_return_date && ` → ${new Date(rental.rent_return_date).toLocaleDateString('uk-UA')}`}
                              </div>
                              <div>👤 {rental.client_name || 'Клієнт не вказаний'}</div>
                              <div>📞 {rental.client_phone || '—'}</div>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge tone={rental.status === 'completed' ? 'green' : rental.status === 'active' ? 'blue' : 'slate'}>
                                  {rental.status}
                                </Badge>
                                <span className="text-[10px] text-corp-text-muted">
                                  {rental.rental_days} {rental.rental_days === 1 ? 'день' : rental.rental_days < 5 ? 'дні' : 'днів'} · 
                                  Кіл-сть: {rental.quantity}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-corp-text-muted">
                        📋 Цей товар ще не здавався в оренду
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* alerts */}
            {(overdue.length > 0 || critical.length > 0) && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-800">
                {overdue.length > 0 && (
                  <div className="mb-1">
                    ⚠️ Потрібен переоблік: <strong>{overdue.length}</strong> позицій не перевірялись більше ніж 6 місяців.
                  </div>
                )}
                {critical.length > 0 && (
                  <div>
                    ❗ Критичні / втрачені позиції: <strong>{critical.length}</strong>. Рекомендуємо перевірити.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal for creating new product */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => {
          setShowCreateForm(false)
          setUploadedImage(null)
        }}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-corp-text-dark">➕ Додати новий товар</h2>
              <button onClick={() => {
                setShowCreateForm(false)
                setUploadedImage(null)
                setSelectedCategory('')
              }} className="text-slate-400 hover:text-corp-text-main">✕</button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const data = {
                name: formData.get('name'),
                sku: formData.get('sku'),
                category: formData.get('category'),
                subcategory: formData.get('subcategory'),
                color: formData.get('color'),
                material: formData.get('material'),
                size: formData.get('size'),
                quantity: Number(formData.get('quantity')),
                location_zone: formData.get('location_zone'),
                location: formData.get('location'),
                description: formData.get('description'),
                care_instructions: formData.get('care_instructions'),
                image: uploadedImage?.path || '',  // ✅ Додаємо завантажене фото
              }
              createNewProduct(data)
            }}>
              <div className="space-y-4">
                {/* Завантаження фото */}
                <div>
                  <label className="block text-[11px] text-corp-text-main mb-1">📷 Фото товару</label>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <input 
                        type="file" 
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            await uploadImage(file)
                          }
                        }}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        disabled={uploadingImage}
                      />
                      <div className="mt-1 text-[10px] text-slate-400">
                        Дозволені: JPG, PNG, WEBP. Макс 5MB
                      </div>
                    </div>
                    {uploadedImage && (
                      <div className="relative">
                        <img 
                          src={`${BACKEND_URL}${uploadedImage.url}`}
                          alt="Попередній перегляд" 
                          className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setUploadedImage(null)}
                          className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 text-[10px] text-white hover:bg-rose-600"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    {uploadingImage && (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-[10px] text-slate-400">Завантаження...</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-corp-text-main">Назва товару *</label>
                    <input name="name" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Ваза скляна золота" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-corp-text-main">SKU (артикул) *</label>
                    <input name="sku" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="8900" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-corp-text-main">Категорія *</label>
                    <select 
                      name="category" 
                      required 
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Оберіть категорію...</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-corp-text-main">Підкатегорія</label>
                    <select 
                      name="subcategory" 
                      disabled={!selectedCategory || !subcategoriesMap[selectedCategory]?.length}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!selectedCategory ? 'Спочатку оберіть категорію' : 
                         !subcategoriesMap[selectedCategory]?.length ? 'Немає підкатегорій' : 
                         'Оберіть підкатегорію...'}
                      </option>
                      {selectedCategory && subcategoriesMap[selectedCategory]?.map((subcat: string) => (
                        <option key={subcat} value={subcat}>{subcat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <label className="block text-[11px] text-corp-text-main">Колір</label>
                    <input name="color" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Золотий" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-corp-text-main">Матеріал</label>
                    <input name="material" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Скло" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-corp-text-main">Розміри</label>
                    <input name="size" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="30x20 см" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-corp-text-main">Кількість *</label>
                    <input name="quantity" type="number" required defaultValue="1" min="1" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-corp-text-main">Зона складу</label>
                    <input name="location_zone" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="A" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-corp-text-main">Локація (стелаж/полиця)</label>
                    <input name="location" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Р1/П3" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-corp-text-main">Опис</label>
                  <textarea name="description" rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Детальний опис товару..." />
                </div>

                <div>
                  <label className="block text-[11px] text-corp-text-main">Інструкція по догляду</label>
                  <textarea name="care_instructions" rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Як мити, зберігати..." />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => {
                  setShowCreateForm(false)
                  setUploadedImage(null)
                  setSelectedCategory('')
                }} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 hover:bg-slate-50">
                  Скасувати
                </button>
                <button type="submit" className="rounded-full px-3 py-1 text-[11px] font-medium transition bg-emerald-600 text-white hover:bg-emerald-700">
                  Створити і переоблікувати
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
      
      {/* Панель журналу стану декору */}
      <ProductConditionPanel
        product={selected}
        isOpen={showConditionPanel}
        onClose={() => setShowConditionPanel(false)}
        onRecordAdded={() => {
          // Перезавантажити дані товару
          if (selected) {
            loadDamages(selected.id)
          }
        }}
      />
    </div>
  )
}
