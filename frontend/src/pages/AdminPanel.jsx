/* eslint-disable */
/**
 * AdminPanel — Управління RentalHub
 * Вкладки: Користувачі, Документи, Категорії, Витрати, Налаштування
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import CorporateHeader from '../components/CorporateHeader'
import { Users, FileText, FolderTree, Receipt, Settings, Plus, Pencil, Trash2, Shield, X, Eye, EyeOff, Key, Save, RefreshCw, Check } from 'lucide-react'
// Lightweight notification
const toast = {
  success: (msg) => { const el = document.createElement('div'); el.className = 'fixed top-4 right-4 z-[999] px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg'; el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 2500) },
  error: (msg) => { const el = document.createElement('div'); el.className = 'fixed top-4 right-4 z-[999] px-4 py-3 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg'; el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 3000) },
}

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''
const cls = (...a) => a.filter(Boolean).join(' ')

const authFetch = async (url, opts = {}) => {
  const token = localStorage.getItem('token')
  return fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers } })
}

// ============================================================
// USERS TAB
// ============================================================
const ROLE_LABELS = { admin: 'Адмін', manager: 'Менеджер', requisitor: 'Реквізитор' }
const ROLE_COLORS = { admin: 'bg-red-50 text-red-700 border-red-200', manager: 'bg-blue-50 text-blue-700 border-blue-200', requisitor: 'bg-emerald-50 text-emerald-700 border-emerald-200' }

function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editUser, setEditUser] = useState(null)
  const [resetPwUser, setResetPwUser] = useState(null)
  const [newPw, setNewPw] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await authFetch(`${BACKEND_URL}/api/admin/users`); if (r.ok) setUsers(await r.json()) }
    catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveUser = async (data) => {
    const method = data.user_id ? 'PUT' : 'POST'
    const url = data.user_id ? `${BACKEND_URL}/api/admin/users/${data.user_id}` : `${BACKEND_URL}/api/admin/users`
    const r = await authFetch(url, { method, body: JSON.stringify(data) })
    if (r.ok) { toast.success(data.user_id ? 'Користувача оновлено' : 'Користувача створено'); setEditUser(null); load() }
    else { const d = await r.json().catch(() => ({})); toast.error(d.detail || 'Помилка') }
  }

  const resetPassword = async () => {
    if (!newPw.trim() || newPw.length < 4) { toast.error('Мінімум 4 символи'); return }
    const r = await authFetch(`${BACKEND_URL}/api/admin/users/${resetPwUser.user_id}/reset-password`, {
      method: 'POST', body: JSON.stringify({ new_password: newPw })
    })
    if (r.ok) { toast.success('Пароль змінено'); setResetPwUser(null); setNewPw('') }
    else toast.error('Помилка зміни пароля')
  }

  const deleteUser = async (id) => {
    if (!window.confirm('Видалити користувача?')) return
    const r = await authFetch(`${BACKEND_URL}/api/admin/users/${id}`, { method: 'DELETE' })
    if (r.ok) { toast.success('Видалено'); load() } else toast.error('Помилка видалення')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-corp-text-muted">{users.length} користувачів</div>
        <button onClick={() => setEditUser({ username: '', email: '', role: 'manager', password: '', firstname: '', lastname: '' })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-corp-primary text-white text-sm font-medium hover:bg-corp-primary-hover transition-colors"
          data-testid="add-user-btn"><Plus className="w-4 h-4" /> Новий</button>
      </div>

      {loading ? <div className="text-center py-8 text-corp-text-muted animate-pulse">Завантаження...</div> : (
        <div className="bg-white rounded-xl border border-corp-border overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-corp-bg-light border-b border-corp-border text-xs text-corp-text-muted">
              <th className="px-4 py-3 text-left">Ім'я</th><th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Роль</th><th className="px-4 py-3 text-right">Дії</th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} className="border-b border-corp-border/50 hover:bg-corp-bg-light/50 transition-colors" data-testid={`user-row-${u.user_id}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-corp-text-dark">{u.firstname} {u.lastname}</div>
                    <div className="text-xs text-corp-text-muted">@{u.username}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-corp-text-main">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={cls('px-2.5 py-1 rounded-lg text-xs font-medium border', ROLE_COLORS[u.role] || 'bg-gray-50 text-gray-600 border-gray-200')}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditUser(u)} className="p-2 rounded-lg hover:bg-corp-bg-light transition-colors" title="Редагувати">
                        <Pencil className="w-4 h-4 text-corp-text-muted" />
                      </button>
                      <button onClick={() => { setResetPwUser(u); setNewPw('') }} className="p-2 rounded-lg hover:bg-corp-bg-light transition-colors" title="Пароль">
                        <Key className="w-4 h-4 text-corp-text-muted" />
                      </button>
                      <button onClick={() => deleteUser(u.user_id)} className="p-2 rounded-lg hover:bg-red-50 transition-colors" title="Видалити">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/Create Modal */}
      {editUser && <UserModal user={editUser} onSave={saveUser} onClose={() => setEditUser(null)} />}

      {/* Reset Password Modal */}
      {resetPwUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setResetPwUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-corp-border p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-corp-text-dark">Змінити пароль: {resetPwUser.username}</div>
              <button onClick={() => setResetPwUser(null)} className="p-1 rounded-lg hover:bg-corp-bg-light"><X className="w-4 h-4" /></button>
            </div>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Новий пароль (мін. 4 символи)"
              className="w-full px-3 py-2.5 rounded-xl border border-corp-border text-sm mb-4 focus:outline-none focus:border-corp-primary" />
            <button onClick={resetPassword} disabled={newPw.length < 4}
              className="w-full py-2.5 rounded-xl bg-corp-primary text-white font-medium text-sm hover:bg-corp-primary-hover disabled:opacity-50">Зберегти</button>
          </div>
        </div>
      )}
    </div>
  )
}

function UserModal({ user, onSave, onClose }) {
  const [form, setForm] = useState({ ...user })
  const isNew = !user.user_id
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-corp-border" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-corp-border flex items-center justify-between">
          <span className="font-semibold text-corp-text-dark">{isNew ? 'Новий користувач' : 'Редагувати'}</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-corp-bg-light"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-corp-text-muted">Ім'я</label>
              <input value={form.firstname || ''} onChange={e => set('firstname', e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-corp-border text-sm focus:outline-none focus:border-corp-primary" /></div>
            <div><label className="text-xs text-corp-text-muted">Прізвище</label>
              <input value={form.lastname || ''} onChange={e => set('lastname', e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-corp-border text-sm focus:outline-none focus:border-corp-primary" /></div>
          </div>
          <div><label className="text-xs text-corp-text-muted">Username</label>
            <input value={form.username || ''} onChange={e => set('username', e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-corp-border text-sm focus:outline-none focus:border-corp-primary" /></div>
          <div><label className="text-xs text-corp-text-muted">Email</label>
            <input value={form.email || ''} onChange={e => set('email', e.target.value)} type="email"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-corp-border text-sm focus:outline-none focus:border-corp-primary" /></div>
          {isNew && <div><label className="text-xs text-corp-text-muted">Пароль</label>
            <input value={form.password || ''} onChange={e => set('password', e.target.value)} type="password"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-corp-border text-sm focus:outline-none focus:border-corp-primary" /></div>}
          <div><label className="text-xs text-corp-text-muted">Роль</label>
            <div className="flex gap-2 mt-2">
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <button key={v} onClick={() => set('role', v)}
                  className={cls('flex-1 py-2 rounded-xl text-xs font-medium border transition-colors',
                    form.role === v ? 'bg-corp-primary text-white border-corp-primary' : 'border-corp-border text-corp-text-main hover:bg-corp-bg-light')}>{l}</button>
              ))}
            </div>
          </div>
          <button onClick={() => onSave(form)} className="w-full py-2.5 rounded-xl bg-corp-primary text-white font-medium text-sm hover:bg-corp-primary-hover mt-2">
            {isNew ? 'Створити' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// DOCUMENTS TAB
// ============================================================
const ALL_DOC_TYPES = [
  { key: 'quote', name: 'Кошторис', desc: 'Попередній розрахунок вартості оренди' },
  { key: 'invoice_offer', name: 'Рахунок-оферта', desc: 'Рахунок на оплату для клієнта' },
  { key: 'master_agreement', name: 'Генеральний договір', desc: 'Основний договір оренди' },
  { key: 'annex_to_contract', name: 'Додаток до договору', desc: 'Специфікація до генерального договору' },
  { key: 'issue_act', name: 'Акт видачі', desc: 'Підтвердження видачі обладнання' },
  { key: 'return_act', name: 'Акт повернення', desc: 'Підтвердження повернення обладнання' },
  { key: 'defect_act', name: 'Акт дефектів', desc: 'Фіксація пошкоджень обладнання' },
  { key: 'contract_rent', name: 'Договір оренди', desc: 'Простий договір оренди' },
  { key: 'picking_list', name: 'Пакувальний лист', desc: 'Перелік обладнання для збору' },
  { key: 'deposit_settlement_act', name: 'Акт взаєморозрахунку депозиту', desc: 'Розрахунок по заставі' },
  { key: 'deposit_refund_act', name: 'Акт повернення депозиту', desc: 'Повернення застави клієнту' },
  { key: 'damage_breakdown', name: 'Калькуляція шкоди', desc: 'Розрахунок вартості пошкоджень' },
  { key: 'damage_settlement_act', name: 'Акт врегулювання шкоди', desc: 'Узгодження компенсації' },
  { key: 'invoice_legal', name: 'Рахунок юр. особа', desc: 'Рахунок для юридичних осіб' },
  { key: 'invoice_additional', name: 'Додатковий рахунок', desc: 'Рахунок на додаткові послуги' },
  { key: 'goods_invoice', name: 'Видаткова накладна', desc: 'Накладна на товар' },
  { key: 'service_act', name: 'Акт наданих послуг', desc: 'Підтвердження послуг' },
]

function DocumentsTab() {
  const [docStats, setDocStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch(`${BACKEND_URL}/api/admin/document-stats`)
        if (r.ok) setDocStats(await r.json())
      } catch (e) { console.error(e) }
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="text-center py-8 text-corp-text-muted animate-pulse">Завантаження...</div>

  return (
    <div className="space-y-4">
      <div className="text-sm text-corp-text-muted">{ALL_DOC_TYPES.length} типів документів</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ALL_DOC_TYPES.map(doc => {
          const count = docStats[doc.key] || 0
          const hasTemplate = ['master_agreement', 'annex_to_contract', 'issue_act', 'return_act', 'defect_act', 'quote', 'invoice_offer'].includes(doc.key)
          return (
            <div key={doc.key} className="bg-white rounded-xl border border-corp-border p-4 hover:shadow-sm transition-shadow" data-testid={`doc-${doc.key}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-corp-text-dark">{doc.name}</div>
                  <div className="text-xs text-corp-text-muted mt-0.5">{doc.desc}</div>
                </div>
                {hasTemplate && <div className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-medium text-emerald-700 flex-shrink-0">Шаблон</div>}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-corp-border/50">
                <span className="text-xs text-corp-text-muted">Створено: <span className="font-semibold text-corp-text-dark">{count}</span></span>
                {count > 0 && <div className="w-16 h-1.5 rounded-full bg-corp-bg-light overflow-hidden">
                  <div className="h-full bg-corp-primary rounded-full" style={{ width: `${Math.min(100, (count / 63) * 100)}%` }} />
                </div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// CATEGORIES TAB
// ============================================================
function CategoriesTab() {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    (async () => {
      try { const r = await authFetch(`${BACKEND_URL}/api/admin/categories`); if (r.ok) setCats(await r.json()) }
      catch (e) { console.error(e) }
      setLoading(false)
    })()
  }, [])

  const filtered = cats.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-corp-text-muted">{cats.length} категорій</div>
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук..."
            className="pl-3 pr-3 py-2 rounded-xl border border-corp-border text-sm w-48 focus:outline-none focus:border-corp-primary" />
        </div>
      </div>
      {loading ? <div className="text-center py-8 text-corp-text-muted animate-pulse">Завантаження...</div> : (
        <div className="bg-white rounded-xl border border-corp-border overflow-hidden max-h-[500px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0"><tr className="bg-corp-bg-light border-b border-corp-border text-xs text-corp-text-muted">
              <th className="px-4 py-3 text-left">ID</th><th className="px-4 py-3 text-left">Назва</th>
              <th className="px-4 py-3 text-left">Батьківська</th><th className="px-4 py-3 text-center">Статус</th>
            </tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.category_id} className="border-b border-corp-border/50 hover:bg-corp-bg-light/50 text-sm">
                  <td className="px-4 py-2.5 text-corp-text-muted text-xs">{c.category_id}</td>
                  <td className="px-4 py-2.5 font-medium text-corp-text-dark">{c.name}</td>
                  <td className="px-4 py-2.5 text-corp-text-muted text-xs">{c.parent_id || '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={cls('px-2 py-0.5 rounded-lg text-[10px] font-medium border',
                      c.status === 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                    )}>{c.status === 1 ? 'Активна' : 'Вимкнена'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ============================================================
// EXPENSE CATEGORIES TAB
// ============================================================
function ExpenseCatsTab() {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [editCat, setEditCat] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await authFetch(`${BACKEND_URL}/api/finance/admin/expense-categories`); if (r.ok) setCats(await r.json()) }
    catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveCat = async () => {
    if (!editCat?.name?.trim()) return
    const method = editCat.id ? 'PUT' : 'POST'
    const url = editCat.id ? `${BACKEND_URL}/api/finance/admin/expense-categories/${editCat.id}` : `${BACKEND_URL}/api/finance/admin/expense-categories`
    const r = await authFetch(url, { method, body: JSON.stringify(editCat) })
    if (r.ok) { toast.success('Збережено'); setEditCat(null); load() } else toast.error('Помилка')
  }

  const deleteCat = async (id) => {
    if (!window.confirm('Видалити категорію?')) return
    const r = await authFetch(`${BACKEND_URL}/api/finance/admin/expense-categories/${id}`, { method: 'DELETE' })
    if (r.ok) { toast.success('Видалено'); load() } else toast.error('Помилка')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-corp-text-muted">{cats.length} категорій витрат</div>
        <button onClick={() => setEditCat({ name: '', description: '' })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-corp-primary text-white text-sm font-medium hover:bg-corp-primary-hover"
          data-testid="add-expense-cat"><Plus className="w-4 h-4" /> Нова</button>
      </div>
      {loading ? <div className="text-center py-8 text-corp-text-muted animate-pulse">Завантаження...</div> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-corp-border p-4 hover:shadow-sm transition-shadow" data-testid={`expense-cat-${c.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div><div className="text-sm font-semibold text-corp-text-dark">{c.name}</div>
                  {c.description && <div className="text-xs text-corp-text-muted mt-0.5">{c.description}</div>}</div>
                <div className="flex gap-1">
                  <button onClick={() => setEditCat(c)} className="p-1.5 rounded-lg hover:bg-corp-bg-light"><Pencil className="w-3.5 h-3.5 text-corp-text-muted" /></button>
                  <button onClick={() => deleteCat(c.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {editCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setEditCat(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-corp-border p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-corp-text-dark">{editCat.id ? 'Редагувати' : 'Нова категорія'}</span>
              <button onClick={() => setEditCat(null)} className="p-1 rounded-lg hover:bg-corp-bg-light"><X className="w-4 h-4" /></button>
            </div>
            <input value={editCat.name || ''} onChange={e => setEditCat(p => ({ ...p, name: e.target.value }))} placeholder="Назва"
              className="w-full px-3 py-2.5 rounded-xl border border-corp-border text-sm mb-3 focus:outline-none focus:border-corp-primary" />
            <input value={editCat.description || ''} onChange={e => setEditCat(p => ({ ...p, description: e.target.value }))} placeholder="Опис (опціонально)"
              className="w-full px-3 py-2.5 rounded-xl border border-corp-border text-sm mb-4 focus:outline-none focus:border-corp-primary" />
            <button onClick={saveCat} className="w-full py-2.5 rounded-xl bg-corp-primary text-white font-medium text-sm hover:bg-corp-primary-hover">Зберегти</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// SETTINGS TAB
// ============================================================
function SettingsTab() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch(`${BACKEND_URL}/api/admin/settings`)
        if (r.ok) setConfig(await r.json())
        else setConfig({
          name: 'ФОП Николенко Наталя Станіславівна', tax_status: 'платник єдиного податку',
          tax_id: '', iban: '', address: 'м. Київ', signer_name: 'Николенко Н.С.', signer_role: '',
          warehouse_address: 'м. Київ, вул. Будіндустрії 4'
        })
      } catch (e) { console.error(e); setConfig({}) }
      setLoading(false)
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const r = await authFetch(`${BACKEND_URL}/api/admin/settings`, { method: 'PUT', body: JSON.stringify(config) })
      if (r.ok) toast.success('Налаштування збережено')
      else toast.error('Помилка збереження')
    } catch (e) { toast.error('Помилка') }
    setSaving(false)
  }

  if (loading || !config) return <div className="text-center py-8 text-corp-text-muted animate-pulse">Завантаження...</div>

  const set = (k, v) => setConfig(p => ({ ...p, [k]: v }))

  const fields = [
    { key: 'name', label: 'Назва ФОП / Компанії' },
    { key: 'short_name', label: 'Коротка назва (бренд)' },
    { key: 'tax_status', label: 'Податковий статус' },
    { key: 'tax_id', label: 'Код за ДРФО (ІПН)' },
    { key: 'iban', label: 'IBAN (р/р)' },
    { key: 'bank_name', label: 'Банк' },
    { key: 'address', label: 'Юридична адреса' },
    { key: 'warehouse_address', label: 'Адреса складу' },
    { key: 'phone', label: 'Телефон' },
    { key: 'email', label: 'Email' },
    { key: 'website', label: 'Вебсайт' },
    { key: 'signer_name', label: 'Підписант (ПІБ)' },
    { key: 'signer_role', label: 'Посада підписанта' },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-corp-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-corp-primary/10 grid place-content-center"><Settings className="w-5 h-5 text-corp-primary" /></div>
          <div>
            <div className="font-semibold text-corp-text-dark">Дані компанії</div>
            <div className="text-xs text-corp-text-muted">Використовуються у документах (кошторис, договори, акти)</div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-corp-text-muted">{f.label}</label>
              <input value={config[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-corp-border text-sm focus:outline-none focus:border-corp-primary" />
            </div>
          ))}
        </div>
        <button onClick={save} disabled={saving}
          className="mt-6 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-corp-primary text-white font-medium text-sm hover:bg-corp-primary-hover disabled:opacity-50 transition-colors"
          data-testid="save-settings">
          <Save className="w-4 h-4" /> {saving ? 'Збереження...' : 'Зберегти'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// MAIN
// ============================================================
const TABS = [
  { key: 'users', label: 'Користувачі', Icon: Users },
  { key: 'documents', label: 'Документи', Icon: FileText },
  { key: 'categories', label: 'Категорії', Icon: FolderTree },
  { key: 'expenses', label: 'Витрати', Icon: Receipt },
  { key: 'settings', label: 'Налаштування', Icon: Settings },
]

export default function AdminPanel() {
  const nav = useNavigate()
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div className="min-h-screen bg-corp-bg-page" data-testid="admin-panel">
      <CorporateHeader cabinetName="Адмін-панель" showBackButton onBackClick={() => nav('/manager')} />

      <div className="mx-auto max-w-6xl px-3 sm:px-6 py-4">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-white rounded-xl p-1.5 border border-corp-border mb-6">
          {TABS.map(tab => {
            const TIcon = tab.Icon; const active = activeTab === tab.key
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={cls('flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                  active ? 'bg-corp-primary text-white shadow-sm' : 'text-corp-text-main hover:bg-corp-bg-light'
                )} data-testid={`admin-tab-${tab.key}`}>
                <TIcon className="w-4 h-4" /> <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'documents' && <DocumentsTab />}
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'expenses' && <ExpenseCatsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}
