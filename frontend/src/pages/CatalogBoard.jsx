/* eslint-disable */
// Каталог товарів - гнучкий інструмент перегляду для менеджера
// По категоріям/підкатегоріям, з фільтрами: колір, матеріал, кількість, пошук

import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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

// Sidebar Category Tree
function CategoryTree({ categories, selected, onSelect, loading }) {
  const [expanded, setExpanded] = useState({})
  
  const toggleExpand = (cat) => {
    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }))
  }
  
  if (loading) {
    return (
      <div className="p-4 text-corp-text-muted text-sm">Завантаження категорій...</div>
    )
  }
  
  return (
    <div className="space-y-1">
      {/* All items */}
      <button
        onClick={() => onSelect({ category: null, subcategory: null })}
        className={cls(
          'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          !selected.category 
            ? 'bg-corp-primary text-white' 
            : 'text-corp-text-main hover:bg-corp-bg-light'
        )}
      >
        Всі товари
      </button>
      
      {/* Category list */}
      {categories.map(cat => (
        <div key={cat.name}>
          <button
            onClick={() => {
              if (cat.subcategories?.length > 0) {
                toggleExpand(cat.name)
              }
              onSelect({ category: cat.name, subcategory: null })
            }}
            className={cls(
              'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between',
              selected.category === cat.name && !selected.subcategory
                ? 'bg-corp-primary text-white'
                : 'text-corp-text-main hover:bg-corp-bg-light'
            )}
          >
            <span className="truncate flex-1">{cat.name}</span>
            <span className={cls(
              'text-xs ml-2',
              selected.category === cat.name && !selected.subcategory ? 'text-white/80' : 'text-corp-text-muted'
            )}>
              {cat.product_count}
            </span>
            {cat.subcategories?.length > 0 && (
              <span className="ml-1">{expanded[cat.name] ? '▼' : '▶'}</span>
            )}
          </button>
          
          {/* Subcategories */}
          {expanded[cat.name] && cat.subcategories?.length > 0 && (
            <div className="ml-3 mt-1 space-y-1 border-l-2 border-corp-border pl-2">
              {cat.subcategories.map(sub => (
                <button
                  key={sub.name}
                  onClick={() => onSelect({ category: cat.name, subcategory: sub.name })}
                  className={cls(
                    'w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between',
                    selected.subcategory === sub.name
                      ? 'bg-corp-primary/80 text-white'
                      : 'text-corp-text-main hover:bg-corp-bg-light'
                  )}
                >
                  <span className="truncate">{sub.name}</span>
                  <span className={cls(
                    'text-xs',
                    selected.subcategory === sub.name ? 'text-white/80' : 'text-corp-text-muted'
                  )}>
                    {sub.product_count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Filter Panel
function FilterPanel({ filters, setFilters, colors, materials, onReset }) {
  return (
    <div className="bg-white rounded-xl border border-corp-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-corp-text-dark">Фільтри</h3>
        <button 
          onClick={onReset}
          className="text-xs text-corp-text-muted hover:text-corp-primary transition-colors"
        >
          Скинути
        </button>
      </div>
      
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
      
      {/* Quantity range */}
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
          <option value="in_rent">В оренді</option>
          <option value="reserved">В резерві</option>
        </select>
      </div>
    </div>
  )
}

// Product Card
function ProductCard({ item, onClick }) {
  const hasRentals = item.who_has?.length > 0
  
  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-xl border border-corp-border p-3 hover:shadow-md transition-shadow cursor-pointer group"
    >
      {/* Image */}
      <div className="relative mb-3">
        <img
          src={getImageUrl(item.image)}
          alt={item.name}
          className="w-full h-32 object-cover rounded-lg bg-corp-bg-light"
          onError={handleImageError}
        />
        {/* Status badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {item.in_rent > 0 && (
            <Badge variant="warning">{item.in_rent} в оренді</Badge>
          )}
          {item.reserved > 0 && (
            <Badge variant="info">{item.reserved} резерв</Badge>
          )}
        </div>
      </div>
      
      {/* Info */}
      <div className="space-y-1">
        <div className="text-xs text-corp-text-muted">{item.sku}</div>
        <div className="font-medium text-corp-text-dark text-sm line-clamp-2 group-hover:text-corp-primary transition-colors">
          {item.name}
        </div>
        
        {/* Category */}
        {item.category && (
          <div className="text-xs text-corp-text-muted">
            {item.category}{item.subcategory ? ` / ${item.subcategory}` : ''}
          </div>
        )}
        
        {/* Properties */}
        <div className="flex flex-wrap gap-1 mt-2">
          {item.color && (
            <span className="text-xs bg-corp-bg-light px-2 py-0.5 rounded">{item.color}</span>
          )}
          {item.material && (
            <span className="text-xs bg-corp-bg-light px-2 py-0.5 rounded">{item.material}</span>
          )}
        </div>
        
        {/* Stock info */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-corp-border">
          <div className="flex gap-2">
            <span className={cls(
              'text-sm font-semibold',
              item.available > 0 ? 'text-emerald-600' : 'text-corp-text-muted'
            )}>
              {item.available} дост.
            </span>
            <span className="text-sm text-corp-text-muted">/ {item.total} всього</span>
          </div>
          {item.rental_price > 0 && (
            <span className="text-sm font-medium text-corp-primary">
              {fmtUA(item.rental_price)} ₴
            </span>
          )}
        </div>
        
        {/* Who has it */}
        {hasRentals && (
          <div className="mt-2 pt-2 border-t border-dashed border-corp-border">
            <div className="text-xs text-corp-text-muted mb-1">У кого в оренді:</div>
            {item.who_has.slice(0, 2).map((rental, idx) => (
              <div key={idx} className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mb-1">
                {rental.customer} · {rental.qty} шт · до {rental.return_date}
              </div>
            ))}
            {item.who_has.length > 2 && (
              <div className="text-xs text-corp-text-muted">...ще {item.who_has.length - 2}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Product Detail Modal
function ProductDetailModal({ item, onClose }) {
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
                <h3 className="font-semibold text-corp-text-dark mb-3">Наявність</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-corp-border">
                    <div className="text-2xl font-bold text-emerald-600">{item.available}</div>
                    <div className="text-xs text-corp-text-muted">Доступно</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-corp-border">
                    <div className="text-2xl font-bold text-corp-text-dark">{item.total}</div>
                    <div className="text-xs text-corp-text-muted">Всього</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-corp-border">
                    <div className="text-2xl font-bold text-amber-600">{item.in_rent}</div>
                    <div className="text-xs text-corp-text-muted">В оренді</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-corp-border">
                    <div className="text-2xl font-bold text-sky-600">{item.reserved}</div>
                    <div className="text-xs text-corp-text-muted">Резерв</div>
                  </div>
                </div>
              </div>
              
              {/* Location */}
              <div className="bg-corp-bg-page rounded-xl p-4">
                <h3 className="font-semibold text-corp-text-dark mb-2">Розташування</h3>
                <div className="text-sm">
                  {item.location?.zone || item.location?.aisle || item.location?.shelf ? (
                    <div className="flex gap-4">
                      {item.location.zone && (
                        <div>
                          <span className="text-corp-text-muted">Зона:</span>{' '}
                          <span className="font-medium">{item.location.zone}</span>
                        </div>
                      )}
                      {item.location.aisle && (
                        <div>
                          <span className="text-corp-text-muted">Ряд:</span>{' '}
                          <span className="font-medium">{item.location.aisle}</span>
                        </div>
                      )}
                      {item.location.shelf && (
                        <div>
                          <span className="text-corp-text-muted">Полиця:</span>{' '}
                          <span className="font-medium">{item.location.shelf}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-corp-text-muted">Не вказано</span>
                  )}
                </div>
              </div>
              
              {/* Properties */}
              <div className="bg-corp-bg-page rounded-xl p-4">
                <h3 className="font-semibold text-corp-text-dark mb-2">Характеристики</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {item.color && (
                    <div>
                      <span className="text-corp-text-muted">Колір:</span>{' '}
                      <span className="font-medium">{item.color}</span>
                    </div>
                  )}
                  {item.material && (
                    <div>
                      <span className="text-corp-text-muted">Матеріал:</span>{' '}
                      <span className="font-medium">{item.material}</span>
                    </div>
                  )}
                  {item.size && (
                    <div>
                      <span className="text-corp-text-muted">Розмір:</span>{' '}
                      <span className="font-medium">{item.size}</span>
                    </div>
                  )}
                  {item.price > 0 && (
                    <div>
                      <span className="text-corp-text-muted">Вартість:</span>{' '}
                      <span className="font-medium">{fmtUA(item.price)} ₴</span>
                    </div>
                  )}
                  {item.rental_price > 0 && (
                    <div>
                      <span className="text-corp-text-muted">Оренда:</span>{' '}
                      <span className="font-medium text-corp-primary">{fmtUA(item.rental_price)} ₴</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Who has */}
          {item.who_has?.length > 0 && (
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="font-semibold text-amber-800 mb-3">У кого в оренді ({item.who_has.length})</h3>
              <div className="space-y-2">
                {item.who_has.map((rental, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border border-amber-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-corp-text-dark">{rental.customer}</div>
                        <div className="text-xs text-corp-text-muted">
                          Замовлення: {rental.order_number} · Кількість: {rental.qty} шт
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-amber-700">
                          Повернення: {rental.return_date || '—'}
                        </div>
                        {rental.phone && (
                          <div className="text-xs text-corp-text-muted">{rental.phone}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Description */}
          {item.description && (
            <div className="mt-4 bg-corp-bg-page rounded-xl p-4">
              <h3 className="font-semibold text-corp-text-dark mb-2">Опис</h3>
              <p className="text-sm text-corp-text-main">{item.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Main Component
export default function CatalogBoard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [colors, setColors] = useState([])
  const [materials, setMaterials] = useState([])
  const [items, setItems] = useState([])
  const [stats, setStats] = useState({ total: 0, available: 0, in_rent: 0, reserved: 0 })
  const [selectedCategory, setSelectedCategory] = useState({ category: null, subcategory: null })
  const [filters, setFilters] = useState({
    search: '',
    color: '',
    material: '',
    minQty: '',
    maxQty: '',
    availability: ''
  })
  const [selectedItem, setSelectedItem] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Load categories on mount
  useEffect(() => {
    loadCategories()
  }, [])

  // Load items when category or filters change
  useEffect(() => {
    loadItems()
  }, [selectedCategory, filters])

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
      
      const res = await fetch(`${BACKEND_URL}/api/catalog/items-by-category?${params}`)
      const data = await res.json()
      setItems(data.items || [])
      setStats(data.stats || { total: 0, available: 0, in_rent: 0, reserved: 0 })
    } catch (err) {
      console.error('Error loading items:', err)
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () => {
    setFilters({
      search: '',
      color: '',
      material: '',
      minQty: '',
      maxQty: '',
      availability: ''
    })
  }

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.search) count++
    if (filters.color) count++
    if (filters.material) count++
    if (filters.minQty) count++
    if (filters.maxQty) count++
    if (filters.availability) count++
    return count
  }, [filters])

  return (
    <div className="min-h-screen bg-corp-bg-page font-montserrat">
      <CorporateHeader cabinetName="Каталог" />
      
      <div className="flex">
        {/* Sidebar - Categories */}
        <aside className={cls(
          'w-64 bg-white border-r border-corp-border min-h-[calc(100vh-64px)] transition-all duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full absolute'
        )}>
          <div className="p-4">
            <h2 className="font-semibold text-corp-text-dark mb-4">Категорії</h2>
            <CategoryTree
              categories={categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
              loading={categoriesLoading}
            />
          </div>
        </aside>
        
        {/* Main content */}
        <main className="flex-1 p-4">
          {/* Stats bar */}
          <div className="bg-white rounded-xl border border-corp-border p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-6">
                <div>
                  <div className="text-2xl font-bold text-corp-text-dark">{items.length}</div>
                  <div className="text-xs text-corp-text-muted">Знайдено товарів</div>
                </div>
                <div className="border-l border-corp-border pl-6">
                  <div className="text-2xl font-bold text-emerald-600">{fmtUA(stats.available)}</div>
                  <div className="text-xs text-corp-text-muted">Доступно одиниць</div>
                </div>
                <div className="border-l border-corp-border pl-6">
                  <div className="text-2xl font-bold text-amber-600">{fmtUA(stats.in_rent)}</div>
                  <div className="text-xs text-corp-text-muted">В оренді</div>
                </div>
                <div className="border-l border-corp-border pl-6">
                  <div className="text-2xl font-bold text-sky-600">{fmtUA(stats.reserved)}</div>
                  <div className="text-xs text-corp-text-muted">Резерв</div>
                </div>
              </div>
              
              {/* Toggle sidebar */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-corp-text-muted hover:text-corp-text-dark p-2"
              >
                {sidebarOpen ? '◀ Сховати' : '▶ Категорії'}
              </button>
            </div>
          </div>
          
          <div className="flex gap-4">
            {/* Filters */}
            <div className="w-64 flex-shrink-0">
              <FilterPanel 
                filters={filters} 
                setFilters={setFilters} 
                colors={colors}
                materials={materials}
                onReset={resetFilters}
              />
              
              {activeFilterCount > 0 && (
                <div className="mt-2 text-center">
                  <Badge variant="primary">
                    Активних фільтрів: {activeFilterCount}
                  </Badge>
                </div>
              )}
            </div>
            
            {/* Product grid */}
            <div className="flex-1">
              {loading ? (
                <div className="bg-white rounded-xl border border-corp-border p-12 text-center">
                  <div className="text-corp-text-muted">Завантаження товарів...</div>
                </div>
              ) : items.length === 0 ? (
                <div className="bg-white rounded-xl border border-corp-border p-12 text-center">
                  <div className="text-4xl mb-4">📦</div>
                  <div className="text-corp-text-muted">Товарів не знайдено</div>
                  <button
                    onClick={resetFilters}
                    className="mt-4 text-corp-primary hover:underline text-sm"
                  >
                    Скинути фільтри
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {items.map(item => (
                    <ProductCard
                      key={item.product_id}
                      item={item}
                      onClick={() => setSelectedItem(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      
      {/* Detail Modal */}
      <ProductDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  )
}
