/* eslint-disable */
/**
 * DamageHubApp - Уніфікований Кабінет Шкоди
 * Tabs: Головна, Мийка, Реставрація, Хімчистка
 * Один layout, різні режими фільтрації
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
  [MODES.ALL]: { title: "Головна", hint: "Кейси пошкоджень • фокус на фінанси", color: "bg-slate-900" },
  [MODES.WASH]: { title: "Мийка", hint: "Задачі мийки/чистки по кейсам", color: "bg-blue-600" },
  [MODES.RESTORE]: { title: "Реставрація", hint: "Задачі відновлення/ремонту", color: "bg-amber-600" },
  [MODES.DRYCLEAN]: { title: "Хімчистка", hint: "Черга + партії відправок", color: "bg-emerald-600" },
};

const STATUS = {
  OPEN: "open",
  WAIT_CLIENT: "awaiting_client",
  WAIT_PAY: "awaiting_payment",
  IN_WORK: "in_repair",
  DONE: "done",
  CLOSED: "closed",
};

const statusMeta = {
  [STATUS.OPEN]: { label: "Відкрито", tone: "warn" },
  [STATUS.WAIT_CLIENT]: { label: "Чекаємо клієнта", tone: "warn" },
  [STATUS.WAIT_PAY]: { label: "Чекаємо оплату", tone: "warn" },
  [STATUS.IN_WORK]: { label: "В роботі", tone: "info" },
  [STATUS.DONE]: { label: "Виконано", tone: "ok" },
  [STATUS.CLOSED]: { label: "Закрито", tone: "neutral" },
};

const SEVERITY = { LOW: "low", MED: "medium", CRIT: "critical" };

// ----------------------------- UI Components -----------------------------
const tonePill = (tone) =>
  cls(
    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
    tone === "ok" && "bg-emerald-50 text-emerald-800 border-emerald-200",
    tone === "warn" && "bg-amber-50 text-amber-900 border-amber-200",
    tone === "danger" && "bg-rose-50 text-rose-800 border-rose-200",
    tone === "info" && "bg-blue-50 text-blue-800 border-blue-200",
    tone === "neutral" && "bg-slate-50 text-slate-700 border-slate-200",
    !tone && "bg-slate-50 text-slate-700 border-slate-200"
  );

const Badge = ({ tone = "neutral", children }) => <span className={tonePill(tone)}>{children}</span>;

const SeverityBadge = ({ severity }) => {
  if (severity === SEVERITY.CRIT) return <Badge tone="danger">Critical</Badge>;
  if (severity === SEVERITY.MED) return <Badge tone="warn">Medium</Badge>;
  return <Badge tone="ok">Low</Badge>;
};

const StatusBadge = ({ status }) => {
  const sm = statusMeta[status] || { label: status || "—", tone: "neutral" };
  return <Badge tone={sm.tone}>{sm.label}</Badge>;
};

const GhostBtn = ({ onClick, children, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cls(
      "inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition",
      disabled ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
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

const Stat = ({ label, value, tone = "neutral", onClick }) => (
  <button onClick={onClick} className="rounded-2xl border bg-white p-4 text-left shadow-sm hover:shadow transition w-full">
    <div className="flex items-start justify-between gap-2">
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </div>
      <Badge tone={tone}>{tone}</Badge>
    </div>
  </button>
);

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

// ----------------------------- KPI Bar -----------------------------
function KPIBar({ mode, stats, onPick }) {
  const cards =
    mode === MODES.ALL
      ? [
          { id: "open", label: "Відкриті кейси", value: stats.open, tone: "warn" },
          { id: "wait_client", label: "Чекаємо клієнта", value: stats.wait_client, tone: "warn" },
          { id: "wait_pay", label: "Чекаємо оплату", value: stats.wait_pay, tone: "warn" },
          { id: "restore", label: "В реставрації", value: stats.restore, tone: "info" },
          { id: "closed", label: "Закрито", value: stats.closed, tone: "ok" },
        ]
      : mode === MODES.WASH
      ? [
          { id: "all", label: "Всього на мийці", value: stats.total, tone: "info" },
          { id: "wait", label: "Очікує", value: stats.wait, tone: "warn" },
          { id: "work", label: "В роботі", value: stats.work, tone: "info" },
          { id: "done", label: "Виконано", value: stats.done, tone: "ok" },
        ]
      : mode === MODES.RESTORE
      ? [
          { id: "all", label: "Всього на реставрації", value: stats.total, tone: "info" },
          { id: "wait", label: "Очікує", value: stats.wait, tone: "warn" },
          { id: "work", label: "В роботі", value: stats.work, tone: "info" },
          { id: "done", label: "Виконано", value: stats.done, tone: "ok" },
        ]
      : [
          { id: "queue", label: "Черга", value: stats.queue, tone: "warn" },
          { id: "batches", label: "Активні партії", value: stats.batches, tone: "info" },
          { id: "sent", label: "Відправлено товарів", value: stats.sent, tone: "info" },
          { id: "value", label: "Вартість", value: money(stats.value), tone: "ok" },
        ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((c) => (
        <Stat key={c.id} label={c.label} value={c.value} tone={c.tone} onClick={() => onPick(c.id)} />
      ))}
    </div>
  );
}

// ----------------------------- Status Chips -----------------------------
function StatusChips({ mode, value, onChange }) {
  const common = [
    { id: "all", label: "Всі" },
    { id: "wait", label: "Очікує" },
    { id: "work", label: "В роботі" },
    { id: "done", label: "Виконано" },
  ];

  const allMode = [
    { id: "all", label: "Всі" },
    { id: STATUS.OPEN, label: "Відкрито" },
    { id: STATUS.WAIT_CLIENT, label: "Чекаємо клієнта" },
    { id: STATUS.WAIT_PAY, label: "Чекаємо оплату" },
    { id: STATUS.CLOSED, label: "Закрито" },
  ];

  const chips = mode === MODES.ALL ? allMode : common;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          key={c.id}
          className={cls(
            "rounded-xl border px-3 py-2 text-sm font-medium transition",
            value === c.id ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 hover:bg-slate-50"
          )}
          onClick={() => onChange(c.id)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

// ----------------------------- Case List Item -----------------------------
function ListItem({ item, active, onClick }) {
  const sm = statusMeta[item.status] || { label: "—", tone: "neutral" };

  return (
    <button
      onClick={onClick}
      className={cls(
        "w-full rounded-2xl border bg-white p-3 text-left shadow-sm hover:shadow transition",
        active && "ring-2 ring-corp-primary/30 border-corp-primary/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-slate-900">{item.product_name || item.title}</div>
          <div className="mt-1 text-xs text-slate-500 truncate">
            {item.order_number || `#${item.order_id || "—"}`} • SKU: {item.sku || "—"}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={item.status} />
          <SeverityBadge severity={item.severity || "low"} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
        <span>Створено: {fmtDate(item.created_at)}</span>
        {item.fee || item.amount ? <span className="font-semibold">{money(item.fee || item.amount)}</span> : <span>—</span>}
      </div>
    </button>
  );
}

// ----------------------------- Right Panel (Case Details) -----------------------------
function RightPanel({ mode, item, onAction }) {
  if (!item) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm text-center">
        <span className="text-4xl mb-3 block">📋</span>
        <div className="text-slate-500">Обери кейс зі списку</div>
      </div>
    );
  }

  const sm = statusMeta[item.status] || { label: "—", tone: "neutral" };

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-slate-500">Кейс</div>
          <div className="mt-1 text-xl font-semibold text-slate-900 truncate">{item.product_name || item.title}</div>
          <div className="mt-2 text-sm text-slate-600">
            {item.order_number || `#${item.order_id || "—"}`} • SKU: {item.sku || "—"}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge status={item.status} />
          <SeverityBadge severity={item.severity || "low"} />
        </div>
      </div>

      {/* Details Card */}
      <div className="rounded-xl border bg-slate-50 p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">Джерело</div>
            <div className="font-medium">{item.stage || item.source || "Кабінет шкоди"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Створено</div>
            <div className="font-medium">{fmtDate(item.created_at)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Виконавець</div>
            <div className="font-medium">{item.assigned_to || item.created_by || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Збитки</div>
            <div className="font-medium">{item.fee || item.amount ? money(item.fee || item.amount) : "—"}</div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {item.note && (
        <div className="rounded-xl border bg-amber-50 p-3">
          <div className="text-xs text-amber-700 font-medium mb-1">Примітка</div>
          <div className="text-sm text-amber-800">{item.note}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {mode === MODES.ALL && (
          <>
            <PrimaryBtn variant="success" onClick={() => onAction("close_case", item)}>✓ Закрити кейс</PrimaryBtn>
            <GhostBtn onClick={() => onAction("add_position", item)}>+ Додати позицію</GhostBtn>
            <GhostBtn onClick={() => onAction("to_finance", item)}>💰 До фінансів</GhostBtn>
          </>
        )}

        {mode === MODES.WASH && (
          <>
            <PrimaryBtn variant="dark" onClick={() => onAction("mark_done", item)}>✓ Виконано</PrimaryBtn>
            <GhostBtn onClick={() => onAction("assign", item)}>👤 Призначити</GhostBtn>
            <GhostBtn onClick={() => onAction("in_progress", item)}>▶ В роботу</GhostBtn>
          </>
        )}

        {mode === MODES.RESTORE && (
          <>
            <PrimaryBtn variant="dark" onClick={() => onAction("mark_done", item)}>✓ Завершити</PrimaryBtn>
            <GhostBtn onClick={() => onAction("estimate", item)}>₴ Оцінка</GhostBtn>
            <GhostBtn onClick={() => onAction("urgent", item)}>⚡ Терміново</GhostBtn>
          </>
        )}
      </div>

      {/* Comment Section */}
      <div>
        <div className="text-sm font-semibold mb-2">Коментар</div>
        <textarea
          className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-corp-primary/20"
          placeholder="Внутрішні нотатки…"
          rows={3}
          defaultValue={item.internal_note || ""}
        />
        <div className="mt-2 flex justify-end">
          <GhostBtn onClick={() => onAction("save_note", item)}>Зберегти</GhostBtn>
        </div>
      </div>
    </div>
  );
}

// ----------------------------- Dryclean Queue Panel -----------------------------
function DrycleanQueuePanel({ queue, onAction, onSelectAll, selectedIds, onToggle }) {
  if (!queue || queue.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
        <span className="text-4xl mb-3 block">📥</span>
        <div className="text-slate-500">Черга порожня</div>
        <div className="text-xs text-slate-400 mt-1">Товари з'являться після відправки з Кабінету шкоди</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">Черга на хімчистку</div>
            <div className="text-xs text-slate-600">{queue.length} товарів очікують</div>
          </div>
          <GhostBtn onClick={onSelectAll}>
            {selectedIds.length === queue.length ? "☐ Зняти всі" : "☑ Вибрати всі"}
          </GhostBtn>
        </div>

        <div className="space-y-2">
          {queue.map((item) => (
            <div
              key={item.id}
              className={cls(
                "rounded-xl border bg-white p-3 cursor-pointer transition",
                selectedIds.includes(item.id) ? "ring-2 ring-amber-400 border-amber-300" : "hover:bg-slate-50"
              )}
              onClick={() => onToggle(item.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => {}} className="w-4 h-4 rounded" />
                  <div>
                    <div className="text-sm font-medium">{item.product_name}</div>
                    <div className="text-xs text-slate-500">SKU: {item.sku} • {item.order_number || "Без замовлення"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{fmtDate(item.created_at)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAction("remove", item); }}
                    className="text-rose-500 hover:text-rose-700 p-1"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <PrimaryBtn variant="dark" onClick={() => onAction("create_batch")}>
          📦 Створити партію ({selectedIds.length} товарів)
        </PrimaryBtn>
      )}
    </div>
  );
}

// ----------------------------- Dryclean Batches Panel -----------------------------
function DrycleanBatchesPanel({ batches, onAction }) {
  if (!batches || batches.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
        <span className="text-4xl mb-3 block">📦</span>
        <div className="text-slate-500">Немає активних партій</div>
      </div>
    );
  }

  const statusBadge = (status) => {
    const map = {
      sent: { label: "Відправлено", tone: "info" },
      partial_return: { label: "Часткове", tone: "warn" },
      returned: { label: "Повернено", tone: "ok" },
      completed: { label: "Закрито", tone: "neutral" },
    };
    const s = map[status] || map.sent;
    return <Badge tone={s.tone}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-3">
      {batches.map((b) => (
        <div key={b.id} className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-lg font-semibold">{b.batch_number}</div>
              <div className="text-xs text-slate-500">{b.laundry_company}</div>
            </div>
            {statusBadge(b.status)}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Відправлено</div>
              <div className="font-medium">{fmtDate(b.sent_date)}</div>
            </div>
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Очікується</div>
              <div className="font-medium">{fmtDate(b.expected_return_date)}</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-600">Товарів</span>
            <span className="font-medium">{b.returned_items || 0} / {b.total_items}</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-4">
            <span className="text-slate-600">Сума</span>
            <span className="font-medium">{money(b.cost)}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <GhostBtn onClick={() => onAction("receive", b)}>Прийняти товари</GhostBtn>
            <GhostBtn onClick={() => onAction("close_batch", b)}>Закрити партію</GhostBtn>
            {b.status === "sent" && (
              <button onClick={() => onAction("delete", b)} className="text-rose-600 hover:text-rose-800 text-sm px-3 py-2">
                Видалити
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ----------------------------- Create Batch Modal -----------------------------
function CreateBatchModal({ isOpen, onClose, selectedCount, onCreate }) {
  const [form, setForm] = useState({
    laundry_company: "",
    expected_return_date: "",
    cost: "",
    notes: "",
  });

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!form.laundry_company || !form.expected_return_date) {
      alert("Заповніть обов'язкові поля");
      return;
    }
    onCreate(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">📦 Створити партію ({selectedCount} товарів)</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Хімчистка *</label>
            <input
              type="text"
              value={form.laundry_company}
              onChange={(e) => setForm({ ...form, laundry_company: e.target.value })}
              placeholder="Назва компанії"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Очікувана дата *</label>
            <input
              type="date"
              value={form.expected_return_date}
              onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Вартість (грн)</label>
            <input
              type="number"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Примітки</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Додаткова інформація..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm h-20"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <PrimaryBtn variant="success" onClick={handleSubmit}>✅ Створити</PrimaryBtn>
          <GhostBtn onClick={onClose}>Скасувати</GhostBtn>
        </div>
      </div>
    </div>
  );
}

// ----------------------------- Main Component -----------------------------
export default function DamageHubApp() {
  const [mode, setMode] = useState(MODES.ALL);
  const [chip, setChip] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  // Data
  const [cases, setCases] = useState([]);
  const [washTasks, setWashTasks] = useState([]);
  const [restoreTasks, setRestoreTasks] = useState([]);
  const [laundryQueue, setLaundryQueue] = useState([]);
  const [laundryBatches, setLaundryBatches] = useState([]);
  const [laundryStats, setLaundryStats] = useState(null);

  // Selection
  const [activeId, setActiveId] = useState(null);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  // Reload when mode changes
  useEffect(() => {
    if (mode === MODES.WASH) loadWashTasks();
    else if (mode === MODES.RESTORE) loadRestoreTasks();
    else if (mode === MODES.DRYCLEAN) loadLaundryData();
    else loadCases();
  }, [mode]);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([loadCases(), loadWashTasks(), loadRestoreTasks(), loadLaundryData()]);
    setLoading(false);
  };

  const loadCases = async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/recent?limit=200`);
      const data = await res.json();
      setCases(Array.isArray(data) ? data : []);
      if (data.length > 0 && !activeId) setActiveId(data[0].id);
    } catch (e) {
      console.error("Error loading cases:", e);
      setCases([]);
    }
  };

  const loadWashTasks = async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/tasks?task_type=washing`);
      const data = await res.json();
      setWashTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error loading wash tasks:", e);
      setWashTasks([]);
    }
  };

  const loadRestoreTasks = async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/tasks?task_type=restoration`);
      const data = await res.json();
      setRestoreTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error loading restore tasks:", e);
      setRestoreTasks([]);
    }
  };

  const loadLaundryData = async () => {
    try {
      const [batchesRes, statsRes, queueRes] = await Promise.all([
        authFetch(`${BACKEND_URL}/api/laundry/batches`),
        authFetch(`${BACKEND_URL}/api/laundry/statistics`),
        authFetch(`${BACKEND_URL}/api/laundry/queue`),
      ]);
      const batches = await batchesRes.json();
      const stats = await statsRes.json();
      const queue = await queueRes.json();
      setLaundryBatches(Array.isArray(batches) ? batches : []);
      setLaundryStats(stats);
      setLaundryQueue(Array.isArray(queue) ? queue : []);
    } catch (e) {
      console.error("Error loading laundry data:", e);
    }
  };

  // Compute visible items based on mode and filters
  const visibleItems = useMemo(() => {
    let items = [];
    
    if (mode === MODES.ALL) {
      items = cases;
      if (chip !== "all") items = items.filter((c) => c.status === chip || (chip === STATUS.OPEN && !c.status));
    } else if (mode === MODES.WASH) {
      items = washTasks;
      if (chip === "wait") items = items.filter((t) => t.status === "todo");
      else if (chip === "work") items = items.filter((t) => t.status === "in_progress");
      else if (chip === "done") items = items.filter((t) => t.status === "done");
    } else if (mode === MODES.RESTORE) {
      items = restoreTasks;
      if (chip === "wait") items = items.filter((t) => t.status === "todo");
      else if (chip === "work") items = items.filter((t) => t.status === "in_progress");
      else if (chip === "done") items = items.filter((t) => t.status === "done");
    }

    // Search filter
    if (q.trim()) {
      const query = q.toLowerCase();
      items = items.filter((i) =>
        `${i.product_name || ""} ${i.title || ""} ${i.sku || ""} ${i.order_number || ""}`.toLowerCase().includes(query)
      );
    }

    return items;
  }, [mode, cases, washTasks, restoreTasks, chip, q]);

  const activeItem = useMemo(() => {
    return visibleItems.find((i) => i.id === activeId) || visibleItems[0] || null;
  }, [visibleItems, activeId]);

  // Compute stats
  const stats = useMemo(() => {
    if (mode === MODES.ALL) {
      return {
        open: cases.filter((c) => c.status === STATUS.OPEN || !c.status).length,
        wait_client: cases.filter((c) => c.status === STATUS.WAIT_CLIENT).length,
        wait_pay: cases.filter((c) => c.status === STATUS.WAIT_PAY).length,
        restore: cases.filter((c) => c.status === STATUS.IN_WORK).length,
        closed: cases.filter((c) => c.status === STATUS.CLOSED || c.status === "closed").length,
      };
    }
    if (mode === MODES.DRYCLEAN) {
      return {
        queue: laundryQueue.length,
        batches: laundryBatches.filter((b) => b.status === "sent").length,
        sent: laundryBatches.reduce((s, b) => s + (b.total_items || 0), 0),
        value: laundryBatches.reduce((s, b) => s + (b.cost || 0), 0),
      };
    }
    const tasks = mode === MODES.WASH ? washTasks : restoreTasks;
    return {
      total: tasks.length,
      wait: tasks.filter((t) => t.status === "todo").length,
      work: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
    };
  }, [mode, cases, washTasks, restoreTasks, laundryQueue, laundryBatches]);

  const onKpiPick = (id) => {
    if (mode === MODES.ALL) {
      if (id === "open") setChip(STATUS.OPEN);
      else if (id === "wait_client") setChip(STATUS.WAIT_CLIENT);
      else if (id === "wait_pay") setChip(STATUS.WAIT_PAY);
      else if (id === "closed") setChip(STATUS.CLOSED);
      else setChip("all");
    } else if (mode !== MODES.DRYCLEAN) {
      if (id === "wait") setChip("wait");
      else if (id === "work") setChip("work");
      else if (id === "done") setChip("done");
      else setChip("all");
    }
  };

  const handleAction = async (action, item) => {
    console.log("Action:", action, item);

    if (action === "mark_done") {
      try {
        await authFetch(`${BACKEND_URL}/api/tasks/${item.id}`, {
          method: "PUT",
          body: JSON.stringify({ status: "done" }),
        });
        if (mode === MODES.WASH) loadWashTasks();
        else loadRestoreTasks();
      } catch (e) {
        console.error(e);
      }
    } else if (action === "in_progress") {
      try {
        await authFetch(`${BACKEND_URL}/api/tasks/${item.id}`, {
          method: "PUT",
          body: JSON.stringify({ status: "in_progress" }),
        });
        if (mode === MODES.WASH) loadWashTasks();
        else loadRestoreTasks();
      } catch (e) {
        console.error(e);
      }
    } else if (action === "assign") {
      const assignee = prompt("Введіть ім'я виконавця:");
      if (assignee) {
        try {
          await authFetch(`${BACKEND_URL}/api/tasks/${item.id}`, {
            method: "PUT",
            body: JSON.stringify({ assigned_to: assignee }),
          });
          if (mode === MODES.WASH) loadWashTasks();
          else loadRestoreTasks();
        } catch (e) {
          console.error(e);
        }
      }
    } else if (action === "close_batch") {
      if (confirm("Закрити партію?")) {
        try {
          await authFetch(`${BACKEND_URL}/api/laundry/batches/${item.id}/complete`, { method: "POST" });
          loadLaundryData();
        } catch (e) {
          console.error(e);
        }
      }
    } else if (action === "delete" && mode === MODES.DRYCLEAN) {
      if (confirm("Видалити партію?")) {
        try {
          await authFetch(`${BACKEND_URL}/api/laundry/batches/${item.id}`, { method: "DELETE" });
          loadLaundryData();
        } catch (e) {
          console.error(e);
        }
      }
    } else if (action === "remove") {
      try {
        await authFetch(`${BACKEND_URL}/api/laundry/queue/${item.id}`, { method: "DELETE" });
        loadLaundryData();
      } catch (e) {
        console.error(e);
      }
    } else if (action === "create_batch") {
      setShowBatchModal(true);
    } else {
      alert(`Action: ${action}\n${item?.product_name || item?.title || ""}`);
    }
  };

  const handleCreateBatch = async (form) => {
    try {
      await authFetch(`${BACKEND_URL}/api/laundry/batches/from-queue`, {
        method: "POST",
        body: JSON.stringify({
          item_ids: selectedQueueIds,
          laundry_company: form.laundry_company,
          expected_return_date: form.expected_return_date,
          cost: form.cost ? Number(form.cost) : null,
          notes: form.notes,
        }),
      });
      setShowBatchModal(false);
      setSelectedQueueIds([]);
      loadLaundryData();
      alert("✅ Партію створено");
    } catch (e) {
      console.error(e);
      alert("Помилка створення партії");
    }
  };

  const toggleQueueItem = (id) => {
    setSelectedQueueIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const selectAllQueue = () => {
    if (selectedQueueIds.length === laundryQueue.length) {
      setSelectedQueueIds([]);
    } else {
      setSelectedQueueIds(laundryQueue.map((q) => q.id));
    }
  };

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
                <span className="text-sm text-slate-600">{modeMeta[mode].title}</span>
              </div>
              <div className="mt-1 text-sm text-slate-500">{modeMeta[mode].hint}</div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Tabs mode={mode} setMode={(m) => { setMode(m); setChip("all"); }} />
              <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
                <span className="text-sm text-slate-500">🔍</span>
                <input
                  className="w-48 bg-transparent text-sm outline-none"
                  placeholder="Пошук..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <GhostBtn onClick={loadAllData}>⟳ Оновити</GhostBtn>
            </div>
          </div>

          <div className="mt-4">
            <KPIBar mode={mode} stats={stats} onPick={onKpiPick} />
          </div>

          <div className="mt-4">
            <StatusChips mode={mode} value={chip} onChange={setChip} />
          </div>
        </div>

        {/* Main Split */}
        {loading ? (
          <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
            <div className="animate-spin w-8 h-8 border-2 border-corp-primary border-t-transparent rounded-full mx-auto mb-3"></div>
            Завантаження...
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {/* Left Panel */}
            <div className="col-span-12 lg:col-span-5 space-y-3">
              {mode === MODES.DRYCLEAN ? (
                <DrycleanQueuePanel
                  queue={laundryQueue}
                  onAction={handleAction}
                  selectedIds={selectedQueueIds}
                  onToggle={toggleQueueItem}
                  onSelectAll={selectAllQueue}
                />
              ) : (
                <>
                  <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">Список</div>
                        <div className="text-xs text-slate-500">Показано {visibleItems.length}</div>
                      </div>
                      <GhostBtn onClick={() => handleAction("export")}>Експорт</GhostBtn>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {visibleItems.length === 0 ? (
                      <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500 text-center shadow-sm">
                        Нічого не знайдено
                      </div>
                    ) : (
                      visibleItems.map((item) => (
                        <ListItem
                          key={item.id}
                          item={item}
                          active={item.id === (activeItem?.id || activeId)}
                          onClick={() => setActiveId(item.id)}
                        />
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Right Panel */}
            <div className="col-span-12 lg:col-span-7">
              {mode === MODES.DRYCLEAN ? (
                <DrycleanBatchesPanel batches={laundryBatches} onAction={handleAction} />
              ) : (
                <RightPanel mode={mode} item={activeItem} onAction={handleAction} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Batch Modal */}
      <CreateBatchModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        selectedCount={selectedQueueIds.length}
        onCreate={handleCreateBatch}
      />
    </div>
  );
}
