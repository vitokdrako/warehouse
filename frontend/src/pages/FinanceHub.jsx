/* eslint-disable */
/**
 * Finance Hub 2.0 — Unified Financial Console
 * Одна сторінка для всіх фінансових операцій
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import CorporateHeader from "../components/CorporateHeader";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

// ----------------------------- Helpers -----------------------------
const cls = (...a) => a.filter(Boolean).join(" ");
const money = (v, currency = "₴") => {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return `${currency}${n.toLocaleString("uk-UA")}`;
};
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const fmtDateShort = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" });
};

const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
};

// ----------------------------- UI Components -----------------------------
const Badge = ({ tone = "neutral", children, className }) => {
  const tones = {
    ok: "bg-emerald-100 text-emerald-800 border-emerald-200",
    warn: "bg-amber-100 text-amber-800 border-amber-200",
    danger: "bg-rose-100 text-rose-800 border-rose-200",
    info: "bg-sky-100 text-sky-800 border-sky-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    primary: "bg-indigo-100 text-indigo-800 border-indigo-200",
  };
  return (
    <span className={cls("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
};

const Card = ({ title, subtitle, right, children, className, noPadding }) => (
  <div className={cls("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
    {(title || right) && (
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          {title && <div className="text-sm font-semibold text-slate-800">{title}</div>}
          {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    )}
    <div className={noPadding ? "" : "p-4"}>{children}</div>
  </div>
);

const StatCard = ({ icon, label, value, sub, tone, onClick }) => {
  const tones = {
    ok: "border-emerald-200 bg-emerald-50",
    warn: "border-amber-200 bg-amber-50",
    danger: "border-rose-200 bg-rose-50",
    info: "border-sky-200 bg-sky-50",
  };
  return (
    <div 
      onClick={onClick}
      className={cls(
        "rounded-xl border p-3 transition-all",
        tones[tone] || "border-slate-200 bg-slate-50",
        onClick && "cursor-pointer hover:shadow-md"
      )}
    >
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
        {icon && <span>{icon}</span>}
        <span>{label}</span>
      </div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
};

const PrimaryBtn = ({ onClick, children, disabled, className }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cls(
      "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition",
      disabled ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800",
      className
    )}
  >
    {children}
  </button>
);

const GhostBtn = ({ onClick, children, disabled, className }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cls(
      "inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition",
      disabled ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100",
      className
    )}
  >
    {children}
  </button>
);

// ----------------------------- Main Component -----------------------------
export default function FinanceHub() {
  // State
  const [overview, setOverview] = useState(null);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [monthlyReport, setMonthlyReport] = useState(null);
  
  // Payment form
  const [paymentType, setPaymentType] = useState("rent");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Deposit form
  const [depMethod, setDepMethod] = useState("cash");
  const [depCurrency, setDepCurrency] = useState("UAH");
  const [depAmount, setDepAmount] = useState("");
  
  // Encashment
  const [showEncashment, setShowEncashment] = useState(false);
  const [encashAmount, setEncashAmount] = useState("");
  
  // Load overview
  const loadOverview = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/hub/overview`);
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (e) {
      console.error("Error loading overview:", e);
    }
  }, []);
  
  // Load orders
  const loadOrders = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/orders`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.error("Error loading orders:", e);
    }
  }, []);
  
  // Load deposits
  const loadDeposits = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/deposits`);
      if (res.ok) {
        const data = await res.json();
        setDeposits(data.deposits || []);
      }
    } catch (e) {
      console.error("Error loading deposits:", e);
    }
  }, []);
  
  // Load order detail & timeline
  const loadOrderDetail = useCallback(async (orderId) => {
    if (!orderId) return;
    try {
      const [orderRes, timelineRes] = await Promise.all([
        authFetch(`${BACKEND_URL}/api/orders/${orderId}`),
        authFetch(`${BACKEND_URL}/api/finance/hub/order-timeline/${orderId}`)
      ]);
      
      if (orderRes.ok) {
        const data = await orderRes.json();
        setOrderDetail(data);
      }
      
      if (timelineRes.ok) {
        const data = await timelineRes.json();
        setTimeline(data.events || []);
      }
    } catch (e) {
      console.error("Error loading order detail:", e);
    }
  }, []);
  
  // Load monthly report
  const loadMonthlyReport = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/hub/monthly-report`);
      if (res.ok) {
        const data = await res.json();
        setMonthlyReport(data);
      }
    } catch (e) {
      console.error("Error loading monthly report:", e);
    }
  }, []);
  
  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadOverview(), loadOrders(), loadDeposits()]);
      setLoading(false);
    };
    init();
  }, [loadOverview, loadOrders, loadDeposits]);
  
  // Load order detail when selected
  useEffect(() => {
    if (selectedOrder) {
      loadOrderDetail(selectedOrder);
    } else {
      setOrderDetail(null);
      setTimeline([]);
    }
  }, [selectedOrder, loadOrderDetail]);
  
  // Refresh all
  const refreshAll = async () => {
    await Promise.all([loadOverview(), loadOrders(), loadDeposits()]);
    if (selectedOrder) {
      await loadOrderDetail(selectedOrder);
    }
  };
  
  // Filter orders
  const filteredOrders = useMemo(() => {
    const q = (searchQuery || "").toLowerCase().trim();
    if (!q) return orders;
    return orders.filter(o => 
      (o.order_number || "").toLowerCase().includes(q) ||
      (o.customer_name || "").toLowerCase().includes(q) ||
      (o.customer_phone || "").toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);
  
  // Accept payment
  const acceptPayment = async () => {
    if (!selectedOrder || !paymentAmount || Number(paymentAmount) <= 0) return;
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      await authFetch(`${BACKEND_URL}/api/finance/payments`, {
        method: "POST",
        body: JSON.stringify({
          payment_type: paymentType,
          method: paymentMethod,
          amount: Number(paymentAmount),
          order_id: selectedOrder,
          description: paymentType === "additional" ? paymentDescription : null,
          accepted_by_id: user.id,
          accepted_by_name: user.email || user.name,
        }),
      });
      setPaymentAmount("");
      setPaymentDescription("");
      await refreshAll();
    } catch (e) {
      console.error(e);
      alert("Помилка при збереженні оплати");
    }
    setSaving(false);
  };
  
  // Accept deposit
  const acceptDeposit = async () => {
    if (!selectedOrder || !depAmount || Number(depAmount) <= 0) return;
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const rate = depCurrency === "USD" ? 41.5 : depCurrency === "EUR" ? 45.2 : 1;
      await authFetch(`${BACKEND_URL}/api/finance/deposits/create`, {
        method: "POST",
        body: JSON.stringify({
          order_id: selectedOrder,
          expected_amount: orderDetail?.total_deposit || 0,
          actual_amount: Number(depAmount),
          currency: depCurrency,
          exchange_rate: rate,
          held_amount: depCurrency === "UAH" ? Number(depAmount) : Number(depAmount) * rate,
          method: depMethod,
          accepted_by_id: user.id,
          accepted_by_name: user.email || user.name,
        }),
      });
      setDepAmount("");
      await refreshAll();
    } catch (e) {
      console.error(e);
      alert("Помилка при прийомі застави");
    }
    setSaving(false);
  };
  
  // Refund deposit
  const refundDeposit = async () => {
    const deposit = deposits.find(d => d.order_id === selectedOrder);
    if (!deposit) return;
    const available = Math.max(0, (deposit.held_amount || 0) - (deposit.used_amount || 0) - (deposit.refunded_amount || 0));
    if (available <= 0) return;
    
    if (!confirm(`Повернути заставу ₴${available}?`)) return;
    
    setSaving(true);
    try {
      await authFetch(`${BACKEND_URL}/api/finance/deposits/${deposit.id}/refund?amount=${available}&method=cash`, {
        method: "POST",
      });
      await refreshAll();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };
  
  // Encashment
  const doEncashment = async () => {
    if (!encashAmount || Number(encashAmount) <= 0) return;
    setSaving(true);
    try {
      await authFetch(`${BACKEND_URL}/api/finance/hub/encashment?amount=${encashAmount}`, {
        method: "POST",
      });
      setEncashAmount("");
      setShowEncashment(false);
      await refreshAll();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };
  
  // Get deposit for selected order
  const orderDeposit = useMemo(() => {
    if (!selectedOrder) return null;
    return deposits.find(d => d.order_id === selectedOrder);
  }, [selectedOrder, deposits]);
  
  const depositAvailable = orderDeposit 
    ? Math.max(0, (orderDeposit.held_amount || 0) - (orderDeposit.used_amount || 0) - (orderDeposit.refunded_amount || 0))
    : 0;
  
  // Calculate dues
  const rentDue = orderDetail ? Math.max(0, (orderDetail.total_rental || 0) - (orderDetail.rent_paid || 0)) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <CorporateHeader />
      
      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">💰 Finance Hub</h1>
            <p className="text-sm text-slate-500">Єдина фінансова консоль</p>
          </div>
          <div className="flex items-center gap-2">
            <GhostBtn onClick={() => { loadMonthlyReport(); setShowMonthlyReport(true); }}>
              📊 Місячний звіт
            </GhostBtn>
            <GhostBtn onClick={refreshAll}>🔄 Оновити</GhostBtn>
          </div>
        </div>
        
        {/* 3-Column Layout */}
        <div className="grid gap-4 lg:grid-cols-[280px_1fr_320px]">
          
          {/* Column 1: Каси + Ордери */}
          <div className="space-y-4">
            {/* Каси */}
            <Card title="📊 Каси" subtitle="В реальному часі">
              <div className="space-y-3">
                <StatCard 
                  icon="💵" 
                  label="Готівка" 
                  value={money(overview?.cash?.balance || 0)}
                  tone={overview?.cash?.balance > 0 ? "ok" : "neutral"}
                />
                <StatCard 
                  icon="🏦" 
                  label="Безготівка" 
                  value={money(overview?.bank?.balance || 0)}
                  tone="info"
                />
                
                {/* Застави */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-500 mb-2">🔒 Застави</div>
                  {overview?.deposits && Object.entries(overview.deposits).map(([currency, data]) => (
                    <div key={currency} className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">{currency}</span>
                      <span className="font-medium">
                        {currency === "UAH" ? money(data.available) : `${currency === "USD" ? "$" : "€"}${data.available?.toLocaleString()}`}
                      </span>
                    </div>
                  ))}
                  {(!overview?.deposits || Object.keys(overview.deposits).length === 0) && (
                    <div className="text-sm text-slate-400">Немає активних</div>
                  )}
                </div>
                
                {/* Кнопка інкасації */}
                <button
                  onClick={() => setShowEncashment(true)}
                  className="w-full mt-2 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 transition"
                >
                  📥 Зняти готівку
                </button>
              </div>
            </Card>
            
            {/* Ордери */}
            <Card title="📋 Ордери" subtitle={`${filteredOrders.length} активних`} noPadding>
              <div className="p-3 border-b border-slate-100">
                <input
                  type="text"
                  placeholder="🔍 Пошук..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {filteredOrders.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm">Немає ордерів</div>
                ) : (
                  filteredOrders.map((order) => {
                    const due = Math.max(0, (order.total_rental || 0) - (order.rent_paid || 0));
                    const isSelected = order.order_id === selectedOrder;
                    return (
                      <button
                        key={order.order_id}
                        onClick={() => setSelectedOrder(order.order_id)}
                        className={cls(
                          "w-full px-3 py-2.5 text-left border-b border-slate-50 transition",
                          isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-800">#{order.order_number}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[140px]">{order.customer_name}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            {due > 0 ? (
                              <Badge tone="warn">⏳{money(due)}</Badge>
                            ) : (
                              <Badge tone="ok">✓</Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
          
          {/* Column 2: Active Order Panel */}
          <div className="space-y-4">
            {!selectedOrder ? (
              <Card className="min-h-[500px] flex items-center justify-center">
                <div className="text-center text-slate-400">
                  <div className="text-4xl mb-3">👈</div>
                  <div>Оберіть ордер зі списку</div>
                </div>
              </Card>
            ) : (
              <>
                {/* Order Header */}
                <Card>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-bold text-slate-800">#{orderDetail?.order_number}</div>
                      <div className="text-sm text-slate-600">{orderDetail?.customer_name}</div>
                      <div className="text-xs text-slate-500">{orderDetail?.customer_phone}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {rentDue > 0 && <Badge tone="warn">Борг: {money(rentDue)}</Badge>}
                      {rentDue <= 0 && <Badge tone="ok">✓ Сплачено</Badge>}
                      <Badge tone="neutral">{orderDetail?.status}</Badge>
                    </div>
                  </div>
                  
                  {/* KPI */}
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    <div className="text-center p-2 rounded-lg bg-slate-50">
                      <div className="text-xs text-slate-500">Нараховано</div>
                      <div className="text-sm font-bold text-slate-800">{money(orderDetail?.total_rental || 0)}</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-emerald-50">
                      <div className="text-xs text-slate-500">Оплачено</div>
                      <div className="text-sm font-bold text-emerald-700">{money(orderDetail?.rent_paid || 0)}</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-sky-50">
                      <div className="text-xs text-slate-500">Застава</div>
                      <div className="text-sm font-bold text-sky-700">
                        {orderDeposit ? (orderDeposit.currency === "UAH" ? money(orderDeposit.actual_amount) : `${orderDeposit.currency === "USD" ? "$" : "€"}${orderDeposit.actual_amount}`) : "—"}
                      </div>
                    </div>
                    <div className={cls("text-center p-2 rounded-lg", rentDue > 0 ? "bg-amber-50" : "bg-emerald-50")}>
                      <div className="text-xs text-slate-500">До сплати</div>
                      <div className={cls("text-sm font-bold", rentDue > 0 ? "text-amber-700" : "text-emerald-700")}>{money(rentDue)}</div>
                    </div>
                  </div>
                </Card>
                
                {/* Timeline */}
                <Card title="📜 Історія операцій" subtitle="Таймлайн">
                  <div className="max-h-[200px] overflow-y-auto space-y-2">
                    {timeline.length === 0 ? (
                      <div className="text-center text-slate-400 text-sm py-4">Операцій ще немає</div>
                    ) : (
                      timeline.map((event) => (
                        <div key={event.id} className={cls(
                          "flex items-start gap-3 p-2 rounded-lg border",
                          event.tone === "ok" ? "border-emerald-200 bg-emerald-50" :
                          event.tone === "warn" ? "border-amber-200 bg-amber-50" :
                          event.tone === "danger" ? "border-rose-200 bg-rose-50" :
                          "border-slate-200 bg-slate-50"
                        )}>
                          <span className="text-lg">{event.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-800">{event.title}</span>
                              <span className="text-sm font-bold">{event.currency && event.currency !== "UAH" ? `${event.currency === "USD" ? "$" : "€"}${event.amount}` : money(event.amount)}</span>
                            </div>
                            {event.description && <div className="text-xs text-slate-600">{event.description}</div>}
                            <div className="text-xs text-slate-400 mt-0.5">
                              {fmtDate(event.timestamp)} {event.method && `· ${event.method}`} {event.user && `· ${event.user}`}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
                
                {/* Payment Form */}
                <Card title="💳 Прийняти оплату">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <label className="text-xs text-slate-500">Тип</label>
                      <select 
                        value={paymentType} 
                        onChange={(e) => setPaymentType(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                      >
                        <option value="rent">Оренда</option>
                        <option value="additional">Донарахування</option>
                        <option value="damage">Шкода</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Метод</label>
                      <select 
                        value={paymentMethod} 
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                      >
                        <option value="cash">Готівка</option>
                        <option value="bank">Безготівка</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Сума (₴)</label>
                      <input 
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder={rentDue > 0 ? String(rentDue) : "0"}
                        className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                      />
                    </div>
                    <div className="flex items-end">
                      <PrimaryBtn onClick={acceptPayment} disabled={saving || !paymentAmount} className="w-full">
                        {saving ? "..." : "Зарахувати"}
                      </PrimaryBtn>
                    </div>
                  </div>
                  
                  {/* Description for additional */}
                  {paymentType === "additional" && (
                    <div className="mt-3">
                      <label className="text-xs text-slate-500">Назва донарахування</label>
                      <input 
                        type="text"
                        value={paymentDescription}
                        onChange={(e) => setPaymentDescription(e.target.value)}
                        placeholder="Доставка, упаковка, тощо..."
                        className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                      />
                    </div>
                  )}
                </Card>
                
                {/* Deposit Section */}
                <Card title="🔒 Застава">
                  {orderDeposit ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-sky-50 border border-sky-200">
                        <div>
                          <div className="text-sm font-medium text-slate-700">Прийнято</div>
                          <div className="text-xs text-slate-500">
                            {orderDeposit.currency === "UAH" 
                              ? money(orderDeposit.actual_amount)
                              : `${orderDeposit.currency === "USD" ? "$" : "€"}${orderDeposit.actual_amount} (≈${money(orderDeposit.held_amount)})`
                            }
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-sky-700">
                            {orderDeposit.currency === "UAH" 
                              ? money(depositAvailable)
                              : `${orderDeposit.currency === "USD" ? "$" : "€"}${(orderDeposit.actual_amount - (orderDeposit.used_amount_original || 0) - (orderDeposit.refunded_amount_original || 0)).toFixed(0)}`
                            }
                          </div>
                          <div className="text-xs text-slate-500">доступно</div>
                        </div>
                      </div>
                      <GhostBtn onClick={refundDeposit} disabled={depositAvailable <= 0 || saving} className="w-full">
                        💰 Повернути заставу
                      </GhostBtn>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div>
                        <label className="text-xs text-slate-500">Метод</label>
                        <select 
                          value={depMethod} 
                          onChange={(e) => setDepMethod(e.target.value)}
                          className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                        >
                          <option value="cash">Готівка</option>
                          <option value="bank">Безготівка</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Валюта</label>
                        <select 
                          value={depCurrency} 
                          onChange={(e) => setDepCurrency(e.target.value)}
                          className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                        >
                          <option value="UAH">₴ UAH</option>
                          <option value="USD">$ USD</option>
                          <option value="EUR">€ EUR</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Сума ({depCurrency})</label>
                        <input 
                          type="number"
                          value={depAmount}
                          onChange={(e) => setDepAmount(e.target.value)}
                          placeholder="0"
                          className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <PrimaryBtn onClick={acceptDeposit} disabled={saving || !depAmount} className="w-full">
                          {saving ? "..." : "Прийняти"}
                        </PrimaryBtn>
                      </div>
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
          
          {/* Column 3: Quick Actions & Stats */}
          <div className="space-y-4">
            {/* Quick Actions */}
            <Card title="⚡ Швидкі дії">
              <div className="space-y-2">
                <a href="/expenses" className="block w-full py-2.5 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-center">
                  💸 Додати витрату
                </a>
                <a href="/payroll" className="block w-full py-2.5 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-center">
                  👥 Нарахувати ЗП
                </a>
                <button 
                  onClick={() => { loadMonthlyReport(); setShowMonthlyReport(true); }}
                  className="w-full py-2.5 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  📊 Місячний звіт
                </button>
              </div>
            </Card>
            
            {/* Month Stats */}
            <Card title="📈 Цей місяць">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Виручка</span>
                  <span className="text-sm font-bold text-emerald-600">{money(overview?.month?.revenue?.total || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Витрати</span>
                  <span className="text-sm font-bold text-rose-600">-{money(overview?.month?.expenses || 0)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-sm font-medium text-slate-700">Прибуток</span>
                  <span className={cls("text-sm font-bold", (overview?.month?.profit || 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    {money(overview?.month?.profit || 0)}
                  </span>
                </div>
              </div>
            </Card>
            
            {/* Orders Stats */}
            <Card title="📋 Статистика ордерів">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Всього</span>
                  <span className="font-medium">{overview?.orders?.total || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-600">Оплачено</span>
                  <span className="font-medium text-emerald-600">{overview?.orders?.fully_paid || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-amber-600">З боргом</span>
                  <span className="font-medium text-amber-600">{overview?.orders?.with_debt || 0}</span>
                </div>
              </div>
            </Card>
            
            {/* Documents */}
            {selectedOrder && orderDetail && (
              <Card title="📄 Документи">
                <div className="space-y-2">
                  <a 
                    href={`${BACKEND_URL}/api/documents/preview/invoice_offer/${selectedOrder}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-2 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    📄 Рахунок-оферта
                  </a>
                  <a 
                    href={`${BACKEND_URL}/api/documents/preview/contract_rent/${selectedOrder}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-2 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    📋 Договір оренди
                  </a>
                  <a 
                    href={`${BACKEND_URL}/api/documents/preview/deposit_settlement_act/${selectedOrder}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-2 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    🧾 Акт взаєморозрахунків
                  </a>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
      
      {/* Encashment Modal */}
      {showEncashment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold">📥 Інкасація готівки</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm text-slate-600">Поточний залишок каси</label>
                <div className="text-2xl font-bold text-slate-800">{money(overview?.cash?.balance || 0)}</div>
              </div>
              <div>
                <label className="text-sm text-slate-600">Сума для зняття (₴)</label>
                <input 
                  type="number"
                  value={encashAmount}
                  onChange={(e) => setEncashAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full h-12 px-4 rounded-xl border border-slate-200 text-lg"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-3">
              <GhostBtn onClick={() => setShowEncashment(false)} className="flex-1">Скасувати</GhostBtn>
              <PrimaryBtn onClick={doEncashment} disabled={saving || !encashAmount} className="flex-1">
                {saving ? "..." : "Провести інкасацію"}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
      
      {/* Monthly Report Modal */}
      {showMonthlyReport && monthlyReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl my-8">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h3 className="text-lg font-semibold">📊 Місячний звіт — {monthlyReport.period.month}/{monthlyReport.period.year}</h3>
              <button onClick={() => setShowMonthlyReport(false)} className="p-2 hover:bg-slate-100 rounded-lg">✕</button>
            </div>
            <div className="p-4 space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-sm text-emerald-600">Доходи</div>
                  <div className="text-xl font-bold text-emerald-700">{money(monthlyReport.summary.gross_income)}</div>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center">
                  <div className="text-sm text-rose-600">Витрати</div>
                  <div className="text-xl font-bold text-rose-700">{money(monthlyReport.summary.total_costs)}</div>
                </div>
                <div className={cls("p-4 rounded-xl border text-center", monthlyReport.summary.net_profit >= 0 ? "bg-sky-50 border-sky-200" : "bg-amber-50 border-amber-200")}>
                  <div className="text-sm text-slate-600">Прибуток</div>
                  <div className={cls("text-xl font-bold", monthlyReport.summary.net_profit >= 0 ? "text-sky-700" : "text-amber-700")}>{money(monthlyReport.summary.net_profit)}</div>
                </div>
              </div>
              
              {/* Income breakdown */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">💰 Доходи</h4>
                <div className="space-y-1">
                  {Object.entries(monthlyReport.income.breakdown || {}).map(([type, data]) => (
                    <div key={type} className="flex items-center justify-between py-1.5 px-2 rounded bg-slate-50 text-sm">
                      <span className="text-slate-600">{type === "rent" ? "Оренда" : type === "additional" ? "Донарахування" : type === "damage" ? "Шкода" : type}</span>
                      <div className="flex gap-4">
                        <span className="text-slate-500">💵{money(data.cash)}</span>
                        <span className="text-slate-500">🏦{money(data.bank)}</span>
                        <span className="font-medium">{money(data.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Expenses breakdown */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">💸 Витрати</h4>
                <div className="space-y-1">
                  {Object.entries(monthlyReport.expenses.breakdown || {}).map(([cat, data]) => (
                    <div key={cat} className="flex items-center justify-between py-1.5 px-2 rounded bg-slate-50 text-sm">
                      <span className="text-slate-600">{cat}</span>
                      <span className="font-medium">{money(data.total)}</span>
                    </div>
                  ))}
                  {Object.keys(monthlyReport.expenses.breakdown || {}).length === 0 && (
                    <div className="text-sm text-slate-400 py-2">Витрат немає</div>
                  )}
                </div>
              </div>
              
              {/* Payroll */}
              {Object.keys(monthlyReport.payroll.breakdown || {}).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">👥 Зарплати</h4>
                  <div className="space-y-1">
                    {Object.entries(monthlyReport.payroll.breakdown).map(([emp, amount]) => (
                      <div key={emp} className="flex items-center justify-between py-1.5 px-2 rounded bg-slate-50 text-sm">
                        <span className="text-slate-600">{emp}</span>
                        <span className="font-medium">{money(amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Encashments */}
              {monthlyReport.encashments.count > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="text-sm text-amber-700">📥 Інкасацій: {monthlyReport.encashments.count}</span>
                  <span className="font-bold text-amber-700">{money(monthlyReport.encashments.total)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
