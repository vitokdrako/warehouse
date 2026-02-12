/* eslint-disable */
/**
 * Finance Hub 2.0 - Уніфікований фінансовий центр з вкладками
 * 
 * Вкладки:
 * 1. Операції - головна (OrderList + OrderFinancePanel)
 * 2. Документи - центр документів
 * 3. Каси - баланси + зведення
 * 4. План надходжень - прогноз
 * 5. Витрати - категорії витрат
 * 6. Депозити - глобальний список
 * 7. Аналітика - звіти
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import CorporateHeader from "../components/CorporateHeader";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

// ===== HELPERS =====
const cn = (...xs) => xs.filter(Boolean).join(" ");

const money = (v, currency = "₴") => {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return `${currency}${n.toLocaleString("uk-UA")}`;
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const fmtDateShort = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
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

// ===== UI COMPONENTS =====
const Badge = ({ kind, children }) => (
  <span className={cn(
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
    kind === "ok" && "bg-emerald-50 text-emerald-700 border border-emerald-100",
    kind === "pending" && "bg-amber-50 text-amber-700 border border-amber-100",
    kind === "warn" && "bg-rose-50 text-rose-700 border border-rose-100",
    kind === "info" && "bg-blue-50 text-blue-700 border border-blue-100"
  )}>
    {children}
  </span>
);

const Card = ({ title, right, children, className, noPadding }) => (
  <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
    {(title || right) && (
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        <div>{right}</div>
      </div>
    )}
    <div className={noPadding ? "" : "p-4"}>{children}</div>
  </div>
);

const Timeline = ({ items }) => (
  <div className="space-y-3">
    {items.map((it) => (
      <div key={it.id} className="flex gap-3">
        <div className="pt-1">
          <div className={cn(
            "h-2.5 w-2.5 rounded-full",
            it.status === "done" && "bg-emerald-500",
            it.status === "pending" && "bg-amber-500",
            it.status === "warn" && "bg-rose-500"
          )} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs text-slate-500">{it.at}</span>
            <span className="text-sm font-medium text-slate-900">{it.label}</span>
            {it.amount && <span className="text-sm font-semibold text-slate-900">{it.amount}</span>}
          </div>
          {it.meta && <div className="text-xs text-slate-600 mt-0.5">{it.meta}</div>}
        </div>
      </div>
    ))}
  </div>
);

const Select = ({ value, onChange, options }) => (
  <select
    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
    value={value}
    onChange={(e) => onChange(e.target.value)}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

const Input = (props) => (
  <input
    {...props}
    className={cn(
      "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200",
      props.className
    )}
  />
);

const Button = ({ children, variant = "primary", size = "md", ...props }) => (
  <button
    {...props}
    className={cn(
      "rounded-xl font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed",
      size === "sm" && "h-8 px-3 text-xs",
      size === "md" && "h-10 px-4 text-sm",
      size === "lg" && "h-12 px-6 text-base",
      variant === "primary" && "bg-slate-900 text-white hover:bg-slate-800",
      variant === "ghost" && "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
      variant === "warn" && "bg-amber-500 text-white hover:bg-amber-600",
      variant === "danger" && "bg-rose-500 text-white hover:bg-rose-600",
      variant === "success" && "bg-emerald-500 text-white hover:bg-emerald-600",
      variant === "deposit" && "bg-blue-500 text-white hover:bg-blue-600",
      variant === "advance" && "bg-violet-500 text-white hover:bg-violet-600",
      props.className
    )}
  >
    {children}
  </button>
);

// Tab Button Component
const TabButton = ({ active, onClick, children, icon }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition whitespace-nowrap",
      active 
        ? "bg-slate-900 text-white" 
        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
    )}
  >
    {icon && <span className="text-base">{icon}</span>}
    {children}
  </button>
);

// ===== MAIN COMPONENT =====
export default function FinanceHub() {
  // === GLOBAL STATE ===
  const [activeTab, setActiveTab] = useState("operations");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  // Data states
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [orderSnapshot, setOrderSnapshot] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [payoutsStats, setPayoutsStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [damageFees, setDamageFees] = useState({ total_fee: 0, paid_amount: 0, due_amount: 0, items: [] });
  const [lateFeeData, setLateFeeData] = useState({ total: 0, paid: 0, due: 0, items: [] });
  const [allExpenses, setAllExpenses] = useState([]);
  const [payerProfiles, setPayerProfiles] = useState([]);
  const [selectedPayerProfile, setSelectedPayerProfile] = useState(null);
  
  // Loading/UI states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Get current user
  const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");
  
  // ===== DATA LOADING =====
  const loadOrders = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/manager/finance/orders-with-finance?limit=100`);
      const data = await res.json();
      setOrders(data.orders || []);
      if (data.orders?.length > 0 && !selectedOrderId) {
        setSelectedOrderId(data.orders[0].order_id);
      }
    } catch (e) {
      console.error("Load orders error:", e);
    }
  }, [selectedOrderId]);
  
  const loadDeposits = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/deposits`);
      const data = await res.json();
      setDeposits(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Load deposits error:", e);
    }
  }, []);
  
  const loadPayoutsStats = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/payouts-stats-v2`);
      const data = await res.json();
      setPayoutsStats(data);
    } catch (e) {
      console.error("Load stats error:", e);
    }
  }, []);
  
  const loadOrderSnapshot = useCallback(async (orderId) => {
    if (!orderId) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/orders/${orderId}/snapshot`);
      const data = await res.json();
      if (data.order_id) {
        setOrderSnapshot(data);
        setPayments(data.payments || []);
        setDocuments(data.documents || []);
        setDamageFees({
          total_fee: data.damage?.total || 0,
          paid_amount: data.damage?.paid || 0,
          due_amount: data.damage?.due || 0,
          items: data.damage?.items || []
        });
        setLateFeeData({
          total: data.late?.total || 0,
          paid: data.late?.paid || 0,
          due: data.late?.due || 0,
          items: data.late?.items || []
        });
        setSelectedPayerProfile(data.payer_profile || null);
      }
    } catch (e) {
      console.error("Load snapshot error:", e);
    }
  }, []);
  
  const loadAllExpenses = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/expenses/all?limit=200`);
      const data = await res.json();
      setAllExpenses(data.expenses || []);
    } catch (e) {
      console.error("Load expenses error:", e);
    }
  }, []);
  
  const loadPayerProfiles = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/payer-profiles`);
      const data = await res.json();
      setPayerProfiles(data.profiles || []);
    } catch (e) {
      console.error("Load payer profiles error:", e);
    }
  }, []);
  
  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([loadOrders(), loadDeposits(), loadPayoutsStats(), loadPayerProfiles()]);
      setLoading(false);
    };
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Load order snapshot when selection changes
  useEffect(() => {
    if (selectedOrderId) {
      loadOrderSnapshot(selectedOrderId);
    }
  }, [selectedOrderId, loadOrderSnapshot]);
  
  // Load expenses when tab changes to expenses
  useEffect(() => {
    if (activeTab === "expenses") {
      loadAllExpenses();
    }
  }, [activeTab, loadAllExpenses]);
  
  // Refresh all
  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadOrders(),
      loadDeposits(),
      loadPayoutsStats(),
      selectedOrderId && loadOrderSnapshot(selectedOrderId)
    ]);
  }, [selectedOrderId, loadOrderSnapshot]);
  
  // ===== COMPUTED VALUES =====
  const selectedOrder = useMemo(() => {
    return orders.find(o => o.order_id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);
  
  const orderDeposit = useMemo(() => {
    if (!selectedOrderId) return null;
    if (orderSnapshot?.deposit) return orderSnapshot.deposit;
    return deposits.find(d => d.order_id === selectedOrderId) || null;
  }, [deposits, selectedOrderId, orderSnapshot]);
  
  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return orders;
    return orders.filter(o =>
      (o.order_number || "").toLowerCase().includes(q) ||
      (o.customer_name || o.client_name || "").toLowerCase().includes(q) ||
      (o.customer_phone || "").toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);
  
  const depositsByCurrency = useMemo(() => {
    const result = { UAH: 0, USD: 0, EUR: 0 };
    deposits.forEach(d => {
      const available = (d.held_amount || 0) - (d.used_amount || 0) - (d.refunded_amount || 0);
      if (available > 0) {
        const currency = d.currency || "UAH";
        if (currency === "UAH") result.UAH += available;
        else if (currency === "USD") result.USD += d.actual_amount - (d.used_amount || 0) - (d.refunded_amount || 0);
        else if (currency === "EUR") result.EUR += d.actual_amount - (d.used_amount || 0) - (d.refunded_amount || 0);
      }
    });
    return result;
  }, [deposits]);
  
  const orderStats = useMemo(() => {
    const total = orders.length;
    const paid = orders.filter(o => {
      const rentDue = Math.max(0, (o.total_rental || 0) - (o.rent_paid || 0));
      return rentDue <= 0 && (o.damage_due || 0) <= 0;
    }).length;
    return { total, paid, withDebt: total - paid };
  }, [orders]);
  
  // ===== TIMELINE =====
  const timeline = useMemo(() => {
    const items = [];
    payments.forEach(p => {
      const typeLabels = {
        rent: "Оренда", additional: "Донарахування", damage: "Шкода",
        deposit: "Застава", late: "Прострочення", advance: "Передплата"
      };
      items.push({
        id: `p_${p.id}`, at: fmtDate(p.occurred_at), status: "done",
        label: p.note || typeLabels[p.payment_type] || p.payment_type,
        amount: money(p.amount),
        meta: `${p.method === "cash" ? "готівка" : "безготівка"}${p.accepted_by_name ? ` · ${p.accepted_by_name}` : ""}`
      });
    });
    if (orderDeposit) {
      if (orderDeposit.used_amount > 0) {
        items.push({
          id: "dep_used", at: fmtDate(orderDeposit.closed_at), status: "warn",
          label: "Утримано із застави", amount: money(-orderDeposit.used_amount), meta: "компенсація"
        });
      }
      if (orderDeposit.refunded_amount > 0) {
        items.push({
          id: "dep_ref", at: fmtDate(orderDeposit.closed_at), status: "done",
          label: "Застава повернута", amount: money(orderDeposit.refunded_amount), meta: ""
        });
      }
    }
    if (damageFees.due_amount > 0) {
      items.push({
        id: "dmg_due", at: "Очікує", status: "warn",
        label: "Шкода (не сплачено)", amount: money(damageFees.due_amount),
        meta: damageFees.items.map(d => d.name).slice(0, 3).join(", ")
      });
    }
    return items.sort((a, b) => (a.at === "Очікує" ? -1 : b.at === "Очікує" ? 1 : 0));
  }, [payments, orderDeposit, damageFees]);
  
  // ===== PAYMENT HANDLERS =====
  const handlePayment = async (paymentType, paymentAmount, paymentMethod, extraData = {}) => {
    if (!selectedOrderId || !paymentAmount || Number(paymentAmount) <= 0) return false;
    setSaving(true);
    const user = getUser();
    
    try {
      if (paymentType === "deposit_in") {
        // Accept deposit (застава)
        const currency = extraData.currency || "UAH";
        const rate = currency === "USD" ? 41.5 : currency === "EUR" ? 45.2 : 1;
        await authFetch(`${BACKEND_URL}/api/finance/deposits/create`, {
          method: "POST",
          body: JSON.stringify({
            order_id: selectedOrderId,
            expected_amount: selectedOrder?.total_deposit || 0,
            actual_amount: Number(paymentAmount),
            currency: currency,
            exchange_rate: rate,
            method: paymentMethod,
            accepted_by_id: user.id,
            accepted_by_name: user.email,
          }),
        });
      } else if (paymentType === "advance") {
        // Advance payment (передплата) - йде в дохід
        await authFetch(`${BACKEND_URL}/api/finance/payments`, {
          method: "POST",
          body: JSON.stringify({
            payment_type: "advance",
            method: paymentMethod,
            amount: Number(paymentAmount),
            order_id: selectedOrderId,
            accepted_by_id: user.id,
            accepted_by_name: user.email,
            note: extraData.note || "Передплата",
          }),
        });
      } else if (paymentType === "deposit_out" && orderDeposit) {
        // Refund deposit
        const available = orderDeposit.available || (orderDeposit.held_amount - orderDeposit.used_amount - orderDeposit.refunded_amount);
        const refundAmount = Math.min(Number(paymentAmount), available);
        await authFetch(`${BACKEND_URL}/api/finance/deposits/${orderDeposit.id}/refund?amount=${refundAmount}&method=${paymentMethod}`, {
          method: "POST",
        });
      } else if (paymentType === "deposit_use" && orderDeposit) {
        // Use deposit for damage
        await authFetch(`${BACKEND_URL}/api/finance/deposits/${orderDeposit.id}/use?amount=${Number(paymentAmount)}`, {
          method: "POST",
          body: JSON.stringify({ note: "Утримання за шкоду" }),
        });
      } else {
        // Regular payment (rent, additional, damage, late)
        await authFetch(`${BACKEND_URL}/api/finance/payments`, {
          method: "POST",
          body: JSON.stringify({
            payment_type: paymentType,
            method: paymentMethod,
            amount: Number(paymentAmount),
            order_id: selectedOrderId,
            accepted_by_id: user.id,
            accepted_by_name: user.email,
            note: extraData.note,
            description: extraData.description,
          }),
        });
      }
      
      await refreshAll();
      setSaving(false);
      return true;
    } catch (e) {
      console.error("Payment error:", e);
      alert("Помилка: " + e.message);
      setSaving(false);
      return false;
    }
  };
  
  // Add expense
  const handleAddExpense = async (category, amount, description, opType = "expense") => {
    if (!amount || Number(amount) <= 0 || !description.trim()) return false;
    setSaving(true);
    const user = getUser();
    
    try {
      await authFetch(`${BACKEND_URL}/api/finance/expenses/simple`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(amount),
          description,
          category,
          operation_type: opType,
          created_by_id: user.id,
          created_by_name: user.email,
        }),
      });
      await loadPayoutsStats();
      await loadAllExpenses();
      setSaving(false);
      return true;
    } catch (e) {
      console.error("Add expense error:", e);
      setSaving(false);
      return false;
    }
  };
  
  // Generate document
  const generateDocument = async (docType) => {
    if (!selectedOrderId) return;
    try {
      const options = selectedPayerProfile ? { payer_profile_id: selectedPayerProfile.id } : {};
      const res = await authFetch(`${BACKEND_URL}/api/documents/generate`, {
        method: "POST",
        body: JSON.stringify({
          doc_type: docType,
          entity_id: String(selectedOrderId),
          format: "html",
          options
        })
      });
      const data = await res.json();
      if (data.success && data.html_content) {
        const win = window.open("", "_blank");
        win.document.write(data.html_content);
        win.document.close();
        await loadOrderSnapshot(selectedOrderId);
      }
    } catch (e) {
      console.error("Generate doc error:", e);
    }
  };
  
  // ===== TABS CONFIG =====
  const TABS = [
    { id: "operations", label: "Операції", icon: "💰" },
    { id: "documents", label: "Документи", icon: "📄" },
    { id: "cash", label: "Каси", icon: "💵" },
    { id: "forecast", label: "План надходжень", icon: "📊" },
    { id: "expenses", label: "Витрати", icon: "📉" },
    { id: "deposits", label: "Депозити", icon: "🔒" },
    { id: "analytics", label: "Аналітика", icon: "📈" },
  ];
  
  // ===== RENDER =====
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
      
      {/* Header with KPI */}
      <div className="sticky top-[60px] z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          {/* Top row: Title + KPI + Controls */}
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-xl font-extrabold">💰 Фінанси</span>
              <div className="hidden sm:flex items-center gap-4 ml-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Готівка:</span>
                  <span className="font-bold text-emerald-600">{money(payoutsStats?.total_cash_balance || 0)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Банк:</span>
                  <span className="font-bold text-blue-600">{money(payoutsStats?.bank_balance || 0)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Застави:</span>
                  <span className="font-bold text-amber-600">{money(depositsByCurrency.UAH)}</span>
                  {depositsByCurrency.USD > 0 && <span className="font-bold text-amber-600">+ ${depositsByCurrency.USD.toFixed(0)}</span>}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[140px]" />
              <Button variant="ghost" onClick={refreshAll} className="!px-3">🔄</Button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
            {TABS.map(tab => (
              <TabButton
                key={tab.id}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                icon={tab.icon}
              >
                {tab.label}
              </TabButton>
            ))}
          </div>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="mx-auto max-w-7xl px-4 py-4">
        {/* TAB: Operations */}
        {activeTab === "operations" && (
          <OperationsTab
            orders={filteredOrders}
            selectedOrderId={selectedOrderId}
            setSelectedOrderId={setSelectedOrderId}
            selectedOrder={selectedOrder}
            orderSnapshot={orderSnapshot}
            orderDeposit={orderDeposit}
            payments={payments}
            damageFees={damageFees}
            lateFeeData={lateFeeData}
            timeline={timeline}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            saving={saving}
            handlePayment={handlePayment}
            refreshAll={refreshAll}
            payoutsStats={payoutsStats}
            depositsByCurrency={depositsByCurrency}
            orderStats={orderStats}
            generateDocument={generateDocument}
            selectedPayerProfile={selectedPayerProfile}
            payerProfiles={payerProfiles}
          />
        )}
        
        {/* TAB: Documents */}
        {activeTab === "documents" && (
          <DocumentsTab
            orders={orders}
            selectedOrderId={selectedOrderId}
            setSelectedOrderId={setSelectedOrderId}
            selectedOrder={selectedOrder}
            documents={documents}
            generateDocument={generateDocument}
            selectedPayerProfile={selectedPayerProfile}
            setSelectedPayerProfile={setSelectedPayerProfile}
            payerProfiles={payerProfiles}
          />
        )}
        
        {/* TAB: Cash */}
        {activeTab === "cash" && (
          <CashTab
            payoutsStats={payoutsStats}
            depositsByCurrency={depositsByCurrency}
            handleAddExpense={handleAddExpense}
            saving={saving}
            refreshAll={refreshAll}
          />
        )}
        
        {/* TAB: Forecast */}
        {activeTab === "forecast" && (
          <ForecastTab orders={orders} />
        )}
        
        {/* TAB: Expenses */}
        {activeTab === "expenses" && (
          <ExpensesTab
            allExpenses={allExpenses}
            handleAddExpense={handleAddExpense}
            saving={saving}
            refreshAll={refreshAll}
          />
        )}
        
        {/* TAB: Deposits */}
        {activeTab === "deposits" && (
          <DepositsTab
            deposits={deposits}
            depositsByCurrency={depositsByCurrency}
          />
        )}
        
        {/* TAB: Analytics */}
        {activeTab === "analytics" && (
          <AnalyticsTab
            orders={orders}
            payoutsStats={payoutsStats}
            deposits={deposits}
            orderStats={orderStats}
          />
        )}
      </div>
    </div>
  );
}


// ============================================================
// TAB: OPERATIONS (Main tab)
// ============================================================
function OperationsTab({
  orders, selectedOrderId, setSelectedOrderId, selectedOrder, orderSnapshot,
  orderDeposit, payments, damageFees, lateFeeData, timeline,
  searchQuery, setSearchQuery, saving, handlePayment, refreshAll,
  payoutsStats, depositsByCurrency, orderStats, generateDocument,
  selectedPayerProfile, payerProfiles
}) {
  // Payment form state
  const [payType, setPayType] = useState("rent");
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState("");
  const [additionalName, setAdditionalName] = useState("");
  const [depositCurrency, setDepositCurrency] = useState("UAH");
  
  // Damage/Late forms
  const [newDamageAmount, setNewDamageAmount] = useState("");
  const [newDamageNote, setNewDamageNote] = useState("");
  const [newLateAmount, setNewLateAmount] = useState("");
  const [newLateNote, setNewLateNote] = useState("");
  
  const getOrderBadge = (order) => {
    const rentDue = Math.max(0, (order.total_rental || 0) - (order.rent_paid || 0));
    const hasDamage = (order.damage_due || 0) > 0;
    if (hasDamage) return { kind: "warn", text: `⚠️ ${money(order.damage_due)}` };
    if (rentDue > 0) return { kind: "pending", text: `⏳ ${money(rentDue)}` };
    return { kind: "ok", text: "✓ OK" };
  };
  
  const needsName = payType === "additional";
  const needsCurrency = payType === "deposit_in";
  const canSubmit = amount.trim().length > 0 && Number(amount) > 0 && (!needsName || additionalName.trim().length > 2);
  
  const onSubmitPayment = async () => {
    const extraData = {};
    if (payType === "additional") extraData.description = additionalName;
    if (payType === "deposit_in") extraData.currency = depositCurrency;
    
    const success = await handlePayment(payType, amount, method, extraData);
    if (success) {
      setAmount("");
      setAdditionalName("");
    }
  };
  
  // Calculate totals with discount
  const totals = useMemo(() => {
    if (!selectedOrder) return null;
    const discount = selectedOrder.discount_amount || 0;
    const totalAfterDiscount = selectedOrder.total_rental - discount;
    const toPay = Math.max(0, totalAfterDiscount - (selectedOrder.rent_paid || 0));
    return { discount, totalAfterDiscount, toPay };
  }, [selectedOrder]);
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* LEFT: Cash summary + Orders list */}
      <div className="lg:col-span-3 space-y-4">
        {/* Mini Cash Summary */}
        <Card title="📊 Каси">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">💵 Готівка</span>
              <span className="font-bold text-emerald-600">{money(payoutsStats?.total_cash_balance || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">🏦 Безготівка</span>
              <span className="font-bold text-blue-600">{money(payoutsStats?.bank_balance || 0)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-100">
              <span className="text-slate-600">🔒 Застави</span>
              <span className="font-bold text-amber-600">
                ₴{depositsByCurrency.UAH.toLocaleString()}
                {depositsByCurrency.USD > 0 && ` + $${depositsByCurrency.USD.toFixed(0)}`}
              </span>
            </div>
          </div>
        </Card>
        
        {/* Orders List */}
        <Card title="📋 Ордери" right={<span className="text-xs text-slate-500">{orders.length}</span>}>
          <div className="mb-3">
            <Input 
              placeholder="код / клієнт / телефон" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="space-y-2 max-h-[450px] overflow-y-auto">
            {orders.length === 0 ? (
              <div className="text-center text-slate-500 py-4">Немає ордерів</div>
            ) : (
              orders.map((o) => {
                const badge = getOrderBadge(o);
                const isSelected = o.order_id === selectedOrderId;
                return (
                  <button
                    key={o.order_id}
                    onClick={() => setSelectedOrderId(o.order_id)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-left transition",
                      isSelected 
                        ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900" 
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900">#{o.order_number}</div>
                      <Badge kind={badge.kind}>{badge.text}</Badge>
                    </div>
                    <div className="text-xs text-slate-500">{o.customer_name || o.client_name}</div>
                  </button>
                );
              })
            )}
          </div>
        </Card>
      </div>
      
      {/* CENTER: Selected Order */}
      <div className="lg:col-span-6 space-y-4">
        {selectedOrder ? (
          <>
            {/* Order Header */}
            <Card
              title={
                <div className="flex items-center gap-2">
                  <span>🔍 Ордер</span>
                  <span className="text-slate-500 font-medium">
                    #{selectedOrder.order_number} · {selectedOrder.customer_name || selectedOrder.client_name}
                  </span>
                </div>
              }
              right={<Badge kind={getOrderBadge(selectedOrder).kind}>{selectedOrder.status}</Badge>}
            >
              {/* KPI Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">Нараховано</div>
                  <div className="text-lg font-bold">{money(selectedOrder.total_rental)}</div>
                  {totals?.discount > 0 && (
                    <div className="text-xs text-emerald-600">− знижка {money(totals.discount)}</div>
                  )}
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">Оплачено</div>
                  <div className="text-lg font-bold text-emerald-600">{money(selectedOrder.rent_paid)}</div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">Застава</div>
                  <div className="text-lg font-bold">{money(selectedOrder.deposit_held)}</div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">До сплати</div>
                  <div className={cn("text-lg font-bold", totals?.toPay > 0 ? "text-amber-600" : "text-emerald-600")}>
                    {money(totals?.toPay || 0)}
                  </div>
                </div>
              </div>
              
              {/* Timeline */}
              {timeline.length > 0 && (
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 mb-4">
                  <div className="text-xs font-semibold text-slate-600 mb-3">ТАЙМЛАЙН ОПЕРАЦІЙ</div>
                  <Timeline items={timeline} />
                </div>
              )}
            </Card>
            
            {/* Payment Form - with SEPARATE buttons for Deposit and Advance */}
            <Card title="💳 Прийняти оплату">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Тип</div>
                  <Select
                    value={payType}
                    onChange={setPayType}
                    options={[
                      { value: "rent", label: "💵 Оренда" },
                      { value: "additional", label: "➕ Донарахування" },
                      { value: "damage", label: "💔 Шкода" },
                      { value: "late", label: "⏰ Прострочення" },
                    ]}
                  />
                </div>
                
                <div>
                  <div className="text-xs text-slate-500 mb-1">Метод</div>
                  <Select
                    value={method}
                    onChange={setMethod}
                    options={[
                      { value: "cash", label: "Готівка" },
                      { value: "bank", label: "Безготівка" },
                    ]}
                  />
                </div>
                
                {needsName && (
                  <div className="sm:col-span-2">
                    <div className="text-xs text-slate-500 mb-1">Назва *</div>
                    <Input
                      value={additionalName}
                      onChange={(e) => setAdditionalName(e.target.value)}
                      placeholder="Доставка, упаковка..."
                    />
                  </div>
                )}
                
                <div>
                  <div className="text-xs text-slate-500 mb-1">Сума (₴)</div>
                  <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" inputMode="decimal" />
                </div>
                
                <div className="flex items-end">
                  <Button className="w-full" disabled={!canSubmit || saving} onClick={onSubmitPayment}>
                    {saving ? "..." : "Зарахувати"}
                  </Button>
                </div>
              </div>
              
              {/* SEPARATE BUTTONS: Deposit vs Advance */}
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="text-xs font-semibold text-slate-600 mb-3">ЗАСТАВА / ПЕРЕДПЛАТА</div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Deposit Button */}
                  <DepositAdvanceButton
                    type="deposit"
                    orderDeposit={orderDeposit}
                    expectedAmount={selectedOrder.total_deposit}
                    handlePayment={handlePayment}
                    saving={saving}
                    method={method}
                  />
                  
                  {/* Advance Button */}
                  <DepositAdvanceButton
                    type="advance"
                    handlePayment={handlePayment}
                    saving={saving}
                    method={method}
                  />
                </div>
              </div>
            </Card>
            
            {/* Deposit Details */}
            {orderDeposit && (
              <Card title="🔒 Застава">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Прийнято</span>
                    <span className="font-semibold">
                      {orderDeposit.currency === "USD" ? "$" : orderDeposit.currency === "EUR" ? "€" : "₴"}
                      {(orderDeposit.actual_amount || orderDeposit.held_amount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Використано</span>
                    <span className="font-semibold text-rose-600">
                      -{orderDeposit.currency === "USD" ? "$" : orderDeposit.currency === "EUR" ? "€" : "₴"}
                      {(orderDeposit.used_amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Повернуто</span>
                    <span className="font-semibold text-blue-600">
                      {orderDeposit.currency === "USD" ? "$" : orderDeposit.currency === "EUR" ? "€" : "₴"}
                      {(orderDeposit.refunded_amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                    <span className="text-slate-700 font-medium">Доступно</span>
                    <span className="font-bold text-emerald-600">
                      {orderDeposit.currency === "USD" ? "$" : orderDeposit.currency === "EUR" ? "€" : "₴"}
                      {(orderDeposit.available || (orderDeposit.held_amount - (orderDeposit.used_amount || 0) - (orderDeposit.refunded_amount || 0))).toLocaleString()}
                    </span>
                  </div>
                  
                  {/* Refund button */}
                  {(orderDeposit.available || (orderDeposit.held_amount - (orderDeposit.used_amount || 0) - (orderDeposit.refunded_amount || 0))) > 0 && (
                    <Button
                      variant="success"
                      className="w-full mt-3"
                      disabled={saving}
                      onClick={async () => {
                        const avail = orderDeposit.available || (orderDeposit.held_amount - (orderDeposit.used_amount || 0) - (orderDeposit.refunded_amount || 0));
                        if (!window.confirm(`Повернути заставу: ${orderDeposit.currency === "USD" ? "$" : orderDeposit.currency === "EUR" ? "€" : "₴"}${avail}?`)) return;
                        await handlePayment("deposit_out", avail, "cash");
                      }}
                    >
                      💸 Повернути заставу
                    </Button>
                  )}
                </div>
              </Card>
            )}
            
            {/* Damage Section */}
            <Card title="💔 Шкода" className="border-rose-200 bg-rose-50/50">
              {damageFees.items?.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-rose-700 mb-2 font-medium">Зафіксовано:</div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {damageFees.items.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-white rounded-lg p-2">
                        <span className="text-rose-800">{d.name} • {d.damage_type}</span>
                        <span className="font-semibold text-rose-600">{money(d.fee)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-right text-sm">
                    <span className="text-rose-700">Всього: </span>
                    <span className="font-bold text-rose-800">{money(damageFees.total_fee)}</span>
                    {damageFees.paid_amount > 0 && (
                      <span className="text-emerald-600 ml-2">(оплачено {money(damageFees.paid_amount)})</span>
                    )}
                  </div>
                </div>
              )}
              
              {damageFees.due_amount > 0 && (
                <div className="p-3 bg-rose-100 rounded-xl mb-3">
                  <div className="text-rose-800 font-semibold">До сплати: {money(damageFees.due_amount)}</div>
                </div>
              )}
              
              {/* Add damage */}
              <div className="flex gap-2">
                <Input 
                  type="number"
                  placeholder="Сума ₴"
                  value={newDamageAmount}
                  onChange={(e) => setNewDamageAmount(e.target.value)}
                  className="flex-1"
                />
                <Input 
                  placeholder="Опис"
                  value={newDamageNote}
                  onChange={(e) => setNewDamageNote(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="danger"
                  size="sm"
                  disabled={!newDamageAmount || saving}
                  onClick={async () => {
                    const success = await handlePayment("damage", newDamageAmount, "cash", { note: newDamageNote });
                    if (success) {
                      setNewDamageAmount("");
                      setNewDamageNote("");
                    }
                  }}
                >
                  Оплатити
                </Button>
              </div>
            </Card>
            
            {/* Late fees */}
            <Card title="⏰ Прострочення" className="border-amber-200 bg-amber-50/50">
              {lateFeeData.due > 0 && (
                <div className="p-3 bg-amber-100 rounded-xl mb-3">
                  <div className="text-amber-800 font-semibold">До сплати: {money(lateFeeData.due)}</div>
                </div>
              )}
              
              {lateFeeData.items?.length > 0 && (
                <div className="mb-3 space-y-1">
                  {lateFeeData.items.map((l, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-amber-700">{l.note || "Прострочення"}</span>
                      <span className={cn("font-semibold", l.status === "pending" ? "text-amber-600" : "text-emerald-600")}>
                        {money(l.amount)} {l.status !== "pending" && "✓"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex gap-2">
                <Input 
                  type="number"
                  placeholder="Сума ₴"
                  value={newLateAmount}
                  onChange={(e) => setNewLateAmount(e.target.value)}
                  className="flex-1"
                />
                <Input 
                  placeholder="Опис"
                  value={newLateNote}
                  onChange={(e) => setNewLateNote(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="warn"
                  size="sm"
                  disabled={!newLateAmount || saving}
                  onClick={async () => {
                    const success = await handlePayment("late", newLateAmount, "cash", { note: newLateNote });
                    if (success) {
                      setNewLateAmount("");
                      setNewLateNote("");
                    }
                  }}
                >
                  Оплатити
                </Button>
              </div>
            </Card>
          </>
        ) : (
          <Card>
            <div className="text-center text-slate-500 py-8">Виберіть ордер зі списку</div>
          </Card>
        )}
      </div>
      
      {/* RIGHT: Statistics & Documents */}
      <div className="lg:col-span-3 space-y-4">
        {/* Stats */}
        <Card title="📊 Статистика">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Ордерів</span>
              <span className="font-semibold">{orderStats.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Оплачено</span>
              <span className="font-semibold text-emerald-600">{orderStats.paid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">З боргом</span>
              <span className="font-semibold text-amber-600">{orderStats.withDebt}</span>
            </div>
          </div>
        </Card>
        
        {/* Quick Documents */}
        {selectedOrder && (
          <Card title="📄 Документи">
            <div className="space-y-2">
              {selectedPayerProfile && (
                <div className="text-xs text-slate-500 mb-2">
                  Платник: <span className="font-medium text-slate-700">{selectedPayerProfile.company_name || "Фіз. особа"}</span>
                </div>
              )}
              
              <div className="text-xs font-medium text-slate-600 mb-1">Фіз. особа:</div>
              {["invoice_offer", "contract_rent", "deposit_settlement_act"].map(docType => (
                <Button
                  key={docType}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => generateDocument(docType)}
                >
                  {docType === "invoice_offer" && "📄 Рахунок-оферта"}
                  {docType === "contract_rent" && "📝 Договір оренди"}
                  {docType === "deposit_settlement_act" && "📋 Акт взаєморозрахунків"}
                </Button>
              ))}
              
              {selectedPayerProfile && selectedPayerProfile.payer_type !== "individual" && (
                <>
                  <div className="text-xs font-medium text-slate-600 mt-3 mb-1">Юр. особа:</div>
                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => generateDocument("invoice_legal")}>
                    📄 Рахунок (юр. особа)
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => generateDocument("service_act")}>
                    📋 Акт виконаних робіт
                  </Button>
                </>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}


// ============================================================
// COMPONENT: Deposit/Advance Button (separated)
// ============================================================
function DepositAdvanceButton({ type, orderDeposit, expectedAmount, handlePayment, saving, method }) {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("UAH");
  const [note, setNote] = useState("");
  
  const isDeposit = type === "deposit";
  const hasDeposit = isDeposit && orderDeposit;
  
  const onSubmit = async () => {
    if (!amount || Number(amount) <= 0) return;
    
    const extraData = isDeposit ? { currency } : { note: note || "Передплата" };
    const success = await handlePayment(
      isDeposit ? "deposit_in" : "advance",
      amount,
      method,
      extraData
    );
    
    if (success) {
      setAmount("");
      setNote("");
      setShowForm(false);
    }
  };
  
  if (!showForm) {
    return (
      <div className="space-y-2">
        <Button
          variant={isDeposit ? "deposit" : "advance"}
          className="w-full"
          onClick={() => setShowForm(true)}
          disabled={saving}
        >
          {isDeposit ? "🔒 Прийняти заставу" : "💜 Прийняти передплату"}
        </Button>
        {hasDeposit && (
          <div className="text-xs text-center text-blue-600">
            Вже прийнято: {orderDeposit.display_amount || money(orderDeposit.held_amount)}
          </div>
        )}
        {isDeposit && expectedAmount > 0 && !hasDeposit && (
          <div className="text-xs text-center text-slate-500">
            Очікується: {money(expectedAmount)}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="p-3 rounded-xl border-2 border-dashed" style={{ borderColor: isDeposit ? "#3b82f6" : "#8b5cf6" }}>
      <div className="text-xs font-semibold mb-2" style={{ color: isDeposit ? "#3b82f6" : "#8b5cf6" }}>
        {isDeposit ? "🔒 ЗАСТАВА" : "💜 ПЕРЕДПЛАТА"}
      </div>
      
      <div className="space-y-2">
        <Input
          type="number"
          placeholder="Сума"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        
        {isDeposit && (
          <Select
            value={currency}
            onChange={setCurrency}
            options={[
              { value: "UAH", label: "₴ UAH" },
              { value: "USD", label: "$ USD" },
              { value: "EUR", label: "€ EUR" },
            ]}
          />
        )}
        
        {!isDeposit && (
          <Input
            placeholder="Примітка (опціонально)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
        
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => setShowForm(false)}
          >
            Скасувати
          </Button>
          <Button
            variant={isDeposit ? "deposit" : "advance"}
            size="sm"
            className="flex-1"
            disabled={!amount || saving}
            onClick={onSubmit}
          >
            {saving ? "..." : "Прийняти"}
          </Button>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// TAB: DOCUMENTS
// ============================================================
function DocumentsTab({ orders, selectedOrderId, setSelectedOrderId, selectedOrder, documents, generateDocument, selectedPayerProfile, setSelectedPayerProfile, payerProfiles }) {
  const DOC_TYPES = {
    individual: [
      { type: "invoice_offer", label: "Рахунок-оферта" },
      { type: "contract_rent", label: "Договір оренди" },
      { type: "deposit_settlement_act", label: "Акт взаєморозрахунків" },
      { type: "deposit_refund_act", label: "Акт повернення застави" },
    ],
    legal: [
      { type: "invoice_legal", label: "Рахунок (юр. особа)" },
      { type: "service_act", label: "Акт виконаних робіт" },
      { type: "goods_invoice", label: "Видаткова накладна" },
    ]
  };
  
  const PAYER_TYPE_LABELS = {
    individual: "Фізична особа",
    fop_simple: "ФОП (спрощена)",
    fop_general: "ФОП (загальна)",
    llc_simple: "ТОВ (спрощена)",
    llc_general: "ТОВ (загальна)"
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left: Order selection */}
      <div className="lg:col-span-3">
        <Card title="📋 Виберіть ордер">
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {orders.slice(0, 50).map(o => (
              <button
                key={o.order_id}
                onClick={() => setSelectedOrderId(o.order_id)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left transition text-sm",
                  o.order_id === selectedOrderId 
                    ? "border-slate-900 bg-slate-50" 
                    : "border-slate-200 hover:bg-slate-50"
                )}
              >
                <div className="font-medium">#{o.order_number}</div>
                <div className="text-xs text-slate-500">{o.customer_name}</div>
              </button>
            ))}
          </div>
        </Card>
      </div>
      
      {/* Center: Payer profile & Document generation */}
      <div className="lg:col-span-6 space-y-4">
        {selectedOrder ? (
          <>
            {/* Payer Profile Selection */}
            <Card title="👤 Тип платника">
              <div className="space-y-3">
                <div className="text-sm text-slate-600">
                  Ордер: <span className="font-semibold">#{selectedOrder.order_number}</span> · {selectedOrder.customer_name}
                </div>
                
                {selectedPayerProfile ? (
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{selectedPayerProfile.company_name || "Фіз. особа"}</div>
                        <div className="text-xs text-slate-500">{PAYER_TYPE_LABELS[selectedPayerProfile.payer_type]}</div>
                        {selectedPayerProfile.edrpou && <div className="text-xs text-slate-500">ЄДРПОУ: {selectedPayerProfile.edrpou}</div>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedPayerProfile(null)}>
                        Змінити
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500">Виберіть існуючий профіль або залиште як фіз. особа:</div>
                    <div className="grid grid-cols-2 gap-2">
                      {payerProfiles.slice(0, 6).map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPayerProfile(p)}
                          className="text-left p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm"
                        >
                          <div className="font-medium truncate">{p.company_name}</div>
                          <div className="text-xs text-slate-500">{PAYER_TYPE_LABELS[p.payer_type]}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
            
            {/* Document Generation */}
            <Card title="📄 Генерація документів">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-2">ДОКУМЕНТИ ДЛЯ ФІЗ. ОСОБИ</div>
                  <div className="grid grid-cols-2 gap-2">
                    {DOC_TYPES.individual.map(doc => (
                      <Button
                        key={doc.type}
                        variant="ghost"
                        onClick={() => generateDocument(doc.type)}
                        className="justify-start"
                      >
                        📄 {doc.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {selectedPayerProfile && selectedPayerProfile.payer_type !== "individual" && (
                  <div>
                    <div className="text-xs font-semibold text-slate-600 mb-2">ДОКУМЕНТИ ДЛЯ ЮР. ОСОБИ</div>
                    <div className="grid grid-cols-2 gap-2">
                      {DOC_TYPES.legal.map(doc => (
                        <Button
                          key={doc.type}
                          variant="ghost"
                          onClick={() => generateDocument(doc.type)}
                          className="justify-start"
                        >
                          📄 {doc.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </>
        ) : (
          <Card>
            <div className="text-center text-slate-500 py-8">Виберіть ордер для генерації документів</div>
          </Card>
        )}
      </div>
      
      {/* Right: Recent documents */}
      <div className="lg:col-span-3">
        <Card title="📜 Останні документи">
          {documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="p-2 bg-slate-50 rounded-lg text-sm">
                  <div className="font-medium">{doc.doc_type}</div>
                  <div className="text-xs text-slate-500">v{doc.version} · {fmtDateShort(doc.created_at)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">Документів поки немає</div>
          )}
        </Card>
      </div>
    </div>
  );
}


// ============================================================
// TAB: CASH
// ============================================================
function CashTab({ payoutsStats, depositsByCurrency, handleAddExpense, saving, refreshAll }) {
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState("rent_cash");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [operationType, setOperationType] = useState("expense");
  
  const onAddExpense = async () => {
    const success = await handleAddExpense(expenseCategory, expenseAmount, expenseDesc, operationType);
    if (success) {
      setExpenseAmount("");
      setExpenseDesc("");
      setShowExpenseForm(false);
    }
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Cash Balance */}
      <Card title="💵 Готівка">
        <div className="space-y-4">
          <div>
            <div className="text-xs text-slate-500 mb-1">Оренда</div>
            <div className="text-2xl font-bold text-emerald-600">{money(payoutsStats?.rent_cash_balance || 0)}</div>
            {payoutsStats?.rent_cash_expenses > 0 && (
              <div className="text-xs text-rose-600">Витрачено: -{money(payoutsStats.rent_cash_expenses)}</div>
            )}
          </div>
          
          <div>
            <div className="text-xs text-slate-500 mb-1">Шкода</div>
            <div className="text-2xl font-bold text-amber-600">{money(payoutsStats?.damage_cash_balance || 0)}</div>
            {payoutsStats?.damage_cash_expenses > 0 && (
              <div className="text-xs text-rose-600">Витрачено: -{money(payoutsStats.damage_cash_expenses)}</div>
            )}
          </div>
          
          <div className="pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-500 mb-1">Всього готівки</div>
            <div className="text-3xl font-bold">{money(payoutsStats?.total_cash_balance || 0)}</div>
          </div>
        </div>
      </Card>
      
      {/* Bank Balance */}
      <Card title="🏦 Безготівка">
        <div className="space-y-4">
          <div>
            <div className="text-xs text-slate-500 mb-1">Оренда</div>
            <div className="text-2xl font-bold text-blue-600">{money(payoutsStats?.rent_bank_balance || 0)}</div>
          </div>
          
          <div>
            <div className="text-xs text-slate-500 mb-1">Шкода</div>
            <div className="text-2xl font-bold text-blue-500">{money(payoutsStats?.damage_bank_balance || 0)}</div>
          </div>
          
          <div className="pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-500 mb-1">Всього безготівки</div>
            <div className="text-3xl font-bold text-blue-600">{money(payoutsStats?.bank_balance || 0)}</div>
          </div>
        </div>
      </Card>
      
      {/* Deposits */}
      <Card title="🔒 Застави (холд)">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-slate-600">₴ UAH</span>
            <span className="text-xl font-bold">{depositsByCurrency.UAH.toLocaleString()}</span>
          </div>
          {depositsByCurrency.USD > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-slate-600">$ USD</span>
              <span className="text-xl font-bold">{depositsByCurrency.USD.toFixed(0)}</span>
            </div>
          )}
          {depositsByCurrency.EUR > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-slate-600">€ EUR</span>
              <span className="text-xl font-bold">{depositsByCurrency.EUR.toFixed(0)}</span>
            </div>
          )}
        </div>
      </Card>
      
      {/* Add expense/deposit */}
      <Card title="➕ Додати операцію" className="lg:col-span-3">
        {!showExpenseForm ? (
          <div className="flex gap-3">
            <Button onClick={() => { setOperationType("expense"); setShowExpenseForm(true); }}>
              📉 Витрата
            </Button>
            <Button variant="success" onClick={() => { setOperationType("deposit"); setShowExpenseForm(true); }}>
              📥 Внесення
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">Категорія</div>
              <Select
                value={expenseCategory}
                onChange={setExpenseCategory}
                options={[
                  { value: "rent_cash", label: "Оренда (готівка)" },
                  { value: "damage_cash", label: "Шкода (готівка)" },
                  { value: "rent_bank", label: "Оренда (банк)" },
                  { value: "damage_bank", label: "Шкода (банк)" },
                ]}
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Сума</div>
              <Input
                type="number"
                placeholder="0"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Опис</div>
              <Input
                placeholder="Опис операції"
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant={operationType === "expense" ? "danger" : "success"}
                disabled={!expenseAmount || !expenseDesc || saving}
                onClick={onAddExpense}
              >
                {saving ? "..." : operationType === "expense" ? "Витрата" : "Внесення"}
              </Button>
              <Button variant="ghost" onClick={() => setShowExpenseForm(false)}>✕</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}


// ============================================================
// TAB: FORECAST
// ============================================================
function ForecastTab({ orders }) {
  const forecast = useMemo(() => {
    const upcoming = orders
      .filter(o => o.status !== "completed" && o.status !== "cancelled")
      .map(o => ({
        ...o,
        rentDue: Math.max(0, (o.total_rental || 0) - (o.rent_paid || 0)),
        depositExpected: Math.max(0, (o.total_deposit || 0) - (o.deposit_held || 0))
      }))
      .filter(o => o.rentDue > 0 || o.depositExpected > 0)
      .sort((a, b) => new Date(a.rental_start_date) - new Date(b.rental_start_date));
    
    const totalRentExpected = upcoming.reduce((s, o) => s + o.rentDue, 0);
    const totalDepositExpected = upcoming.reduce((s, o) => s + o.depositExpected, 0);
    
    return { upcoming, totalRentExpected, totalDepositExpected };
  }, [orders]);
  
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="text-center">
            <div className="text-xs text-slate-500">Очікується оренди</div>
            <div className="text-2xl font-bold text-emerald-600">{money(forecast.totalRentExpected)}</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-xs text-slate-500">Очікується застав</div>
            <div className="text-2xl font-bold text-blue-600">{money(forecast.totalDepositExpected)}</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-xs text-slate-500">Всього очікується</div>
            <div className="text-2xl font-bold">{money(forecast.totalRentExpected + forecast.totalDepositExpected)}</div>
          </div>
        </Card>
      </div>
      
      {/* Upcoming orders */}
      <Card title="📅 Очікувані надходження">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2">Ордер</th>
                <th className="text-left py-2 px-2">Клієнт</th>
                <th className="text-left py-2 px-2">Дата</th>
                <th className="text-right py-2 px-2">Оренда</th>
                <th className="text-right py-2 px-2">Застава</th>
                <th className="text-right py-2 px-2">Всього</th>
              </tr>
            </thead>
            <tbody>
              {forecast.upcoming.map(o => (
                <tr key={o.order_id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-2 font-medium">#{o.order_number}</td>
                  <td className="py-2 px-2">{o.customer_name}</td>
                  <td className="py-2 px-2">{fmtDateShort(o.rental_start_date)}</td>
                  <td className="py-2 px-2 text-right text-emerald-600 font-medium">{o.rentDue > 0 ? money(o.rentDue) : "—"}</td>
                  <td className="py-2 px-2 text-right text-blue-600 font-medium">{o.depositExpected > 0 ? money(o.depositExpected) : "—"}</td>
                  <td className="py-2 px-2 text-right font-bold">{money(o.rentDue + o.depositExpected)}</td>
                </tr>
              ))}
              {forecast.upcoming.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">Немає очікуваних надходжень</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}


// ============================================================
// TAB: EXPENSES
// ============================================================
function ExpensesTab({ allExpenses, handleAddExpense, saving, refreshAll }) {
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("rent_cash");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  
  const expensesByCategory = useMemo(() => {
    const groups = {};
    allExpenses.forEach(e => {
      const cat = e.category || "OTHER";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(e);
    });
    return groups;
  }, [allExpenses]);
  
  const categoryLabels = {
    RENT_CASH_EXPENSE: "Витрати готівка (оренда)",
    DAMAGE_EXPENSE: "Витрати готівка (шкода)",
    RENT_BANK_EXPENSE: "Витрати банк (оренда)",
    DAMAGE_BANK_EXPENSE: "Витрати банк (шкода)",
    RENT_CASH_DEPOSIT: "Внесення готівка (оренда)",
    DAMAGE_CASH_DEPOSIT: "Внесення готівка (шкода)",
    OTHER: "Інше"
  };
  
  return (
    <div className="space-y-4">
      {/* Add expense button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(true)}>➕ Додати витрату</Button>
      </div>
      
      {/* Add form */}
      {showForm && (
        <Card title="Нова витрата">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Select
              value={category}
              onChange={setCategory}
              options={[
                { value: "rent_cash", label: "Оренда (готівка)" },
                { value: "damage_cash", label: "Шкода (готівка)" },
                { value: "rent_bank", label: "Оренда (банк)" },
                { value: "damage_bank", label: "Шкода (банк)" },
              ]}
            />
            <Input type="number" placeholder="Сума" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input placeholder="Опис" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="flex gap-2">
              <Button
                disabled={!amount || !desc || saving}
                onClick={async () => {
                  const success = await handleAddExpense(category, amount, desc, "expense");
                  if (success) {
                    setAmount("");
                    setDesc("");
                    setShowForm(false);
                  }
                }}
              >
                {saving ? "..." : "Додати"}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>✕</Button>
            </div>
          </div>
        </Card>
      )}
      
      {/* Expenses list */}
      <Card title="📉 Історія витрат">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2">Дата</th>
                <th className="text-left py-2 px-2">Категорія</th>
                <th className="text-left py-2 px-2">Опис</th>
                <th className="text-right py-2 px-2">Сума</th>
              </tr>
            </thead>
            <tbody>
              {allExpenses.slice(0, 50).map(e => (
                <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-2">{fmtDateShort(e.created_at)}</td>
                  <td className="py-2 px-2">
                    <Badge kind={e.expense_type === "income" ? "ok" : "warn"}>
                      {categoryLabels[e.category] || e.category}
                    </Badge>
                  </td>
                  <td className="py-2 px-2">{e.description}</td>
                  <td className={cn("py-2 px-2 text-right font-medium", e.expense_type === "income" ? "text-emerald-600" : "text-rose-600")}>
                    {e.expense_type === "income" ? "+" : "-"}{money(e.amount)}
                  </td>
                </tr>
              ))}
              {allExpenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">Немає витрат</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}


// ============================================================
// TAB: DEPOSITS
// ============================================================
function DepositsTab({ deposits, depositsByCurrency }) {
  const activeDeposits = useMemo(() => {
    return deposits
      .filter(d => d.status === "holding" || d.status === "partially_used")
      .sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at));
  }, [deposits]);
  
  const closedDeposits = useMemo(() => {
    return deposits
      .filter(d => d.status === "refunded" || d.status === "fully_used")
      .sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));
  }, [deposits]);
  
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="text-center">
            <div className="text-xs text-slate-500">₴ UAH</div>
            <div className="text-2xl font-bold">{depositsByCurrency.UAH.toLocaleString()}</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-xs text-slate-500">$ USD</div>
            <div className="text-2xl font-bold">{depositsByCurrency.USD.toFixed(0)}</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-xs text-slate-500">€ EUR</div>
            <div className="text-2xl font-bold">{depositsByCurrency.EUR.toFixed(0)}</div>
          </div>
        </Card>
      </div>
      
      {/* Active deposits */}
      <Card title="🔒 Активні застави" right={<Badge kind="pending">{activeDeposits.length}</Badge>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2">Ордер</th>
                <th className="text-left py-2 px-2">Клієнт</th>
                <th className="text-right py-2 px-2">Прийнято</th>
                <th className="text-right py-2 px-2">Використано</th>
                <th className="text-right py-2 px-2">Доступно</th>
                <th className="text-left py-2 px-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {activeDeposits.map(d => (
                <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-2 font-medium">#{d.order_number}</td>
                  <td className="py-2 px-2">{d.customer_name}</td>
                  <td className="py-2 px-2 text-right">{d.display_amount}</td>
                  <td className="py-2 px-2 text-right text-rose-600">{d.used_amount > 0 ? money(d.used_amount) : "—"}</td>
                  <td className="py-2 px-2 text-right font-bold text-emerald-600">{money(d.available)}</td>
                  <td className="py-2 px-2"><Badge kind="pending">{d.status}</Badge></td>
                </tr>
              ))}
              {activeDeposits.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">Немає активних застав</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* Closed deposits */}
      <Card title="📜 Закриті застави" right={<Badge kind="ok">{closedDeposits.length}</Badge>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2">Ордер</th>
                <th className="text-left py-2 px-2">Клієнт</th>
                <th className="text-right py-2 px-2">Було</th>
                <th className="text-right py-2 px-2">Використано</th>
                <th className="text-right py-2 px-2">Повернуто</th>
                <th className="text-left py-2 px-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {closedDeposits.slice(0, 20).map(d => (
                <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-2 font-medium">#{d.order_number}</td>
                  <td className="py-2 px-2">{d.customer_name}</td>
                  <td className="py-2 px-2 text-right">{d.display_amount}</td>
                  <td className="py-2 px-2 text-right text-rose-600">{d.used_amount > 0 ? money(d.used_amount) : "—"}</td>
                  <td className="py-2 px-2 text-right text-blue-600">{d.refunded_amount > 0 ? money(d.refunded_amount) : "—"}</td>
                  <td className="py-2 px-2"><Badge kind="ok">{d.status}</Badge></td>
                </tr>
              ))}
              {closedDeposits.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">Немає закритих застав</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}


// ============================================================
// TAB: ANALYTICS
// ============================================================
function AnalyticsTab({ orders, payoutsStats, deposits, orderStats }) {
  const analytics = useMemo(() => {
    const totalRevenue = (payoutsStats?.total_cash_balance || 0) + (payoutsStats?.bank_balance || 0);
    const totalDeposits = deposits.reduce((s, d) => s + (d.held_amount || 0), 0);
    const avgOrderValue = orders.length > 0 ? orders.reduce((s, o) => s + (o.total_rental || 0), 0) / orders.length : 0;
    const paidRate = orderStats.total > 0 ? (orderStats.paid / orderStats.total * 100).toFixed(1) : 0;
    
    return { totalRevenue, totalDeposits, avgOrderValue, paidRate };
  }, [orders, payoutsStats, deposits, orderStats]);
  
  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="text-center">
            <div className="text-xs text-slate-500">Загальний дохід</div>
            <div className="text-2xl font-bold text-emerald-600">{money(analytics.totalRevenue)}</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-xs text-slate-500">Застави в холді</div>
            <div className="text-2xl font-bold text-blue-600">{money(analytics.totalDeposits)}</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-xs text-slate-500">Середній чек</div>
            <div className="text-2xl font-bold">{money(analytics.avgOrderValue)}</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-xs text-slate-500">% оплачених</div>
            <div className="text-2xl font-bold text-violet-600">{analytics.paidRate}%</div>
          </div>
        </Card>
      </div>
      
      {/* Revenue breakdown */}
      <Card title="💰 Розбивка доходу">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-slate-600 mb-3">Готівка</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Оренда</span>
                <span className="font-semibold text-emerald-600">{money(payoutsStats?.rent_cash_balance || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Шкода</span>
                <span className="font-semibold text-amber-600">{money(payoutsStats?.damage_cash_balance || 0)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                <span className="font-medium">Всього</span>
                <span className="font-bold">{money(payoutsStats?.total_cash_balance || 0)}</span>
              </div>
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium text-slate-600 mb-3">Безготівка</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Оренда</span>
                <span className="font-semibold text-blue-600">{money(payoutsStats?.rent_bank_balance || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Шкода</span>
                <span className="font-semibold text-blue-500">{money(payoutsStats?.damage_bank_balance || 0)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                <span className="font-medium">Всього</span>
                <span className="font-bold">{money(payoutsStats?.bank_balance || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
      
      {/* Order stats */}
      <Card title="📊 Статистика ордерів">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold">{orderStats.total}</div>
            <div className="text-sm text-slate-500">Всього ордерів</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-emerald-600">{orderStats.paid}</div>
            <div className="text-sm text-slate-500">Оплачено</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-amber-600">{orderStats.withDebt}</div>
            <div className="text-sm text-slate-500">З боргом</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
