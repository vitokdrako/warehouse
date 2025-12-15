/* eslint-disable */
import React, { useMemo, useState, useEffect } from 'react';
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
    title: 'Видача', 
    hint: 'Готові до видачі клієнту', 
    chip: 'Issue',
    railColor: 'bg-corp-primary',
    bgClass: 'bg-[#f4f8e6]',
    borderClass: 'border-corp-primary/30',
    textClass: 'text-corp-text-dark'
  },
  [LANE.RETURN]: { 
    title: 'Повернення', 
    hint: 'Очікуємо повернення', 
    chip: 'Return',
    railColor: 'bg-corp-gold',
    bgClass: 'bg-[#faf6ed]',
    borderClass: 'border-corp-gold/30',
    textClass: 'text-corp-text-dark'
  },
  [LANE.ON_RENT]: { 
    title: 'В оренді', 
    hint: 'Діапазони між датами', 
    chip: 'Range',
    railColor: 'bg-corp-text-muted',
    bgClass: 'bg-corp-bg-light',
    borderClass: 'border-corp-border',
    textClass: 'text-corp-text-main'
  },
  [LANE.PACKING]: { 
    title: 'Комплектація', 
    hint: 'На збірці та пакуванні', 
    chip: 'Task',
    railColor: 'bg-amber-500',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    textClass: 'text-amber-800'
  },
  [LANE.CLEANING]: { 
    title: 'Мийка / Хімчистка', 
    hint: 'Партії та задачі', 
    chip: 'Task',
    railColor: 'bg-sky-500',
    bgClass: 'bg-sky-50',
    borderClass: 'border-sky-200',
    textClass: 'text-sky-800'
  },
  [LANE.RESTORE]: { 
    title: 'Реставрація', 
    hint: 'Відновлення/ремонт', 
    chip: 'Task',
    railColor: 'bg-orange-500',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-200',
    textClass: 'text-orange-800'
  },
  [LANE.DAMAGE]: { 
    title: 'Шкоди', 
    hint: 'Кейси пошкоджень', 
    chip: 'Case',
    railColor: 'bg-rose-500',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-200',
    textClass: 'text-rose-800'
  },
};

/************* Badge Component *************/
function Badge({ children, tone = 'neutral' }) {
  const toneClasses = {
    ok: 'bg-[#f4f8e6] text-corp-primary border-corp-primary/30',
    warn: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
    info: 'bg-[#faf6ed] text-corp-gold border-corp-gold/30',
    neutral: 'bg-corp-bg-light text-corp-text-main border-corp-border',
  };

  return (
    <span className={cls(
      'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border',
      toneClasses[tone] || toneClasses.neutral
    )}>
      {children}
    </span>
  );
}

/************* TopBar Component *************/
function TopBar({ mode, setMode, query, setQuery, show, setShow }) {
  return (
    <div className="corp-card">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-corp-text-dark">Операційний стіл</h2>
          <Badge tone="info">Тижневий огляд</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode switcher */}
          <div className="flex items-center rounded border border-corp-border bg-corp-bg-light p-1">
            {[
              { id: 'overview', label: 'Огляд' },
              { id: 'ops', label: 'Операції' },
              { id: 'tasks', label: 'Задачі' },
            ].map((m) => (
              <button
                key={m.id}
                className={cls(
                  'rounded px-3 py-1.5 text-sm font-medium transition-all',
                  mode === m.id 
                    ? 'bg-corp-primary text-white shadow-sm' 
                    : 'text-corp-text-main hover:text-corp-text-dark'
                )}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 rounded border border-corp-border bg-white px-3 py-2">
            <svg className="w-4 h-4 text-corp-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="w-40 lg:w-48 bg-transparent text-sm outline-none text-corp-text-dark placeholder:text-corp-text-muted"
              placeholder="Пошук..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Filters */}
          <button
            className={cls(
              'corp-btn',
              show.onlyProblems 
                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                : 'corp-btn-secondary'
            )}
            onClick={() => setShow((s) => ({ ...s, onlyProblems: !s.onlyProblems }))}
          >
            Проблеми
          </button>
          <button
            className={cls('corp-btn corp-btn-secondary')}
            onClick={() => setShow((s) => ({ ...s, compact: !s.compact }))}
          >
            {show.compact ? 'Щільно' : 'Детально'}
          </button>
        </div>
      </div>
    </div>
  );
}

/************* ItemCard Component *************/
function ItemCard({ item, onOpen, onMoveStart, isCompact, navigate }) {
  const laneInfo = laneMeta[item.lane] || laneMeta[LANE.ISSUE];

  const handleNavigate = (e) => {
    e.stopPropagation();
    if (item.linkTo === 'issue_card' && item.issueCardId) {
      navigate(`/issue/${item.issueCardId}`);
    } else if (item.linkTo === 'return_card' && item.orderId) {
      navigate(`/return/${item.orderId}`);
    } else if (item.linkTo === 'order' && item.orderId) {
      navigate(`/order/${item.orderId}/view`);
    } else if (item.linkTo === 'damage') {
      navigate('/damages');
    } else if (item.linkTo === 'cleaning' || item.linkTo === 'tasks') {
      navigate('/tasks');
    } else {
      onOpen(item);
    }
  };

  return (
    <div
      className={cls(
        'group relative w-full overflow-hidden rounded border bg-white cursor-pointer transition-all',
        'p-2',
        'hover:shadow-md hover:border-corp-primary/50',
        laneInfo.borderClass
      )}
      onClick={handleNavigate}
    >
      {/* Color rail */}
      <div className={cls('absolute left-0 top-0 h-full w-1', laneInfo.railColor)} />
      
      <div className="pl-2">
        {/* Title + Order code on same line */}
        <div className="flex items-center gap-2">
          <span className={cls('font-semibold text-sm truncate', laneInfo.textClass)}>
            {item.title}
          </span>
          {item.orderCode && (
            <span className="text-[10px] font-mono text-corp-text-muted shrink-0">{item.orderCode}</span>
          )}
        </div>
        
        {/* Status badge */}
        {item.status && (
          <span className={cls(
            'inline-block mt-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
            laneInfo.bgClass, laneInfo.textClass
          )}>
            {item.status}
          </span>
        )}
        
        {/* Meta info - only in detailed mode */}
        {!isCompact && item.meta && (
          <p className="mt-1 text-xs text-corp-text-muted truncate">{item.meta}</p>
        )}
        
        {/* Hover actions */}
        <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition">
          <button
            className="rounded border border-corp-border bg-corp-bg-light px-1.5 py-0.5 text-[10px] text-corp-text-main hover:bg-white"
            onClick={(e) => { e.stopPropagation(); onOpen(item); }}
          >
            Деталі
          </button>
          <button
            className="rounded border border-corp-border bg-corp-bg-light px-1.5 py-0.5 text-[10px] text-corp-text-main hover:bg-white"
            onClick={(e) => { e.stopPropagation(); onMoveStart(item); }}
          >
            Перенести
          </button>
        </div>
      </div>
    </div>
  );
}

/************* Create Task Dialog *************/
function CreateTaskDialog({ open, draft, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('general');
  const [priority, setPriority] = useState('medium');

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setTaskType(draft?.lane === LANE.CLEANING ? 'cleaning' : draft?.lane === LANE.RESTORE ? 'repair' : 'general');
      setPriority('medium');
    }
  }, [open, draft]);

  if (!open || !draft) return null;

  const laneInfo = laneMeta[draft.lane] || laneMeta[LANE.PACKING];

  const taskTypes = [
    { id: 'general', label: 'Загальне' },
    { id: 'packing', label: 'Комплектація' },
    { id: 'cleaning', label: 'Мийка' },
    { id: 'repair', label: 'Реставрація' },
    { id: 'delivery', label: 'Доставка' },
  ];

  const priorities = [
    { id: 'low', label: 'Низький', cls: 'text-corp-text-muted' },
    { id: 'medium', label: 'Середній', cls: 'text-amber-600' },
    { id: 'high', label: 'Високий', cls: 'text-rose-600' },
  ];

  const handleSubmit = () => {
    if (!title.trim()) {
      alert('Введіть назву задачі');
      return;
    }
    onCreate({
      title: title.trim(),
      description: description.trim(),
      taskType,
      priority,
      date: draft.date,
      lane: draft.lane,
    });
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="absolute left-1/2 top-16 w-full max-w-lg -translate-x-1/2 corp-card shadow-lg">
        <div className="flex items-center justify-between border-b border-corp-border pb-4 mb-4">
          <div>
            <p className="text-xs text-corp-text-muted">Створити задачу</p>
            <h3 className="text-lg font-semibold text-corp-text-dark">{laneInfo.title} • {draft.date}</h3>
          </div>
          <button className="corp-btn corp-btn-secondary" onClick={onClose}>
            Закрити
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-corp-text-dark">Назва задачі *</label>
            <input
              className="mt-1 w-full rounded border border-corp-border px-3 py-2.5 text-sm outline-none focus:border-corp-primary focus:ring-1 focus:ring-corp-primary/20 text-corp-text-dark"
              placeholder="Наприклад: Помити вази після замовлення #7044"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-corp-text-dark">Опис</label>
            <textarea
              className="mt-1 w-full rounded border border-corp-border px-3 py-2.5 text-sm outline-none focus:border-corp-primary focus:ring-1 focus:ring-corp-primary/20 resize-none text-corp-text-dark"
              placeholder="Деталі задачі (опціонально)"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Task Type */}
          <div>
            <label className="text-sm font-medium text-corp-text-dark">Тип задачі</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {taskTypes.map((t) => (
                <button
                  key={t.id}
                  className={cls(
                    'corp-btn',
                    taskType === t.id 
                      ? 'corp-btn-primary' 
                      : 'corp-btn-secondary'
                  )}
                  onClick={() => setTaskType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm font-medium text-corp-text-dark">Пріоритет</label>
            <div className="mt-2 flex gap-2">
              {priorities.map((p) => (
                <button
                  key={p.id}
                  className={cls(
                    'flex-1 rounded border px-3 py-2 text-sm font-medium transition-all',
                    priority === p.id 
                      ? 'border-corp-primary bg-corp-primary/10' 
                      : 'border-corp-border bg-white hover:border-corp-primary/50',
                    p.cls
                  )}
                  onClick={() => setPriority(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-corp-border">
            <button className="corp-btn corp-btn-secondary" onClick={onClose}>
              Скасувати
            </button>
            <button className="corp-btn corp-btn-primary" onClick={handleSubmit}>
              Створити задачу
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
    } else if (item.linkTo === 'cleaning' || item.linkTo === 'tasks') {
      navigate('/tasks');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-lg overflow-y-auto">
        <div className="flex items-center justify-between border-b border-corp-border p-4 sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <p className="text-xs text-corp-text-muted">Деталі події</p>
            <h3 className="truncate text-lg font-semibold text-corp-text-dark">{item.title}</h3>
          </div>
          <button className="corp-btn corp-btn-secondary" onClick={onClose}>
            Закрити
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Info card */}
          <div className={cls('corp-card', laneInfo.bgClass)}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-corp-text-dark">Тип</span>
              <span className={cls('rounded border px-3 py-1 text-sm font-semibold', laneInfo.borderClass, laneInfo.textClass)}>
                {laneInfo.title}
              </span>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {item.meta && <p className="text-corp-text-main">{item.meta}</p>}
              <p>
                <span className="text-corp-text-muted">Дата:</span>{' '}
                <span className="font-medium text-corp-text-dark">{item.date || item.from}</span>
                {item.to && <span className="text-corp-text-muted"> → </span>}
                {item.to && <span className="font-medium text-corp-text-dark">{item.to}</span>}
              </p>
              {item.orderCode && (
                <p>
                  <span className="text-corp-text-muted">Замовлення:</span>{' '}
                  <span className="font-mono font-medium text-corp-text-dark">{item.orderCode}</span>
                </p>
              )}
              {item.client && (
                <p>
                  <span className="text-corp-text-muted">Клієнт:</span>{' '}
                  <span className="font-medium text-corp-text-dark">{item.client}</span>
                </p>
              )}
              {item.phone && (
                <p>
                  <span className="text-corp-text-muted">Телефон:</span>{' '}
                  <a href={`tel:${item.phone}`} className="font-medium text-corp-primary hover:underline">{item.phone}</a>
                </p>
              )}
              {item.amount && (
                <p>
                  <span className="text-corp-text-muted">Сума:</span>{' '}
                  <span className="font-semibold text-corp-primary">₴ {item.amount}</span>
                </p>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="corp-card">
            <h4 className="font-semibold text-corp-text-dark mb-3">Швидкі дії</h4>
            <div className="grid grid-cols-2 gap-2">
              <button className="corp-btn corp-btn-primary" onClick={handleOpenSource}>
                Відкрити кабінет
              </button>
              {item.phone && (
                <a href={`tel:${item.phone}`} className="corp-btn corp-btn-gold text-center">
                  Зателефонувати
                </a>
              )}
              <button className="corp-btn corp-btn-secondary" onClick={() => navigate('/finance')}>
                Фінанси
              </button>
              <button className="corp-btn corp-btn-secondary" onClick={() => alert('Нотатка додана (демо)')}>
                + Нотатка
              </button>
            </div>
          </div>

          {/* Order items if available */}
          {item.orderData?.items && item.orderData.items.length > 0 && (
            <div className="corp-card">
              <h4 className="font-semibold text-corp-text-dark mb-3">Товари ({item.orderData.items.length})</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {item.orderData.items.slice(0, 10).map((product, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-corp-bg-light rounded border border-corp-border">
                    {product.image && (
                      <img src={product.image} alt="" className="w-10 h-10 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-corp-text-dark truncate">{product.name || product.product_name}</p>
                      <p className="text-xs text-corp-text-muted">
                        {product.quantity || product.qty} шт × ₴{product.price_per_day || product.rental_price || 0}
                      </p>
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
  
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);

  const lanes = useMemo(() => {
    if (mode === 'ops') return [LANE.ISSUE, LANE.RETURN, LANE.ON_RENT, LANE.PACKING];
    if (mode === 'tasks') return [LANE.PACKING, LANE.CLEANING, LANE.RESTORE, LANE.DAMAGE];
    return [LANE.ISSUE, LANE.RETURN, LANE.PACKING, LANE.CLEANING, LANE.RESTORE, LANE.DAMAGE];
  }, [mode]);

  useEffect(() => {
    loadCalendarData();
  }, [start]);

  const loadCalendarData = async () => {
    try {
      setLoading(true);
      const calendarItems = [];

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

      // 5. Load user-created tasks
      try {
        const tasksRes = await axios.get(`${BACKEND_URL}/api/tasks`);
        const tasks = tasksRes.data || [];
        
        tasks.forEach((task) => {
          const taskDate = task.due_date?.slice(0, 10) || task.created_at?.slice(0, 10) || isoDate(new Date());
          
          let lane = LANE.PACKING;
          if (task.task_type === 'cleaning' || task.task_type === 'wash') lane = LANE.CLEANING;
          if (task.task_type === 'repair' || task.task_type === 'restore') lane = LANE.RESTORE;
          if (task.task_type === 'damage') lane = LANE.DAMAGE;
          
          calendarItems.push({
            id: `task-${task.id}`,
            lane: lane,
            type: 'task',
            date: taskDate,
            title: task.title,
            meta: task.description || task.task_type,
            orderCode: task.order_number,
            tags: task.priority === 'high' ? ['danger'] : task.priority === 'medium' ? ['warn'] : ['info'],
            status: task.status === 'done' ? 'Виконано' : task.status === 'in_progress' ? 'В роботі' : 'Очікує',
            linkTo: 'tasks',
            taskId: task.id,
            orderData: task,
          });
        });
      } catch (err) {
        console.error('[Calendar] Failed to load tasks:', err);
      }

      setItems(calendarItems);
    } catch (err) {
      console.error('[Calendar] Failed to load calendar:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const ranges = useMemo(() => filtered.filter((it) => it.type === 'range'), [filtered]);

  const openItem = (it) => {
    setActiveItem(it);
    setDrawerOpen(true);
  };

  const startMove = (it) => setMove(it);

  const clickCell = async (lane, d) => {
    const date = isoDate(d);
    if (move) {
      setItems((prev) =>
        prev.map((x) => (x.id === move.id ? { ...x, lane, date } : x))
      );
      
      if (move.orderId && (lane === LANE.ISSUE || lane === LANE.RETURN)) {
        try {
          await axios.put(`${BACKEND_URL}/api/orders/${move.orderId}`, {
            [lane === LANE.ISSUE ? 'rental_start_date' : 'rental_end_date']: date
          });
        } catch (err) {
          console.error('[Calendar] Failed to update date:', err);
        }
      }
      
      setMove(null);
    } else {
      setCreateDraft({ lane, date });
      setCreateOpen(true);
    }
  };

  const handleCreateTask = async (taskData) => {
    try {
      await axios.post(`${BACKEND_URL}/api/tasks`, {
        title: taskData.title,
        description: taskData.description,
        task_type: taskData.taskType,
        priority: taskData.priority,
        due_date: taskData.date,
        status: 'todo'
      });
      
      loadCalendarData();
      setCreateOpen(false);
      setCreateDraft(null);
    } catch (err) {
      console.error('[Calendar] Failed to create task:', err);
      alert('Помилка при створенні задачі');
    }
  };

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
          <div className="corp-card text-center">
            <p className="text-xs text-corp-text-muted">Всього</p>
            <p className="text-xl font-bold text-corp-text-dark">{stats.total}</p>
          </div>
          <div className="corp-card text-center bg-[#f4f8e6]">
            <p className="text-xs text-corp-primary">Видачі</p>
            <p className="text-xl font-bold text-corp-primary">{stats.issue}</p>
          </div>
          <div className="corp-card text-center bg-[#faf6ed]">
            <p className="text-xs text-corp-gold">Повернення</p>
            <p className="text-xl font-bold text-corp-gold">{stats.return}</p>
          </div>
          <div className="corp-card text-center bg-amber-50">
            <p className="text-xs text-amber-700">Комплектація</p>
            <p className="text-xl font-bold text-amber-700">{stats.packing}</p>
          </div>
          <div className="corp-card text-center bg-sky-50">
            <p className="text-xs text-sky-700">Мийка/Рест.</p>
            <p className="text-xl font-bold text-sky-700">{stats.cleaning}</p>
          </div>
          <div className="corp-card text-center bg-rose-50">
            <p className="text-xs text-rose-700">Шкоди</p>
            <p className="text-xl font-bold text-rose-700">{stats.damage}</p>
          </div>
        </div>

        {/* Week navigation */}
        <div className="corp-card !p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-corp-border p-3">
            <div className="flex items-center gap-2">
              <button className="corp-btn corp-btn-secondary" onClick={() => setStart((s) => addDays(s, -7))}>
                ← Тиждень
              </button>
              <button className="corp-btn corp-btn-primary" onClick={() => setStart(startOfWeek(new Date()))}>
                Сьогодні
              </button>
              <button className="corp-btn corp-btn-secondary" onClick={() => setStart((s) => addDays(s, 7))}>
                Тиждень →
              </button>
            </div>

            <p className="text-sm font-medium text-corp-text-dark">
              {fmtDay(days[0])} — {fmtDay(days[6])}
            </p>

            <div className="flex items-center gap-2">
              {move ? (
                <>
                  <Badge tone="warn">Move: {move.title}</Badge>
                  <button className="corp-btn corp-btn-secondary" onClick={() => setMove(null)}>
                    Скасувати
                  </button>
                </>
              ) : (
                <Badge tone="ok">Готово</Badge>
              )}
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="p-8 text-center text-corp-text-muted">Завантаження...</div>
          ) : (
            <div className="overflow-auto">
              <div className="min-w-[900px]">
                {/* Header */}
                <div className="grid grid-cols-8 border-b border-corp-border bg-corp-bg-light">
                  <div className="p-3 text-sm font-semibold text-corp-text-dark">Категорії</div>
                  {days.map((d) => {
                    const isToday = isoDate(d) === isoDate(new Date());
                    return (
                      <div key={isoDate(d)} className={cls('p-3 text-sm font-semibold text-center', isToday && 'bg-corp-primary/10')}>
                        <p className={isToday ? 'text-corp-primary' : 'text-corp-text-dark'}>{fmtDay(d)}</p>
                        <p className={cls('text-xs font-normal', isToday ? 'text-corp-primary' : 'text-corp-text-muted')}>
                          {isoDate(d)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Lanes */}
                {lanes.map((lane) => {
                  const laneInfo = laneMeta[lane];
                  return (
                    <div key={lane} className="grid grid-cols-8 border-b border-corp-border">
                      <div className="p-3 border-r border-corp-border bg-corp-bg-light">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className={cls('font-semibold text-sm', laneInfo.textClass)}>{laneInfo.title}</p>
                            <p className="text-xs text-corp-text-muted truncate">{laneInfo.hint}</p>
                          </div>
                          <Badge>{laneInfo.chip}</Badge>
                        </div>

                        {lane === LANE.ON_RENT && ranges.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {ranges.slice(0, 3).map((r) => (
                              <div
                                key={r.id}
                                className="rounded border border-corp-border bg-white p-2 cursor-pointer hover:shadow-sm transition"
                                onClick={() => openItem(r)}
                              >
                                <p className="font-semibold text-xs truncate text-corp-text-dark">{r.title}</p>
                                <p className="text-[10px] text-corp-text-muted">{r.from} → {r.to}</p>
                              </div>
                            ))}
                            {ranges.length > 3 && (
                              <p className="text-xs text-corp-text-muted text-center">+{ranges.length - 3} більше</p>
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
                              'min-h-[100px] p-2 border-l border-corp-border',
                              isToday ? 'bg-corp-primary/5' : 'bg-white',
                              move ? 'cursor-crosshair hover:bg-corp-primary/10' : 'hover:bg-corp-bg-light'
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
                                <div className="rounded border border-dashed border-corp-border bg-corp-bg-light/50 p-2 text-xs text-corp-text-muted text-center hover:bg-corp-primary/10 hover:border-corp-primary/50 transition cursor-pointer">
                                  + задача
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

          <div className="p-3 text-xs text-corp-text-muted border-t border-corp-border bg-corp-bg-light">
            Клік по пустій клітинці → створити задачу • Клік по карточці → деталі • Move → перемістити
          </div>
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        item={activeItem}
        onClose={() => setDrawerOpen(false)}
        navigate={navigate}
      />

      <CreateTaskDialog
        open={createOpen}
        draft={createDraft}
        onClose={() => {
          setCreateOpen(false);
          setCreateDraft(null);
        }}
        onCreate={handleCreateTask}
      />
    </div>
  );
}
