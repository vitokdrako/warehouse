/* eslint-disable */
/**
 * FinanceCabinet - Фінансовий кабінет RentalHub
 * Центр управління грошима: rent/damage/deposit/expenses/payroll
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { financeApi } from '../services/financeApi';
import DocumentsPanel from '../components/finance/DocumentsPanel.jsx';
import OrderFinancePanel from '../components/finance/OrderFinancePanel.jsx';

// Helpers
const cls = (...a) => a.filter(Boolean).join(' ');
const money = (v, cur = '₴') => `${cur} ${(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })}`;

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
    ? 'bg-lime-600 text-white hover:bg-lime-700'
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
        <Pill t={toneKey}>{toneKey}</Pill>
      </div>
    </CardBd>
  </Card>
);

// Mock orders
const mockOrders = [
  {
    id: 7121, order_number: 'OC-7121', client: 'Віта Филимонихина', status: 'active',
    rent: { accrued: 1750, paid: 0, due: 1750 },
    deposit: { expected: 2537.5, held: 2000, used_for_damage: 500, refunded: 0 },
    damage: { assessed: 500, paid: 500, due: 0 },
    timeline: [
      { at: '2025-12-16 10:39', type: 'deposit_received', label: 'Прийнято заставу', debit: 2000, credit: 2000 },
    ],
  },
  {
    id: 7120, order_number: 'OC-7120', client: 'Володимир Перетятко', status: 'active',
    rent: { accrued: 7100, paid: 5000, due: 2100 },
    deposit: { expected: 25550, held: 0, used_for_damage: 0, refunded: 0 },
    damage: { assessed: 0, paid: 0, due: 0 },
    timeline: [],
  },
  {
    id: 7108, order_number: 'OC-7108', client: 'Алла Mazyr', status: 'closed',
    rent: { accrued: 2580, paid: 2580, due: 0 },
    deposit: { expected: 0, held: 0, used_for_damage: 0, refunded: 0 },
    damage: { assessed: 0, paid: 0, due: 0 },
    timeline: [],
  },
];

function TopBar({ tab, setTab, onBack }) {
  const tabs = [
    { id: 'overview', label: 'Огляд' },
    { id: 'orders', label: 'Замовлення' },
    { id: 'ledger', label: 'Журнал' },
    { id: 'expenses', label: 'Витрати' },
    { id: 'payroll', label: 'ЗП' },
    { id: 'vendors', label: 'Підрядники' },
  ];

  return (
    <div className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-lime-600 text-white grid place-items-center font-bold">RH</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Rental Hub</div>
              <div className="text-xs text-slate-500">Фінансовий кабінет</div>
            </div>
          </div>
          <Btn onClick={onBack}>← Назад</Btn>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cls(
                'rounded-xl px-3 py-2 text-sm',
                tab === t.id ? 'bg-lime-600 text-white' : 'border bg-white hover:bg-slate-50'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrderRow({ order, isOpen, onToggle }) {
  const badges = [];
  if (order.rent.due > 0) badges.push(<Pill key="rent" t="warn">Борг {money(order.rent.due)}</Pill>);
  if (order.damage.due > 0) badges.push(<Pill key="damage" t="danger">Шкода {money(order.damage.due)}</Pill>);
  const holdAvail = order.deposit.held - order.deposit.used_for_damage - order.deposit.refunded;
  if (holdAvail > 0) badges.push(<Pill key="hold" t="info">Застава {money(holdAvail)}</Pill>);
  
  const statusBadge = order.status === 'closed' ? <Pill t="ok">Закрито</Pill> : <Pill t="info">Активне</Pill>;

  return (
    <button className={cls('w-full text-left rounded-2xl border bg-white p-4 shadow-sm hover:bg-slate-50/50', isOpen && 'ring-2 ring-lime-100')} onClick={onToggle}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">#{order.id}</div>
          <div className="text-sm text-slate-600 truncate">{order.client}</div>
          <div className="text-xs text-slate-500">Оренда: {money(order.rent.paid)} / {money(order.rent.accrued)}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {badges}
          {statusBadge}
          <span className={cls('h-8 w-8 flex items-center justify-center rounded-lg border', isOpen && 'rotate-90')}>▸</span>
        </div>
      </div>
    </button>
  );
}

function OverviewTab({ dashboard, isMock }) {
  const { metrics, deposits } = dashboard;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      {isMock && <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800">⚠️ Offline mode</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard title="Net Profit" value={money(metrics.net_profit)} sub="Rent + Damage − Expenses" toneKey={metrics.net_profit >= 0 ? 'ok' : 'danger'} />
        <StatCard title="Rent Revenue" value={money(metrics.rent_revenue)} sub="Дохід з оренди" toneKey="info" />
        <StatCard title="Damage Comp" value={money(metrics.damage_compensation)} sub="Компенсації" toneKey="warn" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard title="Deposits Hold" value={money(deposits.available_to_refund)} sub="не дохід" toneKey="neutral" />
        <StatCard title="Expenses" value={money(metrics.operating_expenses)} sub="OPEX" toneKey="danger" />
        <StatCard title="Cash" value={money(metrics.cash_balance)} sub="Готівка+банк" toneKey="ok" />
        <StatCard title="To Refund" value={money(deposits.available_to_refund)} sub="застави" toneKey="info" />
      </div>
    </div>
  );
}

function OrdersTab({ orders, expandedId, setExpandedId, onUpdate, filter, setFilter }) {
  const filtered = useMemo(() => {
    if (!filter) return orders;
    return orders.filter((o) => {
      if (filter === 'rent') return o.rent.due > 0;
      if (filter === 'damage') return o.damage.due > 0;
      if (filter === 'deposit') return (o.deposit.held - o.deposit.used_for_damage - o.deposit.refunded) > 0;
      return true;
    });
  }, [orders, filter]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Card>
        <CardHd title="Замовлення" subtitle={`${filtered.length} записів`}
          right={
            <div className="flex gap-2">
              <Pill t={filter === 'rent' ? 'warn' : 'neutral'} onClick={() => setFilter(filter === 'rent' ? null : 'rent')}>Борг оренда</Pill>
              <Pill t={filter === 'damage' ? 'danger' : 'neutral'} onClick={() => setFilter(filter === 'damage' ? null : 'damage')}>Борг шкода</Pill>
              <Pill t={filter === 'deposit' ? 'info' : 'neutral'} onClick={() => setFilter(filter === 'deposit' ? null : 'deposit')}>Застава</Pill>
            </div>
          }
        />
        <CardBd>
          <div className="space-y-2">
            {filtered.map((o) => (
              <div key={o.id}>
                <OrderRow order={o} isOpen={expandedId === o.id} onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)} />
                {expandedId === o.id && <OrderFinancePanel order={o} onUpdate={onUpdate} />}
              </div>
            ))}
          </div>
        </CardBd>
      </Card>
    </div>
  );
}

function LedgerTab({ ledger, loading }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
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
    onAdd?.();
  };

  const byCategory = useMemo(() => {
    const g = {};
    expenses.forEach((e) => { const c = e.category_name; if (!g[c]) g[c] = 0; g[c] += e.amount; });
    return g;
  }, [expenses]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
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

function PayrollTab() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Card>
        <CardHd title="Зарплата" subtitle="Нарахування → виплата" right={<Btn variant="dark">Нарахувати</Btn>} />
        <CardBd>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl border bg-slate-50 p-3"><div className="text-xs text-slate-500">Payroll</div><div className="text-xl font-semibold">{money(12000)}</div></div>
            <div className="rounded-xl border bg-slate-50 p-3"><div className="text-xs text-slate-500">Employees</div><div className="text-xl font-semibold">6</div></div>
            <div className="rounded-xl border bg-slate-50 p-3"><div className="text-xs text-slate-500">Overtime</div><div className="text-xl font-semibold">12 год</div></div>
            <div className="rounded-xl border bg-slate-50 p-3"><div className="text-xs text-slate-500">Bonuses</div><div className="text-xl font-semibold">{money(1500)}</div></div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">🚧 Модуль в розробці</div>
        </CardBd>
      </Card>
    </div>
  );
}

function VendorsTab() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Card>
        <CardHd title="Підрядники" subtitle="Хімчистка, реставрація" right={<Btn variant="dark">+ Додати</Btn>} />
        <CardBd>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border bg-slate-50 p-3"><div className="font-semibold">Хімчистка "Чистота"</div><div className="text-xs text-slate-500">Баланс: {money(0)}</div></div>
            <div className="rounded-xl border bg-slate-50 p-3"><div className="font-semibold">Реставрація "Майстер"</div><div className="text-xs text-slate-500">Баланс: {money(-2500)}</div></div>
            <div className="rounded-xl border bg-slate-50 p-3"><div className="font-semibold">Доставка "Швидко"</div><div className="text-xs text-slate-500">Баланс: {money(0)}</div></div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">🚧 Модуль в розробці</div>
        </CardBd>
      </Card>
    </div>
  );
}

export default function FinanceCabinet() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [expandedId, setExpandedId] = useState(7121);
  const [orderFilter, setOrderFilter] = useState(null);

  const [dashboard, setDashboard] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders] = useState(mockOrders);
  const [loading, setLoading] = useState({ dashboard: true, ledger: true, expenses: true });
  const [isMock, setIsMock] = useState(false);

  useEffect(() => { loadDashboard(); loadCategories(); }, []);
  useEffect(() => { if (tab === 'ledger') loadLedger(); if (tab === 'expenses') loadExpenses(); }, [tab]);

  const loadDashboard = async () => {
    setLoading(p => ({ ...p, dashboard: true }));
    const r = await financeApi.getDashboard('month');
    setDashboard(r.data);
    setIsMock(r.isMock);
    setLoading(p => ({ ...p, dashboard: false }));
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

  const refresh = () => { loadDashboard(); if (tab === 'ledger') loadLedger(); if (tab === 'expenses') loadExpenses(); };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar tab={tab} setTab={setTab} onBack={() => navigate('/manager')} />
      {tab === 'overview' && dashboard && <OverviewTab dashboard={dashboard} isMock={isMock} />}
      {tab === 'orders' && <OrdersTab orders={orders} expandedId={expandedId} setExpandedId={setExpandedId} onUpdate={refresh} filter={orderFilter} setFilter={setOrderFilter} />}
      {tab === 'ledger' && <LedgerTab ledger={ledger} loading={loading.ledger} />}
      {tab === 'expenses' && <ExpensesTab expenses={expenses} categories={categories} loading={loading.expenses} onAdd={() => { loadExpenses(); loadDashboard(); }} />}
      {tab === 'payroll' && <PayrollTab />}
      {tab === 'vendors' && <VendorsTab />}
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-xs text-slate-400">Rental Finance Engine</div>
    </div>
  );
}
