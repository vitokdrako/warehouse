/* eslint-disable */
/**
 * DamageHubApp - Уніфікований Кабінет Шкоди
 * Tabs: Головна (кейси по ордерах), Мийка, Реставрація, Хімчистка
 * Уніфікований дизайн з split layout для всіх вкладок
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

const STATUS_FILTERS = {
  all: "Всі",
  pending: "Очікує",
  in_progress: "В роботі",
  completed: "Виконано"
};

// ----------------------------- UI Components -----------------------------
const tonePill = (tone) =>
  cls(
    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
    tone === "ok" && "bg-emerald-50 text-emerald-800 border-emerald-200",
    tone === "warn" && "bg-amber-50 text-amber-900 border-amber-200",
    tone === "danger" && "bg-rose-50 text-rose-800 border-rose-200",
    tone === "info" && "bg-blue-50 text-blue-800 border-blue-200",
    tone === "neutral" && "bg-corp-bg-page text-corp-text-main border-corp-border"
  );

const Badge = ({ tone = "neutral", children }) => <span className={tonePill(tone)}>{children}</span>;

const GhostBtn = ({ onClick, children, disabled, className = "" }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cls(
      "inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition",
      disabled ? "border-corp-border bg-corp-bg-page text-corp-text-muted cursor-not-allowed" : "border-corp-border bg-white text-corp-text-dark hover:bg-corp-bg-page",
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
        disabled ? "bg-corp-border text-corp-text-muted cursor-not-allowed" : variants[variant]
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
            mode === t.id ? "bg-corp-primary text-white shadow-sm border-corp-primary" : "bg-white border-corp-border hover:bg-corp-bg-light"
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

// ----------------------------- Status Chips (фільтри) -----------------------------
function StatusChips({ value, onChange, counts = {}, labels = {} }) {
  const defaultLabels = {
    all: "Всі",
    pending: "Очікують",
    in_progress: "В роботі",
    completed: "Виконано"
  };
  const mergedLabels = { ...defaultLabels, ...labels };
  
  const chips = [
    { id: "all", label: mergedLabels.all, count: counts.all },
    { id: "pending", label: mergedLabels.pending, count: counts.pending },
    { id: "in_progress", label: mergedLabels.in_progress, count: counts.in_progress },
    { id: "completed", label: mergedLabels.completed, count: counts.completed },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          key={c.id}
          className={cls(
            "rounded-xl border px-3 py-2 text-sm font-medium transition",
            value === c.id ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50 border-corp-border"
          )}
          onClick={() => onChange(c.id)}
        >
          {c.label} {c.count !== undefined && <span className="ml-1 opacity-70">({c.count})</span>}
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
            <span className="text-sm font-bold text-corp-text-dark">#{caseData.order_number}</span>
            {isPaid ? (
              <Badge tone="ok">✓ Сплачено</Badge>
            ) : (
              <Badge tone="danger">⏳ Очікує оплати</Badge>
            )}
          </div>
          <div className="mt-1 text-sm text-corp-text-main">{caseData.customer_name || "—"}</div>
          <div className="mt-1 text-xs text-corp-text-muted">
            {caseData.items_count} позиц. • {fmtDate(caseData.latest_damage)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="text-lg font-bold text-corp-text-dark">{money(caseData.total_fee)}</div>
          {hasPending && (
            <Badge tone="warn">⚡ {caseData.pending_assignment} не розподілено</Badge>
          )}
        </div>
      </div>
      {!isPaid && caseData.damage_paid > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-corp-text-muted mb-1">
            <span>Сплачено: {money(caseData.damage_paid)}</span>
            <span>Залишок: {money(caseData.damage_due)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-corp-border">
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

// ----------------------------- Processing Item Row (Мийка/Реставрація) -----------------------------
function ProcessingItemRow({ item, active, onClick }) {
  const totalQty = item.qty || 1;
  const processedQty = item.processed_qty || 0;
  const hasMultiple = totalQty > 1;
  const progress = totalQty > 0 ? (processedQty / totalQty) * 100 : 0;
  
  const statusMap = {
    pending: { label: "Очікує", tone: "warn" },
    in_progress: { label: hasMultiple ? `${processedQty}/${totalQty}` : "В роботі", tone: "info" },
    completed: { label: "✓ Виконано", tone: "ok" },
  };
  const s = statusMap[item.processing_status] || statusMap.pending;
  const photoUrl = item.photo_url || item.product_image;

  return (
    <button
      onClick={onClick}
      className={cls(
        "w-full rounded-2xl border bg-white p-3 text-left shadow-sm hover:shadow transition",
        active && "ring-2 ring-corp-primary/30 border-corp-primary/30"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Photo */}
        <div className="shrink-0">
          {photoUrl ? (
            <img src={photoUrl} alt={item.product_name} className="w-14 h-14 rounded-lg object-cover border border-corp-border" onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-corp-border flex items-center justify-center text-xl">📦</div>
          )}
        </div>
        
        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-corp-text-dark truncate">{item.product_name}</div>
              <div className="mt-0.5 text-xs text-corp-text-muted">
                SKU: {item.sku || "—"} • {item.order_number || "—"} {hasMultiple && <span className="font-medium">• {totalQty} шт.</span>}
              </div>
            </div>
            <Badge tone={s.tone}>{s.label}</Badge>
          </div>
          
          {/* Progress bar for multiple items */}
          {hasMultiple && processedQty > 0 && (
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-corp-border">
                <div 
                  className={cls("h-full rounded-full transition-all", progress >= 100 ? "bg-emerald-500" : "bg-blue-500")}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          
          {item.sent_to_processing_at && !hasMultiple && (
            <div className="mt-1 text-xs text-corp-text-muted">
              Відправлено: {fmtDate(item.sent_to_processing_at)}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ----------------------------- Processing Detail Panel (Мийка/Реставрація) -----------------------------
function ProcessingDetailPanel({ mode, item, onComplete, onMarkFailed, onRefresh }) {
  const [notes, setNotes] = useState("");
  const [completedQty, setCompletedQty] = useState(1);
  
  // Reset completedQty when item changes
  React.useEffect(() => {
    if (item) {
      const remaining = (item.qty || 1) - (item.processed_qty || 0);
      setCompletedQty(Math.min(remaining, 1));
    }
  }, [item?.id]);
  
  if (!item) {
    return (
      <div className="rounded-2xl border bg-white p-8 shadow-sm text-center">
        <span className="text-5xl mb-4 block">{mode === MODES.WASH ? "🧼" : "🔧"}</span>
        <div className="text-corp-text-muted text-lg">Оберіть товар зі списку</div>
        <div className="text-corp-text-muted text-sm mt-1">Тут з'являться деталі обробки</div>
      </div>
    );
  }

  const totalQty = item.qty || 1;
  const processedQty = item.processed_qty || 0;
  const remainingQty = totalQty - processedQty;
  const progress = totalQty > 0 ? (processedQty / totalQty) * 100 : 0;
  const hasMultiple = totalQty > 1;
  
  const statusMap = {
    pending: { label: "Очікує", tone: "warn" },
    in_progress: { label: hasMultiple ? `В роботі (${processedQty}/${totalQty})` : "В роботі", tone: "info" },
    completed: { label: "✓ Виконано", tone: "ok" },
    failed: { label: "Невдало", tone: "danger" },
  };
  const s = statusMap[item.processing_status] || statusMap.pending;
  const photoUrl = item.photo_url || item.product_image;
  const isCompleted = item.processing_status === 'completed' || remainingQty <= 0;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className={cls("px-5 py-4", isCompleted ? "bg-emerald-50" : "bg-slate-50")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            {photoUrl ? (
              <img src={photoUrl} alt={item.product_name} className="w-20 h-20 rounded-xl object-cover border border-corp-border" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-corp-border flex items-center justify-center text-3xl">📦</div>
            )}
            <div>
              <div className="text-xl font-bold text-corp-text-dark">{item.product_name}</div>
              <div className="mt-1 text-sm text-corp-text-muted">SKU: {item.sku || "—"}</div>
              <div className="mt-0.5 text-sm text-corp-text-muted">Замовлення: {item.order_number || "—"}</div>
            </div>
          </div>
          <Badge tone={s.tone}>{s.label}</Badge>
        </div>
        
        {/* Quantity Progress Bar */}
        {hasMultiple && (
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-corp-text-muted">Оброблено</span>
              <span className="font-bold">{processedQty} / {totalQty} шт.</span>
            </div>
            <div className="h-2.5 rounded-full bg-corp-border">
              <div 
                className={cls("h-full rounded-full transition-all", progress >= 100 ? "bg-emerald-500" : "bg-blue-500")}
                style={{ width: `${progress}%` }}
              />
            </div>
            {remainingQty > 0 && (
              <div className="mt-1 text-xs text-amber-600">⏳ Залишилось: {remainingQty} шт.</div>
            )}
          </div>
        )}
      </div>

      {/* Info Grid */}
      <div className="p-5 border-b">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="text-xs text-corp-text-muted">Тип пошкодження</div>
            <div className="font-medium mt-1">{item.damage_type || item.category || "—"}</div>
          </div>
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="text-xs text-corp-text-muted">Відправлено</div>
            <div className="font-medium mt-1">{fmtDate(item.sent_to_processing_at)}</div>
          </div>
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="text-xs text-corp-text-muted">Кількість</div>
            <div className="font-medium mt-1">{totalQty} шт.</div>
          </div>
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="text-xs text-corp-text-muted">Вартість</div>
            <div className="font-medium mt-1">{money(item.fee)} {hasMultiple && <span className="text-xs text-corp-text-muted">({money(item.fee_per_item || (item.fee / totalQty))}/шт)</span>}</div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {item.note && (
        <div className="px-5 py-3 border-b bg-amber-50">
          <div className="text-xs text-amber-700 font-medium mb-1">Примітка</div>
          <div className="text-sm text-amber-800">{item.note}</div>
        </div>
      )}

      {/* Processing Notes */}
      {item.processing_notes && (
        <div className="px-5 py-3 border-b">
          <div className="text-xs text-corp-text-muted font-medium mb-1">Історія обробки</div>
          <div className="text-sm text-corp-text-main whitespace-pre-wrap max-h-32 overflow-y-auto">{item.processing_notes}</div>
        </div>
      )}

      {/* Actions */}
      {!isCompleted && remainingQty > 0 && (
        <div className="p-5 bg-corp-bg-page space-y-4">
          {/* Quantity selector for partial completion */}
          {hasMultiple && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-blue-800">Скільки одиниць оброблено?</label>
                <span className="text-xs text-blue-600">Залишилось: {remainingQty} шт.</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCompletedQty(Math.max(1, completedQty - 1))}
                  className="w-10 h-10 rounded-lg border bg-white text-lg font-bold hover:bg-slate-50"
                  disabled={completedQty <= 1}
                >−</button>
                <input
                  type="number"
                  min={1}
                  max={remainingQty}
                  value={completedQty}
                  onChange={(e) => setCompletedQty(Math.min(remainingQty, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-20 text-center text-xl font-bold border rounded-lg py-2"
                />
                <button
                  onClick={() => setCompletedQty(Math.min(remainingQty, completedQty + 1))}
                  className="w-10 h-10 rounded-lg border bg-white text-lg font-bold hover:bg-slate-50"
                  disabled={completedQty >= remainingQty}
                >+</button>
                <button
                  onClick={() => setCompletedQty(remainingQty)}
                  className="px-3 py-2 text-sm bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200"
                >Всі ({remainingQty})</button>
              </div>
            </div>
          )}
          
          <div>
            <label className="text-sm font-medium text-corp-text-main">Коментар</label>
            <textarea
              className="mt-2 w-full rounded-xl border border-corp-border p-3 text-sm outline-none focus:ring-2 focus:ring-corp-primary/20"
              placeholder="Опис виконаних робіт..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <PrimaryBtn variant="success" onClick={() => onComplete(item, notes, hasMultiple ? completedQty : null)}>
              ✓ {hasMultiple ? `Оброблено ${completedQty} шт.` : "Завершити обробку"}
            </PrimaryBtn>
            <GhostBtn onClick={() => onMarkFailed(item, notes)}>
              ✗ Невдало
            </GhostBtn>
            {mode === MODES.RESTORE && (
              <GhostBtn onClick={() => alert("Функція оцінки в розробці")}>
                ₴ Оцінка
              </GhostBtn>
            )}
          </div>
        </div>
      )}

      {/* Completed state */}
      {(isCompleted || remainingQty <= 0) && (
        <div className="p-5 bg-emerald-50">
          <div className="flex items-center gap-2 text-emerald-700">
            <span className="text-2xl">✓</span>
            <div>
              <div className="font-semibold">Обробку повністю завершено</div>
              <div className="text-sm">{fmtDate(item.returned_from_processing_at)} • {totalQty} шт. доступні для оренди</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------- Laundry Queue Item -----------------------------
function LaundryQueueItem({ item, selected, onSelect, onAddToBatch }) {
  return (
    <div className={cls(
      "rounded-xl border bg-white p-3 transition",
      selected && "ring-2 ring-corp-primary border-corp-primary"
    )}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="mt-1 h-4 w-4 rounded border-gray-300"
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-corp-text-dark truncate">{item.product_name}</div>
          <div className="mt-0.5 text-xs text-corp-text-muted">
            SKU: {item.sku} • {item.order_number || "—"} • {item.condition_before || "dirty"}
          </div>
        </div>
        <Badge tone="warn">Черга</Badge>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onAddToBatch(item)}
          className="text-xs px-2 py-1 rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200"
        >
          + В партію
        </button>
      </div>
    </div>
  );
}

// ----------------------------- Laundry Batch Card -----------------------------
function LaundryBatchCard({ batch, active, onClick }) {
  const statusMap = {
    sent: { label: "Відправлено", tone: "info" },
    partial_return: { label: "Часткове", tone: "warn" },
    returned: { label: "Повернуто", tone: "ok" },
    completed: { label: "✓ Закрито", tone: "ok" },
  };
  const s = statusMap[batch.status] || { label: batch.status, tone: "neutral" };
  const progress = batch.total_items > 0 ? (batch.returned_items / batch.total_items) * 100 : 0;

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
          <div className="font-bold text-corp-text-dark">{batch.batch_number || batch.id}</div>
          <div className="mt-1 text-sm text-corp-text-muted">{batch.laundry_company}</div>
        </div>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>
      
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-corp-text-muted">Відправлено:</span>{" "}
          <span className="font-medium">{fmtDate(batch.sent_date)}</span>
        </div>
        <div>
          <span className="text-corp-text-muted">Очікується:</span>{" "}
          <span className="font-medium">{fmtDate(batch.expected_return_date)}</span>
        </div>
      </div>
      
      {/* Progress */}
      <div className="mt-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-corp-text-muted">Прийнято</span>
          <span className="font-medium">{batch.returned_items} / {batch.total_items}</span>
        </div>
        <div className="h-2 rounded-full bg-corp-border">
          <div 
            className={cls("h-full rounded-full transition-all", progress >= 100 ? "bg-emerald-500" : "bg-blue-500")}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      {batch.cost > 0 && (
        <div className="mt-2 text-sm">
          <span className="text-corp-text-muted">Вартість:</span>{" "}
          <span className="font-bold">{money(batch.cost)}</span>
        </div>
      )}
    </button>
  );
}

// ----------------------------- Laundry Batch Detail Panel -----------------------------
function LaundryBatchDetailPanel({ batch, items, onReceiveItems, onCloseBatch, onRefresh }) {
  const [selectedItems, setSelectedItems] = useState([]);
  
  if (!batch) {
    return (
      <div className="rounded-2xl border bg-white p-8 shadow-sm text-center">
        <span className="text-5xl mb-4 block">🧺</span>
        <div className="text-corp-text-muted text-lg">Оберіть партію зі списку</div>
        <div className="text-corp-text-muted text-sm mt-1">Тут з'являться деталі партії</div>
      </div>
    );
  }

  const statusMap = {
    sent: { label: "Відправлено", tone: "info" },
    partial_return: { label: "Часткове повернення", tone: "warn" },
    returned: { label: "Повернуто", tone: "ok" },
    completed: { label: "✓ Закрито", tone: "ok" },
  };
  const s = statusMap[batch.status] || { label: batch.status, tone: "neutral" };
  const isCompleted = batch.status === 'completed';
  const hasItems = batch.total_items > 0;
  const allReturned = hasItems && batch.returned_items >= batch.total_items;

  const toggleItem = (itemId) => {
    setSelectedItems(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const selectAllUnreturned = () => {
    const unreturned = items.filter(i => (i.returned_quantity || 0) < i.quantity).map(i => i.id);
    setSelectedItems(unreturned);
  };

  const handleReceive = () => {
    if (selectedItems.length === 0) {
      alert("Оберіть товари для прийому");
      return;
    }
    onReceiveItems(batch, selectedItems, items);
    setSelectedItems([]);
  };

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className={cls("px-5 py-4", isCompleted ? "bg-emerald-50" : allReturned ? "bg-blue-50" : "bg-slate-50")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-bold text-corp-text-dark">{batch.batch_number || batch.id}</div>
            <div className="mt-1 text-sm text-corp-text-muted">{batch.laundry_company}</div>
          </div>
          <Badge tone={s.tone}>{s.label}</Badge>
        </div>
      </div>

      {/* Info Grid */}
      <div className="p-5 border-b">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="text-xs text-corp-text-muted">Відправлено</div>
            <div className="font-medium mt-1">{fmtDate(batch.sent_date)}</div>
          </div>
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="text-xs text-corp-text-muted">Очікується</div>
            <div className="font-medium mt-1">{fmtDate(batch.expected_return_date)}</div>
          </div>
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="text-xs text-corp-text-muted">Прийнято</div>
            <div className="font-medium mt-1">{batch.returned_items} / {batch.total_items}</div>
          </div>
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="text-xs text-corp-text-muted">Вартість</div>
            <div className="font-medium mt-1">{money(batch.cost)}</div>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="p-5 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Товари партії</div>
          {!isCompleted && !allReturned && (
            <button
              onClick={selectAllUnreturned}
              className="text-xs px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200"
            >
              ✓ Вибрати всі неприйняті
            </button>
          )}
        </div>
        
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {items.map(item => {
            const isFullyReturned = (item.returned_quantity || 0) >= item.quantity;
            const isSelected = selectedItems.includes(item.id);
            
            return (
              <div 
                key={item.id}
                className={cls(
                  "rounded-xl border p-3 transition",
                  isFullyReturned ? "bg-emerald-50 border-emerald-200" : 
                  isSelected ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200" : "bg-white"
                )}
              >
                <div className="flex items-center gap-3">
                  {!isCompleted && !isFullyReturned && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleItem(item.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  )}
                  {isFullyReturned && (
                    <span className="text-emerald-500 text-lg">✓</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{item.product_name}</div>
                    <div className="text-xs text-corp-text-muted">
                      SKU: {item.sku} • {item.condition_before || "—"} → {item.condition_after || "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {item.returned_quantity || 0} / {item.quantity}
                    </div>
                    <div className="text-xs text-corp-text-muted">прийнято</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      {!isCompleted && (
        <div className="p-5 bg-corp-bg-page">
          <div className="flex flex-wrap gap-2">
            {!allReturned && items.length > 0 && (
              <PrimaryBtn variant="blue" onClick={handleReceive} disabled={selectedItems.length === 0}>
                📥 Прийняти вибрані ({selectedItems.length})
              </PrimaryBtn>
            )}
            {allReturned && hasItems && (
              <PrimaryBtn variant="success" onClick={() => onCloseBatch(batch)}>
                ✓ Закрити партію
              </PrimaryBtn>
            )}
            {!hasItems && (
              <div className="text-sm text-amber-600">
                ⚠️ Партія не має товарів
              </div>
            )}
            <GhostBtn onClick={onRefresh}>🔄 Оновити</GhostBtn>
          </div>
          
          {!allReturned && items.length > 0 && (
            <div className="mt-3 text-sm text-corp-text-muted">
              💡 Виберіть товари які повернулись з хімчистки та натисніть "Прийняти"
            </div>
          )}
        </div>
      )}

      {/* Completed state */}
      {isCompleted && (
        <div className="p-5 bg-emerald-50">
          <div className="flex items-center gap-2 text-emerald-700">
            <span className="text-2xl">✓</span>
            <div>
              <div className="font-semibold">Партію закрито</div>
              <div className="text-sm">Всі товари прийняті та доступні для оренди</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------- Damage Item Row (for Main tab detail) -----------------------------
function DamageItemRow({ item, onSendTo }) {
  const getProcessingBadge = () => {
    if (!item.processing_type || item.processing_type === 'none') return null;
    const map = {
      wash: { label: "🧼 Мийка", tone: "info" },
      restoration: { label: "🔧 Реставрація", tone: "warn" },
      laundry: { label: "🧺 Хімчистка", tone: "ok" },
      returned_to_stock: { label: "📦 На складі", tone: "ok" },
    };
    const m = map[item.processing_type] || { label: item.processing_type, tone: "neutral" };
    return <Badge tone={m.tone}>{m.label}</Badge>;
  };

  const getStatusBadge = () => {
    if (!item.processing_status) return null;
    const map = {
      pending: { label: "Очікує", tone: "warn" },
      in_progress: { label: "В роботі", tone: "info" },
      completed: { label: "✓ Виконано", tone: "ok" },
    };
    const m = map[item.processing_status] || { label: item.processing_status, tone: "neutral" };
    return <Badge tone={m.tone}>{m.label}</Badge>;
  };

  const isAssigned = item.processing_type && item.processing_type !== 'none';
  const isTotalLoss = item.damage_code === 'TOTAL_LOSS' || item.damage_type === 'Повна втрата';
  const photoUrl = item.photo_url || item.product_image;

  return (
    <div className={cls(
      "rounded-xl border p-3 transition",
      isTotalLoss ? "bg-red-50 border-red-200" :
      isAssigned ? "bg-corp-bg-page border-corp-border" : "bg-amber-50 border-amber-200"
    )}>
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {photoUrl ? (
            <img src={photoUrl} alt={item.product_name} className={cls("w-16 h-16 rounded-lg object-cover border", isTotalLoss ? "border-red-300 grayscale" : "border-corp-border")} onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <div className={cls("w-16 h-16 rounded-lg flex items-center justify-center text-2xl", isTotalLoss ? "bg-red-200" : "bg-corp-border")}>
              {isTotalLoss ? "❌" : "📦"}
            </div>
          )}
        </div>
        
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className={cls("font-semibold truncate", isTotalLoss ? "text-red-800" : "text-corp-text-dark")}>{item.product_name}</div>
              <div className="mt-0.5 text-xs text-corp-text-muted">
                SKU: {item.sku || "—"} • {item.damage_type || "Пошкодження"}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={cls("font-bold", isTotalLoss ? "text-red-700" : "text-corp-text-dark")}>{money(item.fee)}</div>
              <div className="text-xs text-corp-text-muted">{item.severity || "low"}</div>
            </div>
          </div>
          
          {isTotalLoss && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
              🔴 ПОВНА ВТРАТА — товар списано
            </div>
          )}
          
          {item.note && (
            <div className="mt-1 text-xs text-corp-text-main italic truncate">"{item.note}"</div>
          )}
          
          {isAssigned && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-corp-text-muted">Відправлено:</span>
              {getProcessingBadge()}
              {getStatusBadge()}
            </div>
          )}
          
          {!isAssigned && !isTotalLoss && (
            <div className="mt-2 pt-2 border-t border-amber-200 flex flex-wrap items-center gap-2">
              <span className="text-xs text-amber-700">Відправити на:</span>
              <button onClick={() => onSendTo(item, "wash")} className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-200 transition">🧼 Мийку</button>
              <button onClick={() => onSendTo(item, "restoration")} className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200 transition">🔧 Реставрацію</button>
              <button onClick={() => onSendTo(item, "laundry")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-200 transition">🧺 Хімчистку</button>
              <button onClick={() => onSendTo(item, "return_to_stock")} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition">📦 На склад</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------- Order Detail Panel (for Main tab) -----------------------------
function OrderDetailPanel({ orderCase, items, loading, onSendTo, onRefresh, onDeductFromDeposit }) {
  if (!orderCase) {
    return (
      <div className="rounded-2xl border bg-white p-8 shadow-sm text-center">
        <span className="text-5xl mb-4 block">📋</span>
        <div className="text-corp-text-muted text-lg">Оберіть кейс зі списку</div>
        <div className="text-corp-text-muted text-sm mt-1">Тут з'являться деталі пошкоджень</div>
      </div>
    );
  }

  const isPaid = orderCase.is_paid;
  const pendingCount = items.filter(i => !i.processing_type || i.processing_type === 'none').length;
  const assignedCount = items.filter(i => i.processing_type && i.processing_type !== 'none').length;
  
  const amountDue = orderCase.damage_due || 0;
  const depositAvailable = orderCase.deposit_available || 0;
  const depositCurrency = orderCase.deposit_currency || 'UAH';
  const canDeductFromDeposit = !isPaid && amountDue > 0 && depositAvailable > 0 && depositCurrency === 'UAH';

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className={cls("px-5 py-4", isPaid ? "bg-emerald-50" : "bg-rose-50")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">#{orderCase.order_number}</span>
              {isPaid ? <Badge tone="ok">✓ Сплачено</Badge> : <Badge tone="danger">Очікує {money(amountDue)}</Badge>}
            </div>
            <div className="mt-1 text-sm">{orderCase.customer_name}</div>
            {orderCase.customer_phone && <div className="text-xs text-corp-text-muted">{orderCase.customer_phone}</div>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{money(orderCase.total_fee)}</div>
            {orderCase.damage_paid > 0 && !isPaid && <div className="text-xs text-emerald-600">Сплачено: {money(orderCase.damage_paid)}</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x border-b">
        <div className="p-3 text-center">
          <div className="text-2xl font-bold text-corp-text-dark">{items.length}</div>
          <div className="text-xs text-corp-text-muted">Всього</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
          <div className="text-xs text-corp-text-muted">Не розподілено</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-2xl font-bold text-emerald-600">{assignedCount}</div>
          <div className="text-xs text-corp-text-muted">В роботі</div>
        </div>
      </div>

      <div className="p-4 max-h-[50vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-corp-text-main">Пошкоджені позиції</span>
          <GhostBtn onClick={onRefresh} className="text-xs py-1.5">🔄 Оновити</GhostBtn>
        </div>
        
        {loading ? (
          <div className="text-center py-8 text-corp-text-muted">Завантаження...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-corp-text-muted">Немає позицій</div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <DamageItemRow key={item.id} item={item} onSendTo={onSendTo} />
            ))}
          </div>
        )}
      </div>

      {!isPaid && (
        <div className="px-4 py-3 bg-corp-bg-page border-t space-y-2">
          {canDeductFromDeposit && (
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200">
              <div>
                <div className="text-xs text-amber-700">Доступна застава:</div>
                <div className="font-bold text-amber-800">{money(depositAvailable)}</div>
              </div>
              <button onClick={() => onDeductFromDeposit(orderCase, Math.min(amountDue, depositAvailable))} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 text-white px-4 py-2 text-sm font-semibold hover:bg-amber-600 transition">
                💳 Вирахувати із застави
              </button>
            </div>
          )}
          
          {!isPaid && depositAvailable > 0 && depositCurrency !== 'UAH' && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600">
              ⚠️ Застава в {depositCurrency} — вирахування недоступне
            </div>
          )}
          
          <a href={`/finance?order=${orderCase.order_id}`} className="inline-flex items-center justify-center w-full rounded-xl bg-corp-primary text-white px-4 py-2.5 text-sm font-semibold hover:bg-corp-primary-dark transition">
            💰 Перейти до оплати у фінансовий кабінет
          </a>
        </div>
      )}
    </div>
  );
}

// ----------------------------- Main Component -----------------------------
export default function DamageHubApp() {
  const [mode, setMode] = useState(MODES.ALL);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // Data states
  const [orderCases, setOrderCases] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState([]);
  
  const [washItems, setWashItems] = useState([]);
  const [restoreItems, setRestoreItems] = useState([]);
  const [laundryQueue, setLaundryQueue] = useState([]);
  const [laundryBatches, setLaundryBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [batchItems, setBatchItems] = useState([]);
  
  // Selected items for processing tabs
  const [selectedWashId, setSelectedWashId] = useState(null);
  const [selectedRestoreId, setSelectedRestoreId] = useState(null);

  // Load order cases for main tab
  const loadOrderCases = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/cases/grouped`);
      const data = await res.json();
      setOrderCases(data.cases || []);
      if (!selectedOrderId && data.cases?.length > 0) {
        setSelectedOrderId(data.cases[0].order_id);
      }
    } catch (e) {
      console.error("Error loading order cases:", e);
      setOrderCases([]);
    }
  }, [selectedOrderId]);

  const loadOrderDetails = useCallback(async (orderId) => {
    if (!orderId) return;
    setDetailLoading(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/order/${orderId}`);
      const data = await res.json();
      setSelectedOrderItems(data.history || data.items || []);
    } catch (e) {
      console.error("Error loading order details:", e);
      setSelectedOrderItems([]);
    }
    setDetailLoading(false);
  }, []);

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

  const loadLaundryQueue = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/laundry/queue`);
      const data = await res.json();
      setLaundryQueue(data.items || []);
    } catch (e) {
      console.error("Error loading laundry queue:", e);
      setLaundryQueue([]);
    }
  }, []);

  const loadLaundryBatches = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/laundry/batches`);
      const data = await res.json();
      const batches = data.batches || data || [];
      setLaundryBatches(batches);
      if (!selectedBatchId && batches.length > 0) {
        setSelectedBatchId(batches[0].id);
      }
    } catch (e) {
      console.error("Error loading laundry batches:", e);
      setLaundryBatches([]);
    }
  }, [selectedBatchId]);

  const loadBatchItems = useCallback(async (batchId) => {
    if (!batchId) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/laundry/batches/${batchId}`);
      const data = await res.json();
      setBatchItems(data.items || []);
    } catch (e) {
      console.error("Error loading batch items:", e);
      setBatchItems([]);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        loadOrderCases(), 
        loadWashItems(), 
        loadRestoreItems(), 
        loadLaundryQueue(),
        loadLaundryBatches()
      ]);
      setLoading(false);
    };
    loadAll();
  }, []);

  useEffect(() => {
    if (selectedOrderId) loadOrderDetails(selectedOrderId);
  }, [selectedOrderId, loadOrderDetails]);

  useEffect(() => {
    if (selectedBatchId) loadBatchItems(selectedBatchId);
  }, [selectedBatchId, loadBatchItems]);

  // Handlers
  const handleSendTo = async (item, processingType) => {
    try {
      const endpoint = { wash: "send-to-wash", restoration: "send-to-restoration", laundry: "send-to-laundry", return_to_stock: "return-to-stock" }[processingType];
      if (!endpoint) return;
      
      await authFetch(`${BACKEND_URL}/api/product-damage-history/${item.id}/${endpoint}`, {
        method: "POST",
        body: JSON.stringify({ notes: processingType === "return_to_stock" ? "Повернуто на склад без обробки" : "Відправлено з кабінету шкоди" })
      });
      
      await loadOrderDetails(selectedOrderId);
      await loadOrderCases();
      if (processingType === "wash") await loadWashItems();
      if (processingType === "restoration") await loadRestoreItems();
      if (processingType === "laundry") { await loadLaundryQueue(); await loadLaundryBatches(); }
    } catch (e) {
      console.error("Error sending to processing:", e);
      alert("Помилка відправки на обробку");
    }
  };

  const handleComplete = async (item, notes, completedQty = null) => {
    try {
      const body = { notes: notes || "Обробку завершено" };
      if (completedQty !== null) {
        body.completed_qty = completedQty;
      }
      
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/${item.id}/complete-processing`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      
      const result = await res.json();
      
      await loadWashItems();
      await loadRestoreItems();
      
      if (result.is_fully_completed) {
        alert(`✅ Обробку повністю завершено! ${result.total_qty} шт. доступні для оренди.`);
      } else {
        alert(`✅ Оброблено ${result.completed_qty} шт. Залишилось: ${result.remaining} шт.`);
      }
    } catch (e) {
      console.error("Error completing:", e);
      alert("Помилка завершення обробки");
    }
  };

  const handleMarkFailed = async (item, notes) => {
    try {
      await authFetch(`${BACKEND_URL}/api/product-damage-history/${item.id}/mark-failed`, {
        method: "POST",
        body: JSON.stringify({ notes: notes || "Обробка невдала" })
      });
      await loadWashItems();
      await loadRestoreItems();
      alert("Позначено як невдалу обробку");
    } catch (e) {
      console.error("Error marking failed:", e);
    }
  };

  const handleDeductFromDeposit = async (orderCase, amount) => {
    if (!orderCase.deposit_id) {
      alert("Депозит не знайдено для цього замовлення");
      return;
    }
    
    if (!window.confirm(`Вирахувати ${money(amount)} із застави для замовлення #${orderCase.order_number}?`)) return;
    
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/deposits/${orderCase.deposit_id}/use?amount=${amount}&note=Вирахування за пошкодження`, { method: "POST" });
      if (!res.ok) {
        const errData = await res.json();
        alert(`Помилка: ${errData.detail || "Не вдалося вирахувати"}`);
        return;
      }
      alert(`✅ Успішно вирахувано ${money(amount)} із застави`);
      await loadOrderCases();
      if (selectedOrderId) await loadOrderDetails(selectedOrderId);
    } catch (e) {
      console.error("Error deducting from deposit:", e);
      alert("Помилка при вирахуванні із застави");
    }
  };

  const handleReceiveLaundryItems = async (batch, selectedItemIds, allItems) => {
    try {
      const itemsToReturn = allItems.filter(i => selectedItemIds.includes(i.id)).map(i => ({
        item_id: i.id,
        returned_quantity: i.quantity - (i.returned_quantity || 0),
        condition_after: "clean",
        notes: "Прийнято з хімчистки"
      }));
      
      const res = await authFetch(`${BACKEND_URL}/api/laundry/batches/${batch.id}/return-items`, {
        method: "POST",
        body: JSON.stringify(itemsToReturn)
      });
      
      if (!res.ok) {
        const errData = await res.json();
        alert(`Помилка: ${errData.detail || "Не вдалося прийняти товари"}`);
        return;
      }
      
      const result = await res.json();
      alert(`✅ ${result.message || "Товари прийнято"}`);
      await loadLaundryBatches();
      await loadBatchItems(batch.id);
    } catch (e) {
      console.error("Error receiving items:", e);
      alert("Помилка прийому товарів");
    }
  };

  const handleCloseBatch = async (batch) => {
    try {
      await authFetch(`${BACKEND_URL}/api/laundry/batches/${batch.id}/complete`, { method: "POST" });
      alert("✅ Партію закрито");
      await loadLaundryBatches();
    } catch (e) {
      console.error("Error closing batch:", e);
      alert("Помилка закриття партії");
    }
  };

  // Selected items
  const selectedCase = useMemo(() => orderCases.find(c => c.order_id === selectedOrderId) || null, [orderCases, selectedOrderId]);
  const selectedWashItem = useMemo(() => washItems.find(i => i.id === selectedWashId), [washItems, selectedWashId]);
  const selectedRestoreItem = useMemo(() => restoreItems.find(i => i.id === selectedRestoreId), [restoreItems, selectedRestoreId]);
  const selectedBatch = useMemo(() => laundryBatches.find(b => b.id === selectedBatchId), [laundryBatches, selectedBatchId]);

  // Filtered lists
  const filteredCases = useMemo(() => {
    let result = orderCases;
    if (q.trim()) {
      const query = q.toLowerCase();
      result = result.filter(c => `${c.order_number || ""} ${c.customer_name || ""}`.toLowerCase().includes(query));
    }
    // Apply status filter for main tab
    if (statusFilter !== "all" && mode === MODES.ALL) {
      if (statusFilter === "pending") {
        // Очікують - є товари без призначення або не сплачено
        result = result.filter(c => (c.pending_assignment || 0) > 0 || !c.is_paid);
      } else if (statusFilter === "in_progress") {
        // В роботі - товари відправлені на обробку, але не все завершено
        result = result.filter(c => (c.pending_assignment || 0) === 0 && !c.is_paid && (c.completed_count || 0) < c.items_count);
      } else if (statusFilter === "completed") {
        // Виконані - все оброблено і сплачено
        result = result.filter(c => c.is_paid);
      }
    }
    return result;
  }, [orderCases, q, statusFilter, mode]);

  const filteredWashItems = useMemo(() => {
    let result = washItems;
    if (q.trim()) {
      const query = q.toLowerCase();
      result = result.filter(i => `${i.product_name || ""} ${i.sku || ""} ${i.order_number || ""}`.toLowerCase().includes(query));
    }
    if (statusFilter !== "all") {
      result = result.filter(i => i.processing_status === statusFilter);
    }
    return result;
  }, [washItems, q, statusFilter]);

  const filteredRestoreItems = useMemo(() => {
    let result = restoreItems;
    if (q.trim()) {
      const query = q.toLowerCase();
      result = result.filter(i => `${i.product_name || ""} ${i.sku || ""} ${i.order_number || ""}`.toLowerCase().includes(query));
    }
    if (statusFilter !== "all") {
      result = result.filter(i => i.processing_status === statusFilter);
    }
    return result;
  }, [restoreItems, q, statusFilter]);

  const filteredBatches = useMemo(() => {
    let result = laundryBatches;
    if (q.trim()) {
      const query = q.toLowerCase();
      result = result.filter(b => `${b.batch_number || ""} ${b.laundry_company || ""}`.toLowerCase().includes(query));
    }
    return result;
  }, [laundryBatches, q]);

  // Stats
  const stats = useMemo(() => {
    const washPending = washItems.filter(i => i.processing_status === 'pending').length;
    const washInProgress = washItems.filter(i => i.processing_status === 'in_progress').length;
    const washCompleted = washItems.filter(i => i.processing_status === 'completed').length;
    
    const restorePending = restoreItems.filter(i => i.processing_status === 'pending').length;
    const restoreInProgress = restoreItems.filter(i => i.processing_status === 'in_progress').length;
    const restoreCompleted = restoreItems.filter(i => i.processing_status === 'completed').length;
    
    const activeBatches = laundryBatches.filter(b => b.status !== 'completed').length;
    const partialBatches = laundryBatches.filter(b => b.status === 'partial_return').length;
    
    // Stats for main tab (order cases)
    const casesPending = orderCases.filter(c => (c.pending_assignment || 0) > 0 || !c.is_paid).length;
    const casesInProgress = orderCases.filter(c => (c.pending_assignment || 0) === 0 && !c.is_paid && (c.completed_count || 0) < c.items_count).length;
    const casesCompleted = orderCases.filter(c => c.is_paid).length;
    
    return {
      totalCases: orderCases.length,
      casesPending,
      casesInProgress,
      casesCompleted,
      unpaidCases: orderCases.filter(c => !c.is_paid).length,
      pendingAssignment: orderCases.reduce((sum, c) => sum + (c.pending_assignment || 0), 0),
      washCount: washItems.length,
      washPending, washInProgress, washCompleted,
      restoreCount: restoreItems.length,
      restorePending, restoreInProgress, restoreCompleted,
      laundryQueue: laundryQueue.length,
      laundryBatches: laundryBatches.length,
      activeBatches,
      partialBatches
    };
  }, [orderCases, washItems, restoreItems, laundryQueue, laundryBatches]);

  return (
    <div className="min-h-screen bg-corp-bg-page font-montserrat">
      <CorporateHeader cabinetName="Кабінет шкоди" />

      <div className="mx-auto max-w-7xl px-4 py-4 space-y-4">
        {/* Header Card with Tabs */}
        <div className="rounded-2xl border border-corp-border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs mode={mode} setMode={(m) => { setMode(m); setQ(""); setStatusFilter("all"); }} />
            <div className="flex items-center gap-2 rounded-xl border border-corp-border bg-white px-3 py-2">
              <input
                className="w-48 bg-transparent text-sm outline-none font-montserrat"
                placeholder="Пошук..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* KPI Stats - Mode specific */}
        {mode === MODES.ALL && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <div className="corp-stat-card"><div className="corp-stat-label">Кейсів</div><div className="corp-stat-value">{stats.totalCases}</div></div>
            <div className="rounded-2xl border bg-rose-50 border-rose-200 p-4 shadow-sm"><div className="text-xs text-rose-600">Очікують оплати</div><div className="text-2xl font-bold text-rose-700">{stats.unpaidCases}</div></div>
            <div className="rounded-2xl border bg-amber-50 border-amber-200 p-4 shadow-sm"><div className="text-xs text-amber-600">Не розподілено</div><div className="text-2xl font-bold text-amber-700">{stats.pendingAssignment}</div></div>
            <div className="rounded-2xl border bg-blue-50 border-blue-200 p-4 shadow-sm"><div className="text-xs text-blue-600">На мийці</div><div className="text-2xl font-bold text-blue-700">{stats.washCount}</div></div>
            <div className="rounded-2xl border bg-orange-50 border-orange-200 p-4 shadow-sm"><div className="text-xs text-orange-600">Реставрація</div><div className="text-2xl font-bold text-orange-700">{stats.restoreCount}</div></div>
            <div className="rounded-2xl border bg-emerald-50 border-emerald-200 p-4 shadow-sm"><div className="text-xs text-emerald-600">Хімчистка</div><div className="text-2xl font-bold text-emerald-700">{stats.laundryBatches}</div></div>
          </div>
        )}

        {mode === MODES.WASH && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border bg-blue-50 border-blue-200 p-4 shadow-sm"><div className="text-xs text-blue-600">Всього на мийці</div><div className="text-2xl font-bold text-blue-700">{stats.washCount}</div></div>
            <div className="rounded-2xl border bg-amber-50 border-amber-200 p-4 shadow-sm"><div className="text-xs text-amber-600">Очікує</div><div className="text-2xl font-bold text-amber-700">{stats.washPending}</div></div>
            <div className="rounded-2xl border bg-blue-50 border-blue-200 p-4 shadow-sm"><div className="text-xs text-blue-600">В роботі</div><div className="text-2xl font-bold text-blue-700">{stats.washInProgress}</div></div>
            <div className="rounded-2xl border bg-emerald-50 border-emerald-200 p-4 shadow-sm"><div className="text-xs text-emerald-600">Виконано</div><div className="text-2xl font-bold text-emerald-700">{stats.washCompleted}</div></div>
          </div>
        )}

        {mode === MODES.RESTORE && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border bg-amber-50 border-amber-200 p-4 shadow-sm"><div className="text-xs text-amber-600">Всього на реставрації</div><div className="text-2xl font-bold text-amber-700">{stats.restoreCount}</div></div>
            <div className="rounded-2xl border bg-amber-50 border-amber-200 p-4 shadow-sm"><div className="text-xs text-amber-600">Очікує</div><div className="text-2xl font-bold text-amber-700">{stats.restorePending}</div></div>
            <div className="rounded-2xl border bg-blue-50 border-blue-200 p-4 shadow-sm"><div className="text-xs text-blue-600">В роботі</div><div className="text-2xl font-bold text-blue-700">{stats.restoreInProgress}</div></div>
            <div className="rounded-2xl border bg-emerald-50 border-emerald-200 p-4 shadow-sm"><div className="text-xs text-emerald-600">Виконано</div><div className="text-2xl font-bold text-emerald-700">{stats.restoreCompleted}</div></div>
          </div>
        )}

        {mode === MODES.DRYCLEAN && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border bg-amber-50 border-amber-200 p-4 shadow-sm"><div className="text-xs text-amber-600">Черга</div><div className="text-2xl font-bold text-amber-700">{stats.laundryQueue}</div></div>
            <div className="rounded-2xl border bg-blue-50 border-blue-200 p-4 shadow-sm"><div className="text-xs text-blue-600">Активні партії</div><div className="text-2xl font-bold text-blue-700">{stats.activeBatches}</div></div>
            <div className="rounded-2xl border bg-orange-50 border-orange-200 p-4 shadow-sm"><div className="text-xs text-orange-600">Часткове повернення</div><div className="text-2xl font-bold text-orange-700">{stats.partialBatches}</div></div>
            <div className="rounded-2xl border bg-emerald-50 border-emerald-200 p-4 shadow-sm"><div className="text-xs text-emerald-600">Всього партій</div><div className="text-2xl font-bold text-emerald-700">{stats.laundryBatches}</div></div>
          </div>
        )}

        {/* Status Chips for ALL mode */}
        {mode === MODES.ALL && (
          <StatusChips 
            value={statusFilter} 
            onChange={setStatusFilter}
            counts={{
              all: stats.totalCases,
              pending: stats.casesPending,
              in_progress: stats.casesInProgress,
              completed: stats.casesCompleted,
            }}
            labels={{
              pending: "Потребують уваги",
              in_progress: "В обробці",
              completed: "Закриті"
            }}
          />
        )}

        {/* Status Chips for Wash/Restore */}
        {(mode === MODES.WASH || mode === MODES.RESTORE) && (
          <StatusChips 
            value={statusFilter} 
            onChange={setStatusFilter}
            counts={{
              all: mode === MODES.WASH ? stats.washCount : stats.restoreCount,
              pending: mode === MODES.WASH ? stats.washPending : stats.restorePending,
              in_progress: mode === MODES.WASH ? stats.washInProgress : stats.restoreInProgress,
              completed: mode === MODES.WASH ? stats.washCompleted : stats.restoreCompleted,
            }}
          />
        )}

        {/* Main Content - Split Layout */}
        <div className="grid lg:grid-cols-5 gap-4">
          {/* Left Panel */}
          <div className="lg:col-span-2 space-y-3">
            {mode === MODES.ALL && (
              <>
                <div className="flex items-center justify-between px-1">
                  <div className="text-sm font-semibold text-corp-text-main">Ордери з пошкодженнями ({filteredCases.length})</div>
                  <GhostBtn onClick={() => { const token = localStorage.getItem("token"); window.open(`${BACKEND_URL}/api/export/damage-cases?token=${token}`, '_blank'); }} className="text-xs py-1">📥 CSV</GhostBtn>
                </div>
                <div className="max-h-[70vh] overflow-y-auto space-y-2 pr-1">
                  {loading ? (
                    <div className="text-center py-8 text-corp-text-muted">Завантаження...</div>
                  ) : filteredCases.length === 0 ? (
                    <div className="text-center py-8 text-corp-text-muted">Немає кейсів</div>
                  ) : (
                    filteredCases.map((c) => (
                      <OrderCaseRow key={c.order_id} caseData={c} active={c.order_id === selectedOrderId} onClick={() => setSelectedOrderId(c.order_id)} />
                    ))
                  )}
                </div>
              </>
            )}

            {mode === MODES.WASH && (
              <>
                <div className="flex items-center justify-between px-1">
                  <div className="text-sm font-semibold text-corp-text-main">🧼 Товари на мийці ({filteredWashItems.length})</div>
                  <GhostBtn onClick={loadWashItems} className="text-xs py-1">🔄</GhostBtn>
                </div>
                <div className="max-h-[70vh] overflow-y-auto space-y-2 pr-1">
                  {filteredWashItems.length === 0 ? (
                    <div className="text-center py-8 text-corp-text-muted">Немає товарів на мийці</div>
                  ) : (
                    filteredWashItems.map((item) => (
                      <ProcessingItemRow key={item.id} item={item} active={item.id === selectedWashId} onClick={() => setSelectedWashId(item.id)} />
                    ))
                  )}
                </div>
              </>
            )}

            {mode === MODES.RESTORE && (
              <>
                <div className="flex items-center justify-between px-1">
                  <div className="text-sm font-semibold text-corp-text-main">🔧 Товари на реставрації ({filteredRestoreItems.length})</div>
                  <GhostBtn onClick={loadRestoreItems} className="text-xs py-1">🔄</GhostBtn>
                </div>
                <div className="max-h-[70vh] overflow-y-auto space-y-2 pr-1">
                  {filteredRestoreItems.length === 0 ? (
                    <div className="text-center py-8 text-corp-text-muted">Немає товарів на реставрації</div>
                  ) : (
                    filteredRestoreItems.map((item) => (
                      <ProcessingItemRow key={item.id} item={item} active={item.id === selectedRestoreId} onClick={() => setSelectedRestoreId(item.id)} />
                    ))
                  )}
                </div>
              </>
            )}

            {mode === MODES.DRYCLEAN && (
              <>
                <div className="flex items-center justify-between px-1">
                  <div className="text-sm font-semibold text-corp-text-main">🧺 Партії хімчистки ({filteredBatches.length})</div>
                  <GhostBtn onClick={loadLaundryBatches} className="text-xs py-1">🔄</GhostBtn>
                </div>
                <div className="max-h-[70vh] overflow-y-auto space-y-2 pr-1">
                  {filteredBatches.length === 0 ? (
                    <div className="text-center py-8 text-corp-text-muted">Немає партій</div>
                  ) : (
                    filteredBatches.map((batch) => (
                      <LaundryBatchCard key={batch.id} batch={batch} active={batch.id === selectedBatchId} onClick={() => setSelectedBatchId(batch.id)} />
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-3">
            {mode === MODES.ALL && (
              <OrderDetailPanel
                orderCase={selectedCase}
                items={selectedOrderItems}
                loading={detailLoading}
                onSendTo={handleSendTo}
                onRefresh={() => { loadOrderCases(); if (selectedOrderId) loadOrderDetails(selectedOrderId); }}
                onDeductFromDeposit={handleDeductFromDeposit}
              />
            )}

            {mode === MODES.WASH && (
              <ProcessingDetailPanel
                mode={MODES.WASH}
                item={selectedWashItem}
                onComplete={handleComplete}
                onMarkFailed={handleMarkFailed}
                onRefresh={loadWashItems}
              />
            )}

            {mode === MODES.RESTORE && (
              <ProcessingDetailPanel
                mode={MODES.RESTORE}
                item={selectedRestoreItem}
                onComplete={handleComplete}
                onMarkFailed={handleMarkFailed}
                onRefresh={loadRestoreItems}
              />
            )}

            {mode === MODES.DRYCLEAN && (
              <LaundryBatchDetailPanel
                batch={selectedBatch}
                items={batchItems}
                onReceiveItems={handleReceiveLaundryItems}
                onCloseBatch={handleCloseBatch}
                onRefresh={() => { loadLaundryBatches(); if (selectedBatchId) loadBatchItems(selectedBatchId); }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
