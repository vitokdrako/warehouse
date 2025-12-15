/* eslint-disable */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CorporateHeader from '../components/CorporateHeader';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

/************* Helpers *************/
const cls = (...a) => a.filter(Boolean).join(' ');

const fmtDay = (d) =>
  d.toLocaleDateString('uk-UA', { weekday: 'short', day: '2-digit', month: 'short' });

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
};

const isoDate = (d) => d.toISOString().slice(0, 10);

const startOfWeek = (d) => {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

/************* Lane Configuration *************/
const LANE = {
  ISSUE: 'issue',
  RETURN: 'return',
  ON_RENT: 'on_rent',
  PACKING: 'packing',
  CLEANING: 'cleaning',
  RESTORE: 'restore',
  DAMAGE: 'damage',
};

const laneMeta = {
  [LANE.ISSUE]: { 
    title: '📦 Видача', 
    hint: 'Готові до видачі клієнту', 
    chip: 'Issue',
    color: 'emerald',
    bgClass: 'bg-emerald-50 border-emerald-200',
    textClass: 'text-emerald-700'
  },
  [LANE.RETURN]: { 
    title: '🔄 Повернення', 
    hint: 'Очікуємо повернення', 
    chip: 'Return',
    color: 'indigo',
    bgClass: 'bg-indigo-50 border-indigo-200',
    textClass: 'text-indigo-700'
  },
  [LANE.ON_RENT]: { 
    title: '🧾 В оренді', 
    hint: 'Діапазони між датами', 
    chip: 'Range',
    color: 'slate',
    bgClass: 'bg-slate-50 border-slate-200',
    textClass: 'text-slate-700'
  },
  [LANE.PACKING]: { 
    title: '📦 Комплектація', 
    hint: 'На збірці та пакуванні', 
    chip: 'Task',
    color: 'amber',
    bgClass: 'bg-amber-50 border-amber-200',
    textClass: 'text-amber-700'
  },
  [LANE.CLEANING]: { 
    title: '🧼 Мийка / Хімчистка', 
    hint: 'Партії та задачі', 
    chip: 'Task',
    color: 'sky',
    bgClass: 'bg-sky-50 border-sky-200',
    textClass: 'text-sky-700'
  },
  [LANE.RESTORE]: { 
    title: '🔧 Реставрація', 
    hint: 'Відновлення/ремонт', 
    chip: 'Task',
    color: 'orange',
    bgClass: 'bg-orange-50 border-orange-200',
    textClass: 'text-orange-700'
  },
  [LANE.DAMAGE]: { 
    title: '⚠️ Шкоди', 
    hint: 'Кейси пошкоджень', 
    chip: 'Case',
    color: 'rose',
    bgClass: 'bg-rose-50 border-rose-200',
    textClass: 'text-rose-700'
  },
};

/************* Badge Component *************/
function Badge({ children, tone = 'neutral' }) {
  const toneClasses = {
    ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warn: 'bg-amber-50 text-amber-900 border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    neutral: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <span className={cls(
      'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
      toneClasses[tone] || toneClasses.neutral
    )}>
      {children}
    </span>
  );
}

/************* TopBar Component *************/
function TopBar({ mode, setMode, query, setQuery, show, setShow }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-lg font-semibold">Універсальний операційний стіл</div>
          <Badge tone="info">Week timeline</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border bg-white p-1">
            {[
              { id: 'overview', label: 'Огляд' },
              { id: 'ops', label: 'Видача/Поверн.' },
              { id: 'tasks', label: 'Задачі' },
            ].map((m) => (
              <button
                key={m.id}
                className={cls(
                  'rounded-lg px-3 py-1.5 text-sm transition',
                  mode === m.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                )}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
            <span className="text-sm text-slate-500">🔍</span>
            <input
              className="w-40 lg:w-56 bg-transparent text-sm outline-none"
              placeholder="#7044, клієнт, SKU…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              className={cls(
                'rounded-xl border px-3 py-2 text-sm transition',
                show.onlyProblems ? 'bg-rose-50 border-rose-200' : 'bg-white hover:bg-slate-50'
              )}
              onClick={() => setShow((s) => ({ ...s, onlyProblems: !s.onlyProblems }))}
            >
              ⚠️ Проблеми
            </button>
            <button
              className={cls(
                'rounded-xl border px-3 py-2 text-sm transition',
                show.compact ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'
              )}
              onClick={() => setShow((s) => ({ ...s, compact: !s.compact }))}
            >
              {show.compact ? '📐 Щільно' : '📋 Детально'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/************* ItemCard Component *************/
function ItemCard({ item, onOpen, onMoveStart, isCompact, navigate }) {
  const laneInfo = laneMeta[item.lane] || laneMeta[LANE.ISSUE];
  
  const tone = item.tags?.includes('danger') ? 'danger'
    : item.tags?.includes('warn') || item.tags?.includes('unpaid') || item.tags?.includes('urgent') ? 'warn'
    : item.tags?.includes('info') ? 'info'
    : item.tags?.includes('ok') || item.tags?.includes('paid') ? 'ok'
    : 'neutral';

  const handleNavigate = (e) => {
    e.stopPropagation();
    // Навігація до відповідного кабінету
    if (item.linkTo === 'issue_card' && item.issueCardId) {
      navigate(`/issue/${item.issueCardId}`);
    } else if (item.linkTo === 'return_card' && item.orderId) {
      navigate(`/return/${item.orderId}`);
    } else if (item.linkTo === 'order' && item.orderId) {
      navigate(`/order/${item.orderId}/view`);
    } else if (item.linkTo === 'damage') {
      navigate('/damages');
    } else if (item.linkTo === 'cleaning') {
      navigate('/tasks');
    } else {
      onOpen(item);
    }
  };

  return (
    <div
      className={cls(
        'group relative w-full overflow-hidden rounded-xl border bg-white shadow-sm cursor-pointer',
        isCompact ? 'p-2' : 'p-3',
        'hover:shadow-md transition-shadow',
        laneInfo.bgClass
      )}
      onClick={handleNavigate}
    >
      {/* Color rail */}
      <div className={cls('absolute left-0 top-0 h-full w-1', `bg-${laneInfo.color}-500`)} />
      
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold bg-white/80">
              {laneInfo.chip}
            </span>
            <Badge tone={tone}>{item.status || tone}</Badge>
            {item.time && <span className="text-xs text-slate-500">{item.time}</span>}
          </div>
          <div className={cls('mt-1 font-semibold truncate', isCompact ? 'text-sm' : 'text-base', laneInfo.textClass)}>
            {item.title}
          </div>
          {!isCompact && item.meta && (
            <div className="mt-0.5 text-sm text-slate-600 truncate">{item.meta}</div>
          )}
          {item.orderCode && (
            <div className="mt-1 text-xs font-mono text-slate-500">{item.orderCode}</div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
            <button
              className="rounded-lg border bg-white px-2 py-1 text-xs hover:bg-slate-50"
              onClick={(e) => { e.stopPropagation(); onOpen(item); }}
            >
              👁️
            </button>
            <button
              className="rounded-lg border bg-white px-2 py-1 text-xs hover:bg-slate-50"
              onClick={(e) => { e.stopPropagation(); onMoveStart(item); }}
              title="Перемістити"
            >
              ✋
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/************* Drawer Component *************/
function Drawer({ open, item, onClose, navigate }) {
  if (!open || !item) return null;

  const laneInfo = laneMeta[item.lane] || laneMeta[LANE.ISSUE];

  const handleOpenSource = () => {
    if (item.linkTo === 'issue_card' && item.issueCardId) {
      navigate(`/issue/${item.issueCardId}`);
    } else if (item.linkTo === 'return_card' && item.orderId) {
      navigate(`/return/${item.orderId}`);
    } else if (item.linkTo === 'order' && item.orderId) {
      navigate(`/order/${item.orderId}/view`);
    } else if (item.linkTo === 'damage') {
      navigate('/damages');
    } else if (item.linkTo === 'cleaning') {
      navigate('/tasks');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between border-b p-4 sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">Деталі події</div>
            <div className="truncate text-lg font-semibold">{item.title}</div>
          </div>
          <button className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50" onClick={onClose}>
            ✕ Закрити
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Info card */}
          <div className={cls('rounded-2xl border p-4', laneInfo.bgClass)}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">Тип</div>
              <span className={cls('rounded-full border px-3 py-1 text-sm font-semibold', laneInfo.bgClass, laneInfo.textClass)}>
                {laneInfo.title}
              </span>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {item.meta && <div className="text-slate-600">{item.meta}</div>}
              <div>
                <span className="text-slate-500">Дата:</span>{' '}
                <span className="font-medium">{item.date || item.from}</span>
                {item.to && <span className="text-slate-500"> → </span>}
                {item.to && <span className="font-medium">{item.to}</span>}
              </div>
              {item.orderCode && (
                <div>
                  <span className="text-slate-500">Замовлення:</span>{' '}
                  <span className="font-mono font-medium">{item.orderCode}</span>
                </div>
              )}
              {item.client && (
                <div>
                  <span className="text-slate-500">Клієнт:</span>{' '}
                  <span className="font-medium">{item.client}</span>
                </div>
              )}
              {item.phone && (
                <div>
                  <span className="text-slate-500">Телефон:</span>{' '}
                  <a href={`tel:${item.phone}`} className="font-medium text-blue-600">{item.phone}</a>
                </div>
              )}
              {item.amount && (
                <div>
                  <span className="text-slate-500">Сума:</span>{' '}
                  <span className="font-semibold text-emerald-600">₴ {item.amount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-2xl border p-4">
            <div className="font-semibold mb-3">Швидкі дії</div>
            <div className="grid grid-cols-2 gap-2">
              <button 
                className="rounded-xl border px-3 py-3 text-sm hover:bg-slate-50 transition text-left"
                onClick={handleOpenSource}
              >
                🔗 Відкрити кабінет
              </button>
              {item.phone && (
                <a 
                  href={`tel:${item.phone}`}
                  className="rounded-xl border px-3 py-3 text-sm hover:bg-slate-50 transition text-left"
                >
                  📞 Зателефонувати
                </a>
              )}
              <button 
                className="rounded-xl border px-3 py-3 text-sm hover:bg-slate-50 transition text-left"
                onClick={() => navigate('/finance')}
              >
                💰 Фінанси
              </button>
              <button 
                className="rounded-xl border px-3 py-3 text-sm hover:bg-slate-50 transition text-left"
                onClick={() => alert('Нотатка додана (демо)')}
              >
                📝 + Нотатка
              </button>
            </div>
          </div>

          {/* Order items if available */}
          {item.orderData?.items && item.orderData.items.length > 0 && (
            <div className="rounded-2xl border p-4">
              <div className="font-semibold mb-3">Товари ({item.orderData.items.length})</div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {item.orderData.items.slice(0, 10).map((product, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                    {product.image && (
                      <img src={product.image} alt="" className="w-10 h-10 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{product.name || product.product_name}</div>
                      <div className="text-xs text-slate-500">
                        {product.quantity || product.qty} шт × ₴{product.price_per_day || product.rental_price || 0}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/************* Main Calendar Component *************/
export default function UniversalOpsCalendar() {
  const navigate = useNavigate();
  
  const [start, setStart] = useState(() => startOfWeek(new Date()));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState('overview');
  const [query, setQuery] = useState('');
  const [show, setShow] = useState({ onlyProblems: false, compact: false });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null);

  const [move, setMove] = useState(null);
  
  // Create task dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);

  // Lanes based on mode
  const lanes = useMemo(() => {
    if (mode === 'ops') return [LANE.ISSUE, LANE.RETURN, LANE.ON_RENT, LANE.PACKING];
    if (mode === 'tasks') return [LANE.PACKING, LANE.CLEANING, LANE.RESTORE, LANE.DAMAGE];
    return [LANE.ISSUE, LANE.RETURN, LANE.PACKING, LANE.CLEANING, LANE.RESTORE, LANE.DAMAGE];
  }, [mode]);

  // Load calendar data
  useEffect(() => {
    loadCalendarData();
  }, [start]);

  const loadCalendarData = async () => {
    try {
      setLoading(true);
      const calendarItems = [];
      const startDate = isoDate(addDays(start, -7));
      const endDate = isoDate(addDays(start, 21));

      // 1. Load awaiting orders
      try {
        const ordersRes = await axios.get(`${BACKEND_URL}/api/orders?status=awaiting_customer`);
        const orders = ordersRes.data.orders || [];
        
        orders.forEach((o) => {
          const issueDate = o.rental_start_date || o.issue_date;
          const returnDate = o.rental_end_date || o.return_date;
          const clientName = o.client_name || o.customer_name;

          if (issueDate) {
            calendarItems.push({
              id: `awaiting-${o.id}-issue`,
              lane: LANE.ISSUE,
              type: 'issue',
              date: issueDate,
              title: clientName,
              meta: `Очікує підтвердження • ${o.items?.length || 0} поз.`,
              orderCode: o.order_number,
              client: clientName,
              phone: o.client_phone,
              amount: o.total_rental,
              tags: ['warn'],
              status: 'Очікує',
              linkTo: 'order',
              orderId: o.id,
              orderData: o,
            });
          }

          // Range for ON_RENT
          if (issueDate && returnDate) {
            calendarItems.push({
              id: `awaiting-${o.id}-range`,
              lane: LANE.ON_RENT,
              type: 'range',
              from: issueDate,
              to: returnDate,
              date: issueDate,
              title: clientName,
              meta: `В оренді`,
              orderCode: o.order_number,
              client: clientName,
              tags: ['info'],
              status: 'Заплановано',
              linkTo: 'order',
              orderId: o.id,
              orderData: o,
            });
          }
        });
      } catch (err) {
        console.error('[Calendar] Failed to load awaiting orders:', err);
      }

      // 2. Load issue cards
      try {
        const issueCardsRes = await axios.get(`${BACKEND_URL}/api/issue-cards`);
        const issueCards = issueCardsRes.data || [];
        
        issueCards.forEach((card) => {
          const issueDate = card.rental_start_date;
          const returnDate = card.rental_end_date;

          // Packing lane - preparation
          if (card.status === 'preparation' && issueDate) {
            calendarItems.push({
              id: `ic-${card.id}-packing`,
              lane: LANE.PACKING,
              type: 'task',
              date: issueDate,
              title: card.customer_name,
              meta: `Комплектація • ${card.items?.length || 0} поз.`,
              orderCode: card.order_number,
              client: card.customer_name,
              phone: card.customer_phone,
              amount: card.total_rental,
              tags: ['warn'],
              status: 'Комплектація',
              linkTo: 'issue_card',
              issueCardId: card.id,
              orderId: card.order_id,
              orderData: card,
            });
          }

          // Issue lane - ready
          if ((card.status === 'ready' || card.status === 'ready_for_issue') && issueDate) {
            calendarItems.push({
              id: `ic-${card.id}-issue`,
              lane: LANE.ISSUE,
              type: 'issue',
              date: issueDate,
              title: card.customer_name,
              meta: `Готово до видачі • ${card.items?.length || 0} поз.`,
              orderCode: card.order_number,
              client: card.customer_name,
              phone: card.customer_phone,
              amount: card.total_rental,
              tags: ['ok'],
              status: 'Готово',
              linkTo: 'issue_card',
              issueCardId: card.id,
              orderId: card.order_id,
              orderData: card,
            });
          }

          // Return lane - issued
          if (card.status === 'issued' && returnDate) {
            calendarItems.push({
              id: `ic-${card.id}-return`,
              lane: LANE.RETURN,
              type: 'return',
              date: returnDate,
              title: card.customer_name,
              meta: `Очікуємо повернення`,
              orderCode: card.order_number,
              client: card.customer_name,
              phone: card.customer_phone,
              amount: card.deposit_amount,
              tags: ['info'],
              status: 'На поверненні',
              linkTo: 'return_card',
              issueCardId: card.id,
              orderId: card.order_id,
              orderData: card,
            });
          }
        });
      } catch (err) {
        console.error('[Calendar] Failed to load issue cards:', err);
      }

      // 3. Load cleaning/restoration tasks
      try {
        const cleaningRes = await axios.get(`${BACKEND_URL}/api/product-cleaning/all`);
        const cleaningTasks = cleaningRes.data || [];
        
        cleaningTasks.forEach((task) => {
          const taskDate = task.updated_at?.slice(0, 10) || isoDate(new Date());
          
          if (task.status === 'wash' || task.status === 'dry') {
            calendarItems.push({
              id: `clean-${task.sku}-${task.id || taskDate}`,
              lane: LANE.CLEANING,
              type: 'task',
              date: taskDate,
              title: task.product_name || task.sku,
              meta: task.status === 'wash' ? 'На мийці' : 'Сушка',
              tags: ['info'],
              status: task.status === 'wash' ? 'Мийка' : 'Сушка',
              linkTo: 'cleaning',
              orderData: task,
            });
          }
          
          if (task.status === 'repair') {
            calendarItems.push({
              id: `restore-${task.sku}-${task.id || taskDate}`,
              lane: LANE.RESTORE,
              type: 'task',
              date: taskDate,
              title: task.product_name || task.sku,
              meta: 'На реставрації',
              tags: ['warn'],
              status: 'Реставрація',
              linkTo: 'cleaning',
              orderData: task,
            });
          }
        });
      } catch (err) {
        console.error('[Calendar] Failed to load cleaning tasks:', err);
      }

      // 4. Load damage cases
      try {
        const damageRes = await axios.get(`${BACKEND_URL}/api/product-damage-history/recent?limit=100`);
        const damages = damageRes.data || [];
        
        damages.forEach((d) => {
          const damageDate = d.created_at?.slice(0, 10) || isoDate(new Date());
          
          calendarItems.push({
            id: `damage-${d.id}`,
            lane: LANE.DAMAGE,
            type: 'case',
            date: damageDate,
            title: d.product_name || 'Товар',
            meta: `${d.damage_type || 'Пошкодження'} • ₴${d.damage_cost || 0}`,
            orderCode: d.order_number,
            tags: d.severity === 'high' ? ['danger'] : d.severity === 'medium' ? ['warn'] : ['info'],
            status: d.severity === 'high' ? 'Критично' : d.severity === 'medium' ? 'Середньо' : 'Низько',
            linkTo: 'damage',
            orderData: d,
          });
        });
      } catch (err) {
        console.error('[Calendar] Failed to load damages:', err);
      }

      setItems(calendarItems);
      console.log(`[Calendar] Loaded ${calendarItems.length} items`);
    } catch (err) {
      console.error('[Calendar] Failed to load calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered items
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const text = `${it.title} ${it.meta || ''} ${it.orderCode || ''} ${it.client || ''}`.toLowerCase();
      const matches = !q || text.includes(q);
      const problems = show.onlyProblems
        ? it.tags?.some(t => ['danger', 'warn', 'unpaid', 'urgent'].includes(t))
        : true;
      const laneVisible = lanes.includes(it.lane);
      return matches && problems && laneVisible;
    });
  }, [items, query, show.onlyProblems, lanes]);

  // Group by lane and day
  const byLaneDay = useMemo(() => {
    const map = new Map();
    for (const l of lanes) {
      for (const d of days) map.set(`${l}|${isoDate(d)}`, []);
    }

    for (const it of filtered) {
      if (it.type === 'range') continue;
      const key = `${it.lane}|${it.date}`;
      if (map.has(key)) {
        map.get(key).push(it);
      }
    }
    return map;
  }, [filtered, lanes, days]);

  // Ranges for ON_RENT lane
  const ranges = useMemo(() => filtered.filter((it) => it.type === 'range'), [filtered]);

  const openItem = (it) => {
    setActiveItem(it);
    setDrawerOpen(true);
  };

  const startMove = (it) => setMove(it);

  const clickCell = async (lane, d) => {
    const date = isoDate(d);
    if (move) {
      // Move item to new cell
      setItems((prev) =>
        prev.map((x) => (x.id === move.id ? { ...x, lane, date } : x))
      );
      
      // Update backend if it's an order
      if (move.orderId && (lane === LANE.ISSUE || lane === LANE.RETURN)) {
        try {
          await axios.put(`${BACKEND_URL}/api/orders/${move.orderId}`, {
            [lane === LANE.ISSUE ? 'rental_start_date' : 'rental_end_date']: date
          });
          console.log('[Calendar] Date updated');
        } catch (err) {
          console.error('[Calendar] Failed to update date:', err);
        }
      }
      
      setMove(null);
    }
  };

  // Stats
  const stats = useMemo(() => ({
    total: filtered.length,
    issue: filtered.filter(i => i.lane === LANE.ISSUE).length,
    return: filtered.filter(i => i.lane === LANE.RETURN).length,
    packing: filtered.filter(i => i.lane === LANE.PACKING).length,
    cleaning: filtered.filter(i => i.lane === LANE.CLEANING || i.lane === LANE.RESTORE).length,
    damage: filtered.filter(i => i.lane === LANE.DAMAGE).length,
  }), [filtered]);

  return (
    <div className="min-h-screen bg-corp-bg-page font-montserrat">
      <CorporateHeader cabinetName="Операційний календар" showBackButton onBackClick={() => navigate('/manager')} />

      <div className="mx-auto max-w-7xl px-4 py-4 space-y-4">
        <TopBar mode={mode} setMode={setMode} query={query} setQuery={setQuery} show={show} setShow={setShow} />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="corp-stat-card">
            <div className="corp-stat-label">Всього подій</div>
            <div className="corp-stat-value">{stats.total}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-xs text-emerald-700">Видачі</div>
            <div className="text-xl font-bold text-emerald-800">{stats.issue}</div>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
            <div className="text-xs text-indigo-700">Повернення</div>
            <div className="text-xl font-bold text-indigo-800">{stats.return}</div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs text-amber-700">Комплектація</div>
            <div className="text-xl font-bold text-amber-800">{stats.packing}</div>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
            <div className="text-xs text-sky-700">Мийка/Рест.</div>
            <div className="text-xl font-bold text-sky-800">{stats.cleaning}</div>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
            <div className="text-xs text-rose-700">Шкоди</div>
            <div className="text-xl font-bold text-rose-800">{stats.damage}</div>
          </div>
        </div>

        {/* Week navigation */}
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b p-3">
            <div className="flex items-center gap-2">
              <button
                className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => setStart((s) => addDays(s, -7))}
              >
                ← Тиждень
              </button>
              <button
                className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => setStart(startOfWeek(new Date()))}
              >
                Сьогодні
              </button>
              <button
                className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => setStart((s) => addDays(s, 7))}
              >
                Тиждень →
              </button>
            </div>

            <div className="text-sm text-slate-600 font-medium">
              {fmtDay(days[0])} — {fmtDay(days[6])}
            </div>

            <div className="flex items-center gap-2">
              {move ? (
                <>
                  <Badge tone="warn">✋ Переміщення: {move.title}</Badge>
                  <button
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                    onClick={() => setMove(null)}
                  >
                    Скасувати
                  </button>
                </>
              ) : (
                <Badge tone="ok">✓ Готово</Badge>
              )}
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="p-8 text-center text-slate-400">Завантаження...</div>
          ) : (
            <div className="overflow-auto">
              <div className="min-w-[900px]">
                {/* Header */}
                <div className="grid grid-cols-8 border-b bg-slate-50">
                  <div className="p-3 text-sm font-semibold text-slate-700">Лейни</div>
                  {days.map((d) => {
                    const isToday = isoDate(d) === isoDate(new Date());
                    return (
                      <div key={isoDate(d)} className={cls('p-3 text-sm font-semibold text-center', isToday && 'bg-blue-50')}>
                        <div className={isToday ? 'text-blue-600' : 'text-slate-700'}>{fmtDay(d)}</div>
                        <div className={cls('text-xs font-normal', isToday ? 'text-blue-500' : 'text-slate-500')}>
                          {isoDate(d)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Lanes */}
                {lanes.map((lane) => {
                  const laneInfo = laneMeta[lane];
                  return (
                    <div key={lane} className="grid grid-cols-8 border-b">
                      <div className="p-3 border-r">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className={cls('font-semibold text-sm', laneInfo.textClass)}>{laneInfo.title}</div>
                            <div className="text-xs text-slate-500 truncate">{laneInfo.hint}</div>
                          </div>
                          <Badge>{laneInfo.chip}</Badge>
                        </div>

                        {/* Ranges sidebar for ON_RENT */}
                        {lane === LANE.ON_RENT && ranges.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {ranges.slice(0, 3).map((r) => (
                              <div
                                key={r.id}
                                className="rounded-xl border bg-white p-2 shadow-sm cursor-pointer hover:shadow"
                                onClick={() => openItem(r)}
                              >
                                <div className="font-semibold text-xs truncate">{r.title}</div>
                                <div className="text-[10px] text-slate-600">{r.from} → {r.to}</div>
                              </div>
                            ))}
                            {ranges.length > 3 && (
                              <div className="text-xs text-slate-400 text-center">+{ranges.length - 3} більше</div>
                            )}
                          </div>
                        )}
                      </div>

                      {days.map((d) => {
                        const key = `${lane}|${isoDate(d)}`;
                        const cellItems = byLaneDay.get(key) || [];
                        const isToday = isoDate(d) === isoDate(new Date());

                        return (
                          <div
                            key={key}
                            className={cls(
                              'min-h-[100px] p-2 border-l',
                              isToday ? 'bg-blue-50/30' : 'bg-white',
                              move ? 'cursor-crosshair hover:bg-emerald-50' : 'hover:bg-slate-50'
                            )}
                            onClick={() => clickCell(lane, d)}
                          >
                            <div className="space-y-2">
                              {cellItems.map((it) => (
                                <ItemCard
                                  key={it.id}
                                  item={it}
                                  onOpen={openItem}
                                  onMoveStart={startMove}
                                  isCompact={show.compact}
                                  navigate={navigate}
                                />
                              ))}
                              {cellItems.length === 0 && (
                                <div className="rounded-xl border border-dashed bg-white/70 p-2 text-xs text-slate-400 text-center">
                                  —
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p-3 text-xs text-slate-500 border-t bg-slate-50">
            💡 Клік по карточці → деталі • Клік по 👁️ → drawer • Клік по ✋ → перемістити (потім клікни на новий слот)
          </div>
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        item={activeItem}
        onClose={() => setDrawerOpen(false)}
        navigate={navigate}
      />
    </div>
  );
}
