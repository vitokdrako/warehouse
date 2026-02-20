/* eslint-disable */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CorporateHeader from '../components/CorporateHeader';
import { Search, Filter, ChevronDown, RefreshCw, Edit3, Eye, Clock, Package, CheckCircle, AlertTriangle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Utility function for authenticated fetch
const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('token');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
};

export default function ManagerCabinet() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState([]);
  const [financeData, setFinanceData] = useState({ revenue: 0, deposits: 0 });
  const navigate = useNavigate();
  
  // Фільтри
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [financeFilter, setFinanceFilter] = useState('all');
  
  // ✅ Режим об'єднання замовлень
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState([]);
  
  // Користувач
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  // Завантаження даних
  const fetchData = async () => {
    setLoading(true);
    try {
      // Завантажити всі активні замовлення
      const response = await authFetch(`${BACKEND_URL}/api/decor-orders?status=awaiting_customer,processing,ready_for_issue`);
      if (response.ok) {
        const data = await response.json();
        // ✅ API повертає { orders: [...], total, limit, offset }
        setOrders(Array.isArray(data) ? data : (data.orders || []));
      }
      
      // Завантажити список менеджерів
      const managersRes = await authFetch(`${BACKEND_URL}/api/tasks/staff`);
      if (managersRes.ok) {
        const managersData = await managersRes.json();
        const staffList = Array.isArray(managersData) ? managersData : [];
        setManagers(staffList.filter(m => ['admin', 'manager', 'office_manager'].includes(m.role)));
      }
      
      // Завантажити фінансові дані
      try {
        const financeRes = await authFetch(`${BACKEND_URL}/api/finance/cabinet`);
        if (financeRes.ok) {
          const fData = await financeRes.json();
          setFinanceData({
            revenue: fData.total_rental || fData.revenue || 0,
            deposits: fData.active_deposits_count || fData.deposits || 0
          });
        }
      } catch (e) {
        console.log('Finance data not available');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Автооновлення кожні 30 секунд
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Функція для об'єднання замовлень
  const handleMergeOrders = async () => {
    if (selectedForMerge.length < 2) {
      alert('Виберіть мінімум 2 замовлення для об\'єднання');
      return;
    }
    
    // Останнє вибране буде цільовим (його номер залишиться)
    const targetOrderId = selectedForMerge[selectedForMerge.length - 1];
    const sourceOrderIds = selectedForMerge.slice(0, -1);
    
    const targetOrder = orders.find(o => o.order_id === targetOrderId);
    const sourceOrders = sourceOrderIds.map(id => orders.find(o => o.order_id === id)).filter(Boolean);
    
    const confirmMsg = `Об'єднати ${selectedForMerge.length} замовлень?\n\n` +
      `Товари з:\n${sourceOrders.map(o => `  • ${o.order_number} (${o.customer_name})`).join('\n')}\n\n` +
      `Будуть перенесені в:\n  → ${targetOrder?.order_number} (${targetOrder?.customer_name})\n\n` +
      `⚠️ Старі замовлення будуть видалені!`;
    
    if (!window.confirm(confirmMsg)) {
      return;
    }
    
    try {
      const response = await authFetch(`${BACKEND_URL}/api/orders/merge`, {
        method: 'POST',
        body: JSON.stringify({
          target_order_id: targetOrderId,
          source_order_ids: sourceOrderIds
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`✅ Замовлення об'єднано!\n\nНовий номер: ${result.order_number}\nТоварів: ${result.items_count}\nСума: ₴${result.total_price}`);
        setMergeMode(false);
        setSelectedForMerge([]);
        fetchData(); // Перезавантажити дані
      } else {
        const error = await response.json();
        alert(`❌ Помилка: ${error.detail || 'Не вдалося об\'єднати замовлення'}`);
      }
    } catch (error) {
      console.error('Error merging orders:', error);
      alert(`❌ Помилка: ${error.message}`);
    }
  };

  // ✅ Toggle вибору замовлення для об'єднання
  const toggleMergeSelection = (orderId) => {
    setSelectedForMerge(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  // Фільтрація замовлень
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Пошук
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          order.order_number?.toLowerCase().includes(query) ||
          order.customer_name?.toLowerCase().includes(query) ||
          order.customer_phone?.includes(query);
        if (!matchesSearch) return false;
      }
      
      // Фільтр по статусу
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }
      
      // Фільтр по менеджеру
      if (managerFilter !== 'all' && order.manager_id !== parseInt(managerFilter)) {
        return false;
      }
      
      return true;
    });
  }, [orders, searchQuery, statusFilter, managerFilter]);

  // Розділення на колонки
  const awaitingOrders = filteredOrders.filter(o => o.status === 'awaiting_customer');
  const inProgressOrders = filteredOrders.filter(o => ['processing', 'ready_for_issue'].includes(o.status));

  // Функція для скасування замовлення
  const handleCancelByClient = async (orderId, orderNumber) => {
    const reason = prompt(`Скасувати замовлення ${orderNumber}?\n\nПричина відмови клієнта (опціонально):`);
    if (reason === null) return;
    
    if (!confirm(`⚠️ Клієнт відмовився від замовлення ${orderNumber}?\n\nЗамовлення буде скасовано і товари розморожено.`)) {
      return;
    }
    
    try {
      const response = await authFetch(`${BACKEND_URL}/api/decor-orders/${orderId}/cancel-by-client`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || 'Клієнт відмовився' })
      });
      
      if (response.ok) {
        alert('✅ Замовлення скасовано');
        fetchData();
      } else {
        const error = await response.json();
        alert(`❌ Помилка: ${error.detail}`);
      }
    } catch (error) {
      alert(`❌ Помилка: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-corp-bg-page font-montserrat">
      <CorporateHeader cabinetName="Менеджерська" />
      
      {/* Filters Bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Пошук по номеру, клієнту, телефону..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-corp-primary focus:border-transparent"
              />
            </div>
            
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="all">Всі статуси</option>
              <option value="awaiting_customer">Очікують підтвердження</option>
              <option value="processing">На комплектації</option>
              <option value="ready_for_issue">Готово до видачі</option>
            </select>
            
            {/* Manager Filter */}
            <select
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="all">Всі менеджери</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
            
            <div className="h-6 w-px bg-slate-200 mx-1" />
            
            {/* ✅ Кнопка режиму об'єднання */}
            <button
              onClick={() => {
                setMergeMode(!mergeMode);
                if (mergeMode) setSelectedForMerge([]);
              }}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                mergeMode 
                  ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100' 
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {mergeMode ? '✕ Скасувати' : '🔗 Об\'єднати'}
            </button>
            
            {/* ✅ Панель об'єднання */}
            {mergeMode && selectedForMerge.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-sm text-amber-700">
                  Вибрано: <b>{selectedForMerge.length}</b>
                </span>
                <button
                  onClick={handleMergeOrders}
                  disabled={selectedForMerge.length < 2}
                  className="px-3 py-1 rounded bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Об'єднати →
                </button>
              </div>
            )}
            
            {/* Refresh Button */}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            {/* Stats */}
            <div className="ml-auto flex items-center gap-4 text-sm">
              <span className="text-slate-500">
                Знайдено: <b className="text-slate-800">{filteredOrders.length}</b>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Two Columns */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Column 1: Awaiting Confirmation */}
          <Column 
            title="📥 Очікують підтвердження" 
            subtitle={`${awaitingOrders.length} замовлень`}
            tone="warn"
          >
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="rounded-xl border border-slate-200 p-4 h-32 bg-slate-50 animate-pulse" />
                ))}
              </div>
            ) : awaitingOrders.length > 0 ? (
              <div className="space-y-3">
                {awaitingOrders.map(order => (
                  <ManagerOrderCard
                    key={order.order_id}
                    order={order}
                    onEdit={() => navigate(`/order/${order.order_id}/view`)}
                    onCancel={() => handleCancelByClient(order.order_id, order.order_number)}
                    showProgress={false}
                    mergeMode={mergeMode}
                    isSelected={selectedForMerge.includes(order.order_id)}
                    selectionIndex={selectedForMerge.indexOf(order.order_id)}
                    onToggleSelect={() => toggleMergeSelection(order.order_id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="Немає замовлень на підтвердження" />
            )}
          </Column>

          {/* Column 2: In Progress */}
          <Column 
            title="📋 Ордери в процесі" 
            subtitle={`${inProgressOrders.length} замовлень`}
            tone="info"
          >
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="rounded-xl border border-slate-200 p-4 h-32 bg-slate-50 animate-pulse" />
                ))}
              </div>
            ) : inProgressOrders.length > 0 ? (
              <div className="space-y-3">
                {inProgressOrders.map(order => (
                  <ManagerOrderCard
                    key={order.order_id}
                    order={order}
                    onEdit={() => navigate(`/order/${order.order_id}/view`)}
                    showProgress={true}
                    mergeMode={mergeMode}
                    isSelected={selectedForMerge.includes(order.order_id)}
                    selectionIndex={selectedForMerge.indexOf(order.order_id)}
                    onToggleSelect={() => toggleMergeSelection(order.order_id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="Немає активних замовлень" />
            )}
          </Column>
        </div>
      </main>
    </div>
  );
}

// ============================================================
// COMPONENTS
// ============================================================

function Column({ title, subtitle, children, tone }) {
  const toneStyles = {
    ok: 'ring-emerald-100 border-emerald-200',
    warn: 'ring-amber-100 border-amber-200',
    info: 'ring-blue-100 border-blue-200',
  };
  
  return (
    <section className={`rounded-2xl border p-4 shadow-sm ring-2 bg-white ${toneStyles[tone] || 'ring-slate-100 border-slate-200'}`}>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </header>
      <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
        {children}
      </div>
    </section>
  );
}

function ManagerOrderCard({ order, onEdit, onCancel, showProgress = false, mergeMode = false, isSelected = false, selectionIndex = -1, onToggleSelect }) {
  const fmtUA = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 });
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }) : '—';
  
  // Статус бейджі
  const statusConfig = {
    awaiting_customer: { label: 'Очікує', icon: Clock, color: 'bg-amber-100 text-amber-700' },
    processing: { label: 'На комплектації', icon: Package, color: 'bg-blue-100 text-blue-700' },
    ready_for_issue: { label: 'Готово до видачі', icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700' },
  };
  
  const status = statusConfig[order.status] || { label: order.status, icon: AlertTriangle, color: 'bg-slate-100 text-slate-700' };
  const StatusIcon = status.icon;
  
  // Прогрес комплектації (якщо є)
  const packingProgress = order.packing_progress || 0;
  
  return (
    <div 
      className={`rounded-xl border bg-white hover:shadow-md transition-all ${
        mergeMode && isSelected 
          ? 'border-amber-400 ring-2 ring-amber-200 shadow-md' 
          : 'border-slate-200'
      } ${mergeMode ? 'cursor-pointer' : ''}`}
      onClick={mergeMode ? onToggleSelect : undefined}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          {/* ✅ Checkbox для режиму об'єднання */}
          {mergeMode && (
            <div className="flex items-center justify-center w-6 h-6 mr-2 mt-1">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onToggleSelect}
                onClick={(e) => e.stopPropagation()}
                className="w-5 h-5 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
              />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-slate-800">{order.order_number}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                <StatusIcon className="w-3 h-3" />
                {status.label}
              </span>
              {mergeMode && isSelected && selectionIndex >= 0 && (
                <span className="text-xs font-bold text-amber-600">#{selectionIndex + 1}</span>
              )}
            </div>
            <div className="text-sm font-medium text-slate-700 truncate">{order.customer_name}</div>
            <a 
              href={`tel:${order.customer_phone}`}
              className="text-xs text-corp-primary hover:underline"
              onClick={(e) => mergeMode && e.preventDefault()}
            >
              {order.customer_phone}
            </a>
          </div>
          
          {/* Edit Button - приховуємо в режимі об'єднання */}
          {!mergeMode && (
            <button
              onClick={onEdit}
              className="p-2 rounded-lg bg-corp-primary text-white hover:bg-corp-primary-dark transition-colors"
              title="Редагувати"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Body */}
      <div className="p-4">
        {/* Dates */}
        <div className="flex items-center gap-4 text-sm mb-3">
          <div>
            <span className="text-slate-500">Видача:</span>{' '}
            <span className="font-medium">{fmtDate(order.rental_start_date)}</span>
            {order.issue_time && <span className="text-slate-400 ml-1">{order.issue_time}</span>}
          </div>
          <div>
            <span className="text-slate-500">Повернення:</span>{' '}
            <span className="font-medium">{fmtDate(order.rental_end_date)}</span>
          </div>
        </div>
        
        {/* Finance */}
        <div className="flex items-center gap-4 text-sm mb-3">
          <div>
            <span className="text-slate-500">Оренда:</span>{' '}
            <span className="font-semibold text-slate-800">₴{fmtUA(order.total_rental)}</span>
          </div>
          <div>
            <span className="text-slate-500">Застава:</span>{' '}
            <span className="font-medium text-slate-700">₴{fmtUA(order.total_deposit)}</span>
          </div>
          {order.discount > 0 && (
            <div>
              <span className="text-emerald-600 font-medium">-{order.discount}%</span>
            </div>
          )}
        </div>
        
        {/* Items count */}
        <div className="text-xs text-slate-500 mb-3">
          {order.items?.length || 0} позицій
          {order.manager_name && (
            <span className="ml-2">• Менеджер: <b>{order.manager_name}</b></span>
          )}
        </div>
        
        {/* Progress Bar (for in-progress orders) */}
        {showProgress && order.status === 'processing' && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-500">Прогрес комплектації</span>
              <span className="font-medium text-slate-700">{packingProgress}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${packingProgress}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Customer comment */}
        {order.customer_comment && (
          <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            💬 {order.customer_comment}
          </div>
        )}
      </div>
      
      {/* Footer Actions */}
      {onCancel && order.status === 'awaiting_customer' && (
        <div className="px-4 pb-4">
          <button
            onClick={onCancel}
            className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            ❌ Клієнт відмовився
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
      <div className="text-slate-400 text-sm">{message}</div>
    </div>
  );
}
