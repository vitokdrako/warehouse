/* eslint-disable */
/**
 * DamageHubApp - Кабінет шкоди (Unified Version)
 * 
 * Оновлення:
 * - Єдиний екран з 3 колонками (як FinanceHub)
 * - Фото з можливістю збільшення
 * - Архів кейсів
 * - БЕЗ фінансових дій (тільки інформування)
 * - Хімчистка з партіями та частковим поверненням
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import CorporateHeader from "../components/CorporateHeader";
import { X, Search, Archive, Package, Droplets, Wrench, Sparkles, ChevronDown, ChevronRight, RefreshCw, Eye, Check, AlertTriangle, Clock } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

// ============= HELPERS =============
const cls = (...classes) => classes.filter(Boolean).join(" ");
const money = (n) => `₴${(+n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("uk-UA") : "—";

const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const defaultHeaders = { "Content-Type": "application/json" };
  if (token) defaultHeaders["Authorization"] = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers: { ...defaultHeaders, ...options.headers } });
  return response;
};

const getPhotoUrl = (item) => {
  if (!item) return null;
  if (item.photo_url) return item.photo_url;
  if (item.image_url) return item.image_url;
  
  // Допоміжна функція для формування повного URL
  const makeFullUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    // Додаємо слеш якщо потрібно
    const base = BACKEND_URL.endsWith('/') ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
  };
  
  if (item.product_image) return makeFullUrl(item.product_image);
  if (item.image) return makeFullUrl(item.image);
  return null;
};

// ============= COMPONENTS =============

// Badge компонент
const Badge = ({ tone = "neutral", children, className = "" }) => {
  const colors = {
    ok: "bg-emerald-100 text-emerald-700 border-emerald-200",
    warn: "bg-amber-100 text-amber-700 border-amber-200",
    danger: "bg-red-100 text-red-700 border-red-200",
    info: "bg-blue-100 text-blue-700 border-blue-200",
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={cls("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", colors[tone], className)}>
      {children}
    </span>
  );
};

// Фото з можливістю збільшення
const ProductPhoto = ({ item, size = "md", className = "", onClick }) => {
  const photoUrl = getPhotoUrl(item);
  const sizes = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-20 h-20",
    xl: "w-28 h-28"
  };
  
  if (!photoUrl) {
    return (
      <div className={cls(
        sizes[size] || sizes.md,
        "rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs flex-shrink-0",
        className
      )}>
        <Package className="w-5 h-5" />
      </div>
    );
  }
  
  return (
    <img 
      src={photoUrl} 
      alt={item.product_name || item.name || "Товар"} 
      className={cls(
        sizes[size] || sizes.md, 
        "rounded-lg object-cover border border-slate-200 cursor-pointer hover:opacity-90 transition flex-shrink-0",
        className
      )}
      onClick={onClick}
      onError={(e) => { e.target.style.display = 'none'; }}
    />
  );
};

// Модалка збільшеного фото
const PhotoModal = ({ isOpen, photoUrl, productName, onClose }) => {
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
      >
        <X className="w-6 h-6" />
      </button>
      <img 
        src={photoUrl}
        alt={productName}
        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

// Картка товару в списку
const DamageItemCard = ({ item, isSelected, onClick, onPhotoClick }) => {
  const getProcessingInfo = () => {
    const type = item.processing_type;
    if (!type || type === 'none') return { icon: null, label: "Не розподілено", color: "text-amber-600" };
    const map = {
      wash: { icon: <Droplets className="w-4 h-4" />, label: "Мийка", color: "text-blue-600" },
      restoration: { icon: <Wrench className="w-4 h-4" />, label: "Реставрація", color: "text-orange-600" },
      laundry: { icon: <Sparkles className="w-4 h-4" />, label: "Хімчистка", color: "text-purple-600" },
    };
    return map[type] || { icon: null, label: type, color: "text-slate-600" };
  };
  
  const processing = getProcessingInfo();
  const isCompleted = item.processing_status === 'completed';
  
  return (
    <div 
      onClick={onClick}
      className={cls(
        "p-3 rounded-xl border bg-white cursor-pointer transition-all hover:shadow-md",
        isSelected ? "ring-2 ring-blue-500 border-blue-300" : "border-slate-200 hover:border-slate-300",
        isCompleted && "opacity-60"
      )}
    >
      <div className="flex gap-3">
        <ProductPhoto 
          item={item} 
          size="md" 
          onClick={(e) => { e.stopPropagation(); onPhotoClick(item); }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium text-slate-800 text-sm truncate">{item.product_name || item.name}</div>
              <div className="text-xs text-slate-500">{item.sku}</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-slate-800">{money(item.fee_amount || item.total_fee || 0)}</div>
              {item.qty > 1 && <div className="text-xs text-slate-500">x{item.qty}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={cls("flex items-center gap-1 text-xs font-medium", processing.color)}>
              {processing.icon}
              {processing.label}
            </span>
            {item.processing_status === 'in_progress' && (
              <Badge tone="info">В роботі</Badge>
            )}
            {isCompleted && (
              <Badge tone="ok">✓ Готово</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Картка замовлення в лівій колонці
const OrderCard = ({ order, isSelected, onClick, isArchived = false }) => {
  const pendingCount = order.pending_assignment || 0;
  const hasIssues = pendingCount > 0;
  
  return (
    <div
      onClick={onClick}
      className={cls(
        "p-3 rounded-xl border cursor-pointer transition-all",
        isSelected ? "ring-2 ring-blue-500 border-blue-300 bg-blue-50" : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm",
        isArchived && "opacity-70"
      )}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold text-slate-800">#{order.order_number}</div>
          <div className="text-sm text-slate-600">{order.customer_name || "—"}</div>
        </div>
        <div className="text-right">
          <div className="font-bold text-slate-800">{money(order.total_fee)}</div>
          <div className="text-xs text-slate-500">{order.items_count} поз.</div>
        </div>
      </div>
      
      {hasIssues && (
        <div className="mt-2 flex items-center gap-1 text-amber-600 text-xs font-medium">
          <AlertTriangle className="w-3 h-3" />
          {pendingCount} не розподілено
        </div>
      )}
      
      {isArchived && (
        <div className="mt-2">
          <Badge tone="neutral">В архіві</Badge>
        </div>
      )}
    </div>
  );
};

// Картка партії хімчистки
const LaundryBatchCard = ({ batch, isSelected, onClick }) => {
  const progress = batch.total_items > 0 ? (batch.returned_items / batch.total_items) * 100 : 0;
  const isComplete = batch.status === 'completed';
  
  return (
    <div
      onClick={onClick}
      className={cls(
        "p-3 rounded-xl border cursor-pointer transition-all",
        isSelected ? "ring-2 ring-purple-500 border-purple-300 bg-purple-50" : "bg-white border-slate-200 hover:border-slate-300",
        isComplete && "opacity-60"
      )}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold text-slate-800">{batch.batch_number || batch.id?.slice(0, 8)}</div>
          <div className="text-sm text-slate-600">{batch.laundry_company}</div>
        </div>
        {isComplete ? (
          <Badge tone="ok">✓ Закрито</Badge>
        ) : batch.status === 'partial_return' ? (
          <Badge tone="warn">Частково</Badge>
        ) : (
          <Badge tone="info">Відправлено</Badge>
        )}
      </div>
      
      <div className="mt-2">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Повернуто: {batch.returned_items}/{batch.total_items}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className={cls("h-full rounded-full transition-all", isComplete ? "bg-emerald-500" : "bg-purple-500")}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// ============= MAIN COMPONENT =============
export default function DamageHubApp() {
  // View states
  const [view, setView] = useState('active'); // 'active' | 'archive'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [orderCases, setOrderCases] = useState([]);
  const [archivedCases, setArchivedCases] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState([]);
  
  // Processing items
  const [washItems, setWashItems] = useState([]);
  const [restoreItems, setRestoreItems] = useState([]);
  const [laundryQueue, setLaundryQueue] = useState([]);
  const [laundryBatches, setLaundryBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [batchItems, setBatchItems] = useState([]);
  
  // Expanded sections in right panel
  const [expandedSections, setExpandedSections] = useState({ wash: true, restore: true, laundry: true });
  
  // Photo modal
  const [photoModal, setPhotoModal] = useState({ isOpen: false, url: null, name: null });
  
  // Laundry batch creation modal
  const [batchModal, setBatchModal] = useState({
    isOpen: false,
    selectedItems: [],
    companyName: '',
    complexity: 'normal' // 'light', 'normal', 'heavy'
  });
  
  // Full-screen section modals
  const [fullScreenModal, setFullScreenModal] = useState({
    isOpen: false,
    section: null // 'wash', 'restore', 'laundry'
  });
  
  // ============= DATA LOADING =============
  const loadOrderCases = useCallback(async () => {
    try {
      // Завантажуємо активні кейси
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/cases/grouped`);
      const data = await res.json();
      setOrderCases(data.cases || []);
      
      // Завантажуємо архівовані кейси окремо
      try {
        const archiveRes = await authFetch(`${BACKEND_URL}/api/product-damage-history/archive`);
        const archiveData = await archiveRes.json();
        setArchivedCases(archiveData.cases || []);
      } catch (e) {
        setArchivedCases([]);
      }
      
      return data.cases || [];
    } catch (e) {
      console.error("Error loading order cases:", e);
      return [];
    }
  }, []);

  const loadOrderDetails = useCallback(async (orderId) => {
    if (!orderId) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/order/${orderId}`);
      const data = await res.json();
      setSelectedOrderItems(data.history || data.items || []);
    } catch (e) {
      console.error("Error loading order details:", e);
      setSelectedOrderItems([]);
    }
  }, []);

  const loadWashItems = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/processing/wash`);
      const data = await res.json();
      setWashItems(data.items || []);
    } catch (e) {
      setWashItems([]);
    }
  }, []);

  const loadRestoreItems = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/processing/restoration`);
      const data = await res.json();
      setRestoreItems(data.items || []);
    } catch (e) {
      setRestoreItems([]);
    }
  }, []);

  const loadLaundryQueue = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/laundry/queue`);
      const data = await res.json();
      setLaundryQueue(data.items || []);
    } catch (e) {
      setLaundryQueue([]);
    }
  }, []);

  const loadLaundryBatches = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/laundry/batches`);
      const data = await res.json();
      setLaundryBatches(data.batches || data || []);
    } catch (e) {
      setLaundryBatches([]);
    }
  }, []);

  const loadBatchItems = useCallback(async (batchId) => {
    if (!batchId) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/laundry/batches/${batchId}`);
      const data = await res.json();
      setBatchItems(data.items || []);
    } catch (e) {
      setBatchItems([]);
    }
  }, []);

  // Track mount status
  const isMountedRef = React.useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const results = await Promise.all([
          loadOrderCases(),
          loadWashItems(),
          loadRestoreItems(),
          loadLaundryQueue(),
          loadLaundryBatches()
        ]);
        
        const cases = results[0];
        
        // Auto-select first order if none selected
        if (cases?.length > 0 && isMountedRef.current) {
          setSelectedOrderId(prev => prev || cases[0].order_id);
        }
      } catch (e) {
        console.error("[DamageHub] Initial load error:", e);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };
    
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedOrderId) loadOrderDetails(selectedOrderId);
  }, [selectedOrderId, loadOrderDetails]);

  useEffect(() => {
    if (selectedBatchId) loadBatchItems(selectedBatchId);
  }, [selectedBatchId, loadBatchItems]);

  // ============= HANDLERS =============
  const handleSendTo = async (itemId, processingType) => {
    try {
      const endpoint = { 
        wash: "send-to-wash", 
        restoration: "send-to-restoration", 
        laundry: "send-to-laundry", 
        return_to_stock: "return-to-stock" 
      }[processingType];
      if (!endpoint) return;
      
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/${itemId}/${endpoint}`, {
        method: "POST",
        body: JSON.stringify({ notes: "Відправлено з кабінету шкоди" })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }
      
      // Повідомлення про успіх
      const messages = {
        wash: "✅ Товар відправлено на мийку",
        restoration: "✅ Товар відправлено на реставрацію",
        laundry: "✅ Товар додано в чергу хімчистки",
        return_to_stock: "✅ Товар повернуто на склад і доступний для оренди"
      };
      alert(messages[processingType] || "✅ Готово");
      
      await loadOrderDetails(selectedOrderId);
      await loadOrderCases();
      if (processingType === "wash") await loadWashItems();
      if (processingType === "restoration") await loadRestoreItems();
      if (processingType === "laundry") { await loadLaundryQueue(); await loadLaundryBatches(); }
    } catch (e) {
      alert(`❌ Помилка: ${e.message || "Помилка відправки на обробку"}`);
    }
  };

  const handleComplete = async (itemId, notes = "") => {
    try {
      await authFetch(`${BACKEND_URL}/api/product-damage-history/${itemId}/complete-processing`, {
        method: "POST",
        body: JSON.stringify({ notes: notes || "Обробку завершено" })
      });
      
      await loadWashItems();
      await loadRestoreItems();
      alert("✅ Обробку завершено!");
    } catch (e) {
      alert("Помилка завершення обробки");
    }
  };

  // Видалити готову позицію зі списку (приховати, не видаляючи з БД)
  const handleRemoveFromList = async (itemId, itemType = 'wash') => {
    try {
      // Для quick_action товарів - використовуємо спеціальний endpoint
      if (String(itemId).startsWith('quick_')) {
        const productId = String(itemId).replace('quick_', '');
        await authFetch(`${BACKEND_URL}/api/product-damage-history/quick-action/complete/${productId}`, {
          method: "POST",
          body: JSON.stringify({ notes: "Видалено зі списку" })
        });
      } else {
        // Для звичайних записів - помічаємо як приховані
        await authFetch(`${BACKEND_URL}/api/product-damage-history/${itemId}/hide`, {
          method: "POST"
        });
      }
      
      // Оновлюємо списки
      if (itemType === 'wash') {
        await loadWashItems();
      } else if (itemType === 'restore') {
        await loadRestoreItems();
      }
    } catch (e) {
      console.error("Error removing item:", e);
      alert("Помилка видалення зі списку");
    }
  };

  const handleArchiveCase = async (orderId) => {
    if (!confirm("Відправити кейс в архів?")) return;
    
    try {
      await authFetch(`${BACKEND_URL}/api/product-damage-history/order/${orderId}/archive`, {
        method: "POST"
      });
      
      await loadOrderCases();
      alert("✅ Кейс відправлено в архів");
    } catch (e) {
      alert("Помилка архівації");
    }
  };

  const handleRestoreFromArchive = async (orderId) => {
    try {
      await authFetch(`${BACKEND_URL}/api/product-damage-history/order/${orderId}/restore`, {
        method: "POST"
      });
      
      await loadOrderCases();
      alert("✅ Кейс відновлено з архіву");
    } catch (e) {
      alert("Помилка відновлення");
    }
  };

  // Відкрити модалку формування партії
  const openBatchModal = () => {
    setBatchModal({
      isOpen: true,
      selectedItems: laundryQueue.map(i => i.id), // За замовчуванням вибрати всі
      companyName: '',
      complexity: 'normal'
    });
  };

  // Перемикання вибору товару в модалці
  const toggleBatchItem = (itemId) => {
    setBatchModal(prev => ({
      ...prev,
      selectedItems: prev.selectedItems.includes(itemId)
        ? prev.selectedItems.filter(id => id !== itemId)
        : [...prev.selectedItems, itemId]
    }));
  };

  // Створити партію
  const handleCreateBatch = async () => {
    if (!batchModal.companyName.trim()) {
      alert("Введіть назву хімчистки");
      return;
    }
    if (batchModal.selectedItems.length === 0) {
      alert("Оберіть хоча б один товар");
      return;
    }
    
    try {
      const res = await authFetch(`${BACKEND_URL}/api/laundry/queue/add-to-batch`, {
        method: "POST",
        body: JSON.stringify({ 
          item_ids: batchModal.selectedItems, 
          laundry_company: batchModal.companyName.trim(),
          complexity: batchModal.complexity
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        alert(`Помилка: ${errData.detail}`);
        return;
      }
      
      await loadLaundryQueue();
      await loadLaundryBatches();
      setBatchModal({ isOpen: false, selectedItems: [], companyName: '', complexity: 'normal' });
      alert("✅ Партію сформовано");
    } catch (e) {
      alert("Помилка формування партії");
    }
  };

  // Legacy function - keep for backward compatibility
  const handleAddToBatch = async (itemIds) => {
    openBatchModal();
  };

  const handleReceiveBatchItem = async (batchId, itemId, quantity) => {
    try {
      await authFetch(`${BACKEND_URL}/api/laundry/batches/${batchId}/return-items`, {
        method: "POST",
        body: JSON.stringify([{
          item_id: itemId,
          returned_quantity: quantity,
          condition_after: "clean"
        }])
      });
      
      await loadLaundryBatches();
      await loadBatchItems(batchId);
      alert("✅ Товар прийнято");
    } catch (e) {
      alert("Помилка прийому");
    }
  };

  const handleCloseBatch = async (batchId) => {
    try {
      await authFetch(`${BACKEND_URL}/api/laundry/batches/${batchId}/complete`, { method: "POST" });
      await loadLaundryBatches();
      alert("✅ Партію закрито");
    } catch (e) {
      alert("Помилка закриття партії");
    }
  };

  // Списання товару при повній втраті
  const handleWriteOff = async (item) => {
    const qty = item.qty || 1;
    if (!confirm(`Списати ${qty} шт. "${item.product_name || item.sku}" через повну втрату?\n\nТовар буде відправлено в переоблік зі статусом "Списано".`)) {
      return;
    }
    
    try {
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/${item.id}/write-off`, {
        method: "POST",
        body: JSON.stringify({ 
          qty: qty,
          reason: "Повна втрата (списано з кабінету шкоди)",
          damage_type: item.damage_type || "TOTAL_LOSS"
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Помилка списання");
      }
      
      await loadOrderDetails(selectedOrderId);
      await loadOrderCases();
      alert("✅ Товар списано! Кількість оновлено в переобліку.");
    } catch (e) {
      alert(`❌ Помилка: ${e.message}`);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // ============= COMPUTED =============
  const selectedOrder = useMemo(() => {
    const allCases = [...orderCases, ...archivedCases];
    return allCases.find(c => c.order_id === selectedOrderId);
  }, [orderCases, archivedCases, selectedOrderId]);

  const selectedBatch = useMemo(() => 
    laundryBatches.find(b => b.id === selectedBatchId),
  [laundryBatches, selectedBatchId]);

  const filteredCases = useMemo(() => {
    const cases = view === 'archive' ? archivedCases : orderCases;
    if (!searchQuery.trim()) return cases;
    const q = searchQuery.toLowerCase();
    return cases.filter(c => 
      `${c.order_number || ''} ${c.customer_name || ''}`.toLowerCase().includes(q)
    );
  }, [view, orderCases, archivedCases, searchQuery]);

  const stats = useMemo(() => ({
    activeCases: orderCases.length,
    archivedCases: archivedCases.length,
    washCount: washItems.filter(i => i.processing_status !== 'completed').length,
    restoreCount: restoreItems.filter(i => i.processing_status !== 'completed').length,
    laundryQueue: laundryQueue.length,
    activeBatches: laundryBatches.filter(b => b.status !== 'completed').length,
    pendingAssignment: orderCases.reduce((sum, c) => sum + (c.pending_assignment || 0), 0)
  }), [orderCases, archivedCases, washItems, restoreItems, laundryQueue, laundryBatches]);

  // ============= RENDER =============
  return (
    <div className="min-h-screen bg-slate-50 font-montserrat">
      <CorporateHeader cabinetName="Кабінет шкоди" />
      
      <div className="max-w-[1600px] mx-auto p-4">
        {/* KPI Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <div className="text-xs text-slate-500">Активні кейси</div>
            <div className="text-2xl font-bold text-slate-800">{stats.activeCases}</div>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
            <div className="text-xs text-amber-600">Не розподілено</div>
            <div className="text-2xl font-bold text-amber-700">{stats.pendingAssignment}</div>
          </div>
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-3">
            <div className="text-xs text-blue-600 flex items-center gap-1"><Droplets className="w-3 h-3" /> Мийка</div>
            <div className="text-2xl font-bold text-blue-700">{stats.washCount}</div>
          </div>
          <div className="bg-orange-50 rounded-xl border border-orange-200 p-3">
            <div className="text-xs text-orange-600 flex items-center gap-1"><Wrench className="w-3 h-3" /> Реставрація</div>
            <div className="text-2xl font-bold text-orange-700">{stats.restoreCount}</div>
          </div>
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-3">
            <div className="text-xs text-purple-600 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Черга хімч.</div>
            <div className="text-2xl font-bold text-purple-700">{stats.laundryQueue}</div>
          </div>
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-3">
            <div className="text-xs text-purple-600">Активні партії</div>
            <div className="text-2xl font-bold text-purple-700">{stats.activeBatches}</div>
          </div>
          <div className="bg-slate-100 rounded-xl border border-slate-200 p-3">
            <div className="text-xs text-slate-500 flex items-center gap-1"><Archive className="w-3 h-3" /> Архів</div>
            <div className="text-2xl font-bold text-slate-600">{stats.archivedCases}</div>
          </div>
        </div>

        {/* Main 3-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* LEFT COLUMN - Orders */}
          <div className="lg:col-span-3 space-y-3">
            {/* Search & View Toggle */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Пошук..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => { loadOrderCases(); loadWashItems(); loadRestoreItems(); loadLaundryQueue(); loadLaundryBatches(); }}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                  title="Оновити"
                >
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              
              {/* View Toggle */}
              <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  onClick={() => setView('active')}
                  className={cls(
                    "flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition",
                    view === 'active' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Активні ({orderCases.length})
                </button>
                <button
                  onClick={() => setView('archive')}
                  className={cls(
                    "flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition flex items-center justify-center gap-1",
                    view === 'archive' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <Archive className="w-3 h-3" /> Архів ({archivedCases.length})
                </button>
              </div>
            </div>

            {/* Orders List */}
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto space-y-2 pr-1">
              {loading ? (
                <div className="text-center py-8 text-slate-400">Завантаження...</div>
              ) : filteredCases.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  {view === 'archive' ? "Архів порожній" : "Немає активних кейсів"}
                </div>
              ) : (
                filteredCases.map(order => (
                  <OrderCard
                    key={order.order_id}
                    order={order}
                    isSelected={order.order_id === selectedOrderId}
                    onClick={() => setSelectedOrderId(order.order_id)}
                    isArchived={view === 'archive'}
                  />
                ))
              )}
            </div>
          </div>

          {/* CENTER COLUMN - Order Items */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-[calc(100vh-260px)] flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">
                      {selectedOrder ? `#${selectedOrder.order_number}` : "Оберіть замовлення"}
                    </h3>
                    {selectedOrder && (
                      <div className="text-sm text-slate-500">{selectedOrder.customer_name}</div>
                    )}
                  </div>
                  {selectedOrder && (
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-slate-800">{money(selectedOrder.total_fee)}</span>
                      {view === 'active' ? (
                        <button
                          onClick={() => handleArchiveCase(selectedOrder.order_id)}
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                          title="В архів"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestoreFromArchive(selectedOrder.order_id)}
                          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                        >
                          Відновити
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {selectedOrderItems.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    {selectedOrder ? "Немає товарів" : "Оберіть замовлення зліва"}
                  </div>
                ) : (
                  selectedOrderItems.map(item => {
                    const isLoss = item.damage_code === 'TOTAL_LOSS' || item.damage_type?.toLowerCase().includes('втрата');
                    const damageLabel = item.damage_type || item.damage_code || 'Невідомо';
                    
                    // Визначаємо колір бейджа за типом
                    const getDamageBadge = () => {
                      const code = item.damage_code?.toLowerCase() || '';
                      const type = item.damage_type?.toLowerCase() || '';
                      
                      if (code === 'total_loss' || type.includes('втрата')) 
                        return { tone: 'danger', label: '🔴 ПОВНА ВТРАТА' };
                      if (code.includes('dirty') || code.includes('wet') || type.includes('бруд') || type.includes('волог'))
                        return { tone: 'info', label: '🧼 ' + damageLabel };
                      if (code.includes('broken') || code.includes('damaged') || code.includes('restore') || type.includes('бій') || type.includes('реставр'))
                        return { tone: 'warn', label: '🔧 ' + damageLabel };
                      if (code.includes('scratch') || code.includes('dent') || code.includes('chip'))
                        return { tone: 'neutral', label: damageLabel };
                      return { tone: 'neutral', label: damageLabel };
                    };
                    
                    const badge = getDamageBadge();
                    
                    return (
                      <div key={item.id} className={cls(
                        "p-3 rounded-xl border bg-white",
                        isLoss ? "border-red-300 bg-red-50" : "border-slate-200"
                      )}>
                        <div className="flex gap-3">
                          <ProductPhoto
                            item={item}
                            size="lg"
                            onClick={() => setPhotoModal({ isOpen: true, url: getPhotoUrl(item), name: item.product_name })}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-semibold text-slate-800">{item.product_name}</div>
                                <div className="text-sm text-slate-500">{item.sku}</div>
                                {/* Кількість */}
                                <div className="text-sm font-medium text-slate-700 mt-0.5">
                                  Кількість: <span className="text-slate-900">{item.qty || 1} шт</span>
                                </div>
                                {/* Причина пошкодження */}
                                <div className="mt-1">
                                  <Badge tone={badge.tone}>{badge.label}</Badge>
                                </div>
                                {item.note && (
                                  <div className="text-xs text-slate-500 mt-1 italic">"{item.note}"</div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-slate-800">{money(item.fee_amount || item.fee || 0)}</div>
                                <div className="text-xs text-slate-500 mt-1">
                                  {item.qty || 1} шт × {money((item.fee_amount || item.fee || 0) / (item.qty || 1))}/шт
                                </div>
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            {(!item.processing_type || item.processing_type === 'none') && view === 'active' && (
                              <div className="flex flex-wrap gap-2 mt-3">
                                {/* Кнопка списання для повної втрати */}
                                {isLoss && (
                                  <button
                                    onClick={() => handleWriteOff(item)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition border border-red-300"
                                  >
                                    <X className="w-3 h-3" /> Списати ({item.qty || 1} шт)
                                  </button>
                                )}
                                
                                <button
                                  onClick={() => handleSendTo(item.id, 'wash')}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                                >
                                  <Droplets className="w-3 h-3" /> Мийка
                                </button>
                                <button
                                  onClick={() => handleSendTo(item.id, 'restoration')}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition"
                                >
                                  <Wrench className="w-3 h-3" /> Реставрація
                                </button>
                                <button
                                  onClick={() => handleSendTo(item.id, 'laundry')}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition"
                                >
                                  <Sparkles className="w-3 h-3" /> Хімчистка
                                </button>
                                <button
                                  onClick={() => handleSendTo(item.id, 'return_to_stock')}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition"
                                >
                                  <Package className="w-3 h-3" /> На склад
                                </button>
                              </div>
                            )}
                            
                            {/* Processing Status */}
                            {item.processing_type && item.processing_type !== 'none' && (
                              <div className="mt-2 flex items-center gap-2">
                                <Badge tone={item.processing_status === 'completed' ? 'ok' : 'info'}>
                                  {item.processing_type === 'wash' && '🧼 Мийка'}
                                  {item.processing_type === 'restoration' && '🔧 Реставрація'}
                                  {item.processing_type === 'laundry' && '🧺 Хімчистка'}
                                  {item.processing_status === 'completed' && ' ✓'}
                                </Badge>
                              </div>
                            )}
                            
                            {/* Списано */}
                            {item.processing_type === 'written_off' && (
                              <div className="mt-2">
                                <Badge tone="danger">❌ Списано</Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Processing Status */}
          <div className="lg:col-span-4 space-y-3">
            
            {/* МИЙКА Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection('wash')}
                className="w-full p-3 flex items-center justify-between bg-blue-50 border-b border-blue-100"
              >
                <span className="font-semibold text-blue-800 flex items-center gap-2">
                  <Droplets className="w-4 h-4" /> Мийка ({washItems.length})
                </span>
                {expandedSections.wash ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-blue-600" />}
              </button>
              
              {expandedSections.wash && (
                <div className="max-h-48 overflow-y-auto p-2 space-y-2">
                  {washItems.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 text-sm">Немає товарів</div>
                  ) : washItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      <ProductPhoto item={item} size="sm" onClick={() => setPhotoModal({ isOpen: true, url: getPhotoUrl(item), name: item.product_name })} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{item.product_name}</div>
                        <div className="text-xs text-slate-500">{item.sku} • <span className="font-medium">{item.qty || 1} шт</span></div>
                      </div>
                      {item.processing_status === 'completed' ? (
                        <button
                          onClick={() => handleRemoveFromList(item.id, 'wash')}
                          className="p-1.5 bg-slate-200 text-slate-500 rounded-lg hover:bg-slate-300 hover:text-slate-700 transition"
                          title="Видалити зі списку"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleComplete(item.id)}
                          className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition"
                          title="Готово"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* РЕСТАВРАЦІЯ Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection('restore')}
                className="w-full p-3 flex items-center justify-between bg-orange-50 border-b border-orange-100"
              >
                <span className="font-semibold text-orange-800 flex items-center gap-2">
                  <Wrench className="w-4 h-4" /> Реставрація ({restoreItems.length})
                </span>
                {expandedSections.restore ? <ChevronDown className="w-4 h-4 text-orange-600" /> : <ChevronRight className="w-4 h-4 text-orange-600" />}
              </button>
              
              {expandedSections.restore && (
                <div className="max-h-48 overflow-y-auto p-2 space-y-2">
                  {restoreItems.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 text-sm">Немає товарів</div>
                  ) : restoreItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      <ProductPhoto item={item} size="sm" onClick={() => setPhotoModal({ isOpen: true, url: getPhotoUrl(item), name: item.product_name })} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{item.product_name}</div>
                        <div className="text-xs text-slate-500">{item.sku} • <span className="font-medium">{item.qty || 1} шт</span></div>
                      </div>
                      {item.processing_status === 'completed' ? (
                        <button
                          onClick={() => handleRemoveFromList(item.id, 'restore')}
                          className="p-1.5 bg-slate-200 text-slate-500 rounded-lg hover:bg-slate-300 hover:text-slate-700 transition"
                          title="Видалити зі списку"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleComplete(item.id)}
                          className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition"
                          title="Готово"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ХІМЧИСТКА Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between bg-purple-50 border-b border-purple-100 p-3">
                <button
                  onClick={() => toggleSection('laundry')}
                  className="flex items-center gap-2 flex-1"
                >
                  <span className="font-semibold text-purple-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Хімчистка
                    {laundryQueue.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 text-xs rounded-full">
                        черга: {laundryQueue.length}
                      </span>
                    )}
                  </span>
                  {expandedSections.laundry ? <ChevronDown className="w-4 h-4 text-purple-600" /> : <ChevronRight className="w-4 h-4 text-purple-600" />}
                </button>
                <button
                  onClick={openBatchModal}
                  disabled={laundryQueue.length === 0}
                  className={`text-xs px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1 ${
                    laundryQueue.length > 0 
                      ? 'bg-purple-500 text-white hover:bg-purple-600' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  title={laundryQueue.length === 0 ? "Черга порожня" : "Сформувати партію"}
                >
                  <Package className="w-3 h-3" /> Сформувати партію
                </button>
              </div>
              
              {expandedSections.laundry && (
                <div className="p-2 space-y-3">
                  {/* Черга - товари що чекають на формування партії */}
                  {laundryQueue.length > 0 && (
                    <div className="bg-amber-50 rounded-lg p-2 border border-amber-200">
                      <div className="flex items-center justify-between px-1 mb-2">
                        <span className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Черга ({laundryQueue.length} поз.)
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {laundryQueue.map(item => (
                          <div key={item.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-100">
                            <ProductPhoto 
                              item={item} 
                              size="sm" 
                              onClick={() => setPhotoModal({ isOpen: true, url: getPhotoUrl(item), name: item.product_name })} 
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-800 truncate">{item.product_name}</div>
                              <div className="text-xs text-slate-500">{item.sku} • <span className="font-medium text-amber-700">{item.qty || item.remaining_qty || 1} шт</span></div>
                            </div>
                            {item.order_number && (
                              <span className="text-xs text-slate-400">#{item.order_number}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Партії */}
                  <div>
                    <div className="text-xs font-semibold text-purple-700 px-1 mb-2 flex items-center gap-1">
                      <Package className="w-3 h-3" /> Партії ({laundryBatches.length})
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {laundryBatches.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 text-sm">Немає активних партій</div>
                      ) : laundryBatches.map(batch => (
                        <LaundryBatchCard
                          key={batch.id}
                          batch={batch}
                          isSelected={batch.id === selectedBatchId}
                          onClick={() => setSelectedBatchId(batch.id === selectedBatchId ? null : batch.id)}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Деталі обраної партії */}
                  {selectedBatch && (
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-bold text-purple-800 text-lg">{selectedBatch.batch_number}</div>
                          <div className="text-sm text-purple-600">{selectedBatch.laundry_company}</div>
                          {selectedBatch.sent_date && (
                            <div className="text-xs text-slate-500 mt-1">
                              Відправлено: {new Date(selectedBatch.sent_date).toLocaleDateString('uk-UA')}
                            </div>
                          )}
                        </div>
                        {selectedBatch.status !== 'completed' && (
                          <button
                            onClick={() => handleCloseBatch(selectedBatch.id)}
                            className="text-xs px-3 py-1.5 bg-purple-200 text-purple-800 rounded-lg hover:bg-purple-300 transition"
                          >
                            Закрити партію
                          </button>
                        )}
                      </div>
                      
                      {/* Товари в партії */}
                      <div className="space-y-2">
                        {batchItems.map(item => {
                          const remaining = item.quantity - (item.returned_quantity || 0);
                          return (
                            <div key={item.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-purple-100">
                              <ProductPhoto 
                                item={item} 
                                size="sm" 
                                onClick={() => setPhotoModal({ isOpen: true, url: getPhotoUrl(item), name: item.product_name })} 
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-800 truncate">{item.product_name}</div>
                                <div className="text-xs text-slate-500">{item.sku}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-center">
                                  <div className="text-xs text-slate-400">Повернуто</div>
                                  <div className={cls(
                                    "font-bold text-sm",
                                    remaining === 0 ? "text-emerald-600" : "text-amber-600"
                                  )}>
                                    {item.returned_quantity || 0}/{item.quantity}
                                  </div>
                                </div>
                                {remaining > 0 && (
                                  <div className="flex items-center gap-1">
                                    {remaining > 1 ? (
                                      <>
                                        <input
                                          type="number"
                                          min="1"
                                          max={remaining}
                                          defaultValue={remaining}
                                          className="w-12 px-1 py-1 text-center text-sm border border-slate-300 rounded"
                                          id={`return-qty-${item.id}`}
                                        />
                                        <button
                                          onClick={() => {
                                            const input = document.getElementById(`return-qty-${item.id}`);
                                            const qty = parseInt(input?.value) || remaining;
                                            handleReceiveBatchItem(selectedBatch.id, item.id, Math.min(qty, remaining));
                                          }}
                                          className="px-2 py-1 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-600 transition"
                                        >
                                          Прийняти
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => handleReceiveBatchItem(selectedBatch.id, item.id, 1)}
                                        className="px-3 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition font-medium"
                                      >
                                        ✓ Прийняти
                                      </button>
                                    )}
                                  </div>
                                )}
                                {remaining === 0 && (
                                  <span className="text-emerald-500">
                                    <Check className="w-5 h-5" />
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Info Block */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-3">
              <div className="flex items-start gap-2">
                <Eye className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700">
                  <strong>Інформація:</strong> Фінансові нарахування відображаються у фінансовому кабінеті. 
                  Тут ви керуєте лише обробкою декору.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Photo Modal */}
      <PhotoModal
        isOpen={photoModal.isOpen}
        photoUrl={photoModal.url}
        productName={photoModal.name}
        onClose={() => setPhotoModal({ isOpen: false, url: null, name: null })}
      />

      {/* Batch Creation Modal */}
      {batchModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-purple-50 border-b border-purple-200 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-purple-800 flex items-center gap-2">
                  <Package className="w-5 h-5" /> Формування партії
                </h2>
                <p className="text-sm text-purple-600 mt-0.5">Оберіть товари та заповніть дані</p>
              </div>
              <button 
                onClick={() => setBatchModal({ isOpen: false, selectedItems: [], companyName: '', complexity: 'normal' })}
                className="p-2 hover:bg-purple-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-purple-600" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Company Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Назва хімчистки <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={batchModal.companyName}
                  onChange={(e) => setBatchModal(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Наприклад: Прана, Чистюля..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              
              {/* Complexity */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Складність обробки
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'light', label: 'Легка', color: 'emerald' },
                    { value: 'normal', label: 'Звичайна', color: 'blue' },
                    { value: 'heavy', label: 'Складна', color: 'amber' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setBatchModal(prev => ({ ...prev, complexity: opt.value }))}
                      className={`py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition ${
                        batchModal.complexity === opt.value
                          ? opt.color === 'emerald' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : opt.color === 'blue' ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Items Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Оберіть товари <span className="text-slate-500">({batchModal.selectedItems.length} обрано)</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBatchModal(prev => ({ ...prev, selectedItems: laundryQueue.map(i => i.id) }))}
                      className="text-xs text-purple-600 hover:text-purple-800"
                    >
                      Обрати всі
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setBatchModal(prev => ({ ...prev, selectedItems: [] }))}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Скинути
                    </button>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
                  {laundryQueue.map(item => (
                    <div
                      key={item.id}
                      onClick={() => toggleBatchItem(item.id)}
                      className={`flex items-center gap-3 p-3 border-b border-slate-100 last:border-b-0 cursor-pointer transition ${
                        batchModal.selectedItems.includes(item.id)
                          ? 'bg-purple-50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                        batchModal.selectedItems.includes(item.id)
                          ? 'bg-purple-500 border-purple-500'
                          : 'border-slate-300'
                      }`}>
                        {batchModal.selectedItems.includes(item.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <ProductPhoto item={item} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{item.product_name}</div>
                        <div className="text-xs text-slate-500">
                          {item.sku} • {item.qty || item.remaining_qty || 1} шт
                          {item.order_number && <span className="text-slate-400 ml-1">• #{item.order_number}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="border-t border-slate-200 px-5 py-4 bg-slate-50 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Дата: <span className="font-medium text-slate-700">{new Date().toLocaleDateString('uk-UA')}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setBatchModal({ isOpen: false, selectedItems: [], companyName: '', complexity: 'normal' })}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition font-medium"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleCreateBatch}
                  disabled={!batchModal.companyName.trim() || batchModal.selectedItems.length === 0}
                  className="px-5 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Package className="w-4 h-4" /> Створити партію
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
