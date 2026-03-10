/* eslint-disable */
/**
 * DamageHubApp - Кабінет шкоди
 * 
 * Три колонки: Мийка | Реставрація | Пральня (черга + партії)
 * Декор летить одразу з повернення у відповідну чергу
 */
import React, { useState, useEffect, useCallback } from "react";
import CorporateHeader from "../components/CorporateHeader";
import { Search, Droplets, Wrench, Shirt, Package, RefreshCw, Check, X, ChevronDown, ChevronRight, Plus, Clock, ArrowRight } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const fmtTime = (d) => d ? new Date(d).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("uk-UA") : "—";

const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...options, headers: { ...headers, ...options.headers } });
};

const getPhotoUrl = (item) => {
  const url = item?.photo_url || item?.product_image || item?.image_url;
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = BACKEND_URL.endsWith('/') ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
  return `${base}/${url.replace(/^\//, '')}`;
};

// ============= QUICK ADD POPOVER =============
const QuickAddPopover = ({ queueType, onAdd, onClose }) => {
  const [sku, setSku] = useState('');
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(null);
  const [error, setError] = useState('');

  const searchBySku = async () => {
    if (!sku.trim()) return;
    setLoading(true);
    setError('');
    setFound(null);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/catalog/products/search?q=${encodeURIComponent(sku.trim())}&limit=1`);
      if (res.ok) {
        const data = await res.json();
        const items = data.products || data.items || data || [];
        if (items.length > 0) {
          setFound(items[0]);
        } else {
          setError('Товар не знайдено');
        }
      } else {
        setError('Помилка пошуку');
      }
    } catch {
      setError('Помилка пошуку');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!found) return;
    setLoading(true);
    try {
      await onAdd({
        product_id: found.product_id || found.id,
        sku: found.sku || found.model || sku.trim(),
        product_name: found.name || found.product_name,
        category: found.category || '',
        queue_type: queueType,
        notes: 'Додано вручну з кабінету шкоди'
      });
      onClose();
    } catch {
      setError('Помилка додавання');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute top-full left-0 right-0 mt-1 z-40 p-3 rounded-xl border border-slate-200 bg-white shadow-xl space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={sku}
          onChange={e => setSku(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && searchBySku()}
          placeholder="Артикул або назва..."
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400"
          autoFocus
        />
        <button onClick={searchBySku} disabled={loading || !sku.trim()} className="px-3 py-2 text-sm bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50">
          {loading ? '...' : 'Знайти'}
        </button>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      {error && <div className="text-xs text-red-500">{error}</div>}
      {found && (
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border">
          {(found.image || found.image_url) ? (
            <img src={getPhotoUrl(found)} className="w-10 h-10 rounded-md object-cover border" alt="" onError={e => e.target.style.display='none'} />
          ) : (
            <div className="w-10 h-10 rounded-md bg-slate-200 flex items-center justify-center"><Package className="w-4 h-4 text-slate-400" /></div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{found.name || found.product_name}</div>
            <div className="text-xs text-slate-500 font-mono">{found.sku || found.model}</div>
          </div>
          <button onClick={handleAdd} disabled={loading} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
            Додати
          </button>
        </div>
      )}
    </div>
  );
};

// ============= ITEM CARD =============
const QueueItemCard = ({ item, onComplete, onDelete, onPhotoClick, completing }) => {
  const photoUrl = getPhotoUrl(item);
  const isInProgress = item.processing_status === 'in_progress';
  const isPending = item.processing_status === 'pending';

  return (
    <div className={`p-3 rounded-xl border bg-white transition-all hover:shadow-sm ${isInProgress ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200'}`}>
      <div className="flex gap-3">
        {/* Photo */}
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={item.product_name}
            className="w-14 h-14 rounded-lg object-cover border border-slate-200 cursor-pointer hover:opacity-80 flex-shrink-0"
            onClick={() => onPhotoClick?.(photoUrl, item.product_name)}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-slate-400" />
          </div>
        )}
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-slate-800 text-sm truncate">{item.product_name}</div>
              <div className="text-xs text-slate-500 font-mono">{item.sku}</div>
            </div>
            {item.qty > 1 && (
              <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                x{item.qty}
              </span>
            )}
          </div>
          
          {/* Damage type */}
          <div className="mt-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-800 truncate" title={item.damage_type}>
            {item.damage_type || "Не вказано"}
          </div>
          
          {/* Meta row */}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span title="Замовлення">
              <span className="font-medium text-slate-700">#{item.order_number}</span>
            </span>
            <span title="Відправлено">
              {fmtTime(item.sent_to_processing_at || item.created_at)}
            </span>
            {item.created_by && (
              <span className="truncate max-w-[120px]" title={`Розподілив: ${item.created_by}`}>
                {item.created_by.split('@')[0]}
              </span>
            )}
          </div>
          
          {/* Note */}
          {item.note && (
            <div className="mt-1.5 text-xs text-slate-600 italic truncate" title={item.note}>
              {item.note}
            </div>
          )}
        </div>
      </div>
      
      {/* Action */}
      <div className="mt-2 flex justify-end gap-1.5">
        <button
          onClick={() => onDelete(item.id)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" />
          Видалити
        </button>
        <button
          onClick={() => onComplete(item.id)}
          disabled={completing === item.id}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors flex items-center gap-1"
        >
          <Check className="w-3.5 h-3.5" />
          {completing === item.id ? 'Обробка...' : 'Готово'}
        </button>
      </div>
    </div>
  );
};

// ============= COLUMN =============
const QueueColumn = ({ title, icon: Icon, iconColor, queueType, items, loading, onComplete, onDelete, onPhotoClick, completing, searchQuery, onQuickAdd }) => {
  const [showAdd, setShowAdd] = useState(false);
  
  const filtered = searchQuery 
    ? items.filter(i => 
        (i.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.sku || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.order_number || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;
  
  const pendingCount = items.filter(i => i.processing_status === 'pending').length;
  const inProgressCount = items.filter(i => i.processing_status === 'in_progress').length;

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Header */}
      <div className="relative px-4 py-3 border-b border-slate-200 bg-white rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColor}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800 text-sm">{title}</div>
              <div className="text-[11px] text-slate-500">
                {pendingCount > 0 && <span className="text-amber-600 font-medium">{pendingCount} очікує</span>}
                {pendingCount > 0 && inProgressCount > 0 && ' · '}
                {inProgressCount > 0 && <span className="text-blue-600 font-medium">{inProgressCount} в роботі</span>}
                {pendingCount === 0 && inProgressCount === 0 && <span>Порожньо</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              title="Додати по артикулу"
            >
              <Plus className="w-4 h-4" />
            </button>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
              {filtered.length}
            </span>
          </div>
        </div>
        {showAdd && (
          <QuickAddPopover
            queueType={queueType}
            onAdd={async (data) => { await onQuickAdd(data); setShowAdd(false); }}
            onClose={() => setShowAdd(false)}
          />
        )}
      </div>
      
      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Завантаження...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Icon className={`w-8 h-8 mx-auto mb-2 text-slate-300`} />
            <div className="text-slate-400 text-sm">
              {searchQuery ? 'Нічого не знайдено' : 'Черга порожня'}
            </div>
          </div>
        ) : (
          filtered.map(item => (
            <QueueItemCard
              key={item.id}
              item={item}
              onComplete={onComplete}
              onDelete={onDelete}
              onPhotoClick={onPhotoClick}
              completing={completing}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ============= BATCH CARD =============
const BatchCard = ({ batch, onToggle, isOpen }) => {
  const statusColors = {
    sent: 'bg-blue-50 text-blue-700 border-blue-200',
    partial_return: 'bg-amber-50 text-amber-700 border-amber-200',
    returned: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    completed: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  const statusLabels = {
    sent: 'Відправлено',
    partial_return: 'Часткове повернення',
    returned: 'Повернено',
    completed: 'Завершено',
  };
  
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition text-left">
        {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-800 truncate">{batch.batch_number}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColors[batch.status] || statusColors.sent}`}>
              {statusLabels[batch.status] || batch.status}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex gap-2">
            <span>{batch.laundry_company}</span>
            <span>·</span>
            <span>{fmtDate(batch.sent_date)}</span>
            <span>·</span>
            <span>{batch.returned_items || 0}/{batch.total_items} шт</span>
          </div>
        </div>
      </button>
      {isOpen && batch.items?.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-slate-100">
          {batch.items.map(item => (
            <div key={item.id} className="flex items-center gap-2 py-1.5 text-xs">
              {item.product_image ? (
                <img src={getPhotoUrl(item)} className="w-8 h-8 rounded-md object-cover border" alt="" onError={e => e.target.style.display='none'} />
              ) : (
                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center"><Package className="w-3 h-3 text-slate-400"/></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium text-slate-700">{item.product_name}</div>
                <div className="text-slate-500 font-mono">{item.sku} · {item.returned_quantity || 0}/{item.quantity} шт</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============= LAUNDRY COLUMN (з партіями) =============
const LaundryColumn = ({ items, loading, onComplete, onDelete, onPhotoClick, completing, searchQuery, batches, batchesLoading, onCreateBatch, onRefreshBatches, onQuickAdd }) => {
  const [tab, setTab] = useState('queue'); // queue | batches
  const [openBatch, setOpenBatch] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchCompany, setBatchCompany] = useState('');
  const [batchType, setBatchType] = useState('laundry');
  const [showAdd, setShowAdd] = useState(false);

  const filtered = searchQuery
    ? items.filter(i =>
        (i.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.sku || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.order_number || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  // Items not yet in a batch
  const queueItems = filtered.filter(i => !i.laundry_batch_id);
  const pendingCount = queueItems.length;
  const activeBatches = (batches || []).filter(b => b.status !== 'completed');

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreateBatch = async () => {
    if (selectedIds.size === 0 || !batchCompany.trim()) return;
    await onCreateBatch(Array.from(selectedIds), batchCompany, batchType);
    setSelectedIds(new Set());
    setShowBatchForm(false);
    setBatchCompany('');
  };

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white rounded-t-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-100 text-purple-600">
              <Shirt className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800 text-sm">Пральня</div>
              <div className="text-[11px] text-slate-500">
                {pendingCount > 0 && <span className="text-amber-600 font-medium">{pendingCount} в черзі</span>}
                {activeBatches.length > 0 && pendingCount > 0 && ' · '}
                {activeBatches.length > 0 && <span className="text-purple-600 font-medium">{activeBatches.length} партій</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              title="Додати по артикулу"
            >
              <Plus className="w-4 h-4" />
            </button>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
              {items.length}
            </span>
          </div>
        </div>
        {showAdd && (
          <QuickAddPopover
            queueType="laundry"
            onAdd={async (data) => { await onQuickAdd(data); setShowAdd(false); }}
            onClose={() => setShowAdd(false)}
          />
        )}
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          <button onClick={() => setTab('queue')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${tab === 'queue' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Черга ({queueItems.length})
          </button>
          <button onClick={() => setTab('batches')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${tab === 'batches' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Партії ({activeBatches.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
        {loading || batchesLoading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Завантаження...</div>
        ) : tab === 'queue' ? (
          <>
            {/* Batch creation toolbar */}
            {queueItems.length > 0 && (
              <div className="mb-2">
                {selectedIds.size > 0 && !showBatchForm && (
                  <button onClick={() => setShowBatchForm(true)} className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 flex items-center justify-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Сформувати партію ({selectedIds.size})
                  </button>
                )}
                {showBatchForm && (
                  <div className="p-3 rounded-xl border border-purple-200 bg-purple-50 space-y-2">
                    <input
                      type="text"
                      value={batchCompany}
                      onChange={e => setBatchCompany(e.target.value)}
                      placeholder="Назва пральні / хімчистки..."
                      className="w-full px-3 py-2 text-sm border rounded-lg"
                    />
                    <div className="flex gap-2">
                      <select value={batchType} onChange={e => setBatchType(e.target.value)} className="flex-1 px-2 py-1.5 text-xs border rounded-lg">
                        <option value="laundry">Хімчистка</option>
                        <option value="washing">Прання</option>
                      </select>
                      <button onClick={handleCreateBatch} disabled={!batchCompany.trim()} className="px-4 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
                        Створити
                      </button>
                      <button onClick={() => setShowBatchForm(false)} className="px-3 py-1.5 rounded-lg text-xs border hover:bg-white">
                        Ні
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {queueItems.length === 0 ? (
              <div className="text-center py-12">
                <Shirt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <div className="text-slate-400 text-sm">{searchQuery ? 'Нічого не знайдено' : 'Черга порожня'}</div>
              </div>
            ) : (
              queueItems.map(item => (
                <div key={item.id} className="flex gap-2 items-start">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="mt-4 w-4 h-4 rounded flex-shrink-0"
                  />
                  <div className="flex-1">
                    <QueueItemCard item={item} onComplete={onComplete} onDelete={onDelete} onPhotoClick={onPhotoClick} completing={completing} />
                  </div>
                </div>
              ))
            )}
          </>
        ) : (
          /* Batches tab */
          activeBatches.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <div className="text-slate-400 text-sm">Немає активних партій</div>
            </div>
          ) : (
            activeBatches.map(batch => (
              <BatchCard key={batch.id} batch={batch} isOpen={openBatch === batch.id} onToggle={() => setOpenBatch(openBatch === batch.id ? null : batch.id)} />
            ))
          )
        )}
      </div>
    </div>
  );
};

// ============= PHOTO MODAL =============
const PhotoModal = ({ isOpen, photoUrl, productName, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white">
        <X className="w-6 h-6" />
      </button>
      <img src={photoUrl} alt={productName} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
    </div>
  );
};

// ============= MAIN =============
export default function DamageHubApp() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [completing, setCompleting] = useState(null);
  
  const [washItems, setWashItems] = useState([]);
  const [restoreItems, setRestoreItems] = useState([]);
  const [laundryItems, setLaundryItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  
  const [photoModal, setPhotoModal] = useState({ isOpen: false, url: null, name: null });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [washRes, restoreRes, laundryRes] = await Promise.all([
        authFetch(`${BACKEND_URL}/api/product-damage-history/processing/wash`),
        authFetch(`${BACKEND_URL}/api/product-damage-history/processing/restoration`),
        authFetch(`${BACKEND_URL}/api/product-damage-history/processing/laundry`),
      ]);
      
      const [washData, restoreData, laundryData] = await Promise.all([
        washRes.json(), restoreRes.json(), laundryRes.json()
      ]);
      
      setWashItems(washData.items || []);
      setRestoreItems(restoreData.items || []);
      setLaundryItems(laundryData.items || []);
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/laundry/batches`);
      if (res.ok) {
        const data = await res.json();
        setBatches(data || []);
      }
    } catch (e) {
      console.error("Batches load error:", e);
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); loadBatches(); }, [loadAll, loadBatches]);

  const handleComplete = async (itemId) => {
    setCompleting(itemId);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/${itemId}/return-to-stock`, {
        method: "POST",
        body: JSON.stringify({ notes: "Обробку завершено" })
      });
      if (res.ok) {
        await loadAll();
      }
    } catch (e) {
      console.error("Complete error:", e);
    } finally {
      setCompleting(null);
    }
  };

  const handleCreateBatch = async (itemIds, company, batchType) => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await authFetch(`${BACKEND_URL}/api/laundry/queue/add-to-batch`, {
        method: "POST",
        body: JSON.stringify({
          item_ids: itemIds,
          laundry_company: company,
          batch_type: batchType,
          created_by: user.name || user.firstname || 'system'
        })
      });
      if (res.ok) {
        await Promise.all([loadAll(), loadBatches()]);
      }
    } catch (e) {
      console.error("Create batch error:", e);
    }
  };

  const openPhoto = (url, name) => setPhotoModal({ isOpen: true, url, name });

  const handleDelete = async (itemId) => {
    if (!confirm('Видалити цю позицію з черги?')) return;
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/${itemId}`, {
        method: "DELETE",
        body: JSON.stringify({ deleted_by: user.name || 'system', reason: 'Видалено з кабінету шкоди' })
      });
      if (res.ok) await loadAll();
    } catch (e) { console.error("Delete error:", e); }
  };

  const handleQuickAdd = async (data) => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/product-damage-history/quick-add-to-queue`, {
        method: "POST",
        body: JSON.stringify(data)
      });
      if (res.ok) await loadAll();
    } catch (e) { console.error("Quick add error:", e); }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <CorporateHeader />
      
      {/* Toolbar */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="text-lg font-bold text-slate-800">Кабінет шкоди</h1>
          
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Пошук за назвою, артикулом або замовленням..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition"
                data-testid="damage-hub-search"
              />
            </div>
          </div>
          
          <button
            onClick={loadAll}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-50 transition"
            title="Оновити"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Three columns */}
      <div className="max-w-[1600px] mx-auto px-4 py-4">
        <div className="grid grid-cols-3 gap-4 h-[calc(100vh-140px)]" data-testid="damage-hub-columns">
          {/* Мийка */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col" data-testid="wash-column">
            <QueueColumn
              title="Мийка"
              icon={Droplets}
              iconColor="bg-blue-100 text-blue-600"
              queueType="wash"
              items={washItems}
              loading={loading}
              onComplete={handleComplete}
              onDelete={handleDelete}
              onPhotoClick={openPhoto}
              completing={completing}
              searchQuery={searchQuery}
              onQuickAdd={handleQuickAdd}
            />
          </div>
          
          {/* Реставрація */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col" data-testid="restore-column">
            <QueueColumn
              title="Реставрація"
              icon={Wrench}
              iconColor="bg-orange-100 text-orange-600"
              queueType="restoration"
              items={restoreItems}
              loading={loading}
              onComplete={handleComplete}
              onDelete={handleDelete}
              onPhotoClick={openPhoto}
              completing={completing}
              searchQuery={searchQuery}
              onQuickAdd={handleQuickAdd}
            />
          </div>
          
          {/* Пральня */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col" data-testid="laundry-column">
            <LaundryColumn
              items={laundryItems}
              loading={loading}
              onComplete={handleComplete}
              onDelete={handleDelete}
              onPhotoClick={openPhoto}
              completing={completing}
              searchQuery={searchQuery}
              batches={batches}
              batchesLoading={batchesLoading}
              onCreateBatch={handleCreateBatch}
              onRefreshBatches={loadBatches}
              onQuickAdd={handleQuickAdd}
            />
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
    </div>
  );
}
