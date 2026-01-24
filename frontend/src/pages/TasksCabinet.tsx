import React, { useMemo, useState, useEffect } from 'react'
import { tasksAPI } from '../api/client'
import CorporateHeader from '../components/CorporateHeader'

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
  assigned_to_id?: number  // ✅ user_id
  assignee_name?: string   // ✅ Повне ім'я
  due_date?: string
  completed_at?: string
  created_by: string
  created_by_id?: number
  created_at: string
  updated_at: string
}

// ✅ Тип для працівника
interface StaffMember {
  id: number
  user_id: number
  username: string
  full_name: string
  role: string
}

/*************** small UI ***************/
function Badge({ tone = 'slate', children }: { tone?: string; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    blue: 'bg-sky-100 text-sky-700 border-sky-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    red: 'bg-rose-100 text-rose-700 border-rose-200',
    violet: 'bg-violet-100 text-violet-700 border-violet-200',
  }
  return (
    <span
      className={cls(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]',
        tones[tone] || tones.slate,
      )}
    >
      {children}
    </span>
  )
}

function PillButton({
  children,
  onClick,
  tone = 'slate',
}: {
  children: React.ReactNode
  onClick?: () => void
  tone?: 'slate' | 'green' | 'ghost' | 'red' | 'amber'
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-900 text-white hover:bg-slate-800',
    green: 'bg-emerald-600 text-white hover:bg-emerald-700',
    red: 'bg-rose-600 text-white hover:bg-rose-700',
    amber: 'bg-amber-500 text-corp-text-dark hover:bg-amber-600',
    ghost: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls('rounded-full px-3 py-1 text-[11px] font-medium transition', tones[tone])}
    >
      {children}
    </button>
  )
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  if (priority === 'low') return <Badge tone="slate">⚪ Низький</Badge>
  if (priority === 'medium') return <Badge tone="amber">🟡 Середній</Badge>
  return <Badge tone="red">🔴 Високий</Badge>
}

function StatusBadge({ status }: { status: TaskStatus }) {
  if (status === 'todo') return <Badge tone="slate">📋 До виконання</Badge>
  if (status === 'in_progress') return <Badge tone="blue">🔄 В роботі</Badge>
  return <Badge tone="green">✅ Виконано</Badge>
}

function TaskTypeBadge({ type }: { type: TaskType }) {
  const types: Record<TaskType, { label: string; tone: string }> = {
    packing: { label: '📦 Комплектація', tone: 'blue' },
    washing: { label: '💧 Мийка', tone: 'sky' },
    restoration: { label: '🔧 Реставрація', tone: 'violet' },
    reaudit: { label: '🔍 Переоблік', tone: 'amber' },
    return: { label: '↩️ Повернення', tone: 'green' },
    general: { label: '📝 Загальне', tone: 'slate' },
  }
  const { label, tone } = types[type] || types.general
  return <Badge tone={tone}>{label}</Badge>
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

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')

  // Pre-fill form if coming from another cabinet
  const [prefilledData, setPrefilledData] = useState(initialContext || {})

  // Load tasks
  const loadTasks = async () => {
    try {
      setLoading(true)
      const data = await tasksAPI.getAll()
      setTasks(data)
    } catch (error) {
      console.error('Error loading tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        !searchQuery ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.assigned_to?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = filterStatus === 'all' || task.status === filterStatus
      const matchesType = filterType === 'all' || task.task_type === filterType
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority

      return matchesSearch && matchesStatus && matchesType && matchesPriority
    })
  }, [tasks, searchQuery, filterStatus, filterType, filterPriority])

  // Group tasks by status for Kanban view
  const tasksByStatus = useMemo(() => {
    return {
      todo: filteredTasks.filter((t) => t.status === 'todo'),
      in_progress: filteredTasks.filter((t) => t.status === 'in_progress'),
      done: filteredTasks.filter((t) => t.status === 'done'),
    }
  }, [filteredTasks])

  // Update task status
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const updatedTask = await tasksAPI.update(taskId, { status: newStatus })
      setTasks(tasks.map((t) => (t.id === taskId ? updatedTask : t)))
      if (selectedTask?.id === taskId) {
        setSelectedTask(updatedTask)
      }
    } catch (error) {
      console.error('Error updating task status:', error)
      alert('Помилка оновлення статусу')
    }
  }

  // Update task assignee
  const handleAssigneeChange = async (taskId: string, assignee: string) => {
    try {
      const updatedTask = await tasksAPI.update(taskId, { assigned_to: assignee })
      setTasks(tasks.map((t) => (t.id === taskId ? updatedTask : t)))
      if (selectedTask?.id === taskId) {
        setSelectedTask(updatedTask)
      }
    } catch (error) {
      console.error('Error updating assignee:', error)
      alert('Помилка призначення виконавця')
    }
  }

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Check if overdue
  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === 'done') return false
    return new Date(task.due_date) < new Date()
  }

  return (
    <div className="min-h-screen bg-corp-bg-main">
      <CorporateHeader cabinetName="Кабінет завдань" showBackButton={true} onBackClick={onBackToDashboard} />
      
      <div className="mx-auto max-w-7xl p-6 space-y-4">
        {/* Header with create button */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-corp-text-dark">Управління завданнями</h2>
          <PillButton tone="green" onClick={() => setShowCreateModal(true)}>
            ➕ Нове завдання
          </PillButton>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <div className="corp-card">
            <div className="text-xs text-corp-text-muted mb-1">Всього завдань</div>
            <div className="text-2xl font-bold text-corp-text-dark">{tasks.length}</div>
          </div>
          <div className="corp-card">
            <div className="text-xs text-corp-text-muted mb-1">До виконання</div>
            <div className="text-2xl font-bold text-corp-text-main">{tasksByStatus.todo.length}</div>
          </div>
          <div className="corp-card">
            <div className="text-xs text-blue-600 mb-1">В роботі</div>
            <div className="text-2xl font-bold text-blue-600">{tasksByStatus.in_progress.length}</div>
          </div>
          <div className="corp-card">
            <div className="text-xs text-emerald-600 mb-1">Виконано</div>
            <div className="text-2xl font-bold text-emerald-600">{tasksByStatus.done.length}</div>
          </div>
          <div className="corp-card border-rose-200">
            <div className="text-xs text-rose-600 mb-1">Прострочено</div>
            <div className="text-2xl font-bold text-rose-600">
              {tasks.filter((t) => isOverdue(t)).length}
            </div>
          </div>
        </div>

      {/* Filters */}
        <div className="corp-card">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-corp-text-main mb-1">Пошук</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Назва, опис, виконавець..."
                className="w-full rounded-corp border border-corp-border px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-corp-text-main mb-1">Статус</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-corp border border-corp-border px-3 py-1.5 text-sm"
              >
                <option value="all">Всі</option>
                <option value="todo">До виконання</option>
                <option value="in_progress">В роботі</option>
                <option value="done">Виконано</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-corp-text-main mb-1">Тип</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full rounded-corp border border-corp-border px-3 py-1.5 text-sm"
              >
                <option value="all">Всі типи</option>
                <option value="packing">Комплектація</option>
                <option value="washing">Мийка</option>
                <option value="restoration">Реставрація</option>
                <option value="reaudit">Переоблік</option>
                <option value="return">Повернення</option>
                <option value="general">Загальне</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-corp-text-main mb-1">Пріоритет</label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="w-full rounded-corp border border-corp-border px-3 py-1.5 text-sm"
              >
                <option value="all">Всі</option>
                <option value="high">Високий</option>
                <option value="medium">Середній</option>
                <option value="low">Низький</option>
              </select>
            </div>
          </div>
        </div>

      {/* Kanban Board */}
        <div className="grid grid-cols-3 gap-4">
          {/* Todo Column */}
          <div className="bg-slate-100 rounded-corp p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700">📋 До виконання</h3>
              <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                {tasksByStatus.todo.length}
              </span>
            </div>
            <div className="space-y-3">
              {tasksByStatus.todo.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isOverdue={isOverdue(task)}
                  onClick={() => setSelectedTask(task)}
                  onStatusChange={handleStatusChange}
                />
              ))}
              {tasksByStatus.todo.length === 0 && (
                <div className="text-center text-sm text-slate-400 py-8">Немає завдань</div>
              )}
            </div>
          </div>

          {/* In Progress Column */}
          <div className="bg-blue-50 rounded-corp p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-blue-700">🔄 В роботі</h3>
              <span className="text-xs bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full">
                {tasksByStatus.in_progress.length}
              </span>
            </div>
            <div className="space-y-3">
              {tasksByStatus.in_progress.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isOverdue={isOverdue(task)}
                  onClick={() => setSelectedTask(task)}
                  onStatusChange={handleStatusChange}
                />
              ))}
              {tasksByStatus.in_progress.length === 0 && (
                <div className="text-center text-sm text-slate-400 py-8">Немає завдань</div>
              )}
            </div>
          </div>

          {/* Done Column */}
          <div className="bg-emerald-50 rounded-corp p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-emerald-700">✅ Виконано</h3>
              <span className="text-xs bg-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full">
                {tasksByStatus.done.length}
              </span>
            </div>
            <div className="space-y-3">
              {tasksByStatus.done.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isOverdue={false}
                  onClick={() => setSelectedTask(task)}
                  onStatusChange={handleStatusChange}
                />
              ))}
              {tasksByStatus.done.length === 0 && (
                <div className="text-center text-sm text-slate-400 py-8">Немає завдань</div>
              )}
            </div>
          </div>
        </div>

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusChange}
          onAssigneeChange={handleAssigneeChange}
          onUpdate={loadTasks}
          onNavigateToDamage={onNavigateToDamage}
        />
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal 
          onClose={() => setShowCreateModal(false)} 
          onSuccess={loadTasks}
          prefilledData={prefilledData}
        />
      )}
      </div>
    </div>
  )
}

/*************** Task Card ***************/
function TaskCard({
  task,
  isOverdue,
  onClick,
  onStatusChange,
}: {
  task: Task
  isOverdue: boolean
  onClick: () => void
  onStatusChange: (id: string, status: TaskStatus) => void
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:shadow-md transition"
    >
      {isOverdue && (
        <div className="mb-2">
          <Badge tone="red">⏰ Прострочено</Badge>
        </div>
      )}
      <div className="flex items-start gap-2 mb-2">
        <PriorityBadge priority={task.priority} />
        <TaskTypeBadge type={task.task_type} />
      </div>
      <h4 className="font-semibold text-sm text-corp-text-dark mb-1">{task.title}</h4>
      {task.description && (
        <p className="text-xs text-corp-text-main mb-2 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between text-xs text-corp-text-muted">
        <div>{task.assigned_to || '👤 Не призначено'}</div>
        {task.due_date && (
          <div className={isOverdue ? 'text-rose-600 font-medium' : ''}>
            📅 {new Date(task.due_date).toLocaleDateString('uk-UA')}
          </div>
        )}
      </div>
      {task.order_number && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <span className="text-xs text-blue-600">🔗 {task.order_number}</span>
        </div>
      )}
      {task.damage_id && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <span className="text-xs text-rose-600">⚠️ {task.damage_case_number || task.damage_id}</span>
        </div>
      )}
    </div>
  )
}

/*************** Task Details Modal ***************/
function TaskDetailsModal({
  task,
  onClose,
  onStatusChange,
  onAssigneeChange,
  onUpdate,
  onNavigateToDamage,
}: {
  task: Task
  onClose: () => void
  onStatusChange: (id: string, status: TaskStatus) => void
  onAssigneeChange: (id: string, assignee: string) => void
  onUpdate: () => void
  onNavigateToDamage?: (damageId: string) => void
}) {
  const [assignee, setAssignee] = useState(task.assigned_to || '')

  const handleSaveAssignee = () => {
    onAssigneeChange(task.id, assignee)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-corp-text-dark mb-2">{task.title}</h2>
              <div className="flex items-center gap-2 mb-3">
                <PriorityBadge priority={task.priority} />
                <TaskTypeBadge type={task.task_type} />
                <StatusBadge status={task.status} />
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-corp-text-main text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Description */}
          {task.description && (
            <div className="mb-4 p-4 bg-slate-50 rounded-lg">
              <div className="text-xs text-corp-text-main mb-1">Опис:</div>
              <div className="text-sm text-corp-text-dark">{task.description}</div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-corp-text-main mb-1">ID завдання</div>
              <div className="text-sm font-mono text-corp-text-dark">{task.id}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-corp-text-main mb-1">Створено</div>
              <div className="text-sm text-corp-text-dark">
                {new Date(task.created_at).toLocaleDateString('uk-UA')}
              </div>
            </div>
            {task.due_date && (
              <div className="p-3 bg-amber-50 rounded-lg">
                <div className="text-xs text-amber-800 mb-1">Термін виконання</div>
                <div className="text-sm font-medium text-amber-900">
                  {new Date(task.due_date).toLocaleString('uk-UA')}
                </div>
              </div>
            )}
            {task.completed_at && (
              <div className="p-3 bg-emerald-50 rounded-lg">
                <div className="text-xs text-emerald-800 mb-1">Завершено</div>
                <div className="text-sm font-medium text-emerald-900">
                  {new Date(task.completed_at).toLocaleString('uk-UA')}
                </div>
              </div>
            )}
            {task.order_number && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-xs text-blue-800 mb-1">Номер замовлення</div>
                <div className="text-sm font-medium text-blue-900">{task.order_number}</div>
              </div>
            )}
            {task.damage_id && (
              <div className="p-3 bg-rose-50 rounded-lg">
                <div className="text-xs text-rose-800 mb-1">ID кейсу шкоди</div>
                <div className="text-sm font-medium text-rose-900">
                  {task.damage_case_number || task.damage_id}
                </div>
              </div>
            )}
          </div>

          {/* Assignee */}
          <div className="mb-4">
            <label className="block text-sm text-slate-700 mb-2">Виконавець</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Ім'я виконавця"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <PillButton tone="green" onClick={handleSaveAssignee}>
                Зберегти
              </PillButton>
            </div>
          </div>

          {/* Navigation Actions */}
          {task.damage_id && (
            <div className="border-t border-slate-200 pt-4">
              <div className="text-sm text-slate-700 mb-3">Пов'язані записи:</div>
              <div className="flex gap-2">
                {onNavigateToDamage && (
                  <PillButton tone="ghost" onClick={() => {
                    onNavigateToDamage(task.damage_id!)
                    onClose()
                  }}>
                    ⚠️ Перейти до кейсу {task.damage_case_number || task.damage_id}
                  </PillButton>
                )}
              </div>
            </div>
          )}
          
          {/* Show order info if exists (but no navigation for requisitioner) */}
          {task.order_number && (
            <div className="border-t border-slate-200 pt-4">
              <div className="text-sm text-slate-700 mb-2">Пов'язане замовлення:</div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900">
                📦 {task.order_number} (менеджерський кабінет)
              </div>
            </div>
          )}

          {/* Status Actions */}
          <div className="border-t border-slate-200 pt-4">
            <div className="text-sm text-slate-700 mb-3">Змінити статус:</div>
            <div className="flex gap-2">
              {task.status !== 'todo' && (
                <PillButton tone="ghost" onClick={() => onStatusChange(task.id, 'todo')}>
                  📋 До виконання
                </PillButton>
              )}
              {task.status !== 'in_progress' && (
                <PillButton tone="amber" onClick={() => onStatusChange(task.id, 'in_progress')}>
                  🔄 В роботу
                </PillButton>
              )}
              {task.status !== 'done' && (
                <PillButton tone="green" onClick={() => onStatusChange(task.id, 'done')}>
                  ✅ Завершити
                </PillButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/*************** Create Task Modal ***************/
function CreateTaskModal({ 
  onClose, 
  onSuccess, 
  prefilledData 
}: { 
  onClose: () => void
  onSuccess: () => void
  prefilledData?: any
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: 'general' as TaskType,
    priority: 'medium' as TaskPriority,
    assigned_to: '',
    due_date: '',
    order_number: prefilledData?.orderNumber || '',
    damage_id: prefilledData?.damageId || '',
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-corp-text-dark">➕ Нове завдання</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-corp-text-main text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-700 mb-1">Назва завдання *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Наприклад: Підготувати замовлення до видачі"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-700 mb-1">Опис</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Детальний опис завдання..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-700 mb-1">Тип завдання</label>
                <select
                  value={formData.task_type}
                  onChange={(e) => setFormData({ ...formData, task_type: e.target.value as TaskType })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="general">Загальне</option>
                  <option value="packing">Комплектація</option>
                  <option value="washing">Мийка</option>
                  <option value="restoration">Реставрація</option>
                  <option value="reaudit">Переоблік</option>
                  <option value="return">Повернення</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1">Пріоритет</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="low">Низький</option>
                  <option value="medium">Середній</option>
                  <option value="high">Високий</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-700 mb-1">Виконавець</label>
                <input
                  type="text"
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Ім'я виконавця"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1">Термін виконання</label>
                <input
                  type="datetime-local"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-700 mb-1">Номер замовлення (опціонально)</label>
                <input
                  type="text"
                  value={formData.order_number}
                  onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="ORD-6937"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1">ID кейсу шкоди (опціонально)</label>
                <input
                  type="text"
                  value={formData.damage_id}
                  onChange={(e) => setFormData({ ...formData, damage_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="DMG-001"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="flex-1 bg-emerald-600 text-white rounded-lg py-2 font-medium hover:bg-emerald-700 transition"
            >
              ✅ Створити завдання
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 bg-slate-200 text-slate-700 rounded-lg py-2 font-medium hover:bg-slate-300 transition"
            >
              Скасувати
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
