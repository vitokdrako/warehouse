/* eslint-disable */
/**
 * Orders Archive - Архів замовлень з повною історією
 * Корпоративний дизайн + таймлайн всіх операцій
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CorporateHeader from '../components/CorporateHeader';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helper for image URLs
const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const base = BACKEND_URL.endsWith('/') ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};

// Helpers
const cn = (...xs) => xs.filter(Boolean).join(' ');
const money = (v) => v ? `₴${Number(v).toLocaleString('uk-UA')}` : '₴0';
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const fmtDateShort = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// UI Components
const Badge = ({ kind, children }) => (
  <span className={cn(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
    kind === "ok" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
    kind === "pending" && "bg-amber-50 text-amber-700 border border-amber-200",
    kind === "warn" && "bg-rose-50 text-rose-700 border border-rose-200",
    kind === "info" && "bg-blue-50 text-blue-700 border border-blue-200",
    kind === "neutral" && "bg-slate-100 text-slate-700 border border-slate-200"
  )}>
    {children}
  </span>
);

const Card = ({ title, children, className }) => (
  <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
    {title && (
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
      </div>
    )}
    <div className="p-4">{children}</div>
  </div>
);

// Modal for viewing archived order
const OrderViewModal = ({ order, history, onClose }) => {
  const [activeTab, setActiveTab] = useState('items');
  const [enlargedImage, setEnlargedImage] = useState(null);
  
  if (!order || !history) return null;
  
  const docTypeLabels = {
    invoice_offer: '📋 Рахунок-оферта',
    picking_list: '📦 Лист комплектації',
    issue_act: '📤 Акт видачі',
    return_act: '📥 Акт повернення',
    damage_report: '🔴 Акт шкоди',
    service_act: '📝 Акт виконаних робіт',
    invoice_legal: '💼 Рахунок',
    goods_invoice: '🚚 Накладна'
  };
  
  const viewDocument = async (doc) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/documents/${doc.id}/preview`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        // Fallback to download
        window.open(`${BACKEND_URL}/api/documents/${doc.id}/download`, '_blank');
      }
    } catch (e) {
      console.error('Document preview error:', e);
      window.open(`${BACKEND_URL}/api/documents/${doc.id}/download`, '_blank');
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">📂 {order.order_number}</h2>
            <p className="text-sm text-slate-500">{history.order?.customer_name} · {fmtDateShort(history.order?.rental_start_date)} — {fmtDateShort(history.order?.rental_end_date)}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 text-xl">
            ✕
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 overflow-x-auto">
          {[
            { id: 'items', label: `📦 Товари (${history.items?.length || 0})` },
            { id: 'info', label: '📋 Інформація' },
            { id: 'documents', label: `📄 Документи (${history.documents?.length || 0})` },
            { id: 'timeline', label: `🕐 Історія (${history.timeline?.length || 0})` },
            { id: 'finance', label: '💰 Фінанси' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-3 text-sm font-medium transition border-b-2 -mb-px",
                activeTab === tab.id 
                  ? "border-slate-900 text-slate-900" 
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'items' && (
            <div className="space-y-2">
              {history.items && history.items.length > 0 ? (
                <>
                  <div className="text-xs text-slate-500 mb-3">
                    Всього позицій: {history.items.length} · Товарів: {history.items.reduce((sum, i) => sum + (i.quantity || 1), 0)}
                  </div>
                  {history.items.map((item, idx) => (
                    <div 
                      key={item.id || idx}
                      className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition"
                    >
                      {/* Photo */}
                      <div 
                        className="w-16 h-16 rounded-lg bg-white border border-slate-200 overflow-hidden cursor-pointer hover:shadow-lg transition flex-shrink-0"
                        onClick={() => setEnlargedImage(getImageUrl(item.image_url))}
                      >
                        {item.image_url ? (
                          <img 
                            src={getImageUrl(item.image_url)} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400 text-2xl">📦</div>'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 text-2xl">📦</div>
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">{item.name}</div>
                        <div className="text-sm text-slate-500">SKU: <span className="font-mono">{item.sku}</span></div>
                        {item.category && <div className="text-xs text-slate-400 mt-0.5">{item.category}</div>}
                      </div>
                      
                      {/* Quantity & Price */}
                      <div className="text-right flex-shrink-0">
                        <div className="text-2xl font-bold text-slate-900">×{item.quantity || 1}</div>
                        <div className="text-sm text-slate-500">{money(item.rental_price || item.price)}/шт</div>
                        <div className="text-xs text-emerald-600 font-medium">{money(item.subtotal)}</div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Total */}
                  <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-700 font-medium">Сума товарів:</span>
                      <span className="text-lg font-bold text-emerald-800">{money(history.order?.total_price)}</span>
                    </div>
                    {Number(history.order?.service_fee || 0) > 0 && (
                      <>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-emerald-200">
                          <span className="text-amber-700 font-medium">{history.order?.service_fee_name || 'Додаткова послуга'}:</span>
                          <span className="text-lg font-bold text-amber-700">{money(history.order?.service_fee)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-emerald-300">
                          <span className="text-emerald-800 font-semibold">Разом до сплати:</span>
                          <span className="text-2xl font-bold text-emerald-900">{money(history.order?.total_to_pay || (Number(history.order?.total_price || 0) + Number(history.order?.service_fee || 0)))}</span>
                        </div>
                      </>
                    )}
                    {!Number(history.order?.service_fee || 0) && (
                      <div className="flex justify-between items-center mt-0">
                        <span></span>
                        <span className="text-xs text-emerald-600">до сплати</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <div className="text-4xl mb-2">📦</div>
                  <div>Немає товарів</div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Order Info */}
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <h3 className="text-xs font-semibold text-slate-500 mb-3 uppercase">Замовлення</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">Номер:</span><span className="font-bold">{history.order?.order_number}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Статус:</span><Badge kind="ok">{history.order?.status}</Badge></div>
                    <div className="flex justify-between"><span className="text-slate-600">Тип події:</span><span>{history.order?.event_type || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Доставка:</span><span>{history.order?.delivery_type || 'Самовивіз'}</span></div>
                    {history.order?.city && <div className="flex justify-between"><span className="text-slate-600">Місто:</span><span>{history.order?.city}</span></div>}
                  </div>
                </div>
                
                <div className="rounded-xl bg-slate-50 p-4">
                  <h3 className="text-xs font-semibold text-slate-500 mb-3 uppercase">Клієнт</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">Ім'я:</span><span className="font-medium">{history.order?.customer_name}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Телефон:</span><span>{history.order?.customer_phone}</span></div>
                    {history.order?.customer_email && <div className="flex justify-between"><span className="text-slate-600">Email:</span><span>{history.order?.customer_email}</span></div>}
                  </div>
                </div>
              </div>
              
              {/* Dates & Amounts */}
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <h3 className="text-xs font-semibold text-slate-500 mb-3 uppercase">Період оренди</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">Початок:</span><span className="font-medium">{fmtDateShort(history.order?.rental_start_date)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Кінець:</span><span className="font-medium">{fmtDateShort(history.order?.rental_end_date)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Днів:</span><span className="font-bold">{history.order?.rental_days || '—'}</span></div>
                    {history.order?.issue_date && <div className="flex justify-between"><span className="text-slate-600">Видано:</span><span>{fmtDateShort(history.order?.issue_date)}</span></div>}
                    {history.order?.return_date && <div className="flex justify-between"><span className="text-slate-600">Повернено:</span><span>{fmtDateShort(history.order?.return_date)}</span></div>}
                  </div>
                </div>
                
                <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200">
                  <h3 className="text-xs font-semibold text-emerald-600 mb-3 uppercase">Фінанси</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-emerald-700">Сума оренди:</span><span className="font-bold text-emerald-800 text-lg">{money(history.order?.total_price)}</span></div>
                    {Number(history.order?.service_fee || 0) > 0 && (
                      <div className="flex justify-between"><span className="text-amber-700">{history.order?.service_fee_name || 'Додаткова послуга'}:</span><span className="font-bold text-amber-700">{money(history.order?.service_fee)}</span></div>
                    )}
                    {Number(history.order?.service_fee || 0) > 0 && (
                      <div className="flex justify-between pt-2 border-t border-emerald-200"><span className="text-emerald-800 font-semibold">Разом до сплати:</span><span className="font-bold text-emerald-900 text-lg">{money(history.order?.total_to_pay || (Number(history.order?.total_price || 0) + Number(history.order?.service_fee || 0)))}</span></div>
                    )}
                    <div className="flex justify-between"><span className="text-emerald-700">Застава:</span><span className="font-bold text-emerald-800">{money(history.order?.deposit_amount)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'documents' && (
            <div className="space-y-3">
              {history.documents && history.documents.length > 0 ? (
                history.documents.map((doc, idx) => (
                  <div 
                    key={doc.id || idx}
                    className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition cursor-pointer group"
                    onClick={() => viewDocument(doc)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{docTypeLabels[doc.doc_type]?.split(' ')[0] || '📄'}</span>
                      <div>
                        <div className="font-medium text-slate-900">{docTypeLabels[doc.doc_type]?.slice(2) || doc.doc_type}</div>
                        <div className="text-xs text-slate-500">#{doc.doc_number} · {fmtDate(doc.created_at)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge kind={doc.status === 'signed' ? 'ok' : 'neutral'}>{doc.status === 'signed' ? '✅ Підписано' : 'Чернетка'}</Badge>
                      <span className="text-slate-400 group-hover:text-slate-600 transition">👁️ Переглянути</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <div className="text-4xl mb-2">📭</div>
                  <div>Немає документів</div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'timeline' && (
            <div className="space-y-3">
              {history.timeline && history.timeline.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
                  {history.timeline.map((item, idx) => (
                    <div key={idx} className="relative flex gap-4 pl-10 py-2">
                      <div className={cn(
                        "absolute left-2.5 w-4 h-4 rounded-full border-2 border-white shadow",
                        item.type === 'lifecycle' && 'bg-indigo-500',
                        item.type === 'payment' && 'bg-green-500',
                        item.type === 'deposit' && 'bg-amber-500',
                        item.type === 'damage' && 'bg-rose-500',
                        item.type === 'document' && 'bg-slate-500',
                        item.type === 'issue' && 'bg-emerald-500',
                        item.type === 'return' && 'bg-purple-500',
                        !['lifecycle','payment','deposit','damage','document','issue','return'].includes(item.type) && 'bg-blue-500'
                      )}></div>
                      <div className="flex-1 bg-slate-50 rounded-xl p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-900">{item.title}</span>
                          <span className="text-xs text-slate-400">{fmtDate(item.timestamp)}</span>
                        </div>
                        {item.details && <div className="text-sm text-slate-600 mt-1">{item.details}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <div className="text-4xl mb-2">📜</div>
                  <div>Немає подій</div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'finance' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Financial Summary */}
              <div className="md:col-span-2 rounded-xl bg-slate-50 p-4 border border-slate-200">
                <h3 className="text-xs font-semibold text-slate-500 mb-3 uppercase">Зведення</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500">Сума оренди</div>
                    <div className="text-lg font-bold text-slate-900">{money(history.order?.total_price)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">{history.order?.service_fee_name || 'Дод. послуги'}</div>
                    <div className="text-lg font-bold text-amber-700">{money(history.order?.service_fee || 0)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Разом до сплати</div>
                    <div className="text-lg font-bold text-emerald-700">{money(history.order?.total_to_pay || (Number(history.order?.total_price || 0) + Number(history.order?.service_fee || 0)))}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Застава</div>
                    <div className="text-lg font-bold text-slate-900">{money(history.order?.deposit_amount)}</div>
                  </div>
                </div>
              </div>
              
              {/* Payments */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Платежі ({history.payments?.length || 0})</h3>
                {history.payments && history.payments.length > 0 ? (
                  <div className="space-y-2">
                    {history.payments.map((p, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-emerald-800">{money(p.amount)}</span>
                          <Badge kind="ok">{p.payment_type}</Badge>
                        </div>
                        <div className="text-xs text-emerald-600 mt-1">{fmtDate(p.created_at)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl">Немає платежів</div>
                )}
              </div>
              
              {/* Deposits */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">🔒 Застави ({history.deposits?.length || 0})</h3>
                {history.deposits && history.deposits.length > 0 ? (
                  <div className="space-y-2">
                    {history.deposits.map((d, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-amber-800">{money(d.actual_amount || d.held_amount)}</span>
                          <Badge kind={d.status === 'closed' ? 'ok' : 'pending'}>{d.status}</Badge>
                        </div>
                        <div className="text-xs text-amber-600 mt-1">
                          Утримано: {money(d.used_amount)} · Повернено: {money(d.refunded_amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl">Немає застав</div>
                )}
              </div>
              
              {/* Damages */}
              {history.damages && history.damages.length > 0 && (
                <div className="md:col-span-2">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">🔴 Шкоди ({history.damages.length})</h3>
                  <div className="space-y-2">
                    {history.damages.map((dm, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-rose-800">{dm.sku} - {dm.product_name || dm.damage_type}</span>
                          <span className="font-bold text-rose-800">{money(dm.fee)}</span>
                        </div>
                        <div className="text-xs text-rose-600 mt-1">{dm.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Enlarged Image Modal */}
        {enlargedImage && (
          <div 
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setEnlargedImage(null)}
          >
            <div className="relative max-w-3xl max-h-[85vh]">
              <img 
                src={enlargedImage} 
                alt="Enlarged" 
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
              <button 
                onClick={() => setEnlargedImage(null)}
                className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-500 hover:text-slate-700 text-xl"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Input = (props) => (
  <input
    {...props}
    className={cn(
      "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200",
      props.className
    )}
  />
);

const Select = ({ value, onChange, options, className }) => (
  <select
    className={cn("h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200", className)}
    value={value}
    onChange={(e) => onChange(e.target.value)}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

const Button = ({ children, variant = "primary", ...props }) => (
  <button
    {...props}
    className={cn(
      "h-10 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50",
      variant === "primary" && "bg-slate-900 text-white hover:bg-slate-800",
      variant === "ghost" && "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
      props.className
    )}
  >
    {children}
  </button>
);

// Timeline Component
const Timeline = ({ items }) => {
  const typeIcons = {
    order: '🛒',
    issue: '📦',
    return: '📥',
    payment: '💰',
    deposit: '🔒',
    damage: '🔴',
    document: '📄',
    lifecycle: '📌'
  };
  
  const typeColors = {
    order: 'bg-blue-500',
    issue: 'bg-emerald-500',
    return: 'bg-purple-500',
    payment: 'bg-green-500',
    deposit: 'bg-amber-500',
    damage: 'bg-rose-500',
    document: 'bg-slate-500',
    lifecycle: 'bg-indigo-500'
  };
  
  return (
    <div className="relative">
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200"></div>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className="relative flex gap-4 pl-8">
            <div className={cn(
              "absolute left-1.5 w-3 h-3 rounded-full border-2 border-white shadow",
              typeColors[item.type] || 'bg-slate-400'
            )}></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm">{typeIcons[item.type] || '•'}</span>
                <span className="text-sm font-medium text-slate-900">{item.title}</span>
                <span className="text-xs text-slate-500">{fmtDate(item.timestamp)}</span>
              </div>
              {item.details && (
                <div className="text-xs text-slate-600 mt-0.5">{item.details}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function OrdersArchive() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderHistory, setOrderHistory] = useState({});
  const [historyLoading, setHistoryLoading] = useState({});
  
  // View modal state
  const [viewOrder, setViewOrder] = useState(null);
  const [viewHistory, setViewHistory] = useState(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [archiveFilter, setArchiveFilter] = useState('archived');
  const [sortBy, setSortBy] = useState('date_desc');
  
  const statusLabels = {
    awaiting_customer: 'Очікує',
    processing: 'В обробці',
    ready_for_issue: 'Готово',
    issued: 'Видано',
    on_rent: 'В оренді',
    returned: 'Повернуто',
    completed: 'Завершено',
    cancelled: 'Скасовано',
    declined: 'Відхилено'
  };
  
  const statusKinds = {
    awaiting_customer: 'pending',
    processing: 'info',
    ready_for_issue: 'ok',
    issued: 'ok',
    on_rent: 'ok',
    returned: 'neutral',
    completed: 'neutral',
    cancelled: 'warn',
    declined: 'warn'
  };
  
  // Fetch orders
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const archiveParam = archiveFilter === 'archived' ? 'true' : archiveFilter === 'active' ? 'false' : 'all';
      const res = await fetch(`${BACKEND_URL}/api/decor-orders?status=all&archived=${archiveParam}&limit=500`);
      const data = await res.json();
      setOrders(data.orders || data || []);
    } catch (e) {
      console.error('Fetch orders error:', e);
    }
    setLoading(false);
  }, [archiveFilter]);
  
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);
  
  // Fetch full history for order
  const fetchHistory = async (orderId) => {
    if (orderHistory[orderId]) return;
    
    setHistoryLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      const res = await fetch(`${BACKEND_URL}/api/archive/${orderId}/full-history`);
      const data = await res.json();
      setOrderHistory(prev => ({ ...prev, [orderId]: data }));
    } catch (e) {
      console.error('Fetch history error:', e);
    }
    setHistoryLoading(prev => ({ ...prev, [orderId]: false }));
  };
  
  // Toggle expanded order
  const toggleExpand = (order) => {
    const orderId = order.order_id || order.id;
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
      fetchHistory(orderId);
    }
  };
  
  // Archive/Unarchive
  const handleArchive = async (orderId, orderNumber) => {
    if (!window.confirm(`Архівувати замовлення ${orderNumber}?`)) return;
    try {
      await fetch(`${BACKEND_URL}/api/decor-orders/${orderId}/archive`, { method: 'POST' });
      fetchOrders();
    } catch (e) {
      alert('Помилка: ' + e.message);
    }
  };
  
  const handleUnarchive = async (orderId, orderNumber) => {
    if (!window.confirm(`Розархівувати замовлення ${orderNumber}?`)) return;
    try {
      await fetch(`${BACKEND_URL}/api/decor-orders/${orderId}/unarchive`, { method: 'POST' });
      fetchOrders();
    } catch (e) {
      alert('Помилка: ' + e.message);
    }
  };
  
  // Filter & Sort
  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(q) ||
      order.client_name?.toLowerCase().includes(q) ||
      order.customer_name?.toLowerCase().includes(q) ||
      order.client_phone?.includes(q) ||
      order.customer_phone?.includes(q)
    );
  });
  
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    switch (sortBy) {
      case 'date_asc': return new Date(a.created_at) - new Date(b.created_at);
      case 'amount_desc': return (b.total_to_pay || b.total_rental || b.total_price || 0) - (a.total_to_pay || a.total_rental || a.total_price || 0);
      case 'amount_asc': return (a.total_to_pay || a.total_rental || a.total_price || 0) - (b.total_to_pay || b.total_rental || b.total_price || 0);
      default: return new Date(b.created_at) - new Date(a.created_at);
    }
  });
  
  const totalAmount = sortedOrders.reduce((sum, o) => sum + (o.total_to_pay || o.total_rental || o.total_price || 0), 0);
  
  return (
    <div className="min-h-screen bg-slate-50">
      <CorporateHeader />
      
      {/* Sub Header */}
      <div className="sticky top-[60px] z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/manager')} className="text-slate-500 hover:text-slate-700">
                ← Назад
              </button>
              <h1 className="text-lg font-bold">📂 Архів замовлень</h1>
              <span className="text-sm text-slate-500">{sortedOrders.length} з {orders.length}</span>
            </div>
            <Button variant="ghost" onClick={fetchOrders}>🔄</Button>
          </div>
          
          {/* Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Select
              value={archiveFilter}
              onChange={setArchiveFilter}
              options={[
                { value: 'archived', label: '📂 Архівні' },
                { value: 'active', label: '📋 Активні' },
                { value: 'all', label: '📊 Всі' }
              ]}
              className="border-2 border-blue-200 bg-blue-50"
            />
            <Input
              placeholder="Пошук..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Select
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'date_desc', label: 'Дата ↓' },
                { value: 'date_asc', label: 'Дата ↑' },
                { value: 'amount_desc', label: 'Сума ↓' },
                { value: 'amount_asc', label: 'Сума ↑' }
              ]}
            />
            <div className="flex items-center text-sm text-slate-600">
              📊 Всього: {money(totalAmount)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Orders List */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Завантаження...</div>
        ) : sortedOrders.length === 0 ? (
          <div className="text-center py-12 text-slate-500">Немає замовлень</div>
        ) : (
          <div className="space-y-3">
            {sortedOrders.map(order => {
              const orderId = order.order_id || order.id;
              const isExpanded = expandedOrder === orderId;
              const history = orderHistory[orderId];
              const isLoadingHistory = historyLoading[orderId];
              
              return (
                <Card key={orderId} className="overflow-hidden">
                  {/* Order Header */}
                  <div 
                    onClick={() => toggleExpand(order)}
                    className="flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition -m-4 p-4"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-slate-900">{order.order_number}</span>
                      <Badge kind={statusKinds[order.status] || 'neutral'}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                      {order.is_archived && <Badge kind="neutral">📂 Архів</Badge>}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold text-slate-900">{money(order.total_to_pay || order.total_rental || order.total_price)}</div>
                        <div className="text-xs text-slate-500">{order.client_name || order.customer_name}</div>
                      </div>
                      <span className="text-slate-400">{isExpanded ? '▼' : '▶'}</span>
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 mt-4 pt-4">
                      {isLoadingHistory ? (
                        <div className="text-center py-8 text-slate-500">Завантаження історії...</div>
                      ) : history ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Order Info */}
                          <div className="space-y-4">
                            <div className="rounded-xl bg-slate-50 p-4">
                              <div className="text-xs font-semibold text-slate-500 mb-3">ІНФОРМАЦІЯ</div>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Клієнт:</span>
                                  <span className="font-medium">{history.order.customer_name}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Телефон:</span>
                                  <span>{history.order.customer_phone}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Період:</span>
                                  <span>{history.order.rental_start_date?.slice(0,10)} — {history.order.rental_end_date?.slice(0,10)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Сума оренди:</span>
                                  <span className="font-semibold">{money(history.order.total_price)}</span>
                                </div>
                                {history.order.service_fee > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">{history.order.service_fee_name || 'Додаткова послуга'}:</span>
                                    <span className="font-semibold text-amber-700">{money(history.order.service_fee)}</span>
                                  </div>
                                )}
                                {history.order.service_fee > 0 && (
                                  <div className="flex justify-between pt-1 border-t border-slate-200">
                                    <span className="text-slate-700 font-medium">Разом до сплати:</span>
                                    <span className="font-bold text-slate-900">{money(history.order.total_to_pay || (Number(history.order.total_price || 0) + Number(history.order.service_fee || 0)))}</span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Застава:</span>
                                  <span className="font-semibold">{money(history.order.deposit_amount)}</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Summary */}
                            <div className="rounded-xl bg-slate-50 p-4">
                              <div className="text-xs font-semibold text-slate-500 mb-3">ПІДСУМОК</div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                                  <div className="text-lg font-bold text-emerald-600">{history.payments?.length || 0}</div>
                                  <div className="text-xs text-slate-500">Платежів</div>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                                  <div className="text-lg font-bold text-blue-600">{history.documents?.length || 0}</div>
                                  <div className="text-xs text-slate-500">Документів</div>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                                  <div className="text-lg font-bold text-amber-600">{history.deposits?.length || 0}</div>
                                  <div className="text-xs text-slate-500">Застав</div>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                                  <div className="text-lg font-bold text-rose-600">{history.damages?.length || 0}</div>
                                  <div className="text-xs text-slate-500">Шкод</div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex gap-2">
                              <Button 
                                variant="primary" 
                                className="flex-1" 
                                onClick={() => {
                                  setViewOrder(order);
                                  setViewHistory(history);
                                }}
                              >
                                👁️ Переглянути повністю
                              </Button>
                            </div>
                          </div>
                          
                          {/* Timeline */}
                          <div className="rounded-xl bg-slate-50 p-4 max-h-[500px] overflow-y-auto">
                            <div className="text-xs font-semibold text-slate-500 mb-4">ПОВНА ІСТОРІЯ ({history.timeline?.length || 0} подій)</div>
                            {history.timeline && history.timeline.length > 0 ? (
                              <Timeline items={history.timeline} />
                            ) : (
                              <div className="text-center text-slate-500 py-4">Немає подій</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-500">Не вдалося завантажити історію</div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
      
      {/* View Order Modal */}
      {viewOrder && viewHistory && (
        <OrderViewModal 
          order={viewOrder} 
          history={viewHistory} 
          onClose={() => {
            setViewOrder(null);
            setViewHistory(null);
          }}
        />
      )}
    </div>
  );
}
