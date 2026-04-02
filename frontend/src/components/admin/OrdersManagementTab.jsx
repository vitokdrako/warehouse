/* eslint-disable */
import React, { useState, useEffect, useMemo } from 'react'
import { ChevronUp, ChevronDown, Search, X, Pencil, Trash2, Plus, Check, Save, CreditCard, Banknote, Building2 } from 'lucide-react'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''
const authFetch = async (url, opts = {}) => {
  const token = localStorage.getItem('token')
  return fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers } })
}
const fmtUA = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

const STATUS_LABELS = {
  awaiting_customer: 'Очікує клієнта',
  processing: 'В обробці',
  ready_for_issue: 'Готовий',
  issued: 'Видано',
  returned: 'Повернено',
  partial_return: 'Частковий',
  completed: 'Завершений',
  cancelled: 'Скасований',
}
const STATUS_COLORS = {
  awaiting_customer: 'bg-gray-100 text-gray-600',
  processing: 'bg-blue-100 text-blue-700',
  ready_for_issue: 'bg-cyan-100 text-cyan-700',
  issued: 'bg-amber-100 text-amber-700',
  returned: 'bg-purple-100 text-purple-700',
  partial_return: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
}

export default function OrdersManagementTab() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState('order_id')
  const [sortDir, setSortDir] = useState('desc')
  const [expandedId, setExpandedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [payments, setPayments] = useState([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [addPayment, setAddPayment] = useState(null)
  const [editPaymentId, setEditPaymentId] = useState(null)
  const [editPaymentData, setEditPaymentData] = useState({})

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await authFetch(`${BACKEND_URL}/api/admin/orders-management?${params}`)
      const data = await res.json()
      setOrders(data.orders || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter])

  const handleSearch = (e) => {
    e.preventDefault()
    load()
  }

  // Sorting
  const sorted = useMemo(() => {
    const arr = [...orders]
    arr.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey]
      if (va == null) va = ''
      if (vb == null) vb = ''
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va
      return sortDir === 'asc' ? String(va).localeCompare(String(vb), 'uk') : String(vb).localeCompare(String(va), 'uk')
    })
    return arr
  }, [orders, sortKey, sortDir])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  }

  // Expand row → load payments
  const toggleExpand = async (oid) => {
    if (expandedId === oid) { setExpandedId(null); return }
    setExpandedId(oid)
    setEditingId(null)
    setAddPayment(null)
    setEditPaymentId(null)
    setLoadingPayments(true)
    try {
      const res = await authFetch(`${BACKEND_URL}/api/admin/orders-management/${oid}/payments`)
      const data = await res.json()
      setPayments(data.payments || [])
    } catch (e) { setPayments([]) }
    setLoadingPayments(false)
  }

  // Inline edit order fields
  const startEdit = (order) => {
    setEditingId(order.order_id)
    setEditData({
      total_price: order.total_price,
      discount_percent: order.discount_percent,
      discount_amount: order.discount_amount,
      service_fee: order.service_fee,
      deposit_amount: order.deposit_amount,
    })
  }

  const saveEdit = async (oid) => {
    try {
      await authFetch(`${BACKEND_URL}/api/admin/orders-management/${oid}`, {
        method: 'PUT', body: JSON.stringify(editData)
      })
      setEditingId(null)
      load()
    } catch (e) { alert('Помилка збереження') }
  }

  // Payments CRUD
  const handleAddPayment = async (oid) => {
    if (!addPayment?.amount || addPayment.amount <= 0) return
    try {
      await authFetch(`${BACKEND_URL}/api/admin/orders-management/${oid}/payments`, {
        method: 'POST', body: JSON.stringify(addPayment)
      })
      setAddPayment(null)
      toggleExpand(oid) // reload payments
      load() // reload totals
    } catch (e) { alert('Помилка') }
  }

  const handleDeletePayment = async (oid, pid) => {
    if (!window.confirm('Видалити цей платіж?')) return
    try {
      await authFetch(`${BACKEND_URL}/api/admin/orders-management/${oid}/payments/${pid}`, { method: 'DELETE' })
      toggleExpand(oid)
      load()
    } catch (e) { alert('Помилка') }
  }

  const handleSavePayment = async (oid, pid) => {
    try {
      await authFetch(`${BACKEND_URL}/api/admin/orders-management/${oid}/payments/${pid}`, {
        method: 'PUT', body: JSON.stringify(editPaymentData)
      })
      setEditPaymentId(null)
      toggleExpand(oid)
      load()
    } catch (e) { alert('Помилка') }
  }

  const cols = [
    { key: 'order_number', label: '№', w: 'w-20' },
    { key: 'customer_name', label: 'Клієнт', w: 'w-36' },
    { key: 'manager_name', label: 'Менеджер', w: 'w-28' },
    { key: 'status', label: 'Статус', w: 'w-24' },
    { key: 'rental_start', label: 'Дати', w: 'w-28' },
    { key: 'total_price', label: 'Вартість', w: 'w-20' },
    { key: 'discount_amount', label: 'Знижка', w: 'w-16' },
    { key: 'total_to_pay', label: 'До сплати', w: 'w-20' },
    { key: 'paid_rent', label: 'Сплачено', w: 'w-20' },
    { key: 'debt', label: 'Борг', w: 'w-20' },
    { key: 'deposit_amount', label: 'Застава', w: 'w-20' },
    { key: 'is_event_manager_client', label: 'Тип', w: 'w-14' },
  ]

  return (
    <div data-testid="orders-management-tab">
      {/* Search & filters */}
      <div className="flex items-center gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Пошук по номеру, клієнту, телефону..."
              className="w-full pl-10 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              data-testid="orders-search-input"
            />
            {search && <button type="button" onClick={() => { setSearch(''); setTimeout(load, 50) }} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-slate-400" /></button>}
          </div>
          <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700" data-testid="orders-search-btn">Знайти</button>
        </form>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg" data-testid="orders-status-filter">
          <option value="all">Всі статуси</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="text-xs text-slate-500">{orders.length} замовлень</div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="orders-management-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {cols.map(c => (
                  <th key={c.key} className={`px-2 py-2.5 text-left font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 select-none ${c.w}`}
                    onClick={() => toggleSort(c.key)} data-testid={`sort-${c.key}`}>
                    <div className="flex items-center gap-1">
                      {c.label} <SortIcon col={c.key} />
                    </div>
                  </th>
                ))}
                <th className="px-2 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={cols.length + 1} className="py-12 text-center text-slate-400">Завантаження...</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={cols.length + 1} className="py-12 text-center text-slate-400">Замовлень не знайдено</td></tr>
              ) : sorted.map(o => (
                <React.Fragment key={o.order_id}>
                  <tr className={`border-b border-slate-100 hover:bg-blue-50/30 cursor-pointer transition-colors ${expandedId === o.order_id ? 'bg-blue-50/50' : ''} ${o.debt > 0 ? 'bg-red-50/20' : ''}`}
                    onClick={() => toggleExpand(o.order_id)} data-testid={`order-row-${o.order_id}`}>
                    <td className="px-2 py-2 font-mono font-semibold text-blue-700">{o.order_number}</td>
                    <td className="px-2 py-2 truncate max-w-[140px]" title={o.customer_name}>{o.customer_name}</td>
                    <td className="px-2 py-2 truncate max-w-[110px] text-slate-600">{o.manager_name || '—'}</td>
                    <td className="px-2 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[o.status] || 'bg-gray-100'}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-slate-600">{fmtDate(o.rental_start)}</td>
                    {editingId === o.order_id ? (
                      <>
                        <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                          <input type="number" value={editData.total_price} onChange={e => setEditData(d => ({...d, total_price: +e.target.value}))}
                            className="w-full px-1 py-1 text-xs border rounded" />
                        </td>
                        <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                          <input type="number" value={editData.discount_amount} onChange={e => setEditData(d => ({...d, discount_amount: +e.target.value}))}
                            className="w-full px-1 py-1 text-xs border rounded" />
                        </td>
                        <td className="px-2 py-2 font-semibold">₴{fmtUA(Math.max(0, (editData.total_price || 0) - (editData.discount_amount || 0) + (editData.service_fee || 0)))}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-2">₴{fmtUA(o.total_price)}</td>
                        <td className="px-2 py-2 text-slate-500">{o.discount_amount > 0 ? `-₴${fmtUA(o.discount_amount)}` : '—'}</td>
                        <td className="px-2 py-2 font-semibold">₴{fmtUA(o.total_to_pay)}</td>
                      </>
                    )}
                    <td className="px-2 py-2 text-emerald-600 font-medium">{o.paid_rent > 0 ? `₴${fmtUA(o.paid_rent)}` : '—'}</td>
                    <td className={`px-2 py-2 font-bold ${o.debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {o.debt > 0 ? `₴${fmtUA(o.debt)}` : '✓'}
                    </td>
                    <td className="px-2 py-2 text-slate-500">₴{fmtUA(o.deposit_amount)}</td>
                    <td className="px-2 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${o.is_event_manager_client ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
                        {o.is_event_manager_client ? 'ІМ' : 'Прямий'}
                      </span>
                    </td>
                    <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                      {editingId === o.order_id ? (
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(o.order_id)} className="p-1 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-700" data-testid={`save-edit-${o.order_id}`}><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1 rounded bg-slate-100 hover:bg-slate-200"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(o)} className="p-1 rounded hover:bg-slate-100" data-testid={`edit-btn-${o.order_id}`}><Pencil className="w-3.5 h-3.5 text-slate-400" /></button>
                      )}
                    </td>
                  </tr>

                  {/* Expanded: payments detail */}
                  {expandedId === o.order_id && (
                    <tr>
                      <td colSpan={cols.length + 1} className="bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold text-slate-700">
                            Платежі — {o.order_number} ({o.customer_name})
                          </div>
                          <button onClick={() => setAddPayment({ payment_type: 'rent', method: 'cash', amount: o.debt > 0 ? o.debt : 0, note: '' })}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                            data-testid={`add-payment-btn-${o.order_id}`}>
                            <Plus className="w-3 h-3" /> Додати платіж
                          </button>
                        </div>

                        {loadingPayments ? (
                          <div className="text-xs text-slate-400 py-4 text-center">Завантаження...</div>
                        ) : payments.length === 0 && !addPayment ? (
                          <div className="text-xs text-slate-400 py-4 text-center">Платежів немає</div>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-slate-500">
                                <th className="pb-1 pr-2">Тип</th>
                                <th className="pb-1 pr-2">Метод</th>
                                <th className="pb-1 pr-2">Сума</th>
                                <th className="pb-1 pr-2">Дата</th>
                                <th className="pb-1 pr-2">Примітка</th>
                                <th className="pb-1 w-20"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {payments.map(p => (
                                editPaymentId === p.id ? (
                                  <tr key={p.id} className="border-t border-slate-200">
                                    <td className="py-1.5 pr-2">
                                      <select value={editPaymentData.payment_type || p.payment_type}
                                        onChange={e => setEditPaymentData(d => ({...d, payment_type: e.target.value}))}
                                        className="px-1 py-1 border rounded text-xs w-full">
                                        <option value="rent">Оренда</option>
                                        <option value="additional">Допослуга</option>
                                        <option value="deposit">Застава</option>
                                        <option value="damage">Збиток</option>
                                      </select>
                                    </td>
                                    <td className="py-1.5 pr-2">
                                      <select value={editPaymentData.method || p.method}
                                        onChange={e => setEditPaymentData(d => ({...d, method: e.target.value}))}
                                        className="px-1 py-1 border rounded text-xs w-full">
                                        <option value="cash">Готівка</option>
                                        <option value="bank">Безготівка</option>
                                      </select>
                                    </td>
                                    <td className="py-1.5 pr-2">
                                      <input type="number" value={editPaymentData.amount ?? p.amount}
                                        onChange={e => setEditPaymentData(d => ({...d, amount: +e.target.value}))}
                                        className="w-20 px-1 py-1 border rounded text-xs" />
                                    </td>
                                    <td className="py-1.5 pr-2">
                                      <input type="date" value={(editPaymentData.occurred_at || p.occurred_at || '').substring(0,10)}
                                        onChange={e => setEditPaymentData(d => ({...d, occurred_at: e.target.value}))}
                                        className="px-1 py-1 border rounded text-xs" />
                                    </td>
                                    <td className="py-1.5 pr-2">
                                      <input value={editPaymentData.note ?? (p.note || '')}
                                        onChange={e => setEditPaymentData(d => ({...d, note: e.target.value}))}
                                        className="w-full px-1 py-1 border rounded text-xs" />
                                    </td>
                                    <td className="py-1.5 flex gap-1">
                                      <button onClick={() => handleSavePayment(o.order_id, p.id)} className="p-1 bg-emerald-100 rounded hover:bg-emerald-200 text-emerald-700"><Check className="w-3 h-3" /></button>
                                      <button onClick={() => setEditPaymentId(null)} className="p-1 bg-slate-100 rounded hover:bg-slate-200"><X className="w-3 h-3" /></button>
                                    </td>
                                  </tr>
                                ) : (
                                  <tr key={p.id} className="border-t border-slate-200 hover:bg-white">
                                    <td className="py-1.5 pr-2">
                                      <span className={`px-1.5 py-0.5 rounded ${p.payment_type === 'rent' ? 'bg-blue-100 text-blue-700' : p.payment_type === 'deposit' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {p.payment_type === 'rent' ? 'Оренда' : p.payment_type === 'deposit' ? 'Застава' : p.payment_type === 'damage' ? 'Збиток' : p.payment_type}
                                      </span>
                                    </td>
                                    <td className="py-1.5 pr-2">
                                      <span className="flex items-center gap-1">
                                        {p.method === 'cash' ? <Banknote className="w-3 h-3 text-green-600" /> : <Building2 className="w-3 h-3 text-blue-600" />}
                                        {p.method === 'cash' ? 'Готівка' : 'Безготівка'}
                                      </span>
                                    </td>
                                    <td className="py-1.5 pr-2 font-semibold text-emerald-700">₴{fmtUA(p.amount)}</td>
                                    <td className="py-1.5 pr-2 text-slate-500">{fmtDate(p.occurred_at)}</td>
                                    <td className="py-1.5 pr-2 text-slate-500 truncate max-w-[200px]">{p.note || '—'}</td>
                                    <td className="py-1.5 flex gap-1">
                                      <button onClick={() => { setEditPaymentId(p.id); setEditPaymentData({}) }}
                                        className="p-1 rounded hover:bg-blue-100" data-testid={`edit-payment-${p.id}`}><Pencil className="w-3 h-3 text-blue-500" /></button>
                                      <button onClick={() => handleDeletePayment(o.order_id, p.id)}
                                        className="p-1 rounded hover:bg-red-100" data-testid={`delete-payment-${p.id}`}><Trash2 className="w-3 h-3 text-red-500" /></button>
                                    </td>
                                  </tr>
                                )
                              ))}

                              {/* Add payment row */}
                              {addPayment && (
                                <tr className="border-t-2 border-emerald-200 bg-emerald-50/50">
                                  <td className="py-1.5 pr-2">
                                    <select value={addPayment.payment_type} onChange={e => setAddPayment(d => ({...d, payment_type: e.target.value}))}
                                      className="px-1 py-1 border rounded text-xs w-full">
                                      <option value="rent">Оренда</option>
                                      <option value="additional">Допослуга</option>
                                      <option value="deposit">Застава</option>
                                      <option value="damage">Збиток</option>
                                    </select>
                                  </td>
                                  <td className="py-1.5 pr-2">
                                    <select value={addPayment.method} onChange={e => setAddPayment(d => ({...d, method: e.target.value}))}
                                      className="px-1 py-1 border rounded text-xs w-full">
                                      <option value="cash">Готівка</option>
                                      <option value="bank">Безготівка</option>
                                    </select>
                                  </td>
                                  <td className="py-1.5 pr-2">
                                    <input type="number" value={addPayment.amount} onChange={e => setAddPayment(d => ({...d, amount: +e.target.value}))}
                                      className="w-20 px-1 py-1 border rounded text-xs" data-testid="new-payment-amount" />
                                  </td>
                                  <td className="py-1.5 pr-2">
                                    <input type="date" value={addPayment.occurred_at || new Date().toISOString().substring(0,10)}
                                      onChange={e => setAddPayment(d => ({...d, occurred_at: e.target.value}))}
                                      className="px-1 py-1 border rounded text-xs" />
                                  </td>
                                  <td className="py-1.5 pr-2">
                                    <input value={addPayment.note} onChange={e => setAddPayment(d => ({...d, note: e.target.value}))}
                                      placeholder="Примітка" className="w-full px-1 py-1 border rounded text-xs" />
                                  </td>
                                  <td className="py-1.5 flex gap-1">
                                    <button onClick={() => handleAddPayment(o.order_id)}
                                      className="p-1 bg-emerald-600 rounded text-white hover:bg-emerald-700" data-testid="confirm-add-payment"><Check className="w-3 h-3" /></button>
                                    <button onClick={() => setAddPayment(null)} className="p-1 bg-slate-100 rounded hover:bg-slate-200"><X className="w-3 h-3" /></button>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        )}

                        {/* Order summary */}
                        <div className="mt-3 pt-2 border-t border-slate-200 flex gap-6 text-xs">
                          <div><span className="text-slate-500">Вартість:</span> <span className="font-semibold">₴{fmtUA(o.total_price)}</span></div>
                          {o.discount_amount > 0 && <div><span className="text-slate-500">Знижка:</span> <span className="text-orange-600">-₴{fmtUA(o.discount_amount)} ({o.discount_percent}%)</span></div>}
                          {o.service_fee > 0 && <div><span className="text-slate-500">Послуга:</span> <span>+₴{fmtUA(o.service_fee)}</span></div>}
                          <div><span className="text-slate-500">До сплати:</span> <span className="font-bold">₴{fmtUA(o.total_to_pay)}</span></div>
                          <div><span className="text-slate-500">Сплачено:</span> <span className="text-emerald-600 font-semibold">₴{fmtUA(o.paid_rent)}</span></div>
                          {o.debt > 0 && <div><span className="text-slate-500">Борг:</span> <span className="text-red-600 font-bold">₴{fmtUA(o.debt)}</span></div>}
                          <div><span className="text-slate-500">Застава:</span> <span>₴{fmtUA(o.deposit_amount)} ({o.deposit_status})</span></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
