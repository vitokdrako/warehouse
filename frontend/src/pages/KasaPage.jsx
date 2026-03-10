/* eslint-disable */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CorporateHeader from '../components/CorporateHeader';
import {
  ArrowLeft, Banknote, CreditCard, Wallet, TrendingUp, TrendingDown,
  Calendar, Search, Filter, RefreshCw, ArrowDownCircle, ArrowUpCircle,
  Shield, RotateCcw, ChevronDown, Building2, DollarSign, Eye
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const authFetch = (url, opts = {}) => {
  const token = localStorage.getItem('token');
  return fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers } });
};

const fmtUA = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 });
const money = (v) => `₴${fmtUA(v)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : '';

export default function KasaPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(searchParams.get('period') || 'month');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/kasa?period=${period}`);
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [period]);

  const changePeriod = (p) => {
    setPeriod(p);
    setSearchParams({ period: p });
  };

  const periodLabels = { day: 'Сьогодні', week: 'Тиждень', month: 'Місяць', all: 'Весь час' };

  // Filter items by search
  const filterBySearch = (items) => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i =>
      (i.order_number || '').toLowerCase().includes(q) ||
      (i.customer_name || '').toLowerCase().includes(q) ||
      (i.note || '').toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q) ||
      (i.category_name || '').toLowerCase().includes(q)
    );
  };

  const income = data?.income || { items: [], cash_total: 0, bank_total: 0, total: 0 };
  const deposits = data?.deposits || { items: [], held_total: 0, available_total: 0 };
  const expenses = data?.expenses || { items: [], refunds: [], cash_total: 0, bank_total: 0, total: 0 };
  const summary = data?.summary || { net_cash: 0, net_bank: 0, net_total: 0 };

  const filteredIncome = filterBySearch(income.items);
  const filteredDeposits = filterBySearch(deposits.items);
  const filteredExpenses = filterBySearch([...expenses.items, ...expenses.refunds.map(r => ({ ...r, category_name: 'Повернення застави', expense_type: 'refund' }))]);

  return (
    <div className="min-h-screen bg-slate-50 font-montserrat" data-testid="kasa-page">
      <CorporateHeader cabinetName="Каса" />

      {/* Top Bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/manager-cabinet')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" data-testid="back-btn">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-800">Каса</h1>
                <p className="text-xs text-slate-500">{periodLabels[period]}</p>
              </div>
            </div>

            {/* Period Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl" data-testid="period-tabs">
              {Object.entries(periodLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => changePeriod(key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    period === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  data-testid={`period-${key}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Пошук по ордеру, клієнту..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  data-testid="search-input"
                />
              </div>
              <button onClick={fetchData} disabled={loading} className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50" data-testid="refresh-btn">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Summary Bar */}
          {data && (
            <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-100 text-sm" data-testid="summary-bar">
              <SummaryPill icon={TrendingUp} label="Дохід" value={money(income.total)} color="emerald" />
              <SummaryPill icon={Banknote} label="Готівка" value={money(income.cash_total)} color="green" sub />
              <SummaryPill icon={CreditCard} label="Безготівка" value={money(income.bank_total)} color="blue" sub />
              <div className="h-5 w-px bg-slate-200" />
              <SummaryPill icon={Shield} label="Застави" value={money(deposits.held_total)} color="amber" />
              <div className="h-5 w-px bg-slate-200" />
              <SummaryPill icon={TrendingDown} label="Витрати" value={money(expenses.total)} color="rose" />
              <div className="h-5 w-px bg-slate-200" />
              <SummaryPill icon={Wallet} label="Чистий дохід" value={money(summary.net_total)} color={summary.net_total >= 0 ? 'emerald' : 'red'} bold />
            </div>
          )}
        </div>
      </div>

      {/* 3-Column Layout */}
      <main className="max-w-[1800px] mx-auto px-4 py-6" data-testid="kasa-columns">
        {loading ? (
          <div className="grid grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 h-96 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* COLUMN 1: INCOME */}
            <IncomeColumn items={filteredIncome} totals={income} navigate={navigate} />

            {/* COLUMN 2: DEPOSITS */}
            <DepositsColumn items={filteredDeposits} totals={deposits} navigate={navigate} />

            {/* COLUMN 3: EXPENSES */}
            <ExpensesColumn items={filteredExpenses} totals={expenses} />
          </div>
        )}
      </main>
    </div>
  );
}

/* ========== Summary Pill ========== */
function SummaryPill({ icon: Icon, label, value, color, sub, bold }) {
  const colorMap = {
    emerald: 'text-emerald-700', green: 'text-green-600', blue: 'text-blue-600',
    amber: 'text-amber-600', rose: 'text-rose-600', red: 'text-red-600',
  };
  return (
    <div className={`flex items-center gap-1.5 ${sub ? 'opacity-75' : ''}`}>
      <Icon className={`w-3.5 h-3.5 ${colorMap[color] || 'text-slate-500'}`} />
      <span className="text-slate-500 text-xs">{label}:</span>
      <span className={`${bold ? 'font-bold text-sm' : 'font-semibold text-xs'} ${colorMap[color] || 'text-slate-700'}`}>{value}</span>
    </div>
  );
}

/* ========== COLUMN 1: INCOME ========== */
function IncomeColumn({ items, totals, navigate }) {
  return (
    <section className="rounded-2xl border border-emerald-200 ring-2 ring-emerald-100 bg-white shadow-sm" data-testid="income-column">
      <div className="px-5 py-4 border-b border-emerald-100 bg-emerald-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Дохід</h3>
              <p className="text-xs text-slate-500">{items.length} операцій</p>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-emerald-700 text-lg">{money(totals.total)}</div>
            <div className="flex gap-3 text-[11px] text-slate-500">
              <span><Banknote className="w-3 h-3 inline mr-0.5" />{money(totals.cash_total)}</span>
              <span><CreditCard className="w-3 h-3 inline mr-0.5" />{money(totals.bank_total)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="p-3 space-y-1.5 max-h-[calc(100vh-340px)] overflow-y-auto">
        {items.length === 0 ? (
          <EmptyState text="Немає оплат за цей період" />
        ) : items.map(item => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all cursor-pointer group"
            onClick={() => item.order_id && navigate(`/order/${item.order_id}/view`)}
            data-testid={`income-item-${item.id}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              item.method === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {item.method === 'cash' ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">{item.order_number || '—'}</span>
                <TypeBadge type={item.type} label={item.type_label} />
              </div>
              <div className="text-xs text-slate-500 truncate">{item.customer_name || item.note || ''}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-bold text-emerald-700 text-sm">+{money(item.amount)}</div>
              <div className="text-[10px] text-slate-400">{fmtDate(item.date)} {fmtTime(item.date)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ========== COLUMN 2: DEPOSITS ========== */
function DepositsColumn({ items, totals, navigate }) {
  return (
    <section className="rounded-2xl border border-amber-200 ring-2 ring-amber-100 bg-white shadow-sm" data-testid="deposits-column">
      <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Застави</h3>
              <p className="text-xs text-slate-500">{items.length} активних</p>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-amber-700 text-lg">{money(totals.held_total)}</div>
            <div className="flex gap-3 text-[11px] text-slate-500">
              <span className="text-emerald-600">Доступно: {money(totals.available_total)}</span>
            </div>
          </div>
        </div>

        {/* Deposit sub-totals */}
        <div className="flex gap-3 mt-2 pt-2 border-t border-amber-100 text-[11px]">
          <span className="text-slate-500"><Banknote className="w-3 h-3 inline mr-0.5" />Гот: {money(totals.cash_received || 0)}</span>
          <span className="text-slate-500"><CreditCard className="w-3 h-3 inline mr-0.5" />Безгот: {money(totals.bank_received || 0)}</span>
          <span className="text-rose-500 ml-auto">Утримано: {money(totals.used_total)}</span>
          <span className="text-blue-500">Поверн: {money(totals.refunded_total)}</span>
        </div>
      </div>
      <div className="p-3 space-y-1.5 max-h-[calc(100vh-340px)] overflow-y-auto">
        {items.length === 0 ? (
          <EmptyState text="Немає застав за цей період" />
        ) : items.map(item => {
          const statusConfig = {
            holding: { label: 'Активна', color: 'bg-amber-100 text-amber-700' },
            partially_used: { label: 'Частк.', color: 'bg-orange-100 text-orange-700' },
            fully_used: { label: 'Використано', color: 'bg-rose-100 text-rose-700' },
            refunded: { label: 'Повернуто', color: 'bg-blue-100 text-blue-700' },
          };
          const st = statusConfig[item.status] || { label: item.status, color: 'bg-slate-100 text-slate-600' };
          const currSymbol = item.currency === 'USD' ? '$' : item.currency === 'EUR' ? '€' : '₴';

          return (
            <div
              key={item.id}
              className="px-3 py-2.5 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all cursor-pointer"
              onClick={() => item.order_id && navigate(`/order/${item.order_id}/return-settlement`)}
              data-testid={`deposit-item-${item.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-slate-700">{item.order_number || '—'}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                </div>
                <div className="font-bold text-amber-700 text-sm">
                  {currSymbol}{fmtUA(item.actual_amount)}
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-500 truncate">{item.customer_name}</span>
                <span className="text-[10px] text-slate-400">{fmtDate(item.opened_at)}</span>
              </div>
              {/* Used / Refunded breakdown */}
              {(item.used_amount > 0 || item.refunded_amount > 0) && (
                <div className="flex gap-3 mt-1.5 text-[10px]">
                  {item.used_amount > 0 && <span className="text-rose-600">Утримано: {money(item.used_amount)}</span>}
                  {item.refunded_amount > 0 && <span className="text-blue-600">Повернуто: {money(item.refunded_amount)}</span>}
                  <span className="text-emerald-600 ml-auto">Доступно: {money(item.available)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ========== COLUMN 3: EXPENSES ========== */
function ExpensesColumn({ items, totals }) {
  return (
    <section className="rounded-2xl border border-rose-200 ring-2 ring-rose-100 bg-white shadow-sm" data-testid="expenses-column">
      <div className="px-5 py-4 border-b border-rose-100 bg-rose-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Витрати</h3>
              <p className="text-xs text-slate-500">{items.length} операцій</p>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-rose-700 text-lg">{money(totals.total)}</div>
            <div className="flex gap-3 text-[11px] text-slate-500">
              <span><Banknote className="w-3 h-3 inline mr-0.5" />{money(totals.cash_total)}</span>
              <span><CreditCard className="w-3 h-3 inline mr-0.5" />{money(totals.bank_total)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="p-3 space-y-1.5 max-h-[calc(100vh-340px)] overflow-y-auto">
        {items.length === 0 ? (
          <EmptyState text="Немає витрат за цей період" />
        ) : items.map((item, idx) => {
          const isRefund = item.expense_type === 'refund';
          return (
            <div
              key={item.id || idx}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 hover:border-rose-200 hover:bg-rose-50/30 transition-all"
              data-testid={`expense-item-${item.id || idx}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isRefund ? 'bg-blue-100 text-blue-700' :
                item.method === 'cash' ? 'bg-red-100 text-red-700' : 'bg-pink-100 text-pink-700'
              }`}>
                {isRefund ? <RotateCcw className="w-4 h-4" /> :
                 item.method === 'cash' ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-700">
                  {isRefund ? `Повернення застави` : (item.category_name || 'Витрата')}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {isRefund ? `${item.order_number} · ${item.customer_name}` : (item.note || '')}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`font-bold text-sm ${isRefund ? 'text-blue-700' : 'text-rose-700'}`}>-{money(item.amount)}</div>
                <div className="text-[10px] text-slate-400">{fmtDate(item.date)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ========== Type Badge ========== */
function TypeBadge({ type, label }) {
  const colors = {
    rent: 'bg-emerald-100 text-emerald-700',
    additional: 'bg-violet-100 text-violet-700',
    damage: 'bg-rose-100 text-rose-700',
    late: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors[type] || 'bg-slate-100 text-slate-600'}`}>
      {label}
    </span>
  );
}

/* ========== Empty State ========== */
function EmptyState({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
      <div className="text-slate-400 text-sm">{text}</div>
    </div>
  );
}
