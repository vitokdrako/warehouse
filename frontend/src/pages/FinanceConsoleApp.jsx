/* eslint-disable */
/**
 * FinanceConsole — Уніфікована фінансова консоль
 * Tabs:
 *   1. Ордери (CashDesk) — список + детальна панель
 *   2. Облік (Ledger) — журнал проводок
 *   3. Витрати (Expenses) — templates → due → post, one-off, payroll
 */
import React, { useEffect, useMemo, useState } from "react";
import CorporateHeader from "../components/CorporateHeader";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

// ----------------------------- helpers -----------------------------
const cls = (...a) => a.filter(Boolean).join(" ");

const money = (v, currency = "₴") => {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return `${currency} ${n.toLocaleString("uk-UA")}`;
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("uk-UA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  return res;
};

// ----------------------------- UI Components -----------------------------
const Badge = ({ tone = "neutral", children }) => {
  const map = {
    ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warn: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-rose-50 text-rose-800 border-rose-200",
    info: "bg-sky-50 text-sky-800 border-sky-200",
    neutral: "bg-slate-50 text-slate-800 border-slate-200",
    ink: "bg-slate-900 text-white border-slate-900",
  };
  return (
    <span className={cls("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", map[tone] || map.neutral)}>
      {children}
    </span>
  );
};

const Pill = ({ icon, label, tone = "neutral" }) => (
  <Badge tone={tone}>
    {icon ? <span className="text-[11px] opacity-80">{icon}</span> : null}
    <span>{label}</span>
  </Badge>
);

const PrimaryBtn = ({ onClick, children, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cls(
      "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition",
      disabled ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-corp-primary text-white hover:bg-corp-primary-dark"
    )}
  >
    {children}
  </button>
);

const GhostBtn = ({ onClick, children, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cls(
      "inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition",
      disabled ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
    )}
  >
    {children}
  </button>
);

const Card = ({ title, subtitle, right, children, className }) => (
  <div className={cls("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
    {(title || right) && (
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div>
          {title && <div className="text-sm font-semibold text-slate-900">{title}</div>}
          {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    )}
    <div className="px-5 py-4">{children}</div>
  </div>
);

const Stat = ({ label, value, sub }) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
  </div>
);

const TabBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={cls(
      "rounded-xl px-4 py-2.5 text-sm font-semibold transition",
      active ? "bg-corp-primary text-white shadow-sm" : "bg-white text-slate-700 hover:bg-slate-50"
    )}
  >
    {children}
  </button>
);

const Shell = ({ left, right }) => (
  <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
    <div className="min-h-[70vh]">{left}</div>
    <div className="min-h-[70vh]">{right}</div>
  </div>
);

// ----------------------------- Orders Tab -----------------------------
const OrderRow = ({ order, selected, onSelect }) => {
  const rentDue = Math.max(0, (order.total_rental || 0) - (order.rent_paid || 0));
  const depositDue = Math.max(0, (order.total_deposit || 0) - (order.deposit_held || 0));
  
  return (
    <button
      onClick={() => onSelect(order.order_id)}
      className={cls(
        "w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition",
        selected ? "border-corp-primary/50 bg-corp-primary/5" : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">#{order.order_number}</div>
          <div className="mt-0.5 text-xs text-slate-600">{order.customer_name}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            Оренда: {money(order.rent_paid || 0)} / {money(order.total_rental || 0)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Pill tone={rentDue > 0 ? "warn" : "ok"} icon={rentDue > 0 ? "⏳" : "✓"} label={rentDue > 0 ? `${money(rentDue)}` : "OK"} />
          <Pill tone={depositDue > 0 ? "info" : "ok"} icon="🔒" label={depositDue > 0 ? `${money(depositDue)}` : "OK"} />
          <Badge tone="neutral">{order.status}</Badge>
        </div>
      </div>
    </button>
  );
};

const OrdersList = ({ orders, selectedId, onSelect, query, setQuery, reload, loading }) => {
  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    if (!q) return orders;
    return orders.filter(o => 
      (o.order_number || "").toLowerCase().includes(q) ||
      (o.customer_name || "").toLowerCase().includes(q) ||
      (o.customer_phone || "").toLowerCase().includes(q)
    );
  }, [orders, query]);

  return (
    <div className="space-y-3">
      <Card title="Ордери" subtitle={`${filtered.length} записів`} right={<GhostBtn onClick={reload}>Оновити</GhostBtn>}>
        <input
          className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-corp-primary/20"
          placeholder="Пошук: код / клієнт / телефон"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Card>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {loading ? (
          <div className="p-4 text-center text-slate-500">Завантаження...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-slate-400">Немає замовлень</div>
        ) : (
          filtered.map((o) => (
            <OrderRow key={o.order_id} order={o} selected={o.order_id === selectedId} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  );
};

const KPIBar = ({ order, deposit }) => {
  const rentDue = Math.max(0, (order.total_rental || 0) - (order.rent_paid || 0));
  const depositHeld = order.deposit_held || 0;
  const totalDue = rentDue + Math.max(0, (order.total_deposit || 0) - depositHeld);
  
  // Format deposit in original currency
  const formatDeposit = () => {
    if (!deposit) return "—";
    const currency = deposit.currency || "UAH";
    const amount = deposit.actual_amount || deposit.held_amount || 0;
    if (currency === "UAH") return money(amount);
    // Show foreign currency as-is
    const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
    return `${symbol}${amount.toLocaleString("uk-UA")}`;
  };
  
  // Sub text showing UAH equivalent if foreign currency
  const depositSub = () => {
    if (!deposit) return null;
    const currency = deposit.currency || "UAH";
    if (currency === "UAH") return "(не дохід)";
    const uahAmount = deposit.held_amount || 0;
    return `≈ ${money(uahAmount)}`;
  };
  
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
      <Stat label="Нараховано" value={money(order.total_rental || 0)} />
      <Stat label="Оплачено" value={money(order.rent_paid || 0)} />
      <Stat label="Очік. застава" value={money(order.total_deposit || 0)} sub="(в ₴)" />
      <Stat label="Факт. застава" value={formatDeposit()} sub={depositSub()} />
      <Stat label="До сплати" value={money(totalDue)} sub={totalDue > 0 ? "є борг" : "✓"} />
    </div>
  );
};

const OrderFinancePanel = ({ order, onRefresh, deposits }) => {
  const rentDue = Math.max(0, (order.total_rental || 0) - (order.rent_paid || 0));
  const depositDue = Math.max(0, (order.total_deposit || 0) - (order.deposit_held || 0));
  
  const [rentAmount, setRentAmount] = useState(rentDue);
  const [rentMethod, setRentMethod] = useState("cash");
  const [depMethod, setDepMethod] = useState("cash");
  const [depCurrency, setDepCurrency] = useState("UAH");
  const [depAmount, setDepAmount] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Damage fees state
  const [damageFees, setDamageFees] = useState([]);
  const [damageAmount, setDamageAmount] = useState("");
  const [damageMethod, setDamageMethod] = useState("cash");
  const [loadingDamage, setLoadingDamage] = useState(false);

  // Find deposit for this order
  const deposit = deposits.find(d => d.order_id === order.order_id);
  
  // Calculate available deposit in ORIGINAL currency
  const depositCurrency = deposit?.currency || "UAH";
  const depositActualAmount = deposit?.actual_amount || 0;
  const depositUsedOriginal = deposit?.used_amount_original || 0;
  const depositRefundedOriginal = deposit?.refunded_amount_original || 0;
  
  const exchangeRate = deposit?.exchange_rate || 1;
  const usedInOriginal = depositUsedOriginal || (exchangeRate > 0 ? (deposit?.used_amount || 0) / exchangeRate : 0);
  const refundedInOriginal = depositRefundedOriginal || (exchangeRate > 0 ? (deposit?.refunded_amount || 0) / exchangeRate : 0);
  
  const availableInOriginal = Math.max(0, depositActualAmount - usedInOriginal - refundedInOriginal);
  const availableDeposit = deposit ? Math.max(0, (deposit.held_amount || 0) - (deposit.used_amount || 0) - (deposit.refunded_amount || 0)) : 0;

  // Calculate damage totals
  const totalDamageFee = damageFees.reduce((sum, d) => sum + (d.fee || 0), 0);
  const damagePaid = damageFees.reduce((sum, d) => sum + (d.paid_amount || 0), 0);
  const damageDue = Math.max(0, totalDamageFee - damagePaid);
  
  // Order financial status
  const isRentPaid = rentDue <= 0;
  const hasDamage = totalDamageFee > 0;
  const isDamagePaid = damageDue <= 0;
  const awaitingAdditionalPayment = isRentPaid && hasDamage && !isDamagePaid;
  const isFullyPaid = isRentPaid && (!hasDamage || isDamagePaid);

  // Format amount in deposit's currency
  const formatDepositAmount = (amount) => {
    if (depositCurrency === "UAH") return money(amount);
    const symbol = depositCurrency === "USD" ? "$" : depositCurrency === "EUR" ? "€" : depositCurrency;
    return `${symbol}${Number(amount || 0).toLocaleString("uk-UA", { maximumFractionDigits: 2 })}`;
  };

  // Load damage fees for this order
  const loadDamageFees = async () => {
    setLoadingDamage(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/analytics/order-damage-fee/${order.order_id}`);
      const data = await res.json();
      // API returns damage_items array with product_name, damage_type, fee
      setDamageFees(data.damage_items || []);
      if (data.due_amount > 0) {
        setDamageAmount(data.due_amount);
      }
    } catch (e) {
      console.error("Error loading damage fees:", e);
      setDamageFees([]);
    }
    setLoadingDamage(false);
  };

  useEffect(() => {
    setRentAmount(rentDue);
    loadDamageFees();
  }, [order.order_id, rentDue]);

  const acceptRent = async () => {
    if (Number(rentAmount) <= 0) return;
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      await authFetch(`${BACKEND_URL}/api/finance/payments`, {
        method: "POST",
        body: JSON.stringify({
          payment_type: "rent",
          method: rentMethod,
          amount: Number(rentAmount),
          order_id: order.order_id,
          accepted_by_id: user.id,
          accepted_by_name: user.email,
        }),
      });
      onRefresh();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const acceptDeposit = async () => {
    if (Number(depAmount) <= 0) return;
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const rate = depCurrency === "USD" ? 41.5 : depCurrency === "EUR" ? 45.2 : 1;
      await authFetch(`${BACKEND_URL}/api/finance/deposits/create`, {
        method: "POST",
        body: JSON.stringify({
          order_id: order.order_id,
          expected_amount: order.total_deposit || 0,
          actual_amount: Number(depAmount),
          currency: depCurrency,
          exchange_rate: rate,
          held_amount: depCurrency === "UAH" ? Number(depAmount) : Number(depAmount) * rate,
          method: depMethod,
          accepted_by_id: user.id,
          accepted_by_name: user.email,
        }),
      });
      onRefresh();
      setDepAmount("");
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const refundDeposit = async () => {
    if (!deposit || availableDeposit <= 0) return;
    setSaving(true);
    try {
      await authFetch(`${BACKEND_URL}/api/finance/deposits/${deposit.id}/refund?amount=${availableDeposit}&method=cash`, {
        method: "POST",
      });
      onRefresh();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const acceptDamagePayment = async () => {
    if (Number(damageAmount) <= 0) return;
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      await authFetch(`${BACKEND_URL}/api/finance/payments`, {
        method: "POST",
        body: JSON.stringify({
          payment_type: "damage",
          method: damageMethod,
          amount: Number(damageAmount),
          order_id: order.order_id,
          accepted_by_id: user.id,
          accepted_by_name: user.email,
          note: `Оплата шкоди по ордеру #${order.order_number}`,
        }),
      });
      loadDamageFees();
      onRefresh();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const archiveOrder = async () => {
    if (!confirm("Архівувати замовлення? Воно зникне з активних ордерів.")) return;
    setSaving(true);
    try {
      await authFetch(`${BACKEND_URL}/api/orders/${order.order_id}/archive`, {
        method: "POST",
      });
      alert("✅ Замовлення архівовано");
      onRefresh();
    } catch (e) {
      console.error(e);
      alert("Помилка архівування");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Header with status badges */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-slate-900">#{order.order_number}</div>
            <div className="mt-0.5 text-sm text-slate-600">{order.customer_name}</div>
            <div className="mt-0.5 text-xs text-slate-500">{order.customer_phone}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Awaiting additional payment badge */}
            {awaitingAdditionalPayment && (
              <Badge tone="danger">⚠️ Очікує доплати</Badge>
            )}
            {isFullyPaid && (
              <Badge tone="ok">✓ Повністю сплачено</Badge>
            )}
            <Pill tone={rentDue > 0 ? "warn" : "ok"} icon={rentDue > 0 ? "⏳" : "✓"} label={rentDue > 0 ? `Оренда ${money(rentDue)}` : "Оренда OK"} />
            {hasDamage && (
              <Pill tone={damageDue > 0 ? "danger" : "ok"} icon="🔧" label={damageDue > 0 ? `Шкода ${money(damageDue)}` : "Шкода OK"} />
            )}
            <Badge tone="neutral">{order.status}</Badge>
          </div>
        </div>
        
        {/* Archive button if fully paid */}
        {isFullyPaid && order.status !== 'archived' && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Замовлення повністю оплачене. Можна архівувати.
              </div>
              <GhostBtn onClick={archiveOrder} disabled={saving}>
                📦 Архівувати
              </GhostBtn>
            </div>
          </div>
        )}
      </Card>

      <KPIBar order={order} deposit={deposit} />

      {/* Damage Fee Alert */}
      {hasDamage && damageDue > 0 && (
        <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <div className="font-semibold text-rose-900">Є непогашена шкода!</div>
              <div className="text-sm text-rose-800 mt-1">
                Клієнт має доплатити <span className="font-bold">{money(damageDue)}</span> за пошкодження.
              </div>
              <div className="mt-2 space-y-1">
                {damageFees.map((d, i) => (
                  <div key={i} className="text-xs text-rose-700">
                    • {d.product_name}: {money(d.fee)} ({d.damage_type})
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Rent Payment */}
        <Card title="Оплата оренди" subtitle="CASH/BANK → RENT_REV" right={<Pill tone="info" label="rent" />}>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500">Метод</label>
              <select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={rentMethod} onChange={(e) => setRentMethod(e.target.value)}>
                <option value="cash">Готівка</option>
                <option value="bank">Безготівка</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Сума (₴)</label>
              <input className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} type="number" />
            </div>
          </div>
          <div className="mt-3">
            <PrimaryBtn disabled={Number(rentAmount) <= 0 || rentDue <= 0 || saving} onClick={acceptRent}>
              {saving ? "..." : "Зарахувати"}
            </PrimaryBtn>
          </div>
        </Card>

        {/* Damage Payment */}
        <Card 
          title="Оплата шкоди" 
          subtitle="Доплата за пошкодження" 
          right={hasDamage ? <Pill tone={damageDue > 0 ? "danger" : "ok"} label="damage" /> : <Pill tone="neutral" label="—" />}
        >
          {loadingDamage ? (
            <div className="text-center text-slate-500 py-4">Завантаження...</div>
          ) : hasDamage ? (
            <>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Всього шкоди:</span>
                  <span className="font-semibold">{money(totalDamageFee)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-600">Сплачено:</span>
                  <span className="font-medium text-emerald-600">{money(damagePaid)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1 pt-1 border-t border-slate-200">
                  <span className="text-slate-700 font-medium">До сплати:</span>
                  <span className="font-bold text-rose-600">{money(damageDue)}</span>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-500">Метод</label>
                  <select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={damageMethod} onChange={(e) => setDamageMethod(e.target.value)}>
                    <option value="cash">Готівка</option>
                    <option value="bank">Безготівка</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Сума (₴)</label>
                  <input className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={damageAmount} onChange={(e) => setDamageAmount(e.target.value)} type="number" />
                </div>
              </div>
              <div className="mt-3">
                <PrimaryBtn variant="danger" disabled={Number(damageAmount) <= 0 || damageDue <= 0 || saving} onClick={acceptDamagePayment}>
                  {saving ? "..." : "Прийняти оплату шкоди"}
                </PrimaryBtn>
              </div>
            </>
          ) : (
            <div className="text-center text-slate-400 py-4">
              <span className="text-2xl block mb-2">✓</span>
              Пошкоджень не зафіксовано
            </div>
          )}
        </Card>

        {/* Deposit */}
        <Card title="Прийом застави" subtitle="CASH/BANK → DEP_LIAB" right={<Pill tone="info" label="hold" />}>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs text-slate-500">Метод</label>
              <select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={depMethod} onChange={(e) => setDepMethod(e.target.value)}>
                <option value="cash">Готівка</option>
                <option value="bank">Безготівка</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Валюта</label>
              <select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={depCurrency} onChange={(e) => setDepCurrency(e.target.value)}>
                <option value="UAH">₴ UAH</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Сума ({depCurrency})</label>
              <input 
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" 
                value={depAmount} 
                onChange={(e) => setDepAmount(e.target.value)} 
                type="number" 
                placeholder={depCurrency === "UAH" ? "0" : "напр. 300"}
              />
            </div>
          </div>
          {depCurrency !== "UAH" && depAmount && (
            <div className="mt-2 text-xs text-slate-500">
              ≈ {money(Number(depAmount) * (depCurrency === "USD" ? 41.5 : 45.2))} за курсом {depCurrency === "USD" ? "41.5" : "45.2"}
            </div>
          )}
          <div className="mt-3">
            <PrimaryBtn disabled={Number(depAmount) <= 0 || saving} onClick={acceptDeposit}>
              {saving ? "..." : "Прийняти"}
            </PrimaryBtn>
          </div>
        </Card>

        {/* Deposit Operations */}
        <Card title="Операції із заставою">
          {deposit ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Доступно для повернення</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Прийнято: <span className="font-medium">{formatDepositAmount(depositActualAmount)}</span>
                      {depositCurrency !== "UAH" && <span className="text-slate-400"> (≈ {money(deposit.held_amount)})</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      Утримано: {formatDepositAmount(usedInOriginal)} • Повернуто: {formatDepositAmount(refundedInOriginal)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-corp-primary">{formatDepositAmount(availableInOriginal)}</div>
                    {depositCurrency !== "UAH" && (
                      <div className="text-xs text-slate-500">≈ {money(availableDeposit)}</div>
                    )}
                  </div>
                </div>
              </div>
              
              {depositCurrency !== "UAH" && availableInOriginal > 0 && (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2">
                  <div className="text-sm text-amber-800">
                    ⚠️ Повернути клієнту: <span className="font-bold">{formatDepositAmount(availableInOriginal)}</span>
                  </div>
                </div>
              )}
              
              <div className="mt-3 flex gap-3">
                <GhostBtn disabled={availableDeposit <= 0 || saving} onClick={refundDeposit}>
                  Повернути заставу ({formatDepositAmount(availableInOriginal)})
                </GhostBtn>
              </div>
            </>
          ) : (
            <div className="text-center text-slate-400 py-4">
              <span className="text-2xl block mb-2">🔒</span>
              Застава ще не прийнята
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
                  <div className="text-right">
                    <div className="text-2xl font-bold text-corp-primary">{formatDepositAmount(availableInOriginal)}</div>
                    {depositCurrency !== "UAH" && (
                      <div className="text-xs text-slate-500">≈ {money(availableDeposit)}</div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Warning for foreign currency */}
              {depositCurrency !== "UAH" && availableInOriginal > 0 && (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2">
                  <div className="text-sm text-amber-800">
                    ⚠️ Повернути клієнту: <span className="font-bold">{formatDepositAmount(availableInOriginal)}</span>
                  </div>
                </div>
              )}
              
              <div className="mt-3 flex gap-3">
                <GhostBtn disabled={availableDeposit <= 0 || saving} onClick={refundDeposit}>
                  Повернути заставу ({formatDepositAmount(availableInOriginal)})
                </GhostBtn>
              </div>
            </>
          ) : (
            <div className="text-center text-slate-400 py-4">
              <span className="text-2xl block mb-2">🔒</span>
              Застава ще не прийнята
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

// ----------------------------- Ledger Tab -----------------------------
const LedgerTab = ({ ledger, reload, loading }) => {
  const [filter, setFilter] = useState({ q: "", acc: "ALL" });

  const filtered = useMemo(() => {
    const q = (filter.q || "").toLowerCase().trim();
    return ledger.filter((r) => {
      if (q && !(r.tx_type || "").toLowerCase().includes(q) && !(r.note || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ledger, filter]);

  return (
    <div className="space-y-4">
      <Card title="Облік (Ledger)" subtitle="Головна книга" right={<GhostBtn onClick={reload}>Оновити</GhostBtn>}>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-corp-primary/20"
            placeholder="Пошук: тип / примітка"
            value={filter.q}
            onChange={(e) => setFilter((s) => ({ ...s, q: e.target.value }))}
          />
          <select
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={filter.acc}
            onChange={(e) => setFilter((s) => ({ ...s, acc: e.target.value }))}
          >
            <option value="ALL">Всі рахунки</option>
            <option value="CASH">CASH — Каса</option>
            <option value="BANK">BANK — Банк</option>
            <option value="RENT_REV">RENT_REV — Дохід оренди</option>
            <option value="DMG_COMP">DMG_COMP — Компенсація шкоди</option>
          </select>
        </div>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600">Дата</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600">Тип</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600">Проводки</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600">Сума</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600">Примітка</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Завантаження...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Немає записів</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{fmtDate(r.occurred_at)}</td>
                  <td className="px-4 py-3"><Badge tone="neutral">{r.tx_type}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.entries?.map((e, i) => (
                        <span key={i} className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{e.direction}:{e.account_code}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{money(r.amount)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{r.note || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ----------------------------- Expenses Tab -----------------------------
const ExpensesTab = ({ reload, loading, dashboard }) => {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [budgets, setBudgets] = useState({ cash: 0, damage_pool: 0 });
  const [loadingExp, setLoadingExp] = useState(true);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  // One-off form
  const [oneName, setOneName] = useState("Разова витрата");
  const [oneCategory, setOneCategory] = useState("CONSUMABLES");
  const [oneMethod, setOneMethod] = useState("cash");
  const [oneFunding, setOneFunding] = useState("general");
  const [oneAmount, setOneAmount] = useState("");

  // Payroll form
  const [payEmp, setPayEmp] = useState("");
  const [paySalary, setPaySalary] = useState(25000);
  const [payBonus, setPayBonus] = useState(0);
  const [payMethod, setPayMethod] = useState("cash");
  const [payFunding, setPayFunding] = useState("general");

  const loadData = async () => {
    setLoadingExp(true);
    try {
      const [expRes, catRes, empRes, payRes, dashRes] = await Promise.all([
        authFetch(`${BACKEND_URL}/api/finance/expenses`),
        authFetch(`${BACKEND_URL}/api/finance/categories`),
        authFetch(`${BACKEND_URL}/api/finance/employees`),
        authFetch(`${BACKEND_URL}/api/finance/payroll`),
        authFetch(`${BACKEND_URL}/api/finance/dashboard?period=month`),
      ]);
      const expData = await expRes.json();
      const catData = await catRes.json();
      const empData = await empRes.json();
      const payData = await payRes.json();
      const dashData = await dashRes.json();
      
      setExpenses(expData.expenses || []);
      setCategories(Array.isArray(catData) ? catData : []);
      setEmployees(empData.employees || []);
      setPayroll(payData.payroll || []);
      
      // Calculate budgets from dashboard
      const metrics = dashData.metrics || {};
      const rentRevenue = metrics.rent_revenue || 0;
      const damageComp = metrics.damage_compensation || 0;
      const operatingExp = metrics.operating_expenses || 0;
      
      // Calculate expenses by funding source
      const generalExpenses = (expData.expenses || [])
        .filter(e => e.funding !== 'damage_pool')
        .reduce((s, e) => s + (e.amount || 0), 0);
      const damageExpenses = (expData.expenses || [])
        .filter(e => e.funding === 'damage_pool')
        .reduce((s, e) => s + (e.amount || 0), 0);
      
      setBudgets({
        cash: rentRevenue - generalExpenses,
        damage_pool: damageComp - damageExpenses,
      });
      
      if (empData.employees?.length > 0 && !payEmp) {
        setPayEmp(empData.employees[0].id);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingExp(false);
  };

  useEffect(() => { loadData(); }, []);

  const totals = useMemo(() => {
    const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const general = expenses.filter(e => e.funding !== 'damage_pool').reduce((s, e) => s + (e.amount || 0), 0);
    const damage = expenses.filter(e => e.funding === 'damage_pool').reduce((s, e) => s + (e.amount || 0), 0);
    return { total, general, damage };
  }, [expenses]);

  const clearMsg = () => { setMsg(null); setErr(null); };

  const createExpense = async () => {
    if (Number(oneAmount) <= 0) return;
    clearMsg();
    
    // Validate budget
    const amount = Number(oneAmount);
    if (oneFunding === 'damage_pool' && amount > budgets.damage_pool) {
      setErr(`Недостатньо бюджету шкоди. Доступно: ${money(budgets.damage_pool)}`);
      return;
    }
    if (oneFunding === 'general' && amount > budgets.cash) {
      setErr(`Недостатньо коштів у касі. Доступно: ${money(budgets.cash)}`);
      return;
    }
    
    try {
      await authFetch(`${BACKEND_URL}/api/finance/expenses`, {
        method: "POST",
        body: JSON.stringify({
          expense_type: "expense",
          category_code: oneCategory,
          amount: amount,
          method: oneMethod,
          funding: oneFunding,
          note: oneName,
        }),
      });
      setMsg("Витрату проведено ✅");
      setOneAmount("");
      loadData();
      reload();
    } catch (e) {
      setErr(e.message);
    }
  };

  const payPayroll = async (id) => {
    clearMsg();
    try {
      await authFetch(`${BACKEND_URL}/api/finance/payroll/${id}/pay`, { method: "POST" });
      setMsg("Зарплату виплачено ✅");
      loadData();
      reload();
    } catch (e) {
      setErr(e.message);
    }
  };

  const createPayroll = async () => {
    if (!payEmp || Number(paySalary) <= 0) return;
    clearMsg();
    
    const totalPay = Number(paySalary) + Number(payBonus || 0);
    if (payFunding === 'general' && totalPay > budgets.cash) {
      setErr(`Недостатньо коштів у касі. Доступно: ${money(budgets.cash)}`);
      return;
    }
    
    try {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
      
      await authFetch(`${BACKEND_URL}/api/finance/payroll`, {
        method: "POST",
        body: JSON.stringify({
          employee_id: payEmp,
          period_start: start,
          period_end: end,
          base_amount: Number(paySalary),
          bonus: Number(payBonus),
          deduction: 0,
          method: payMethod,
          funding: payFunding,
        }),
      });
      setMsg("Зарплату нараховано ✅");
      setPayBonus(0);
      loadData();
    } catch (e) {
      setErr(e.message);
    }
  };

  // Category suggestions based on funding
  const suggestedCategories = useMemo(() => {
    if (oneFunding === 'damage_pool') {
      return categories.filter(c => 
        c.code === 'RESTORATION' || c.code === 'CLEANING' || c.code === 'REPAIR' || c.type === 'expense'
      );
    }
    return categories.filter(c => c.type === 'expense');
  }, [categories, oneFunding]);

  const FundingBadge = ({ funding }) => {
    if (funding === 'damage_pool') return <Badge tone="warn">🔧 зі шкоди</Badge>;
    return <Badge tone="info">💰 каса</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Budget Overview */}
      <Card title="Бюджети" subtitle="Баланси по джерелах фінансування">
        {err && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{err}</div>}
        {msg && <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{msg}</div>}
        
        <div className="grid gap-4 md:grid-cols-2">
          {/* Cash Budget */}
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">💰</span>
              <div>
                <div className="text-sm font-semibold text-blue-900">Каса (General)</div>
                <div className="text-xs text-blue-700">Дохід з оренди − витрати</div>
              </div>
            </div>
            <div className="text-3xl font-bold text-blue-900">{money(budgets.cash)}</div>
            <div className="mt-2 text-xs text-blue-700">
              Витрачено: {money(totals.general)}
            </div>
          </div>
          
          {/* Damage Pool Budget */}
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🔧</span>
              <div>
                <div className="text-sm font-semibold text-amber-900">Бюджет шкоди (Damage Pool)</div>
                <div className="text-xs text-amber-700">Компенсації − витрати на ремонт</div>
              </div>
            </div>
            <div className="text-3xl font-bold text-amber-900">{money(budgets.damage_pool)}</div>
            <div className="mt-2 text-xs text-amber-700">
              Витрачено: {money(totals.damage)}
            </div>
          </div>
        </div>
        
        <div className="mt-3 text-xs text-slate-500">
          💡 Витрати на ремонт/реставрацію оплачуються з бюджету шкоди. Зарплати та оренда — з каси.
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* One-off Expense */}
        <Card title="Разова витрата" subtitle="Вибір бюджету обов'язковий" right={<Pill tone="info" icon="💸" label="expense" />}>
          <div className="grid gap-3">
            {/* Funding selector - prominent */}
            <div className="rounded-xl border-2 border-dashed border-slate-300 p-3 bg-slate-50">
              <label className="text-xs font-semibold text-slate-700 block mb-2">Джерело фінансування</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setOneFunding('general')}
                  className={cls(
                    "flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition",
                    oneFunding === 'general' 
                      ? "border-blue-500 bg-blue-50 text-blue-900" 
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  💰 Каса
                  <div className="text-xs font-normal mt-0.5 opacity-70">{money(budgets.cash)}</div>
                </button>
                <button
                  onClick={() => setOneFunding('damage_pool')}
                  className={cls(
                    "flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition",
                    oneFunding === 'damage_pool' 
                      ? "border-amber-500 bg-amber-50 text-amber-900" 
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  🔧 Бюджет шкоди
                  <div className="text-xs font-normal mt-0.5 opacity-70">{money(budgets.damage_pool)}</div>
                </button>
              </div>
            </div>
            
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-slate-500">Назва</label>
                <input className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={oneName} onChange={(e) => setOneName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-500">Категорія</label>
                <select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={oneCategory} onChange={(e) => setOneCategory(e.target.value)}>
                  {suggestedCategories.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Метод</label>
                <select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={oneMethod} onChange={(e) => setOneMethod(e.target.value)}>
                  <option value="cash">Готівка</option>
                  <option value="bank">Безготівка</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Сума (₴)</label>
                <input 
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" 
                  value={oneAmount} 
                  onChange={(e) => setOneAmount(e.target.value)} 
                  type="number"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <PrimaryBtn disabled={Number(oneAmount) <= 0} onClick={createExpense}>Провести витрату</PrimaryBtn>
            <FundingBadge funding={oneFunding} />
          </div>
        </Card>

        {/* Payroll */}
        <Card title="Зарплати та бонуси" subtitle="Завжди з каси" right={<Pill tone="info" icon="👥" label="payroll" />}>
          <div className="grid gap-3">
            {/* Info about funding */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              💰 Зарплати виплачуються з каси (баланс: {money(budgets.cash)})
            </div>
            
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-slate-500">Працівник</label>
                <select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={payEmp} onChange={(e) => setPayEmp(e.target.value)}>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Метод</label>
                <select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="cash">Готівка</option>
                  <option value="bank">Безготівка</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">ЗП (₴)</label>
                <input className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={paySalary} onChange={(e) => setPaySalary(e.target.value)} type="number" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Бонус (₴)</label>
                <input className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={payBonus} onChange={(e) => setPayBonus(e.target.value)} type="number" />
              </div>
            </div>
          </div>
          <div className="mt-3">
            <PrimaryBtn disabled={!payEmp || Number(paySalary) <= 0} onClick={createPayroll}>Нарахувати ЗП</PrimaryBtn>
          </div>
        </Card>
      </div>

      {/* Payroll Table */}
      <Card title="Нарахування зарплат" subtitle="Історія виплат">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Працівник</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Період</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Сума</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Статус</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {payroll.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Немає нарахувань</td></tr>
              ) : (
                payroll.map(p => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{p.employee_name || `ID: ${p.employee_id}`}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{p.period_start?.slice(0, 10)} — {p.period_end?.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-semibold">{money(p.total_amount)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={p.status === "paid" ? "ok" : "warn"}>{p.status === "paid" ? "Виплачено" : "Очікує"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {p.status !== "paid" && <GhostBtn onClick={() => payPayroll(p.id)}>Виплатити</GhostBtn>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Expense Records */}
      <Card title="Проведені витрати" right={<GhostBtn onClick={() => { loadData(); reload(); }}>Оновити</GhostBtn>}>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Дата</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Категорія</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Бюджет</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Метод</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Сума</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Примітка</th>
              </tr>
            </thead>
            <tbody>
              {loadingExp ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Завантаження...</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Немає витрат</td></tr>
              ) : (
                expenses.map(e => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{fmtDate(e.occurred_at)}</td>
                    <td className="px-4 py-3"><Badge tone="neutral">{e.category_name || e.category_code}</Badge></td>
                    <td className="px-4 py-3"><FundingBadge funding={e.funding} /></td>
                    <td className="px-4 py-3"><Badge tone="info">{(e.method || "cash").toUpperCase()}</Badge></td>
                    <td className="px-4 py-3 font-semibold text-rose-600">{money(e.amount)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[150px] truncate">{e.note || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ----------------------------- MAIN -----------------------------
export default function FinanceConsoleApp() {
  const [tab, setTab] = useState("orders");
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ordersRes, depositsRes, ledgerRes] = await Promise.all([
        authFetch(`${BACKEND_URL}/api/manager/finance/orders-with-finance?limit=100`),
        authFetch(`${BACKEND_URL}/api/finance/deposits`),
        authFetch(`${BACKEND_URL}/api/finance/ledger?limit=100`),
      ]);
      
      const ordersData = await ordersRes.json();
      const depositsData = await depositsRes.json();
      const ledgerData = await ledgerRes.json();
      
      setOrders(ordersData.orders || []);
      setDeposits(Array.isArray(depositsData) ? depositsData : []);
      setLedger(ledgerData.transactions || []);
      
      if (!selectedId && ordersData.orders?.length > 0) {
        setSelectedId(ordersData.orders[0].order_id);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const selectedOrder = useMemo(() => orders.find(o => o.order_id === selectedId), [orders, selectedId]);

  return (
    <div className="min-h-screen bg-slate-50">
      <CorporateHeader cabinetName="Фінансова консоль" />
      
      <div className="mx-auto max-w-[1400px] px-4 py-4">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white border border-slate-200 p-2 shadow-sm">
          <TabBtn active={tab === "orders"} onClick={() => setTab("orders")}>
            📋 Ордери
          </TabBtn>
          <TabBtn active={tab === "ledger"} onClick={() => setTab("ledger")}>
            📒 Облік
          </TabBtn>
          <TabBtn active={tab === "expenses"} onClick={() => setTab("expenses")}>
            💸 Витрати
          </TabBtn>
        </div>

        <div className="mt-4">
          {tab === "orders" ? (
            <Shell
              left={
                <OrdersList
                  orders={orders}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  query={query}
                  setQuery={setQuery}
                  reload={loadAll}
                  loading={loading}
                />
              }
              right={
                selectedOrder ? (
                  <OrderFinancePanel order={selectedOrder} onRefresh={loadAll} deposits={deposits} />
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
                    {loading ? "Завантаження..." : "Оберіть замовлення зліва"}
                  </div>
                )
              }
            />
          ) : tab === "ledger" ? (
            <LedgerTab ledger={ledger} reload={loadAll} loading={loading} />
          ) : (
            <ExpensesTab reload={loadAll} loading={loading} />
          )}
        </div>
      </div>
    </div>
  );
}
