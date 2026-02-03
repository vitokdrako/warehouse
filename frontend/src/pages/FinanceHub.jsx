/* eslint-disable */
/**
 * Finance Hub 2.0 - Уніфікований фінансовий центр
 * Всі 4 вкладки в одному вікні з реальними даними
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
    kind === "warn" && "bg-rose-50 text-rose-700 border border-rose-100"
  )}>
    {children}
  </span>
);

const Card = ({ title, right, children, className }) => (
  <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
    {(title || right) && (
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        <div>{right}</div>
      </div>
    )}
    <div className="p-4">{children}</div>
  </div>
);

const StatRow = ({ label, value, sub }) => (
  <div className="flex items-baseline justify-between gap-3 py-2">
    <div className="text-sm text-slate-600">{label}</div>
    <div className="text-right">
      <div className="text-sm font-semibold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
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

const Button = ({ children, variant = "primary", ...props }) => (
  <button
    {...props}
    className={cn(
      "h-10 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed",
      variant === "primary" && "bg-slate-900 text-white hover:bg-slate-800",
      variant === "ghost" && "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
      variant === "warn" && "bg-amber-500 text-white hover:bg-amber-600",
      variant === "danger" && "bg-rose-500 text-white hover:bg-rose-600",
      props.className
    )}
  >
    {children}
  </button>
);

// ===== MAIN COMPONENT =====
export default function FinanceHub() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activeTabMobile, setActiveTabMobile] = useState("order");
  
  // Data states
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [payoutsStats, setPayoutsStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [damageFees, setDamageFees] = useState({ total_fee: 0, paid_amount: 0, due_amount: 0, items: [] });
  const [lateFeeData, setLateFeeData] = useState({ total: 0, paid: 0, due: 0, items: [] });
  const [estimatedLateFee, setEstimatedLateFee] = useState(0); // Орієнтовна сума прострочення
  
  // Damage and late fee payment form states
  const [damagePayAmount, setDamagePayAmount] = useState("");
  const [newDamageAmount, setNewDamageAmount] = useState("");
  const [newDamageNote, setNewDamageNote] = useState("");
  const [newLateAmount, setNewLateAmount] = useState("");
  const [newLateNote, setNewLateNote] = useState("");
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Search
  const [searchQuery, setSearchQuery] = useState("");
  
  // Payment form
  const [payType, setPayType] = useState("rent");
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState("");
  const [additionalName, setAdditionalName] = useState("");
  const [depositCurrency, setDepositCurrency] = useState("UAH");
  
  // Expense modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseType, setExpenseType] = useState("rent_cash"); // "rent_cash", "damage_cash", "rent_bank", "damage_bank"
  const [operationType, setOperationType] = useState("expense"); // "expense" or "deposit"
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  
  // All operations modal
  const [showOperationsModal, setShowOperationsModal] = useState(false);
  const [allExpenses, setAllExpenses] = useState([]);
  
  // Get current user
  const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");
  
  // ===== DATA LOADING =====
  const loadOrders = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/manager/finance/orders-with-finance?limit=100`);
      const data = await res.json();
      setOrders(data.orders || []);
      // Auto-select first order
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
      const res = await authFetch(`${BACKEND_URL}/api/finance/payouts-stats`);
      const data = await res.json();
      setPayoutsStats(data);
    } catch (e) {
      console.error("Load stats error:", e);
    }
  }, []);
  
  const loadPayments = useCallback(async (orderId) => {
    if (!orderId) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/payments?order_id=${orderId}&limit=50`);
      const data = await res.json();
      setPayments(data.payments || []);
    } catch (e) {
      console.error("Load payments error:", e);
    }
  }, []);
  
  const loadDocuments = useCallback(async (orderId) => {
    if (!orderId) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/documents/entity/order/${orderId}`);
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (e) {
      console.error("Load documents error:", e);
    }
  }, []);
  
  const loadDamageFees = useCallback(async (orderId) => {
    if (!orderId) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/analytics/order-damage-fee/${orderId}`);
      const data = await res.json();
      setDamageFees({
        total_fee: data.total_damage_fee || 0,
        paid_amount: data.paid_damage || 0,
        due_amount: data.due_amount || 0,
        items: data.damage_items || []
      });
    } catch (e) {
      console.error("Load damage fees error:", e);
      setDamageFees({ total_fee: 0, paid_amount: 0, due_amount: 0, items: [] });
    }
  }, []);
  
  // Load late fees (прострочення) for order
  const loadLateFees = useCallback(async (orderId) => {
    if (!orderId) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/order/${orderId}/charges`);
      const data = await res.json();
      setLateFeeData({
        total: (data.late?.due || 0) + (data.late?.paid || 0),
        paid: data.late?.paid || 0,
        due: data.late?.due || 0,
        items: data.late?.items || []
      });
      
      // Завантажуємо орієнтовну суму прострочення з order_extensions
      try {
        const extRes = await authFetch(`${BACKEND_URL}/api/partial-returns/order/${orderId}/extension-summary`);
        const extData = await extRes.json();
        // Сума = active.total_charged + completed.total_charged (якщо ще не оплачено)
        const estimated = (extData.active?.total_charged || 0) + (extData.completed?.total_charged || 0);
        setEstimatedLateFee(estimated);
      } catch (e) {
        setEstimatedLateFee(0);
      }
    } catch (e) {
      console.error("Load late fees error:", e);
      setLateFeeData({ total: 0, paid: 0, due: 0, items: [] });
      setEstimatedLateFee(0);
    }
  }, []);
  
  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([loadOrders(), loadDeposits(), loadPayoutsStats()]);
      setLoading(false);
    };
    loadAll();
  }, []);
  
  // Load order-specific data when selection changes
  useEffect(() => {
    if (selectedOrderId) {
      loadPayments(selectedOrderId);
      loadDocuments(selectedOrderId);
      loadDamageFees(selectedOrderId);
      loadLateFees(selectedOrderId);
      loadOrderPayer(selectedOrderId);
    }
  }, [selectedOrderId]);
  
  // Load payer profiles on mount
  useEffect(() => {
    loadPayerProfiles();
  }, []);
  
  // Refresh all data
  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadOrders(),
      loadDeposits(),
      loadPayoutsStats(),
      selectedOrderId && loadPayments(selectedOrderId),
      selectedOrderId && loadDamageFees(selectedOrderId),
      selectedOrderId && loadLateFees(selectedOrderId)
    ]);
  }, [selectedOrderId]);
  
  // Load all expenses for modal
  const loadAllExpenses = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/expenses/all?limit=100`);
      const data = await res.json();
      setAllExpenses(data.expenses || []);
    } catch (e) {
      console.error("Load expenses error:", e);
      setAllExpenses([]);
    }
  }, []);
  
  // Add expense
  const handleAddExpense = async () => {
    if (!expenseAmount || Number(expenseAmount) <= 0 || !expenseDescription.trim()) return;
    
    setSaving(true);
    const user = getUser();
    
    try {
      await authFetch(`${BACKEND_URL}/api/finance/expenses/simple`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(expenseAmount),
          description: expenseDescription,
          category: expenseType, // "rent_cash", "damage_cash", "rent_bank", "damage_bank"
          operation_type: operationType, // "expense" or "deposit"
          created_by_id: user.id,
          created_by_name: user.email,
        }),
      });
      
      setExpenseAmount("");
      setExpenseDescription("");
      setShowExpenseModal(false);
      await loadPayoutsStats();
    } catch (e) {
      console.error("Add expense error:", e);
      alert("Помилка: " + e.message);
    }
    setSaving(false);
  };
  
  // ===== SELECTED ORDER DATA =====
  const selectedOrder = useMemo(() => {
    return orders.find(o => o.order_id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);
  
  const orderDeposit = useMemo(() => {
    if (!selectedOrderId) return null;
    return deposits.find(d => d.order_id === selectedOrderId) || null;
  }, [deposits, selectedOrderId]);
  
  // Build timeline from payments
  const timeline = useMemo(() => {
    const items = [];
    
    // Add payments to timeline
    payments.forEach(p => {
      const typeLabels = {
        rent: "Оренда",
        additional: "Донарахування",
        damage: "Шкода",
        deposit: "Застава прийнята"
      };
      const methodLabels = { cash: "готівка", bank: "безготівка" };
      
      items.push({
        id: `p_${p.id}`,
        at: fmtDate(p.occurred_at),
        status: "done",
        label: p.note || typeLabels[p.payment_type] || p.payment_type,
        amount: money(p.amount),
        meta: `${methodLabels[p.method] || p.method}${p.accepted_by_name ? ` · ${p.accepted_by_name}` : ""}`
      });
    });
    
    // Add deposit operations to timeline
    if (orderDeposit) {
      const currencySymbol = orderDeposit.currency === "USD" ? "$" : orderDeposit.currency === "EUR" ? "€" : "₴";
      
      // Утримання із застави
      if (orderDeposit.used_amount > 0 || orderDeposit.used_amount_original > 0) {
        const usedAmount = orderDeposit.used_amount_original || orderDeposit.used_amount;
        items.push({
          id: "deposit_used",
          at: fmtDate(orderDeposit.closed_at || new Date().toISOString()),
          status: "warn",
          label: "Утримано із застави",
          amount: `-${currencySymbol}${usedAmount.toLocaleString("uk-UA")}`,
          meta: "компенсація шкоди"
        });
      }
      
      // Повернення застави
      if (orderDeposit.refunded_amount > 0 || orderDeposit.refunded_amount_original > 0) {
        const refundedAmount = orderDeposit.refunded_amount_original || orderDeposit.refunded_amount;
        items.push({
          id: "deposit_refunded",
          at: fmtDate(orderDeposit.closed_at || new Date().toISOString()),
          status: "done",
          label: "Застава повернута",
          amount: `${currencySymbol}${refundedAmount.toLocaleString("uk-UA")}`,
          meta: orderDeposit.status === "refunded" ? "закрито" : ""
        });
      }
    }
    
    // Add pending damage
    if (damageFees.due > 0) {
      items.push({
        id: "damage_due",
        at: "Очікує",
        status: "warn",
        label: "Шкода (не сплачено)",
        amount: money(damageFees.due),
        meta: damageFees.items.map(d => d.product_name).join(", ")
      });
    }
    
    // Sort by date (newest first)
    return items.sort((a, b) => {
      if (a.at === "Очікує") return -1;
      if (b.at === "Очікує") return 1;
      return 0;
    });
  }, [payments, damageFees, orderDeposit]);
  
  // Filter orders by search
  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return orders;
    return orders.filter(o =>
      (o.order_number || "").toLowerCase().includes(q) ||
      (o.customer_name || o.client_name || "").toLowerCase().includes(q) ||
      (o.customer_phone || "").toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);
  
  // Get order badge
  const getOrderBadge = (order) => {
    const rentDue = Math.max(0, (order.total_rental || 0) - (order.rent_paid || 0));
    const hasDamage = (order.damage_due || 0) > 0;
    
    if (hasDamage) return { kind: "warn", text: `⚠️ ${money(order.damage_due)}` };
    if (rentDue > 0) return { kind: "pending", text: `⏳ ${money(rentDue)}` };
    return { kind: "ok", text: "✓ OK" };
  };
  
  // ===== PAYMENT ACTIONS =====
  const handlePayment = async () => {
    if (!selectedOrderId || !amount || Number(amount) <= 0) return;
    if (payType === "additional" && !additionalName.trim()) return;
    
    setSaving(true);
    const user = getUser();
    
    try {
      if (payType === "deposit_in") {
        // Accept deposit
        const rate = depositCurrency === "USD" ? 41.5 : depositCurrency === "EUR" ? 45.2 : 1;
        await authFetch(`${BACKEND_URL}/api/finance/deposits/create`, {
          method: "POST",
          body: JSON.stringify({
            order_id: selectedOrderId,
            expected_amount: selectedOrder?.total_deposit || 0,
            actual_amount: Number(amount),
            currency: depositCurrency,
            exchange_rate: rate,
            held_amount: depositCurrency === "UAH" ? Number(amount) : Number(amount) * rate,
            method,
            accepted_by_id: user.id,
            accepted_by_name: user.email,
          }),
        });
      } else if (payType === "deposit_out" && orderDeposit) {
        // Refund deposit
        const available = (orderDeposit.held_amount || 0) - (orderDeposit.used_amount || 0) - (orderDeposit.refunded_amount || 0);
        const refundAmount = Math.min(Number(amount), available);
        await authFetch(`${BACKEND_URL}/api/finance/deposits/${orderDeposit.id}/refund?amount=${refundAmount}&method=${method}`, {
          method: "POST",
        });
      } else if (payType === "deposit_use" && orderDeposit) {
        // Use deposit for damage
        await authFetch(`${BACKEND_URL}/api/finance/deposits/${orderDeposit.id}/use?amount=${Number(amount)}`, {
          method: "POST",
          body: JSON.stringify({ note: "Утримання за шкоду" }),
        });
      } else {
        // Regular payment (rent, additional, damage)
        await authFetch(`${BACKEND_URL}/api/finance/payments`, {
          method: "POST",
          body: JSON.stringify({
            payment_type: payType,
            method,
            amount: Number(amount),
            order_id: selectedOrderId,
            accepted_by_id: user.id,
            accepted_by_name: user.email,
            note: payType === "additional" ? additionalName : undefined,
          }),
        });
      }
      
      // Reset form and refresh
      setAmount("");
      setAdditionalName("");
      await refreshAll();
    } catch (e) {
      console.error("Payment error:", e);
      alert("Помилка: " + e.message);
    }
    setSaving(false);
  };
  
  // ===== DOCUMENT ACTIONS =====
  const generateDocument = async (docType) => {
    if (!selectedOrderId) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/documents/generate`, {
        method: "POST",
        body: JSON.stringify({
          doc_type: docType,
          entity_id: String(selectedOrderId),
          format: "html"
        })
      });
      const data = await res.json();
      if (data.success && data.html_content) {
        const win = window.open("", "_blank");
        win.document.write(data.html_content);
        win.document.close();
        await loadDocuments(selectedOrderId);
      }
    } catch (e) {
      console.error("Generate doc error:", e);
    }
  };
  
  const viewDocument = async (doc) => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/documents/${doc.id}`);
      const data = await res.json();
      if (data.html_content) {
        const win = window.open("", "_blank");
        win.document.write(data.html_content);
        win.document.close();
      }
    } catch (e) {
      console.error("View doc error:", e);
    }
  };
  
  // Calculate stats
  const stats = useMemo(() => {
    const total = orders.length;
    const paid = orders.filter(o => {
      const rentDue = Math.max(0, (o.total_rental || 0) - (o.rent_paid || 0));
      return rentDue <= 0 && (o.damage_due || 0) <= 0;
    }).length;
    const withDebt = total - paid;
    
    return { total, paid, withDebt };
  }, [orders]);
  
  // Deposits by currency
  const depositsByCurrency = useMemo(() => {
    const result = { UAH: 0, USD: 0, EUR: 0 };
    deposits.forEach(d => {
      const available = (d.held_amount || 0) - (d.used_amount || 0) - (d.refunded_amount || 0);
      if (available > 0) {
        const currency = d.currency || "UAH";
        if (currency === "UAH") {
          result.UAH += available;
        } else if (currency === "USD") {
          result.USD += d.actual_amount - (d.used_amount_original || 0) - (d.refunded_amount_original || 0);
        } else if (currency === "EUR") {
          result.EUR += d.actual_amount - (d.used_amount_original || 0) - (d.refunded_amount_original || 0);
        }
      }
    });
    return result;
  }, [deposits]);
  
  // Form validation
  const needsName = payType === "additional";
  const needsCurrency = payType === "deposit_in";
  const canSubmit = amount.trim().length > 0 && Number(amount) > 0 && (!needsName || additionalName.trim().length > 2);
  
  // Document types
  const DOC_TYPES = [
    { type: "invoice_offer", title: "Рахунок-оферта", forIndividual: true },
    { type: "contract_rent", title: "Договір оренди", forIndividual: true },
    { type: "deposit_settlement_act", title: "Акт взаєморозрахунків", forIndividual: true },
    { type: "deposit_refund_act", title: "Акт повернення застави", forIndividual: true },
    { type: "invoice_additional", title: "Рахунок на доплату", forIndividual: true },
  ];
  
  // Legal entity document types
  const LEGAL_DOC_TYPES = [
    { type: "invoice_legal", title: "Рахунок (юр. особа)", forLegal: true },
    { type: "service_act", title: "Акт виконаних робіт", forSimplified: true },
    { type: "goods_invoice", title: "Видаткова накладна", forGeneral: true },
  ];
  
  // Payer profile state
  const [showPayerModal, setShowPayerModal] = useState(false);
  const [payerProfiles, setPayerProfiles] = useState([]);
  const [selectedPayerProfile, setSelectedPayerProfile] = useState(null);
  const [payerForm, setPayerForm] = useState({
    payer_type: "fop_simple",
    company_name: "",
    edrpou: "",
    iban: "",
    bank_name: "",
    director_name: "",
    address: "",
    is_vat_payer: false
  });
  
  // Load payer profiles
  const loadPayerProfiles = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/payer-profiles`);
      const data = await res.json();
      setPayerProfiles(data.profiles || []);
    } catch (e) {
      console.error("Load payer profiles error:", e);
    }
  }, []);
  
  // Load order payer
  const loadOrderPayer = useCallback(async (orderId) => {
    if (!orderId) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/payer-profiles/order/${orderId}`);
      const data = await res.json();
      setSelectedPayerProfile(data.profile || null);
    } catch (e) {
      console.error("Load order payer error:", e);
      setSelectedPayerProfile(null);
    }
  }, []);
  
  // Save payer profile
  const handleSavePayerProfile = async () => {
    if (!payerForm.company_name.trim()) return;
    
    setSaving(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/payer-profiles`, {
        method: "POST",
        body: JSON.stringify(payerForm)
      });
      const data = await res.json();
      
      if (data.success && selectedOrderId) {
        // Assign to order
        await authFetch(`${BACKEND_URL}/api/payer-profiles/order/${selectedOrderId}/assign/${data.profile_id}`, {
          method: "POST"
        });
        await loadPayerProfiles();
        await loadOrderPayer(selectedOrderId);
      }
      
      setShowPayerModal(false);
      setPayerForm({
        payer_type: "fop_simple",
        company_name: "",
        edrpou: "",
        iban: "",
        bank_name: "",
        director_name: "",
        address: "",
        is_vat_payer: false
      });
    } catch (e) {
      console.error("Save payer profile error:", e);
      alert("Помилка: " + e.message);
    }
    setSaving(false);
  };
  
  // Assign existing payer profile to order
  const handleAssignPayerProfile = async (profileId) => {
    if (!selectedOrderId) return;
    
    setSaving(true);
    try {
      await authFetch(`${BACKEND_URL}/api/payer-profiles/order/${selectedOrderId}/assign/${profileId}`, {
        method: "POST"
      });
      await loadOrderPayer(selectedOrderId);
    } catch (e) {
      console.error("Assign payer error:", e);
    }
    setSaving(false);
  };
  
  // Generate document with payer profile
  const generateLegalDocument = async (docType) => {
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
        await loadDocuments(selectedOrderId);
      }
    } catch (e) {
      console.error("Generate doc error:", e);
    }
  };
  
  // Payer type labels
  const PAYER_TYPE_LABELS = {
    individual: "Фіз. особа",
    fop_simple: "ФОП (спрощена)",
    fop_general: "ФОП (загальна)",
    llc_simple: "ТОВ (спрощена)",
    llc_general: "ТОВ (загальна)"
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Завантаження...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Corporate Header */}
      <CorporateHeader />
      
      {/* Finance Controls */}
      <div className="sticky top-[60px] z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold">💰 Фінанси</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-xs text-slate-500">Місяць</div>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-[140px]"
            />
            <Button variant="ghost" onClick={refreshAll} className="!px-3">🔄</Button>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="mx-auto max-w-7xl px-4 pb-3 sm:hidden">
          <div className="grid grid-cols-3 gap-2">
            <Button variant={activeTabMobile === "kasy" ? "primary" : "ghost"} onClick={() => setActiveTabMobile("kasy")}>
              Каси
            </Button>
            <Button variant={activeTabMobile === "order" ? "primary" : "ghost"} onClick={() => setActiveTabMobile("order")}>
              Ордер
            </Button>
            <Button variant={activeTabMobile === "actions" ? "primary" : "ghost"} onClick={() => setActiveTabMobile("actions")}>
              Дії
            </Button>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          
          {/* LEFT: Каси + Ордери */}
          <div className={cn("sm:col-span-3 space-y-4", activeTabMobile !== "kasy" && "hidden sm:block")}>
            <Card title="📊 Каси">
              <div className="divide-y divide-slate-100">
                <div className="pb-2">
                  <div className="text-xs font-semibold text-slate-500 mb-2">💵 Готівка</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Оренда</span>
                      <span className="font-semibold text-emerald-600">{money(payoutsStats?.rent_cash_balance || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Шкода</span>
                      <span className="font-semibold text-amber-600">{money(payoutsStats?.damage_cash_balance || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
                      <span className="text-slate-700 font-medium">Разом</span>
                      <span className="font-bold">{money(payoutsStats?.total_cash_balance || 0)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="py-2">
                  <div className="text-xs font-semibold text-slate-500 mb-2">🏦 Безготівка</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Оренда</span>
                      <span className="font-semibold">{money(payoutsStats?.rent_bank_balance || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Шкода</span>
                      <span className="font-semibold">{money(payoutsStats?.damage_bank_balance || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
                      <span className="text-slate-700 font-medium">Разом</span>
                      <span className="font-bold">{money(payoutsStats?.bank_balance || 0)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="py-2">
                  <div className="text-xs font-semibold text-slate-500 mb-2">🔒 Застави (холд)</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">₴</span>
                      <span className="font-semibold">{depositsByCurrency.UAH.toLocaleString("uk-UA")}</span>
                    </div>
                    {depositsByCurrency.USD > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">$</span>
                        <span className="font-semibold">{depositsByCurrency.USD.toLocaleString("uk-UA")}</span>
                      </div>
                    )}
                    {depositsByCurrency.EUR > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">€</span>
                        <span className="font-semibold">{depositsByCurrency.EUR.toLocaleString("uk-UA")}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <div className="text-xs font-semibold text-slate-500 mb-2">📉 Витрати</div>
                  <div className="space-y-1">
                    <div className="text-xs text-slate-400 mb-1">Готівка:</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 pl-2">Оренда</span>
                      <span className="font-semibold text-rose-600">-{money(payoutsStats?.rent_cash_expenses || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 pl-2">Шкода</span>
                      <span className="font-semibold text-rose-600">-{money(payoutsStats?.damage_cash_expenses || 0)}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-2 mb-1">Безготівка:</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 pl-2">Оренда</span>
                      <span className="font-semibold text-rose-600">-{money(payoutsStats?.rent_bank_expenses || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 pl-2">Шкода</span>
                      <span className="font-semibold text-rose-600">-{money(payoutsStats?.damage_bank_expenses || 0)}</span>
                    </div>
                  </div>
                </div>
                
                {(payoutsStats?.rent_cash_deposits > 0 || payoutsStats?.damage_cash_deposits > 0) && (
                  <div className="pt-2">
                    <div className="text-xs font-semibold text-slate-500 mb-2">📥 Внесення</div>
                    <div className="space-y-1">
                      {payoutsStats?.rent_cash_deposits > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Оренда</span>
                          <span className="font-semibold text-emerald-600">+{money(payoutsStats.rent_cash_deposits)}</span>
                        </div>
                      )}
                      {payoutsStats?.damage_cash_deposits > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Шкода</span>
                          <span className="font-semibold text-emerald-600">+{money(payoutsStats.damage_cash_deposits)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card title="📋 Ордери" right={<span className="text-xs text-slate-500">{filteredOrders.length}</span>}>
              <div className="mb-3">
                <Input 
                  placeholder="код / клієнт / телефон" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredOrders.length === 0 ? (
                  <div className="text-center text-slate-500 py-4">Немає ордерів</div>
                ) : (
                  filteredOrders.map((o) => {
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

          {/* CENTER: Активний ордер */}
          <div className={cn("sm:col-span-6 space-y-4", activeTabMobile !== "order" && "hidden sm:block")}>
            {selectedOrder ? (
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
                <div className="space-y-4">
                  {/* KPI Row - з урахуванням знижки */}
                  {(() => {
                    const discount = selectedOrder.discount_amount || 0;
                    const totalAfterDiscount = selectedOrder.total_rental - discount;
                    const toPay = Math.max(0, totalAfterDiscount - selectedOrder.rent_paid);
                    
                    return (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                            <div className="text-xs text-slate-500">Нараховано</div>
                            <div className="text-lg font-bold">{money(selectedOrder.total_rental)}</div>
                            {discount > 0 && (
                              <div className="text-xs text-emerald-600 mt-1">
                                − знижка {money(discount)}
                              </div>
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
                            <div className={cn(
                              "text-lg font-bold",
                              toPay > 0 ? "text-amber-600" : "text-emerald-600"
                            )}>
                              {money(toPay)}
                            </div>
                            {discount > 0 && (
                              <div className="text-xs text-slate-400 mt-1">
                                {money(totalAfterDiscount)} після знижки
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Знижка - редагована */}
                        {discount > 0 && (
                          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-xs text-emerald-700 font-medium">🏷️ ЗНИЖКА</div>
                                <div className="text-lg font-bold text-emerald-700">
                                  {selectedOrder.discount_percent > 0 && `${selectedOrder.discount_percent}% = `}
                                  {money(discount)}
                                </div>
                                <div className="text-xs text-emerald-600 mt-1">
                                  Фінальна сума: {money(totalAfterDiscount)}
                                </div>
                              </div>
                              <button
                                className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-200"
                                onClick={async () => {
                                  const newAmount = prompt("Введіть нову суму знижки:", discount);
                                  if (newAmount === null) return;
                                  const amount = parseFloat(newAmount);
                                  if (isNaN(amount) || amount < 0) {
                                    alert("Невірна сума");
                                    return;
                                  }
                                  setSaving(true);
                                  try {
                                    await authFetch(`${BACKEND_URL}/api/finance/order/${selectedOrderId}/discount`, {
                                      method: "PUT",
                                      body: JSON.stringify({ amount, note: `Знижка (редаговано)` })
                                    });
                                    await refreshAll();
                                  } catch (e) {
                                    alert("Помилка: " + e.message);
                                  }
                                  setSaving(false);
                                }}
                              >
                                ✏️ Редагувати
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Timeline */}
                  {timeline.length > 0 && (
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                      <div className="text-xs font-semibold text-slate-600 mb-3">ТАЙМЛАЙН ОПЕРАЦІЙ</div>
                      <Timeline items={timeline} />
                    </div>
                  )}

                  {/* Damage Alert */}
                  {damageFees.due > 0 && (
                    <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div className="flex-1">
                          <div className="font-semibold text-rose-900">Непогашена шкода: {money(damageFees.due)}</div>
                          <div className="text-sm text-rose-700 mt-1">
                            {damageFees.items.map(d => `${d.product_name}: ${money(d.fee)}`).join(", ")}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment Form */}
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="text-sm font-semibold">💳 Прийняти оплату</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Тип</div>
                        <Select
                          value={payType}
                          onChange={setPayType}
                          options={[
                            { value: "rent", label: "Оренда" },
                            { value: "additional", label: "Донарахування" },
                            { value: "damage", label: "Шкода" },
                            { value: "deposit_in", label: "Прийом застави" },
                            { value: "deposit_use", label: "Утримання із застави" },
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

                      {needsCurrency && (
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Валюта</div>
                          <Select
                            value={depositCurrency}
                            onChange={setDepositCurrency}
                            options={[
                              { value: "UAH", label: "₴ UAH" },
                              { value: "USD", label: "$ USD" },
                              { value: "EUR", label: "€ EUR" },
                            ]}
                          />
                        </div>
                      )}

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
                        <div className="text-xs text-slate-500 mb-1">Сума {needsCurrency && depositCurrency !== "UAH" ? `(${depositCurrency})` : "(₴)"}</div>
                        <Input 
                          value={amount} 
                          onChange={(e) => setAmount(e.target.value)} 
                          placeholder="0" 
                          inputMode="decimal" 
                        />
                      </div>

                      <div className="flex items-end">
                        <Button
                          className="w-full"
                          disabled={!canSubmit || saving}
                          onClick={handlePayment}
                        >
                          {saving ? "..." : "Зарахувати"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Deposit Block */}
                  {orderDeposit && (
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="text-sm font-semibold">🔒 Застава</div>
                        <span className="text-xs text-slate-500">{orderDeposit.currency || "UAH"}</span>
                      </div>
                      <div className="text-sm text-slate-700">
                        Прийнято: <span className="font-semibold">
                          {orderDeposit.currency === "USD" ? "$" : orderDeposit.currency === "EUR" ? "€" : "₴"}
                          {(orderDeposit.actual_amount || orderDeposit.held_amount).toLocaleString("uk-UA")}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700">
                        Використано: <span className="font-semibold">
                          {orderDeposit.currency === "USD" ? "$" : orderDeposit.currency === "EUR" ? "€" : "₴"}
                          {(orderDeposit.used_amount_original || orderDeposit.used_amount || 0).toLocaleString("uk-UA")}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700">
                        Повернуто: <span className="font-semibold">
                          {orderDeposit.currency === "USD" ? "$" : orderDeposit.currency === "EUR" ? "€" : "₴"}
                          {(orderDeposit.refunded_amount_original || orderDeposit.refunded_amount || 0).toLocaleString("uk-UA")}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 mt-2 pt-2 border-t border-slate-200">
                        <strong>Доступно:</strong> <span className="font-bold text-emerald-600">
                          {orderDeposit.currency === "USD" ? "$" : orderDeposit.currency === "EUR" ? "€" : "₴"}
                          {Math.max(0, (orderDeposit.actual_amount || orderDeposit.held_amount) - 
                            (orderDeposit.used_amount_original || orderDeposit.used_amount || 0) - 
                            (orderDeposit.refunded_amount_original || orderDeposit.refunded_amount || 0)
                          ).toLocaleString("uk-UA")}
                        </span>
                      </div>
                      
                      {/* Кнопка повернення застави */}
                      {(() => {
                        const available = (orderDeposit.actual_amount || orderDeposit.held_amount) - 
                          (orderDeposit.used_amount_original || orderDeposit.used_amount || 0) - 
                          (orderDeposit.refunded_amount_original || orderDeposit.refunded_amount || 0);
                        return available > 0 ? (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <Button
                              variant="primary"
                              className="w-full"
                              disabled={saving}
                              onClick={async () => {
                                if (!window.confirm(`Повернути заставу: ${orderDeposit.currency === "USD" ? "$" : orderDeposit.currency === "EUR" ? "€" : "₴"}${available}?`)) return;
                                setSaving(true);
                                try {
                                  await authFetch(`${BACKEND_URL}/api/finance/deposits/${orderDeposit.id}/refund?amount=${available}&method=cash`, {
                                    method: "POST",
                                  });
                                  await refreshAll();
                                } catch (e) {
                                  alert("Помилка: " + e.message);
                                }
                                setSaving(false);
                              }}
                            >
                              💸 Повернути заставу
                            </Button>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                  
                  {/* Кнопка архівування - активна тільки якщо застава повернена */}
                  {selectedOrder && (
                    <div className="rounded-2xl border border-slate-200 p-4 mt-4">
                      <div className="text-sm font-semibold mb-3">📂 Архівування</div>
                      {(() => {
                        const depositAvailable = orderDeposit ? 
                          (orderDeposit.actual_amount || orderDeposit.held_amount) - 
                          (orderDeposit.used_amount_original || orderDeposit.used_amount || 0) - 
                          (orderDeposit.refunded_amount_original || orderDeposit.refunded_amount || 0) : 0;
                        const canArchive = !orderDeposit || depositAvailable <= 0;
                        
                        return (
                          <>
                            {!canArchive && (
                              <div className="text-xs text-amber-600 mb-2">
                                ⚠️ Спочатку поверніть заставу
                              </div>
                            )}
                            <Button
                              variant={canArchive ? "primary" : "ghost"}
                              className="w-full"
                              disabled={!canArchive || saving}
                              onClick={async () => {
                                if (!window.confirm(`Відправити замовлення #${selectedOrder.order_number} в архів?`)) return;
                                setSaving(true);
                                try {
                                  await authFetch(`${BACKEND_URL}/api/decor-orders/${selectedOrderId}/archive`, {
                                    method: "POST",
                                  });
                                  alert("✅ Замовлення архівовано");
                                  await loadOrders();
                                  setSelectedOrderId(null);
                                } catch (e) {
                                  alert("Помилка: " + e.message);
                                }
                                setSaving(false);
                              }}
                            >
                              📂 Відправити в архів
                            </Button>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* ============ БЛОК ШКОДИ (Damage) - Нова логіка ============ */}
                  {/* Показуємо якщо є зафіксована шкода АБО вже нараховано */}
                  <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 mt-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="text-sm font-semibold text-rose-900">💔 Шкода</div>
                      {damageFees.due_amount > 0 ? (
                        <span className="text-xs bg-rose-600 text-white px-2 py-0.5 rounded-full">
                          Нараховано: {money(damageFees.due_amount)}
                        </span>
                      ) : damageFees.paid_amount > 0 ? (
                        <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">✓ Оплачено</span>
                      ) : damageFees.items?.length > 0 ? (
                        <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">Орієнтир: {money(damageFees.total_fee)}</span>
                      ) : (
                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">—</span>
                      )}
                    </div>
                    
                    {/* Орієнтовна шкода від реквізиторів */}
                    {damageFees.items?.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-rose-700 mb-2 uppercase font-medium">📋 Зафіксовано реквізиторами (орієнтир):</div>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {damageFees.items.map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-sm bg-white rounded-lg p-2">
                              <span className="text-rose-800">{d.product_name} • {d.damage_type}</span>
                              <span className="font-semibold text-rose-600">{money(d.fee)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-right text-sm">
                          <span className="text-rose-700">Орієнтовна сума: </span>
                          <span className="font-bold text-rose-800">{money(damageFees.total_fee)}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Нараховано менеджером */}
                    {(damageFees.due_amount > 0 || damageFees.paid_amount > 0) && (
                      <div className="mb-3 p-3 bg-white rounded-xl border border-rose-300">
                        <div className="text-xs text-rose-700 mb-2 uppercase font-medium">💰 Нараховано до сплати:</div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-lg font-bold text-rose-800">{money(damageFees.due_amount + damageFees.paid_amount)}</div>
                            {damageFees.paid_amount > 0 && (
                              <div className="text-xs text-emerald-600">Оплачено: {money(damageFees.paid_amount)}</div>
                            )}
                          </div>
                          {damageFees.due_amount > 0 && (
                            <div className="flex gap-2">
                              <Input 
                                type="number"
                                className="w-28"
                                placeholder="Сума"
                                value={damagePayAmount}
                                onChange={(e) => setDamagePayAmount(e.target.value)}
                              />
                              <Button
                                variant="danger"
                                disabled={!damagePayAmount || Number(damagePayAmount) <= 0 || saving}
                                onClick={async () => {
                                  setSaving(true);
                                  try {
                                    await authFetch(`${BACKEND_URL}/api/finance/payments`, {
                                      method: "POST",
                                      body: JSON.stringify({
                                        payment_type: "damage",
                                        method: "cash",
                                        amount: Number(damagePayAmount),
                                        order_id: selectedOrderId,
                                      })
                                    });
                                    setDamagePayAmount("");
                                    await refreshAll();
                                  } catch (e) {
                                    alert("Помилка: " + e.message);
                                  }
                                  setSaving(false);
                                }}
                              >
                                Оплатити
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Форма нарахування шкоди менеджером */}
                    {damageFees.due_amount <= 0 && (
                      <div className="border-t border-rose-200 pt-3">
                        <div className="text-xs text-rose-700 mb-2 font-medium">✍️ Нарахувати шкоду (фінальна сума):</div>
                        <div className="flex gap-2">
                          <Input 
                            type="number"
                            className="flex-1"
                            placeholder={damageFees.total_fee > 0 ? `Орієнтир: ${damageFees.total_fee}` : "Сума ₴"}
                            value={newDamageAmount}
                            onChange={(e) => setNewDamageAmount(e.target.value)}
                          />
                          <Input 
                            className="flex-1"
                            placeholder="Опис"
                            value={newDamageNote}
                            onChange={(e) => setNewDamageNote(e.target.value)}
                          />
                          <Button
                            variant="danger"
                            disabled={!newDamageAmount || Number(newDamageAmount) <= 0 || saving}
                            onClick={async () => {
                              setSaving(true);
                              try {
                                // Нараховуємо шкоду як окремий платіж типу damage (pending)
                                await authFetch(`${BACKEND_URL}/api/finance/order/${selectedOrderId}/charges/add`, {
                                  method: "POST",
                                  body: JSON.stringify({
                                    type: "damage",
                                    amount: Number(newDamageAmount),
                                    note: newDamageNote || "Нарахування за шкоду"
                                  })
                                });
                                setNewDamageAmount("");
                                setNewDamageNote("");
                                await refreshAll();
                              } catch (e) {
                                alert("Помилка: " + e.message);
                              }
                              setSaving(false);
                            }}
                          >
                            Нарахувати
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ============ БЛОК ПРОСТРОЧЕННЯ (Late fees) - Нова логіка ============ */}
                  <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 mt-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="text-sm font-semibold text-amber-900">⏰ Прострочення</div>
                      {lateFeeData.due > 0 ? (
                        <span className="text-xs bg-amber-600 text-white px-2 py-0.5 rounded-full">
                          Нараховано: {money(lateFeeData.due)}
                        </span>
                      ) : lateFeeData.paid > 0 ? (
                        <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">✓ Оплачено</span>
                      ) : estimatedLateFee > 0 ? (
                        <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">Орієнтир: {money(estimatedLateFee)}</span>
                      ) : (
                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">—</span>
                      )}
                    </div>
                    
                    {/* Орієнтовна сума прострочення (з історії часткових повернень) */}
                    {estimatedLateFee > 0 && (
                      <div className="mb-3 p-3 bg-amber-100 rounded-xl border border-amber-300">
                        <div className="text-xs text-amber-700 mb-1 uppercase font-medium">📊 Орієнтовна сума (з історії):</div>
                        <div className="text-lg font-bold text-amber-800">{money(estimatedLateFee)}</div>
                        <div className="text-xs text-amber-600 mt-1">Розрахунок на основі часткових повернень</div>
                      </div>
                    )}
                    
                    {/* Нараховано менеджером */}
                    {lateFeeData.items?.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-amber-700 mb-2 uppercase font-medium">💰 Нараховано до сплати:</div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {lateFeeData.items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-sm bg-white rounded-lg p-2 border border-amber-200">
                              <span className="text-amber-800 flex-1 truncate">{item.note || 'Прострочення'}</span>
                              <div className="flex items-center gap-2 ml-2">
                                <span className={item.status === 'pending' ? "font-semibold text-amber-600" : "font-semibold text-emerald-600"}>
                                  {money(item.amount)}
                                </span>
                                {item.status === 'pending' && (
                                  <button
                                    className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-200"
                                    onClick={async () => {
                                      const method = prompt("Метод оплати: cash або bank", "cash");
                                      if (!method) return;
                                      setSaving(true);
                                      try {
                                        await authFetch(`${BACKEND_URL}/api/finance/order/${selectedOrderId}/charges/${item.id}/pay`, {
                                          method: "POST",
                                          body: JSON.stringify({ method })
                                        });
                                        await refreshAll();
                                      } catch (e) {
                                        alert("Помилка: " + e.message);
                                      }
                                      setSaving(false);
                                    }}
                                  >
                                    💵 Оплатити
                                  </button>
                                )}
                                {item.status !== 'pending' && (
                                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">✓ Оплачено</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Форма нарахування прострочення менеджером */}
                    <div className="border-t border-amber-200 pt-3">
                      <div className="text-xs text-amber-700 mb-2 font-medium">✍️ Нарахувати прострочення (фінальна сума):</div>
                      <div className="flex gap-2">
                        <Input 
                          type="number"
                          className="w-32"
                          placeholder={estimatedLateFee > 0 ? `~${estimatedLateFee}` : "Сума ₴"}
                          value={newLateAmount}
                          onChange={(e) => setNewLateAmount(e.target.value)}
                        />
                        <Input 
                          className="flex-1"
                          placeholder="Опис (напр., Прострочення 5 днів)"
                          value={newLateNote}
                          onChange={(e) => setNewLateNote(e.target.value)}
                        />
                        <Button
                          disabled={!newLateAmount || Number(newLateAmount) <= 0 || saving}
                          onClick={async () => {
                            setSaving(true);
                            try {
                              await authFetch(`${BACKEND_URL}/api/finance/order/${selectedOrderId}/charges/add`, {
                                method: "POST",
                                body: JSON.stringify({
                                  type: "late",
                                  amount: Number(newLateAmount),
                                  note: newLateNote || "Нарахування за прострочення"
                                })
                              });
                              setNewLateAmount("");
                              setNewLateNote("");
                              await refreshAll();
                            } catch (e) {
                              alert("Помилка: " + e.message);
                            }
                            setSaving(false);
                          }}
                        >
                          Нарахувати
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              <Card>
                <div className="text-center text-slate-500 py-8">
                  Оберіть ордер зліва
                </div>
              </Card>
            )}
          </div>

          {/* RIGHT: Дії + Статистика + Документи */}
          <div className={cn("sm:col-span-3 space-y-4", activeTabMobile !== "actions" && "hidden sm:block")}>
            <Card title="📊 Статистика">
              <div className="divide-y divide-slate-100">
                <StatRow label="Ордерів" value={String(stats.total)} />
                <StatRow label="Оплачено" value={String(stats.paid)} />
                <StatRow label="З боргом" value={String(stats.withDebt)} />
              </div>
            </Card>

            {selectedOrder && (
              <Card title="📄 Документи">
                <div className="space-y-4">
                  {/* Payer Profile Section */}
                  <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-600">ТИП ПЛАТНИКА</span>
                      <button
                        onClick={() => setShowPayerModal(true)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {selectedPayerProfile ? "Змінити" : "+ Додати"}
                      </button>
                    </div>
                    {selectedPayerProfile ? (
                      <div className="text-sm">
                        <div className="font-semibold text-slate-900">{selectedPayerProfile.company_name}</div>
                        <div className="text-xs text-slate-500">
                          {PAYER_TYPE_LABELS[selectedPayerProfile.payer_type] || selectedPayerProfile.payer_type}
                          {selectedPayerProfile.edrpou && ` · ${selectedPayerProfile.edrpou}`}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">Фізична особа (за замовчуванням)</div>
                    )}
                  </div>
                  
                  {/* Documents for Individuals */}
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-2">Документи (фіз. особа)</div>
                    <div className="space-y-2">
                      {DOC_TYPES.map((dt) => {
                        const existing = documents.find(d => d.doc_type === dt.type);
                        return (
                          <div
                            key={dt.type}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                          >
                            <div>
                              <div className="text-sm font-medium text-slate-900">{dt.title}</div>
                              {existing && (
                                <div className="text-xs text-emerald-600">✓ {existing.doc_number}</div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {existing && (
                                <button
                                  onClick={() => viewDocument(existing)}
                                  className="px-2 py-1 text-xs rounded-lg hover:bg-slate-100"
                                >
                                  👁
                                </button>
                              )}
                              <button
                                onClick={() => generateDocument(dt.type)}
                                className="px-2 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200"
                              >
                                🔄
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Documents for Legal Entities */}
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-2">Документи (юр. особа)</div>
                    <div className="space-y-2">
                      {LEGAL_DOC_TYPES.map((dt) => {
                        const existing = documents.find(d => d.doc_type === dt.type);
                        const isApplicable = selectedPayerProfile && (
                          dt.forLegal ||
                          (dt.forSimplified && ["fop_simple", "llc_simple"].includes(selectedPayerProfile.payer_type)) ||
                          (dt.forGeneral && ["fop_general", "llc_general"].includes(selectedPayerProfile.payer_type))
                        );
                        
                        return (
                          <div
                            key={dt.type}
                            className={cn(
                              "flex items-center justify-between rounded-xl border px-3 py-2",
                              isApplicable 
                                ? "border-blue-200 bg-blue-50" 
                                : "border-slate-200 bg-slate-50 opacity-50"
                            )}
                          >
                            <div>
                              <div className="text-sm font-medium text-slate-900">{dt.title}</div>
                              {existing && (
                                <div className="text-xs text-emerald-600">✓ {existing.doc_number}</div>
                              )}
                              {!selectedPayerProfile && (
                                <div className="text-xs text-slate-400">Вкажіть платника</div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {existing && (
                                <button
                                  onClick={() => viewDocument(existing)}
                                  className="px-2 py-1 text-xs rounded-lg hover:bg-slate-100"
                                >
                                  👁
                                </button>
                              )}
                              <button
                                onClick={() => generateLegalDocument(dt.type)}
                                disabled={!isApplicable}
                                className={cn(
                                  "px-2 py-1 text-xs rounded-lg",
                                  isApplicable ? "bg-blue-100 hover:bg-blue-200" : "bg-slate-100 cursor-not-allowed"
                                )}
                              >
                                🔄
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <Card title="⚡ Швидкі дії">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-500">💵 Витрати готівка</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="ghost" 
                    className="text-xs !h-9"
                    onClick={() => {
                      setExpenseType("rent_cash");
                      setOperationType("expense");
                      setShowExpenseModal(true);
                    }}
                  >
                    Оренда
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="text-xs !h-9"
                    onClick={() => {
                      setExpenseType("damage_cash");
                      setOperationType("expense");
                      setShowExpenseModal(true);
                    }}
                  >
                    Шкода
                  </Button>
                </div>
                
                <div className="text-xs font-semibold text-slate-500 mt-3">🏦 Витрати безготівка</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="ghost" 
                    className="text-xs !h-9"
                    onClick={() => {
                      setExpenseType("rent_bank");
                      setOperationType("expense");
                      setShowExpenseModal(true);
                    }}
                  >
                    Оренда
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="text-xs !h-9"
                    onClick={() => {
                      setExpenseType("damage_bank");
                      setOperationType("expense");
                      setShowExpenseModal(true);
                    }}
                  >
                    Шкода
                  </Button>
                </div>
                
                <div className="text-xs font-semibold text-slate-500 mt-3">📥 Внесення коштів</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="ghost" 
                    className="text-xs !h-9 !text-emerald-600 !border-emerald-200"
                    onClick={() => {
                      setExpenseType("rent_cash");
                      setOperationType("deposit");
                      setShowExpenseModal(true);
                    }}
                  >
                    + Оренда
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="text-xs !h-9 !text-emerald-600 !border-emerald-200"
                    onClick={() => {
                      setExpenseType("damage_cash");
                      setOperationType("deposit");
                      setShowExpenseModal(true);
                    }}
                  >
                    + Шкода
                  </Button>
                </div>
                
                <div className="pt-2 mt-2 border-t border-slate-100">
                  <Button 
                    variant="ghost" 
                    className="w-full"
                    onClick={() => {
                      loadAllExpenses();
                      setShowOperationsModal(true);
                    }}
                  >
                    📋 Всі операції
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold">
                {operationType === "deposit" ? "📥 Внесення коштів" : "📉 Витрата"}
                {" • "}
                {expenseType.includes("rent") ? "Оренда" : "Шкода"}
                {" • "}
                {expenseType.includes("bank") ? "Безготівка" : "Готівка"}
              </h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Опис *</label>
                <Input
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  placeholder={operationType === "deposit" 
                    ? "Джерело внесення..." 
                    : expenseType.includes("rent") 
                      ? "Оплата приміщення, комунальні..." 
                      : "Фарба, реставрація, расходники..."
                  }
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Сума (₴) *</label>
                <Input
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0"
                  inputMode="decimal"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setShowExpenseModal(false)}>
                  Скасувати
                </Button>
                <Button 
                  className={cn("flex-1", operationType === "deposit" && "!bg-emerald-600 hover:!bg-emerald-700")}
                  disabled={saving || !expenseAmount || !expenseDescription.trim()}
                  onClick={handleAddExpense}
                >
                  {saving ? "..." : operationType === "deposit" ? "Внести" : "Додати витрату"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* All Operations Modal */}
      {showOperationsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold">📋 Всі фінансові операції</h3>
              <button onClick={() => setShowOperationsModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {allExpenses.length === 0 ? (
                <div className="text-center text-slate-500 py-8">Немає операцій</div>
              ) : (
                <div className="space-y-2">
                  {allExpenses.map((exp) => {
                    const isDeposit = exp.expense_type === "income" || exp.category?.includes("DEPOSIT");
                    return (
                    <div key={exp.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{exp.description}</div>
                        <div className="text-xs text-slate-500">
                          {exp.category?.includes("RENT") ? "Оренда" : "Шкода"} · 
                          {exp.category?.includes("BANK") ? " 🏦" : " 💵"} · 
                          {isDeposit ? "внесення" : "витрата"} · {fmtDate(exp.created_at)}
                        </div>
                      </div>
                      <div className={cn("text-sm font-bold", isDeposit ? "text-emerald-600" : "text-rose-600")}>
                        {isDeposit ? "+" : "-"}{money(exp.amount)}
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Payer Profile Modal */}
      {showPayerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold">🏢 Профіль платника</h3>
              <button onClick={() => setShowPayerModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-4 space-y-4">
              {/* Existing profiles */}
              {payerProfiles.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-2">ІСНУЮЧІ ПРОФІЛІ</div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {payerProfiles.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          handleAssignPayerProfile(p.id);
                          setShowPayerModal(false);
                        }}
                        className={cn(
                          "w-full text-left rounded-xl border px-3 py-2 transition",
                          selectedPayerProfile?.id === p.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <div className="text-sm font-semibold">{p.company_name}</div>
                        <div className="text-xs text-slate-500">
                          {PAYER_TYPE_LABELS[p.payer_type]} · {p.edrpou || "—"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* New profile form */}
              <div className="border-t border-slate-200 pt-4">
                <div className="text-xs font-semibold text-slate-500 mb-3">НОВИЙ ПРОФІЛЬ</div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Тип платника *</label>
                    <Select
                      value={payerForm.payer_type}
                      onChange={(v) => setPayerForm(prev => ({ ...prev, payer_type: v }))}
                      options={[
                        { value: "fop_simple", label: "ФОП (спрощена система)" },
                        { value: "fop_general", label: "ФОП (загальна система)" },
                        { value: "llc_simple", label: "ТОВ (спрощена система)" },
                        { value: "llc_general", label: "ТОВ (загальна система)" },
                      ]}
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      {payerForm.payer_type.startsWith("llc") ? "Назва компанії *" : "ПІБ ФОП *"}
                    </label>
                    <Input
                      value={payerForm.company_name}
                      onChange={(e) => setPayerForm(prev => ({ ...prev, company_name: e.target.value }))}
                      placeholder={payerForm.payer_type.startsWith("llc") ? "ТОВ «Назва»" : "Трофімова Вікторія Сергіївна"}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">
                        {payerForm.payer_type.startsWith("llc") ? "ЄДРПОУ" : "ДРФО (ІПН)"}
                      </label>
                      <Input
                        value={payerForm.edrpou}
                        onChange={(e) => setPayerForm(prev => ({ ...prev, edrpou: e.target.value }))}
                        placeholder={payerForm.payer_type.startsWith("llc") ? "12345678" : "3505100720"}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Платник ПДВ</label>
                      <button
                        onClick={() => setPayerForm(prev => ({ ...prev, is_vat_payer: !prev.is_vat_payer }))}
                        className={cn(
                          "h-10 w-full rounded-xl border text-sm font-medium transition",
                          payerForm.is_vat_payer
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-600"
                        )}
                      >
                        {payerForm.is_vat_payer ? "✓ Так" : "Ні"}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">IBAN</label>
                    <Input
                      value={payerForm.iban}
                      onChange={(e) => setPayerForm(prev => ({ ...prev, iban: e.target.value }))}
                      placeholder="UA65..."
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Банк</label>
                    <Input
                      value={payerForm.bank_name}
                      onChange={(e) => setPayerForm(prev => ({ ...prev, bank_name: e.target.value }))}
                      placeholder="АТ «УНІВЕРСАЛ БАНК»"
                    />
                  </div>
                  
                  {payerForm.payer_type.startsWith("llc") && (
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">ПІБ директора</label>
                      <Input
                        value={payerForm.director_name}
                        onChange={(e) => setPayerForm(prev => ({ ...prev, director_name: e.target.value }))}
                        placeholder="Іванов Іван Іванович"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Юридична адреса</label>
                    <Input
                      value={payerForm.address}
                      onChange={(e) => setPayerForm(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="м. Харків, вул. ..."
                    />
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <Button variant="ghost" className="flex-1" onClick={() => setShowPayerModal(false)}>
                    Скасувати
                  </Button>
                  <Button 
                    className="flex-1"
                    disabled={saving || !payerForm.company_name.trim()}
                    onClick={handleSavePayerProfile}
                  >
                    {saving ? "..." : "Зберегти"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
