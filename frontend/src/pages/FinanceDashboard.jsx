/* eslint-disable */
/**
 * FinanceDashboard - Фінансова аналітика RentalHub
 * Tabs: Overview, Orders, Products, Clients, Damage
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CorporateHeader from '../components/CorporateHeader';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helpers
const cls = (...a) => a.filter(Boolean).join(' ');
const money = (v, cur = '₴') => `${cur} ${(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })}`;
const pct = (v) => `${(v || 0).toFixed(1)}%`;

// Design tokens
const tone = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  neutral: 'bg-slate-50 text-slate-700 border-slate-200',
};

// Components
const Pill = ({ t = 'neutral', children, className }) => (
  <span className={cls('inline-flex items-center rounded-full border px-2 py-0.5 text-xs', tone[t], className)}>
    {children}
  </span>
);

const Card = ({ className, children }) => (
  <div className={cls('rounded-2xl border bg-white shadow-sm', className)}>{children}</div>
);

const StatCard = ({ title, value, sub, icon, trend, toneKey = 'neutral' }) => (
  <Card>
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {icon && <span>{icon}</span>}
            {title}
          </div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
        {trend !== undefined && (
          <Pill t={trend >= 0 ? 'ok' : 'danger'}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </Pill>
        )}
      </div>
    </div>
  </Card>
);

// Period selector
function PeriodSelector({ period, setPeriod }) {
  const periods = [
    { id: '7d', label: '7 днів' },
    { id: '30d', label: '30 днів' },
    { id: 'month', label: 'Цей місяць' },
    { id: 'prev_month', label: 'Минулий місяць' },
    { id: 'quarter', label: 'Квартал' },
    { id: 'year', label: 'Рік' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {periods.map((p) => (
        <button
          key={p.id}
          onClick={() => setPeriod(p.id)}
          className={cls(
            'rounded-lg px-3 py-1.5 text-sm transition',
            period === p.id
              ? 'bg-corp-primary text-white'
              : 'border bg-white hover:bg-slate-50 text-slate-700'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// Tabs
function TabBar({ tab, setTab }) {
  const tabs = [
    { id: 'overview', label: 'Огляд', icon: '📊' },
    { id: 'orders', label: 'Замовлення', icon: '📦' },
    { id: 'products', label: 'Товари', icon: '🏷️' },
    { id: 'clients', label: 'Клієнти', icon: '👥' },
    { id: 'damage', label: 'Пошкодження', icon: '⚠️' },
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
                'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
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

// Simple bar chart
function BarChart({ data, xKey, yKey, yKey2, height = 200, colors = ['#3b82f6', '#f59e0b'] }) {
  if (!data || data.length === 0) return <div className="text-center text-slate-400 py-8">Немає даних</div>;
  
  const maxVal = Math.max(...data.map(d => Math.max(d[yKey] || 0, d[yKey2] || 0)));
  
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => {
        const h1 = maxVal > 0 ? ((d[yKey] || 0) / maxVal) * height : 0;
        const h2 = yKey2 && maxVal > 0 ? ((d[yKey2] || 0) / maxVal) * height : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div className="flex items-end gap-0.5 w-full justify-center">
              <div 
                className="w-3 rounded-t transition-all hover:opacity-80" 
                style={{ height: h1, backgroundColor: colors[0] }}
                title={`${yKey}: ${money(d[yKey])}`}
              />
              {yKey2 && (
                <div 
                  className="w-3 rounded-t transition-all hover:opacity-80" 
                  style={{ height: h2, backgroundColor: colors[1] }}
                  title={`${yKey2}: ${money(d[yKey2])}`}
                />
              )}
            </div>
            <span className="text-[9px] text-slate-400 truncate max-w-full">
              {d[xKey]?.slice(-5)}
            </span>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
              <div className="bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                {d[xKey]}: {money(d[yKey])}
                {yKey2 && <> / {money(d[yKey2])}</>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Export button
function ExportButton({ reportType, period }) {
  const handleExport = async (format) => {
    const url = `${BACKEND_URL}/api/analytics/export/${reportType}?period=${period}&format=${format}`;
    
    if (format === 'csv') {
      window.open(url, '_blank');
    } else {
      const res = await fetch(url);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${reportType}_${period}.json`;
      link.click();
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleExport('csv')}
        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-1"
      >
        📥 CSV
      </button>
      <button
        onClick={() => handleExport('json')}
        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-1"
      >
        📄 JSON
      </button>
    </div>
  );
}

// ==================== TAB PANELS ====================

// Overview Tab
function OverviewPanel({ data, loading }) {
  if (loading) return <div className="text-center py-12 text-slate-500">Завантаження...</div>;
  if (!data) return null;

  const { kpi, orders_by_status, daily_chart } = data;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon="💰"
          title="Загальний дохід"
          value={money(kpi.total_revenue)}
          sub={`Оренда: ${money(kpi.rent_revenue)} + Шкоди: ${money(kpi.damage_revenue)}`}
        />
        <StatCard
          icon="📦"
          title="Замовлень"
          value={kpi.total_orders}
          sub={`Виконано: ${kpi.completed_orders}`}
        />
        <StatCard
          icon="🧾"
          title="Середній чек (оренда)"
          value={money(kpi.avg_rent_check)}
        />
        <StatCard
          icon="⚠️"
          title="% пошкоджень"
          value={pct(kpi.damage_percent)}
          toneKey={kpi.damage_percent > 10 ? 'danger' : 'ok'}
          sub={kpi.damage_percent > 10 ? '⚠️ Критично високий!' : '✓ В нормі'}
        />
      </div>

      {/* Chart */}
      <Card>
        <div className="p-4 border-b">
          <div className="font-semibold">Динаміка доходів</div>
          <div className="text-xs text-slate-500">Оренда (синій) та Шкоди (жовтий) по днях</div>
        </div>
        <div className="p-4">
          <BarChart data={daily_chart} xKey="day" yKey="rent" yKey2="damage" height={180} />
        </div>
        <div className="px-4 pb-4 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500"></span> Оренда</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500"></span> Пошкодження</span>
        </div>
      </Card>

      {/* Orders by status */}
      <Card>
        <div className="p-4 border-b">
          <div className="font-semibold">Замовлення по статусах</div>
        </div>
        <div className="p-4 flex flex-wrap gap-3">
          {Object.entries(orders_by_status || {}).map(([status, count]) => (
            <div key={status} className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <span className="text-xs text-slate-500">{status}:</span>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Orders Tab
function OrdersPanel({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState('day');

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/analytics/orders?period=${period}&group_by=${groupBy}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [period, groupBy]);

  if (loading) return <div className="text-center py-12 text-slate-500">Завантаження...</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['day', 'week', 'month'].map(g => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={cls(
                'rounded-lg px-3 py-1.5 text-sm',
                groupBy === g ? 'bg-slate-900 text-white' : 'border hover:bg-slate-50'
              )}
            >
              По {g === 'day' ? 'днях' : g === 'week' ? 'тижнях' : 'місяцях'}
            </button>
          ))}
        </div>
        <ExportButton reportType="orders" period={period} />
      </div>

      {/* Totals */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon="📦" title="Всього замовлень" value={data.totals?.orders || 0} />
        <StatCard icon="💰" title="Виручка (оренда)" value={money(data.totals?.rent_revenue || 0)} />
        <StatCard icon="🧾" title="Середній чек" value={money(data.totals?.avg_check || 0)} />
        <StatCard icon="✅" title="Закрито" value={data.totals?.by_status?.closed || 0} />
      </div>

      {/* Chart */}
      <Card>
        <div className="p-4 border-b font-semibold">Виручка по періодах</div>
        <div className="p-4">
          <BarChart data={data.data} xKey="period" yKey="rent_revenue" height={180} />
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="p-4 border-b font-semibold">Деталізація</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-3">Період</th>
                <th className="text-right p-3">Замовлень</th>
                <th className="text-right p-3">Виручка</th>
                <th className="text-right p-3">Сер. чек</th>
              </tr>
            </thead>
            <tbody>
              {(data.data || []).map((row, i) => (
                <tr key={i} className="border-t hover:bg-slate-50">
                  <td className="p-3">{row.period}</td>
                  <td className="p-3 text-right">{row.orders_count}</td>
                  <td className="p-3 text-right font-medium">{money(row.rent_revenue)}</td>
                  <td className="p-3 text-right text-slate-500">{money(row.avg_check)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// Products Tab
function ProductsPanel({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('revenue');

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/analytics/products?period=${period}&sort_by=${sortBy}&limit=20`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [period, sortBy]);

  if (loading) return <div className="text-center py-12 text-slate-500">Завантаження...</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[
            { id: 'revenue', label: 'По виручці' },
            { id: 'rentals', label: 'По орендах' },
            { id: 'roi', label: 'По ROI' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setSortBy(s.id)}
              className={cls(
                'rounded-lg px-3 py-1.5 text-sm',
                sortBy === s.id ? 'bg-slate-900 text-white' : 'border hover:bg-slate-50'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <ExportButton reportType="products" period={period} />
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon="💰" title="Загальна виручка" value={money(data.summary?.total_rent_revenue || 0)} />
        <StatCard icon="⚠️" title="Збитки (damage)" value={money(data.summary?.total_damage_cost || 0)} />
        <StatCard icon="📈" title="Середній ROI" value={`${data.summary?.avg_roi || 0}%`} />
      </div>

      {/* Top products */}
      <Card>
        <div className="p-4 border-b font-semibold">🏆 Топ-20 товарів</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-3">Товар</th>
                <th className="text-right p-3">Оренд</th>
                <th className="text-right p-3">Виручка</th>
                <th className="text-right p-3">Збитки</th>
                <th className="text-right p-3">Прибуток</th>
                <th className="text-right p-3">ROI</th>
              </tr>
            </thead>
            <tbody>
              {data.top_products.map((p, i) => (
                <tr key={i} className="border-t hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.sku}</div>
                  </td>
                  <td className="p-3 text-right">{p.rental_count}</td>
                  <td className="p-3 text-right text-emerald-600 font-medium">{money(p.rent_revenue)}</td>
                  <td className="p-3 text-right text-rose-600">{money(p.damage_cost)}</td>
                  <td className="p-3 text-right font-medium">{money(p.profit)}</td>
                  <td className="p-3 text-right">
                    <Pill t={p.roi > 50 ? 'ok' : p.roi > 0 ? 'warn' : 'danger'}>
                      {p.roi}%
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Idle products */}
      {data.idle_products.length > 0 && (
        <Card>
          <div className="p-4 border-b font-semibold">😴 Простоюючі товари</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left p-3">Товар</th>
                  <th className="text-right p-3">Остання оренда</th>
                  <th className="text-right p-3">Простій (днів)</th>
                </tr>
              </thead>
              <tbody>
                {data.idle_products.slice(0, 10).map((p, i) => (
                  <tr key={i} className="border-t hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-slate-400">{p.sku}</div>
                    </td>
                    <td className="p-3 text-right text-slate-500">{p.last_rented}</td>
                    <td className="p-3 text-right">
                      <Pill t={p.days_idle > 90 ? 'danger' : p.days_idle > 30 ? 'warn' : 'neutral'}>
                        {p.days_idle} днів
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// Clients Tab
function ClientsPanel({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/analytics/clients?period=${period}&limit=20`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <div className="text-center py-12 text-slate-500">Завантаження...</div>;
  if (!data) return null;

  const { client_analysis } = data;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportButton reportType="clients" period={period} />
      </div>

      {/* Client analysis */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon="👥" title="Всього клієнтів" value={data.summary?.total_clients || 0} />
        <StatCard 
          icon="🆕" 
          title="Нових клієнтів" 
          value={client_analysis.new_clients}
          sub={`Сер. чек: ${money(client_analysis.new_avg_check)}`}
        />
        <StatCard 
          icon="🔄" 
          title="Повторних" 
          value={client_analysis.returning_clients}
          sub={`Сер. чек: ${money(client_analysis.returning_avg_check)}`}
        />
        <StatCard 
          icon="📊" 
          title="% повторних"
          value={pct(client_analysis.returning_percent)}
          toneKey={client_analysis.returning_percent > 30 ? 'ok' : 'warn'}
        />
      </div>

      {/* Top clients */}
      <Card>
        <div className="p-4 border-b font-semibold">🏆 Топ клієнтів</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-3">Клієнт</th>
                <th className="text-right p-3">Замовлень</th>
                <th className="text-right p-3">Оренда</th>
                <th className="text-right p-3">Шкоди</th>
                <th className="text-right p-3">Всього</th>
              </tr>
            </thead>
            <tbody>
              {data.top_clients.map((c, i) => (
                <tr key={i} className="border-t hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-slate-400">{c.phone}</div>
                  </td>
                  <td className="p-3 text-right">{c.orders_count}</td>
                  <td className="p-3 text-right text-emerald-600">{money(c.rent_spent)}</td>
                  <td className="p-3 text-right text-rose-600">{c.damage_spent > 0 ? money(c.damage_spent) : '—'}</td>
                  <td className="p-3 text-right font-semibold">{money(c.total_spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// Damage Tab
function DamagePanel({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/analytics/damage?period=${period}&limit=20`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <div className="text-center py-12 text-slate-500">Завантаження...</div>;
  if (!data) return null;

  const { kpi } = data;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportButton reportType="damage" period={period} />
      </div>

      {/* Critical alert */}
      {kpi.is_critical && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4">
          <div className="flex items-center gap-2 text-rose-800 font-semibold">
            🚨 КРИТИЧНИЙ РІВЕНЬ ПОШКОДЖЕНЬ
          </div>
          <div className="text-sm text-rose-700 mt-1">
            Шкоди складають {pct(kpi.damage_percent)} від доходу з оренди. Рекомендуємо переглянути застави або асортимент.
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard 
          icon="💸" 
          title="Загальна сума шкод" 
          value={money(kpi.total_damage)}
          toneKey={kpi.is_critical ? 'danger' : 'neutral'}
        />
        <StatCard 
          icon="📊" 
          title="% від оренди" 
          value={pct(kpi.damage_percent)}
          toneKey={kpi.damage_percent > 10 ? 'danger' : kpi.damage_percent > 5 ? 'warn' : 'ok'}
        />
        <StatCard icon="📦" title="Товарів пошкоджено" value={kpi.products_damaged} />
        <StatCard icon="🧾" title="Замовлень зі шкодами" value={kpi.orders_affected} />
      </div>

      {/* Chart */}
      <Card>
        <div className="p-4 border-b font-semibold">Динаміка пошкоджень</div>
        <div className="p-4">
          <BarChart data={data.daily_trend} xKey="day" yKey="total" height={160} colors={['#ef4444']} />
        </div>
      </Card>

      {/* By type */}
      <Card>
        <div className="p-4 border-b font-semibold">По типах пошкоджень</div>
        <div className="p-4 flex flex-wrap gap-3">
          {data.by_type.map((t, i) => (
            <div key={i} className="rounded-xl border px-4 py-2">
              <div className="text-sm font-medium">{t.type}</div>
              <div className="text-xs text-slate-500">{t.count} випадків • {money(t.total)}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Damaged products */}
      <Card>
        <div className="p-4 border-b font-semibold">⚠️ Товари з найбільшими збитками</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-3">Товар</th>
                <th className="text-right p-3">Випадків</th>
                <th className="text-right p-3">Сума шкод</th>
                <th className="text-right p-3">Виручка</th>
                <th className="text-right p-3">% шкод</th>
              </tr>
            </thead>
            <tbody>
              {data.damaged_products.map((p, i) => (
                <tr key={i} className="border-t hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.sku}</div>
                  </td>
                  <td className="p-3 text-right">{p.damage_count}</td>
                  <td className="p-3 text-right text-rose-600 font-medium">{money(p.total_fee)}</td>
                  <td className="p-3 text-right text-slate-500">{money(p.revenue)}</td>
                  <td className="p-3 text-right">
                    <Pill t={p.damage_ratio > 50 ? 'danger' : p.damage_ratio > 20 ? 'warn' : 'ok'}>
                      {p.damage_ratio}%
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState('month');
  const [overviewData, setOverviewData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab === 'overview') {
      setLoading(true);
      fetch(`${BACKEND_URL}/api/analytics/overview?period=${period}`)
        .then(r => r.json())
        .then(setOverviewData)
        .finally(() => setLoading(false));
    }
  }, [period, tab]);

  return (
    <div className="min-h-screen bg-corp-gray">
      <CorporateHeader />
      
      {/* Page header */}
      <div className="bg-white border-b border-corp-border">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">📊 Фінансова аналітика</h1>
              <p className="text-sm text-slate-500">Звіти по доходах, товарах, клієнтах та пошкодженнях</p>
            </div>
            <PeriodSelector period={period} setPeriod={setPeriod} />
          </div>
        </div>
      </div>

      <TabBar tab={tab} setTab={setTab} />

      <main className="mx-auto max-w-7xl px-6 py-6">
        {tab === 'overview' && <OverviewPanel data={overviewData} loading={loading} />}
        {tab === 'orders' && <OrdersPanel period={period} />}
        {tab === 'products' && <ProductsPanel period={period} />}
        {tab === 'clients' && <ClientsPanel period={period} />}
        {tab === 'damage' && <DamagePanel period={period} />}
      </main>
    </div>
  );
}
