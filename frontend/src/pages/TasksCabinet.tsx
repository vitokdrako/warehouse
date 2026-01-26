import React, { useMemo, useState, useEffect } from 'react'
import { tasksAPI } from '../api/client'
import CorporateHeader from '../components/CorporateHeader'
import { Plus, Search, Filter, X, ChevronDown } from 'lucide-react'

/*************** helpers ***************/
const cls = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

/*************** types ***************/
type TaskType = 'packing' | 'washing' | 'restoration' | 'reaudit' | 'return' | 'general'
type TaskStatus = 'todo' | 'in_progress' | 'done'
type TaskPriority = 'low' | 'medium' | 'high'

interface Task {
  id: string
  order_id?: number
  order_number?: string
  damage_id?: string
  damage_case_number?: string
  title: string
  description?: string
  task_type: TaskType
  status: TaskStatus
  priority: TaskPriority
  assigned_to?: string
  assigned_to_id?: number
  assignee_name?: string
  due_date?: string
  completed_at?: string
  created_by: string
  created_by_id?: number
  created_at: string
  updated_at: string
}

interface StaffMember {
  id: number
  user_id: number
  username: string
  full_name: string
  role: string
}

/*************** small UI ***************/
function Badge({ tone = 'slate', children, compact = false }: { tone?: string; children: React.ReactNode; compact?: boolean }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    blue: 'bg-sky-100 text-sky-700 border-sky-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    red: 'bg-rose-100 text-rose-700 border-rose-200',
    violet: 'bg-violet-100 text-violet-700 border-violet-200',
  }
  return (
    <span className={cls(
      'inline-flex items-center gap-1 rounded-full border font-medium',
      compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]',
      tones[tone] || tones.slate,
    )}>
      {children}
    </span>
  )
}

function PriorityDot({ priority }: { priority: TaskPriority }) {
  const colors = { low: 'bg-slate-400', medium: 'bg-amber-500', high: 'bg-rose-500' }
  return <span className={cls('w-2 h-2 rounded-full', colors[priority])} />
}

function TaskTypeBadge({ type, compact = false }: { type: TaskType; compact?: boolean }) {
  const types: Record<TaskType, { label: string; short: string; tone: string }> = {
    packing: { label: '📦 Комплектація', short: '📦', tone: 'blue' },
    washing: { label: '💧 Мийка', short: '💧', tone: 'blue' },
    restoration: { label: '🔧 Реставрація', short: '🔧', tone: 'violet' },
    reaudit: { label: '🔍 Переоблік', short: '🔍', tone: 'amber' },
    return: { label: '↩️ Повернення', short: '↩️', tone: 'green' },
    general: { label: '📝 Загальне', short: '📝', tone: 'slate' },
  }
  const { label, short, tone } = types[type] || types.general
  return <Badge tone={tone} compact={compact}>{compact ? short : label}</Badge>
}

/*************** main ***************/
export default function TasksCabinet({ 
  onBackToDashboard, 
  onNavigateToDamage,
  initialContext
}: { 
  onBackToDashboard?: () => void
  onNavigateToDamage?: (damageId: string) => void
  initialContext?: { orderId?: string; orderNumber?: string; damageId?: string; itemId?: string }
}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [staff, setStaff] = useState<StaffMember[]>([])

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterMyTasks, setFilterMyTasks] = useState<boolean>(false)
  const [filterAssignee, setFilterAssignee] = useState<number | null>(null)

  // Mobile: active tab for kanban
  const [activeTab, setActiveTab] = useState<'todo' | 'in_progress' | 'done'>('todo')

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const [prefilledData] = useState(initialContext || {})

  const loadStaff = async () => {
    try {
      const data = await tasksAPI.getStaff()
      setStaff(data)
    } catch (error) {
      console.error('Error loading staff:', error)
    }
  }

  const loadTasks = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (filterMyTasks) params.my_tasks = true
      if (filterAssignee) params.assigned_to_id = filterAssignee
      const data = await tasksAPI.getAll(params)
      setTasks(data)
    } catch (error) {
      console.error('Error loading tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStaff() }, [])
  useEffect(() => { loadTasks() }, [filterMyTasks, filterAssignee])

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch = !searchQuery ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus
      const matchesType = filterType === 'all' || task.task_type === filterType
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority
      return matchesSearch && matchesStatus && matchesType && matchesPriority
    })
  }, [tasks, searchQuery, filterStatus, filterType, filterPriority])

  const tasksByStatus = useMemo(() => ({
    todo: filteredTasks.filter((t) => t.status === 'todo'),
    in_progress: filteredTasks.filter((t) => t.status === 'in_progress'),
    done: filteredTasks.filter((t) => t.status === 'done'),
  }), [filteredTasks])

  const overdueCount = tasks.filter(t => isOverdue(t)).length

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const updatedTask = await tasksAPI.update(taskId, { status: newStatus })
      setTasks(tasks.map((t) => (t.id === taskId ? updatedTask : t)))
      if (selectedTask?.id === taskId) setSelectedTask(updatedTask)
    } catch (error) {
      console.error('Error updating task status:', error)
    }
  }

  const handleAssigneeChange = async (taskId: string, assigneeId: number | null) => {
    try {
      const updatedTask = await tasksAPI.update(taskId, { assigned_to_id: assigneeId })
      setTasks(tasks.map((t) => (t.id === taskId ? updatedTask : t)))
      if (selectedTask?.id === taskId) setSelectedTask(updatedTask)
    } catch (error) {
      console.error('Error updating assignee:', error)
    }
  }

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === 'done') return false
    return new Date(task.due_date) < new Date()
  }

  const hasActiveFilters = filterStatus !== 'all' || filterType !== 'all' || filterPriority !== 'all' || filterMyTasks || filterAssignee

  const clearFilters = () => {
    setFilterStatus('all')
    setFilterType('all')
    setFilterPriority('all')
    setFilterMyTasks(false)
    setFilterAssignee(null)
  }

  return (
    <div className="min-h-screen bg-corp-bg-main pb-20 sm:pb-6">
      <CorporateHeader cabinetName="Завдання" showBackButton={true} onBackClick={onBackToDashboard} />
      
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-3 sm:py-6 space-y-3 sm:space-y-4">
        
        {/* Header - compact on mobile */}
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-xl font-semibold text-corp-text-dark">Завдання</h2>
          {/* Desktop button */}
          <button 
            onClick={() => setShowCreateModal(true)}
            className="hidden sm:flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" /> Нове
          </button>
        </div>

        {/* Stats - horizontal chips on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
          <StatChip label="Всього" value={tasks.length} />
          <StatChip label="До" value={tasksByStatus.todo.length} tone="slate" active={activeTab === 'todo'} onClick={() => setActiveTab('todo')} />
          <StatChip label="В роботі" value={tasksByStatus.in_progress.length} tone="blue" active={activeTab === 'in_progress'} onClick={() => setActiveTab('in_progress')} />
          <StatChip label="Виконано" value={tasksByStatus.done.length} tone="green" active={activeTab === 'done'} onClick={() => setActiveTab('done')} />
          {overdueCount > 0 && <StatChip label="Прострочено" value={overdueCount} tone="red" />}
        </div>

        {/* Search + Filter button */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(true)}
            className={cls(
              'flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium transition',
              hasActiveFilters ? 'bg-corp-primary text-white border-corp-primary' : 'bg-white border-slate-300 text-slate-700'
            )}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Фільтри</span>
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-white sm:hidden" />}
          </button>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-1.5">
            {filterMyTasks && (
              <FilterChip onRemove={() => setFilterMyTasks(false)}>Мої</FilterChip>
            )}
            {filterStatus !== 'all' && (
              <FilterChip onRemove={() => setFilterStatus('all')}>{filterStatus}</FilterChip>
            )}
            {filterType !== 'all' && (
              <FilterChip onRemove={() => setFilterType('all')}>{filterType}</FilterChip>
            )}
            {filterPriority !== 'all' && (
              <FilterChip onRemove={() => setFilterPriority('all')}>{filterPriority}</FilterChip>
            )}
            <button onClick={clearFilters} className="text-xs text-slate-500 underline">Очистити</button>
          </div>
        )}

        {/* Kanban - tabs on mobile, columns on desktop */}
        <div className="sm:hidden">
          {/* Mobile tabs */}
          <div className="flex border-b border-slate-200 -mx-3 px-3">
            <TabButton active={activeTab === 'todo'} onClick={() => setActiveTab('todo')} count={tasksByStatus.todo.length}>
              📋 До
            </TabButton>
            <TabButton active={activeTab === 'in_progress'} onClick={() => setActiveTab('in_progress')} count={tasksByStatus.in_progress.length}>
              🔄 В роботі
            </TabButton>
            <TabButton active={activeTab === 'done'} onClick={() => setActiveTab('done')} count={tasksByStatus.done.length}>
              ✅ Виконано
            </TabButton>
          </div>
          
          {/* Mobile task list */}
          <div className="space-y-2 mt-3">
            {tasksByStatus[activeTab].map((task) => (
              <MobileTaskCard
                key={task.id}
                task={task}
                isOverdue={isOverdue(task)}
                onClick={() => setSelectedTask(task)}
              />
            ))}
            {tasksByStatus[activeTab].length === 0 && (
              <div className="text-center text-sm text-slate-400 py-8">Немає завдань</div>
            )}
          </div>
        </div>

        {/* Desktop Kanban */}
        <div className="hidden sm:grid grid-cols-3 gap-4">
          <KanbanColumn title="📋 До виконання" tasks={tasksByStatus.todo} tone="slate" onTaskClick={setSelectedTask} isOverdue={isOverdue} onStatusChange={handleStatusChange} />
          <KanbanColumn title="🔄 В роботі" tasks={tasksByStatus.in_progress} tone="blue" onTaskClick={setSelectedTask} isOverdue={isOverdue} onStatusChange={handleStatusChange} />
          <KanbanColumn title="✅ Виконано" tasks={tasksByStatus.done} tone="green" onTaskClick={setSelectedTask} isOverdue={() => false} onStatusChange={handleStatusChange} />
        </div>
      </div>

      {/* FAB for mobile */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="sm:hidden fixed bottom-4 right-4 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition z-20"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Filters Bottom Sheet */}
      {showFilters && (
        <FiltersSheet
          onClose={() => setShowFilters(false)}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterType={filterType}
          setFilterType={setFilterType}
          filterPriority={filterPriority}
          setFilterPriority={setFilterPriority}
          filterMyTasks={filterMyTasks}
          setFilterMyTasks={setFilterMyTasks}
          filterAssignee={filterAssignee}
          setFilterAssignee={setFilterAssignee}
          staff={staff}
        />
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusChange}
          onAssigneeChange={handleAssigneeChange}
          onUpdate={loadTasks}
          onNavigateToDamage={onNavigateToDamage}
          staff={staff}
        />
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal 
          onClose={() => setShowCreateModal(false)} 
          onSuccess={loadTasks}
          prefilledData={prefilledData}
          staff={staff}
        />
      )}
    </div>
  )
}

/*************** Stat Chip ***************/
function StatChip({ label, value, tone = 'slate', active, onClick }: { label: string; value: number; tone?: string; active?: boolean; onClick?: () => void }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-rose-100 text-rose-700',
  }
  return (
    <button
      onClick={onClick}
      className={cls(
        'flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition whitespace-nowrap',
        active ? 'ring-2 ring-offset-1 ring-corp-primary' : '',
        tones[tone],
        onClick ? 'cursor-pointer active:scale-95' : 'cursor-default'
      )}
    >
      {label}: <b>{value}</b>
    </button>
  )
}

/*************** Filter Chip ***************/
function FilterChip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-corp-primary/10 text-corp-primary text-xs">
      {children}
      <button onClick={onRemove} className="hover:bg-corp-primary/20 rounded-full p-0.5">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

/*************** Tab Button ***************/
function TabButton({ children, active, count, onClick }: { children: React.ReactNode; active: boolean; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cls(
        'flex-1 py-2 text-xs font-medium border-b-2 transition',
        active ? 'border-corp-primary text-corp-primary' : 'border-transparent text-slate-500'
      )}
    >
      {children} <span className="ml-1 opacity-70">({count})</span>
    </button>
  )
}

/*************** Mobile Task Card ***************/
function MobileTaskCard({ task, isOverdue, onClick }: { task: Task; isOverdue: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} className="bg-white rounded-lg border border-slate-200 p-3 active:bg-slate-50">
      {/* Row 1: Title */}
      <h4 className="font-medium text-sm text-slate-800 line-clamp-2 mb-1">{task.title}</h4>
      
      {/* Row 2: Order/Damage link */}
      {(task.order_number || task.damage_case_number) && (
        <div className="text-xs text-blue-600 mb-1.5">
          {task.order_number && <span>🔗 {task.order_number}</span>}
          {task.damage_case_number && <span className="text-rose-600">⚠️ {task.damage_case_number}</span>}
        </div>
      )}
      
      {/* Row 3: Meta - priority, deadline, assignee */}
      <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
        <span className="flex items-center gap-1">
          <PriorityDot priority={task.priority} />
          {task.priority === 'high' ? 'Високий' : task.priority === 'medium' ? 'Середній' : 'Низький'}
        </span>
        {task.due_date && (
          <span className={isOverdue ? 'text-rose-600 font-medium' : ''}>
            📅 {new Date(task.due_date).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}
          </span>
        )}
        {task.assignee_name && <span>👤 {task.assignee_name.split(' ')[0]}</span>}
        <TaskTypeBadge type={task.task_type} compact />
      </div>
      
      {isOverdue && (
        <div className="mt-1.5"><Badge tone="red" compact>⏰ Прострочено</Badge></div>
      )}
    </div>
  )
}

/*************** Kanban Column (Desktop) ***************/
function KanbanColumn({ title, tasks, tone, onTaskClick, isOverdue, onStatusChange }: {
  title: string
  tasks: Task[]
  tone: string
  onTaskClick: (task: Task) => void
  isOverdue: (task: Task) => boolean
  onStatusChange: (id: string, status: TaskStatus) => void
}) {
  const bgTones: Record<string, string> = { slate: 'bg-slate-100', blue: 'bg-blue-50', green: 'bg-emerald-50' }
  return (
    <div className={cls('rounded-lg p-4', bgTones[tone] || bgTones.slate)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-700 text-sm">{title}</h3>
        <span className="text-xs bg-white/80 px-2 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <MobileTaskCard key={task.id} task={task} isOverdue={isOverdue(task)} onClick={() => onTaskClick(task)} />
        ))}
        {tasks.length === 0 && <div className="text-center text-sm text-slate-400 py-6">Немає</div>}
      </div>
    </div>
  )
}

/*************** Filters Bottom Sheet ***************/
function FiltersSheet({ onClose, filterStatus, setFilterStatus, filterType, setFilterType, filterPriority, setFilterPriority, filterMyTasks, setFilterMyTasks, filterAssignee, setFilterAssignee, staff }: any) {
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl animate-slide-up safe-area-bottom" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-100">
          <span className="font-semibold text-slate-800">Фільтри</span>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* My Tasks Toggle */}
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium">Мої завдання</span>
            <input
              type="checkbox"
              checked={filterMyTasks}
              onChange={(e) => { setFilterMyTasks(e.target.checked); if (e.target.checked) setFilterAssignee(null) }}
              className="w-5 h-5 rounded text-corp-primary"
            />
          </label>
          
          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Статус</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Всі</option>
              <option value="todo">До виконання</option>
              <option value="in_progress">В роботі</option>
              <option value="done">Виконано</option>
            </select>
          </div>
          
          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Тип</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Всі типи</option>
              <option value="packing">📦 Комплектація</option>
              <option value="washing">💧 Мийка</option>
              <option value="restoration">🔧 Реставрація</option>
              <option value="reaudit">🔍 Переоблік</option>
              <option value="return">↩️ Повернення</option>
              <option value="general">📝 Загальне</option>
            </select>
          </div>
          
          {/* Priority */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Пріоритет</label>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Всі</option>
              <option value="high">🔴 Високий</option>
              <option value="medium">🟡 Середній</option>
              <option value="low">⚪ Низький</option>
            </select>
          </div>
          
          {/* Assignee */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Виконавець</label>
            <select
              value={filterAssignee || ''}
              onChange={(e) => { setFilterAssignee(e.target.value ? Number(e.target.value) : null); if (e.target.value) setFilterMyTasks(false) }}
              disabled={filterMyTasks}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">Всі</option>
              {staff.map((s: StaffMember) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-100">
          <button onClick={onClose} className="w-full bg-corp-primary text-white rounded-lg py-2.5 font-medium">
            Застосувати
          </button>
        </div>
      </div>
    </div>
  )
}

/*************** Task Details Modal ***************/
function TaskDetailsModal({ task, onClose, onStatusChange, onAssigneeChange, onUpdate, onNavigateToDamage, staff }: {
  task: Task; onClose: () => void; onStatusChange: (id: string, status: TaskStatus) => void
  onAssigneeChange: (id: string, assigneeId: number | null) => void; onUpdate: () => void
  onNavigateToDamage?: (damageId: string) => void; staff: StaffMember[]
}) {
  const [assigneeId, setAssigneeId] = useState<number | null>(task.assigned_to_id || null)
  const handleSaveAssignee = () => { onAssigneeChange(task.id, assigneeId) }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto safe-area-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-lg font-bold text-corp-text-dark pr-4">{task.title}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none flex-shrink-0">×</button>
          </div>
          
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge tone={task.priority === 'high' ? 'red' : task.priority === 'medium' ? 'amber' : 'slate'}>
              {task.priority === 'high' ? '🔴 Високий' : task.priority === 'medium' ? '🟡 Середній' : '⚪ Низький'}
            </Badge>
            <TaskTypeBadge type={task.task_type} />
            <Badge tone={task.status === 'done' ? 'green' : task.status === 'in_progress' ? 'blue' : 'slate'}>
              {task.status === 'done' ? '✅ Виконано' : task.status === 'in_progress' ? '🔄 В роботі' : '📋 До виконання'}
            </Badge>
          </div>

          {task.description && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-700">{task.description}</div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div className="p-2.5 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500 mb-0.5">Виконавець</div>
              <div className="font-medium">{task.assignee_name || task.assigned_to || '—'}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500 mb-0.5">Дедлайн</div>
              <div className="font-medium">{task.due_date ? new Date(task.due_date).toLocaleDateString('uk-UA') : '—'}</div>
            </div>
          </div>

          {(task.order_number || task.damage_id) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {task.order_number && <Badge tone="blue">🔗 {task.order_number}</Badge>}
              {task.damage_id && (
                <button onClick={() => onNavigateToDamage?.(task.damage_id!)} className="text-rose-600 text-sm underline">
                  ⚠️ {task.damage_case_number || task.damage_id}
                </button>
              )}
            </div>
          )}

          {/* Assignee Change */}
          <div className="mb-4 p-3 bg-slate-50 rounded-lg">
            <div className="text-xs text-slate-500 mb-1.5">Змінити виконавця</div>
            <div className="flex gap-2">
              <select value={assigneeId || ''} onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : null)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                <option value="">Не призначено</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
              <button onClick={handleSaveAssignee} className="px-3 py-1.5 bg-corp-primary text-white rounded-lg text-sm font-medium">Зберегти</button>
            </div>
          </div>

          {/* Status Actions */}
          <div className="border-t border-slate-200 pt-4">
            <div className="text-sm text-slate-600 mb-2">Змінити статус:</div>
            <div className="flex flex-wrap gap-2">
              {task.status !== 'todo' && (
                <button onClick={() => onStatusChange(task.id, 'todo')} className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700">📋 До виконання</button>
              )}
              {task.status !== 'in_progress' && (
                <button onClick={() => onStatusChange(task.id, 'in_progress')} className="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">🔄 В роботу</button>
              )}
              {task.status !== 'done' && (
                <button onClick={() => onStatusChange(task.id, 'done')} className="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">✅ Завершити</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/*************** Create Task Modal ***************/
function CreateTaskModal({ onClose, onSuccess, prefilledData, staff }: { onClose: () => void; onSuccess: () => void; prefilledData?: any; staff: StaffMember[] }) {
  const [formData, setFormData] = useState({
    title: '', description: '', task_type: 'general' as TaskType, priority: 'medium' as TaskPriority,
    assigned_to_id: null as number | null, due_date: '', order_number: prefilledData?.orderNumber || '', damage_id: prefilledData?.damageId || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await tasksAPI.create({
        ...formData,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : undefined,
        order_number: formData.order_number || undefined,
        damage_id: formData.damage_id || undefined,
      })
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error creating task:', error)
      alert('Помилка створення завдання')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto safe-area-bottom" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">➕ Нове завдання</h2>
            <button type="button" onClick={onClose} className="text-slate-400 text-2xl">×</button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Назва *</label>
              <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Наприклад: Підготувати до видачі" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Опис</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Тип</label>
                <select value={formData.task_type} onChange={(e) => setFormData({ ...formData, task_type: e.target.value as TaskType })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="general">📝 Загальне</option>
                  <option value="packing">📦 Комплектація</option>
                  <option value="washing">💧 Мийка</option>
                  <option value="restoration">🔧 Реставрація</option>
                  <option value="reaudit">🔍 Переоблік</option>
                  <option value="return">↩️ Повернення</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Пріоритет</label>
                <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="low">⚪ Низький</option>
                  <option value="medium">🟡 Середній</option>
                  <option value="high">🔴 Високий</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Виконавець</label>
                <select value={formData.assigned_to_id || ''} onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Не обрано</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Дедлайн</label>
                <input type="datetime-local" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Замовлення</label>
                <input type="text" value={formData.order_number} onChange={(e) => setFormData({ ...formData, order_number: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="ORD-6937" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Кейс шкоди</label>
                <input type="text" value={formData.damage_id} onChange={(e) => setFormData({ ...formData, damage_id: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="DMG-001" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button type="submit" className="flex-1 bg-emerald-600 text-white rounded-lg py-2.5 font-medium">✅ Створити</button>
            <button type="button" onClick={onClose} className="px-4 bg-slate-200 text-slate-700 rounded-lg py-2.5 font-medium">Скасувати</button>
          </div>
        </form>
      </div>
    </div>
  )
}
