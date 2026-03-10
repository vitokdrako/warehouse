/* eslint-disable */
/**
 * DamageHubApp - Кабінет шкоди
 * 
 * Три колонки: Мийка | Реставрація | Пральня
 * Декор летить одразу з повернення у відповідну чергу
 */
import React, { useState, useEffect, useCallback } from "react";
import CorporateHeader from "../components/CorporateHeader";
import { Search, Droplets, Wrench, Shirt, Package, RefreshCw, Check, X, Eye, ChevronDown, ChevronRight } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("uk-UA") : "—";
const fmtTime = (d) => d ? new Date(d).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

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

// ============= ITEM CARD =============
const QueueItemCard = ({ item, onComplete, onPhotoClick, completing }) => {
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
      <div className="mt-2 flex justify-end">
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
const QueueColumn = ({ title, icon: Icon, iconColor, items, loading, onComplete, onPhotoClick, completing, searchQuery }) => {
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white rounded-t-xl">
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
        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
          {filtered.length}
        </span>
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
              onPhotoClick={onPhotoClick}
              completing={completing}
            />
          ))
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

  useEffect(() => { loadAll(); }, [loadAll]);

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

  const openPhoto = (url, name) => setPhotoModal({ isOpen: true, url, name });

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
              items={washItems}
              loading={loading}
              onComplete={handleComplete}
              onPhotoClick={openPhoto}
              completing={completing}
              searchQuery={searchQuery}
            />
          </div>
          
          {/* Реставрація */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col" data-testid="restore-column">
            <QueueColumn
              title="Реставрація"
              icon={Wrench}
              iconColor="bg-orange-100 text-orange-600"
              items={restoreItems}
              loading={loading}
              onComplete={handleComplete}
              onPhotoClick={openPhoto}
              completing={completing}
              searchQuery={searchQuery}
            />
          </div>
          
          {/* Пральня */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col" data-testid="laundry-column">
            <QueueColumn
              title="Пральня"
              icon={Shirt}
              iconColor="bg-purple-100 text-purple-600"
              items={laundryItems}
              loading={loading}
              onComplete={handleComplete}
              onPhotoClick={openPhoto}
              completing={completing}
              searchQuery={searchQuery}
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
