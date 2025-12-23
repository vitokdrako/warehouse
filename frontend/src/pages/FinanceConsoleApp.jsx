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

// ----------------------------- UI Components (Corporate Style) -----------------------------
const Badge = ({ tone = "neutral", children }) => {
  const map = {
    ok: "corp-badge corp-badge-success",
    warn: "corp-badge corp-badge-warning",
    danger: "corp-badge corp-badge-danger",
    info: "corp-badge corp-badge-info",
    neutral: "corp-badge corp-badge-neutral",
    ink: "corp-badge corp-badge-dark",
    primary: "corp-badge corp-badge-primary",
    gold: "corp-badge corp-badge-gold",
  };
  // Fallback to inline styles if corp-badge not available
  const fallback = {
    ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warn: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-rose-50 text-rose-800 border-rose-200",
    info: "bg-sky-50 text-sky-800 border-sky-200",
    neutral: "bg-corp-bg-light text-corp-text-main border-corp-border",
    ink: "bg-slate-900 text-white border-slate-900",
    primary: "bg-corp-primary/10 text-corp-primary border-corp-primary/30",
    gold: "bg-amber-100 text-amber-900 border-amber-300",
  };
  return (
    <span className={cls(
      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
      map[tone] || fallback[tone] || fallback.neutral
    )}>
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
      "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition",
      disabled ? "bg-corp-border text-corp-text-muted cursor-not-allowed" : "bg-corp-primary text-white hover:bg-corp-primary-hover"
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
      disabled ? "border-corp-border bg-corp-bg-page text-corp-text-muted cursor-not-allowed" : "border-corp-border bg-white text-corp-text-main hover:bg-corp-bg-page hover:border-corp-border"
    )}
  >
    {children}
  </button>
);

const Card = ({ title, subtitle, right, children, className }) => (
  <div className={cls("rounded-2xl border border-corp-border bg-white shadow-sm", className)}>
    {(title || right) && (
      <div className="flex items-center justify-between gap-2 border-b border-corp-border/50 px-5 py-4">
        <div>
          {title && <div className="text-sm font-semibold text-corp-text-dark">{title}</div>}
          {subtitle && <div className="text-xs text-corp-text-muted">{subtitle}</div>}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    )}
    <div className="px-5 py-4">{children}</div>
  </div>
);

const Stat = ({ label, value, sub, tone }) => {
  const toneClasses = {
    ok: "border-emerald-200 bg-emerald-50",
    warn: "border-amber-200 bg-amber-50",
    danger: "border-rose-200 bg-rose-50",
    info: "border-sky-200 bg-sky-50",
    primary: "border-corp-primary/30 bg-corp-primary/5",
  };
  return (
    <div className={cls(
      "corp-stat-card",
      tone && toneClasses[tone]
    )}>
      <div className="corp-stat-label">{label}</div>
      <div className="corp-stat-value">{value}</div>
      {sub && <div className="text-xs text-corp-text-muted mt-1">{sub}</div>}
    </div>
  );
};

const TabBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={cls(
      "rounded-xl px-4 py-2.5 text-sm font-semibold transition border",
      active 
        ? "bg-corp-primary text-white shadow-sm border-corp-primary" 
        : "bg-white text-corp-text-main border-corp-border hover:bg-corp-bg-page hover:border-corp-border"
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
  const damageDue = order.damage_due || 0;
  
  return (
    <button
      onClick={() => onSelect(order.order_id)}
      className={cls(
        "w-full rounded-2xl border px-4 py-3.5 text-left shadow-sm transition",
        selected 
          ? "border-corp-primary bg-corp-primary/5 ring-2 ring-corp-primary/20" 
          : "border-corp-border bg-white hover:bg-corp-bg-page hover:border-corp-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-corp-text-dark">#{order.order_number}</div>
          <div className="mt-0.5 text-xs text-corp-text-main">{order.customer_name}</div>
          <div className="mt-0.5 text-xs text-corp-text-muted">
            Оренда: {money(order.rent_paid || 0)} / {money(order.total_rental || 0)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Pill tone={rentDue > 0 ? "warn" : "ok"} icon={rentDue > 0 ? "⏳" : "✓"} label={rentDue > 0 ? `${money(rentDue)}` : "OK"} />
          {damageDue > 0 && (
            <Pill tone="danger" icon="🔧" label={money(damageDue)} />
          )}
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
          className="h-10 w-full rounded-xl border border-corp-border px-3 text-sm outline-none focus:ring-2 focus:ring-corp-primary/20"
          placeholder="Пошук: код / клієнт / телефон"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Card>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {loading ? (
          <div className="p-4 text-center text-corp-text-muted">Завантаження...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-corp-text-muted">Немає замовлень</div>
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
  const [damageTotal, setDamageTotal] = useState(0);
  const [damagePaidTotal, setDamagePaidTotal] = useState(0);
  const [damageDueTotal, setDamageDueTotal] = useState(0);
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

  // Calculate damage totals from API response (not from items)
  const totalDamageFee = damageTotal;
  const damagePaid = damagePaidTotal;
  const damageDue = damageDueTotal;
  
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
      // API returns: total_damage_fee, paid_damage, due_amount, damage_items
      setDamageFees(data.damage_items || []);
      setDamageTotal(data.total_damage_fee || 0);
      setDamagePaidTotal(data.paid_damage || 0);
      setDamageDueTotal(data.due_amount || 0);
      if (data.due_amount > 0) {
        setDamageAmount(data.due_amount);
      } else {
        setDamageAmount("");
      }
    } catch (e) {
      console.error("Error loading damage fees:", e);
      setDamageFees([]);
      setDamageTotal(0);
      setDamagePaidTotal(0);
      setDamageDueTotal(0);
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
            <div className="text-base font-semibold text-corp-text-dark">#{order.order_number}</div>
            <div className="mt-0.5 text-sm text-corp-text-main">{order.customer_name}</div>
            <div className="mt-0.5 text-xs text-corp-text-muted">{order.customer_phone}</div>
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
          <div className="mt-3 pt-3 border-t border-corp-border-light">
            <div className="flex items-center justify-between">
              <div className="text-sm text-corp-text-main">
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
              <label className="text-xs text-corp-text-muted">Метод</label>
              <select className="mt-1 h-10 w-full rounded-xl border border-corp-border bg-white px-3 text-sm" value={rentMethod} onChange={(e) => setRentMethod(e.target.value)}>
                <option value="cash">Готівка</option>
                <option value="bank">Безготівка</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-corp-text-muted">Сума (₴)</label>
              <input className="mt-1 h-10 w-full rounded-xl border border-corp-border px-3 text-sm" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} type="number" />
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
            <div className="text-center text-corp-text-muted py-4">Завантаження...</div>
          ) : hasDamage ? (
            <>
              <div className="rounded-xl bg-corp-bg-page border border-corp-border p-3 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-corp-text-main">Всього шкоди:</span>
                  <span className="font-semibold">{money(totalDamageFee)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-corp-text-main">Сплачено:</span>
                  <span className="font-medium text-emerald-600">{money(damagePaid)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1 pt-1 border-t border-corp-border">
                  <span className="text-corp-text-main font-medium">До сплати:</span>
                  <span className="font-bold text-rose-600">{money(damageDue)}</span>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs text-corp-text-muted">Метод</label>
                  <select className="mt-1 h-10 w-full rounded-xl border border-corp-border bg-white px-3 text-sm" value={damageMethod} onChange={(e) => setDamageMethod(e.target.value)}>
                    <option value="cash">Готівка</option>
                    <option value="bank">Безготівка</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-corp-text-muted">Сума (₴)</label>
                  <input className="mt-1 h-10 w-full rounded-xl border border-corp-border px-3 text-sm" value={damageAmount} onChange={(e) => setDamageAmount(e.target.value)} type="number" />
                </div>
              </div>
              <div className="mt-3">
                <PrimaryBtn variant="danger" disabled={Number(damageAmount) <= 0 || damageDue <= 0 || saving} onClick={acceptDamagePayment}>
                  {saving ? "..." : "Прийняти оплату шкоди"}
                </PrimaryBtn>
              </div>
            </>
          ) : (
            <div className="text-center text-corp-text-muted py-4">
              <span className="text-2xl block mb-2">✓</span>
              Пошкоджень не зафіксовано
            </div>
          )}
        </Card>

        {/* Deposit */}
        <Card title="Прийом застави" subtitle="CASH/BANK → DEP_LIAB" right={<Pill tone="info" label="hold" />}>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs text-corp-text-muted">Метод</label>
              <select className="mt-1 h-10 w-full rounded-xl border border-corp-border bg-white px-3 text-sm" value={depMethod} onChange={(e) => setDepMethod(e.target.value)}>
                <option value="cash">Готівка</option>
                <option value="bank">Безготівка</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-corp-text-muted">Валюта</label>
              <select className="mt-1 h-10 w-full rounded-xl border border-corp-border bg-white px-3 text-sm" value={depCurrency} onChange={(e) => setDepCurrency(e.target.value)}>
                <option value="UAH">₴ UAH</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-corp-text-muted">Сума ({depCurrency})</label>
              <input 
                className="mt-1 h-10 w-full rounded-xl border border-corp-border px-3 text-sm" 
                value={depAmount} 
                onChange={(e) => setDepAmount(e.target.value)} 
                type="number" 
                placeholder={depCurrency === "UAH" ? "0" : "напр. 300"}
              />
            </div>
          </div>
          {depCurrency !== "UAH" && depAmount && (
            <div className="mt-2 text-xs text-corp-text-muted">
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
              <div className="rounded-xl border border-corp-border bg-corp-bg-page px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Доступно для повернення</div>
                    <div className="text-xs text-corp-text-muted mt-1">
                      Прийнято: <span className="font-medium">{formatDepositAmount(depositActualAmount)}</span>
                      {depositCurrency !== "UAH" && <span className="text-corp-text-muted"> (≈ {money(deposit.held_amount)})</span>}
                    </div>
                    <div className="text-xs text-corp-text-muted">
                      Утримано: {formatDepositAmount(usedInOriginal)} • Повернуто: {formatDepositAmount(refundedInOriginal)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-corp-primary">{formatDepositAmount(availableInOriginal)}</div>
                    {depositCurrency !== "UAH" && (
                      <div className="text-xs text-corp-text-muted">≈ {money(availableDeposit)}</div>
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
            <div className="text-center text-corp-text-muted py-4">
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

  const exportLedger = () => {
    const token = localStorage.getItem("token");
    window.open(`${BACKEND_URL}/api/export/ledger?token=${token}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <Card title="Облік (Ledger)" subtitle="Головна книга" right={
        <div className="flex gap-2">
          <GhostBtn onClick={exportLedger}>📥 Експорт CSV</GhostBtn>
          <GhostBtn onClick={reload}>Оновити</GhostBtn>
        </div>
      }>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="h-10 rounded-xl border border-corp-border px-3 text-sm outline-none focus:ring-2 focus:ring-corp-primary/20"
            placeholder="Пошук: тип / примітка"
            value={filter.q}
            onChange={(e) => setFilter((s) => ({ ...s, q: e.target.value }))}
          />
          <select
            className="h-10 rounded-xl border border-corp-border bg-white px-3 text-sm"
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

      <div className="overflow-hidden rounded-2xl border border-corp-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-corp-bg-page">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-corp-text-main">Дата</th>
              <th className="px-4 py-3 text-xs font-semibold text-corp-text-main">Тип</th>
              <th className="px-4 py-3 text-xs font-semibold text-corp-text-main">Проводки</th>
              <th className="px-4 py-3 text-xs font-semibold text-corp-text-main">Сума</th>
              <th className="px-4 py-3 text-xs font-semibold text-corp-text-main">Примітка</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-corp-text-muted">Завантаження...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-corp-text-muted">Немає записів</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-corp-border-light hover:bg-corp-bg-page/50">
                  <td className="px-4 py-3 font-mono text-xs text-corp-text-main">{fmtDate(r.occurred_at)}</td>
                  <td className="px-4 py-3"><Badge tone="neutral">{r.tx_type}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.entries?.map((e, i) => (
                        <span key={i} className="text-xs bg-corp-bg-light px-1.5 py-0.5 rounded">{e.direction}:{e.account_code}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{money(r.amount)}</td>
                  <td className="px-4 py-3 text-xs text-corp-text-muted max-w-[200px] truncate">{r.note || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ----------------------------- Documents Tab -----------------------------
const DocumentsTab = ({ orders }) => {
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  
  const clearMsg = () => { setMsg(null); setErr(null); };
  
  // Фінансові документи
  const FINANCE_DOCS = [
    { type: "invoice_offer", name: "📄 Рахунок-оферта", entity: "order" },
    { type: "contract_rent", name: "📋 Договір оренди", entity: "order" },
    { type: "invoice_additional", name: "💵 Додатковий рахунок", entity: "order" },
    { type: "rental_extension", name: "📝 Додаткова угода", entity: "order" },
    { type: "deposit_settlement_act", name: "🧾 Акт взаєморозрахунків", entity: "order" },
    { type: "deposit_refund_act", name: "💰 Акт повернення застави", entity: "order" },
    { type: "damage_settlement_act", name: "⚠️ Акт утримання із застави", entity: "order" },
  ];
  
  // Завантажити документи ордера
  const loadDocuments = async (orderId) => {
    if (!orderId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${BACKEND_URL}/api/documents/entity/order/${orderId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (e) {
      console.error("Failed to load documents", e);
    } finally {
      setLoading(false);
    }
  };
  
  // При зміні ордера
  useEffect(() => {
    if (selectedOrderId) {
      loadDocuments(selectedOrderId);
      // Знаходимо email клієнта
      const order = orders.find(o => o.order_id === selectedOrderId || o.id === selectedOrderId);
      if (order?.customer_email) {
        setEmailTo(order.customer_email);
      }
    } else {
      setDocuments([]);
    }
  }, [selectedOrderId, orders]);
  
  // Генерувати документ
  const generateDoc = async (docType) => {
    if (!selectedOrderId) return;
    setGenerating(true);
    clearMsg();
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND_URL}/api/documents/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doc_type: docType,
          entity_id: String(selectedOrderId),
          format: "pdf"
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setMsg(`✅ Документ "${data.doc_number}" згенеровано`);
        loadDocuments(selectedOrderId);
      } else {
        setErr(data.detail || "Помилка генерації");
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setGenerating(false);
    }
  };
  
  // Завантажити PDF
  const downloadPdf = async (documentId) => {
    const token = localStorage.getItem("token");
    window.open(`${BACKEND_URL}/api/documents/${documentId}/pdf?token=${token}`, "_blank");
  };
  
  // Відправити на email
  const sendEmail = async () => {
    if (!selectedDoc || !emailTo) return;
    setSending(true);
    clearMsg();
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND_URL}/api/documents/${selectedDoc.id}/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: emailTo }),
      });
      
      if (res.ok) {
        setMsg(`✅ Документ відправлено на ${emailTo}`);
        setShowEmailModal(false);
      } else {
        const data = await res.json();
        setErr(data.detail || "Помилка відправки");
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };
  
  // Фільтрація ордерів
  const filteredOrders = useMemo(() => {
    if (!searchQuery) return orders.slice(0, 50);
    const q = searchQuery.toLowerCase();
    return orders.filter(o => 
      o.order_number?.toLowerCase().includes(q) ||
      o.customer_name?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [orders, searchQuery]);
  
  const selectedOrder = orders.find(o => o.order_id === selectedOrderId || o.id === selectedOrderId);
  
  return (
    <div className="space-y-4">
      {/* Messages */}
      {err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {msg}
        </div>
      )}
      
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Ліва панель - Список ордерів */}
        <div className="lg:col-span-1">
          <Card title="Оберіть замовлення">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук по номеру або клієнту..."
              className="mb-3 h-10 w-full rounded-xl border border-corp-border px-3 text-sm"
            />
            <div className="max-h-[500px] overflow-auto space-y-1">
              {filteredOrders.map(order => (
                <button
                  key={order.order_id || order.id}
                  onClick={() => setSelectedOrderId(order.order_id || order.id)}
                  className={cls(
                    "w-full text-left px-3 py-2 rounded-xl text-sm transition",
                    (selectedOrderId === order.order_id || selectedOrderId === order.id)
                      ? "bg-amber-100 border-2 border-amber-400"
                      : "hover:bg-corp-bg-page border border-transparent"
                  )}
                >
                  <div className="font-semibold">{order.order_number}</div>
                  <div className="text-xs text-corp-text-muted truncate">{order.customer_name}</div>
                </button>
              ))}
            </div>
          </Card>
        </div>
        
        {/* Права панель - Документи */}
        <div className="lg:col-span-2 space-y-4">
          {selectedOrder ? (
            <>
              {/* Інформація про ордер */}
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-corp-text-dark">{selectedOrder.order_number}</h3>
                    <p className="text-sm text-corp-text-muted">{selectedOrder.customer_name} • {selectedOrder.customer_phone}</p>
                    {selectedOrder.customer_email && (
                      <p className="text-xs text-corp-text-muted">📧 {selectedOrder.customer_email}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-corp-primary">{money(selectedOrder.total_price)}</div>
                    <Badge tone={selectedOrder.status === 'completed' ? 'success' : 'info'}>
                      {selectedOrder.status}
                    </Badge>
                  </div>
                </div>
              </Card>
              
              {/* Генерація нових документів */}
              <Card title="📝 Згенерувати документ" subtitle="Оберіть тип документа">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {FINANCE_DOCS.map(doc => (
                    <button
                      key={doc.type}
                      onClick={() => generateDoc(doc.type)}
                      disabled={generating}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl border border-corp-border hover:bg-corp-bg-page hover:border-amber-300 transition text-sm text-left disabled:opacity-50"
                    >
                      <span>{doc.name}</span>
                    </button>
                  ))}
                </div>
                {generating && <p className="mt-3 text-sm text-corp-text-muted">⏳ Генерація...</p>}
              </Card>
              
              {/* Існуючі документи */}
              <Card 
                title="📁 Існуючі документи" 
                subtitle={`Знайдено: ${documents.length}`}
              >
                {loading ? (
                  <p className="text-center py-4 text-corp-text-muted">Завантаження...</p>
                ) : documents.length === 0 ? (
                  <p className="text-center py-4 text-corp-text-muted">Немає документів для цього замовлення</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map(doc => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between px-4 py-3 rounded-xl border border-corp-border hover:bg-corp-bg-page"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-corp-text-dark">{doc.doc_number}</div>
                          <div className="text-xs text-corp-text-muted">
                            {doc.doc_type_name || doc.doc_type} • {fmtDate(doc.created_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <GhostBtn onClick={() => downloadPdf(doc.id)} className="text-xs">
                            📥 PDF
                          </GhostBtn>
                          <GhostBtn 
                            onClick={() => { setSelectedDoc(doc); setShowEmailModal(true); }}
                            className="text-xs"
                          >
                            📧 Email
                          </GhostBtn>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          ) : (
            <Card>
              <div className="text-center py-10 text-corp-text-muted">
                👈 Оберіть замовлення зліва для роботи з документами
              </div>
            </Card>
          )}
        </div>
      </div>
      
      {/* Email Modal */}
      {showEmailModal && selectedDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">📧 Відправити на Email</h3>
            <p className="text-sm text-corp-text-muted mb-4">
              Документ: <strong>{selectedDoc.doc_number}</strong>
            </p>
            <div className="mb-4">
              <label className="text-sm text-corp-text-muted">Email отримувача</label>
              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-corp-border px-3 text-sm"
                placeholder="email@example.com"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <GhostBtn onClick={() => setShowEmailModal(false)}>Скасувати</GhostBtn>
              <PrimaryBtn onClick={sendEmail} disabled={sending || !emailTo}>
                {sending ? "Відправка..." : "Відправити"}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------------------- Expenses Tab -----------------------------
const ExpensesTab = ({ reload, loading, dashboard }) => {
  const [subTab, setSubTab] = useState("due"); // due | templates | history | oneoff
  const [templates, setTemplates] = useState([]);
  const [dueItems, setDueItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loadingExp, setLoadingExp] = useState(true);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  
  // Month selector
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // One-off form
  const [oneName, setOneName] = useState("Разова витрата");
  const [oneCategory, setOneCategory] = useState("");
  const [oneMethod, setOneMethod] = useState("cash");
  const [oneFunding, setOneFunding] = useState("general");
  const [oneAmount, setOneAmount] = useState("");

  // Template form
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const loadData = async () => {
    setLoadingExp(true);
    try {
      const [templatesRes, dueRes, expRes, catRes, summaryRes] = await Promise.all([
        authFetch(`${BACKEND_URL}/api/expense-management/templates`),
        authFetch(`${BACKEND_URL}/api/expense-management/due-items?month=${selectedMonth}`),
        authFetch(`${BACKEND_URL}/api/expense-management/expenses?month=${selectedMonth}`),
        authFetch(`${BACKEND_URL}/api/finance/categories`),
        authFetch(`${BACKEND_URL}/api/expense-management/summary?month=${selectedMonth}`),
      ]);
      
      const templatesData = await templatesRes.json();
      const dueData = await dueRes.json();
      const expData = await expRes.json();
      const catData = await catRes.json();
      const summaryData = await summaryRes.json();
      
      setTemplates(templatesData.templates || []);
      setDueItems(dueData.due_items || []);
      setExpenses(expData.expenses || []);
      setCategories(Array.isArray(catData) ? catData : []);
      setSummary(summaryData);
      
      if (catData.length > 0 && !oneCategory) {
        const expCats = catData.filter(c => c.type === 'expense');
        if (expCats.length > 0) setOneCategory(expCats[0].code);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingExp(false);
  };

  useEffect(() => { loadData(); }, [selectedMonth]);

  const clearMsg = () => { setMsg(null); setErr(null); };

  // Generate due items from templates
  const generateDueItems = async () => {
    clearMsg();
    try {
      const res = await authFetch(`${BACKEND_URL}/api/expense-management/due-items/generate?month=${selectedMonth}`, {
        method: "POST"
      });
      const data = await res.json();
      setMsg(`Згенеровано ${data.created} планових платежів`);
      loadData();
    } catch (e) {
      setErr(e.message);
    }
  };

  // Pay due item
  const payDueItem = async (itemId, method = "cash") => {
    clearMsg();
    try {
      await authFetch(`${BACKEND_URL}/api/expense-management/due-items/${itemId}/pay`, {
        method: "POST",
        body: JSON.stringify({ method })
      });
      setMsg("Платіж проведено ✅");
      loadData();
      reload();
    } catch (e) {
      setErr(e.message);
    }
  };

  // Cancel due item
  const cancelDueItem = async (itemId) => {
    clearMsg();
    try {
      await authFetch(`${BACKEND_URL}/api/expense-management/due-items/${itemId}/cancel`, {
        method: "POST"
      });
      setMsg("Платіж скасовано");
      loadData();
    } catch (e) {
      setErr(e.message);
    }
  };

  // Create one-off expense
  const createExpense = async () => {
    if (Number(oneAmount) <= 0) return;
    clearMsg();
    try {
      await authFetch(`${BACKEND_URL}/api/finance/expenses`, {
        method: "POST",
        body: JSON.stringify({
          expense_type: "expense",
          category_code: oneCategory,
          amount: Number(oneAmount),
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

  // Save template
  const saveTemplate = async (templateData) => {
    clearMsg();
    try {
      if (templateData.id) {
        await authFetch(`${BACKEND_URL}/api/expense-management/templates/${templateData.id}`, {
          method: "PUT",
          body: JSON.stringify(templateData)
        });
      } else {
        await authFetch(`${BACKEND_URL}/api/expense-management/templates`, {
          method: "POST",
          body: JSON.stringify(templateData)
        });
      }
      setMsg("Шаблон збережено ✅");
      setShowTemplateModal(false);
      setEditingTemplate(null);
      loadData();
    } catch (e) {
      setErr(e.message);
    }
  };

  // Delete template
  const deleteTemplate = async (id) => {
    if (!confirm("Видалити шаблон?")) return;
    clearMsg();
    try {
      await authFetch(`${BACKEND_URL}/api/expense-management/templates/${id}`, {
        method: "DELETE"
      });
      setMsg("Шаблон видалено");
      loadData();
    } catch (e) {
      setErr(e.message);
    }
  };

  const expenseCategories = useMemo(() => categories.filter(c => c.type === 'expense'), [categories]);
  
  const FundingBadge = ({ funding }) => {
    if (funding === 'damage_pool') return <Badge tone="warn">зі шкоди</Badge>;
    return <Badge tone="info">каса</Badge>;
  };

  const StatusBadge = ({ status }) => {
    const map = {
      pending: { tone: "neutral", label: "Очікує" },
      paid: { tone: "ok", label: "Оплачено" },
      overdue: { tone: "danger", label: "Прострочено" },
      cancelled: { tone: "neutral", label: "Скасовано" },
    };
    const s = map[status] || map.pending;
    return <Badge tone={s.tone}>{s.label}</Badge>;
  };

  const FrequencyLabel = ({ freq }) => {
    const map = {
      once: "Разово",
      daily: "Щодня",
      weekly: "Щотижня",
      monthly: "Щомісяця",
      quarterly: "Щоквартально",
      yearly: "Щороку",
    };
    return map[freq] || freq;
  };

  return (
    <div className="space-y-4">
      {/* Messages */}
      {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{err}</div>}
      {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{msg}</div>}

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card title="До сплати" className="!p-4">
            <div className="text-2xl font-bold text-amber-600">{money(summary.due_items?.total_pending || 0)}</div>
            <div className="text-xs text-corp-text-muted mt-1">
              {summary.due_items?.counts?.pending || 0} очікують, {summary.due_items?.counts?.overdue || 0} прострочено
            </div>
          </Card>
          <Card title="Оплачено" className="!p-4">
            <div className="text-2xl font-bold text-emerald-600">{money(summary.due_items?.amounts?.paid || 0)}</div>
            <div className="text-xs text-corp-text-muted mt-1">{summary.due_items?.counts?.paid || 0} платежів</div>
          </Card>
          <Card title="Витрати (каса)" className="!p-4">
            <div className="text-2xl font-bold text-blue-600">{money(summary.expenses?.by_funding?.general || 0)}</div>
          </Card>
          <Card title="Витрати (шкода)" className="!p-4">
            <div className="text-2xl font-bold text-orange-600">{money(summary.expenses?.by_funding?.damage_pool || 0)}</div>
          </Card>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white border border-corp-border p-2">
        <button
          onClick={() => setSubTab("due")}
          className={cls(
            "rounded-lg px-4 py-2 text-sm font-medium transition",
            subTab === "due" ? "bg-corp-primary text-white" : "hover:bg-corp-bg-page"
          )}
        >
          Планові платежі
        </button>
        <button
          onClick={() => setSubTab("templates")}
          className={cls(
            "rounded-lg px-4 py-2 text-sm font-medium transition",
            subTab === "templates" ? "bg-corp-primary text-white" : "hover:bg-corp-bg-page"
          )}
        >
          Шаблони
        </button>
        <button
          onClick={() => setSubTab("history")}
          className={cls(
            "rounded-lg px-4 py-2 text-sm font-medium transition",
            subTab === "history" ? "bg-corp-primary text-white" : "hover:bg-corp-bg-page"
          )}
        >
          Історія
        </button>
        <button
          onClick={() => setSubTab("oneoff")}
          className={cls(
            "rounded-lg px-4 py-2 text-sm font-medium transition",
            subTab === "oneoff" ? "bg-corp-primary text-white" : "hover:bg-corp-bg-page"
          )}
        >
          Разова витрата
        </button>
        
        {/* Month selector */}
        <div className="ml-auto flex items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-corp-border px-3 py-2 text-sm"
          />
          <GhostBtn onClick={loadData}>Оновити</GhostBtn>
        </div>
      </div>

      {/* Due Items Tab */}
      {subTab === "due" && (
        <Card 
          title="Планові платежі" 
          subtitle={`Місяць: ${selectedMonth}`}
          right={
            <div className="flex gap-2">
              <GhostBtn onClick={generateDueItems}>Згенерувати з шаблонів</GhostBtn>
            </div>
          }
        >
          {loadingExp ? (
            <div className="py-8 text-center text-corp-text-muted">Завантаження...</div>
          ) : dueItems.length === 0 ? (
            <div className="py-8 text-center text-corp-text-muted">
              Немає планових платежів на цей місяць.
              <div className="mt-2">
                <button onClick={generateDueItems} className="text-corp-primary hover:underline">
                  Згенерувати з шаблонів
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-corp-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-corp-bg-page">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold">Назва</th>
                    <th className="px-4 py-3 text-xs font-semibold">Дата</th>
                    <th className="px-4 py-3 text-xs font-semibold">Сума</th>
                    <th className="px-4 py-3 text-xs font-semibold">Джерело</th>
                    <th className="px-4 py-3 text-xs font-semibold">Статус</th>
                    <th className="px-4 py-3 text-xs font-semibold">Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {dueItems.map(item => (
                    <tr key={item.id} className={cls(
                      "border-t border-corp-border-light",
                      item.status === 'overdue' && "bg-rose-50"
                    )}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.name}</div>
                        {item.vendor_name && <div className="text-xs text-corp-text-muted">{item.vendor_name}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{item.due_date}</td>
                      <td className="px-4 py-3 font-semibold">{money(item.amount)}</td>
                      <td className="px-4 py-3"><FundingBadge funding={item.funding_source} /></td>
                      <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-3">
                        {(item.status === 'pending' || item.status === 'overdue') && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => payDueItem(item.id, 'cash')}
                              className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-200"
                            >
                              Готівка
                            </button>
                            <button
                              onClick={() => payDueItem(item.id, 'bank')}
                              className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200"
                            >
                              Безготівка
                            </button>
                            <button
                              onClick={() => cancelDueItem(item.id)}
                              className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                        {item.status === 'paid' && (
                          <span className="text-xs text-corp-text-muted">{item.paid_at?.slice(0, 10)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Templates Tab */}
      {subTab === "templates" && (
        <Card 
          title="Шаблони витрат" 
          subtitle="Регулярні платежі"
          right={
            <PrimaryBtn onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }}>
              + Новий шаблон
            </PrimaryBtn>
          }
        >
          {loadingExp ? (
            <div className="py-8 text-center text-corp-text-muted">Завантаження...</div>
          ) : templates.length === 0 ? (
            <div className="py-8 text-center text-corp-text-muted">
              Немає шаблонів. Створіть перший шаблон для автоматичного планування витрат.
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map(t => (
                <div key={t.id} className="flex items-center gap-4 rounded-xl border border-corp-border p-4 hover:bg-corp-bg-page">
                  <div className="flex-1">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-corp-text-muted">
                      {t.category_name || "Без категорії"} · <FrequencyLabel freq={t.frequency} /> · день {t.day_of_month}
                      {t.vendor_name && ` · ${t.vendor_name}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-lg">{money(t.amount)}</div>
                    <FundingBadge funding={t.funding_source} />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingTemplate(t); setShowTemplateModal(true); }}
                      className="rounded p-2 hover:bg-corp-bg-light"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      className="rounded p-2 hover:bg-rose-50 text-rose-600"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* History Tab */}
      {subTab === "history" && (
        <Card 
          title="Історія витрат" 
          subtitle={`Місяць: ${selectedMonth}`}
          right={
            <GhostBtn onClick={() => {
              const token = localStorage.getItem("token");
              window.open(`${BACKEND_URL}/api/export/expenses?month=${selectedMonth}&token=${token}`, '_blank');
            }}>📥 Експорт CSV</GhostBtn>
          }
        >
          {loadingExp ? (
            <div className="py-8 text-center text-corp-text-muted">Завантаження...</div>
          ) : expenses.length === 0 ? (
            <div className="py-8 text-center text-corp-text-muted">Немає витрат за цей період</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-corp-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-corp-bg-page">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold">Дата</th>
                    <th className="px-4 py-3 text-xs font-semibold">Категорія</th>
                    <th className="px-4 py-3 text-xs font-semibold">Джерело</th>
                    <th className="px-4 py-3 text-xs font-semibold">Метод</th>
                    <th className="px-4 py-3 text-xs font-semibold">Сума</th>
                    <th className="px-4 py-3 text-xs font-semibold">Примітка</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(e => (
                    <tr key={e.id} className="border-t border-corp-border-light">
                      <td className="px-4 py-3 font-mono text-xs">{fmtDate(e.occurred_at)}</td>
                      <td className="px-4 py-3"><Badge tone="neutral">{e.category_name || e.category_code}</Badge></td>
                      <td className="px-4 py-3"><FundingBadge funding={e.funding_source} /></td>
                      <td className="px-4 py-3"><Badge tone="info">{(e.method || "cash").toUpperCase()}</Badge></td>
                      <td className="px-4 py-3 font-semibold text-rose-600">{money(e.amount)}</td>
                      <td className="px-4 py-3 text-xs text-corp-text-muted max-w-[150px] truncate">{e.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* One-off Expense Tab */}
      {subTab === "oneoff" && (
        <Card title="Разова витрата" subtitle="Одноразовий платіж">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Form */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-corp-text-muted">Назва</label>
                <input 
                  className="mt-1 h-10 w-full rounded-xl border border-corp-border px-3 text-sm" 
                  value={oneName} 
                  onChange={(e) => setOneName(e.target.value)} 
                />
              </div>
              <div>
                <label className="text-xs text-corp-text-muted">Категорія</label>
                <select 
                  className="mt-1 h-10 w-full rounded-xl border border-corp-border bg-white px-3 text-sm" 
                  value={oneCategory} 
                  onChange={(e) => setOneCategory(e.target.value)}
                >
                  {expenseCategories.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-corp-text-muted">Метод</label>
                  <select 
                    className="mt-1 h-10 w-full rounded-xl border border-corp-border bg-white px-3 text-sm" 
                    value={oneMethod} 
                    onChange={(e) => setOneMethod(e.target.value)}
                  >
                    <option value="cash">Готівка</option>
                    <option value="bank">Безготівка</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-corp-text-muted">Сума (₴)</label>
                  <input 
                    className="mt-1 h-10 w-full rounded-xl border border-corp-border px-3 text-sm" 
                    value={oneAmount} 
                    onChange={(e) => setOneAmount(e.target.value)} 
                    type="number"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-corp-text-muted">Джерело фінансування</label>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setOneFunding('general')}
                    className={cls(
                      "flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition",
                      oneFunding === 'general' 
                        ? "border-blue-500 bg-blue-50 text-blue-900" 
                        : "border-corp-border bg-white hover:bg-corp-bg-page"
                    )}
                  >
                    💰 Каса
                  </button>
                  <button
                    onClick={() => setOneFunding('damage_pool')}
                    className={cls(
                      "flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition",
                      oneFunding === 'damage_pool' 
                        ? "border-amber-500 bg-amber-50 text-amber-900" 
                        : "border-corp-border bg-white hover:bg-corp-bg-page"
                    )}
                  >
                    🔧 Бюджет шкоди
                  </button>
                </div>
              </div>
              <PrimaryBtn disabled={Number(oneAmount) <= 0} onClick={createExpense}>
                Провести витрату
              </PrimaryBtn>
            </div>
            
            {/* Tips */}
            <div className="rounded-xl bg-corp-bg-page p-4 text-sm text-corp-text-muted">
              <div className="font-semibold text-corp-text-dark mb-2">Підказки</div>
              <ul className="space-y-2">
                <li>💰 <b>Каса</b> — для зарплат, оренди, комунальних</li>
                <li>🔧 <b>Бюджет шкоди</b> — для ремонту, реставрації, хімчистки</li>
                <li>💡 Регулярні витрати краще додати як <b>шаблон</b></li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <TemplateModal
          template={editingTemplate}
          categories={expenseCategories}
          onClose={() => { setShowTemplateModal(false); setEditingTemplate(null); }}
          onSave={saveTemplate}
        />
      )}
    </div>
  );
};

// Template Modal Component
const TemplateModal = ({ template, categories, onClose, onSave }) => {
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [categoryId, setCategoryId] = useState(template?.category_id || "");
  const [amount, setAmount] = useState(template?.amount || "");
  const [frequency, setFrequency] = useState(template?.frequency || "monthly");
  const [dayOfMonth, setDayOfMonth] = useState(template?.day_of_month || 1);
  const [fundingSource, setFundingSource] = useState(template?.funding_source || "general");
  const [vendorName, setVendorName] = useState(template?.vendor_name || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !amount) return;
    setSaving(true);
    await onSave({
      id: template?.id,
      name,
      description: description || null,
      category_id: categoryId || null,
      amount: Number(amount),
      frequency,
      day_of_month: dayOfMonth,
      funding_source: fundingSource,
      vendor_name: vendorName || null,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl max-w-lg w-full p-6">
        <h2 className="text-xl font-bold mb-4">{template ? "Редагувати шаблон" : "Новий шаблон"}</h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs text-corp-text-muted">Назва *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full h-10 rounded-xl border border-corp-border px-3"
              placeholder="Наприклад: Оренда приміщення"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-corp-text-muted">Сума (₴) *</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full h-10 rounded-xl border border-corp-border px-3"
              />
            </div>
            <div>
              <label className="text-xs text-corp-text-muted">Категорія</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full h-10 rounded-xl border border-corp-border bg-white px-3"
              >
                <option value="">Без категорії</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-corp-text-muted">Частота</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="mt-1 w-full h-10 rounded-xl border border-corp-border bg-white px-3"
              >
                <option value="once">Разово</option>
                <option value="weekly">Щотижня</option>
                <option value="monthly">Щомісяця</option>
                <option value="quarterly">Щоквартально</option>
                <option value="yearly">Щороку</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-corp-text-muted">День місяця</label>
              <input
                type="number"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                min={1}
                max={28}
                className="mt-1 w-full h-10 rounded-xl border border-corp-border px-3"
              />
            </div>
          </div>
          
          <div>
            <label className="text-xs text-corp-text-muted">Джерело фінансування</label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setFundingSource('general')}
                className={cls(
                  "flex-1 rounded-xl border-2 px-4 py-2 text-sm font-semibold transition",
                  fundingSource === 'general' 
                    ? "border-blue-500 bg-blue-50 text-blue-900" 
                    : "border-corp-border bg-white"
                )}
              >
                💰 Каса
              </button>
              <button
                type="button"
                onClick={() => setFundingSource('damage_pool')}
                className={cls(
                  "flex-1 rounded-xl border-2 px-4 py-2 text-sm font-semibold transition",
                  fundingSource === 'damage_pool' 
                    ? "border-amber-500 bg-amber-50 text-amber-900" 
                    : "border-corp-border bg-white"
                )}
              >
                🔧 Бюджет шкоди
              </button>
            </div>
          </div>
          
          <div>
            <label className="text-xs text-corp-text-muted">Постачальник (опціонально)</label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="mt-1 w-full h-10 rounded-xl border border-corp-border px-3"
              placeholder="ТОВ Приклад"
            />
          </div>
        </div>
        
        <div className="mt-6 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-corp-text-muted hover:text-corp-text-dark">
            Скасувати
          </button>
          <PrimaryBtn onClick={handleSave} disabled={saving || !name || !amount}>
            {saving ? "Збереження..." : "Зберегти"}
          </PrimaryBtn>
        </div>
      </div>
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
    <div className="min-h-screen bg-corp-bg-page font-montserrat">
      <CorporateHeader cabinetName="Фінансова консоль" />
      
      <div className="mx-auto max-w-[1400px] px-4 py-4">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white border border-corp-border p-2 shadow-sm">
          <TabBtn active={tab === "orders"} onClick={() => setTab("orders")}>
            Ордери
          </TabBtn>
          <TabBtn active={tab === "ledger"} onClick={() => setTab("ledger")}>
            Облік
          </TabBtn>
          <TabBtn active={tab === "expenses"} onClick={() => setTab("expenses")}>
            Витрати
          </TabBtn>
          <TabBtn active={tab === "documents"} onClick={() => setTab("documents")}>
            📄 Документи
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
                  <div className="rounded-2xl border border-corp-border bg-white p-10 text-center text-corp-text-muted shadow-sm">
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
