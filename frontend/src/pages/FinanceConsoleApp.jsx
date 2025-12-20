/* eslint-disable */
/**
 * FinanceConsoleApp - Уніфікована фінансова консоль RentalHub
 * Об'єднує: Ордери, Облік (Ledger), Витрати, ЗП, Підрядники
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CorporateHeader from '../components/CorporateHeader';
import { financeApi } from '../services/financeApi.js';
import OrderFinancePanel from '../components/finance/OrderFinancePanel.jsx';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// ============================================================
// AUTH FETCH HELPER
// ============================================================
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

// ============================================================
// DESIGN SYSTEM
// ============================================================
const cls = (...a) => a.filter(Boolean).join(' ');
const money = (v, cur = '₴') => `${cur} ${(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })}`;

const tone = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
};

const Pill = ({ t = 'neutral', children, className, onClick }) => (
  <span
    onClick={onClick}
    className={cls(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
      tone[t],
      onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
      className
    )}
  >
    {children}
  </span>
);

const Btn = ({ variant = 'outline', className, children, ...props }) => {
  const base = 'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all disabled:opacity-50';
  const variants = {
    primary: 'bg-corp-primary text-white hover:bg-corp-primary-dark shadow-sm',
    dark: 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    outline: 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700',
  };
  return <button className={cls(base, variants[variant] || variants.outline, className)} {...props}>{children}</button>;
};

const Card = ({ className, children }) => (
  <div className={cls('rounded-2xl border border-slate-200 bg-white shadow-sm', className)}>{children}</div>
);

const CardHd = ({ title, subtitle, right, icon }) => (
  <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
    <div className="flex items-center gap-3 min-w-0">
      {icon && <span className="text-xl">{icon}</span>}
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
  </div>
);

const CardBd = ({ className, children }) => <div className={cls('p-5', className)}>{children}</div>;

const StatCard = ({ title, value, sub, icon, toneKey = 'neutral' }) => (
  <Card className="overflow-hidden">
    <CardBd className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        {icon && <span className="text-2xl opacity-50">{icon}</span>}
      </div>
    </CardBd>
  </Card>
);

// ============================================================
// TAB BAR
// ============================================================
function TabBar({ tab, setTab }) {
  const tabs = [
    { id: 'overview', label: 'Огляд', icon: '📊' },
    { id: 'orders', label: 'Ордери', icon: '📋' },
    { id: 'ledger', label: 'Облік', icon: '📒' },
    { id: 'expenses', label: 'Витрати', icon: '💸' },
    { id: 'payroll', label: 'Зарплати', icon: '👥' },
    { id: 'vendors', label: 'Підрядники', icon: '🏢' },
  ];

  return (
    <div className="bg-white border-b border-slate-200 sticky top-[73px] z-20">
      <div className="mx-auto max-w-7xl px-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto py-2" aria-label="Tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cls(
                'whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-lg transition-all',
                tab === t.id
                  ? 'bg-corp-primary text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <span className="mr-1.5">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

// ============================================================
// ORDER ROW
// ============================================================
function OrderRow({ order, deposit, payments = [], isOpen, onToggle }) {
  const rentAccrued = order.total_rental || order.total_price || 0;
  const rentPayments = payments.filter(p => p.payment_type === 'rent');
  const rentPaidFromPayments = rentPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const rentPaid = rentPaidFromPayments > 0 ? rentPaidFromPayments : (order.rent_paid || 0);
  const rentDue = Math.max(0, rentAccrued - rentPaid);
  
  const depositExpected = order.total_deposit || order.deposit_amount || 0;
  const hasDeposit = deposit !== null && deposit !== undefined;
  const depositHeld = hasDeposit ? (deposit.held_amount || 0) : 0;
  const depositRefunded = hasDeposit ? (deposit.refunded_amount || 0) : 0;
  const depositUsed = hasDeposit ? (deposit.used_amount || 0) : 0;
  
  const badges = [];
  
  if (rentDue > 0) {
    badges.push(<Pill key="rent-due" t="warn">Борг {money(rentDue)}</Pill>);
  } else if (rentPaid > 0) {
    badges.push(<Pill key="rent-paid" t="ok">✓ Сплачено</Pill>);
  }
  
  if (hasDeposit && depositHeld > 0) {
    if (depositRefunded > 0 && depositRefunded >= depositHeld) {
      badges.push(<Pill key="dep-returned" t="neutral">✓ Повернуто</Pill>);
    } else if (depositUsed > 0) {
      badges.push(<Pill key="dep-used" t="info">Використано {money(depositUsed)}</Pill>);
    } else {
      const dispAmount = deposit?.display_amount || money(depositHeld);
      badges.push(<Pill key="dep-held" t="ok">Застава {dispAmount}</Pill>);
    }
  } else if (depositExpected > 0) {
    badges.push(<Pill key="dep-due" t="info">Очік. {money(depositExpected)}</Pill>);
  }
  
  const statusMap = {
    'awaiting_customer': { label: 'Очікує', t: 'warn' },
    'processing': { label: 'Обробка', t: 'info' },
    'ready_for_issue': { label: 'Готово', t: 'ok' },
    'issued': { label: 'Видано', t: 'info' },
    'on_rent': { label: 'В оренді', t: 'info' },
    'returned': { label: 'Повернуто', t: 'ok' },
    'closed': { label: 'Закрито', t: 'neutral' },
    'cancelled': { label: 'Скасовано', t: 'danger' },
  };
  const st = statusMap[order.status] || { label: order.status, t: 'neutral' };

  return (
    <button 
      className={cls(
        'w-full text-left rounded-xl border bg-white p-4 transition-all hover:shadow-md', 
        isOpen ? 'ring-2 ring-corp-primary/30 border-corp-primary/30' : 'border-slate-200 hover:border-slate-300'
      )} 
      onClick={onToggle}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">#{order.order_number || order.order_id}</span>
            <Pill t={st.t}>{st.label}</Pill>
          </div>
          <p className="text-sm text-slate-600 truncate mt-1">{order.client_name || order.customer_name}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Оренда: {money(rentPaid)} / {money(rentAccrued)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {badges}
          <span className={cls(
            'h-7 w-7 flex items-center justify-center rounded-lg border transition-transform',
            isOpen ? 'rotate-90 bg-corp-primary/10 border-corp-primary/20 text-corp-primary' : 'border-slate-200 text-slate-400'
          )}>▸</span>
        </div>
      </div>
    </button>
  );
}

// ============================================================
// TRANSFORM ORDER DATA
// ============================================================
function transformOrderForPanel(order, payments = [], deposit = null) {
  const rentPayments = payments.filter(p => p.payment_type === 'rent');
  const damagePayments = payments.filter(p => p.payment_type === 'damage');
  
  const rentPaid = rentPayments.reduce((s, p) => s + p.amount, 0);
  const damagePaid = damagePayments.reduce((s, p) => s + p.amount, 0);
  
  const hasDeposit = deposit !== null && deposit !== undefined;
  const depositHeld = hasDeposit ? (deposit.held_amount || 0) : 0;
  const depositActual = hasDeposit ? (deposit.actual_amount || depositHeld) : 0;
  const depositCurrency = hasDeposit ? (deposit.currency || 'UAH') : 'UAH';
  
  return {
    id: order.order_id || order.id,
    order_number: order.order_number,
    client: order.client_name || order.customer_name,
    status: order.status,
    rent: {
      accrued: order.total_rental || order.total_price || 0,
      paid: rentPaid,
      due: Math.max(0, (order.total_rental || order.total_price || 0) - rentPaid),
    },
    deposit: {
      expected: order.total_deposit || order.deposit_amount || 0,
      held: depositHeld,
      actual_amount: depositActual,
      currency: depositCurrency,
      display: hasDeposit ? (deposit.display_amount || (depositCurrency === 'UAH' ? `₴${depositActual}` : `${depositActual} ${depositCurrency}`)) : '—',
      used_for_damage: hasDeposit ? (deposit.used_amount || 0) : 0,
      refunded: hasDeposit ? (deposit.refunded_amount || 0) : 0,
    },
    damage: {
      assessed: 0,
      paid: damagePaid,
      due: 0,
    },
    timeline: payments.map(p => ({
      at: p.occurred_at?.slice(0, 16).replace('T', ' '),
      type: p.payment_type,
      label: p.note || p.payment_type,
      debit: p.amount,
      credit: p.amount,
      accepted_by: p.accepted_by_name || null,
    })),
  };
}

// ============================================================
// OVERVIEW TAB
// ============================================================
function OverviewTab({ dashboard, isMock, depositsCount, loading }) {
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-slate-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }
  
  const { metrics = {}, deposits = {} } = dashboard || {};
  
  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
      {isMock && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <span>⚠️</span>
          <span>Offline режим — показані тестові дані</span>
        </div>
      )}
      
      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title="Чистий прибуток" 
          value={money(metrics.net_profit)} 
          sub="Оренда + Шкода − Витрати" 
          icon="💰"
        />
        <StatCard 
          title="Дохід з оренди" 
          value={money(metrics.rent_revenue)} 
          sub="За обраний період" 
          icon="🏠"
        />
        <StatCard 
          title="Компенсації" 
          value={money(metrics.damage_compensation)} 
          sub="За пошкодження" 
          icon="🔧"
        />
      </div>
      
      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="Застави" 
          value={money(deposits.held)} 
          sub={`${depositsCount} активних`}
          icon="🔒"
        />
        <StatCard 
          title="Витрати" 
          value={money(metrics.operating_expenses)} 
          sub="Операційні"
          icon="📉"
        />
        <StatCard 
          title="Каса + Банк" 
          value={money(metrics.cash_balance)} 
          sub="Готівка"
          icon="💵"
        />
        <StatCard 
          title="До повернення" 
          value={money(deposits.available_to_refund)} 
          sub="Клієнтам"
          icon="↩️"
        />
      </div>
    </div>
  );
}

// ============================================================
// ORDERS TAB
// ============================================================
function OrdersTab({ orders, deposits, expandedId, setExpandedId, onUpdate, filter, setFilter, loading }) {
  const [orderPayments, setOrderPayments] = useState({});
  const [allPaymentsLoaded, setAllPaymentsLoaded] = useState(false);
  
  useEffect(() => {
    if (orders.length > 0 && !allPaymentsLoaded) {
      financeApi.getPayments({ limit: 500 }).then(r => {
        const payments = r.data?.payments || [];
        const grouped = {};
        payments.forEach(p => {
          if (p.order_id) {
            if (!grouped[p.order_id]) grouped[p.order_id] = [];
            grouped[p.order_id].push(p);
          }
        });
        setOrderPayments(grouped);
        setAllPaymentsLoaded(true);
      });
    }
  }, [orders, allPaymentsLoaded]);
  
  useEffect(() => {
    if (expandedId) {
      financeApi.getPayments({ order_id: expandedId }).then(r => {
        setOrderPayments(prev => ({ ...prev, [expandedId]: r.data?.payments || [] }));
      });
    }
  }, [expandedId]);
  
  const filtered = useMemo(() => {
    if (!filter) return orders;
    return orders.filter((o) => {
      const rentDue = (o.total_rental || 0) - (o.rent_paid || 0);
      const depositDue = (o.total_deposit || 0) - (o.deposit_held || 0);
      if (filter === 'rent') return rentDue > 0;
      if (filter === 'deposit') return depositDue > 0 || (o.deposit_held || 0) > 0;
      return true;
    });
  }, [orders, filter]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <Card>
        <CardHd 
          title="Замовлення" 
          subtitle={loading ? 'Завантаження...' : `${filtered.length} записів`}
          icon="📋"
          right={
            <div className="flex gap-2">
              <Pill 
                t={filter === 'rent' ? 'warn' : 'neutral'} 
                onClick={() => setFilter(filter === 'rent' ? null : 'rent')}
              >
                💳 Борг оренда
              </Pill>
              <Pill 
                t={filter === 'deposit' ? 'info' : 'neutral'} 
                onClick={() => setFilter(filter === 'deposit' ? null : 'deposit')}
              >
                🔒 Із заставою
              </Pill>
            </div>
          }
        />
        <CardBd className="p-4">
          {loading ? (
            <div className="p-8 text-center text-slate-500">
              <div className="animate-spin w-8 h-8 border-2 border-corp-primary border-t-transparent rounded-full mx-auto mb-3"></div>
              Завантаження замовлень...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <span className="text-4xl mb-2 block">📭</span>
              Немає замовлень
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((o) => {
                const deposit = deposits.find(d => d.order_id === (o.order_id || o.id));
                const payments = orderPayments[o.order_id || o.id] || [];
                const panelOrder = transformOrderForPanel(o, payments, deposit);
                
                return (
                  <div key={o.order_id || o.id}>
                    <OrderRow 
                      order={o}
                      deposit={deposit}
                      payments={payments}
                      isOpen={expandedId === (o.order_id || o.id)} 
                      onToggle={() => setExpandedId(expandedId === (o.order_id || o.id) ? null : (o.order_id || o.id))} 
                    />
                    {expandedId === (o.order_id || o.id) && (
                      <div className="mt-2 ml-4 border-l-2 border-corp-primary/20 pl-4">
                        <OrderFinancePanel order={panelOrder} onUpdate={onUpdate} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBd>
      </Card>
    </div>
  );
}

// ============================================================
// LEDGER TAB
// ============================================================
function LedgerTab({ ledger, loading, onExport }) {
  const [txTypeFilter, setTxTypeFilter] = useState(null);
  
  const filtered = useMemo(() => {
    if (!txTypeFilter) return ledger;
    return ledger.filter(tx => tx.tx_type?.includes(txTypeFilter));
  }, [ledger, txTypeFilter]);

  const txTypes = useMemo(() => {
    const types = new Set(ledger.map(tx => tx.tx_type));
    return Array.from(types);
  }, [ledger]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <Card>
        <CardHd 
          title="Журнал операцій" 
          subtitle="Подвійний запис"
          icon="📒"
          right={
            <div className="flex gap-2">
              <select 
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white"
                value={txTypeFilter || ''}
                onChange={(e) => setTxTypeFilter(e.target.value || null)}
              >
                <option value="">Всі типи</option>
                {txTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <Btn onClick={onExport}>📥 Експорт</Btn>
            </div>
          }
        />
        <CardBd className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Завантаження...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Дата</th>
                    <th className="px-4 py-3 text-left font-medium">Тип</th>
                    <th className="px-4 py-3 text-right font-medium">Сума</th>
                    <th className="px-4 py-3 text-left font-medium">Проводки</th>
                    <th className="px-4 py-3 text-left font-medium">Примітка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-slate-600">{tx.occurred_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td className="px-4 py-3">
                        <Pill t={tx.tx_type?.includes('damage') ? 'warn' : tx.tx_type?.includes('rent') ? 'ok' : 'info'}>
                          {tx.tx_type}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{money(tx.amount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {tx.entries?.map((e, i) => (
                            <span key={i} className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                              {e.direction}:{e.account_code}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">{tx.note || '—'}</td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        Немає записів
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardBd>
      </Card>
    </div>
  );
}

// ============================================================
// EXPENSES TAB
// ============================================================
function ExpensesTab({ expenses, categories, loading, onAdd, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ category_code: 'CONSUMABLES', amount: '', method: 'cash', note: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount) return;
    await financeApi.createExpense({ expense_type: 'expense', ...form, amount: Number(form.amount) });
    setShowModal(false);
    setForm({ category_code: 'CONSUMABLES', amount: '', method: 'cash', note: '' });
    onRefresh?.();
  };

  const byCategory = useMemo(() => {
    const g = {};
    expenses.forEach((e) => { 
      const c = e.category_name || 'Інше'; 
      if (!g[c]) g[c] = 0; 
      g[c] += e.amount; 
    });
    return g;
  }, [expenses]);

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Загалом витрат" value={money(totalExpenses)} icon="💸" />
        {Object.entries(byCategory).slice(0, 3).map(([c, v]) => (
          <StatCard key={c} title={c} value={money(v)} icon="📊" />
        ))}
      </div>

      {/* Expenses Table */}
      <Card>
        <CardHd 
          title="Витрати" 
          subtitle="Операційні витрати та закупки"
          icon="💸"
          right={<Btn variant="dark" onClick={() => setShowModal(true)}>+ Додати витрату</Btn>}
        />
        <CardBd className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Завантаження...</div>
          ) : expenses.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Дата</th>
                    <th className="px-4 py-3 text-left font-medium">Категорія</th>
                    <th className="px-4 py-3 text-right font-medium">Сума</th>
                    <th className="px-4 py-3 text-left font-medium">Спосіб</th>
                    <th className="px-4 py-3 text-left font-medium">Примітка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-slate-600">{e.occurred_at?.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <Pill t="neutral">{e.category_name || e.category_code}</Pill>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600">{money(e.amount)}</td>
                      <td className="px-4 py-3 text-slate-500 capitalize">{e.method || 'cash'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">{e.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              <span className="text-4xl mb-2 block">📭</span>
              Немає витрат
            </div>
          )}
        </CardBd>
      </Card>

      {/* Add Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h3 className="font-semibold text-lg">Додати витрату</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Категорія</label>
                <select 
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5" 
                  value={form.category_code} 
                  onChange={(e) => setForm({ ...form, category_code: e.target.value })}
                >
                  {categories.filter(c => c.type === 'expense').map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Сума (₴)</label>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5" 
                  value={form.amount} 
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Спосіб оплати</label>
                <select 
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                >
                  <option value="cash">Готівка</option>
                  <option value="card">Картка</option>
                  <option value="iban">IBAN</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Примітка</label>
                <input 
                  placeholder="Опис витрати..." 
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5" 
                  value={form.note} 
                  onChange={(e) => setForm({ ...form, note: e.target.value })} 
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Btn type="button" onClick={() => setShowModal(false)} className="flex-1">Скасувати</Btn>
                <Btn type="submit" variant="primary" className="flex-1">💾 Зберегти</Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PAYROLL TAB
// ============================================================
function PayrollTab({ employees, payroll, loading, onRefresh }) {
  const [showAddPayroll, setShowAddPayroll] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [form, setForm] = useState({ employee_id: '', period_start: '', period_end: '', base_amount: '', bonus: '0', deduction: '0', method: 'cash', note: '' });
  const [empForm, setEmpForm] = useState({ name: '', role: 'manager', phone: '', base_salary: '' });

  const handleSubmitPayroll = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.base_amount) return;
    await financeApi.createPayroll({ ...form, base_amount: Number(form.base_amount), bonus: Number(form.bonus), deduction: Number(form.deduction) });
    setShowAddPayroll(false);
    setForm({ employee_id: '', period_start: '', period_end: '', base_amount: '', bonus: '0', deduction: '0', method: 'cash', note: '' });
    onRefresh?.();
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!empForm.name) return;
    await financeApi.createEmployee({ ...empForm, base_salary: Number(empForm.base_salary || 0) });
    setShowAddEmployee(false);
    setEmpForm({ name: '', role: 'manager', phone: '', base_salary: '' });
    onRefresh?.();
  };

  const handlePay = async (id) => {
    if (confirm('Підтвердити виплату зарплати?')) {
      await financeApi.payPayroll(id);
      onRefresh?.();
    }
  };

  const roleLabels = { manager: 'Менеджер', courier: "Кур'єр", cleaner: 'Прибиральник', assistant: 'Помічник', other: 'Інше' };
  const statusLabels = { pending: 'Очікує', approved: 'Затверджено', paid: 'Виплачено' };
  const statusTone = { pending: 'warn', approved: 'info', paid: 'ok' };

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
      {/* Employees Card */}
      <Card>
        <CardHd 
          title="Співробітники" 
          subtitle={`${employees.length} осіб`}
          icon="👥"
          right={<Btn variant="dark" onClick={() => setShowAddEmployee(true)}>+ Додати</Btn>}
        />
        <CardBd>
          {loading ? (
            <div className="p-4 text-center text-slate-500">Завантаження...</div>
          ) : employees.length ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {employees.map(e => (
                <div key={e.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="font-semibold text-slate-900">{e.name}</div>
                  <Pill t="info" className="mt-1">{roleLabels[e.role] || e.role}</Pill>
                  <div className="text-sm text-slate-600 mt-2">Ставка: {money(e.base_salary)}</div>
                  {e.phone && <div className="text-xs text-slate-400 mt-1">📞 {e.phone}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-slate-400">Немає співробітників</div>
          )}
        </CardBd>
      </Card>

      {/* Payroll Card */}
      <Card>
        <CardHd 
          title="Нарахування зарплат" 
          subtitle="Історія виплат"
          icon="💰"
          right={<Btn variant="dark" onClick={() => setShowAddPayroll(true)}>+ Нарахувати</Btn>}
        />
        <CardBd className="p-0">
          {loading ? (
            <div className="p-4 text-center text-slate-500">Завантаження...</div>
          ) : payroll.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Співробітник</th>
                    <th className="px-4 py-3 text-left font-medium">Період</th>
                    <th className="px-4 py-3 text-right font-medium">Сума</th>
                    <th className="px-4 py-3 text-left font-medium">Статус</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payroll.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium">{p.employee_name || `ID: ${p.employee_id}`}</td>
                      <td className="px-4 py-3 text-slate-600">{p.period_start?.slice(0, 10)} — {p.period_end?.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{money(p.total_amount)}</td>
                      <td className="px-4 py-3"><Pill t={statusTone[p.status]}>{statusLabels[p.status]}</Pill></td>
                      <td className="px-4 py-3">
                        {p.status !== 'paid' && <Btn onClick={() => handlePay(p.id)}>💳 Виплатити</Btn>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center text-slate-400">Немає нарахувань</div>
          )}
        </CardBd>
      </Card>

      {/* Add Payroll Modal */}
      {showAddPayroll && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddPayroll(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h3 className="font-semibold text-lg">Нарахувати зарплату</h3>
              <button onClick={() => setShowAddPayroll(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSubmitPayroll} className="p-6 space-y-4">
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={form.employee_id} onChange={e => setForm({...form, employee_id: e.target.value})} required>
                <option value="">Оберіть співробітника</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" className="rounded-xl border border-slate-300 px-3 py-2.5" value={form.period_start} onChange={e => setForm({...form, period_start: e.target.value})} required />
                <input type="date" className="rounded-xl border border-slate-300 px-3 py-2.5" value={form.period_end} onChange={e => setForm({...form, period_end: e.target.value})} required />
              </div>
              <input type="number" placeholder="Базова сума" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={form.base_amount} onChange={e => setForm({...form, base_amount: e.target.value})} required />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Бонус" className="rounded-xl border border-slate-300 px-3 py-2.5" value={form.bonus} onChange={e => setForm({...form, bonus: e.target.value})} />
                <input type="number" placeholder="Утримання" className="rounded-xl border border-slate-300 px-3 py-2.5" value={form.deduction} onChange={e => setForm({...form, deduction: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <Btn type="button" onClick={() => setShowAddPayroll(false)} className="flex-1">Скасувати</Btn>
                <Btn type="submit" variant="primary" className="flex-1">💾 Зберегти</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddEmployee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddEmployee(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h3 className="font-semibold text-lg">Додати співробітника</h3>
              <button onClick={() => setShowAddEmployee(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
              <input placeholder="Ім'я" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={empForm.name} onChange={e => setEmpForm({...empForm, name: e.target.value})} required />
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={empForm.role} onChange={e => setEmpForm({...empForm, role: e.target.value})}>
                <option value="manager">Менеджер</option>
                <option value="courier">Кур'єр</option>
                <option value="cleaner">Прибиральник</option>
                <option value="assistant">Помічник</option>
                <option value="other">Інше</option>
              </select>
              <input placeholder="Телефон" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={empForm.phone} onChange={e => setEmpForm({...empForm, phone: e.target.value})} />
              <input type="number" placeholder="Базова ставка" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={empForm.base_salary} onChange={e => setEmpForm({...empForm, base_salary: e.target.value})} />
              <div className="flex gap-3 pt-2">
                <Btn type="button" onClick={() => setShowAddEmployee(false)} className="flex-1">Скасувати</Btn>
                <Btn type="submit" variant="primary" className="flex-1">💾 Зберегти</Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// VENDORS TAB
// ============================================================
function VendorsTab({ vendors, loading, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', vendor_type: 'service', contact_name: '', phone: '', email: '', address: '', iban: '', note: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    await financeApi.createVendor(form);
    setShowAdd(false);
    setForm({ name: '', vendor_type: 'service', contact_name: '', phone: '', email: '', address: '', iban: '', note: '' });
    onRefresh?.();
  };

  const typeLabels = { service: '🔧 Сервіс', cleaning: '🧹 Хімчистка', repair: '🛠 Ремонт', delivery: '🚚 Доставка', other: '📦 Інше' };

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <Card>
        <CardHd 
          title="Підрядники" 
          subtitle={`${vendors.length} компаній`}
          icon="🏢"
          right={<Btn variant="dark" onClick={() => setShowAdd(true)}>+ Додати</Btn>}
        />
        <CardBd>
          {loading ? (
            <div className="p-4 text-center text-slate-500">Завантаження...</div>
          ) : vendors.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vendors.map(v => (
                <div key={v.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{v.name}</div>
                      <Pill t="info" className="mt-1">{typeLabels[v.vendor_type] || v.vendor_type}</Pill>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Баланс</div>
                      <div className={cls('font-semibold', v.balance > 0 ? 'text-rose-600' : 'text-slate-800')}>
                        {money(v.balance)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    {v.contact_name && <div>👤 {v.contact_name}</div>}
                    {v.phone && <div>📞 {v.phone}</div>}
                    {v.email && <div>✉️ {v.email}</div>}
                    {v.iban && <div className="text-xs font-mono text-slate-400">IBAN: {v.iban}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-slate-400">Немає підрядників</div>
          )}
        </CardBd>
      </Card>

      {/* Add Vendor Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h3 className="font-semibold text-lg">Додати підрядника</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <input placeholder="Назва компанії" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={form.vendor_type} onChange={e => setForm({...form, vendor_type: e.target.value})}>
                <option value="service">🔧 Сервіс</option>
                <option value="cleaning">🧹 Хімчистка</option>
                <option value="repair">🛠 Ремонт</option>
                <option value="delivery">🚚 Доставка</option>
                <option value="other">📦 Інше</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Контактна особа" className="rounded-xl border border-slate-300 px-3 py-2.5" value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} />
                <input placeholder="Телефон" className="rounded-xl border border-slate-300 px-3 py-2.5" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <input placeholder="Email" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              <input placeholder="Адреса" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
              <input placeholder="IBAN" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm" value={form.iban} onChange={e => setForm({...form, iban: e.target.value})} />
              <textarea placeholder="Примітка" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 h-20" value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
              <div className="flex gap-3 pt-2">
                <Btn type="button" onClick={() => setShowAdd(false)} className="flex-1">Скасувати</Btn>
                <Btn type="submit" variant="primary" className="flex-1">💾 Зберегти</Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function FinanceConsoleApp() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [expandedId, setExpandedId] = useState(null);
  const [orderFilter, setOrderFilter] = useState(null);

  // Data state
  const [dashboard, setDashboard] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [payroll, setPayroll] = useState([]);
  
  // Loading state
  const [loading, setLoading] = useState({
    dashboard: true, ledger: true, expenses: true, 
    orders: true, vendors: true, employees: true, payroll: true
  });
  const [isMock, setIsMock] = useState(false);

  // Initial load
  useEffect(() => { 
    loadDashboard(); 
    loadCategories(); 
    loadOrders();
    loadDeposits();
  }, []);
  
  // Tab-specific loading
  useEffect(() => { 
    if (tab === 'ledger') loadLedger(); 
    if (tab === 'expenses') loadExpenses(); 
    if (tab === 'payroll') { loadEmployees(); loadPayroll(); }
    if (tab === 'vendors') loadVendors();
  }, [tab]);

  const loadDashboard = async () => {
    setLoading(p => ({ ...p, dashboard: true }));
    const r = await financeApi.getDashboard('month');
    setDashboard(r.data);
    setIsMock(r.isMock);
    setLoading(p => ({ ...p, dashboard: false }));
  };

  const loadOrders = async () => {
    setLoading(p => ({ ...p, orders: true }));
    try {
      const finResponse = await authFetch(`${BACKEND_URL}/api/manager/finance/orders-with-finance?limit=100`);
      if (finResponse.ok) {
        const finData = await finResponse.json();
        setOrders(finData.orders || []);
      } else {
        // Fallback to regular orders
        const fallbackRes = await authFetch(`${BACKEND_URL}/api/orders?limit=100`);
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          setOrders(Array.isArray(fallbackData) ? fallbackData : fallbackData.orders || []);
        }
      }
    } catch (err) {
      console.error('Error loading orders:', err);
      setOrders([]);
    }
    setLoading(p => ({ ...p, orders: false }));
  };

  const loadDeposits = async () => {
    const r = await financeApi.getDeposits();
    setDeposits(Array.isArray(r.data) ? r.data : []);
  };

  const loadLedger = async () => {
    setLoading(p => ({ ...p, ledger: true }));
    const r = await financeApi.getLedger();
    setLedger(r.data?.transactions || []);
    setLoading(p => ({ ...p, ledger: false }));
  };

  const loadExpenses = async () => {
    setLoading(p => ({ ...p, expenses: true }));
    const r = await financeApi.getExpenses();
    setExpenses(r.data?.expenses || []);
    setLoading(p => ({ ...p, expenses: false }));
  };

  const loadCategories = async () => {
    const r = await financeApi.getCategories();
    setCategories(Array.isArray(r.data) ? r.data : []);
  };

  const loadVendors = async () => {
    setLoading(p => ({ ...p, vendors: true }));
    const r = await financeApi.getVendors();
    setVendors(r.data?.vendors || []);
    setLoading(p => ({ ...p, vendors: false }));
  };

  const loadEmployees = async () => {
    setLoading(p => ({ ...p, employees: true }));
    const r = await financeApi.getEmployees();
    setEmployees(r.data?.employees || []);
    setLoading(p => ({ ...p, employees: false }));
  };

  const loadPayroll = async () => {
    setLoading(p => ({ ...p, payroll: true }));
    const r = await financeApi.getPayroll();
    setPayroll(r.data?.payroll || []);
    setLoading(p => ({ ...p, payroll: false }));
  };

  const handleUpdate = () => {
    loadDashboard();
    loadOrders();
    loadDeposits();
    if (tab === 'ledger') loadLedger();
    if (tab === 'expenses') loadExpenses();
  };

  const handleExportLedger = () => {
    window.open(`${BACKEND_URL}/api/analytics/export/orders?format=csv&period=month`, '_blank');
  };

  const depositsCount = deposits.filter(d => d.status === 'holding' || d.status === 'partially_used').length;

  return (
    <div className="min-h-screen bg-slate-50">
      <CorporateHeader cabinetName="Фінансова консоль" />
      <TabBar tab={tab} setTab={setTab} />
      
      <main className="pb-8">
        {tab === 'overview' && (
          <OverviewTab 
            dashboard={dashboard} 
            isMock={isMock} 
            depositsCount={depositsCount}
            loading={loading.dashboard}
          />
        )}
        
        {tab === 'orders' && (
          <OrdersTab 
            orders={orders}
            deposits={deposits}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onUpdate={handleUpdate}
            filter={orderFilter}
            setFilter={setOrderFilter}
            loading={loading.orders}
          />
        )}
        
        {tab === 'ledger' && (
          <LedgerTab 
            ledger={ledger}
            loading={loading.ledger}
            onExport={handleExportLedger}
          />
        )}
        
        {tab === 'expenses' && (
          <ExpensesTab 
            expenses={expenses}
            categories={categories}
            loading={loading.expenses}
            onRefresh={() => { loadExpenses(); loadDashboard(); }}
          />
        )}
        
        {tab === 'payroll' && (
          <PayrollTab 
            employees={employees}
            payroll={payroll}
            loading={loading.employees || loading.payroll}
            onRefresh={() => { loadEmployees(); loadPayroll(); loadDashboard(); }}
          />
        )}
        
        {tab === 'vendors' && (
          <VendorsTab 
            vendors={vendors}
            loading={loading.vendors}
            onRefresh={loadVendors}
          />
        )}
      </main>
    </div>
  );
}
