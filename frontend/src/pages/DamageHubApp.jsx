/* eslint-disable */
/**
 * DamageHubApp - Уніфікований Кабінет Шкоди
 * Tabs: Головна (кейси по ордерах), Мийка, Реставрація, Хімчистка
 * Головна: зліва ордери, справа деталі з позиціями та можливістю відправки на обробку
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import CorporateHeader from "../components/CorporateHeader";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

// ----------------------------- helpers -----------------------------
const cls = (...a) => a.filter(Boolean).join(" ");

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
  return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });
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

// ----------------------------- constants -----------------------------
const MODES = {
  ALL: "all",
  WASH: "wash",
  RESTORE: "restore",
  DRYCLEAN: "dryclean",
};

const modeMeta = {
  [MODES.ALL]: { title: "Головна", hint: "Кейси шкоди по ордерах • статус оплати", color: "bg-slate-900" },
  [MODES.WASH]: { title: "Мийка", hint: "Товари на мийці/чистці", color: "bg-blue-600" },
  [MODES.RESTORE]: { title: "Реставрація", hint: "Товари на ремонті/відновленні", color: "bg-amber-600" },
  [MODES.DRYCLEAN]: { title: "Хімчистка", hint: "Черга та партії відправок", color: "bg-emerald-600" },
};

const PROCESSING_TYPES = {
  WASH: "wash",
  RESTORE: "restoration",
  LAUNDRY: "laundry"
};

// ----------------------------- UI Components -----------------------------
const tonePill = (tone) =>
  cls(
    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
    tone === "ok" && "bg-emerald-50 text-emerald-800 border-emerald-200",
    tone === "warn" && "bg-amber-50 text-amber-900 border-amber-200",
    tone === "danger" && "bg-rose-50 text-rose-800 border-rose-200",
    tone === "info" && "bg-blue-50 text-blue-800 border-blue-200",
    tone === "neutral" && "bg-slate-50 text-slate-700 border-slate-200"
  );

const Badge = ({ tone = "neutral", children }) => <span className={tonePill(tone)}>{children}</span>;

const GhostBtn = ({ onClick, children, disabled, className = "" }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cls(
      "inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition",
      disabled ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
      className
    )}
  >
    {children}
  </button>
);

const PrimaryBtn = ({ onClick, children, disabled, variant = "primary" }) => {
  const variants = {
    primary: "bg-corp-primary text-white hover:bg-corp-primary-dark",
    dark: "bg-slate-900 text-white hover:bg-slate-800",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    blue: "bg-blue-600 text-white hover:bg-blue-700",
    amber: "bg-amber-600 text-white hover:bg-amber-700",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cls(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition",
        disabled ? "bg-slate-200 text-slate-500 cursor-not-allowed" : variants[variant]
      )}
    >
      {children}
    </button>
  );
};

// ----------------------------- Tabs Component -----------------------------
function Tabs({ mode, setMode }) {
  const tabs = [
    { id: MODES.ALL, label: "Головна", icon: "📋" },
    { id: MODES.WASH, label: "Мийка", icon: "🧼" },
    { id: MODES.RESTORE, label: "Реставрація", icon: "🔧" },
    { id: MODES.DRYCLEAN, label: "Хімчистка", icon: "🧺" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={cls(
            "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition",
            mode === t.id ? "bg-corp-primary text-white shadow-sm border-corp-primary" : "bg-white border-slate-200 hover:bg-slate-50"
          )}
          onClick={() => setMode(t.id)}
        >
          <span>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ----------------------------- Order Case Row (for Main tab) -----------------------------
function OrderCaseRow({ caseData, active, onClick }) {
  const isPaid = caseData.is_paid;
  const hasPending = (caseData.pending_assignment || 0) > 0;
  
  return (
    <button
      onClick={onClick}
      className={cls(
        "w-full rounded-2xl border bg-white p-4 text-left shadow-sm hover:shadow transition",
        active && "ring-2 ring-corp-primary/30 border-corp-primary/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">#{caseData.order_number}</span>
            {isPaid ? (
              <Badge tone="ok">✓ Сплачено</Badge>
            ) : (
              <Badge tone="danger">⏳ Очікує оплати</Badge>
            )}
          </div>
          <div className="mt-1 text-sm text-slate-700">{caseData.customer_name || "—"}</div>
          <div className="mt-1 text-xs text-slate-500">
            {caseData.items_count} позиц. • {fmtDate(caseData.latest_damage)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="text-lg font-bold text-slate-900">{money(caseData.total_fee)}</div>
          {hasPending && (
            <Badge tone="warn">⚡ {caseData.pending_assignment} не розподілено</Badge>
          )}
        </div>
      </div>
      {/* Progress bar for paid amount */}
      {!isPaid && caseData.damage_paid > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Сплачено: {money(caseData.damage_paid)}</span>
            <span>Залишок: {money(caseData.damage_due)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200">
            <div 
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(100, (caseData.damage_paid / caseData.total_fee) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}

// ----------------------------- Item Row (for detail panel) -----------------------------
function DamageItemRow({ item, onSendTo }) {
  const getProcessingBadge = () => {
    if (!item.processing_type) return null;
    const map = {
      wash: { label: "🧼 Мийка", tone: "info" },
      restoration: { label: "🔧 Реставрація", tone: "warn" },
      laundry: { label: "🧺 Хімчистка", tone: "ok" },
    };
    const m = map[item.processing_type] || { label: item.processing_type, tone: "neutral" };
    return <Badge tone={m.tone}>{m.label}</Badge>;
  };

  const getStatusBadge = () => {
    if (!item.processing_status) return null;
    const map = {
      pending: { label: "Очікує", tone: "warn" },
      in_progress: { label: "В роботі", tone: "info" },
      completed: { label: "Виконано", tone: "ok" },
    };
    const m = map[item.processing_status] || { label: item.processing_status, tone: "neutral" };
    return <Badge tone={m.tone}>{m.label}</Badge>;
  };

  const isAssigned = !!item.processing_type;

  return (
    <div className={cls(
      "rounded-xl border p-3 transition",
      isAssigned ? "bg-slate-50 border-slate-200" : "bg-amber-50 border-amber-200"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">{item.product_name}</span>
            {getProcessingBadge()}
            {getStatusBadge()}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            SKU: {item.sku || "—"} • {item.damage_type || "Пошкодження"}
          </div>
          {item.note && (
            <div className="mt-1 text-xs text-slate-600 italic">"{item.note}"</div>
          )}
        </div>
        <div className="text-right">
          <div className="font-bold text-slate-900">{money(item.fee)}</div>
          <div className="text-xs text-slate-500">{item.severity || "low"}</div>
        </div>
      </div>
      
      {/* Assignment buttons - only show if not assigned */}
      {!isAssigned && (
        <div className="mt-3 pt-3 border-t border-amber-200 flex flex-wrap gap-2">
          <span className="text-xs text-amber-700 self-center mr-2">Відправити на:</span>
          <button
            onClick={() => onSendTo(item, "wash")}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-200 transition"
          >
            🧼 Мийку
          </button>
          <button
            onClick={() => onSendTo(item, "restoration")}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-200 transition"
          >
            🔧 Реставрацію
          </button>
          <button
            onClick={() => onSendTo(item, "laundry")}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-200 transition"
          >
            🧺 Хімчистку
          </button>
        </div>
      )}
    </div>
  );
}

// ----------------------------- Order Detail Panel (right side) -----------------------------
function OrderDetailPanel({ orderCase, items, loading, onSendTo, onRefresh }) {
  if (!orderCase) {
    return (
      <div className="rounded-2xl border bg-white p-8 shadow-sm text-center">
        <span className="text-5xl mb-4 block">📋</span>
        <div className="text-slate-500 text-lg">Оберіть кейс зі списку</div>
        <div className="text-slate-400 text-sm mt-1">Тут з'являться деталі пошкоджень</div>
      </div>
    );
  }

  const isPaid = orderCase.is_paid;
  const pendingCount = items.filter(i => !i.processing_type).length;
  const assignedCount = items.filter(i => i.processing_type).length;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className={cls("px-5 py-4", isPaid ? "bg-emerald-50" : "bg-rose-50")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">#{orderCase.order_number}</span>
              {isPaid ? (
                <Badge tone="ok">✓ Сплачено</Badge>
              ) : (
                <Badge tone="danger">Очікує {money(orderCase.damage_due)}</Badge>
              )}
            </div>
            <div className="mt-1 text-sm">{orderCase.customer_name}</div>
            {orderCase.customer_phone && (
              <div className="text-xs text-slate-500">{orderCase.customer_phone}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{money(orderCase.total_fee)}</div>
            {orderCase.damage_paid > 0 && !isPaid && (
              <div className="text-xs text-emerald-600">Сплачено: {money(orderCase.damage_paid)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x border-b">
        <div className="p-3 text-center">
          <div className="text-2xl font-bold text-slate-900">{items.length}</div>
          <div className="text-xs text-slate-500">Всього</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
          <div className="text-xs text-slate-500">Не розподілено</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-2xl font-bold text-emerald-600">{assignedCount}</div>
          <div className="text-xs text-slate-500">В роботі</div>
        </div>
      </div>

      {/* Items List */}
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-700">Пошкоджені позиції</span>
          <GhostBtn onClick={onRefresh} className="text-xs py-1.5">🔄 Оновити</GhostBtn>
        </div>
        
        {loading ? (
          <div className="text-center py-8 text-slate-400">Завантаження...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-slate-400">Немає позицій</div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <DamageItemRow key={item.id} item={item} onSendTo={onSendTo} />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isPaid && (
        <div className="px-4 py-3 bg-slate-50 border-t">
          <a
            href={`/finance?order=${orderCase.order_id}`}
            className="inline-flex items-center justify-center w-full rounded-xl bg-corp-primary text-white px-4 py-2.5 text-sm font-semibold hover:bg-corp-primary-dark transition"
          >
            💰 Перейти до оплати у фінансовий кабінет
          </a>
        </div>
      )}
    </div>
  );
}

// ----------------------------- Processing Queue Item -----------------------------
function ProcessingItemRow({ item, onComplete, onRemove }) {
  const statusMap = {
    pending: { label: "Очікує", tone: "warn" },
    in_progress: { label: "В роботі", tone: "info" },
    completed: { label: "Виконано", tone: "ok" },
  };
  const s = statusMap[item.processing_status] || statusMap.pending;

  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">{item.product_name}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            SKU: {item.sku} • {item.order_number || "—"}
          </div>
          {item.processing_notes && (
            <div className="mt-1 text-xs text-slate-600 italic">"{item.processing_notes}"</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge tone={s.tone}>{s.label}</Badge>
          <span className="text-xs text-slate-500">{fmtDate(item.sent_to_processing_at)}</span>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t flex gap-2">
        {item.processing_status !== "completed" && (
          <GhostBtn onClick={() => onComplete(item)} className="text-xs py-1.5">
            ✓ Виконано
          </GhostBtn>
        )}
        <button
          onClick={() => onRemove(item)}
          className="text-xs text-rose-600 hover:text-rose-800 px-2 py-1.5"
        >
          Видалити
        </button>
      </div>
    </div>
  );
}

// ----------------------------- Main Component -----------------------------
export default function DamageHubApp() {
  const [mode, setMode] = useState(MODES.ALL);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // Data states
  const [orderCases, setOrderCases] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState([]);
  
  const [washItems, setWashItems] = useState([]);
  const [restoreItems, setRestoreItems] = useState([]);
  const [laundryItems, setLaundryItems] = useState([]);
  const [laundryBatches, setLaundryBatches] = useState([]);

  // Load order cases for main tab
  const loadOrderCases = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/cases/grouped`);
      const data = await res.json();
      setOrderCases(data.cases || []);
      // Auto-select first if none selected
      if (!selectedOrderId && data.cases?.length > 0) {
        setSelectedOrderId(data.cases[0].order_id);
      }
    } catch (e) {
      console.error("Error loading order cases:", e);
      setOrderCases([]);
    }
  }, [selectedOrderId]);

  // Load details for selected order
  const loadOrderDetails = useCallback(async (orderId) => {
    if (!orderId) return;
    setDetailLoading(true);
    try {
      // Use the working endpoint - note: returns 'history' not 'items'
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/order/${orderId}`);
      const data = await res.json();
      setSelectedOrderItems(data.history || data.items || []);
    } catch (e) {
      console.error("Error loading order details:", e);
      setSelectedOrderItems([]);
    }
    setDetailLoading(false);
  }, []);

  // Load processing queues
  const loadWashItems = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/processing/wash`);
      const data = await res.json();
      setWashItems(data.items || []);
    } catch (e) {
      console.error("Error loading wash items:", e);
      setWashItems([]);
    }
  }, []);

  const loadRestoreItems = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/processing/restoration`);
      const data = await res.json();
      setRestoreItems(data.items || []);
    } catch (e) {
      console.error("Error loading restore items:", e);
      setRestoreItems([]);
    }
  }, []);

  const loadLaundryItems = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/processing/laundry`);
      const data = await res.json();
      setLaundryItems(data.items || []);
    } catch (e) {
      console.error("Error loading laundry items:", e);
      setLaundryItems([]);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([loadOrderCases(), loadWashItems(), loadRestoreItems(), loadLaundryItems()]);
      setLoading(false);
    };
    loadAll();
  }, []);

  // Load details when order selected
  useEffect(() => {
    if (selectedOrderId) {
      loadOrderDetails(selectedOrderId);
    }
  }, [selectedOrderId, loadOrderDetails]);

  // Send item to processing
  const handleSendTo = async (item, processingType) => {
    try {
      const endpoint = {
        wash: "send-to-wash",
        restoration: "send-to-restoration",
        laundry: "send-to-laundry"
      }[processingType];
      
      await authFetch(`${BACKEND_URL}/api/product-damage-history/${item.id}/${endpoint}`, {
        method: "POST",
        body: JSON.stringify({ notes: `Відправлено з кабінету шкоди` })
      });
      
      // Reload data
      await loadOrderDetails(selectedOrderId);
      await loadOrderCases();
      if (processingType === "wash") await loadWashItems();
      if (processingType === "restoration") await loadRestoreItems();
      if (processingType === "laundry") await loadLaundryItems();
      
    } catch (e) {
      console.error("Error sending to processing:", e);
      alert("Помилка відправки на обробку");
    }
  };

  // Mark processing as complete
  const handleComplete = async (item) => {
    try {
      await authFetch(`${BACKEND_URL}/api/product-damage-history/${item.id}/complete-processing`, {
        method: "POST",
        body: JSON.stringify({ notes: "Обробку завершено" })
      });
      // Reload queues
      await loadWashItems();
      await loadRestoreItems();
      await loadLaundryItems();
    } catch (e) {
      console.error("Error completing:", e);
    }
  };

  // Selected order case data
  const selectedCase = useMemo(() => {
    return orderCases.find(c => c.order_id === selectedOrderId) || null;
  }, [orderCases, selectedOrderId]);

  // Filter cases by search
  const filteredCases = useMemo(() => {
    if (!q.trim()) return orderCases;
    const query = q.toLowerCase();
    return orderCases.filter(c => 
      `${c.order_number || ""} ${c.customer_name || ""}`.toLowerCase().includes(query)
    );
  }, [orderCases, q]);

  // Filter processing items by search
  const filteredWashItems = useMemo(() => {
    if (!q.trim()) return washItems;
    const query = q.toLowerCase();
    return washItems.filter(i => 
      `${i.product_name || ""} ${i.sku || ""} ${i.order_number || ""}`.toLowerCase().includes(query)
    );
  }, [washItems, q]);

  const filteredRestoreItems = useMemo(() => {
    if (!q.trim()) return restoreItems;
    const query = q.toLowerCase();
    return restoreItems.filter(i => 
      `${i.product_name || ""} ${i.sku || ""} ${i.order_number || ""}`.toLowerCase().includes(query)
    );
  }, [restoreItems, q]);

  const filteredLaundryItems = useMemo(() => {
    if (!q.trim()) return laundryItems;
    const query = q.toLowerCase();
    return laundryItems.filter(i => 
      `${i.product_name || ""} ${i.sku || ""} ${i.order_number || ""}`.toLowerCase().includes(query)
    );
  }, [laundryItems, q]);

  // Stats
  const stats = useMemo(() => {
    const unpaidCount = orderCases.filter(c => !c.is_paid).length;
    const pendingTotal = orderCases.reduce((sum, c) => sum + (c.pending_assignment || 0), 0);
    return {
      totalCases: orderCases.length,
      unpaidCases: unpaidCount,
      pendingAssignment: pendingTotal,
      washCount: washItems.length,
      restoreCount: restoreItems.length,
      laundryCount: laundryItems.length
    };
  }, [orderCases, washItems, restoreItems, laundryItems]);

  return (
    <div className="min-h-screen bg-slate-50">
      <CorporateHeader cabinetName="Кабінет шкоди" />

      <div className="mx-auto max-w-7xl px-4 py-4 space-y-4">
        {/* Header Card */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-semibold">Кабінет шкоди</span>
                <span className={cls("h-2 w-2 rounded-full", modeMeta[mode].color)} />
              </div>
              <div className="mt-1 text-sm text-slate-500">{modeMeta[mode].hint}</div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Tabs mode={mode} setMode={(m) => { setMode(m); setQ(""); }} />
              <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
                <span className="text-sm text-slate-500">🔍</span>
                <input
                  className="w-48 bg-transparent text-sm outline-none"
                  placeholder="Пошук..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* KPI Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Кейсів</div>
            <div className="text-2xl font-bold">{stats.totalCases}</div>
          </div>
          <div className="rounded-2xl border bg-rose-50 border-rose-200 p-4 shadow-sm">
            <div className="text-xs text-rose-600">Очікують оплати</div>
            <div className="text-2xl font-bold text-rose-700">{stats.unpaidCases}</div>
          </div>
          <div className="rounded-2xl border bg-amber-50 border-amber-200 p-4 shadow-sm">
            <div className="text-xs text-amber-600">Не розподілено</div>
            <div className="text-2xl font-bold text-amber-700">{stats.pendingAssignment}</div>
          </div>
          <div className="rounded-2xl border bg-blue-50 border-blue-200 p-4 shadow-sm">
            <div className="text-xs text-blue-600">На мийці</div>
            <div className="text-2xl font-bold text-blue-700">{stats.washCount}</div>
          </div>
          <div className="rounded-2xl border bg-orange-50 border-orange-200 p-4 shadow-sm">
            <div className="text-xs text-orange-600">Реставрація</div>
            <div className="text-2xl font-bold text-orange-700">{stats.restoreCount}</div>
          </div>
          <div className="rounded-2xl border bg-emerald-50 border-emerald-200 p-4 shadow-sm">
            <div className="text-xs text-emerald-600">Хімчистка</div>
            <div className="text-2xl font-bold text-emerald-700">{stats.laundryCount}</div>
          </div>
        </div>

        {/* Main Content */}
        {mode === MODES.ALL ? (
          /* Main Tab - Orders with damage */
          <div className="grid lg:grid-cols-5 gap-4">
            {/* Left - Order List */}
            <div className="lg:col-span-2 space-y-3">
              <div className="text-sm font-semibold text-slate-600 px-1">
                Ордери з пошкодженнями ({filteredCases.length})
              </div>
              <div className="max-h-[70vh] overflow-y-auto space-y-2 pr-1">
                {loading ? (
                  <div className="text-center py-8 text-slate-400">Завантаження...</div>
                ) : filteredCases.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">Немає кейсів</div>
                ) : (
                  filteredCases.map((c) => (
                    <OrderCaseRow
                      key={c.order_id}
                      caseData={c}
                      active={c.order_id === selectedOrderId}
                      onClick={() => setSelectedOrderId(c.order_id)}
                    />
                  ))
                )}
              </div>
            </div>
            
            {/* Right - Detail Panel */}
            <div className="lg:col-span-3">
              <OrderDetailPanel
                orderCase={selectedCase}
                items={selectedOrderItems}
                loading={detailLoading}
                onSendTo={handleSendTo}
                onRefresh={() => {
                  loadOrderCases();
                  if (selectedOrderId) loadOrderDetails(selectedOrderId);
                }}
              />
            </div>
          </div>
        ) : mode === MODES.WASH ? (
          /* Wash Tab */
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-lg font-semibold mb-4">🧼 Товари на мийці ({filteredWashItems.length})</div>
            {filteredWashItems.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <span className="text-4xl block mb-2">🧼</span>
                Немає товарів на мийці
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredWashItems.map(item => (
                  <ProcessingItemRow 
                    key={item.id} 
                    item={item} 
                    onComplete={handleComplete}
                    onRemove={() => {}}
                  />
                ))}
              </div>
            )}
          </div>
        ) : mode === MODES.RESTORE ? (
          /* Restore Tab */
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-lg font-semibold mb-4">🔧 Товари на реставрації ({filteredRestoreItems.length})</div>
            {filteredRestoreItems.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <span className="text-4xl block mb-2">🔧</span>
                Немає товарів на реставрації
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredRestoreItems.map(item => (
                  <ProcessingItemRow 
                    key={item.id} 
                    item={item} 
                    onComplete={handleComplete}
                    onRemove={() => {}}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Dryclean Tab */
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-lg font-semibold mb-4">🧺 Товари на хімчистці ({filteredLaundryItems.length})</div>
            {filteredLaundryItems.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <span className="text-4xl block mb-2">🧺</span>
                Немає товарів на хімчистці
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredLaundryItems.map(item => (
                  <ProcessingItemRow 
                    key={item.id} 
                    item={item} 
                    onComplete={handleComplete}
                    onRemove={() => {}}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
