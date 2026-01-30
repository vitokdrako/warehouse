/* eslint-disable */
/**
 * Orders Archive - Архів замовлень з повною історією
 * Корпоративний дизайн + таймлайн всіх операцій
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CorporateHeader from '../components/CorporateHeader';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helpers
const cn = (...xs) => xs.filter(Boolean).join(' ');
const money = (v) => v ? `₴${Number(v).toLocaleString('uk-UA')}` : '₴0';
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// UI Components
const Badge = ({ kind, children }) => (
  <span className={cn(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
    kind === "ok" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
    kind === "pending" && "bg-amber-50 text-amber-700 border border-amber-200",
    kind === "warn" && "bg-rose-50 text-rose-700 border border-rose-200",
    kind === "info" && "bg-blue-50 text-blue-700 border border-blue-200",
    kind === "neutral" && "bg-slate-100 text-slate-700 border border-slate-200"
  )}>
    {children}
  </span>
);

const Card = ({ title, children, className }) => (
  <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
    {title && (
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
      </div>
    )}
    <div className="p-4">{children}</div>
  </div>
);

const Input = (props) => (
  <input
    {...props}
    className={cn(
      "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200",
      props.className
    )}
  />
);

const Select = ({ value, onChange, options, className }) => (
  <select
    className={cn("h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200", className)}
    value={value}
    onChange={(e) => onChange(e.target.value)}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

const Button = ({ children, variant = "primary", ...props }) => (
  <button
    {...props}
    className={cn(
      "h-10 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50",
      variant === "primary" && "bg-slate-900 text-white hover:bg-slate-800",
      variant === "ghost" && "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
      props.className
    )}
  >
    {children}
  </button>
);

// Timeline Component
const Timeline = ({ items }) => {
  const typeIcons = {
    order: '🛒',
    issue: '📦',
    return: '📥',
    payment: '💰',
    deposit: '🔒',
    damage: '🔴',
    document: '📄',
    lifecycle: '📌'
  };
  
  const typeColors = {
    order: 'bg-blue-500',
    issue: 'bg-emerald-500',
    return: 'bg-purple-500',
    payment: 'bg-green-500',
    deposit: 'bg-amber-500',
    damage: 'bg-rose-500',
    document: 'bg-slate-500',
    lifecycle: 'bg-indigo-500'
  };
  
  return (
    <div className="relative">
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200"></div>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className="relative flex gap-4 pl-8">
            <div className={cn(
              "absolute left-1.5 w-3 h-3 rounded-full border-2 border-white shadow",
              typeColors[item.type] || 'bg-slate-400'
            )}></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm">{typeIcons[item.type] || '•'}</span>
                <span className="text-sm font-medium text-slate-900">{item.title}</span>
                <span className="text-xs text-slate-500">{fmtDate(item.timestamp)}</span>
              </div>
              {item.details && (
                <div className="text-xs text-slate-600 mt-0.5">{item.details}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function OrdersArchive() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderHistory, setOrderHistory] = useState({});
  const [historyLoading, setHistoryLoading] = useState({});
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [archiveFilter, setArchiveFilter] = useState('archived');
  const [sortBy, setSortBy] = useState('date_desc');
  
  const statusLabels = {
    awaiting_customer: 'Очікує',
    processing: 'В обробці',
    ready_for_issue: 'Готово',
    issued: 'Видано',
    on_rent: 'В оренді',
    returned: 'Повернуто',
    completed: 'Завершено',
    cancelled: 'Скасовано',
    declined: 'Відхилено'
  };
  
  const statusKinds = {
    awaiting_customer: 'pending',
    processing: 'info',
    ready_for_issue: 'ok',
    issued: 'ok',
    on_rent: 'ok',
    returned: 'neutral',
    completed: 'neutral',
    cancelled: 'warn',
    declined: 'warn'
  };
  
  // Fetch orders
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const archiveParam = archiveFilter === 'archived' ? 'true' : archiveFilter === 'active' ? 'false' : 'all';
      const res = await fetch(`${BACKEND_URL}/api/decor-orders?status=all&archived=${archiveParam}&limit=500`);
      const data = await res.json();
      setOrders(data.orders || data || []);
    } catch (e) {
      console.error('Fetch orders error:', e);
    }
    setLoading(false);
  }, [archiveFilter]);
  
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);
  
  // Fetch full history for order
  const fetchHistory = async (orderId) => {
    if (orderHistory[orderId]) return;
    
    setHistoryLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      const res = await fetch(`${BACKEND_URL}/api/archive/${orderId}/full-history`);
      const data = await res.json();
      setOrderHistory(prev => ({ ...prev, [orderId]: data }));
    } catch (e) {
      console.error('Fetch history error:', e);
    }
    setHistoryLoading(prev => ({ ...prev, [orderId]: false }));
  };
  
  // Toggle expanded order
  const toggleExpand = (order) => {
    const orderId = order.order_id || order.id;
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
      fetchHistory(orderId);
    }
  };
  
  // Archive/Unarchive
  const handleArchive = async (orderId, orderNumber) => {
    if (!window.confirm(`Архівувати замовлення ${orderNumber}?`)) return;
    try {
      await fetch(`${BACKEND_URL}/api/decor-orders/${orderId}/archive`, { method: 'POST' });
      fetchOrders();
    } catch (e) {
      alert('Помилка: ' + e.message);
    }
  };
  
  const handleUnarchive = async (orderId, orderNumber) => {
    if (!window.confirm(`Розархівувати замовлення ${orderNumber}?`)) return;
    try {
      await fetch(`${BACKEND_URL}/api/decor-orders/${orderId}/unarchive`, { method: 'POST' });
      fetchOrders();
    } catch (e) {
      alert('Помилка: ' + e.message);
    }
  };
  
  // Filter & Sort
  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(q) ||
      order.client_name?.toLowerCase().includes(q) ||
      order.customer_name?.toLowerCase().includes(q) ||
      order.client_phone?.includes(q) ||
      order.customer_phone?.includes(q)
    );
  });
  
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    switch (sortBy) {
      case 'date_asc': return new Date(a.created_at) - new Date(b.created_at);
      case 'amount_desc': return (b.total_rental || b.total_price || 0) - (a.total_rental || a.total_price || 0);
      case 'amount_asc': return (a.total_rental || a.total_price || 0) - (b.total_rental || b.total_price || 0);
      default: return new Date(b.created_at) - new Date(a.created_at);
    }
  });
  
  const totalAmount = sortedOrders.reduce((sum, o) => sum + (o.total_rental || o.total_price || 0), 0);
  
  return (
    <div className="min-h-screen bg-slate-50">
      <CorporateHeader />
      
      {/* Sub Header */}
      <div className="sticky top-[60px] z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/manager')} className="text-slate-500 hover:text-slate-700">
                ← Назад
              </button>
              <h1 className="text-lg font-bold">📂 Архів замовлень</h1>
              <span className="text-sm text-slate-500">{sortedOrders.length} з {orders.length}</span>
            </div>
            <Button variant="ghost" onClick={fetchOrders}>🔄</Button>
          </div>
          
          {/* Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Select
              value={archiveFilter}
              onChange={setArchiveFilter}
              options={[
                { value: 'archived', label: '📂 Архівні' },
                { value: 'active', label: '📋 Активні' },
                { value: 'all', label: '📊 Всі' }
              ]}
              className="border-2 border-blue-200 bg-blue-50"
            />
            <Input
              placeholder="Пошук..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Select
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'date_desc', label: 'Дата ↓' },
                { value: 'date_asc', label: 'Дата ↑' },
                { value: 'amount_desc', label: 'Сума ↓' },
                { value: 'amount_asc', label: 'Сума ↑' }
              ]}
            />
            <div className="flex items-center text-sm text-slate-600">
              📊 Всього: {money(totalAmount)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Orders List */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Завантаження...</div>
        ) : sortedOrders.length === 0 ? (
          <div className="text-center py-12 text-slate-500">Немає замовлень</div>
        ) : (
          <div className="space-y-3">
            {sortedOrders.map(order => {
              const orderId = order.order_id || order.id;
              const isExpanded = expandedOrder === orderId;
              const history = orderHistory[orderId];
              const isLoadingHistory = historyLoading[orderId];
              
              return (
                <Card key={orderId} className="overflow-hidden">
                  {/* Order Header */}
                  <div 
                    onClick={() => toggleExpand(order)}
                    className="flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition -m-4 p-4"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-slate-900">{order.order_number}</span>
                      <Badge kind={statusKinds[order.status] || 'neutral'}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                      {order.is_archived && <Badge kind="neutral">📂 Архів</Badge>}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold text-slate-900">{money(order.total_rental || order.total_price)}</div>
                        <div className="text-xs text-slate-500">{order.client_name || order.customer_name}</div>
                      </div>
                      <span className="text-slate-400">{isExpanded ? '▼' : '▶'}</span>
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 mt-4 pt-4">
                      {isLoadingHistory ? (
                        <div className="text-center py-8 text-slate-500">Завантаження історії...</div>
                      ) : history ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Order Info */}
                          <div className="space-y-4">
                            <div className="rounded-xl bg-slate-50 p-4">
                              <div className="text-xs font-semibold text-slate-500 mb-3">ІНФОРМАЦІЯ</div>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Клієнт:</span>
                                  <span className="font-medium">{history.order.customer_name}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Телефон:</span>
                                  <span>{history.order.customer_phone}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Період:</span>
                                  <span>{history.order.rental_start_date?.slice(0,10)} — {history.order.rental_end_date?.slice(0,10)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Сума оренди:</span>
                                  <span className="font-semibold">{money(history.order.total_price)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Застава:</span>
                                  <span className="font-semibold">{money(history.order.deposit_amount)}</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Summary */}
                            <div className="rounded-xl bg-slate-50 p-4">
                              <div className="text-xs font-semibold text-slate-500 mb-3">ПІДСУМОК</div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                                  <div className="text-lg font-bold text-emerald-600">{history.payments?.length || 0}</div>
                                  <div className="text-xs text-slate-500">Платежів</div>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                                  <div className="text-lg font-bold text-blue-600">{history.documents?.length || 0}</div>
                                  <div className="text-xs text-slate-500">Документів</div>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                                  <div className="text-lg font-bold text-amber-600">{history.deposits?.length || 0}</div>
                                  <div className="text-xs text-slate-500">Застав</div>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                                  <div className="text-lg font-bold text-rose-600">{history.damages?.length || 0}</div>
                                  <div className="text-xs text-slate-500">Шкод</div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex gap-2">
                              {order.is_archived ? (
                                <Button variant="ghost" className="flex-1" onClick={() => handleUnarchive(orderId, order.order_number)}>
                                  📤 Розархівувати
                                </Button>
                              ) : (
                                <Button variant="ghost" className="flex-1" onClick={() => handleArchive(orderId, order.order_number)}>
                                  📂 Архівувати
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {/* Timeline */}
                          <div className="rounded-xl bg-slate-50 p-4 max-h-[500px] overflow-y-auto">
                            <div className="text-xs font-semibold text-slate-500 mb-4">ПОВНА ІСТОРІЯ ({history.timeline?.length || 0} подій)</div>
                            {history.timeline && history.timeline.length > 0 ? (
                              <Timeline items={history.timeline} />
                            ) : (
                              <div className="text-center text-slate-500 py-4">Немає подій</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-500">Не вдалося завантажити історію</div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
