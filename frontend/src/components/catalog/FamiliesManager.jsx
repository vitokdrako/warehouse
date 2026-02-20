/* eslint-disable */
/**
 * FamiliesManager - 3-колоночний інтерфейс керування розмірними сітками
 * 
 * Layout Desktop: [Ліва - Список] | [Центр - Деталі] | [Права - Прив'язка]
 * Layout Mobile: Tabs з переключенням між панелями
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Plus, Trash2, Save, Grid3X3, List, X, AlertTriangle, Check, Move, ChevronRight, ChevronLeft, Package, Palette, Ruler, Layers, Settings } from 'lucide-react'
import { getImageUrl, handleImageError } from '../../utils/imageHelper'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

// ============================================
// UTILITIES
// ============================================

const cls = (...a) => a.filter(Boolean).join(' ')

// Парсинг розміру з SKU або name
const parseSize = (sku, name) => {
  const text = `${sku || ''} ${name || ''}`
  
  // Патерни для розмірів
  const patterns = [
    /(\d+)[xх×]\s*(\d+)/i,           // 150x150, 180х200
    /[ØОо]?\s*(\d+)\s*(см|cm|мм|mm)?/i, // Ø50, 50см
    /(\d+)\s*(см|cm|мм|mm)/i,        // 50см, 180cm
    /(XS|S|M|L|XL|XXL|XXXL)/i,       // Розміри одягу
    /(\d{2,4})\s*$/,                  // Просто число в кінці
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return match[0].trim()
    }
  }
  
  return null
}

// Парсинг кольору
const parseColor = (color, name) => {
  if (color && color.trim()) return color.trim()
  
  // Спробувати знайти колір у назві
  const colorPatterns = [
    /білий|біла|біле|white/i,
    /чорний|чорна|чорне|black/i,
    /червоний|червона|red/i,
    /синій|синя|blue/i,
    /зелений|зелена|green/i,
    /жовтий|жовта|yellow/i,
    /сірий|сіра|gray|grey/i,
    /бежевий|бежева|beige/i,
    /рожевий|рожева|pink/i,
    /золотий|золота|gold/i,
    /срібний|срібна|silver/i,
    /коричневий|коричнева|brown/i,
  ]
  
  for (const pattern of colorPatterns) {
    const match = (name || '').match(pattern)
    if (match) return match[0]
  }
  
  return null
}

// ============================================
// LEFT COLUMN - FAMILIES LIST
// ============================================

function FamiliesList({ 
  families, 
  selectedId, 
  onSelect, 
  onCreate,
  searchQuery,
  onSearchChange,
  filterHasProducts,
  onFilterChange,
  isMobile = false
}) {
  const filteredFamilies = useMemo(() => {
    return families.filter(f => {
      // Пошук
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!f.name?.toLowerCase().includes(q) && !f.description?.toLowerCase().includes(q)) {
          return false
        }
      }
      // Фільтр по наявності товарів
      if (filterHasProducts === 'has' && (!f.products || f.products.length === 0)) return false
      if (filterHasProducts === 'empty' && f.products && f.products.length > 0) return false
      return true
    })
  }, [families, searchQuery, filterHasProducts])

  return (
    <div className={cls(
      "bg-white flex flex-col h-full",
      isMobile ? "w-full" : "w-[340px] flex-shrink-0 border-r border-slate-200"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">Розмірні сітки</h2>
          <button
            onClick={onCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className={isMobile ? "hidden" : ""}>Створити</span>
            {isMobile && <span>+</span>}
          </button>
        </div>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Пошук..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-400"
          />
        </div>
        
        {/* Filter */}
        <div className="flex gap-1 flex-wrap">
          {[
            { value: 'all', label: 'Всі' },
            { value: 'has', label: 'З товарами' },
            { value: 'empty', label: 'Пусті' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => onFilterChange(opt.value)}
              className={cls(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors',
                filterHasProducts === opt.value
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredFamilies.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            {searchQuery ? 'Нічого не знайдено' : 'Немає розмірних сіток'}
          </div>
        ) : (
          filteredFamilies.map(family => (
            <button
              key={family.id}
              onClick={() => onSelect(family)}
              className={cls(
                'w-full text-left p-3 rounded-xl transition-all',
                selectedId === family.id
                  ? 'bg-amber-50 border-2 border-amber-300 shadow-sm'
                  : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-800 truncate">{family.name || 'Без назви'}</span>
                <span className={cls(
                  'px-2 py-0.5 text-xs font-medium rounded-full',
                  family.products?.length > 0 
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                )}>
                  {family.products?.length || 0} SKU
                </span>
              </div>
              {family.description && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{family.description}</p>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ============================================
// CENTER COLUMN - FAMILY DETAIL + MATRIX
// ============================================

function FamilyDetail({ 
  family, 
  onSave, 
  onDelete,
  saving,
  hasChanges,
  pendingAdd = [],
  pendingRemove = []
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [viewMode, setViewMode] = useState('matrix') // 'matrix' | 'list'
  const [highlightedSku, setHighlightedSku] = useState(null)
  const [originalName, setOriginalName] = useState('')
  const [originalDescription, setOriginalDescription] = useState('')

  // Sync state when family changes
  useEffect(() => {
    if (family) {
      setName(family.name || '')
      setDescription(family.description || '')
      setOriginalName(family.name || '')
      setOriginalDescription(family.description || '')
    }
  }, [family?.id])

  // Check if name/description changed
  const nameChanged = name !== originalName
  const descriptionChanged = description !== originalDescription
  const hasTextChanges = nameChanged || descriptionChanged
  const hasAnyChanges = hasChanges || hasTextChanges

  const products = family?.products || []

  // Побудова матриці
  const matrixData = useMemo(() => {
    const colors = new Set()
    const sizes = new Set()
    const matrix = {}
    const unmatched = []

    products.forEach(p => {
      const size = parseSize(p.sku, p.name)
      const color = parseColor(p.color, p.name)

      if (size) sizes.add(size)
      if (color) colors.add(color)

      const key = `${color || 'Other'}_${size || 'Other'}`
      
      if (!matrix[key]) matrix[key] = []
      matrix[key].push(p)

      if (!size && !color) {
        unmatched.push(p)
      }
    })

    // Сортуємо розміри (числа спочатку)
    const sortedSizes = Array.from(sizes).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''))
      const numB = parseInt(b.replace(/\D/g, ''))
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return a.localeCompare(b)
    })

    const sortedColors = Array.from(colors).sort()
    if (sortedColors.length === 0) sortedColors.push('Other')
    if (sortedSizes.length === 0) sortedSizes.push('Other')

    return { colors: sortedColors, sizes: sortedSizes, matrix, unmatched }
  }, [products])

  if (!family) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-4">
            <Grid3X3 className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-500">Виберіть розмірну сітку зліва</p>
          <p className="text-sm text-slate-400 mt-1">або створіть нову</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Назва розмірної сітки"
              className="text-xl font-semibold text-slate-800 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-amber-400 focus:outline-none w-full pb-1 transition-colors"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опис (опціонально)"
              className="text-sm text-slate-500 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-amber-400 focus:outline-none w-full pb-1 transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-2">
            {hasAnyChanges && (
              <div className="flex items-center gap-2 text-xs px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
                <span className="text-amber-700 font-medium">Незбережені:</span>
                {hasTextChanges && (
                  <span className="text-blue-600">назва</span>
                )}
                {pendingAdd.length > 0 && (
                  <span className="text-emerald-600">+{pendingAdd.length}</span>
                )}
                {pendingRemove.length > 0 && (
                  <span className="text-rose-600">-{pendingRemove.length}</span>
                )}
              </div>
            )}
            <button
              onClick={() => onSave({ name, description, nameChanged, descriptionChanged })}
              disabled={saving || !hasAnyChanges || !name.trim()}
              className={cls(
                "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                hasAnyChanges
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed"
              )}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Зберігаю...' : hasAnyChanges ? 'Зберегти' : 'Збережено'}
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Видалити"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Stats & View Toggle */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-slate-600">
              <Package className="w-4 h-4" />
              <b>{products.length}</b> SKU
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
              Σ {products.reduce((sum, p) => sum + (p.quantity || 0), 0)} шт
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <Palette className="w-4 h-4" />
              <b>{matrixData.colors.filter(c => c !== 'Other').length || 0}</b> кольорів
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <Ruler className="w-4 h-4" />
              <b>{matrixData.sizes.filter(s => s !== 'Other').length || 0}</b> розмірів
            </span>
          </div>
          
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('matrix')}
              className={cls(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'matrix' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'
              )}
              title="Матриця"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cls(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'list' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'
              )}
              title="Список"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {products.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <Package className="w-10 h-10 text-amber-500" />
              </div>
              <p className="text-slate-600 font-medium">Немає товарів у сітці</p>
              <p className="text-sm text-slate-400 mt-1">Додайте товари з панелі справа →</p>
            </div>
          </div>
        ) : viewMode === 'matrix' ? (
          <MatrixView 
            data={matrixData} 
            highlightedSku={highlightedSku}
            onHighlight={setHighlightedSku}
          />
        ) : (
          <ListView 
            products={products} 
            highlightedSku={highlightedSku}
            onHighlight={setHighlightedSku}
          />
        )}
      </div>
    </div>
  )
}

// Matrix View Component
function MatrixView({ data, highlightedSku, onHighlight }) {
  const { colors, sizes, matrix } = data

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-r border-slate-200 sticky left-0 bg-slate-50 z-10">
                Колір / Розмір
              </th>
              {sizes.map(size => (
                <th key={size} className="p-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200 min-w-[100px]">
                  {size}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colors.map((color, rowIdx) => (
              <tr key={color} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="p-3 text-sm font-medium text-slate-700 border-r border-slate-200 sticky left-0 bg-inherit z-10">
                  {color}
                </td>
                {sizes.map(size => {
                  const key = `${color}_${size}`
                  const items = matrix[key] || []
                  
                  return (
                    <td key={size} className="p-2 border-slate-100 border">
                      {items.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-center">
                          {items.map(item => (
                            <div
                              key={item.product_id}
                              onClick={() => onHighlight(item.sku)}
                              className={cls(
                                'group relative cursor-pointer',
                                highlightedSku === item.sku && 'ring-2 ring-amber-400 rounded-lg'
                              )}
                            >
                              <div className="w-14 h-14 rounded-lg border border-slate-200 overflow-hidden bg-white hover:border-amber-400 transition-colors relative">
                                {item.cover ? (
                                  <img 
                                    src={getImageUrl(item.cover)} 
                                    alt="" 
                                    className="w-full h-full object-cover"
                                    onError={handleImageError}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <Package className="w-5 h-5" />
                                  </div>
                                )}
                                {/* Бейдж кількості */}
                                {item.quantity > 0 && (
                                  <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full shadow-sm">
                                    {item.quantity}
                                  </div>
                                )}
                              </div>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                                {item.sku}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="w-14 h-14 mx-auto rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                          —
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// List View Component
function ListView({ products, highlightedSku, onHighlight }) {
  // Групуємо по розміру
  const grouped = useMemo(() => {
    const groups = {}
    products.forEach(p => {
      const size = parseSize(p.sku, p.name) || 'Інше'
      if (!groups[size]) groups[size] = []
      groups[size].push(p)
    })
    return groups
  }, [products])

  // Загальна кількість товарів у групі
  const getTotalQty = (items) => items.reduce((sum, p) => sum + (p.quantity || 0), 0)

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([size, items]) => (
        <div key={size} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-slate-700">{size}</span>
              <span className="ml-2 text-xs text-slate-500">({items.length} SKU)</span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
              {getTotalQty(items)} шт
            </span>
          </div>
          <div className="p-3 flex flex-wrap gap-2">
            {items.map(item => (
              <div
                key={item.product_id}
                onClick={() => onHighlight(item.sku)}
                className={cls(
                  'flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all',
                  highlightedSku === item.sku
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                )}
              >
                <div className="w-10 h-10 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex-shrink-0 relative">
                  {item.cover ? (
                    <img src={getImageUrl(item.cover)} alt="" className="w-full h-full object-cover" onError={handleImageError} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Package className="w-4 h-4" />
                    </div>
                  )}
                  {/* Бейдж кількості */}
                  {item.quantity > 0 && (
                    <div className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center px-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full">
                      {item.quantity}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-800">{item.sku}</div>
                  <div className="text-xs text-slate-500 truncate max-w-[150px]">{item.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// RIGHT COLUMN - PRODUCT BINDING PANEL
// ============================================

function ProductBindingPanel({
  familyId,
  assignedProducts,
  allProducts,
  onAssign,
  onRemove,
  onMoveToFamily,
  pendingAdd = [],
  pendingRemove = []
}) {
  const [activeTab, setActiveTab] = useState('add') // 'add' | 'assigned' | 'conflicts'
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedToRemove, setSelectedToRemove] = useState([])
  
  // IDs of pending products
  const pendingAddIds = new Set(pendingAdd.map(p => p.product_id))

  // Товари доступні для додавання
  const availableProducts = useMemo(() => {
    const assignedIds = new Set(assignedProducts.map(p => p.product_id))
    
    return allProducts.filter(p => {
      // Вже призначені до цієї family - не показуємо в Add
      if (assignedIds.has(p.product_id)) return false
      
      // Пошук
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!p.sku?.toLowerCase().includes(q) && !p.name?.toLowerCase().includes(q)) {
          return false
        }
      }
      
      // Фільтр категорії
      if (categoryFilter !== 'all' && p.category !== categoryFilter) {
        return false
      }
      
      return true
    })
  }, [allProducts, assignedProducts, searchQuery, categoryFilter])

  // Конфлікти - товари які вже в іншій family
  const conflicts = useMemo(() => {
    return availableProducts.filter(p => p.family_id && p.family_id !== familyId)
  }, [availableProducts, familyId])

  // Категорії для фільтра
  const categories = useMemo(() => {
    const cats = new Set()
    allProducts.forEach(p => {
      if (p.category) cats.add(p.category)
    })
    return Array.from(cats).sort()
  }, [allProducts])

  const handleAddProduct = (product) => {
    // Pass the whole product object for local add
    onAssign(product)
  }

  const handleRemoveSelected = () => {
    if (selectedToRemove.length === 0) return
    selectedToRemove.forEach(id => onRemove(id))
    setSelectedToRemove([])
  }

  const toggleRemoveSelection = (productId) => {
    setSelectedToRemove(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  if (!familyId) {
    return (
      <div className="w-[420px] flex-shrink-0 bg-white border-l border-slate-200 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Виберіть розмірну сітку</p>
      </div>
    )
  }

  return (
    <div className="w-[420px] flex-shrink-0 bg-white border-l border-slate-200 flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'add', label: 'Додати', icon: Plus },
          { id: 'assigned', label: `Прив'язані (${assignedProducts.length})`, icon: Check },
          { id: 'conflicts', label: `Конфлікти (${conflicts.length})`, icon: AlertTriangle, highlight: conflicts.length > 0 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cls(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            )}
          >
            <tab.icon className={cls('w-4 h-4', tab.highlight && activeTab !== tab.id && 'text-rose-500')} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'add' && (
          <>
            {/* Search & Filter */}
            <div className="p-3 border-b border-slate-100 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Пошук по SKU або назві..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-400"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-400"
              >
                <option value="all">Всі категорії</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            {/* Products List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {availableProducts.filter(p => !p.family_id || p.family_id === familyId).slice(0, 100).map(product => (
                <ProductMiniCard
                  key={product.product_id}
                  product={product}
                  action={
                    <button
                      onClick={() => handleAddProduct(product)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Додати"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  }
                />
              ))}
              {availableProducts.filter(p => !p.family_id).length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  {searchQuery ? 'Нічого не знайдено' : 'Всі товари вже прив\'язані'}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'assigned' && (
          <>
            {/* Actions */}
            {assignedProducts.length > 0 && (
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  {selectedToRemove.length > 0 
                    ? `Вибрано: ${selectedToRemove.length}`
                    : `${assignedProducts.length} товарів`
                  }
                  {pendingAdd.length > 0 && (
                    <span className="ml-2 text-emerald-600">(+{pendingAdd.length} нових)</span>
                  )}
                  {pendingRemove.length > 0 && (
                    <span className="ml-2 text-rose-600">(-{pendingRemove.length} видалити)</span>
                  )}
                </span>
                {selectedToRemove.length > 0 && (
                  <button
                    onClick={handleRemoveSelected}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Видалити
                  </button>
                )}
              </div>
            )}
            
            {/* Assigned Products */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {assignedProducts.map(product => (
                <ProductMiniCard
                  key={product.product_id}
                  product={product}
                  selected={selectedToRemove.includes(product.product_id)}
                  onSelect={() => toggleRemoveSelection(product.product_id)}
                  showCheckbox
                  badge={product._isPending && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                      + новий
                    </span>
                  )}
                />
              ))}
              {assignedProducts.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Немає прив'язаних товарів
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'conflicts' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conflicts.map(product => (
              <ProductMiniCard
                key={product.product_id}
                product={product}
                badge={
                  <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                    в іншій сітці
                  </span>
                }
                action={
                  <button
                    onClick={() => onMoveToFamily(product.product_id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    title="Перемістити сюди"
                  >
                    <Move className="w-3 h-3" />
                    Сюди
                  </button>
                }
              />
            ))}
            {conflicts.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                Немає конфліктів
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Mini Product Card
function ProductMiniCard({ product, action, badge, selected, onSelect, showCheckbox }) {
  return (
    <div className={cls(
      'flex items-center gap-3 p-2 rounded-lg border transition-all',
      selected ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300 bg-white'
    )}>
      {showCheckbox && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
        />
      )}
      <div className="w-10 h-10 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex-shrink-0">
        {product.image || product.cover || product.image_url ? (
          <img 
            src={getImageUrl(product.image || product.cover || product.image_url)} 
            alt="" 
            className="w-full h-full object-cover"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Package className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">{product.sku}</span>
          {badge}
        </div>
        <p className="text-xs text-slate-500 truncate">{product.name}</p>
      </div>
      {action}
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function FamiliesManager() {
  const [families, setFamilies] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [selectedFamily, setSelectedFamily] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Pending changes (not yet saved to server)
  const [pendingAdd, setPendingAdd] = useState([])      // Products to add
  const [pendingRemove, setPendingRemove] = useState([]) // Products to remove
  
  const hasChanges = pendingAdd.length > 0 || pendingRemove.length > 0
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterHasProducts, setFilterHasProducts] = useState('all')

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [familiesRes, productsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/catalog/families`),
        fetch(`${BACKEND_URL}/api/catalog?limit=5000`)
      ])
      
      if (familiesRes.ok) {
        const data = await familiesRes.json()
        setFamilies(data || [])
      }
      
      if (productsRes.ok) {
        const data = await productsRes.json()
        // API returns array directly, not {items: [...]}
        const items = Array.isArray(data) ? data : (data.items || [])
        setAllProducts(items)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Create new family
  const handleCreateFamily = async () => {
    const name = prompt('Назва нової розмірної сітки:')
    if (!name?.trim()) return

    try {
      const response = await fetch(`${BACKEND_URL}/api/catalog/families`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: '' })
      })
      
      if (response.ok) {
        const result = await response.json()
        await loadData()
        // Select the new family
        const newFamily = families.find(f => f.id === result.family_id) || { id: result.family_id, name, products: [] }
        setSelectedFamily(newFamily)
      }
    } catch (error) {
      console.error('Error creating family:', error)
      alert('Помилка створення')
    }
  }

  // Save family - send all pending changes to server
  const handleSaveFamily = async (data) => {
    if (!selectedFamily) return
    
    setSaving(true)
    try {
      // 0. Update name/description if changed
      if (data.nameChanged || data.descriptionChanged) {
        const updateResponse = await fetch(`${BACKEND_URL}/api/catalog/families/${selectedFamily.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: data.name, 
            description: data.description 
          })
        })
        if (!updateResponse.ok) {
          console.warn('Failed to update family name/description')
        }
      }
      
      // 1. Add pending products
      if (pendingAdd.length > 0) {
        const response = await fetch(`${BACKEND_URL}/api/catalog/families/${selectedFamily.id}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_ids: pendingAdd.map(p => p.product_id) })
        })
        if (!response.ok) {
          throw new Error('Failed to add products')
        }
      }
      
      // 2. Remove pending products
      for (const productId of pendingRemove) {
        await fetch(`${BACKEND_URL}/api/catalog/products/${productId}/remove-family`, {
          method: 'POST'
        })
      }
      
      // Clear pending changes
      setPendingAdd([])
      setPendingRemove([])
      
      // Reload data
      await loadData()
      
      // Re-select family to refresh
      const updated = families.find(f => f.id === selectedFamily.id)
      if (updated) setSelectedFamily(updated)
      
      alert(`✅ Збережено! Додано: ${pendingAdd.length}, Видалено: ${pendingRemove.length}`)
    } catch (error) {
      console.error('Error saving:', error)
      alert('Помилка збереження')
    } finally {
      setSaving(false)
    }
  }

  // Delete family
  const handleDeleteFamily = async () => {
    if (!selectedFamily) return
    if (!confirm(`Видалити "${selectedFamily.name}"? Товари залишаться, але будуть відв'язані.`)) return

    try {
      const response = await fetch(`${BACKEND_URL}/api/catalog/families/${selectedFamily.id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setSelectedFamily(null)
        setPendingAdd([])
        setPendingRemove([])
        await loadData()
      }
    } catch (error) {
      console.error('Error deleting:', error)
      alert('Помилка видалення')
    }
  }

  // Add product to pending (locally, without API call)
  const handleAddProductLocal = (product) => {
    // Check if already in pending
    if (pendingAdd.find(p => p.product_id === product.product_id)) return
    // Check if in pendingRemove - just remove from there
    if (pendingRemove.includes(product.product_id)) {
      setPendingRemove(prev => prev.filter(id => id !== product.product_id))
      return
    }
    setPendingAdd(prev => [...prev, product])
  }

  // Remove product locally (add to pendingRemove)
  const handleRemoveProductLocal = (productId) => {
    // If in pendingAdd - just remove from there
    if (pendingAdd.find(p => p.product_id === productId)) {
      setPendingAdd(prev => prev.filter(p => p.product_id !== productId))
      return
    }
    // Otherwise add to pendingRemove
    if (!pendingRemove.includes(productId)) {
      setPendingRemove(prev => [...prev, productId])
    }
  }

  // Move product to current family (from another)
  const handleMoveToFamily = (productId) => {
    const product = allProducts.find(p => p.product_id === productId)
    if (product) {
      handleAddProductLocal(product)
    }
  }

  // Get assigned products for selected family (including pending)
  const assignedProducts = useMemo(() => {
    if (!selectedFamily) return []
    
    // Start with products from API
    let products = []
    if (selectedFamily.products && selectedFamily.products.length > 0) {
      products = [...selectedFamily.products]
    } else {
      products = allProducts.filter(p => p.family_id === selectedFamily.id)
    }
    
    // Remove products that are in pendingRemove
    products = products.filter(p => !pendingRemove.includes(p.product_id))
    
    // Add pending products (mark them as pending)
    const pendingWithFlag = pendingAdd.map(p => ({ ...p, _isPending: true }))
    products = [...products, ...pendingWithFlag]
    
    return products
  }, [allProducts, selectedFamily, pendingAdd, pendingRemove])

  // Clear pending when family changes
  useEffect(() => {
    setPendingAdd([])
    setPendingRemove([])
  }, [selectedFamily?.id])

  // Update selected family when families change
  useEffect(() => {
    if (selectedFamily) {
      const updated = families.find(f => f.id === selectedFamily.id)
      if (updated) {
        // Keep products from the updated family
        setSelectedFamily({ ...updated })
      }
    }
  }, [families])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-slate-500">Завантаження...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex bg-slate-100">
      {/* Left Column - Families List */}
      <FamiliesList
        families={families}
        selectedId={selectedFamily?.id}
        onSelect={(f) => setSelectedFamily(f)}
        onCreate={handleCreateFamily}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterHasProducts={filterHasProducts}
        onFilterChange={setFilterHasProducts}
      />
      
      {/* Center Column - Family Detail */}
      <FamilyDetail
        family={{ ...selectedFamily, products: assignedProducts }}
        onSave={handleSaveFamily}
        onDelete={handleDeleteFamily}
        saving={saving}
        hasChanges={hasChanges}
        pendingAdd={pendingAdd}
        pendingRemove={pendingRemove}
      />
      
      {/* Right Column - Product Binding */}
      <ProductBindingPanel
        familyId={selectedFamily?.id}
        assignedProducts={assignedProducts}
        allProducts={allProducts}
        onAssign={handleAddProductLocal}
        onRemove={handleRemoveProductLocal}
        onMoveToFamily={handleMoveToFamily}
        pendingAdd={pendingAdd}
        pendingRemove={pendingRemove}
      />
    </div>
  )
}
