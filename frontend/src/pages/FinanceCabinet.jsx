/* eslint-disable */
/**
 * FinanceCabinet - Фінансовий кабінет RentalHub
 * Центр управління грошима: rent/damage/deposit/expenses/payroll
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CorporateHeader from '../components/CorporateHeader';
import { financeApi } from '../services/financeApi.js';
import DocumentsPanel from '../components/finance/DocumentsPanel.jsx';
import OrderFinancePanel from '../components/finance/OrderFinancePanel.jsx';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helpers
const cls = (...a) => a.filter(Boolean).join(' ');
const money = (v, cur = '₴') => `${cur} ${(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })}`;

// Design tokens
const tone = {
  ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warn: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-rose-50 text-rose-800 border-rose-200',
  info: 'bg-sky-50 text-sky-800 border-sky-200',
  neutral: 'bg-slate-50 text-slate-800 border-slate-200',
};

const Pill = ({ t = 'neutral', children, className, onClick }) => (
  <span
    onClick={onClick}
    className={cls(
      'inline-flex items-center rounded-full border px-2 py-0.5 text-xs',
      tone[t],
      onClick && 'cursor-pointer hover:opacity-80',
      className
    )}
  >
    {children}
  </span>
);

const Btn = ({ variant = 'outline', className, children, ...props }) => {
  const base = 'inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm transition disabled:opacity-50';
  const v = variant === 'primary'
    ? 'bg-corp-primary text-white hover:bg-corp-primary-dark'
    : variant === 'dark'
    ? 'bg-slate-900 text-white hover:bg-slate-800'
    : variant === 'danger'
    ? 'bg-rose-600 text-white hover:bg-rose-700'
    : 'border bg-white hover:bg-slate-50';
  return <button className={cls(base, v, className)} {...props}>{children}</button>;
};

const Card = ({ className, children }) => (
  <div className={cls('rounded-2xl border bg-white shadow-sm', className)}>{children}</div>
);

const CardHd = ({ title, subtitle, right }) => (
  <div className="flex items-start justify-between gap-3 border-b p-4">
    <div className="min-w-0">
      <div className="text-sm font-semibold">{title}</div>
      {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);

const CardBd = ({ className, children }) => <div className={cls('p-4', className)}>{children}</div>;

const StatCard = ({ title, value, sub, toneKey = 'neutral' }) => (
  <Card>
    <CardBd>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">{title}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
      </div>
    </CardBd>
  </Card>
);

// Tabs component
function TabBar({ tab, setTab }) {
  const tabs = [
    { id: 'overview', label: 'Огляд', icon: '📊' },
    { id: 'orders', label: 'Замовлення', icon: '📦' },
    { id: 'ledger', label: 'Журнал', icon: '📒' },
    { id: 'expenses', label: 'Витрати', icon: '💸' },
    { id: 'payroll', label: 'ЗП', icon: '👥' },
    { id: 'vendors', label: 'Підрядники', icon: '🏢' },
  ];

  return (
    <div className="bg-white border-b border-corp-border">
      <div className="mx-auto max-w-7xl px-6 py-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cls(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                tab === t.id 
                  ? 'bg-corp-primary text-white' 
                  : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              )}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Order row for list
function OrderRow({ order, isOpen, onToggle }) {
  const rentDue = (order.total_rental || 0) - (order.rent_paid || 0);
  const depositExpected = order.total_deposit || 0;
  const depositHeld = order.deposit_held || 0;
  const depositDue = Math.max(0, depositExpected - depositHeld);
  
  const badges = [];
  if (rentDue > 0) badges.push(<Pill key="rent" t="warn">Борг оренди {money(rentDue)}</Pill>);
  if (depositDue > 0) badges.push(<Pill key="dep" t="info">Застава очік. {money(depositDue)}</Pill>);
  if (depositHeld > 0) badges.push(<Pill key="held" t="ok">Застава {money(depositHeld)}</Pill>);
  
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
        'w-full text-left rounded-2xl border bg-white p-4 shadow-sm hover:bg-slate-50/50', 
        isOpen && 'ring-2 ring-corp-primary/20'
      )} 
      onClick={onToggle}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">#{order.order_number || order.order_id}</div>
          <div className="text-sm text-slate-600 truncate">{order.client_name || order.customer_name}</div>
          <div className="text-xs text-slate-500">
            Оренда: {money(order.rent_paid || 0)} / {money(order.total_rental || 0)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {badges}
          <Pill t={st.t}>{st.label}</Pill>
          <span className={cls('h-8 w-8 flex items-center justify-center rounded-lg border text-slate-400', isOpen && 'rotate-90')}>▸</span>
        </div>
      </div>
    </button>
  );
}

// Transform order data for OrderFinancePanel
function transformOrderForPanel(order, payments = [], deposit = null) {
  const rentPayments = payments.filter(p => p.payment_type === 'rent');
  const depositPayments = payments.filter(p => p.payment_type === 'deposit');
  const damagePayments = payments.filter(p => p.payment_type === 'damage');
  
  const rentPaid = rentPayments.reduce((s, p) => s + p.amount, 0);
  const damagePaid = damagePayments.reduce((s, p) => s + p.amount, 0);
  
  return {
    id: order.order_id || order.id,
    order_number: order.order_number,
    client: order.client_name || order.customer_name,
    status: order.status,
    rent: {
      accrued: order.total_rental || 0,
      paid: rentPaid,
      due: Math.max(0, (order.total_rental || 0) - rentPaid),
    },
    deposit: {
      expected: order.total_deposit || 0,
      held: deposit?.held_amount || order.deposit_held || 0,
      used_for_damage: deposit?.used_amount || 0,
      refunded: deposit?.refunded_amount || 0,
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
    })),
  };
}

function OverviewTab({ dashboard, isMock, depositsCount }) {
  const { metrics, deposits } = dashboard;
  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      {isMock && <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800">⚠️ Offline mode - показані тестові дані</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard title="Чистий прибуток" value={money(metrics.net_profit)} sub="Оренда + Шкода − Витрати" toneKey={metrics.net_profit >= 0 ? 'ok' : 'danger'} />
        <StatCard title="Дохід з оренди" value={money(metrics.rent_revenue)} sub="RENT_REV" toneKey="info" />
        <StatCard title="Компенсації шкод" value={money(metrics.damage_compensation)} sub="DMG_COMP" toneKey="warn" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard title="Застави (холд)" value={money(deposits.held)} sub={`${depositsCount} шт. активних`} toneKey="neutral" />
        <StatCard title="Витрати" value={money(metrics.operating_expenses)} sub="OPEX" toneKey="danger" />
        <StatCard title="Каса + Банк" value={money(metrics.cash_balance)} sub="Готівка" toneKey="ok" />
        <StatCard title="До повернення" value={money(deposits.available_to_refund)} sub="застави клієнтам" toneKey="info" />
      </div>
    </div>
  );
}

function OrdersTab({ orders, deposits, expandedId, setExpandedId, onUpdate, filter, setFilter, loading }) {
  const [orderPayments, setOrderPayments] = useState({});
  
  // Fetch payments when order is expanded
  useEffect(() => {
    if (expandedId && !orderPayments[expandedId]) {
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
        <CardHd title="Замовлення з фінансами" subtitle={loading ? 'Завантаження...' : `${filtered.length} записів`}
          right={
            <div className="flex gap-2">
              <Pill t={filter === 'rent' ? 'warn' : 'neutral'} onClick={() => setFilter(filter === 'rent' ? null : 'rent')}>Борг оренда</Pill>
              <Pill t={filter === 'deposit' ? 'info' : 'neutral'} onClick={() => setFilter(filter === 'deposit' ? null : 'deposit')}>Із заставою</Pill>
            </div>
          }
        />
        <CardBd>
          {loading ? (
            <div className="p-8 text-center text-slate-500">Завантаження замовлень...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Немає замовлень</div>
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
                      isOpen={expandedId === (o.order_id || o.id)} 
                      onToggle={() => setExpandedId(expandedId === (o.order_id || o.id) ? null : (o.order_id || o.id))} 
                    />
                    {expandedId === (o.order_id || o.id) && (
                      <OrderFinancePanel order={panelOrder} onUpdate={onUpdate} />
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

function LedgerTab({ ledger, loading }) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <Card>
        <CardHd title="Журнал (Ledger)" subtitle="Подвійний запис" right={<Btn>Експорт</Btn>} />
        <CardBd className="p-0">
          {loading ? <div className="p-8 text-center text-slate-500">Завантаження...</div> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Дата</th>
                    <th className="px-4 py-3 text-left">Тип</th>
                    <th className="px-4 py-3 text-right">Сума</th>
                    <th className="px-4 py-3 text-left">Проводки</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((tx) => (
                    <tr key={tx.id} className="border-t">
                      <td className="px-4 py-3">{tx.occurred_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td className="px-4 py-3"><Pill t={tx.tx_type?.includes('damage') ? 'warn' : 'info'}>{tx.tx_type}</Pill></td>
                      <td className="px-4 py-3 text-right font-medium">{money(tx.amount)}</td>
                      <td className="px-4 py-3 text-xs">{tx.entries?.map((e, i) => <span key={i} className="mr-2">{e.direction}:{e.account_code}</span>)}</td>
                    </tr>
                  ))}
                  {!ledger.length && <tr><td colSpan={4} className="p-8 text-center text-slate-500">Немає записів</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </CardBd>
      </Card>
    </div>
  );
}

function ExpensesTab({ expenses, categories, loading, onAdd }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ category_code: 'CONSUMABLES', amount: '', method: 'cash', note: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount) return;
    await financeApi.createExpense({ expense_type: 'expense', ...form, amount: Number(form.amount) });
    setShow(false);
    setForm({ category_code: 'CONSUMABLES', amount: '', method: 'cash', note: '' });
    onAdd?.();
  };

  const byCategory = useMemo(() => {
    const g = {};
    expenses.forEach((e) => { const c = e.category_name; if (!g[c]) g[c] = 0; g[c] += e.amount; });
    return g;
  }, [expenses]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <Card>
        <CardHd title="Витрати" subtitle="OPEX / закупки" right={<Btn variant="dark" onClick={() => setShow(true)}>+ Додати</Btn>} />
        <CardBd>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {Object.entries(byCategory).slice(0, 4).map(([c, v]) => (
              <div key={c} className="rounded-xl border bg-slate-50 p-3">
                <div className="text-xs text-slate-500">{c}</div>
                <div className="text-xl font-semibold">{money(v)}</div>
              </div>
            ))}
          </div>
          {loading ? <div className="p-4 text-center text-slate-500">Завантаження...</div> : expenses.length ? (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr><th className="px-3 py-2 text-left">Дата</th><th className="px-3 py-2 text-left">Категорія</th><th className="px-3 py-2 text-right">Сума</th><th className="px-3 py-2 text-left">Примітка</th></tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2">{e.occurred_at?.slice(0, 10)}</td>
                    <td className="px-3 py-2">{e.category_name}</td>
                    <td className="px-3 py-2 text-right font-medium">{money(e.amount)}</td>
                    <td className="px-3 py-2 text-slate-600">{e.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="p-4 text-center text-slate-500">Немає витрат</div>}
        </CardBd>
      </Card>

      {show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-6 py-4 flex justify-between"><h3 className="font-semibold">Додати витрату</h3><button onClick={() => setShow(false)}>✕</button></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <select className="w-full rounded-xl border px-3 py-2" value={form.category_code} onChange={(e) => setForm({ ...form, category_code: e.target.value })}>
                {categories.filter(c => c.type === 'expense').map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
              <input type="number" placeholder="Сума" className="w-full rounded-xl border px-3 py-2" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              <input placeholder="Примітка" className="w-full rounded-xl border px-3 py-2" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              <div className="flex gap-2"><Btn type="button" onClick={() => setShow(false)} className="flex-1">Скасувати</Btn><Btn type="submit" variant="primary" className="flex-1">Зберегти</Btn></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PayrollTab({ employees, payroll, loading, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showEmployee, setShowEmployee] = useState(false);
  const [form, setForm] = useState({ employee_id: '', period_start: '', period_end: '', base_amount: '', bonus: '0', deduction: '0', method: 'cash', note: '' });
  const [empForm, setEmpForm] = useState({ name: '', role: 'manager', phone: '', base_salary: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.base_amount) return;
    await financeApi.createPayroll({ ...form, base_amount: Number(form.base_amount), bonus: Number(form.bonus), deduction: Number(form.deduction) });
    setShowAdd(false);
    setForm({ employee_id: '', period_start: '', period_end: '', base_amount: '', bonus: '0', deduction: '0', method: 'cash', note: '' });
    onRefresh?.();
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!empForm.name) return;
    await financeApi.createEmployee({ ...empForm, base_salary: Number(empForm.base_salary || 0) });
    setShowEmployee(false);
    setEmpForm({ name: '', role: 'manager', phone: '', base_salary: '' });
    onRefresh?.();
  };

  const handlePay = async (id) => {
    if (confirm('Підтвердити виплату зарплати?')) {
      await financeApi.payPayroll(id);
      onRefresh?.();
    }
  };

  const roleLabels = { manager: 'Менеджер', courier: 'Кур\'єр', cleaner: 'Прибиральник', assistant: 'Помічник', other: 'Інше' };
  const statusLabels = { pending: 'Очікує', approved: 'Затверджено', paid: 'Виплачено' };
  const statusTone = { pending: 'warn', approved: 'info', paid: 'ok' };

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      {/* Employees Card */}
      <Card>
        <CardHd title="👥 Співробітники" subtitle={`${employees.length} осіб`} right={<Btn variant="dark" onClick={() => setShowEmployee(true)}>+ Додати</Btn>} />
        <CardBd>
          {loading ? <div className="p-4 text-center text-slate-500">Завантаження...</div> : employees.length ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {employees.map(e => (
                <div key={e.id} className="border rounded-xl p-3">
                  <div className="font-medium">{e.name}</div>
                  <div className="text-sm text-slate-500">{roleLabels[e.role] || e.role}</div>
                  <div className="text-sm text-slate-600">Ставка: {money(e.base_salary)}</div>
                  {e.phone && <div className="text-xs text-slate-400">{e.phone}</div>}
                </div>
              ))}
            </div>
          ) : <div className="p-4 text-center text-slate-400">Немає співробітників</div>}
        </CardBd>
      </Card>

      {/* Payroll Card */}
      <Card>
        <CardHd title="💰 Нарахування зарплат" subtitle="Історія виплат" right={<Btn variant="dark" onClick={() => setShowAdd(true)}>+ Нарахувати</Btn>} />
        <CardBd>
          {loading ? <div className="p-4 text-center text-slate-500">Завантаження...</div> : payroll.length ? (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr><th className="px-3 py-2 text-left">Співробітник</th><th className="px-3 py-2 text-left">Період</th><th className="px-3 py-2 text-right">Сума</th><th className="px-3 py-2 text-left">Статус</th><th className="px-3 py-2"></th></tr>
              </thead>
              <tbody>
                {payroll.map(p => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{p.employee_name || `ID: ${p.employee_id}`}</td>
                    <td className="px-3 py-2 text-slate-600">{p.period_start?.slice(0, 10)} — {p.period_end?.slice(0, 10)}</td>
                    <td className="px-3 py-2 text-right">{money(p.total_amount)}</td>
                    <td className="px-3 py-2"><Pill t={statusTone[p.status]}>{statusLabels[p.status]}</Pill></td>
                    <td className="px-3 py-2">{p.status !== 'paid' && <Btn onClick={() => handlePay(p.id)}>Виплатити</Btn>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="p-4 text-center text-slate-400">Немає нарахувань</div>}
        </CardBd>
      </Card>

      {/* Add Payroll Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="border-b px-6 py-4 flex justify-between"><h3 className="font-semibold">Нарахувати зарплату</h3><button onClick={() => setShowAdd(false)}>✕</button></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <select className="w-full rounded-xl border px-3 py-2" value={form.employee_id} onChange={e => setForm({...form, employee_id: e.target.value})} required>
                <option value="">Оберіть співробітника</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" className="rounded-xl border px-3 py-2" placeholder="Початок" value={form.period_start} onChange={e => setForm({...form, period_start: e.target.value})} required />
                <input type="date" className="rounded-xl border px-3 py-2" placeholder="Кінець" value={form.period_end} onChange={e => setForm({...form, period_end: e.target.value})} required />
              </div>
              <input type="number" placeholder="Базова сума" className="w-full rounded-xl border px-3 py-2" value={form.base_amount} onChange={e => setForm({...form, base_amount: e.target.value})} required />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Бонус" className="rounded-xl border px-3 py-2" value={form.bonus} onChange={e => setForm({...form, bonus: e.target.value})} />
                <input type="number" placeholder="Утримання" className="rounded-xl border px-3 py-2" value={form.deduction} onChange={e => setForm({...form, deduction: e.target.value})} />
              </div>
              <input placeholder="Примітка" className="w-full rounded-xl border px-3 py-2" value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
              <div className="flex gap-2"><Btn type="button" onClick={() => setShowAdd(false)} className="flex-1">Скасувати</Btn><Btn type="submit" variant="primary" className="flex-1">Зберегти</Btn></div>
            </form>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showEmployee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEmployee(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="border-b px-6 py-4 flex justify-between"><h3 className="font-semibold">Додати співробітника</h3><button onClick={() => setShowEmployee(false)}>✕</button></div>
            <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
              <input placeholder="Ім'я" className="w-full rounded-xl border px-3 py-2" value={empForm.name} onChange={e => setEmpForm({...empForm, name: e.target.value})} required />
              <select className="w-full rounded-xl border px-3 py-2" value={empForm.role} onChange={e => setEmpForm({...empForm, role: e.target.value})}>
                <option value="manager">Менеджер</option>
                <option value="courier">Кур'єр</option>
                <option value="cleaner">Прибиральник</option>
                <option value="assistant">Помічник</option>
                <option value="other">Інше</option>
              </select>
              <input placeholder="Телефон" className="w-full rounded-xl border px-3 py-2" value={empForm.phone} onChange={e => setEmpForm({...empForm, phone: e.target.value})} />
              <input type="number" placeholder="Базова ставка" className="w-full rounded-xl border px-3 py-2" value={empForm.base_salary} onChange={e => setEmpForm({...empForm, base_salary: e.target.value})} />
              <div className="flex gap-2"><Btn type="button" onClick={() => setShowEmployee(false)} className="flex-1">Скасувати</Btn><Btn type="submit" variant="primary" className="flex-1">Зберегти</Btn></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function VendorsTab() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <Card>
        <CardHd title="Підрядники" subtitle="Хімчистка, реставрація" right={<Btn variant="dark">+ Додати</Btn>} />
        <CardBd>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            🚧 Модуль в розробці. Тут буде управління підрядниками та їх рахунками.
          </div>
        </CardBd>
      </Card>
    </div>
  );
}

export default function FinanceCabinet() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [expandedId, setExpandedId] = useState(null);
  const [orderFilter, setOrderFilter] = useState(null);

  const [dashboard, setDashboard] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState({ dashboard: true, ledger: true, expenses: true, orders: true });
  const [isMock, setIsMock] = useState(false);

  useEffect(() => { 
    loadDashboard(); 
    loadCategories(); 
    loadOrders();
    loadDeposits();
  }, []);
  
  useEffect(() => { 
    if (tab === 'ledger') loadLedger(); 
    if (tab === 'expenses') loadExpenses(); 
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
      // Fetch orders that are not archived and not cancelled
      const response = await fetch(`${BACKEND_URL}/api/orders?limit=100`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || data || []);
      }
    } catch (err) {
      console.error('Error loading orders:', err);
    }
    setLoading(p => ({ ...p, orders: false }));
  };

  const loadDeposits = async () => {
    const r = await financeApi.getDeposits();
    setDeposits(r.data || []);
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
    setCategories(r.data || []);
  };

  const refresh = () => { 
    loadDashboard(); 
    loadOrders();
    loadDeposits();
    if (tab === 'ledger') loadLedger(); 
    if (tab === 'expenses') loadExpenses(); 
  };

  return (
    <div className="min-h-screen bg-corp-bg-page font-montserrat">
      <CorporateHeader cabinetName="Фінансовий кабінет" showBackButton onBackClick={() => navigate('/manager')} />
      <TabBar tab={tab} setTab={setTab} />
      
      {tab === 'overview' && (loading.dashboard ? (
        <div className="mx-auto max-w-7xl px-6 py-6"><div className="p-8 text-center text-slate-500">Завантаження...</div></div>
      ) : dashboard ? (
        <OverviewTab dashboard={dashboard} isMock={isMock} depositsCount={deposits.length} />
      ) : (
        <div className="mx-auto max-w-7xl px-6 py-6"><div className="p-8 text-center text-slate-400">Дані не знайдено</div></div>
      ))}
      
      {tab === 'orders' && (
        <OrdersTab 
          orders={orders} 
          deposits={deposits}
          expandedId={expandedId} 
          setExpandedId={setExpandedId} 
          onUpdate={refresh} 
          filter={orderFilter} 
          setFilter={setOrderFilter}
          loading={loading.orders}
        />
      )}
      {tab === 'ledger' && <LedgerTab ledger={ledger} loading={loading.ledger} />}
      {tab === 'expenses' && <ExpensesTab expenses={expenses} categories={categories} loading={loading.expenses} onAdd={() => { loadExpenses(); loadDashboard(); }} />}
      {tab === 'payroll' && <PayrollTab />}
      {tab === 'vendors' && <VendorsTab />}
      
      <div className="mx-auto max-w-7xl px-6 pb-10 pt-6 text-xs text-slate-400">Rental Finance Engine v1.0</div>
    </div>
  );
}
