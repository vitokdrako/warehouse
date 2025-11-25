/* eslint-disable */
// Manager Catalog — rich inventory view with photos, stock states, who-has-what, locations, cleaning state, and scanner entry
// Tailwind only, default export = CatalogBoard

import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getImageUrl, handleImageError } from '../utils/imageHelper'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

/************* utils *************/
const cls = (...a)=> a.filter(Boolean).join(' ')
const fmtUA = (n)=> (Number(n)||0).toLocaleString('uk-UA', {maximumFractionDigits:2})
const todayISO = ()=> new Date().toISOString().slice(0,10)
const addDays = (iso, d)=> { const x=new Date(iso); x.setDate(x.getDate()+d); return x.toISOString().slice(0,10) }

const STATE = {
  ok:{ label:'В наявності', tone:'bg-emerald-100 text-emerald-700 border-emerald-200' },
  fragile:{ label:'Крихке', tone:'bg-violet-100 text-violet-700 border-violet-200' },
  damaged:{ label:'Пошкоджено', tone:'bg-rose-100 text-rose-700 border-rose-200' },
}
const CLEAN = {
  clean:{ label:'Чисте', tone:'bg-emerald-50 text-emerald-700 border-emerald-200' },
  wash:{ label:'На мийці', tone:'bg-sky-100 text-sky-700 border-sky-200' },
  dry:{ label:'Сушка', tone:'bg-amber-100 text-amber-800 border-amber-200' },
  repair:{ label:'Реставрація', tone:'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' },
}

/************* small UI *************/
function Badge({tone, children}){
  return <span className={cls('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs', tone)}>{children}</span>
}
function Pill({onClick, children, tone='slate'}){
  const tones={
    slate:'bg-slate-800 hover:bg-slate-900 text-white',
    green:'bg-emerald-600 hover:bg-emerald-700 text-white',
    blue:'bg-blue-600 hover:bg-blue-700 text-white',
    amber:'bg-amber-500 hover:bg-amber-600 text-slate-900'
  }
  return <button onClick={onClick} className={cls('rounded-full px-3 py-1 text-sm', tones[tone])}>{children}</button>
}
function Card({title,right,children}){
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-semibold">{title}</h3>{right}</div>
      {children}
    </div>
  )
}

/************* search / filters *************/
function Filters({q,setQ, cat,setCat, state,setState, clean,setClean, categories}){
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end">
      <div className="grow">
        <label className="text-xs text-slate-500">Пошук (назва / SKU / штрих‑код)</label>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="введіть текст або відскануйте штрих‑код…" className="mt-1 w-full rounded-xl border px-3 py-2" />
      </div>
      <div>
        <label className="text-xs text-slate-500">Категорія</label>
        <select className="mt-1 w-48 rounded-xl border px-3 py-2" value={cat} onChange={e=>setCat(e.target.value)}>
          <option value="all">Всі</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500">Стан</label>
        <select className="mt-1 w-40 rounded-xl border px-3 py-2" value={state} onChange={e=>setState(e.target.value)}>
          <option value="all">Будь‑який</option>
          <option value="ok">В наявності</option>
          <option value="fragile">Крихке</option>
          <option value="damaged">Пошкоджено</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500">Чистка</label>
        <select className="mt-1 w-40 rounded-xl border px-3 py-2" value={clean} onChange={e=>setClean(e.target.value)}>
          <option value="all">Будь‑яка</option>
          <option value="clean">Чисте</option>
          <option value="wash">На мийці</option>
          <option value="dry">Сушка</option>
          <option value="repair">Реставрація</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Pill tone='blue' onClick={()=>alert('Відкрити сканер штрих‑коду (мок)')}>Сканувати</Pill>
        <Pill tone='green' onClick={()=>alert('Створити товар (мок)')}>Новий товар</Pill>
      </div>
    </div>
  )
}

/************* table *************/
function Table({rows, onOpen, loading}){
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <div className="text-slate-500">Завантаження каталогу...</div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-3 py-2">Фото</th>
            <th className="px-3 py-2">SKU / Назва</th>
            <th className="px-3 py-2">Категорія</th>
            <th className="px-3 py-2">Склад</th>
            <th className="px-3 py-2">В обігу</th>
            <th className="px-3 py-2">Де знаходиться</th>
            <th className="px-3 py-2">Чистка</th>
            <th className="px-3 py-2 text-right">Дії</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(p=> (
            <tr key={p.id} className="border-t hover:bg-slate-50/50">
              <td className="px-3 py-2">
                {p.cover ? (
                  <img 
                    src={getImageUrl(p.cover)} 
                    alt={p.name} 
                    className="h-12 w-18 rounded-md object-cover bg-slate-100" 
                    onError={handleImageError}
                  />
                ) : (
                  <div className="h-12 w-18 rounded-md bg-slate-100 flex items-center justify-center text-xl">📦</div>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="font-medium text-slate-800">{p.sku}</div>
                <div className="text-xs text-slate-500">{p.name}</div>
              </td>
              <td className="px-3 py-2">{p.cat}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  <Badge tone={STATE.ok.tone}>Всього {p.total}</Badge>
                  <Badge tone={STATE.ok.tone}>Доступно {p.available}</Badge>
                  <Badge tone={STATE.fragile.tone}>Резерв {p.reserved}</Badge>
                  <Badge tone={STATE.damaged.tone}>В оренді {p.rented}</Badge>
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="space-y-1">
                  {p.due_back.map(d=> (
                    <div key={d.order_id} className="text-xs text-slate-600">#{d.order_id} · {d.customer} · {d.qty} шт · поверн: {d.date}</div>
                  ))}
                  {p.due_back.length===0 && <div className="text-xs text-slate-400">—</div>}
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="text-xs">Зона {p.location.zone} · Ряд {p.location.aisle} · Полиця {p.location.shelf} · Бокс {p.location.bin}</div>
              </td>
              <td className="px-3 py-2">
                <Badge tone={CLEAN[p.cleaning.status].tone}>{CLEAN[p.cleaning.status].label}</Badge>
                <div className="text-xs text-slate-500">ост. оновл.: {p.cleaning.last}</div>
              </td>
              <td className="px-3 py-2 text-right">
                <button onClick={()=>onOpen(p)} className="rounded-full bg-slate-900 px-3 py-1 text-sm text-white">Деталі</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/************* drawer *************/
function Drawer({open, item, onClose, onSave}){
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [damageHistory, setDamageHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  
  useEffect(() => {
    if (item) {
      setEditData({
        location: {...item.location},
        cleaning: {...item.cleaning},
        state: item.state
      })
      // Завантажити історію пошкоджень
      loadDamageHistory(item.sku)
    }
  }, [item])
  
  const loadDamageHistory = async (sku) => {
    if (!sku) return
    
    try {
      setLoadingHistory(true)
      const response = await fetch(`${BACKEND_URL}/api/product-damage-history/sku/${sku}`)
      const data = await response.json()
      setDamageHistory(data.history || [])
    } catch (error) {
      console.error('Error loading damage history:', error)
      setDamageHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }
  
  if(!open || !item) return null
  
  const handleSave = async () => {
    try {
      await onSave(item.id, editData)
      setEditing(false)
    } catch (error) {
      console.error('Error saving:', error)
      alert('Помилка збереження')
    }
  }
  
  return (
    <div className="fixed inset-0 z-30 flex">
      <div className="h-full w-full bg-black/30" onClick={onClose}/>
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto rounded-l-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">{item.name}</div>
            <div className="text-xs text-slate-500">{item.sku} · {item.cat}</div>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={handleSave} className="rounded-full bg-green-600 px-3 py-1 text-sm text-white">Зберегти</button>
                <button onClick={()=>setEditing(false)} className="rounded-full bg-slate-400 px-3 py-1 text-sm text-white">Скасувати</button>
              </>
            ) : (
              <>
                <button onClick={()=>setEditing(true)} className="rounded-full bg-blue-600 px-3 py-1 text-sm text-white">Редагувати</button>
                <button onClick={onClose} className="rounded-full bg-slate-900 px-3 py-1 text-sm text-white">Закрити</button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <img src={getImageUrl(item.cover)} alt={item.name} className="md:col-span-1 h-32 w-full rounded-xl object-cover" onError={handleImageError}/>
          <div className="md:col-span-2 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge tone={STATE.ok.tone}>Всього {item.total}</Badge>
              <Badge tone={STATE.ok.tone}>Доступно {item.available}</Badge>
              <Badge tone={STATE.fragile.tone}>Резерв {item.reserved}</Badge>
              <Badge tone={STATE.damaged.tone}>В оренді {item.rented}</Badge>
              <Badge tone={STATE[item.state].tone}>{STATE[item.state].label}</Badge>
              <Badge tone={CLEAN[item.cleaning.status].tone}>{CLEAN[item.cleaning.status].label}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Card title="Розташування">
                {editing ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={editData.location.zone} onChange={e=>setEditData({...editData, location:{...editData.location, zone:e.target.value}})} placeholder="Зона" className="rounded border px-2 py-1 text-sm"/>
                      <input value={editData.location.aisle} onChange={e=>setEditData({...editData, location:{...editData.location, aisle:e.target.value}})} placeholder="Ряд" className="rounded border px-2 py-1 text-sm"/>
                      <input value={editData.location.shelf} onChange={e=>setEditData({...editData, location:{...editData.location, shelf:e.target.value}})} placeholder="Полиця" className="rounded border px-2 py-1 text-sm"/>
                      <input value={editData.location.bin} onChange={e=>setEditData({...editData, location:{...editData.location, bin:e.target.value}})} placeholder="Бокс" className="rounded border px-2 py-1 text-sm"/>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm">Зона {item.location.zone} / Ряд {item.location.aisle} / Полиця {item.location.shelf} / Бокс {item.location.bin}</div>
                    <div className="mt-2 flex gap-2">
                      <button className="rounded-md border px-2 py-1 text-xs" onClick={()=>alert('Надрукувати етикетку (мок)')}>Етикетка</button>
                    </div>
                  </>
                )}
              </Card>
              <Card title="Чистка / Ремонт">
                {editing ? (
                  <div className="space-y-2">
                    <select value={editData.cleaning.status} onChange={e=>setEditData({...editData, cleaning:{...editData.cleaning, status:e.target.value}})} className="w-full rounded border px-2 py-1 text-sm">
                      <option value="clean">Чисте</option>
                      <option value="wash">На мийці</option>
                      <option value="dry">Сушка</option>
                      <option value="repair">Реставрація</option>
                    </select>
                    <select value={editData.state} onChange={e=>setEditData({...editData, state:e.target.value})} className="w-full rounded border px-2 py-1 text-sm">
                      <option value="ok">В наявності</option>
                      <option value="fragile">Крихке</option>
                      <option value="damaged">Пошкоджено</option>
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="text-sm">Статус: {CLEAN[item.cleaning.status].label}</div>
                    <div className="text-xs text-slate-500">Останнє оновлення: {item.cleaning.last}</div>
                  </>
                )}
              </Card>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card title="У поверненні / резерві">
            <div className="space-y-2 text-sm">
              {item.due_back.map(d => (
                <div key={d.order_id} className="flex items-center justify-between rounded-lg border px-2 py-1">
                  <div>#{d.order_id} · {d.customer} · {d.qty} шт</div>
                  <div className="text-xs text-slate-500">до {d.date}</div>
                </div>
              ))}
              {item.due_back.length===0 && <div className="text-sm text-slate-500">Порожньо</div>}
            </div>
          </Card>
          <Card title="Штрих‑коди / одиниці">
            <div className="space-y-2">
              {item.barcodes.map(code => (
                <div key={code} className="flex items-center justify-between rounded-lg border px-2 py-1 text-sm">
                  <div>{code}</div>
                  <div className="flex items-center gap-2">
                    <button className="rounded-md border px-2 py-0.5 text-xs" onClick={()=>alert('Перевірити стан (мок)')}>Статус</button>
                    <button className="rounded-md border px-2 py-0.5 text-xs" onClick={()=>alert('Перемістити одиницю (мок)')}>Move</button>
                  </div>
                </div>
              ))}
              {item.barcodes.length===0 && <div className="text-sm text-slate-500">Немає даних</div>}
            </div>
          </Card>
          <Card title="Варіанти / комплекти">
            <div className="flex flex-wrap gap-2 text-sm">
              {item.variants && item.variants.map(v => (
                <span key={v.code} className="rounded-md border px-2 py-1">{v.label}</span>
              ))}
              {(!item.variants || item.variants.length === 0) && <div className="text-sm text-slate-500">Немає варіантів</div>}
            </div>
          </Card>
          <Card title="Історія (лог)">
            <div className="space-y-2 text-sm text-slate-500">
              <div>📦 Дані з OpenCart БД</div>
              <div>🔄 Синхронізовано з Rental Hub</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

/************* main *************/
export default function CatalogBoard(){
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [q,setQ] = useState('')
  const [cat,setCat] = useState('all')
  const [state,setState] = useState('all')
  const [clean,setClean] = useState('all')
  const [drawer,setDrawer] = useState({open:false,item:null})
  const [familyModal, setFamilyModal] = useState({open: false, families: [], selectedFamily: null})
  const [selectedProducts, setSelectedProducts] = useState([])
  const [familySearch, setFamilySearch] = useState('') // Пошук в модалці
  const [draggedProduct, setDraggedProduct] = useState(null) // Для drag&drop
  const navigate = useNavigate()

  // Load products from backend
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setLoading(true)
        console.log('[Catalog] Loading from:', BACKEND_URL)
        
        // Build search param
        let url = `${BACKEND_URL}/api/catalog`  // Без ліміту
        if (q) {
          url += `?search=${encodeURIComponent(q)}`
        }
        
        console.log('[Catalog] Fetching:', url)
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          mode: 'cors',
          credentials: 'omit'
        })
        
        console.log('[Catalog] Response status:', response.status)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('[Catalog] Error response:', errorText)
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        console.log('[Catalog] Loaded products:', data.length)
        setProducts(data)
      } catch (error) {
        console.error('[Catalog] Error loading catalog:', error)
        alert(`Помилка завантаження каталогу: ${error.message}`)
      } finally {
        setLoading(false)
      }
    }

    loadCatalog()
  }, [q])
  
  // Save product changes
  const handleSaveProduct = async (productId, data) => {
    try {
      console.log('[Catalog] Saving product:', productId, data)
      
      const response = await fetch(`${BACKEND_URL}/api/catalog/${productId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'omit',
        body: JSON.stringify(data)
      })
      
      console.log('[Catalog] Save response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Catalog] Save error:', errorText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      // Reload catalog
      const catalogResponse = await fetch(`${BACKEND_URL}/api/catalog`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'omit'
      })
      const catalogData = await catalogResponse.json()
      setProducts(catalogData)
      
      // Update drawer item
      const updatedItem = catalogData.find(p => p.id === productId)
      if (updatedItem) {
        setDrawer({open: true, item: updatedItem})
      }
      
      alert('✅ Товар успішно оновлено')
    } catch (error) {
      console.error('[Catalog] Error saving product:', error)
      alert(`Помилка збереження: ${error.message}`)
      throw error
    }
  }

  // Get unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.cat))]
    return cats.sort()
  }, [products])

  const rows = useMemo(()=> products.filter(p=>{
    const okC = cat==='all' || p.cat===cat
    const okS = state==='all' || p.state===state
    const okCl = clean==='all' || p.cleaning.status===clean
    return okC && okS && okCl
  }),[products,cat,state,clean])

  // Відкрити менеджер наборів
  const openFamilyManager = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/catalog/families`)
      const data = await res.json()
      setFamilyModal({open: true, families: data, selectedFamily: null})
    } catch (err) {
      console.error('Error loading families:', err)
      setFamilyModal({open: true, families: [], selectedFamily: null})
    }
  }

  // Створити новий набір
  const createFamily = async () => {
    const name = prompt('Назва набору:')
    if (!name) return
    
    const description = prompt('Опис набору (опціонально):')
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/catalog/families`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      })
      if (!res.ok) throw new Error('Failed to create family')
      alert('✅ Набір створено!')
      openFamilyManager() // Перезавантажити список
    } catch (err) {
      console.error('Error creating family:', err)
      alert('❌ Помилка створення набору')
    }
  }

  // Прив'язати товари до набору
  const assignToFamily = async (familyId) => {
    if (selectedProducts.length === 0) {
      alert('Оберіть товари для зв\'язування')
      return
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/catalog/families/${familyId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: selectedProducts })
      })
      if (!res.ok) throw new Error('Failed to assign products')
      alert(`✅ ${selectedProducts.length} товарів прив'язано до набору!`)
      setSelectedProducts([])
      // Перезавантажити товари та набори
      const loadRes = await fetch(`${BACKEND_URL}/api/catalog`)
      const productsData = await loadRes.json()
      setProducts(productsData)
      await openFamilyManager()
    } catch (err) {
      console.error('Error assigning products:', err)
      alert('❌ Помилка прив\'язування')
    }
  }

  // Відв'язати товар від набору
  const removeFromFamily = async (productId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/catalog/products/${productId}/remove-family`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) throw new Error('Failed to remove product')
      alert('✅ Товар видалено з набору!')
      // Перезавантажити товари та набори
      const loadRes = await fetch(`${BACKEND_URL}/api/catalog`)
      const productsData = await loadRes.json()
      setProducts(productsData)
      await openFamilyManager()
    } catch (err) {
      console.error('Error removing product:', err)
      alert('❌ Помилка')
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Каталог / Інвентар</h1>
        <div className="flex gap-2">
          <button className="rounded-full bg-purple-500 text-white px-3 py-1 text-sm font-medium hover:bg-purple-600" onClick={openFamilyManager}>🔗 Керувати наборами</button>
          <button className="rounded-full bg-slate-200 px-3 py-1 text-sm" onClick={()=>navigate('/')}>← Назад</button>
          <button className="rounded-full bg-slate-200 px-3 py-1 text-sm" onClick={()=>alert('Експорт CSV (мок)')}>Експорт</button>
          <button className="rounded-full bg-slate-200 px-3 py-1 text-sm" onClick={()=>alert('Імпорт CSV (мок)')}>Імпорт</button>
        </div>
      </div>

      <Filters q={q} setQ={setQ} cat={cat} setCat={setCat} state={state} setState={setState} clean={clean} setClean={setClean} categories={categories} />

      <div className="mt-4">
        <Table rows={rows} onOpen={(item)=>setDrawer({open:true,item})} loading={loading} />
      </div>

      <Drawer open={drawer.open} item={drawer.item} onClose={()=>setDrawer({open:false,item:null})} onSave={handleSaveProduct} />
      
      {/* Modal - Керування наборами */}
      {familyModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">🔗 Керування наборами</h2>
              <button onClick={() => setFamilyModal({...familyModal, open: false})} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
            </div>

            {/* Створити новий набір */}
            <button 
              onClick={createFamily}
              className="mb-4 px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600"
            >
              + Створити новий набір
            </button>

            <div className="flex-1 overflow-auto">
              {/* Список наборів */}
              <div className="space-y-4 mb-6">
                {familyModal.families.length === 0 ? (
                  <div className="text-center text-slate-500 py-8">
                    Немає наборів. Створіть перший набір!
                  </div>
                ) : (
                  familyModal.families.map(family => (
                    <div key={family.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg">{family.name}</h3>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => assignToFamily(family.id)}
                            disabled={selectedProducts.length === 0}
                            className={cls(
                              "px-3 py-1 rounded text-sm transition-colors",
                              selectedProducts.length > 0 
                                ? "bg-blue-500 text-white hover:bg-blue-600" 
                                : "bg-slate-300 text-slate-500 cursor-not-allowed"
                            )}
                          >
                            Прив'язати обрані ({selectedProducts.length})
                          </button>
                          <button 
                            onClick={async () => {
                              if (!confirm(`Видалити набір "${family.name}"?`)) return
                              try {
                                const res = await fetch(`${BACKEND_URL}/api/catalog/families/${family.id}`, {
                                  method: 'DELETE'
                                })
                                if (!res.ok) throw new Error('Failed to delete family')
                                alert('✅ Набір видалено!')
                                await openFamilyManager()
                              } catch (err) {
                                console.error('Error deleting family:', err)
                                alert('❌ Помилка видалення набору')
                              }
                            }}
                            className="px-3 py-1 rounded text-sm bg-rose-500 text-white hover:bg-rose-600 transition-colors"
                          >
                            🗑️ Видалити
                          </button>
                        </div>
                      </div>
                      {family.description && (
                        <p className="text-sm text-slate-600 mb-2">{family.description}</p>
                      )}
                      
                      {/* Товари в наборі */}
                      <div className="mt-3">
                        <div className="text-sm font-medium text-slate-700 mb-2">Товари в наборі:</div>
                        <div 
                          className={cls(
                            "min-h-[100px] rounded-lg p-2 transition-colors",
                            family.products && family.products.length > 0 
                              ? "grid grid-cols-2 gap-2" 
                              : "border-2 border-dashed border-slate-300 flex items-center justify-center"
                          )}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.currentTarget.classList.add('bg-blue-50', 'border-blue-400')
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.classList.remove('bg-blue-50', 'border-blue-400')
                          }}
                          onDrop={async (e) => {
                            e.preventDefault()
                            e.currentTarget.classList.remove('bg-blue-50', 'border-blue-400')
                            
                            const productId = e.dataTransfer.getData('productId')
                            if (productId) {
                              try {
                                const res = await fetch(`${BACKEND_URL}/api/catalog/families/${family.id}/assign`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ product_ids: [parseInt(productId)] })
                                })
                                if (!res.ok) throw new Error('Failed to assign product')
                                
                                // Reload families
                                const familiesRes = await fetch(`${BACKEND_URL}/api/catalog/families`)
                                const familiesData = await familiesRes.json()
                                setFamilyModal({...familyModal, families: familiesData})
                                
                                alert('✅ Товар додано до набору!')
                              } catch (err) {
                                console.error('Error assigning product:', err)
                                alert('❌ Помилка додавання товару')
                              }
                            }
                          }}
                        >
                          {family.products && family.products.length > 0 ? (
                            family.products.map(prod => (
                              <div 
                                key={prod.product_id} 
                                className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 hover:shadow-sm transition-shadow"
                              >
                                {prod.cover ? (
                                  <img 
                                    src={getImageUrl(prod.cover)} 
                                    alt={prod.name}
                                    className="w-12 h-12 object-cover rounded bg-slate-100" 
                                    onError={handleImageError}
                                  />
                                ) : null}
                                <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center text-2xl" style={{display: 'none'}}>
                                  📦
                                </div>
                                <div className="flex-1 text-sm">
                                  <div className="font-medium text-slate-800">{prod.name}</div>
                                  <div className="text-xs text-slate-500">SKU: {prod.sku}</div>
                                </div>
                                <button 
                                  onClick={() => removeFromFamily(prod.product_id)}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full w-6 h-6 flex items-center justify-center text-xl transition-colors"
                                >
                                  ×
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-slate-400 text-center py-4">
                              <div className="text-2xl mb-2">📦</div>
                              <div>Перетягніть товари сюди</div>
                              <div className="text-xs">або оберіть нижче і натисніть "Прив'язати"</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Оберіть товари для зв'язування */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Оберіть товари для прив'язування:</h3>
                  {selectedProducts.length > 0 && (
                    <button 
                      onClick={() => setSelectedProducts([])}
                      className="text-sm text-slate-500 hover:text-slate-700"
                    >
                      Скасувати вибір ({selectedProducts.length})
                    </button>
                  )}
                </div>
                
                {/* Пошук по SKU */}
                <div className="mb-3">
                  <input 
                    type="text"
                    value={familySearch}
                    onChange={(e) => setFamilySearch(e.target.value)}
                    placeholder="🔍 Пошук по SKU або назві..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-auto bg-slate-50 p-3 rounded-lg">
                  {products
                    .filter(p => {
                      if (!familySearch) return true
                      const search = familySearch.toLowerCase()
                      return p.sku?.toLowerCase().includes(search) || p.name?.toLowerCase().includes(search)
                    })
                    .sort((a, b) => (b.product_id || 0) - (a.product_id || 0)) // Сортування по ID (найновіші першими)
                    .map(p => (
                      <label 
                        key={p.product_id} 
                        className={cls(
                          "flex items-center gap-2 p-2 border rounded cursor-move transition-all relative",
                          selectedProducts.includes(p.product_id) 
                            ? "bg-blue-50 border-blue-300 shadow-sm" 
                            : "bg-white border-slate-200 hover:bg-slate-50 hover:shadow-md"
                        )}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('productId', p.product_id.toString())
                          e.currentTarget.style.opacity = '0.5'
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.style.opacity = '1'
                        }}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedProducts.includes(p.product_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProducts([...selectedProducts, p.product_id])
                            } else {
                              setSelectedProducts(selectedProducts.filter(id => id !== p.product_id))
                            }
                          }}
                          className="h-4 w-4 text-blue-600"
                        />
                        {p.cover ? (
                          <img 
                            src={getImageUrl(p.cover)} 
                            alt={p.name}
                            className="w-8 h-8 object-cover rounded bg-slate-100" 
                            onError={handleImageError}
                          />
                        ) : (
                          <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-xs">📦</div>
                        )}
                        <div className="text-xs flex-1 min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-slate-500">{p.sku}</div>
                        </div>
                      </label>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
