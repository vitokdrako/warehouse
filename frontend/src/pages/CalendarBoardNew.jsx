/* eslint-disable */
import React, { useMemo, useState, useEffect } from 'react'
import axios from 'axios'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL

/************* helpers *************/
const cls = (...a) => a.filter(Boolean).join(' ')

const formatUA = (d) =>
  d.toLocaleDateString('uk-UA', { weekday: 'short', day: '2-digit', month: 'short' })

const addDays = (d, offset) => {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + offset)
  return copy
}

const toISO = (d) => d.toISOString().slice(0, 10)

const startOfWeek = (d) => {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  return copy
}

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0)

/************* UI components *************/
function Badge({ children, tone = 'slate' }) {
  const map = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    blue: 'bg-sky-100 text-sky-700 border-sky-200',
    violet: 'bg-violet-100 text-violet-700 border-violet-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    red: 'bg-rose-100 text-rose-700 border-rose-200',
  }

  return (
    <span className={cls('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', map[tone] || map.slate)}>
      {children}
    </span>
  )
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cls(
            'rounded-full px-3 py-1 transition',
            value === o.value
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/************* Lane metadata *************/
const laneMeta = {
  issue: {
    label: 'Видача',
    color: 'text-[#B08900]',
    bg: 'bg-[#FFF9E7] border-[#F7D75C]',
    desc: 'Нові замовлення та готові до видачі',
  },
  return: {
    label: 'Повернення',
    color: 'text-[#9A5B15]',
    bg: 'bg-[#FFF3E2] border-[#E7B16B]',
    desc: 'Очікувані повернення та перевірка',
  },
  task: {
    label: 'Завдання',
    color: 'text-[#6E349E]',
    bg: 'bg-[#F4E8FF] border-[#B979E6]',
    desc: 'Мийка, реставрація, внутрішні задачі',
  },
  damage: {
    label: 'Шкода',
    color: 'text-[#C43737]',
    bg: 'bg-[#FFE8E8] border-[#E87474]',
    desc: 'Кейси пошкоджень з повернень',
  },
}

const timeSlots = {
  morning: { label: '🌅 Ранок', hours: '06:00-14:00', from: '06:00', to: '14:00' },
  day: { label: '☀️ День', hours: '14:00-18:00', from: '14:00', to: '18:00' },
  evening: { label: '🌆 Вечір', hours: '18:00-22:00', from: '18:00', to: '22:00' },
}

/************* Calendar Card Component *************/
function CalendarCard({ item, onOpen, onDragStart }) {
  const laneInfo = laneMeta[item.lane]
  
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      onClick={() => onOpen(item)}
      className={cls(
        'mb-1 cursor-move rounded-xl border px-2 py-1.5 text-left text-[10px] shadow-sm transition hover:-translate-y-0.5 hover:shadow',
        laneInfo.bg,
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold text-slate-900 truncate">{item.title}</span>
        <span className="whitespace-nowrap text-[9px] text-slate-500">
          {item.timeSlot === 'morning' ? '🌅' : item.timeSlot === 'day' ? '☀️' : '🌆'}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px] text-slate-500">
        {item.orderCode && <span className="font-mono text-slate-700">{item.orderCode}</span>}
        {item.client && <span>· {item.client}</span>}
      </div>
      {item.badge && (
        <div className="mt-1">
          <Badge tone={
            item.lane === 'issue' ? 'green' :
            item.lane === 'return' ? 'blue' :
            item.lane === 'task' ? 'violet' : 'red'
          }>
            {item.badge}
          </Badge>
        </div>
      )}
    </div>
  )
}

/************* Drop Zone Component *************/
function DropZone({ onDrop, children, isEmpty }) {
  const [isOver, setIsOver] = useState(false)

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsOver(true)
  }

  const handleDragLeave = () => {
    setIsOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsOver(false)
    onDrop(e)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cls(
        'min-h-[70px] rounded-xl p-1.5 ring-1 transition-colors',
        isOver ? 'bg-blue-50 ring-blue-300' : 'bg-slate-50/60 ring-slate-100'
      )}
    >
      {isEmpty && !isOver ? (
        <div className="flex h-full items-center justify-center text-[9px] text-slate-300">
          — немає подій —
        </div>
      ) : children}
    </div>
  )
}

/************* Day View *************/
function DayView({ date, items, onOpen, onUpdateItem }) {
  const dateKey = toISO(date)
  
  const handleDragStart = (e, item) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify(item))
  }

  const handleDrop = (e, lane, timeSlot) => {
    const itemData = JSON.parse(e.dataTransfer.getData('application/json'))
    onUpdateItem(itemData, dateKey, lane, timeSlot)
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-[11px]">
      {/* Header */}
      <div className="mb-2 grid grid-cols-[120px,1fr] items-end gap-2 border-b border-slate-100 pb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Потік</div>
        <div className="grid grid-cols-3 gap-1">
          {Object.values(timeSlots).map((slot) => (
            <div key={slot.label} className="text-center text-[10px]">
              <div className="font-medium text-slate-800">{slot.label}</div>
              <div className="text-slate-500">{slot.hours}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lanes */}
      {Object.keys(laneMeta).map((lane) => {
        const laneInfo = laneMeta[lane]
        return (
          <div key={lane} className="grid grid-cols-[120px,1fr] gap-2 border-b border-slate-50 py-2 last:border-b-0">
            <div className="flex flex-col gap-1">
              <span className={cls('text-[11px] font-semibold', laneInfo.color)}>{laneInfo.label}</span>
              <span className="text-[10px] text-slate-400">{laneInfo.desc}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {Object.keys(timeSlots).map((timeSlot) => {
                const slotItems = items.filter(
                  (i) => i.date === dateKey && i.lane === lane && i.timeSlot === timeSlot
                )
                return (
                  <DropZone
                    key={timeSlot}
                    onDrop={(e) => handleDrop(e, lane, timeSlot)}
                    isEmpty={slotItems.length === 0}
                  >
                    {slotItems.map((item) => (
                      <CalendarCard
                        key={item.id}
                        item={item}
                        onOpen={onOpen}
                        onDragStart={handleDragStart}
                      />
                    ))}
                  </DropZone>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/************* Week View *************/
function WeekView({ baseDate, items, onOpen, onUpdateItem }) {
  const weekDates = useMemo(() => {
    const start = startOfWeek(baseDate)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [baseDate])

  const handleDragStart = (e, item) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify(item))
  }

  const handleDrop = (e, date, lane) => {
    const itemData = JSON.parse(e.dataTransfer.getData('application/json'))
    onUpdateItem(itemData, toISO(date), lane, itemData.timeSlot)
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-[11px]">
      {/* Header */}
      <div className="mb-2 grid grid-cols-[120px,1fr] items-end gap-2 border-b border-slate-100 pb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Потік</div>
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((d) => (
            <div key={toISO(d)} className="text-center text-[10px] text-slate-500">
              <div className="font-medium text-slate-800">{d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' })}</div>
              <div>{d.toLocaleDateString('uk-UA', { weekday: 'short' })}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lanes */}
      {Object.keys(laneMeta).map((lane) => {
        const laneInfo = laneMeta[lane]
        return (
          <div key={lane} className="grid grid-cols-[120px,1fr] gap-2 border-b border-slate-50 py-2 last:border-b-0">
            <div className="flex flex-col gap-1">
              <span className={cls('text-[11px] font-semibold', laneInfo.color)}>{laneInfo.label}</span>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {weekDates.map((d) => {
                const dateKey = toISO(d)
                const dayItems = items.filter((i) => i.date === dateKey && i.lane === lane)
                return (
                  <DropZone
                    key={dateKey}
                    onDrop={(e) => handleDrop(e, d, lane)}
                    isEmpty={dayItems.length === 0}
                  >
                    {dayItems.map((item) => (
                      <CalendarCard
                        key={item.id}
                        item={item}
                        onOpen={onOpen}
                        onDragStart={handleDragStart}
                      />
                    ))}
                  </DropZone>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/************* Month View *************/
function MonthView({ baseDate, items, onDateClick }) {
  const monthDates = useMemo(() => {
    const start = startOfMonth(baseDate)
    const end = endOfMonth(baseDate)
    const dates = []
    
    // Get start of week for first day
    let current = startOfWeek(start)
    
    // Fill calendar grid (6 weeks)
    for (let i = 0; i < 42; i++) {
      dates.push(new Date(current))
      current = addDays(current, 1)
    }
    
    return dates
  }, [baseDate])

  const currentMonth = baseDate.getMonth()

  const getCounts = (date) => {
    const dateKey = toISO(date)
    const dayItems = items.filter((i) => i.date === dateKey)
    return {
      issue: dayItems.filter((i) => i.lane === 'issue').length,
      return: dayItems.filter((i) => i.lane === 'return').length,
      task: dayItems.filter((i) => i.lane === 'task').length,
      damage: dayItems.filter((i) => i.lane === 'damage').length,
      total: dayItems.length,
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2 mb-2 text-[10px] font-semibold text-slate-500">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
          <div key={day} className="text-center">{day}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {monthDates.map((date) => {
          const counts = getCounts(date)
          const isCurrentMonth = date.getMonth() === currentMonth
          const isToday = toISO(date) === toISO(new Date())

          return (
            <button
              key={toISO(date)}
              onClick={() => onDateClick(date)}
              className={cls(
                'min-h-[80px] rounded-xl border p-2 text-left transition hover:shadow',
                isCurrentMonth ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100',
                isToday && 'ring-2 ring-blue-500'
              )}
            >
              <div className={cls('text-sm font-semibold mb-1', isCurrentMonth ? 'text-slate-900' : 'text-slate-400')}>
                {date.getDate()}
              </div>
              {counts.total > 0 && (
                <div className="space-y-0.5 text-[9px]">
                  {counts.issue > 0 && <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>{counts.issue}</div>}
                  {counts.return > 0 && <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500"></span>{counts.return}</div>}
                  {counts.task > 0 && <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500"></span>{counts.task}</div>}
                  {counts.damage > 0 && <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span>{counts.damage}</div>}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/************* Main Component *************/
export default function CalendarBoardNew() {
  const [view, setView] = useState('day')
  const [baseDate, setBaseDate] = useState(new Date())
  const [laneFilter, setLaneFilter] = useState('all')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Load data from backend
  useEffect(() => {
    loadCalendarData()
  }, [baseDate])

  const loadCalendarData = async () => {
    try {
      setLoading(true)
      const start = view === 'month' ? startOfMonth(baseDate) : view === 'week' ? startOfWeek(baseDate) : baseDate
      const end = view === 'month' ? endOfMonth(baseDate) : view === 'week' ? addDays(startOfWeek(baseDate), 6) : baseDate

      const calendarItems = []

      // 1. Load orders for Issue and Return lanes
      try {
        const ordersRes = await axios.get(`${BACKEND_URL}/api/orders`, {
          params: { from_date: toISO(start), to_date: toISO(end) }
        })

        const orders = ordersRes.data.orders || []
        
        orders.forEach((o) => {
          const issueDate = o.issue_date || o.rental_start_date
          const returnDate = o.return_date || o.rental_end_date
          const clientName = o.client_name || o.customer_name

          // Issue lane
          if (issueDate && ['awaiting_customer', 'processing', 'ready_for_issue', 'pending'].includes(o.status)) {
            calendarItems.push({
              id: `order-${o.order_number}-issue`,
              lane: 'issue',
              date: issueDate,
              timeSlot: 'morning',
              orderCode: o.order_number,
              title: `Видача: ${clientName}`,
              client: clientName,
              badge: o.status === 'ready_for_issue' ? 'Готово' : o.status === 'processing' ? 'На комплектації' : 'Очікує',
              status: o.status,
              orderData: o,
            })
          }

          // Return lane
          if (returnDate && ['issued', 'on_rent'].includes(o.status)) {
            calendarItems.push({
              id: `order-${o.order_number}-return`,
              lane: 'return',
              date: returnDate,
              timeSlot: 'evening',
              orderCode: o.order_number,
              title: `Повернення: ${clientName}`,
              client: clientName,
              badge: 'Очікуємо',
              status: o.status,
              orderData: o,
            })
          }
        })
      } catch (err) {
        console.error('Failed to load orders:', err)
      }

      // 2. Load cleaning tasks for Task lane
      try {
        const cleaningRes = await axios.get(`${BACKEND_URL}/api/product-cleaning/all`)
        const cleaningTasks = cleaningRes.data || []
        
        cleaningTasks.forEach((task) => {
          if (task.status && task.status !== 'clean') {
            // Add task for today or tomorrow based on status and updated_at
            const updatedDate = task.updated_at ? task.updated_at.slice(0, 10) : toISO(new Date())
            const taskDate = task.status === 'wash' ? updatedDate : toISO(addDays(new Date(updatedDate), 1))
            
            const statusLabels = {
              wash: 'Мийка',
              dry: 'Сушка',
              repair: 'Реставрація'
            }
            
            calendarItems.push({
              id: `task-${task.sku}-${task.status}`,
              lane: 'task',
              date: taskDate,
              timeSlot: task.status === 'wash' ? 'morning' : task.status === 'dry' ? 'day' : 'evening',
              orderCode: null,
              title: `${statusLabels[task.status] || task.status}: ${task.sku}`,
              client: `Оновлено: ${new Date(task.updated_at || new Date()).toLocaleDateString('uk-UA')}`,
              badge: task.status === 'repair' ? 'Критично' : 'В процесі',
              status: task.status,
              orderData: task,
            })
          }
        })
        
        console.log(`[Calendar] Завантажено ${cleaningTasks.length} завдань для реквізиторів`)
      } catch (err) {
        console.error('Failed to load cleaning tasks:', err)
      }

      // 3. Load damage cases for Damage lane
      try {
        const damageRes = await axios.get(`${BACKEND_URL}/api/product-damage-history/recent?limit=50`)
        const damages = damageRes.data || []
        
        damages.forEach((d) => {
          const damageDate = d.created_at ? d.created_at.slice(0, 10) : toISO(new Date())
          
          calendarItems.push({
            id: `damage-${d.id}`,
            lane: 'damage',
            date: damageDate,
            timeSlot: 'day',
            orderCode: d.order_number,
            title: `Пошкодження: ${d.product_name}`,
            client: d.order_number ? `Замовлення ${d.order_number}` : 'Переоблік',
            badge: d.severity === 'high' ? 'Критично' : d.severity === 'medium' ? 'Середньо' : 'Низько',
            status: d.severity,
            orderData: d,
          })
        })
      } catch (err) {
        console.error('Failed to load damage cases:', err)
      }

      setItems(calendarItems)
    } catch (err) {
      console.error('Failed to load calendar:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateItem = async (item, newDate, newLane, newTimeSlot) => {
    console.log('Update item:', { item, newDate, newLane, newTimeSlot })
    
    // Update local state
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, date: newDate, lane: newLane, timeSlot: newTimeSlot }
          : i
      )
    )

    // TODO: Update backend
    // await axios.put(`${BACKEND_URL}/api/orders/${item.orderData.order_id}`, { ... })
  }

  const handleOpenDetails = (item) => {
    alert(`Деталі: ${item.title}\nКлієнт: ${item.client}\nСтатус: ${item.badge}`)
  }

  const moveBase = (offset) => {
    setBaseDate((prev) => addDays(prev, offset))
  }

  const handleMonthDateClick = (date) => {
    setBaseDate(date)
    setView('day')
  }

  const filteredItems = useMemo(() => {
    if (laneFilter === 'all') return items
    return items.filter((i) => i.lane === laneFilter)
  }, [items, laneFilter])

  const summary = useMemo(() => {
    return {
      total: filteredItems.length,
      issues: filteredItems.filter((i) => i.lane === 'issue').length,
      returns: filteredItems.filter((i) => i.lane === 'return').length,
      tasks: filteredItems.filter((i) => i.lane === 'task').length,
      damages: filteredItems.filter((i) => i.lane === 'damage').length,
    }
  }, [filteredItems])

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Завантаження...</div>
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 bg-slate-50 p-4 md:p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Календар процесів</h1>
          <p className="text-xs text-slate-500">
            Видача, повернення, завдання та кейси шкоди — все в одному календарі
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <Segmented
            value={view}
            onChange={(v) => setView(v)}
            options={[
              { value: 'day', label: 'День' },
              { value: 'week', label: 'Тиждень' },
              { value: 'month', label: 'Місяць' },
            ]}
          />
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1">
            <button
              type="button"
              onClick={() => moveBase(view === 'day' ? -1 : view === 'week' ? -7 : -30)}
              className="rounded-full px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              ‹
            </button>
            <span className="px-2 text-[11px] font-medium text-slate-700">
              {view === 'day'
                ? formatUA(baseDate)
                : view === 'week'
                ? `${formatUA(startOfWeek(baseDate))} — ${formatUA(addDays(startOfWeek(baseDate), 6))}`
                : baseDate.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={() => moveBase(view === 'day' ? 1 : view === 'week' ? 7 : 30)}
              className="rounded-full px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              ›
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-3 text-[11px] md:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="text-slate-500">Подій</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{summary.total}</div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-emerald-700">Видачі</div>
          <div className="mt-1 text-lg font-semibold">{summary.issues}</div>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
          <div className="text-sky-700">Повернення</div>
          <div className="mt-1 text-lg font-semibold">{summary.returns}</div>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3">
          <div className="text-violet-700">Завдання</div>
          <div className="mt-1 text-lg font-semibold">{summary.tasks}</div>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
          <div className="text-rose-700">Кейси шкоди</div>
          <div className="mt-1 text-lg font-semibold">{summary.damages}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500">Потік</span>
          <Segmented
            value={laneFilter}
            onChange={(v) => setLaneFilter(v)}
            options={[
              { value: 'all', label: 'Усі' },
              { value: 'issue', label: 'Видача' },
              { value: 'return', label: 'Повернення' },
              { value: 'task', label: 'Завдання' },
              { value: 'damage', label: 'Шкода' },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="green">Видача</Badge>
          <Badge tone="blue">Повернення</Badge>
          <Badge tone="violet">Завдання</Badge>
          <Badge tone="red">Шкода</Badge>
        </div>
      </div>

      {/* Main View */}
      {view === 'day' && (
        <DayView
          date={baseDate}
          items={filteredItems}
          onOpen={handleOpenDetails}
          onUpdateItem={handleUpdateItem}
        />
      )}
      {view === 'week' && (
        <WeekView
          baseDate={baseDate}
          items={filteredItems}
          onOpen={handleOpenDetails}
          onUpdateItem={handleUpdateItem}
        />
      )}
      {view === 'month' && (
        <MonthView
          baseDate={baseDate}
          items={filteredItems}
          onDateClick={handleMonthDateClick}
        />
      )}
    </div>
  )
}
