/* eslint-disable */
/**
 * OrderFinancePanel - Фінансова панель замовлення
 * Оплати оренди, шкоди, застави + документи
 */
import React, { useState, useEffect } from 'react';
import { financeApi } from '../../services/financeApi';
import DocumentsPanel, { DocumentQuickActions } from './DocumentsPanel';

interface Order {
  id: number;
  order_number?: string;
  client: string;
  status: string;
  rent: {
    accrued: number;
    paid: number;
    due: number;
  };
  deposit: {
    expected: number;
    held: number;
    used_for_damage: number;
    refunded: number;
  };
  damage: {
    assessed: number;
    paid: number;
    due: number;
  };
  timeline: any[];
}

interface OrderFinancePanelProps {
  order: Order;
  onUpdate?: () => void;
}

// UI Components
const cls = (...a: (string | boolean | undefined)[]) => a.filter(Boolean).join(' ');
const money = (v: number, cur = '₴') => `${cur} ${(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })}`;

const Pill = ({ t = 'neutral', children }: { t?: string; children: React.ReactNode }) => {
  const tones: Record<string, string> = {
    ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warn: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
    info: 'bg-sky-50 text-sky-800 border-sky-200',
    neutral: 'bg-slate-50 text-slate-800 border-slate-200',
  };
  return (
    <span className={cls('inline-flex items-center rounded-full border px-2 py-0.5 text-xs', tones[t] || tones.neutral)}>
      {children}
    </span>
  );
};

const Btn = ({ variant = 'outline', className = '', children, ...props }: any) => {
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

const Card = ({ className = '', children }: { className?: string; children: React.ReactNode }) => (
  <div className={cls('rounded-2xl border bg-white shadow-sm', className)}>{children}</div>
);

const CardHd = ({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 border-b p-4">
    <div className="min-w-0">
      <div className="text-sm font-semibold">{title}</div>
      {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);

const CardBd = ({ className = '', children }: { className?: string; children: React.ReactNode }) => (
  <div className={cls('p-4', className)}>{children}</div>
);

export default function OrderFinancePanel({ order, onUpdate }: OrderFinancePanelProps) {
  const [rentAmount, setRentAmount] = useState(order.rent.due);
  const [rentMethod, setRentMethod] = useState('cash');
  const [depositAmount, setDepositAmount] = useState(Math.max(0, order.deposit.expected - order.deposit.held));
  const [depositMethod, setDepositMethod] = useState('cash');
  const [damageAmount, setDamageAmount] = useState(order.damage.assessed || 0);
  const [loading, setLoading] = useState<string | null>(null);

  const holdAvailable = Math.max(0, order.deposit.held - order.deposit.used_for_damage - order.deposit.refunded);

  const handlePayment = async (type: 'rent' | 'deposit' | 'damage') => {
    let amount = 0;
    let method = 'cash';
    
    if (type === 'rent') {
      amount = rentAmount;
      method = rentMethod;
    } else if (type === 'deposit') {
      amount = depositAmount;
      method = depositMethod;
    } else if (type === 'damage') {
      amount = order.damage.due;
      method = 'cash';
    }

    if (amount <= 0) return;

    setLoading(type);
    try {
      const result = await financeApi.createPayment({
        payment_type: type,
        method,
        amount,
        order_id: order.id,
      });
      
      if (result.data?.success) {
        onUpdate?.();
      }
    } catch (err) {
      console.error('Payment error:', err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mt-3 grid grid-cols-12 gap-3">
      {/* Quick stats */}
      <div className="col-span-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardBd>
              <div className="text-xs text-slate-500">Нараховано (оренда)</div>
              <div className="mt-1 text-xl font-semibold">{money(order.rent.accrued)}</div>
            </CardBd>
          </Card>
          <Card>
            <CardBd>
              <div className="text-xs text-slate-500">Оплачено (оренда)</div>
              <div className="mt-1 text-xl font-semibold">{money(order.rent.paid)}</div>
            </CardBd>
          </Card>
          <Card>
            <CardBd>
              <div className="text-xs text-slate-500">Очікувана застава</div>
              <div className="mt-1 text-xl font-semibold">{money(order.deposit.expected)}</div>
              <div className="mt-1 text-xs text-slate-500">(не дохід)</div>
            </CardBd>
          </Card>
          <Card>
            <CardBd>
              <div className="text-xs text-slate-500">Фактична застава</div>
              <div className="mt-1 text-xl font-semibold">{money(order.deposit.held)}</div>
              <div className="mt-1 text-xs text-slate-500">у холді</div>
            </CardBd>
          </Card>
          <Card>
            <CardBd>
              <div className="text-xs text-slate-500">До сплати зараз</div>
              <div className="mt-1 text-xl font-semibold text-rose-700">{money(order.rent.due + order.damage.due)}</div>
            </CardBd>
          </Card>
        </div>
      </div>

      {/* Left column: Rent + Damage */}
      <div className="col-span-12 md:col-span-7 space-y-3">
        {/* Rent payment */}
        <Card>
          <CardHd
            title="Прийом оплати (оренда)"
            subtitle="Окремий платіж, йде в Rent Revenue"
            right={<Pill t="info">rent</Pill>}
          />
          <CardBd>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm">
                <div className="text-xs text-slate-500 mb-1">Метод</div>
                <select
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={rentMethod}
                  onChange={(e) => setRentMethod(e.target.value)}
                >
                  <option value="cash">Готівка</option>
                  <option value="card">Карта</option>
                  <option value="iban">IBAN</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="text-xs text-slate-500 mb-1">Сума</div>
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={rentAmount}
                  onChange={(e) => setRentAmount(Number(e.target.value))}
                />
              </label>
              <label className="text-sm">
                <div className="text-xs text-slate-500 mb-1">Примітка</div>
                <input className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Напр., WayForPay" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn
                variant="primary"
                onClick={() => handlePayment('rent')}
                disabled={loading === 'rent' || rentAmount <= 0}
              >
                {loading === 'rent' ? '...' : 'Зарахувати оплату'}
              </Btn>
              <DocumentQuickActions orderId={order.id} onGenerated={onUpdate} />
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Проводка: <b>CASH/BANK → RENT_REV</b>. Застава не зачіпається.
            </div>
          </CardBd>
        </Card>

        {/* Damage */}
        <Card>
          <CardHd
            title="Пошкодження (окремий бюджет)"
            subtitle="Оцінка/нарахування збитків та оплата"
            right={<Pill t={order.damage.due > 0 ? 'warn' : 'neutral'}>damage</Pill>}
          />
          <CardBd>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm">
                <div className="text-xs text-slate-500 mb-1">Нарахувати збитки</div>
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={damageAmount}
                  onChange={(e) => setDamageAmount(Number(e.target.value))}
                />
              </label>
              <label className="text-sm">
                <div className="text-xs text-slate-500 mb-1">Оплата шкоди</div>
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={order.damage.due}
                  readOnly
                />
              </label>
              <div className="rounded-2xl border bg-slate-50 p-3">
                <div className="text-xs text-slate-500">До сплати (шкода)</div>
                <div className="mt-1 text-lg font-semibold">{money(order.damage.due)}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn>Нарахувати</Btn>
              <Btn
                variant="primary"
                onClick={() => handlePayment('damage')}
                disabled={loading === 'damage' || order.damage.due <= 0}
              >
                {loading === 'damage' ? '...' : 'Прийняти оплату'}
              </Btn>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Проводка: <b>CASH/BANK → DMG_COMP</b>. Утримання із застави — окрема дія.
            </div>
          </CardBd>
        </Card>
      </div>

      {/* Right column: Deposit + Quick docs */}
      <div className="col-span-12 md:col-span-5 space-y-3">
        {/* Deposit receive */}
        <Card>
          <CardHd title="Прийом застави" subtitle="Застава йде в hold (не дохід)" right={<Pill t="info">hold</Pill>} />
          <CardBd>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm">
                <div className="text-xs text-slate-500 mb-1">Метод</div>
                <select
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={depositMethod}
                  onChange={(e) => setDepositMethod(e.target.value)}
                >
                  <option value="cash">Готівка</option>
                  <option value="card">Карта</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="text-xs text-slate-500 mb-1">Сума</div>
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn
                variant="primary"
                onClick={() => handlePayment('deposit')}
                disabled={loading === 'deposit' || depositAmount <= 0}
              >
                {loading === 'deposit' ? '...' : 'Прийняти заставу'}
              </Btn>
            </div>
            <div className="mt-2 text-xs text-slate-500">Проводка: <b>CASH/BANK → DEP_HOLD</b>.</div>
          </CardBd>
        </Card>

        {/* Deposit operations */}
        <Card>
          <CardHd title="Операції із заставою" subtitle="Утримати/повернути з холду" />
          <CardBd>
            <div className="rounded-2xl border bg-slate-50 p-3 mb-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Баланс холду</div>
                <div className="text-sm font-semibold">{money(holdAvailable)}</div>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Використано: {money(order.deposit.used_for_damage)} • Повернуто: {money(order.deposit.refunded)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Btn disabled={holdAvailable <= 0 || order.damage.due <= 0}>
                Списати на шкоду
              </Btn>
              <Btn disabled={holdAvailable <= 0}>
                Повернути заставу
              </Btn>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Списання: <b>DEP_HOLD → DMG_COMP</b>. Повернення: <b>DEP_HOLD → CASH/BANK</b>.
            </div>
          </CardBd>
        </Card>

        {/* Documents compact */}
        <DocumentsPanel orderId={order.id} compact />
      </div>

      {/* Full documents panel */}
      <div className="col-span-12">
        <DocumentsPanel orderId={order.id} />
      </div>

      {/* Order timeline/journal */}
      <div className="col-span-12">
        <Card>
          <CardHd title="Журнал по замовленню" subtitle="Лог фінансових подій" />
          <CardBd className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Дата</th>
                    <th className="px-4 py-3 text-left font-medium">Тип</th>
                    <th className="px-4 py-3 text-left font-medium">Назва</th>
                    <th className="px-4 py-3 text-right font-medium">Дебет</th>
                    <th className="px-4 py-3 text-right font-medium">Кредит</th>
                  </tr>
                </thead>
                <tbody>
                  {order.timeline.map((r, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-4 py-3 whitespace-nowrap">{r.at}</td>
                      <td className="px-4 py-3"><Pill t="neutral">{r.type}</Pill></td>
                      <td className="px-4 py-3">{r.label}</td>
                      <td className="px-4 py-3 text-right">{r.debit ? money(r.debit) : '—'}</td>
                      <td className="px-4 py-3 text-right">{r.credit ? money(r.credit) : '—'}</td>
                    </tr>
                  ))}
                  {order.timeline.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">Поки немає записів</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBd>
        </Card>
      </div>
    </div>
  );
}
