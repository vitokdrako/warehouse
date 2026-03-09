/* eslint-disable */
/**
 * ReturnColumn - Колонка "Повернення / Розрахунок" для менеджерської
 * 
 * Використовує ІСНУЮЧІ роути:
 * - GET /api/decor-orders?status=issued,returned,partial_return
 * - GET /api/orders/{order_id} (повні дані з items, return_cards, damages)
 * - GET /api/return-versions/order/{order_id}/versions
 * - GET /api/return-versions/version/{version_id}
 * - GET /api/finance/orders/{order_id}/snapshot
 * - POST /api/finance/payments
 * - POST /api/finance/deposits/{id}/refund
 * - POST /api/finance/deposits/{id}/use
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, Package, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, 
  ArrowLeftRight, DollarSign, Shield, RotateCcw, X, Banknote,
  Layers, Edit3, Eye, ImageOff, Calendar
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('token');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
};

const fmtUA = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }) : '—';
const money = (v) => `₴${fmtUA(v)}`;

// ============================================================
// MAIN COLUMN COMPONENT
// ============================================================
export default function ReturnColumn({ onRefreshAll }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const fetchReturnOrders = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/decor-orders?status=issued,returned,partial_return&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : (data.orders || []));
      }
    } catch (e) {
      console.error('ReturnColumn fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReturnOrders();
    const interval = setInterval(fetchReturnOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchReturnOrders]);

  const handleRefresh = () => {
    fetchReturnOrders();
    onRefreshAll?.();
  };

  const toggleExpand = (orderId) => {
    setExpandedOrderId(prev => prev === orderId ? null : orderId);
  };

  return (
    <section className="rounded-2xl border p-4 shadow-sm ring-2 bg-white ring-violet-100 border-violet-200">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800" data-testid="return-column-title">↩️ Повернення</h3>
          <p className="text-sm text-slate-500">{orders.length} замовлень</p>
        </div>
      </header>
      <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-xl border border-slate-200 p-4 h-32 bg-slate-50 animate-pulse" />
            ))}
          </div>
        ) : orders.length > 0 ? (
          orders.map(order => (
            <ReturnOrderCard
              key={order.order_id}
              order={order}
              isExpanded={expandedOrderId === order.order_id}
              onToggle={() => toggleExpand(order.order_id)}
              onActionComplete={handleRefresh}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <div className="text-slate-400 text-sm">Немає замовлень на повернення</div>
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================
// RETURN ORDER CARD — compact view same as ManagerOrderCard
// ============================================================
function ReturnOrderCard({ order, isExpanded, onToggle, onActionComplete }) {
  const statusConfig = {
    issued: { label: 'Видано', color: 'bg-blue-100 text-blue-700', icon: Package },
    returned: { label: 'Повернуто', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    partial_return: { label: 'Часткове', color: 'bg-amber-100 text-amber-700', icon: ArrowLeftRight },
  };

  const status = statusConfig[order.status] || { label: order.status, icon: AlertTriangle, color: 'bg-slate-100 text-slate-700' };
  const StatusIcon = status.icon;
  const fmtD = (d) => d ? new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }) : '—';

  return (
    <div 
      className={`rounded-xl border bg-white transition-all ${isExpanded ? 'shadow-lg border-violet-300 ring-1 ring-violet-200' : 'border-slate-200 hover:shadow-md'}`}
      data-testid={`return-card-${order.order_id}`}
    >
      {/* Compact card — same layout as ManagerOrderCard */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-slate-800">{order.order_number}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                <StatusIcon className="w-3 h-3" />
                {status.label}
              </span>
            </div>
            <div className="text-sm font-medium text-slate-700 truncate">{order.customer_name}</div>
            <a 
              href={`tel:${order.customer_phone}`}
              className="text-xs text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {order.customer_phone}
            </a>
          </div>
          <button
            onClick={onToggle}
            className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            title={isExpanded ? 'Згорнути' : 'Розкрити'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body — always visible compact info */}
      <div className="p-4">
        <div className="flex items-center gap-4 text-sm mb-3">
          <div>
            <span className="text-slate-500">Видача:</span>{' '}
            <span className="font-medium">{fmtD(order.rental_start_date)}</span>
          </div>
          <div>
            <span className="text-slate-500">Повернення:</span>{' '}
            <span className="font-medium">{fmtD(order.rental_end_date)}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm mb-2">
          <div>
            <span className="text-slate-500">Оренда:</span>{' '}
            <span className="font-semibold text-slate-800">{money(order.total_rental)}</span>
          </div>
          <div>
            <span className="text-slate-500">Застава:</span>{' '}
            <span className="font-medium text-slate-700">{money(order.total_deposit || order.deposit_amount)}</span>
          </div>
          {order.discount > 0 && (
            <span className="text-emerald-600 font-medium">-{order.discount}%</span>
          )}
        </div>

        <div className="text-xs text-slate-500">
          {order.items?.length || 0} позицій
          {order.manager_name && (
            <span className="ml-2">· Менеджер: <b>{order.manager_name}</b></span>
          )}
        </div>
      </div>

      {/* EXPANDED — full order detail */}
      {isExpanded && (
        <ExpandedReturnDetail 
          orderId={order.order_id} 
          onActionComplete={onActionComplete}
        />
      )}
    </div>
  );
}

// ============================================================
// EXPANDED DETAIL — Full order view with items, versions, damage, finance
// ============================================================
function ExpandedReturnDetail({ orderId, onActionComplete }) {
  const [loading, setLoading] = useState(true);
  const [orderDetail, setOrderDetail] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [versions, setVersions] = useState([]);
  const [expandedVersion, setExpandedVersion] = useState(null);
  const [saving, setSaving] = useState(false);

  // Payment form
  const [payType, setPayType] = useState('rent');
  const [payMethod, setPayMethod] = useState('cash');
  const [payAmount, setPayAmount] = useState('');
  const [showPayForm, setShowPayForm] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [orderRes, snapshotRes, versionsRes] = await Promise.allSettled([
          authFetch(`${BACKEND_URL}/api/orders/${orderId}`),
          authFetch(`${BACKEND_URL}/api/finance/orders/${orderId}/snapshot`),
          authFetch(`${BACKEND_URL}/api/return-versions/order/${orderId}/versions`),
        ]);

        if (mounted) {
          if (orderRes.status === 'fulfilled' && orderRes.value.ok) setOrderDetail(await orderRes.value.json());
          if (snapshotRes.status === 'fulfilled' && snapshotRes.value.ok) setSnapshot(await snapshotRes.value.json());
          if (versionsRes.status === 'fulfilled' && versionsRes.value.ok) {
            const v = await versionsRes.value.json();
            setVersions(v.versions || []);
          }
        }
      } catch (e) {
        console.error('ExpandedReturnDetail error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [orderId]);

  const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");

  const reloadSnapshot = async () => {
    const res = await authFetch(`${BACKEND_URL}/api/finance/orders/${orderId}/snapshot`);
    if (res.ok) setSnapshot(await res.json());
  };

  const handlePayment = async () => {
    if (!payAmount || Number(payAmount) <= 0) return;
    setSaving(true);
    const user = getUser();
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/payments`, {
        method: 'POST',
        body: JSON.stringify({
          payment_type: payType, method: payMethod,
          amount: Number(payAmount), order_id: orderId,
          accepted_by_id: user.id, accepted_by_name: user.email,
          note: `Оплата з менеджерської (${payType})`,
        }),
      });
      if (res.ok) {
        setPayAmount(''); setShowPayForm(false);
        await reloadSnapshot(); onActionComplete?.();
      } else {
        const err = await res.json();
        alert(`Помилка: ${err.detail || 'Невідома помилка'}`);
      }
    } catch (e) { alert(`Помилка: ${e.message}`); }
    finally { setSaving(false); }
  };

  const handleDepositRefund = async () => {
    const deposit = snapshot?.deposit;
    if (!deposit) return;
    const available = deposit.available ?? (deposit.held_amount - (deposit.used_amount || 0) - (deposit.refunded_amount || 0));
    if (available <= 0) return;
    if (!window.confirm(`Повернути заставу: ${money(available)}?`)) return;
    setSaving(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/deposits/${deposit.id}/refund?amount=${available}&method=cash`, { method: 'POST' });
      if (res.ok) { await reloadSnapshot(); onActionComplete?.(); }
    } catch (e) { alert(`Помилка: ${e.message}`); }
    finally { setSaving(false); }
  };

  const handleDepositUse = async () => {
    const deposit = snapshot?.deposit;
    const damageDue = snapshot?.damage?.due || 0;
    if (!deposit || damageDue <= 0) return;
    const available = deposit.available ?? (deposit.held_amount - (deposit.used_amount || 0) - (deposit.refunded_amount || 0));
    const useAmount = Math.min(available, damageDue);
    if (useAmount <= 0) return;
    if (!window.confirm(`Утримати ${money(useAmount)} із застави за шкоду?`)) return;
    setSaving(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/deposits/${deposit.id}/use?amount=${useAmount}`, {
        method: 'POST', body: JSON.stringify({ note: 'Утримання за шкоду' }),
      });
      if (res.ok) { await reloadSnapshot(); onActionComplete?.(); }
    } catch (e) { alert(`Помилка: ${e.message}`); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="border-t border-violet-100 px-4 py-8 text-center text-sm text-slate-400 animate-pulse">
        Завантаження деталей ордера...
      </div>
    );
  }

  const items = orderDetail?.items || [];
  const returnCards = orderDetail?.return_cards || [];
  const damageItems = snapshot?.damage?.items || [];
  const damage = snapshot?.damage;
  const totals = snapshot?.totals;
  const deposit = snapshot?.deposit;
  const payments = snapshot?.payments || [];
  const hasVersions = versions.length > 0;
  const depositAvailable = deposit ? (deposit.available ?? (deposit.held_amount - (deposit.used_amount || 0) - (deposit.refunded_amount || 0))) : 0;

  // Build a map of damaged items by sku/product_id for quick lookup
  const damageMap = {};
  damageItems.forEach(d => {
    const key = d.sku || d.product_id;
    if (!damageMap[key]) damageMap[key] = [];
    damageMap[key].push(d);
  });

  // Build a set of returned item SKUs from return cards
  const returnedSkus = new Set();
  returnCards.forEach(rc => {
    (rc.items_returned || []).forEach(ri => {
      returnedSkus.add(ri.sku || ri.product_id);
    });
  });

  return (
    <div className="border-t-2 border-violet-200" data-testid={`return-detail-${orderId}`}>

      {/* ============ 1. ORDER ITEMS WITH IMAGES ============ */}
      <div className="px-4 pt-4 pb-2">
        <div className="text-xs font-bold text-slate-600 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
          <Package className="w-3.5 h-3.5" />
          Товари замовлення ({items.length})
        </div>
        <div className="space-y-2">
          {items.map((item, i) => {
            const sku = item.sku || item.article;
            const hasDamage = damageMap[sku];
            const isReturned = returnedSkus.has(sku) || returnedSkus.has(String(item.inventory_id));

            return (
              <div
                key={i}
                className={`flex gap-3 p-2.5 rounded-lg border transition-colors ${
                  hasDamage 
                    ? 'border-rose-200 bg-rose-50/60' 
                    : isReturned 
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : 'border-slate-100 bg-slate-50/50'
                }`}
              >
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0 border border-slate-200">
                  {(item.image || item.photo) ? (
                    <img 
                      src={item.image || item.photo} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }}
                    />
                  ) : null}
                  <div className={`w-full h-full items-center justify-center text-slate-400 ${(item.image || item.photo) ? 'hidden' : 'flex'}`}>
                    <ImageOff className="w-5 h-5" />
                  </div>
                </div>

                {/* Item details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1 rounded">{sku}</span>
                    {isReturned && !hasDamage && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">повернуто</span>
                    )}
                    {hasDamage && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">шкода</span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-slate-800 truncate mt-0.5">{item.name}</div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span>×{item.qty || item.quantity}</span>
                    <span>{money(item.price_per_day)}/день</span>
                    <span className="font-semibold text-slate-700">{money(item.total_rental)}</span>
                  </div>
                  {/* Inline damage details */}
                  {hasDamage && damageMap[sku].map((d, di) => (
                    <div key={di} className="mt-1.5 text-xs text-rose-700 bg-rose-100/60 rounded px-2 py-1">
                      <span className="font-medium">{d.damage_type}</span>
                      {d.qty > 0 && <span> ×{d.qty}</span>}
                      <span className="float-right font-bold">{money(d.fee)}</span>
                      {d.note && <div className="text-rose-500 text-[11px] mt-0.5">{d.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============ 2. RETURN CARD (requisitors data) ============ */}
      {returnCards.length > 0 && returnCards[0] && (
        <div className="px-4 pt-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-xs font-bold text-slate-600 mb-2">Перевірка реквізиторами</div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <div className="font-bold text-lg text-emerald-600">{returnCards[0].items_ok || 0}</div>
                <div className="text-slate-500">OK</div>
              </div>
              <div>
                <div className="font-bold text-lg text-amber-600">{returnCards[0].items_dirty || 0}</div>
                <div className="text-slate-500">Брудні</div>
              </div>
              <div>
                <div className="font-bold text-lg text-rose-600">{returnCards[0].items_damaged || 0}</div>
                <div className="text-slate-500">Пошкоджені</div>
              </div>
              <div>
                <div className="font-bold text-lg text-red-700">{returnCards[0].items_missing || 0}</div>
                <div className="text-slate-500">Відсутні</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ 3. PARTIAL RETURN VERSIONS (timeline) ============ */}
      {hasVersions && (
        <div className="px-4 pt-4">
          <div className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
            <Layers className="w-3.5 h-3.5" />
            Етапи повернення ({versions.length})
          </div>
          <div className="space-y-2">
            {versions.map((v) => (
              <VersionCard
                key={v.version_id}
                version={v}
                isExpanded={expandedVersion === v.version_id}
                onToggle={() => setExpandedVersion(prev => prev === v.version_id ? null : v.version_id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ============ 4. DAMAGE SUMMARY ============ */}
      {damage && damage.items?.length > 0 && (
        <div className="px-4 pt-4">
          <div className="text-xs font-bold text-rose-600 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5" />
            Загальна шкода
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-rose-700">Всього:</span>
              <span className="font-bold text-rose-800">{money(damage.total)}</span>
            </div>
            {damage.paid > 0 && (
              <div className="flex justify-between text-xs mt-1">
                <span className="text-emerald-600">Оплачено:</span>
                <span className="text-emerald-700 font-medium">{money(damage.paid)}</span>
              </div>
            )}
            {damage.due > 0 && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-rose-600 font-medium">До сплати:</span>
                <span className="font-bold text-rose-700">{money(damage.due)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ 5. FINANCIAL SUMMARY ============ */}
      {totals && (
        <div className="px-4 pt-4">
          <div className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
            <DollarSign className="w-3.5 h-3.5" />
            Фінанси
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Оренда</span>
              <div>
                <span className="font-semibold">{money(totals.rental_after_discount)}</span>
                {totals.discount > 0 && <span className="text-xs text-emerald-600 ml-1">(-{money(totals.discount)})</span>}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Оплачено</span>
              <span className="font-semibold text-emerald-600">{money(totals.rent_paid + totals.advance_paid)}</span>
            </div>
            {totals.rent_due > 0 && (
              <div className="flex justify-between">
                <span className="text-amber-600 font-medium">Борг (оренда)</span>
                <span className="font-bold text-amber-600">{money(totals.rent_due)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-600">Застава (очік.)</span>
                <span className="font-semibold">{money(totals.deposit_expected)}</span>
              </div>
              {deposit && (
                <>
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-600">Прийнято</span>
                    <span className="font-semibold">
                      {deposit.currency !== 'UAH' 
                        ? `${deposit.currency === 'USD' ? '$' : '€'}${fmtUA(deposit.actual_amount)}` 
                        : money(deposit.held_amount)
                      }
                    </span>
                  </div>
                  {deposit.used_amount > 0 && (
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-rose-500">Утримано</span>
                      <span className="text-rose-600">-{money(deposit.used_amount)}</span>
                    </div>
                  )}
                  {deposit.refunded_amount > 0 && (
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-blue-500">Повернуто</span>
                      <span className="text-blue-600">{money(deposit.refunded_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between mt-1 font-medium">
                    <span className="text-slate-700">Доступно</span>
                    <span className="text-emerald-600">{money(depositAvailable)}</span>
                  </div>
                </>
              )}
            </div>
            {totals.grand_total_due > 0 ? (
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold">
                <span className="text-slate-800">Загальний борг</span>
                <span className="text-red-600">{money(totals.grand_total_due)}</span>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold">
                <span className="text-slate-800">Статус</span>
                <span className="text-emerald-600">Все оплачено</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ 6. PAYMENT HISTORY ============ */}
      {payments.length > 0 && (
        <div className="px-4 pt-3">
          <div className="text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Оплати</div>
          <div className="space-y-1">
            {payments.slice(0, 6).map((p) => {
              const typeLabels = { rent: 'Оренда', additional: 'Донарах.', damage: 'Шкода', deposit: 'Застава', late: 'Простр.', advance: 'Передпл.' };
              return (
                <div key={p.id} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2.5 py-1.5">
                  <div>
                    <span className="text-slate-700 font-medium">{typeLabels[p.payment_type] || p.payment_type}</span>
                    <span className="text-slate-400 ml-1.5">{p.method === 'cash' ? 'готівка' : 'безготівка'}</span>
                  </div>
                  <span className="font-bold text-emerald-700">+{money(p.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ 7. ACTIONS ============ */}
      <div className="px-4 py-4 space-y-2">
        {!showPayForm ? (
          <div className="flex gap-2">
            <button
              onClick={() => setShowPayForm(true)}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              data-testid={`pay-btn-${orderId}`}
            >
              <Banknote className="w-4 h-4" />
              Прийняти оплату
            </button>
            {deposit && depositAvailable > 0 && (
              <button
                onClick={handleDepositRefund}
                disabled={saving}
                className="py-2.5 px-3 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
                data-testid={`refund-deposit-btn-${orderId}`}
                title="Повернути заставу"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            {deposit && depositAvailable > 0 && damage?.due > 0 && (
              <button
                onClick={handleDepositUse}
                disabled={saving}
                className="py-2.5 px-3 text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
                data-testid={`use-deposit-btn-${orderId}`}
                title="Утримати із застави за шкоду"
              >
                <Shield className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-600">Прийняти оплату</span>
              <button onClick={() => setShowPayForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={payType} onChange={(e) => setPayType(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                data-testid={`pay-type-${orderId}`}
              >
                <option value="rent">Оренда</option>
                <option value="damage">Шкода</option>
                <option value="late">Прострочення</option>
                <option value="additional">Донарахування</option>
              </select>
              <select
                value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                data-testid={`pay-method-${orderId}`}
              >
                <option value="cash">Готівка</option>
                <option value="bank">Безготівка</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Сума ₴"
                className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-1.5"
                data-testid={`pay-amount-${orderId}`}
              />
              <button
                onClick={handlePayment}
                disabled={saving || !payAmount || Number(payAmount) <= 0}
                className="px-4 py-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                data-testid={`pay-submit-${orderId}`}
              >
                {saving ? '...' : 'OK'}
              </button>
            </div>
            {/* Quick amount buttons */}
            {(totals?.rent_due > 0 || damage?.due > 0) && (
              <div className="flex gap-1.5 flex-wrap">
                {totals?.rent_due > 0 && (
                  <button
                    onClick={() => { setPayType('rent'); setPayAmount(String(totals.rent_due)); }}
                    className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 font-medium"
                  >
                    Борг оренди: {money(totals.rent_due)}
                  </button>
                )}
                {damage?.due > 0 && (
                  <button
                    onClick={() => { setPayType('damage'); setPayAmount(String(damage.due)); }}
                    className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full hover:bg-rose-200 font-medium"
                  >
                    Шкода: {money(damage.due)}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// VERSION CARD — Partial return version with expandable items
// ============================================================
function VersionCard({ version, isExpanded, onToggle }) {
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const statusConfig = {
    active: { label: 'Активна', color: 'bg-blue-100 text-blue-700' },
    archived: { label: 'Повернуто', color: 'bg-slate-100 text-slate-600' },
    returned: { label: 'Завершено', color: 'bg-emerald-100 text-emerald-700' },
  };
  const st = statusConfig[version.status] || { label: version.status, color: 'bg-slate-100 text-slate-600' };

  useEffect(() => {
    if (isExpanded && items.length === 0) {
      setLoadingItems(true);
      authFetch(`${BACKEND_URL}/api/return-versions/version/${version.version_id}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data?.items) setItems(data.items); })
        .catch(console.error)
        .finally(() => setLoadingItems(false));
    }
  }, [isExpanded, version.version_id]);

  const itemStatusConfig = {
    returned: { label: 'повернуто', color: 'text-emerald-700 bg-emerald-100' },
    lost: { label: 'втрачено', color: 'text-red-700 bg-red-100' },
    pending: { label: 'в клієнта', color: 'text-amber-700 bg-amber-100' },
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center">
            {version.version_number}
          </div>
          <span className="text-xs font-bold text-slate-700">{version.display_number}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${st.color}`}>{st.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">{money(version.total_price)}</span>
          <span className="text-[10px] text-slate-400">{version.items_count} поз.</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </button>
      {isExpanded && (
        <div className="border-t border-slate-100 px-3 py-2">
          {loadingItems ? (
            <div className="text-xs text-slate-400 py-2 text-center animate-pulse">Завантаження...</div>
          ) : (
            <div className="space-y-1.5">
              {items.map((item, i) => {
                const itemSt = itemStatusConfig[item.status] || { label: item.status, color: 'text-slate-600 bg-slate-100' };
                return (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        item.status === 'returned' ? 'bg-emerald-500' : item.status === 'lost' ? 'bg-red-500' : 'bg-amber-400'
                      }`} />
                      <span className="text-slate-500 font-mono">{item.sku}</span>
                      <span className="text-slate-700 truncate">{item.name}</span>
                      <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${itemSt.color}`}>{itemSt.label}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-slate-500">×{item.qty}</span>
                      <span className="font-medium text-slate-600">{money((item.daily_rate || 0) * (item.qty || 1))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
