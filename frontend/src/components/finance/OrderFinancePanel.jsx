/* eslint-disable */
import React, { useState } from 'react';
import { financeApi } from '../../services/financeApi.js';
import DocumentsPanel, { DocumentQuickActions } from './DocumentsPanel';

const cls = (...a) => a.filter(Boolean).join(' ');
const money = (v, cur = '₴') => `${cur} ${(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })}`;

const Pill = ({ t = 'neutral', children }) => {
  const tones = { ok: 'bg-emerald-50 text-emerald-800 border-emerald-200', warn: 'bg-amber-50 text-amber-800 border-amber-200', info: 'bg-sky-50 text-sky-800 border-sky-200', neutral: 'bg-slate-50 text-slate-800 border-slate-200' };
  return <span className={cls('inline-flex items-center rounded-full border px-2 py-0.5 text-xs', tones[t] || tones.neutral)}>{children}</span>;
};

const Btn = ({ variant = 'outline', className = '', children, ...props }) => {
  const base = 'inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm transition disabled:opacity-50';
  const v = variant === 'primary' ? 'bg-lime-600 text-white hover:bg-lime-700' : 'border bg-white hover:bg-slate-50';
  return <button className={cls(base, v, className)} {...props}>{children}</button>;
};

const Card = ({ className, children }) => <div className={cls('rounded-2xl border bg-white shadow-sm', className)}>{children}</div>;
const CardHd = ({ title, subtitle, right }) => (
  <div className="flex items-start justify-between gap-3 border-b p-4">
    <div><div className="text-sm font-semibold">{title}</div>{subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}</div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);
const CardBd = ({ className, children }) => <div className={cls('p-4', className)}>{children}</div>;

export default function OrderFinancePanel({ order, onUpdate }) {
  const [rentAmount, setRentAmount] = useState(order.rent.due);
  const [rentMethod, setRentMethod] = useState('cash');
  const [depositAmount, setDepositAmount] = useState(Math.max(0, order.deposit.expected - order.deposit.held));
  const [depositMethod, setDepositMethod] = useState('cash');
  const [depositCurrency, setDepositCurrency] = useState('UAH');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [loading, setLoading] = useState(null);

  // Exchange rates (can be fetched from API)
  const RATES = { UAH: 1, USD: 41.5, EUR: 45.2 };
  const currencySymbols = { UAH: '₴', USD: '$', EUR: '€' };

  const holdAvailable = Math.max(0, order.deposit.held - order.deposit.used_for_damage - order.deposit.refunded);
  const uahEquivalent = depositCurrency === 'UAH' ? depositAmount : depositAmount * exchangeRate;

  const handlePayment = async (type) => {
    let amount = type === 'rent' ? rentAmount : type === 'deposit' ? depositAmount : order.damage.due;
    let method = type === 'rent' ? rentMethod : depositMethod;
    if (amount <= 0) return;
    setLoading(type);
    try {
      if (type === 'deposit') {
        // Use currency-aware deposit creation
        const result = await financeApi.createDepositWithCurrency({
          order_id: order.id,
          expected_amount: order.deposit.expected,
          actual_amount: depositAmount,
          currency: depositCurrency,
          exchange_rate: depositCurrency === 'UAH' ? null : exchangeRate,
          method: depositMethod,
          note: depositCurrency !== 'UAH' ? `${depositAmount} ${depositCurrency} @ ${exchangeRate}` : null
        });
        if (result.data && result.data.success) onUpdate?.();
      } else {
        const result = await financeApi.createPayment({ payment_type: type, method, amount, order_id: order.id });
        if (result.data && result.data.success) onUpdate?.();
      }
    } finally {
      setLoading(null);
    }
  };

  const handleCurrencyChange = (cur) => {
    setDepositCurrency(cur);
    setExchangeRate(RATES[cur] || 1);
  };

  return (
    <div className="mt-3 grid grid-cols-12 gap-3">
      {/* Quick stats */}
      <div className="col-span-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardBd><div className="text-xs text-slate-500">Нараховано</div><div className="mt-1 text-xl font-semibold">{money(order.rent.accrued)}</div></CardBd></Card>
          <Card><CardBd><div className="text-xs text-slate-500">Оплачено</div><div className="mt-1 text-xl font-semibold">{money(order.rent.paid)}</div></CardBd></Card>
          <Card><CardBd><div className="text-xs text-slate-500">Очікувана застава</div><div className="mt-1 text-xl font-semibold">{money(order.deposit.expected)}</div><div className="mt-1 text-xs text-slate-500">(не дохід)</div></CardBd></Card>
          <Card><CardBd><div className="text-xs text-slate-500">Фактична застава</div><div className="mt-1 text-xl font-semibold">{money(order.deposit.held)}</div></CardBd></Card>
          <Card><CardBd><div className="text-xs text-slate-500">До сплати</div><div className="mt-1 text-xl font-semibold text-rose-700">{money(order.rent.due + order.damage.due)}</div></CardBd></Card>
        </div>
      </div>

      {/* Left: Rent + Damage */}
      <div className="col-span-12 md:col-span-7 space-y-3">
        <Card>
          <CardHd title="Прийом оплати (оренда)" subtitle="CASH/BANK → RENT_REV" right={<Pill t="info">rent</Pill>} />
          <CardBd>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm"><div className="text-xs text-slate-500 mb-1">Метод</div>
                <select className="w-full rounded-xl border px-3 py-2 text-sm" value={rentMethod} onChange={(e) => setRentMethod(e.target.value)}>
                  <option value="cash">Готівка</option><option value="card">Карта</option><option value="iban">IBAN</option>
                </select>
              </label>
              <label className="text-sm"><div className="text-xs text-slate-500 mb-1">Сума</div>
                <input type="number" className="w-full rounded-xl border px-3 py-2 text-sm" value={rentAmount} onChange={(e) => setRentAmount(Number(e.target.value))} />
              </label>
              <label className="text-sm"><div className="text-xs text-slate-500 mb-1">Примітка</div>
                <input className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Напр., WayForPay" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn variant="primary" onClick={() => handlePayment('rent')} disabled={loading === 'rent' || rentAmount <= 0}>{loading === 'rent' ? '...' : 'Зарахувати'}</Btn>
              <DocumentQuickActions orderId={order.id} onGenerated={onUpdate} />
            </div>
          </CardBd>
        </Card>

        <Card>
          <CardHd title="Пошкодження" subtitle="CASH/BANK → DMG_COMP" right={<Pill t={order.damage.due > 0 ? 'warn' : 'neutral'}>damage</Pill>} />
          <CardBd>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm"><div className="text-xs text-slate-500 mb-1">Оцінка збитків</div>
                <input type="number" className="w-full rounded-xl border px-3 py-2 text-sm" defaultValue={order.damage.assessed} />
              </label>
              <div className="rounded-2xl border bg-slate-50 p-3">
                <div className="text-xs text-slate-500">До сплати (шкода)</div>
                <div className="mt-1 text-lg font-semibold">{money(order.damage.due)}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn>Нарахувати</Btn>
              <Btn variant="primary" onClick={() => handlePayment('damage')} disabled={loading === 'damage' || order.damage.due <= 0}>{loading === 'damage' ? '...' : 'Прийняти оплату'}</Btn>
            </div>
          </CardBd>
        </Card>
      </div>

      {/* Right: Deposit */}
      <div className="col-span-12 md:col-span-5 space-y-3">
        <Card>
          <CardHd title="Прийом застави" subtitle="CASH/BANK → DEP_HOLD" right={<Pill t="info">hold</Pill>} />
          <CardBd>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm"><div className="text-xs text-slate-500 mb-1">Метод</div>
                <select className="w-full rounded-xl border px-3 py-2 text-sm" value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)}>
                  <option value="cash">Готівка</option><option value="card">Карта</option>
                </select>
              </label>
              <label className="text-sm"><div className="text-xs text-slate-500 mb-1">Сума</div>
                <input type="number" className="w-full rounded-xl border px-3 py-2 text-sm" value={depositAmount} onChange={(e) => setDepositAmount(Number(e.target.value))} />
              </label>
            </div>
            <div className="mt-3"><Btn variant="primary" onClick={() => handlePayment('deposit')} disabled={loading === 'deposit' || depositAmount <= 0}>{loading === 'deposit' ? '...' : 'Прийняти'}</Btn></div>
          </CardBd>
        </Card>

        <Card>
          <CardHd title="Операції із заставою" />
          <CardBd>
            <div className="rounded-2xl border bg-slate-50 p-3 mb-3">
              <div className="flex items-center justify-between"><div className="text-sm font-medium">Баланс холду</div><div className="text-sm font-semibold">{money(holdAvailable)}</div></div>
              <div className="mt-1 text-xs text-slate-500">Використано: {money(order.deposit.used_for_damage)} • Повернуто: {money(order.deposit.refunded)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Btn disabled={holdAvailable <= 0 || order.damage.due <= 0}>На шкоду</Btn>
              <Btn disabled={holdAvailable <= 0}>Повернути</Btn>
            </div>
          </CardBd>
        </Card>

        <DocumentsPanel orderId={order.id} compact />
      </div>

      {/* Full documents */}
      <div className="col-span-12"><DocumentsPanel orderId={order.id} /></div>

      {/* Journal */}
      <div className="col-span-12">
        <Card>
          <CardHd title="Журнал по замовленню" />
          <CardBd className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr><th className="px-4 py-3 text-left">Дата</th><th className="px-4 py-3 text-left">Тип</th><th className="px-4 py-3 text-left">Назва</th><th className="px-4 py-3 text-right">Сума</th></tr>
                </thead>
                <tbody>
                  {order.timeline.map((r, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-4 py-3">{r.at}</td>
                      <td className="px-4 py-3"><Pill t="neutral">{r.type}</Pill></td>
                      <td className="px-4 py-3">{r.label}</td>
                      <td className="px-4 py-3 text-right">{money(r.debit || r.credit)}</td>
                    </tr>
                  ))}
                  {!order.timeline.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Немає записів</td></tr>}
                </tbody>
              </table>
            </div>
          </CardBd>
        </Card>
      </div>
    </div>
  );
}
