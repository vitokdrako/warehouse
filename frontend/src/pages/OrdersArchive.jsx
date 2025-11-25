/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function OrdersArchive() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [lifecycle, setLifecycle] = useState({});
  const [financeHistory, setFinanceHistory] = useState({});
  const navigate = useNavigate();
  
  // Фільтри
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [archiveFilter, setArchiveFilter] = useState('archived'); // archived, active, all
  const [sortBy, setSortBy] = useState('date_desc'); // date_desc, date_asc, amount_desc, amount_asc
  
  useEffect(() => {
    fetchOrders();
  }, [archiveFilter]);
  
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const archiveParam = archiveFilter === 'archived' ? 'true' : archiveFilter === 'active' ? 'false' : 'all';
      const response = await fetch(`${BACKEND_URL}/api/decor-orders?status=all&archived=${archiveParam}&limit=1000`, {
        mode: 'cors'
      });
      const data = await response.json();
      // API повертає {orders: [...], total: X}
      setOrders(data.orders || data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      alert('Помилка завантаження замовлень. Перевірте консоль.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleArchive = async (orderId, orderNumber) => {
    if (!confirm(`Архівувати замовлення ${orderNumber}?`)) {
      return;
    }
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/decor-orders/${orderId}/archive`, {
        method: 'POST',
        mode: 'cors'
      });
      
      if (response.ok) {
        alert('✅ Замовлення архівовано');
        fetchOrders();
      } else {
        const error = await response.json();
        alert(`❌ Помилка: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error archiving order:', error);
      alert(`❌ Помилка: ${error.message}`);
    }
  };
  
  const handleUnarchive = async (orderId, orderNumber) => {
    if (!confirm(`Розархівувати замовлення ${orderNumber}?`)) {
      return;
    }
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/decor-orders/${orderId}/unarchive`, {
        method: 'POST',
        mode: 'cors'
      });
      
      if (response.ok) {
        alert('✅ Замовлення розархівовано');
        fetchOrders();
      } else {
        const error = await response.json();
        alert(`❌ Помилка: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error unarchiving order:', error);
      alert(`❌ Помилка: ${error.message}`);
    }
  };
  
  const fetchLifecycle = async (orderId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${orderId}/lifecycle`, {
        mode: 'cors'
      });
      const data = await response.json();
      setLifecycle(prev => ({ ...prev, [orderId]: data }));
    } catch (error) {
      console.error('Error fetching lifecycle:', error);
    }
  };
  
  const fetchFinanceHistory = async (orderId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/manager/finance/ledger?order_id=${orderId}`, {
        mode: 'cors'
      });
      const data = await response.json();
      setFinanceHistory(prev => ({ ...prev, [orderId]: data }));
    } catch (error) {
      console.error('Error fetching finance history:', error);
    }
  };
  
  const toggleExpand = (order) => {
    const orderId = order.order_id || parseInt(order.id);
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
      if (!lifecycle[orderId]) {
        fetchLifecycle(orderId);
      }
      if (!financeHistory[orderId]) {
        fetchFinanceHistory(orderId);
      }
    }
  };
  
  // Фільтрація
  const filteredOrders = orders.filter(order => {
    // Пошук
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matches = 
        order.order_number?.toLowerCase().includes(query) ||
        order.client_name?.toLowerCase().includes(query) ||
        order.client_phone?.includes(query);
      if (!matches) return false;
    }
    
    // Фільтр за статусом
    if (statusFilter !== 'all' && order.status !== statusFilter) {
      return false;
    }
    
    return true;
  });
  
  // Сортування
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    switch (sortBy) {
      case 'date_desc':
        return new Date(b.created_at) - new Date(a.created_at);
      case 'date_asc':
        return new Date(a.created_at) - new Date(b.created_at);
      case 'amount_desc':
        return (b.total_rental || 0) - (a.total_rental || 0);
      case 'amount_asc':
        return (a.total_rental || 0) - (b.total_rental || 0);
      default:
        return 0;
    }
  });
  
  const statusLabels = {
    awaiting_customer: '⏳ Очікує підтвердження',
    processing: '📦 В обробці',
    ready_for_issue: '✅ Готово до видачі',
    issued: '🚚 Видано',
    on_rent: '🏠 В оренді',
    returned: '✓ Повернуто',
    completed: '✓ Завершено',
    cancelled: '❌ Скасовано',
    declined: '❌ Відхилено'
  };
  
  const statusColors = {
    awaiting_customer: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    ready_for_issue: 'bg-emerald-100 text-emerald-800',
    issued: 'bg-green-100 text-green-800',
    on_rent: 'bg-green-100 text-green-800',
    returned: 'bg-slate-100 text-slate-700',
    completed: 'bg-slate-100 text-slate-700',
    cancelled: 'bg-rose-100 text-rose-800',
    declined: 'bg-rose-100 text-rose-800'
  };
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/manager')}
                className="text-slate-600 hover:text-slate-900"
              >
                ← Назад
              </button>
              <h1 className="text-2xl font-bold text-slate-900">📂 Архів замовлень</h1>
              <span className="text-sm text-slate-500">
                {sortedOrders.length} з {orders.length} замовлень
              </span>
            </div>
            <button
              onClick={fetchOrders}
              className="px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              🔄 Оновити
            </button>
          </div>
          
          {/* Фільтри */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select
              value={archiveFilter}
              onChange={(e) => setArchiveFilter(e.target.value)}
              className="px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-blue-50 font-semibold"
            >
              <option value="archived">📂 Архівні</option>
              <option value="active">📋 Активні</option>
              <option value="all">📊 Всі</option>
            </select>
            
            <input
              type="text"
              placeholder="Пошук (номер, клієнт, телефон)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Всі статуси</option>
              <option value="awaiting_customer">Очікує підтвердження</option>
              <option value="processing">В обробці</option>
              <option value="ready_for_issue">Готово до видачі</option>
              <option value="issued">Видано</option>
              <option value="on_rent">В оренді</option>
              <option value="returned">Повернуто</option>
              <option value="completed">Завершено</option>
              <option value="cancelled">Скасовано</option>
              <option value="declined">Відхилено</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="date_desc">Дата ↓ (нові спочатку)</option>
              <option value="date_asc">Дата ↑ (старі спочатку)</option>
              <option value="amount_desc">Сума ↓ (більші спочатку)</option>
              <option value="amount_asc">Сума ↑ (менші спочатку)</option>
            </select>
            
            <div className="text-sm text-slate-600 flex items-center">
              <span className="mr-2">📊</span>
              Всього: ₴{sortedOrders.reduce((sum, o) => sum + (o.total_rental || 0), 0).toFixed(0)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Orders List */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Завантаження...</div>
        ) : sortedOrders.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {searchQuery || statusFilter !== 'all' ? 'Немає замовлень за обраними фільтрами' : 'Немає замовлень'}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedOrders.map(order => (
              <div key={order.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                {/* Order Header */}
                <div 
                  onClick={() => toggleExpand(order)}
                  className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-semibold text-slate-900">
                        {order.order_number}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[order.status] || 'bg-slate-100 text-slate-700'}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                      {order.is_archived && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                          📂 Архів
                        </span>
                      )}
                      <span className="text-sm text-slate-600">
                        {new Date(order.created_at).toLocaleDateString('uk-UA')}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-slate-500">Клієнт</div>
                        <div className="font-medium text-slate-900">{order.client_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-500">Сума</div>
                        <div className="font-semibold text-slate-900">₴{(order.total_rental || 0).toFixed(0)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-500">Дати</div>
                        <div className="text-sm text-slate-900">
                          {order.issue_date || order.rental_start_date} → {order.return_date || order.rental_end_date}
                        </div>
                      </div>
                      <span className="text-slate-400">
                        {expandedOrder === (order.order_id || parseInt(order.id)) ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {expandedOrder === (order.order_id || parseInt(order.id)) && (
                  <div className="border-t border-slate-200 bg-slate-50 p-4">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Left: Order Info */}
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-3">Інформація про замовлення</h3>
                        <div className="space-y-2 text-sm">
                          <div className="grid grid-cols-2">
                            <span className="text-slate-600">Телефон:</span>
                            <span className="font-medium">{order.client_phone}</span>
                          </div>
                          <div className="grid grid-cols-2">
                            <span className="text-slate-600">Email:</span>
                            <span className="font-medium">{order.client_email || '—'}</span>
                          </div>
                          <div className="grid grid-cols-2">
                            <span className="text-slate-600">Застава:</span>
                            <span className="font-medium">₴{(order.total_deposit || 0).toFixed(0)}</span>
                          </div>
                          <div className="grid grid-cols-2">
                            <span className="text-slate-600">Знижка:</span>
                            <span className="font-medium">{order.discount || 0}%</span>
                          </div>
                        </div>
                        
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/order/${order.id}/view`);
                            }}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Відкрити замовлення
                          </button>
                          
                          {order.is_archived ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnarchive(order.order_id || parseInt(order.id), order.order_number);
                              }}
                              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
                            >
                              ↩️ Розархівувати
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchive(order.order_id || parseInt(order.id), order.order_number);
                              }}
                              className="px-3 py-1.5 text-sm bg-slate-600 text-white rounded hover:bg-slate-700"
                            >
                              📂 Архівувати
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Right: Lifecycle History */}
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-3">🕐 Історія операцій</h3>
                        {lifecycle[order.order_id || parseInt(order.id)] ? (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {lifecycle[order.order_id || parseInt(order.id)].map((event, idx) => (
                              <div key={idx} className="flex gap-3 text-sm">
                                <div className="text-slate-500 min-w-[100px]">
                                  {new Date(event.created_at).toLocaleString('uk-UA', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                                <div className="flex-1">
                                  <span className="font-medium text-slate-900">{event.stage}</span>
                                  {event.notes && (
                                    <div className="text-slate-600 mt-0.5">{event.notes}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500">Завантаження історії...</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
