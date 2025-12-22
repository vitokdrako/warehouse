/* eslint-disable */
// Каталог товарів - гнучкий інструмент перегляду для менеджера
// Вкладки: Товари | Набори
// Sidebar зліва: дати, категорії, фільтри | Справа: товари

import React, { useState, useEffect, useMemo } from 'react'
import { getImageUrl, handleImageError } from '../utils/imageHelper'
import CorporateHeader from '../components/CorporateHeader'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

// Utility functions
const cls = (...a) => a.filter(Boolean).join(' ')
const fmtUA = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })

// Badge component
function Badge({ children, variant = 'default' }) {
  const variants = {
    default: 'bg-corp-bg-light text-corp-text-main border-corp-border',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    primary: 'bg-corp-primary/10 text-corp-primary border-corp-primary/30'
  }
  return (
    <span className={cls('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', variants[variant])}>
      {children}
    </span>
  )
}

// ============================================
// SETS TAB COMPONENTS
// ============================================

// Set Card
function SetCard({ set, onEdit, onDelete }) {
  return (
    <div className="bg-white rounded-xl border border-corp-border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Image */}
        <div className="w-24 h-24 rounded-lg bg-corp-bg-light flex-shrink-0 overflow-hidden">
          {set.image_url ? (
            <img src={set.image_url} alt={set.name} className="w-full h-full object-cover" />
          ) : set.items[0]?.image ? (
            <img src={getImageUrl(set.items[0].image)} alt={set.name} className="w-full h-full object-cover" onError={handleImageError} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl text-corp-text-muted">📦</div>
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-corp-text-dark truncate">{set.name}</h3>
            {!set.is_active && <Badge variant="warning">Неактивний</Badge>}
          </div>
          {set.description && (
            <p className="text-sm text-corp-text-muted line-clamp-2 mb-2">{set.description}</p>
          )}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-corp-text-muted">{set.items_count} товарів</span>
            <span className="font-semibold text-corp-primary">{fmtUA(set.final_price)} ₴</span>
            {set.set_price && set.set_price !== set.calculated_price && (
              <span className="text-xs text-corp-text-muted line-through">{fmtUA(set.calculated_price)} ₴</span>
            )}
          </div>
          
          {/* Items preview */}
          <div className="flex flex-wrap gap-1 mt-2">
            {set.items.slice(0, 4).map((item, idx) => (
              <span key={idx} className="text-xs bg-corp-bg-light px-2 py-0.5 rounded">
                {item.name.slice(0, 20)}{item.name.length > 20 ? '...' : ''} x{item.quantity}
              </span>
            ))}
            {set.items.length > 4 && (
              <span className="text-xs text-corp-text-muted">+{set.items.length - 4}</span>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col gap-1">
          <button onClick={() => onEdit(set)} className="p-2 text-corp-text-muted hover:text-corp-primary rounded-lg hover:bg-corp-bg-light transition-colors">
            ✏️
          </button>
          <button onClick={() => onDelete(set.id)} className="p-2 text-corp-text-muted hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors">
            🗑️
          </button>
        </div>
      </div>
    </div>
  )
}

// Create/Edit Set Modal
function SetModal({ set, products, onClose, onSave }) {
  const [name, setName] = useState(set?.name || '')
  const [description, setDescription] = useState(set?.description || '')
  const [setPrice, setSetPrice] = useState(set?.set_price || '')
  const [items, setItems] = useState(set?.items?.map(i => ({ product_id: i.product_id, quantity: i.quantity, name: i.name, rental_price: i.rental_price })) || [])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  
  // Filter products for search
  const filteredProducts = useMemo(() => {
    if (!search) return []
    const term = search.toLowerCase()
    return products.filter(p => 
      p.sku?.toLowerCase().includes(term) || 
      p.name?.toLowerCase().includes(term)
    ).slice(0, 10)
  }, [products, search])
  
  // Calculate total
  const calculatedPrice = items.reduce((sum, i) => sum + (i.rental_price || 0) * i.quantity, 0)
  
  const addProduct = (product) => {
    const existing = items.find(i => i.product_id === product.product_id)
    if (existing) {
      setItems(items.map(i => i.product_id === product.product_id ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      setItems([...items, { product_id: product.product_id, quantity: 1, name: product.name, rental_price: product.rental_price }])
    }
    setSearch('')
  }
  
  const updateQty = (productId, qty) => {
    if (qty < 1) {
      setItems(items.filter(i => i.product_id !== productId))
    } else {
      setItems(items.map(i => i.product_id === productId ? { ...i, quantity: qty } : i))
    }
  }
  
  const removeItem = (productId) => {
    setItems(items.filter(i => i.product_id !== productId))
  }
  
  const handleSave = async () => {
    if (!name.trim()) return alert('Введіть назву набору')
    if (items.length === 0) return alert('Додайте товари до набору')
    
    setSaving(true)
    try {
      await onSave({
        id: set?.id,
        name: name.trim(),
        description: description.trim() || null,
        set_price: setPrice ? parseFloat(setPrice) : null,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity }))
      })
      onClose()
    } catch (err) {
      alert('Помилка збереження: ' + err.message)
    } finally {
      setSaving(false)
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-corp-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-corp-text-dark">
              {set ? 'Редагувати набір' : 'Новий набір'}
            </h2>
            <button onClick={onClose} className="text-corp-text-muted hover:text-corp-text-dark text-2xl">×</button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-corp-text-dark block mb-1">Назва набору *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад: Весільний комплект"
              className="w-full rounded-lg border border-corp-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-corp-primary/30"
            />
          </div>
          
          {/* Description */}
          <div>
            <label className="text-sm font-medium text-corp-text-dark block mb-1">Опис</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опис набору..."
              rows={2}
              className="w-full rounded-lg border border-corp-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-corp-primary/30"
            />
          </div>
          
          {/* Add products */}
          <div>
            <label className="text-sm font-medium text-corp-text-dark block mb-1">Додати товари</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Пошук по SKU або назві..."
                className="w-full rounded-lg border border-corp-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-corp-primary/30"
              />
              {filteredProducts.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-corp-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {filteredProducts.map(p => (
                    <button
                      key={p.product_id}
                      onClick={() => addProduct(p)}
                      className="w-full text-left px-3 py-2 hover:bg-corp-bg-light flex items-center gap-2"
                    >
                      <span className="text-xs text-corp-text-muted">{p.sku}</span>
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-sm text-corp-primary">{fmtUA(p.rental_price)} ₴</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Items list */}
          {items.length > 0 && (
            <div>
              <label className="text-sm font-medium text-corp-text-dark block mb-2">Товари в наборі ({items.length})</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-corp-bg-light rounded-lg p-2">
                    <span className="flex-1 text-sm truncate">{item.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.product_id, item.quantity - 1)} className="w-6 h-6 rounded bg-white border hover:bg-corp-bg-page">-</button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product_id, item.quantity + 1)} className="w-6 h-6 rounded bg-white border hover:bg-corp-bg-page">+</button>
                    </div>
                    <span className="text-sm text-corp-primary w-20 text-right">{fmtUA(item.rental_price * item.quantity)} ₴</span>
                    <button onClick={() => removeItem(item.product_id)} className="text-rose-500 hover:text-rose-700">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-corp-text-dark block mb-1">Сума товарів</label>
              <div className="text-lg font-semibold text-corp-text-dark">{fmtUA(calculatedPrice)} ₴</div>
            </div>
            <div>
              <label className="text-sm font-medium text-corp-text-dark block mb-1">Ціна набору (знижка)</label>
              <input
                type="number"
                value={setPrice}
                onChange={(e) => setSetPrice(e.target.value)}
                placeholder={calculatedPrice.toString()}
                className="w-full rounded-lg border border-corp-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-corp-primary/30"
              />
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-corp-border flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-corp-text-muted hover:text-corp-text-dark">
            Скасувати
          </button>
          <button 
            onClick={handleSave}
            disabled={saving || !name.trim() || items.length === 0}
            className="px-6 py-2 bg-corp-primary text-white rounded-lg hover:bg-corp-primary/90 disabled:opacity-50"
          >
            {saving ? 'Збереження...' : (set ? 'Зберегти' : 'Створити')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Sets Tab Content
function SetsTab({ products }) {
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingSet, setEditingSet] = useState(null)
  const [showModal, setShowModal] = useState(false)
  
  useEffect(() => {
    loadSets()
  }, [])
  
  const loadSets = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${BACKEND_URL}/api/product-sets`)
      const data = await res.json()
      setSets(data.sets || [])
    } catch (err) {
      console.error('Error loading sets:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const handleSave = async (setData) => {
    const method = setData.id ? 'PUT' : 'POST'
    const url = setData.id ? `${BACKEND_URL}/api/product-sets/${setData.id}` : `${BACKEND_URL}/api/product-sets`
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(setData)
    })
    
    if (!res.ok) throw new Error('Failed to save')
    await loadSets()
  }
  
  const handleDelete = async (setId) => {
    if (!confirm('Видалити набір?')) return
    
    await fetch(`${BACKEND_URL}/api/product-sets/${setId}`, { method: 'DELETE' })
    await loadSets()
  }
  
  const openCreate = () => {
    setEditingSet(null)
    setShowModal(true)
  }
  
  const openEdit = (set) => {
    setEditingSet(set)
    setShowModal(true)
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-corp-text-dark">Набори товарів</h2>
          <p className="text-sm text-corp-text-muted">Комплекти для швидкого додавання до замовлень</p>
        </div>
        <button 
          onClick={openCreate}
          className="px-4 py-2 bg-corp-primary text-white rounded-lg hover:bg-corp-primary/90 font-medium"
        >
          + Новий набір
        </button>
      </div>
      
      {/* Sets list */}
      {loading ? (
        <div className="text-center py-12 text-corp-text-muted">Завантаження...</div>
      ) : sets.length === 0 ? (
        <div className="bg-white rounded-xl border border-corp-border p-12 text-center">
          <div className="text-4xl mb-4">📦</div>
          <div className="text-corp-text-muted mb-4">Наборів ще немає</div>
          <button onClick={openCreate} className="text-corp-primary hover:underline">
            Створити перший набір
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sets.map(set => (
            <SetCard key={set.id} set={set} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}
      
      {/* Modal */}
      {showModal && (
        <SetModal
          set={editingSet}
          products={products}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

// ============================================
// PRODUCTS TAB (existing Sidebar)
// ============================================

// Sidebar Component - All filters on the left
function Sidebar({ 
  categories, 
  selectedCategory, 
  onSelectCategory,
  filters,
  setFilters,
  colors,
  materials,
  dateRange,
  setDateRange,
  onResetAll,
  loading 
}) {
  // Get subcategories for selected category
  const subcategories = selectedCategory.category 
    ? categories.find(c => c.name === selectedCategory.category)?.subcategories || []
    : []
  
  const totalProducts = categories.reduce((sum, c) => sum + c.product_count, 0)
  
  return (
    <aside className="w-72 flex-shrink-0 space-y-4">
      {/* Date Range */}
      <div className="bg-gradient-to-br from-sky-50 to-indigo-50 rounded-xl border border-sky-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📅</span>
          <h3 className="font-semibold text-corp-text-dark text-sm">Перевірка доступності</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-corp-text-muted font-medium block mb-1">Дата початку</label>
            <input
              type="date"
              value={dateRange.dateFrom}
              onChange={(e) => setDateRange({ ...dateRange, dateFrom: e.target.value })}
              className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-corp-text-muted font-medium block mb-1">Дата закінчення</label>
            <input
              type="date"
              value={dateRange.dateTo}
              onChange={(e) => setDateRange({ ...dateRange, dateTo: e.target.value })}
              min={dateRange.dateFrom}
              className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 bg-white"
            />
          </div>
          {dateRange.dateFrom && dateRange.dateTo && (
            <div className="text-xs text-sky-700 bg-sky-100 rounded-lg px-3 py-2">
              Період: {dateRange.dateFrom} — {dateRange.dateTo}
            </div>
          )}
        </div>
      </div>
      
      {/* Categories */}
      <div className="bg-white rounded-xl border border-corp-border p-4">
        <h3 className="font-semibold text-corp-text-dark text-sm mb-3">Категорія</h3>
        <div className="space-y-3">
          <select
            value={selectedCategory.category || ''}
            onChange={(e) => onSelectCategory({ category: e.target.value || null, subcategory: null })}
            disabled={loading}
            className="w-full rounded-lg border border-corp-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-corp-primary/30 focus:border-corp-primary bg-white"
          >
            <option value="">Всі категорії ({totalProducts})</option>
            {categories.map(cat => (
              <option key={cat.name} value={cat.name}>
                {cat.name} ({cat.product_count})
              </option>
            ))}
          </select>
          
          <div>
            <label className="text-xs text-corp-text-muted font-medium block mb-1">Підкатегорія</label>
            <select
              value={selectedCategory.subcategory || ''}
              onChange={(e) => onSelectCategory({ ...selectedCategory, subcategory: e.target.value || null })}
              disabled={!selectedCategory.category || loading}
              className={cls(
                "w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-corp-primary/30 bg-white",
                !selectedCategory.category 
                  ? "border-corp-border/50 text-corp-text-muted" 
                  : "border-corp-border focus:border-corp-primary"
              )}
            >
              <option value="">
                {selectedCategory.category 
                  ? `Всі (${subcategories.reduce((s, sub) => s + sub.product_count, 0)})` 
                  : 'Оберіть категорію'}
              </option>
              {subcategories.map(sub => (
                <option key={sub.name} value={sub.name}>
                  {sub.name} ({sub.product_count})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-xl border border-corp-border p-4">
        <h3 className="font-semibold text-corp-text-dark text-sm mb-3">Фільтри</h3>
        <div className="space-y-3">
          {/* Search */}
          <div>
            <label className="text-xs text-corp-text-muted font-medium block mb-1">Пошук</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="SKU, назва, колір..."
              className="w-full rounded-lg border border-corp-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-corp-primary/30 focus:border-corp-primary"
            />
          </div>
          
          {/* Color */}
          <div>
            <label className="text-xs text-corp-text-muted font-medium block mb-1">Колір</label>
            <select
              value={filters.color}
              onChange={(e) => setFilters({ ...filters, color: e.target.value })}
              className="w-full rounded-lg border border-corp-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-corp-primary/30"
            >
              <option value="">Всі кольори</option>
              {colors.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          
          {/* Material */}
          <div>
            <label className="text-xs text-corp-text-muted font-medium block mb-1">Матеріал</label>
            <select
              value={filters.material}
              onChange={(e) => setFilters({ ...filters, material: e.target.value })}
              className="w-full rounded-lg border border-corp-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-corp-primary/30"
            >
              <option value="">Всі матеріали</option>
              {materials.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          
          {/* Quantity */}
          <div>
            <label className="text-xs text-corp-text-muted font-medium block mb-1">Кількість</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={filters.minQty}
                onChange={(e) => setFilters({ ...filters, minQty: e.target.value })}
                placeholder="від"
                min="0"
                className="w-1/2 rounded-lg border border-corp-border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-corp-primary/30"
              />
              <input
                type="number"
                value={filters.maxQty}
                onChange={(e) => setFilters({ ...filters, maxQty: e.target.value })}
                placeholder="до"
                min="0"
                className="w-1/2 rounded-lg border border-corp-border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-corp-primary/30"
              />
            </div>
          </div>
          
          {/* Availability */}
          <div>
            <label className="text-xs text-corp-text-muted font-medium block mb-1">Наявність</label>
            <select
              value={filters.availability}
              onChange={(e) => setFilters({ ...filters, availability: e.target.value })}
              className="w-full rounded-lg border border-corp-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-corp-primary/30"
            >
              <option value="">Всі</option>
              <option value="available">Доступні</option>
              <option value="in_rent">В оренді (видані)</option>
              <option value="reserved">Резерв (очікують)</option>
              <option value="on_wash">На мийці</option>
              <option value="on_restoration">На реставрації</option>
              <option value="on_laundry">В хімчистці</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Reset button */}
      <button
        onClick={onResetAll}
        className="w-full py-2.5 text-sm text-corp-text-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-corp-border transition-colors"
      >
        Скинути все
      </button>
    </aside>
  )
}

// Product Card
function ProductCard({ item, onClick, dateFilterActive }) {
  const hasConflict = item.has_conflict
  const hasRentals = item.who_has?.length > 0
  const hasProcessing = (item.on_wash || 0) + (item.on_restoration || 0) + (item.on_laundry || 0) > 0
  
  return (
    <div 
      onClick={onClick}
      className={cls(
        'bg-white rounded-xl border p-3 hover:shadow-md transition-shadow cursor-pointer group',
        hasConflict ? 'border-rose-300 bg-rose-50/30' : 'border-corp-border'
      )}
    >
      {/* Image */}
      <div className="relative mb-3">
        <img
          src={getImageUrl(item.image)}
          alt={item.name}
          className="w-full h-28 object-cover rounded-lg bg-corp-bg-light"
          onError={handleImageError}
        />
        {/* Status badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {hasConflict && (
            <Badge variant="error">Конфлікт</Badge>
          )}
          {item.in_rent > 0 && !hasConflict && (
            <Badge variant="warning">{item.in_rent} вид.</Badge>
          )}
          {item.reserved > 0 && !hasConflict && (
            <Badge variant="info">{item.reserved} рез.</Badge>
          )}
          {item.on_wash > 0 && (
            <Badge variant="default">{item.on_wash} мий.</Badge>
          )}
          {item.on_restoration > 0 && (
            <Badge variant="default">{item.on_restoration} рест.</Badge>
          )}
          {item.on_laundry > 0 && (
            <Badge variant="default">{item.on_laundry} хім.</Badge>
          )}
        </div>
      </div>
      
      {/* Info */}
      <div className="space-y-1">
        <div className="text-xs text-corp-text-muted">{item.sku}</div>
        <div className="font-medium text-corp-text-dark text-sm line-clamp-2 group-hover:text-corp-primary transition-colors min-h-[40px]">
          {item.name}
        </div>
        
        {/* Properties - compact */}
        {(item.color || item.material) && (
          <div className="flex flex-wrap gap-1">
            {item.color && (
              <span className="text-xs bg-corp-bg-light px-1.5 py-0.5 rounded text-corp-text-muted">{item.color}</span>
            )}
            {item.material && (
              <span className="text-xs bg-corp-bg-light px-1.5 py-0.5 rounded text-corp-text-muted">{item.material}</span>
            )}
          </div>
        )}
        
        {/* Stock info */}
        <div className="flex items-center justify-between pt-2 border-t border-corp-border">
          <span className={cls(
            'text-sm font-semibold',
            item.available > 0 ? 'text-emerald-600' : 'text-rose-600'
          )}>
            {item.available}/{item.total}
          </span>
          {item.rental_price > 0 && (
            <span className="text-xs font-medium text-corp-primary">
              {fmtUA(item.rental_price)} ₴
            </span>
          )}
        </div>
        
        {/* Who has it */}
        {hasRentals && (
          <div className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 truncate">
            {item.who_has[0].customer}
            {item.who_has.length > 1 && ` +${item.who_has.length - 1}`}
          </div>
        )}
      </div>
    </div>
  )
}

// Product Detail Modal
function ProductDetailModal({ item, onClose, dateFilterActive }) {
  if (!item) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm text-corp-text-muted">{item.sku}</div>
              <h2 className="text-xl font-bold text-corp-text-dark">{item.name}</h2>
              {item.category && (
                <div className="text-sm text-corp-text-muted mt-1">
                  {item.category}{item.subcategory ? ` / ${item.subcategory}` : ''}
                </div>
              )}
            </div>
            <button 
              onClick={onClose}
              className="text-corp-text-muted hover:text-corp-text-dark text-2xl leading-none"
            >
              ×
            </button>
          </div>
          
          {/* Conflict warning */}
          {item.has_conflict && (
            <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-rose-700 font-semibold mb-1">
                <span>⚠️</span> Конфлікт на вибраний період
              </div>
              <p className="text-sm text-rose-600">
                Товар недоступний на вибрані дати.
              </p>
            </div>
          )}
          
          {/* Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image */}
            <div>
              <img
                src={getImageUrl(item.image)}
                alt={item.name}
                className="w-full h-64 object-cover rounded-xl bg-corp-bg-light"
                onError={handleImageError}
              />
            </div>
            
            {/* Info */}
            <div className="space-y-4">
              {/* Stock */}
              <div className="bg-corp-bg-page rounded-xl p-4">
                <h3 className="font-semibold text-corp-text-dark mb-3 text-sm">
                  Наявність {dateFilterActive && '(на період)'}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className={cls(
                    'rounded-lg p-3 border',
                    item.available > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                  )}>
                    <div className={cls(
                      'text-2xl font-bold',
                      item.available > 0 ? 'text-emerald-600' : 'text-rose-600'
                    )}>{item.available}</div>
                    <div className="text-xs text-corp-text-muted">Доступно</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-corp-border">
                    <div className="text-2xl font-bold text-corp-text-dark">{item.total}</div>
                    <div className="text-xs text-corp-text-muted">Всього</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-corp-border">
                    <div className="text-2xl font-bold text-amber-600">{item.in_rent}</div>
                    <div className="text-xs text-corp-text-muted">Видано</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-corp-border">
                    <div className="text-2xl font-bold text-sky-600">{item.reserved}</div>
                    <div className="text-xs text-corp-text-muted">Резерв</div>
                  </div>
                </div>
                
                {/* Processing statuses */}
                {((item.on_wash || 0) + (item.on_restoration || 0) + (item.on_laundry || 0) > 0) && (
                  <div className="mt-3 pt-3 border-t border-corp-border">
                    <div className="text-xs text-corp-text-muted mb-2">На обробці:</div>
                    <div className="flex flex-wrap gap-2">
                      {item.on_wash > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg">
                          Мийка: {item.on_wash}
                        </span>
                      )}
                      {item.on_restoration > 0 && (
                        <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-lg">
                          Реставрація: {item.on_restoration}
                        </span>
                      )}
                      {item.on_laundry > 0 && (
                        <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg">
                          Хімчистка: {item.on_laundry}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Location */}
              {(item.location?.zone || item.location?.aisle || item.location?.shelf) && (
                <div className="bg-corp-bg-page rounded-xl p-4">
                  <h3 className="font-semibold text-corp-text-dark mb-2 text-sm">Розташування</h3>
                  <div className="flex gap-4 text-sm">
                    {item.location.zone && <div><span className="text-corp-text-muted">Зона:</span> <b>{item.location.zone}</b></div>}
                    {item.location.aisle && <div><span className="text-corp-text-muted">Ряд:</span> <b>{item.location.aisle}</b></div>}
                    {item.location.shelf && <div><span className="text-corp-text-muted">Полиця:</span> <b>{item.location.shelf}</b></div>}
                  </div>
                </div>
              )}
              
              {/* Properties */}
              <div className="bg-corp-bg-page rounded-xl p-4">
                <h3 className="font-semibold text-corp-text-dark mb-2 text-sm">Характеристики</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {item.color && <div><span className="text-corp-text-muted">Колір:</span> <b>{item.color}</b></div>}
                  {item.material && <div><span className="text-corp-text-muted">Матеріал:</span> <b>{item.material}</b></div>}
                  {item.size && <div><span className="text-corp-text-muted">Розмір:</span> <b>{item.size}</b></div>}
                  {item.rental_price > 0 && <div><span className="text-corp-text-muted">Оренда:</span> <b className="text-corp-primary">{fmtUA(item.rental_price)} ₴</b></div>}
                </div>
              </div>
            </div>
          </div>
          
          {/* Who has - Bookings */}
          {item.who_has?.length > 0 && (
            <div className={cls(
              'mt-6 border rounded-xl p-4',
              item.has_conflict ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
            )}>
              <h3 className={cls(
                'font-semibold mb-3 text-sm',
                item.has_conflict ? 'text-rose-800' : 'text-amber-800'
              )}>
                {item.has_conflict ? 'Конфліктуючі бронювання' : 'Бронювання'} ({item.who_has.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {item.who_has.map((rental, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border border-amber-200 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-corp-text-dark">{rental.customer}</div>
                        <div className="text-xs text-corp-text-muted">
                          #{rental.order_number} · {rental.qty} шт · {rental.status}
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="font-medium text-amber-700">{rental.start_date} → {rental.return_date}</div>
                        {rental.phone && <div className="text-corp-text-muted">{rental.phone}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Main Component
export default function CatalogBoard() {
  const [activeTab, setActiveTab] = useState('products') // 'products' | 'sets'
  const [loading, setLoading] = useState(true)
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [colors, setColors] = useState([])
  const [materials, setMaterials] = useState([])
  const [items, setItems] = useState([])
  const [allProducts, setAllProducts] = useState([]) // For sets modal
  const [stats, setStats] = useState({ 
    total: 0, available: 0, in_rent: 0, reserved: 0,
    on_wash: 0, on_restoration: 0, on_laundry: 0 
  })
  const [selectedCategory, setSelectedCategory] = useState({ category: null, subcategory: null })
  const [filters, setFilters] = useState({
    search: '',
    color: '',
    material: '',
    minQty: '',
    maxQty: '',
    availability: ''
  })
  const [dateRange, setDateRange] = useState({ dateFrom: '', dateTo: '' })
  const [dateFilterActive, setDateFilterActive] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)

  // Load categories on mount
  useEffect(() => {
    loadCategories()
    loadAllProducts()
  }, [])

  // Load items when filters change
  useEffect(() => {
    loadItems()
  }, [selectedCategory, filters, dateRange])

  const loadCategories = async () => {
    try {
      setCategoriesLoading(true)
      const res = await fetch(`${BACKEND_URL}/api/catalog/categories`)
      const data = await res.json()
      setCategories(data.categories || [])
      setColors(data.colors || [])
      setMaterials(data.materials || [])
    } catch (err) {
      console.error('Error loading categories:', err)
    } finally {
      setCategoriesLoading(false)
    }
  }

  const loadAllProducts = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/catalog/items-by-category?limit=2000`)
      const data = await res.json()
      setAllProducts(data.items || [])
    } catch (err) {
      console.error('Error loading all products:', err)
    }
  }

  const loadItems = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams()
      if (selectedCategory.category) params.append('category', selectedCategory.category)
      if (selectedCategory.subcategory) params.append('subcategory', selectedCategory.subcategory)
      if (filters.search) params.append('search', filters.search)
      if (filters.color) params.append('color', filters.color)
      if (filters.material) params.append('material', filters.material)
      if (filters.minQty) params.append('min_qty', filters.minQty)
      if (filters.maxQty) params.append('max_qty', filters.maxQty)
      if (filters.availability) params.append('availability', filters.availability)
      if (dateRange.dateFrom) params.append('date_from', dateRange.dateFrom)
      if (dateRange.dateTo) params.append('date_to', dateRange.dateTo)
      
      const res = await fetch(`${BACKEND_URL}/api/catalog/items-by-category?${params}`)
      const data = await res.json()
      setItems(data.items || [])
      setStats(data.stats || { total: 0, available: 0, in_rent: 0, reserved: 0 })
      setDateFilterActive(data.date_filter_active || false)
    } catch (err) {
      console.error('Error loading items:', err)
    } finally {
      setLoading(false)
    }
  }

  const resetAll = () => {
    setFilters({ search: '', color: '', material: '', minQty: '', maxQty: '', availability: '' })
    setDateRange({ dateFrom: '', dateTo: '' })
    setSelectedCategory({ category: null, subcategory: null })
  }

  // Count conflicts
  const conflictCount = useMemo(() => items.filter(i => i.has_conflict).length, [items])

  return (
    <div className="min-h-screen bg-corp-bg-page font-montserrat">
      <CorporateHeader cabinetName="Каталог" />
      
      {/* Tabs */}
      <div className="bg-white border-b border-corp-border">
        <div className="max-w-[1800px] mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('products')}
              className={cls(
                'px-6 py-3 font-medium text-sm border-b-2 transition-colors',
                activeTab === 'products'
                  ? 'border-corp-primary text-corp-primary'
                  : 'border-transparent text-corp-text-muted hover:text-corp-text-dark'
              )}
            >
              Товари
            </button>
            <button
              onClick={() => setActiveTab('sets')}
              className={cls(
                'px-6 py-3 font-medium text-sm border-b-2 transition-colors',
                activeTab === 'sets'
                  ? 'border-corp-primary text-corp-primary'
                  : 'border-transparent text-corp-text-muted hover:text-corp-text-dark'
              )}
            >
              Набори
            </button>
          </div>
        </div>
      </div>
      
      <div className="max-w-[1800px] mx-auto px-4 py-4">
        <div className="flex gap-4">
          {/* Left Sidebar */}
          <Sidebar
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            filters={filters}
            setFilters={setFilters}
            colors={colors}
            materials={materials}
            dateRange={dateRange}
            setDateRange={setDateRange}
            onResetAll={resetAll}
            loading={categoriesLoading}
          />
          
          {/* Right Content */}
          <main className="flex-1 space-y-4">
            {/* Stats bar */}
            <div className="bg-white rounded-xl border border-corp-border p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-[60px]">
                  <div className="text-xl font-bold text-corp-text-dark">{items.length}</div>
                  <div className="text-xs text-corp-text-muted">Знайдено</div>
                </div>
                <div className="border-l border-corp-border pl-4 min-w-[70px]">
                  <div className="text-xl font-bold text-emerald-600">{fmtUA(stats.available)}</div>
                  <div className="text-xs text-corp-text-muted">Доступно</div>
                </div>
                <div className="border-l border-corp-border pl-4 min-w-[60px]">
                  <div className="text-xl font-bold text-amber-600">{fmtUA(stats.in_rent)}</div>
                  <div className="text-xs text-corp-text-muted">Видано</div>
                </div>
                <div className="border-l border-corp-border pl-4 min-w-[60px]">
                  <div className="text-xl font-bold text-sky-600">{fmtUA(stats.reserved)}</div>
                  <div className="text-xs text-corp-text-muted">Резерв</div>
                </div>
                <div className="border-l border-corp-border pl-4 min-w-[60px]">
                  <div className="text-xl font-bold text-blue-500">{fmtUA(stats.on_wash)}</div>
                  <div className="text-xs text-corp-text-muted">Мийка</div>
                </div>
                <div className="border-l border-corp-border pl-4 min-w-[70px]">
                  <div className="text-xl font-bold text-purple-600">{fmtUA(stats.on_restoration)}</div>
                  <div className="text-xs text-corp-text-muted">Реставрація</div>
                </div>
                <div className="border-l border-corp-border pl-4 min-w-[70px]">
                  <div className="text-xl font-bold text-indigo-600">{fmtUA(stats.on_laundry)}</div>
                  <div className="text-xs text-corp-text-muted">Хімчистка</div>
                </div>
                {conflictCount > 0 && (
                  <div className="border-l border-corp-border pl-4">
                    <div className="text-xl font-bold text-rose-600">{conflictCount}</div>
                    <div className="text-xs text-corp-text-muted">Конфліктів</div>
                  </div>
                )}
                {dateFilterActive && (
                  <div className="ml-auto">
                    <Badge variant="info">Фільтр по датах</Badge>
                  </div>
                )}
              </div>
            </div>
            
            {/* Product grid */}
            {loading ? (
              <div className="bg-white rounded-xl border border-corp-border p-12 text-center">
                <div className="text-corp-text-muted">Завантаження...</div>
              </div>
            ) : items.length === 0 ? (
              <div className="bg-white rounded-xl border border-corp-border p-12 text-center">
                <div className="text-4xl mb-4">📦</div>
                <div className="text-corp-text-muted mb-4">Товарів не знайдено</div>
                <button onClick={resetAll} className="text-corp-primary hover:underline text-sm">
                  Скинути всі фільтри
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {items.map(item => (
                  <ProductCard
                    key={item.product_id}
                    item={item}
                    onClick={() => setSelectedItem(item)}
                    dateFilterActive={dateFilterActive}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
      
      {/* Detail Modal */}
      <ProductDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        dateFilterActive={dateFilterActive}
      />
    </div>
  )
}
