/* eslint-disable */
/**
 * UnifiedCalendar - Єдиний гнучкий календар
 * Дзеркало всіх подій системи
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import CorporateHeader from '../components/CorporateHeader'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''
const KYIV_TZ = 'Europe/Kyiv'

// ============================================================
// HELPERS
// ============================================================
const cls = (...a) => a.filter(Boolean).join(' ')

const getKyivTodayISO = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KYIV_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const toKyivISO = (d) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KYIV_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

const isoToSafeDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

const safeDateToISO = (date) => {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const addDaysISO = (iso, days) => {
  const date = isoToSafeDate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return safeDateToISO(date)
}

const formatDateUA = (iso) => {
  const date = isoToSafeDate(iso)
  return date.toLocaleDateString('uk-UA', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short',
    timeZone: 'UTC'
  })
}

const formatMonthUA = (iso) => {
  const date = isoToSafeDate(iso)
  return date.toLocaleDateString('uk-UA', { 
    month: 'long', 
    year: 'numeric',
    timeZone: 'UTC'
  })
}

const getWeekDays = (baseISO) => {
  const date = isoToSafeDate(baseISO)
  const day = date.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + diff)
  
  const days = []
  for (let i = 0; i < 7; i++) {
    days.push(safeDateToISO(date))
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return days
}

const getMonthDays = (baseISO) => {
  const [year, month] = baseISO.split('-').map(Number)
  const firstDay = new Date(Date.UTC(year, month - 1, 1, 12))
  const lastDay = new Date(Date.UTC(year, month, 0, 12))
  
  // Початок тижня (понеділок)
  const startDay = firstDay.getUTCDay()
  const startOffset = startDay === 0 ? -6 : 1 - startDay
  firstDay.setUTCDate(firstDay.getUTCDate() + startOffset)
  
  const days = []
  const current = new Date(firstDay)
  
  // 6 тижнів
  for (let i = 0; i < 42; i++) {
    days.push(safeDateToISO(current))
    current.setUTCDate(current.getUTCDate() + 1)
  }
  
  return days
}

// ============================================================
// AUTH FETCH
// ============================================================
const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token')
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
}

// ============================================================
// EVENT TYPE CONFIG
// ============================================================
const EVENT_COLORS = {
  issue: { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  return: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700', dot: 'bg-amber-500' },
  on_rent: { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700', dot: 'bg-blue-500' },
  awaiting: { bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-700', dot: 'bg-violet-500' },
  packing: { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-700', dot: 'bg-orange-500' },
  ready_issue: { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-700', dot: 'bg-teal-500' },
  cleaning: { bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  laundry: { bg: 'bg-sky-100', border: 'border-sky-300', text: 'text-sky-700', dot: 'bg-sky-500' },
  repair: { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-700', dot: 'bg-orange-500' },
  damage: { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700', dot: 'bg-red-500' },
  overdue: { bg: 'bg-red-200', border: 'border-red-400', text: 'text-red-800', dot: 'bg-red-600' },
  payment_due: { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700', dot: 'bg-purple-500' },
  deposit_return: { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-700', dot: 'bg-teal-500' },
  task: { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-700', dot: 'bg-indigo-500' },
}

const EVENT_GROUPS = {
  orders: { label: 'Замовлення', icon: '📦', types: ['issue', 'return', 'awaiting'] },
  operations: { label: 'Операції', icon: '⚙️', types: ['packing', 'ready_issue'] },
  maintenance: { label: 'Обслуговування', icon: '🔧', types: ['cleaning', 'laundry', 'repair'] },
  issues: { label: 'Проблеми', icon: '⚠️', types: ['damage', 'overdue'] },
  finance: { label: 'Фінанси', icon: '💰', types: ['payment_due', 'deposit_return'] },
  tasks: { label: 'Завдання', icon: '📝', types: ['task'] },
}

// ============================================================
// COMPONENTS
// ============================================================

function FilterChip({ active, onClick, children, color }) {
  return (
    <button
      onClick={onClick}
      className={cls(
        'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
        active
          ? `${color?.bg || 'bg-slate-800'} ${color?.text || 'text-white'} shadow-sm`
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      )}
    >
      {children}
    </button>
  )
}

function EventCard({ event, onClick, compact = false }) {
  const colors = EVENT_COLORS[event.type] || EVENT_COLORS.task
  const meta = event._meta || {}
  
  if (compact) {
    return (
      <div
        onClick={() => onClick?.(event)}
        className={cls(
          'px-2 py-1 rounded text-[10px] cursor-pointer truncate',
          'border transition hover:shadow-sm',
          colors.bg, colors.border, colors.text
        )}
      >
        <span className="font-medium">{meta.icon} {event.title}</span>
      </div>
    )
  }
  
  return (
    <div
      onClick={() => onClick?.(event)}
      className={cls(
        'p-3 rounded-xl border cursor-pointer transition',
        'hover:shadow-md hover:-translate-y-0.5',
        colors.bg, colors.border
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className={cls('font-semibold text-sm truncate', colors.text)}>
            {meta.icon} {event.title}
          </div>
          {event.subtitle && (
            <div className="text-xs text-slate-600 mt-0.5 truncate">
              {event.subtitle}
            </div>
          )}
        </div>
        {event.priority === 1 && (
          <span className="text-red-500 text-lg">!</span>
        )}
      </div>
      
      {event.is_range && event.date_end && (
        <div className="mt-2 text-[10px] text-slate-500">
          {event.date} → {event.date_end}
        </div>
      )}
    </div>
  )
}

function DayColumn({ date, events, isToday, isCurrentMonth, onEventClick, onDayClick }) {
  const dayEvents = events.filter(e => e.date === date)
  const dateObj = isoToSafeDate(date)
  const dayNum = dateObj.getUTCDate()
  const weekday = dateObj.toLocaleDateString('uk-UA', { weekday: 'short', timeZone: 'UTC' })
  
  return (
    <div 
      className={cls(
        'flex-1 min-w-0 border-r border-slate-200 last:border-r-0',
        isToday && 'bg-amber-50/50'
      )}
    >
      {/* Header */}
      <div 
        onClick={() => onDayClick?.(date)}
        className={cls(
          'p-2 text-center border-b border-slate-200 cursor-pointer hover:bg-slate-50',
          isToday && 'bg-amber-100'
        )}
      >
        <div className="text-[10px] text-slate-500 uppercase">{weekday}</div>
        <div className={cls(
          'text-lg font-bold',
          isToday ? 'text-amber-700' : isCurrentMonth ? 'text-slate-800' : 'text-slate-400'
        )}>
          {dayNum}
        </div>
        {dayEvents.length > 0 && (
          <div className="flex justify-center gap-0.5 mt-1">
            {dayEvents.slice(0, 5).map((e, i) => (
              <div key={i} className={cls('w-1.5 h-1.5 rounded-full', EVENT_COLORS[e.type]?.dot || 'bg-slate-400')} />
            ))}
            {dayEvents.length > 5 && <span className="text-[8px] text-slate-400">+{dayEvents.length - 5}</span>}
          </div>
        )}
      </div>
      
      {/* Events */}
      <div className="p-1 space-y-1 max-h-[400px] overflow-y-auto">
        {dayEvents.map(event => (
          <EventCard 
            key={event.id} 
            event={event} 
            onClick={onEventClick}
            compact
          />
        ))}
      </div>
    </div>
  )
}

function WeekView({ baseDate, events, todayISO, onEventClick, onDayClick }) {
  const days = getWeekDays(baseDate)
  const [year, month] = baseDate.split('-').map(Number)
  
  return (
    <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white">
      {days.map(day => (
        <DayColumn
          key={day}
          date={day}
          events={events}
          isToday={day === todayISO}
          isCurrentMonth={day.startsWith(`${year}-${String(month).padStart(2, '0')}`)}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
        />
      ))}
    </div>
  )
}

function MonthView({ baseDate, events, todayISO, onEventClick, onDayClick }) {
  const days = getMonthDays(baseDate)
  const [year, month] = baseDate.split('-').map(Number)
  const currentMonthPrefix = `${year}-${String(month).padStart(2, '0')}`
  
  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(d => (
          <div key={d} className="p-2 text-center text-xs font-medium text-slate-500">
            {d}
          </div>
        ))}
      </div>
      
      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-slate-200 last:border-b-0">
          {week.map(day => {
            const dayEvents = events.filter(e => e.date === day)
            const isToday = day === todayISO
            const isCurrentMonth = day.startsWith(currentMonthPrefix)
            const dateObj = isoToSafeDate(day)
            
            return (
              <div
                key={day}
                onClick={() => onDayClick?.(day)}
                className={cls(
                  'min-h-[100px] p-1 border-r border-slate-200 last:border-r-0 cursor-pointer',
                  'hover:bg-slate-50 transition',
                  isToday && 'bg-amber-50',
                  !isCurrentMonth && 'bg-slate-50/50'
                )}
              >
                <div className={cls(
                  'text-sm font-medium mb-1',
                  isToday ? 'text-amber-700' : isCurrentMonth ? 'text-slate-700' : 'text-slate-400'
                )}>
                  {dateObj.getUTCDate()}
                </div>
                
                <div className="space-y-0.5 max-h-[85px] overflow-y-auto">
                  {dayEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick?.(event) }}
                      className={cls(
                        'px-1 py-0.5 rounded text-[9px] truncate cursor-pointer',
                        EVENT_COLORS[event.type]?.bg || 'bg-slate-100',
                        EVENT_COLORS[event.type]?.text || 'text-slate-700'
                      )}
                    >
                      {event._meta?.icon} {event.title}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function DayView({ date, events, onEventClick }) {
  const dayEvents = events.filter(e => e.date === date)
  
  // Групуємо по типах
  const grouped = {}
  for (const event of dayEvents) {
    const group = event._meta?.group || 'other'
    if (!grouped[group]) grouped[group] = []
    grouped[group].push(event)
  }
  
  return (
    <div className="space-y-4">
      <div className="text-center py-4 bg-white rounded-xl border border-slate-200">
        <div className="text-2xl font-bold text-slate-800">{formatDateUA(date)}</div>
        <div className="text-sm text-slate-500">{dayEvents.length} подій</div>
      </div>
      
      {Object.entries(EVENT_GROUPS).map(([groupKey, group]) => {
        const groupEvents = grouped[groupKey] || []
        if (groupEvents.length === 0) return null
        
        return (
          <div key={groupKey} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <span>{group.icon}</span>
              <span className="font-medium text-slate-700">{group.label}</span>
              <span className="text-xs text-slate-500">({groupEvents.length})</span>
            </div>
            <div className="p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {groupEvents.map(event => (
                <EventCard key={event.id} event={event} onClick={onEventClick} />
              ))}
            </div>
          </div>
        )
      })}
      
      {dayEvents.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          Немає подій на цей день
        </div>
      )}
    </div>
  )
}

function EventDetailModal({ event, onClose }) {
  const navigate = useNavigate()
  if (!event) return null
  
  const colors = EVENT_COLORS[event.type] || EVENT_COLORS.task
  
  const handleOpenOrder = () => {
    if (event.order_id) {
      navigate(`/order/${event.order_id}/view`)
      onClose()
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className={cls('p-4 border-b', colors.bg)}>
          <div className="flex items-center justify-between">
            <div className={cls('text-lg font-bold', colors.text)}>
              {event._meta?.icon} {event._meta?.label}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
        </div>
        
        <div className="p-4 space-y-3">
          <div>
            <div className="text-xs text-slate-500">Назва</div>
            <div className="font-semibold">{event.title}</div>
          </div>
          
          {event.subtitle && (
            <div>
              <div className="text-xs text-slate-500">Деталі</div>
              <div>{event.subtitle}</div>
            </div>
          )}
          
          <div>
            <div className="text-xs text-slate-500">Дата</div>
            <div>{formatDateUA(event.date)}</div>
            {event.date_end && <div className="text-sm text-slate-500">→ {formatDateUA(event.date_end)}</div>}
          </div>
          
          {event.customer_name && (
            <div>
              <div className="text-xs text-slate-500">Клієнт</div>
              <div>{event.customer_name}</div>
              {event.customer_phone && <div className="text-sm text-slate-500">{event.customer_phone}</div>}
            </div>
          )}
          
          {event.total_price > 0 && (
            <div>
              <div className="text-xs text-slate-500">Сума</div>
              <div className="font-semibold">₴{event.total_price.toLocaleString()}</div>
            </div>
          )}
          
          {event.order_id && (
            <button
              onClick={handleOpenOrder}
              className="w-full py-2 px-4 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition"
            >
              Відкрити замовлення #{event.order_number}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function UnifiedCalendar() {
  const [view, setView] = useState('week') // day, week, month
  const [baseDate, setBaseDate] = useState(getKyivTodayISO())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [search, setSearch] = useState('')
  
  // Фільтри
  const [activeGroups, setActiveGroups] = useState(new Set(Object.keys(EVENT_GROUPS)))
  const [activeTypes, setActiveTypes] = useState(new Set())
  
  const todayISO = useMemo(() => getKyivTodayISO(), [])
  
  // Обчислення діапазону дат
  const dateRange = useMemo(() => {
    if (view === 'day') {
      return { from: baseDate, to: baseDate }
    } else if (view === 'week') {
      const days = getWeekDays(baseDate)
      return { from: days[0], to: days[6] }
    } else {
      const [year, month] = baseDate.split('-').map(Number)
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
      return { 
        from: addDaysISO(firstDay, -7), // Показуємо трохи до і після
        to: addDaysISO(`${year}-${String(month).padStart(2, '0')}-${lastDay}`, 7)
      }
    }
  }, [view, baseDate])
  
  // Завантаження подій
  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const groupsParam = activeGroups.size > 0 && activeGroups.size < Object.keys(EVENT_GROUPS).length
        ? `&groups=${Array.from(activeGroups).join(',')}`
        : ''
      
      const typesParam = activeTypes.size > 0
        ? `&types=${Array.from(activeTypes).join(',')}`
        : ''
      
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
      
      const url = `${BACKEND_URL}/api/calendar/events?date_from=${dateRange.from}&date_to=${dateRange.to}${groupsParam}${typesParam}${searchParam}`
      
      const res = await authFetch(url)
      const data = await res.json()
      setEvents(data.events || [])
    } catch (err) {
      console.error('[Calendar] Error loading events:', err)
      setEvents([])
    }
    setLoading(false)
  }, [dateRange, activeGroups, activeTypes, search])
  
  useEffect(() => {
    loadEvents()
  }, [loadEvents])
  
  // Навігація
  const navigate = (direction) => {
    if (view === 'day') {
      setBaseDate(addDaysISO(baseDate, direction))
    } else if (view === 'week') {
      setBaseDate(addDaysISO(baseDate, direction * 7))
    } else {
      const [y, m] = baseDate.split('-').map(Number)
      const newMonth = m + direction
      const newYear = newMonth < 1 ? y - 1 : newMonth > 12 ? y + 1 : y
      const adjustedMonth = newMonth < 1 ? 12 : newMonth > 12 ? 1 : newMonth
      setBaseDate(`${newYear}-${String(adjustedMonth).padStart(2, '0')}-01`)
    }
  }
  
  const goToToday = () => setBaseDate(todayISO)
  
  const toggleGroup = (group) => {
    const newGroups = new Set(activeGroups)
    if (newGroups.has(group)) {
      newGroups.delete(group)
    } else {
      newGroups.add(group)
    }
    setActiveGroups(newGroups)
  }
  
  const handleDayClick = (day) => {
    setBaseDate(day)
    setView('day')
  }
  
  // Статистика
  const stats = useMemo(() => {
    const result = {}
    for (const event of events) {
      const type = event.type
      result[type] = (result[type] || 0) + 1
    }
    return result
  }, [events])
  
  return (
    <div className="min-h-screen bg-slate-50">
      <CorporateHeader cabinetName="Календар подій" />
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header - View Switcher only */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          {/* View Switcher */}
          <div className="flex items-center gap-2 bg-white rounded-full p-1 border border-slate-200">
            {[
              { value: 'day', label: 'День' },
              { value: 'week', label: 'Тиждень' },
              { value: 'month', label: 'Місяць' },
            ].map(v => (
              <button
                key={v.value}
                onClick={() => setView(v.value)}
                className={cls(
                  'px-4 py-1.5 rounded-full text-sm font-medium transition',
                  view === v.value
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50"
            >
              ←
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-2 rounded-lg bg-amber-100 text-amber-700 font-medium hover:bg-amber-200"
            >
              Сьогодні
            </button>
            <button
              onClick={() => navigate(1)}
              className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50"
            >
              →
            </button>
            
            <span className="ml-4 text-lg font-semibold text-slate-700">
              {view === 'month' ? formatMonthUA(baseDate) : formatDateUA(baseDate)}
            </span>
          </div>
          
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Пошук..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-4 py-2 rounded-lg border border-slate-200 text-sm w-64"
            />
            <span className="absolute left-2.5 top-2.5 text-slate-400">🔍</span>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-white rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 self-center mr-2">Фільтри:</span>
          {Object.entries(EVENT_GROUPS).map(([key, group]) => (
            <FilterChip
              key={key}
              active={activeGroups.has(key)}
              onClick={() => toggleGroup(key)}
              color={activeGroups.has(key) ? { bg: 'bg-slate-800', text: 'text-white' } : null}
            >
              {group.icon} {group.label}
              {stats[key] > 0 && <span className="ml-1 opacity-70">({stats[key]})</span>}
            </FilterChip>
          ))}
        </div>
        
        {/* Stats Bar */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(stats).map(([type, count]) => {
            const meta = events.find(e => e.type === type)?._meta || {}
            const colors = EVENT_COLORS[type] || {}
            return (
              <div key={type} className={cls('px-3 py-1 rounded-full text-xs flex items-center gap-1', colors.bg, colors.text)}>
                <span>{meta.icon}</span>
                <span>{meta.label}: {count}</span>
              </div>
            )
          })}
        </div>
        
        {/* Calendar View */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Завантаження...</div>
        ) : (
          <>
            {view === 'day' && (
              <DayView 
                date={baseDate} 
                events={events} 
                onEventClick={setSelectedEvent}
              />
            )}
            {view === 'week' && (
              <WeekView
                baseDate={baseDate}
                events={events}
                todayISO={todayISO}
                onEventClick={setSelectedEvent}
                onDayClick={handleDayClick}
              />
            )}
            {view === 'month' && (
              <MonthView
                baseDate={baseDate}
                events={events}
                todayISO={todayISO}
                onEventClick={setSelectedEvent}
                onDayClick={handleDayClick}
              />
            )}
          </>
        )}
      </div>
      
      {/* Event Detail Modal */}
      <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  )
}
