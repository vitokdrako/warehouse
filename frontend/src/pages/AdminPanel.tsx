import React, { useState, useEffect } from 'react'

const API_URL = process.env.REACT_APP_BACKEND_URL

const cls = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

type Tab = 'users' | 'categories' | 'vendors' | 'expense-categories' | 'employees' | 'payroll' | 'settings' | 'logs'

// Dynamic tab configuration
interface TabConfig {
  id: Tab
  label: string
  icon: string
  component: string
  permissions?: string[]
}

const ADMIN_TABS: TabConfig[] = [
  { id: 'users', label: 'Користувачі', icon: '👥', component: 'UsersTab' },
  { id: 'employees', label: 'Працівники', icon: '👷', component: 'EmployeesTab' },
  { id: 'payroll', label: 'Зарплати', icon: '💰', component: 'PayrollTab' },
  { id: 'vendors', label: 'Підрядники', icon: '🏢', component: 'VendorsTab' },
  { id: 'categories', label: 'Категорії товарів', icon: '📁', component: 'CategoriesTab' },
  { id: 'expense-categories', label: 'Категорії витрат', icon: '💸', component: 'ExpenseCategoriesTab' },
  { id: 'settings', label: 'Налаштування', icon: '⚙️', component: 'SettingsTab' },
  { id: 'logs', label: 'Логи системи', icon: '📋', component: 'LogsTab' },
]

interface User {
  user_id: number
  username: string
  email: string
  firstname: string
  lastname: string
  role: string
  is_active: boolean
  created_at: string
  last_login?: string
}

interface Category {
  category_id: number
  name: string
  parent_id: number | null
  description: string
  sort_order: number
  is_active: boolean
  created_at: string
}

const ROLES = [
  { value: 'admin', label: '👑 Адміністратор' },
  { value: 'manager', label: '📊 Менеджер' },
  { value: 'office_manager', label: '🏢 Офіс-менеджер' },
  { value: 'requisitor', label: 'Реквізитор' },
]

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [users, setUsers] = useState<User[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [expenseCategories, setExpenseCategories] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [payroll, setPayroll] = useState<any[]>([])
  const [systemLogs, setSystemLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  // User form
  const [showUserForm, setShowUserForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    firstname: '',
    lastname: '',
    role: 'requisitor'
  })
  
  // Category form
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    parent_id: null as number | null,
    description: '',
    sort_order: 0
  })
  
  // Vendor form
  const [showVendorForm, setShowVendorForm] = useState(false)
  const [vendorForm, setVendorForm] = useState({
    name: '', vendor_type: 'service', contact_name: '', phone: '', email: '', address: '', iban: '', note: ''
  })
  
  // Expense category form
  const [showExpenseCatForm, setShowExpenseCatForm] = useState(false)
  const [expenseCatForm, setExpenseCatForm] = useState({ type: 'expense', code: '', name: '' })
  
  // Employee form
  const [showEmployeeForm, setShowEmployeeForm] = useState(false)
  const [employeeForm, setEmployeeForm] = useState({
    name: '', role: 'assistant', phone: '', email: '', base_salary: 0, note: ''
  })
  
  // Password reset
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordUserId, setPasswordUserId] = useState<number | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (activeTab === 'users') loadUsers()
    else if (activeTab === 'categories') loadCategories()
    else if (activeTab === 'vendors') loadVendors()
    else if (activeTab === 'expense-categories') loadExpenseCategories()
    else if (activeTab === 'employees') loadEmployees()
    else if (activeTab === 'payroll') loadPayroll()
    else if (activeTab === 'logs') loadSystemLogs()
  }, [activeTab])
  
  const loadPayroll = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/api/finance/payroll`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
      if (response.ok) {
        const data = await response.json()
        setPayroll(data.payroll || [])
      }
    } catch (error) {
      console.error('Error loading payroll:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const loadSystemLogs = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/api/orders?limit=50`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
      if (response.ok) {
        const data = await response.json()
        // Use order lifecycle as basic system logs
        setSystemLogs(data.orders?.slice(0, 20) || [])
      }
    } catch (error) {
      console.error('Error loading logs:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const loadVendors = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/api/finance/vendors`)
      if (response.ok) {
        const data = await response.json()
        setVendors(data.vendors || [])
      }
    } catch (error) {
      console.error('Error loading vendors:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const loadExpenseCategories = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/api/finance/admin/expense-categories`)
      if (response.ok) {
        const data = await response.json()
        setExpenseCategories(data || [])
      }
    } catch (error) {
      console.error('Error loading expense categories:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const loadEmployees = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/api/finance/employees`)
      if (response.ok) {
        const data = await response.json()
        setEmployees(data.employees || [])
      }
    } catch (error) {
      console.error('Error loading employees:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const saveVendor = async () => {
    try {
      const response = await fetch(`${API_URL}/api/finance/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorForm)
      })
      if (response.ok) {
        alert('✅ Підрядника додано!')
        setShowVendorForm(false)
        setVendorForm({ name: '', vendor_type: 'service', contact_name: '', phone: '', email: '', address: '', iban: '', note: '' })
        loadVendors()
      }
    } catch (error) {
      alert('❌ Помилка збереження')
    }
  }
  
  const saveExpenseCategory = async () => {
    try {
      const response = await fetch(`${API_URL}/api/finance/admin/expense-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseCatForm)
      })
      if (response.ok) {
        alert('✅ Категорію витрат додано!')
        setShowExpenseCatForm(false)
        setExpenseCatForm({ type: 'expense', code: '', name: '' })
        loadExpenseCategories()
      }
    } catch (error) {
      alert('❌ Помилка збереження')
    }
  }
  
  const saveEmployee = async () => {
    try {
      const response = await fetch(`${API_URL}/api/finance/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeForm)
      })
      if (response.ok) {
        alert('✅ Працівника додано!')
        setShowEmployeeForm(false)
        setEmployeeForm({ name: '', role: 'assistant', phone: '', email: '', base_salary: 0, note: '' })
        loadEmployees()
      }
    } catch (error) {
      alert('❌ Помилка збереження')
    }
  }

  const getToken = () => {
    return localStorage.getItem('token')
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      const token = getToken()
      if (!token) {
        console.error('No token found!')
        return
      }
      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      } else {
        const errData = await response.json()
        console.error('Error loading users:', errData)
      }
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      setLoading(true)
      const token = getToken()
      if (!token) {
        console.error('No token found!')
        return
      }
      const response = await fetch(`${API_URL}/api/admin/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      } else {
        const errData = await response.json()
        console.error('Error loading categories:', errData)
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveUser = async () => {
    try {
      const url = editingUser
        ? `${API_URL}/api/admin/users/${editingUser.user_id}`
        : `${API_URL}/api/admin/users`
      
      const response = await fetch(url, {
        method: editingUser ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(userForm)
      })

      if (response.ok) {
        alert(editingUser ? '✅ Користувача оновлено!' : '✅ Користувача створено!')
        setShowUserForm(false)
        setEditingUser(null)
        setUserForm({ username: '', email: '', password: '', firstname: '', lastname: '', role: 'requisitor' })
        loadUsers()
      } else {
        const error = await response.json()
        alert(`❌ Помилка: ${error.detail}`)
      }
    } catch (error) {
      alert('❌ Помилка збереження')
    }
  }

  const deleteUser = async (userId: number) => {
    if (!window.confirm('Видалити користувача?')) return
    
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      })

      if (response.ok) {
        alert('✅ Користувача видалено!')
        loadUsers()
      } else {
        const error = await response.json()
        alert(`❌ ${error.detail}`)
      }
    } catch (error) {
      alert('❌ Помилка видалення')
    }
  }

  const openPasswordModal = (userId: number) => {
    setPasswordUserId(userId)
    setNewPassword('')
    setConfirmPassword('')
    setShowPasswordModal(true)
  }

  const resetPassword = async () => {
    if (!passwordUserId) return
    
    if (newPassword.length < 4) {
      alert('❌ Пароль має бути мінімум 4 символи')
      return
    }
    
    if (newPassword !== confirmPassword) {
      alert('❌ Паролі не співпадають')
      return
    }
    
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${passwordUserId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ password: newPassword })
      })

      if (response.ok) {
        alert('✅ Пароль успішно змінено!')
        setShowPasswordModal(false)
        setPasswordUserId(null)
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const error = await response.json()
        alert(`❌ ${error.detail}`)
      }
    } catch (error) {
      alert('❌ Помилка зміни пароля')
    }
  }

  const saveCategory = async () => {
    try {
      const url = editingCategory
        ? `${API_URL}/api/admin/categories/${editingCategory.category_id}`
        : `${API_URL}/api/admin/categories`
      
      const response = await fetch(url, {
        method: editingCategory ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(categoryForm)
      })

      if (response.ok) {
        alert(editingCategory ? '✅ Категорію оновлено!' : '✅ Категорію створено!')
        setShowCategoryForm(false)
        setEditingCategory(null)
        setCategoryForm({ name: '', parent_id: null, description: '', sort_order: 0 })
        loadCategories()
      } else {
        const error = await response.json()
        alert(`❌ Помилка: ${error.detail}`)
      }
    } catch (error) {
      alert('❌ Помилка збереження')
    }
  }

  const deleteCategory = async (categoryId: number) => {
    if (!window.confirm('Видалити категорію?')) return
    
    try {
      const response = await fetch(`${API_URL}/api/admin/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      })

      if (response.ok) {
        alert('✅ Категорію видалено!')
        loadCategories()
      } else {
        const error = await response.json()
        alert(`❌ ${error.detail}`)
      }
    } catch (error) {
      alert('❌ Помилка видалення')
    }
  }

  const getCategoryName = (id: number | null) => {
    if (!id) return '-'
    return categories.find(c => c.category_id === id)?.name || '-'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">⚙️ Адмін-панель</h1>
          <p className="text-gray-600 mt-1">Управління системою</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px flex-wrap">
              <button
                onClick={() => setActiveTab('users')}
                className={cls(
                  'px-6 py-3 border-b-2 font-medium text-sm transition',
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                👥 Користувачі
              </button>
              <button
                onClick={() => setActiveTab('categories')}
                className={cls(
                  'px-6 py-3 border-b-2 font-medium text-sm transition',
                  activeTab === 'categories'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                📁 Категорії
              </button>
              <button
                onClick={() => setActiveTab('vendors')}
                className={cls(
                  'px-6 py-3 border-b-2 font-medium text-sm transition',
                  activeTab === 'vendors'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                🏢 Підрядники
              </button>
              <button
                onClick={() => setActiveTab('expense-categories')}
                className={cls(
                  'px-6 py-3 border-b-2 font-medium text-sm transition',
                  activeTab === 'expense-categories'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                💸 Категорії витрат
              </button>
              <button
                onClick={() => setActiveTab('employees')}
                className={cls(
                  'px-6 py-3 border-b-2 font-medium text-sm transition',
                  activeTab === 'employees'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                👷 Працівники
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Користувачі системи</h2>
              <button
                onClick={() => {
                  setEditingUser(null)
                  setUserForm({ username: '', email: '', password: '', firstname: '', lastname: '', role: 'requisitor' })
                  setShowUserForm(true)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                + Додати користувача
              </button>
            </div>

            {loading ? (
              <p className="text-center py-8 text-gray-500">Завантаження...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ім'я</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Роль</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Останній вхід</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map(user => (
                      <tr key={user.user_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{user.firstname} {user.lastname}</div>
                          <div className="text-sm text-gray-500">@{user.username}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{user.email}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                            {ROLES.find(r => r.value === user.role)?.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {user.is_active ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Активний</span>
                          ) : (
                            <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Заблокований</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {user.last_login ? new Date(user.last_login).toLocaleDateString('uk-UA') : '-'}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => openPasswordModal(user.user_id)}
                            className="text-amber-600 hover:text-amber-800"
                            title="Змінити пароль"
                          >
                            🔑
                          </button>
                          <button
                            onClick={() => {
                              setEditingUser(user)
                              setUserForm({
                                username: user.username,
                                email: user.email,
                                password: '',
                                firstname: user.firstname,
                                lastname: user.lastname,
                                role: user.role
                              })
                              setShowUserForm(true)
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Редагувати
                          </button>
                          <button
                            onClick={() => deleteUser(user.user_id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Видалити
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Категорії товарів</h2>
              <button
                onClick={() => {
                  setEditingCategory(null)
                  setCategoryForm({ name: '', parent_id: null, description: '', sort_order: 0 })
                  setShowCategoryForm(true)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                + Додати категорію
              </button>
            </div>

            {loading ? (
              <p className="text-center py-8 text-gray-500">Завантаження...</p>
            ) : (
              <div className="space-y-2">
                {categories.filter(c => !c.parent_id).map(parent => (
                  <div key={parent.category_id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{parent.name}</h3>
                        {parent.description && (
                          <p className="text-sm text-gray-600 mt-1">{parent.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingCategory(parent)
                            setCategoryForm({
                              name: parent.name,
                              parent_id: parent.parent_id,
                              description: parent.description,
                              sort_order: parent.sort_order
                            })
                            setShowCategoryForm(true)
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Редагувати
                        </button>
                        <button
                          onClick={() => deleteCategory(parent.category_id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Видалити
                        </button>
                      </div>
                    </div>
                    
                    {/* Subcategories */}
                    <div className="ml-6 mt-3 space-y-2">
                      {categories.filter(c => c.parent_id === parent.category_id).map(child => (
                        <div key={child.category_id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                          <div>
                            <span className="text-sm">↳ {child.name}</span>
                            {child.description && (
                              <span className="text-xs text-gray-500 ml-2">({child.description})</span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingCategory(child)
                                setCategoryForm({
                                  name: child.name,
                                  parent_id: child.parent_id,
                                  description: child.description,
                                  sort_order: child.sort_order
                                })
                                setShowCategoryForm(true)
                              }}
                              className="text-blue-600 hover:text-blue-800 text-xs"
                            >
                              Редагувати
                            </button>
                            <button
                              onClick={() => deleteCategory(child.category_id)}
                              className="text-red-600 hover:text-red-800 text-xs"
                            >
                              Видалити
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Vendors Tab */}
        {activeTab === 'vendors' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Підрядники / Постачальники</h2>
              <button
                onClick={() => setShowVendorForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                + Додати підрядника
              </button>
            </div>
            {loading ? (
              <p className="text-center py-8 text-gray-500">Завантаження...</p>
            ) : vendors.length === 0 ? (
              <p className="text-center py-8 text-gray-400">Немає підрядників</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Назва</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Контакт</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Телефон</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IBAN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {vendors.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{v.name}</td>
                        <td className="px-4 py-3"><span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">{v.vendor_type}</span></td>
                        <td className="px-4 py-3">{v.contact_name || '—'}</td>
                        <td className="px-4 py-3">{v.phone || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{v.iban || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Expense Categories Tab */}
        {activeTab === 'expense-categories' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Категорії витрат</h2>
              <button
                onClick={() => setShowExpenseCatForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                + Додати категорію
              </button>
            </div>
            {loading ? (
              <p className="text-center py-8 text-gray-500">Завантаження...</p>
            ) : expenseCategories.length === 0 ? (
              <p className="text-center py-8 text-gray-400">Немає категорій витрат</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {expenseCategories.map(c => (
                  <div key={c.id} className={cls('p-4 rounded-xl border', c.type === 'expense' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200')}>
                    <div className="flex items-center justify-between">
                      <span className={cls('px-2 py-1 text-xs rounded-full', c.type === 'expense' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800')}>
                        {c.type === 'expense' ? '💸 Витрата' : '💰 Дохід'}
                      </span>
                      <span className="text-xs text-gray-500">{c.code}</span>
                    </div>
                    <div className="mt-2 font-medium">{c.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Працівники</h2>
              <button
                onClick={() => setShowEmployeeForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                + Додати працівника
              </button>
            </div>
            {loading ? (
              <p className="text-center py-8 text-gray-500">Завантаження...</p>
            ) : employees.length === 0 ? (
              <p className="text-center py-8 text-gray-400">Немає працівників</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ім'я</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Роль</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Телефон</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ставка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {employees.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{e.name}</td>
                        <td className="px-4 py-3"><span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">{e.role}</span></td>
                        <td className="px-4 py-3">{e.phone || '—'}</td>
                        <td className="px-4 py-3">{e.email || '—'}</td>
                        <td className="px-4 py-3 text-right font-medium">₴ {e.base_salary?.toLocaleString() || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Form Modal */}
      {showUserForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">
              {editingUser ? 'Редагувати користувача' : 'Новий користувач'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={!!editingUser}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Пароль {editingUser && '(залишити порожнім, щоб не змінювати)'}
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder={editingUser ? '••••••••' : 'temp123'}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ім'я</label>
                  <input
                    type="text"
                    value={userForm.firstname}
                    onChange={e => setUserForm({ ...userForm, firstname: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Прізвище</label>
                  <input
                    type="text"
                    value={userForm.lastname}
                    onChange={e => setUserForm({ ...userForm, lastname: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
                <select
                  value={userForm.role}
                  onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {ROLES.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={saveUser}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Зберегти
              </button>
              <button
                onClick={() => {
                  setShowUserForm(false)
                  setEditingUser(null)
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">
              {editingCategory ? 'Редагувати категорію' : 'Нова категорія'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Назва</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Батьківська категорія</label>
                <select
                  value={categoryForm.parent_id || ''}
                  onChange={e => setCategoryForm({ ...categoryForm, parent_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">- Головна категорія -</option>
                  {categories.filter(c => !c.parent_id).map(cat => (
                    <option key={cat.category_id} value={cat.category_id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Опис</label>
                <textarea
                  value={categoryForm.description}
                  onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Порядок сортування</label>
                <input
                  type="number"
                  value={categoryForm.sort_order}
                  onChange={e => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={saveCategory}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Зберегти
              </button>
              <button
                onClick={() => {
                  setShowCategoryForm(false)
                  setEditingCategory(null)
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-xl font-semibold mb-4">🔑 Змінити пароль</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Новий пароль</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Мінімум 4 символи"
                  autoComplete="new-password"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Підтвердіть пароль</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Повторіть пароль"
                  autoComplete="new-password"
                />
              </div>
              
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-red-500 text-sm">❌ Паролі не співпадають</p>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={resetPassword}
                disabled={!newPassword || newPassword !== confirmPassword || newPassword.length < 4}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Змінити пароль
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setPasswordUserId(null)
                  setNewPassword('')
                  setConfirmPassword('')
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Form Modal */}
      {showVendorForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">🏢 Новий підрядник</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Назва *</label>
                <input type="text" value={vendorForm.name} onChange={e => setVendorForm({...vendorForm, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
                <select value={vendorForm.vendor_type} onChange={e => setVendorForm({...vendorForm, vendor_type: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                  <option value="service">Сервіс</option>
                  <option value="cleaning">Прання/Чистка</option>
                  <option value="repair">Ремонт</option>
                  <option value="delivery">Доставка</option>
                  <option value="supplier">Постачальник</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Контактна особа</label>
                  <input type="text" value={vendorForm.contact_name} onChange={e => setVendorForm({...vendorForm, contact_name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                  <input type="tel" value={vendorForm.phone} onChange={e => setVendorForm({...vendorForm, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={vendorForm.email} onChange={e => setVendorForm({...vendorForm, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Адреса</label>
                <input type="text" value={vendorForm.address} onChange={e => setVendorForm({...vendorForm, address: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                <input type="text" value={vendorForm.iban} onChange={e => setVendorForm({...vendorForm, iban: e.target.value})} className="w-full px-3 py-2 border rounded-lg font-mono" placeholder="UA..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Примітка</label>
                <textarea value={vendorForm.note} onChange={e => setVendorForm({...vendorForm, note: e.target.value})} className="w-full px-3 py-2 border rounded-lg" rows={2} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveVendor} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Зберегти</button>
              <button onClick={() => setShowVendorForm(false)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">Скасувати</button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Category Form Modal */}
      {showExpenseCatForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">💸 Нова категорія витрат</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
                <select value={expenseCatForm.type} onChange={e => setExpenseCatForm({...expenseCatForm, type: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                  <option value="expense">Витрата</option>
                  <option value="income">Дохід</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Код *</label>
                <input type="text" value={expenseCatForm.code} onChange={e => setExpenseCatForm({...expenseCatForm, code: e.target.value.toUpperCase()})} className="w-full px-3 py-2 border rounded-lg font-mono" placeholder="RENT, SALARY, FUEL..." required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Назва *</label>
                <input type="text" value={expenseCatForm.name} onChange={e => setExpenseCatForm({...expenseCatForm, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="Оренда офісу" required />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveExpenseCategory} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Зберегти</button>
              <button onClick={() => setShowExpenseCatForm(false)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">Скасувати</button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Form Modal */}
      {showEmployeeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">👷 Новий працівник</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ПІБ *</label>
                <input type="text" value={employeeForm.name} onChange={e => setEmployeeForm({...employeeForm, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
                <select value={employeeForm.role} onChange={e => setEmployeeForm({...employeeForm, role: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                  <option value="manager">Менеджер</option>
                  <option value="courier">Кур'єр</option>
                  <option value="cleaner">Комірник/Прибиральник</option>
                  <option value="assistant">Асистент</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                  <input type="tel" value={employeeForm.phone} onChange={e => setEmployeeForm({...employeeForm, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ставка (₴)</label>
                  <input type="number" value={employeeForm.base_salary} onChange={e => setEmployeeForm({...employeeForm, base_salary: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={employeeForm.email} onChange={e => setEmployeeForm({...employeeForm, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Примітка</label>
                <textarea value={employeeForm.note} onChange={e => setEmployeeForm({...employeeForm, note: e.target.value})} className="w-full px-3 py-2 border rounded-lg" rows={2} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveEmployee} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Зберегти</button>
              <button onClick={() => setShowEmployeeForm(false)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">Скасувати</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
