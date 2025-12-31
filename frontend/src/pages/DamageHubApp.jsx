/* eslint-disable */
/**
 * DamageHubApp - Кабінет шкоди
 * Refactored version using separate component files
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import CorporateHeader from "../components/CorporateHeader";

// Import helpers and components from separate files
import { cls, money, fmtDate, authFetch, getPhotoUrl, Badge, GhostBtn, PrimaryBtn, ProductPhoto, MODES, modeMeta } from "../components/damage/DamageHelpers";
import { StatusChips, ProcessingItemRow, ProcessingDetailPanel } from "../components/damage/ProcessingComponents";
import { LaundryQueueItem, LaundryBatchCard, LaundryBatchDetailPanel } from "../components/damage/LaundryComponents";
import { OrderCaseRow, DamageItemRow, OrderDetailPanel } from "../components/damage/MainTabComponents";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

// ----------------------------- Tabs Component -----------------------------
function Tabs({ mode, setMode }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.keys(MODES).map((k) => {
        const m = MODES[k];
        const { title, color } = modeMeta[m];
        const isActive = mode === m;
        return (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cls(
              "rounded-xl px-4 py-2.5 text-sm font-semibold transition border",
              isActive 
                ? `${color} text-white shadow-sm border-transparent` 
                : "bg-white text-corp-text-main border-corp-border hover:bg-corp-bg-page hover:border-corp-border"
            )}
          >
            {title}
          </button>
        );
      })}
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
  const handleSendTo = async (itemId, processingType) => {
    try {
      const endpoint = { wash: "send-to-wash", restoration: "send-to-restoration", laundry: "send-to-laundry", return_to_stock: "return-to-stock" }[processingType];
      if (!endpoint) return;
      
      await authFetch(`${BACKEND_URL}/api/product-damage-history/${itemId}/${endpoint}`, {
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

  const handleComplete = async (itemId, completedQty, notes) => {
    try {
      const body = { notes: notes || "Обробку завершено" };
      if (completedQty !== null && completedQty !== undefined) {
        body.completed_qty = completedQty;
      }
      
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/${itemId}/complete-processing`, {
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

  const handleMarkFailed = async (itemId) => {
    try {
      await authFetch(`${BACKEND_URL}/api/product-damage-history/${itemId}/mark-failed`, {
        method: "POST",
        body: JSON.stringify({ notes: "Обробка невдала" })
      });
      await loadWashItems();
      await loadRestoreItems();
      alert("Позначено як невдалу обробку");
    } catch (e) {
      console.error("Error marking failed:", e);
    }
  };

  const handleDeductFromDeposit = async (orderCase) => {
    if (!orderCase.deposit_id) {
      alert("Депозит не знайдено для цього замовлення");
      return;
    }
    
    const amount = orderCase.damage_due;
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

  const handleReceiveLaundryItems = async (batchNumber, selectedItemIds) => {
    try {
      const batch = laundryBatches.find(b => (b.batch_number || b.id) === batchNumber);
      if (!batch) return;
      
      const itemsToReturn = batchItems.filter(i => selectedItemIds.includes(i.id)).map(i => ({
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

  // Сформувати партію хімчистки з черги
  const handleAddToBatch = async (itemIds) => {
    const company = prompt("Введіть назву хімчистки:", "Прана");
    if (!company) return;
    
    try {
      const res = await authFetch(`${BACKEND_URL}/api/laundry/queue/add-to-batch`, {
        method: "POST",
        body: JSON.stringify({
          item_ids: itemIds,
          laundry_company: company
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        alert(`Помилка: ${errData.detail || "Не вдалося сформувати партію"}`);
        return;
      }
      
      const result = await res.json();
      alert(`✅ ${result.message}`);
      await loadLaundryQueue();
      await loadLaundryBatches();
    } catch (e) {
      console.error("Error creating batch:", e);
      alert("Помилка формування партії");
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
        result = result.filter(c => (c.pending_assignment || 0) > 0 || !c.is_paid);
      } else if (statusFilter === "in_progress") {
        result = result.filter(c => (c.pending_assignment || 0) === 0 && !c.is_paid && (c.completed_count || 0) < c.items_count);
      } else if (statusFilter === "completed") {
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
                {/* Черга хімчистки */}
                {laundryQueue.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between px-1 mb-2">
                      <div className="text-sm font-semibold text-amber-700">📋 Черга ({laundryQueue.length})</div>
                      <GhostBtn onClick={() => handleAddToBatch(laundryQueue.map(i => i.id))} className="text-xs py-1 bg-amber-100 text-amber-800 border-amber-300">
                        + Сформувати партію
                      </GhostBtn>
                    </div>
                    <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                      {laundryQueue.map((item) => (
                        <LaundryQueueItem 
                          key={item.id} 
                          item={item} 
                          selected={false}
                          onSelect={() => {}}
                          onAddToBatch={() => handleAddToBatch([item.id])} 
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Партії */}
                <div className="flex items-center justify-between px-1">
                  <div className="text-sm font-semibold text-corp-text-main">🧺 Партії хімчистки ({filteredBatches.length})</div>
                  <GhostBtn onClick={loadLaundryBatches} className="text-xs py-1">🔄</GhostBtn>
                </div>
                <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1">
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
                mode="wash"
                item={selectedWashItem}
                onComplete={handleComplete}
                onMarkFailed={handleMarkFailed}
                onRefresh={loadWashItems}
              />
            )}

            {mode === MODES.RESTORE && (
              <ProcessingDetailPanel
                mode="restore"
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
