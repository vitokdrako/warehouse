/* eslint-disable */
/**
 * ReturnColumn - Колонка "Повернення / Розрахунок" для менеджерської
 * 
 * Використовує ІСНУЮЧІ роути:
 * - GET /api/decor-orders?status=issued,returned,partial_return
 * - GET /api/return-versions/order/{order_id}/versions
 * - GET /api/return-versions/version/{version_id}
 * - GET /api/finance/orders/{order_id}/snapshot
 * - GET /api/return-cards/by-order/{order_id}
 * - POST /api/finance/payments
 * - POST /api/finance/deposits/{id}/refund
 * - POST /api/finance/deposits/{id}/use
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, Package, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, 
  ArrowLeftRight, DollarSign, Shield, RotateCcw, X, Banknote, Building2,
  Eye, Layers
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
          <h3 className="text-lg font-semibold text-slate-800" data-testid="return-column-title">↩️ Повернення / Розрахунок</h3>
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
// RETURN ORDER CARD - Compact + Expandable
// ============================================================
function ReturnOrderCard({ order, isExpanded, onToggle, onActionComplete }) {
  const statusConfig = {
    issued: { label: 'Видано', color: 'bg-blue-100 text-blue-700', icon: Package },
    returned: { label: 'Повернуто', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    partial_return: { label: 'Часткове', color: 'bg-amber-100 text-amber-700', icon: ArrowLeftRight },
  };

  const status = statusConfig[order.status] || { label: order.status, icon: AlertTriangle, color: 'bg-slate-100 text-slate-700' };
  const StatusIcon = status.icon;

  const paidRent = order.paid_rent || 0;
  const totalRent = order.total_after_discount || order.total_rental || 0;
  const rentDue = Math.max(0, totalRent - paidRent);

  return (
    <div 
      className="rounded-xl border border-slate-200 bg-white hover:shadow-md transition-all"
      data-testid={`return-card-${order.order_id}`}
    >
      {/* Compact Header - always visible */}
      <div 
        className="p-4 cursor-pointer"
        onClick={onToggle}
      >
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
          <button className="p-1 text-slate-400 hover:text-slate-600">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Compact finance row */}
        <div className="flex items-center gap-4 text-sm mt-3">
          <div>
            <span className="text-slate-500">Оренда:</span>{' '}
            <span className="font-semibold text-slate-800">{money(totalRent)}</span>
          </div>
          {rentDue > 0 && (
            <div>
              <span className="text-amber-600 font-semibold">Борг: {money(rentDue)}</span>
            </div>
          )}
          {rentDue <= 0 && paidRent > 0 && (
            <span className="text-emerald-600 text-xs font-medium">✓ Оплачено</span>
          )}
        </div>

        {/* Dates */}
        <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
          <span>Видача: {fmtDate(order.rental_start_date)}</span>
          <span>Повернення: {fmtDate(order.rental_end_date)}</span>
        </div>
      </div>

      {/* Expanded Detail Panel */}
      {isExpanded && (
        <ReturnDetailPanel 
          order={order} 
          onActionComplete={onActionComplete}
        />
      )}
    </div>
  );
}

// ============================================================
// RETURN DETAIL PANEL - Versions, Damage, Finance, Actions
// ============================================================
function ReturnDetailPanel({ order, onActionComplete }) {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [versions, setVersions] = useState([]);
  const [returnCard, setReturnCard] = useState(null);
  const [expandedVersion, setExpandedVersion] = useState(null);
  const [saving, setSaving] = useState(false);

  // Payment form
  const [payType, setPayType] = useState('rent');
  const [payMethod, setPayMethod] = useState('cash');
  const [payAmount, setPayAmount] = useState('');
  const [showPayForm, setShowPayForm] = useState(false);

  const orderId = order.order_id;

  // Load all data in parallel using existing routes
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [snapshotRes, versionsRes, returnCardRes] = await Promise.allSettled([
          authFetch(`${BACKEND_URL}/api/finance/orders/${orderId}/snapshot`),
          authFetch(`${BACKEND_URL}/api/return-versions/order/${orderId}/versions`),
          authFetch(`${BACKEND_URL}/api/return-cards/by-order/${orderId}`),
        ]);

        if (mounted) {
          if (snapshotRes.status === 'fulfilled' && snapshotRes.value.ok) {
            setSnapshot(await snapshotRes.value.json());
          }
          if (versionsRes.status === 'fulfilled' && versionsRes.value.ok) {
            const vData = await versionsRes.value.json();
            setVersions(vData.versions || []);
          }
          if (returnCardRes.status === 'fulfilled' && returnCardRes.value.ok) {
            setReturnCard(await returnCardRes.value.json());
          }
        }
      } catch (e) {
        console.error('ReturnDetailPanel load error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [orderId]);

  const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");

  // Accept payment (existing route)
  const handlePayment = async () => {
    if (!payAmount || Number(payAmount) <= 0) return;
    setSaving(true);
    const user = getUser();
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/payments`, {
        method: 'POST',
        body: JSON.stringify({
          payment_type: payType,
          method: payMethod,
          amount: Number(payAmount),
          order_id: orderId,
          accepted_by_id: user.id,
          accepted_by_name: user.email,
          note: `Оплата з менеджерської (${payType})`,
        }),
      });
      if (res.ok) {
        setPayAmount('');
        setShowPayForm(false);
        // Reload snapshot
        const newSnapshot = await authFetch(`${BACKEND_URL}/api/finance/orders/${orderId}/snapshot`);
        if (newSnapshot.ok) setSnapshot(await newSnapshot.json());
        onActionComplete?.();
      } else {
        const err = await res.json();
        alert(`Помилка: ${err.detail || 'Невідома помилка'}`);
      }
    } catch (e) {
      alert(`Помилка: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Refund deposit (existing route)
  const handleDepositRefund = async () => {
    const deposit = snapshot?.deposit;
    if (!deposit) return;
    const available = deposit.available || (deposit.held_amount - (deposit.used_amount || 0) - (deposit.refunded_amount || 0));
    if (available <= 0) return;
    
    const curr = deposit.currency === 'USD' ? '$' : deposit.currency === 'EUR' ? '€' : '₴';
    if (!window.confirm(`Повернути заставу: ${curr}${fmtUA(available)}?`)) return;
    
    setSaving(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/deposits/${deposit.id}/refund?amount=${available}&method=cash`, {
        method: 'POST',
      });
      if (res.ok) {
        const newSnapshot = await authFetch(`${BACKEND_URL}/api/finance/orders/${orderId}/snapshot`);
        if (newSnapshot.ok) setSnapshot(await newSnapshot.json());
        onActionComplete?.();
      }
    } catch (e) {
      alert(`Помилка: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Use deposit for damage (existing route)
  const handleDepositUse = async () => {
    const deposit = snapshot?.deposit;
    const damageDue = snapshot?.damage?.due || 0;
    if (!deposit || damageDue <= 0) return;
    
    const available = deposit.available || (deposit.held_amount - (deposit.used_amount || 0) - (deposit.refunded_amount || 0));
    const useAmount = Math.min(available, damageDue);
    if (useAmount <= 0) return;
    
    if (!window.confirm(`Утримати ₴${fmtUA(useAmount)} із застави за шкоду?`)) return;
    
    setSaving(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/finance/deposits/${deposit.id}/use?amount=${useAmount}`, {
        method: 'POST',
        body: JSON.stringify({ note: 'Утримання за шкоду' }),
      });
      if (res.ok) {
        const newSnapshot = await authFetch(`${BACKEND_URL}/api/finance/orders/${orderId}/snapshot`);
        if (newSnapshot.ok) setSnapshot(await newSnapshot.json());
        onActionComplete?.();
      }
    } catch (e) {
      alert(`Помилка: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 pb-4 border-t border-slate-100">
        <div className="py-6 text-center text-sm text-slate-400 animate-pulse">Завантаження...</div>
      </div>
    );
  }

  const totals = snapshot?.totals;
  const deposit = snapshot?.deposit;
  const damage = snapshot?.damage;
  const payments = snapshot?.payments || [];
  const hasVersions = versions.length > 0;
  const depositAvailable = deposit ? (deposit.available || (deposit.held_amount - (deposit.used_amount || 0) - (deposit.refunded_amount || 0))) : 0;

  return (
    <div className="border-t border-slate-100" data-testid={`return-detail-${orderId}`}>
      {/* === PARTIAL RETURN VERSIONS === */}
      {hasVersions && (
        <div className="px-4 pt-4">
          <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            ЧАСТКОВЕ ПОВЕРНЕННЯ ({versions.length} версій)
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

      {/* === DAMAGE FROM REQUISITORS === */}
      {damage && damage.items?.length > 0 && (
        <div className="px-4 pt-4">
          <div className="text-xs font-semibold text-rose-600 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            ШКОДА ({damage.items.length} позицій)
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-1.5">
            {damage.items.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex-1 min-w-0">
                  <span className="text-rose-800 font-medium text-xs">{d.name}</span>
                  {d.qty > 1 && <span className="text-rose-600 text-xs ml-1">×{d.qty}</span>}
                  <div className="text-[10px] text-rose-500 truncate">{d.damage_type}</div>
                </div>
                <span className="font-semibold text-rose-700 text-xs ml-2 flex-shrink-0">{money(d.fee)}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-rose-200 flex justify-between text-sm">
              <span className="font-medium text-rose-700">Всього шкода:</span>
              <span className="font-bold text-rose-800">{money(damage.total)}</span>
            </div>
            {damage.paid > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-emerald-600">Оплачено:</span>
                <span className="text-emerald-700 font-medium">{money(damage.paid)}</span>
              </div>
            )}
            {damage.due > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-rose-600 font-medium">До сплати:</span>
                <span className="text-rose-700 font-bold">{money(damage.due)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === RETURN CARD STATUS (from requisitors) === */}
      {returnCard && (
        <div className="px-4 pt-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-slate-600 mb-1.5">Картка повернення (реквізитори)</div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <div className="font-bold text-emerald-600">{returnCard.items_ok || 0}</div>
                <div className="text-slate-500">OK</div>
              </div>
              <div>
                <div className="font-bold text-amber-600">{returnCard.items_dirty || 0}</div>
                <div className="text-slate-500">Брудні</div>
              </div>
              <div>
                <div className="font-bold text-rose-600">{returnCard.items_damaged || 0}</div>
                <div className="text-slate-500">Шкода</div>
              </div>
              <div>
                <div className="font-bold text-red-700">{returnCard.items_missing || 0}</div>
                <div className="text-slate-500">Відсутні</div>
              </div>
            </div>
            {returnCard.return_notes && (
              <div className="mt-2 text-xs text-slate-600 bg-white rounded p-1.5">{returnCard.return_notes}</div>
            )}
          </div>
        </div>
      )}

      {/* === FINANCIAL SUMMARY === */}
      {totals && (
        <div className="px-4 pt-4">
          <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            ФІНАНСИ
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            {/* Rent */}
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Оренда</span>
              <div className="text-right">
                <span className="font-semibold">{money(totals.rental_after_discount)}</span>
                {totals.discount > 0 && (
                  <span className="text-xs text-emerald-600 ml-1">(-{money(totals.discount)})</span>
                )}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Оплачено (оренда)</span>
              <span className="font-semibold text-emerald-600">{money(totals.rent_paid + totals.advance_paid)}</span>
            </div>
            {totals.rent_due > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-amber-600 font-medium">Борг (оренда)</span>
                <span className="font-bold text-amber-600">{money(totals.rent_due)}</span>
              </div>
            )}
            
            {/* Deposit */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Застава (очік.)</span>
                <span className="font-semibold">{money(totals.deposit_expected)}</span>
              </div>
              {deposit && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Застава (прийнято)</span>
                    <span className="font-semibold">
                      {deposit.currency !== 'UAH' 
                        ? `${deposit.currency === 'USD' ? '$' : '€'}${fmtUA(deposit.actual_amount)}` 
                        : money(deposit.held_amount)
                      }
                    </span>
                  </div>
                  {deposit.used_amount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-rose-500">Утримано</span>
                      <span className="text-rose-600">-{money(deposit.used_amount)}</span>
                    </div>
                  )}
                  {deposit.refunded_amount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-500">Повернуто</span>
                      <span className="text-blue-600">{money(deposit.refunded_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-slate-700">Доступно</span>
                    <span className="text-emerald-600">{money(depositAvailable)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Grand total */}
            {totals.grand_total_due > 0 && (
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm">
                <span className="font-bold text-slate-800">Загальний борг</span>
                <span className="font-bold text-red-600">{money(totals.grand_total_due)}</span>
              </div>
            )}
            {totals.grand_total_due <= 0 && (
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm">
                <span className="font-bold text-slate-800">Статус</span>
                <span className="font-bold text-emerald-600">✓ Все оплачено</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === PAYMENT HISTORY (last 5) === */}
      {payments.length > 0 && (
        <div className="px-4 pt-3">
          <div className="text-xs font-semibold text-slate-500 mb-1.5">Останні оплати</div>
          <div className="space-y-1">
            {payments.slice(0, 5).map((p) => {
              const typeLabels = { rent: 'Оренда', additional: 'Донарах.', damage: 'Шкода', deposit: 'Застава', late: 'Простр.', advance: 'Передпл.' };
              return (
                <div key={p.id} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1">
                  <div>
                    <span className="text-slate-600">{typeLabels[p.payment_type] || p.payment_type}</span>
                    <span className="text-slate-400 ml-1">· {p.method === 'cash' ? 'готівка' : 'безготівка'}</span>
                  </div>
                  <span className="font-semibold text-emerald-700">+{money(p.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === ACTION BUTTONS === */}
      <div className="px-4 py-4 space-y-2">
        {/* Quick Payment */}
        {!showPayForm ? (
          <div className="flex gap-2">
            <button
              onClick={() => setShowPayForm(true)}
              className="flex-1 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              data-testid={`pay-btn-${orderId}`}
            >
              <Banknote className="w-4 h-4" />
              Прийняти оплату
            </button>
            {deposit && depositAvailable > 0 && (
              <button
                onClick={handleDepositRefund}
                disabled={saving}
                className="py-2 px-3 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
                data-testid={`refund-deposit-btn-${orderId}`}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            {deposit && depositAvailable > 0 && damage?.due > 0 && (
              <button
                onClick={handleDepositUse}
                disabled={saving}
                className="py-2 px-3 text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
                title="Утримати із застави за шкоду"
                data-testid={`use-deposit-btn-${orderId}`}
              >
                <Shield className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-600">Прийняти оплату</span>
              <button onClick={() => setShowPayForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={payType}
                onChange={(e) => setPayType(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                data-testid={`pay-type-${orderId}`}
              >
                <option value="rent">Оренда</option>
                <option value="damage">Шкода</option>
                <option value="late">Прострочення</option>
                <option value="additional">Донарахування</option>
              </select>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                data-testid={`pay-method-${orderId}`}
              >
                <option value="cash">Готівка</option>
                <option value="bank">Безготівка</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Сума ₴"
                className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-1.5"
                data-testid={`pay-amount-${orderId}`}
              />
              <button
                onClick={handlePayment}
                disabled={saving || !payAmount || Number(payAmount) <= 0}
                className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                data-testid={`pay-submit-${orderId}`}
              >
                {saving ? '...' : 'OK'}
              </button>
            </div>
            {/* Quick amount buttons */}
            {totals && (
              <div className="flex gap-1 flex-wrap">
                {totals.rent_due > 0 && (
                  <button
                    onClick={() => { setPayType('rent'); setPayAmount(String(totals.rent_due)); }}
                    className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200"
                  >
                    Борг оренди: {money(totals.rent_due)}
                  </button>
                )}
                {damage?.due > 0 && (
                  <button
                    onClick={() => { setPayType('damage'); setPayAmount(String(damage.due)); }}
                    className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full hover:bg-rose-200"
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
// VERSION CARD - Partial return version with items
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

  // Load items when expanded
  useEffect(() => {
    if (isExpanded && items.length === 0) {
      setLoadingItems(true);
      authFetch(`${BACKEND_URL}/api/return-versions/version/${version.version_id}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.items) setItems(data.items);
        })
        .catch(console.error)
        .finally(() => setLoadingItems(false));
    }
  }, [isExpanded, version.version_id]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">{version.display_number}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${st.color}`}>{st.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">{money(version.total_price)}</span>
          <span className="text-xs text-slate-400">{version.items_count} поз.</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 px-3 py-2">
          {loadingItems ? (
            <div className="text-xs text-slate-400 py-2 text-center animate-pulse">Завантаження...</div>
          ) : (
            <div className="space-y-1">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      item.status === 'returned' ? 'bg-emerald-500' : 
                      item.status === 'lost' ? 'bg-red-500' : 'bg-amber-500'
                    }`} />
                    <span className="text-slate-500 font-mono">{item.sku}</span>
                    <span className="text-slate-700 truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-slate-500">×{item.qty}</span>
                    <span className="font-medium text-slate-600">{money(item.daily_rate * item.qty)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
