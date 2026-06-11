'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

interface BusinessTask {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  category: string | null
  assigned_to: string | null
  due_date: string | null
  order_index: number
  created_by: string | null
  created_at: string
  updated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: { key: TaskStatus; label: string; colour: string; dot: string }[] = [
  { key: 'backlog',     label: 'Backlog',     colour: 'border-border',          dot: 'bg-muted' },
  { key: 'todo',        label: 'To Do',       colour: 'border-blue-500/40',     dot: 'bg-blue-400' },
  { key: 'in_progress', label: 'In Progress', colour: 'border-yellow-500/40',   dot: 'bg-yellow-400' },
  { key: 'review',      label: 'Review',      colour: 'border-purple-500/40',   dot: 'bg-purple-400' },
  { key: 'done',        label: 'Done',        colour: 'border-green-500/40',    dot: 'bg-green-400' },
]

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; cls: string }> = {
  low:    { label: 'Low',    cls: 'bg-surface-2 text-muted' },
  medium: { label: 'Medium', cls: 'bg-blue-500/15 text-blue-400' },
  high:   { label: 'High',   cls: 'bg-orange-500/15 text-orange-400' },
  urgent: { label: 'Urgent', cls: 'bg-red-500/15 text-red-400' },
}

const CATEGORIES = ['General', 'Marketing', 'Finance', 'Operations', 'HR', 'IT', 'Admin', 'Purchasing']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOverdue(due_date: string | null) {
  if (!due_date) return false
  return new Date(due_date) < new Date(new Date().toDateString())
}

function formatDue(due_date: string | null) {
  if (!due_date) return null
  const d = new Date(due_date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── Task Modal ───────────────────────────────────────────────────────────────

interface TaskModalProps {
  task?: BusinessTask | null
  defaultStatus?: TaskStatus
  onSave: (data: Partial<BusinessTask>) => Promise<void>
  onClose: () => void
  onDelete?: () => Promise<void>
}

function TaskModal({ task, defaultStatus = 'todo', onSave, onClose, onDelete }: TaskModalProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? defaultStatus)
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium')
  const [category, setCategory] = useState(task?.category ?? '')
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to ?? '')
  const [dueDate, setDueDate] = useState(task?.due_date ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    await onSave({
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      category: category.trim() || null,
      assigned_to: assignedTo.trim() || null,
      due_date: dueDate || null,
    })
    setSaving(false)
  }

  async function handleDelete() {
    if (!onDelete) return
    if (!confirm('Delete this task?')) return
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold text-fg">{task ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Title *</label>
            <input
              className="input w-full"
              placeholder="What needs to be done?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSave()}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Description</label>
            <textarea
              className="input w-full min-h-[80px] resize-y"
              placeholder="Add more details…"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Status</label>
              <select className="input w-full" value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>
                {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Priority</label>
              <select className="input w-full" value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Category + Assigned */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Category</label>
              <input
                className="input w-full"
                list="category-options"
                placeholder="e.g. Marketing"
                value={category}
                onChange={e => setCategory(e.target.value)}
              />
              <datalist id="category-options">
                {CATEGORIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Assigned To</label>
              <input
                className="input w-full"
                placeholder="Person's name"
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
              />
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Due Date</label>
            <input
              type="date"
              className="input w-full"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex items-center justify-between gap-3">
          <div>
            {task && onDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="btn-primary text-sm"
            >
              {saving ? 'Saving…' : task ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: BusinessTask
  onEdit: (task: BusinessTask) => void
  onDragStart: (e: React.DragEvent, task: BusinessTask) => void
  isDragging: boolean
}

function TaskCard({ task, onEdit, onDragStart, isDragging }: TaskCardProps) {
  const pri = PRIORITY_CONFIG[task.priority]
  const overdue = isOverdue(task.due_date)

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, task)}
      onClick={() => onEdit(task)}
      className={cn(
        'group bg-surface-2 border border-border rounded-lg p-3 cursor-pointer',
        'hover:border-primary/40 hover:shadow-sm transition-all select-none',
        isDragging && 'opacity-40 scale-95',
        task.status === 'done' && 'opacity-60'
      )}
    >
      {/* Top row: category + priority */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {task.category && (
          <span className="text-[10px] bg-surface text-muted px-1.5 py-0.5 rounded font-medium border border-border">
            {task.category}
          </span>
        )}
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto', pri.cls)}>
          {pri.label}
        </span>
      </div>

      {/* Title */}
      <p className={cn(
        'text-sm font-medium text-fg leading-snug mb-1.5',
        task.status === 'done' && 'line-through text-muted'
      )}>
        {task.title}
      </p>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-muted line-clamp-2 mb-2">{task.description}</p>
      )}

      {/* Bottom row: assigned + due */}
      <div className="flex items-center gap-2 flex-wrap mt-auto pt-1">
        {task.assigned_to && (
          <span className="flex items-center gap-1 text-[10px] text-muted">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            {task.assigned_to}
          </span>
        )}
        {task.due_date && (
          <span className={cn(
            'flex items-center gap-1 text-[10px] ml-auto',
            overdue ? 'text-red-400 font-semibold' : 'text-muted'
          )}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
            </svg>
            {overdue ? '⚠ ' : ''}{formatDue(task.due_date)}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Kanban View ─────────────────────────────────────────────────────────────

interface KanbanViewProps {
  tasks: BusinessTask[]
  onEdit: (task: BusinessTask) => void
  onAddToColumn: (status: TaskStatus) => void
  onDrop: (status: TaskStatus, taskId: string) => void
}

function KanbanView({ tasks, onEdit, onAddToColumn, onDrop }: KanbanViewProps) {
  const dragTaskId = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null)

  function handleDragStart(e: React.DragEvent, task: BusinessTask) {
    dragTaskId.current = task.id
    setDraggingId(task.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnd() {
    setDraggingId(null)
    setOverColumn(null)
    dragTaskId.current = null
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverColumn(status)
  }

  function handleDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault()
    if (dragTaskId.current) {
      onDrop(status, dragTaskId.current)
    }
    setDraggingId(null)
    setOverColumn(null)
    dragTaskId.current = null
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-220px)]">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.key)
        const isOver = overColumn === col.key
        return (
          <div
            key={col.key}
            onDragOver={e => handleDragOver(e, col.key)}
            onDragLeave={() => setOverColumn(null)}
            onDrop={e => handleDrop(e, col.key)}
            className={cn(
              'flex-shrink-0 w-72 flex flex-col rounded-xl border-2 transition-colors',
              col.colour,
              isOver ? 'bg-primary/5' : 'bg-surface/50'
            )}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', col.dot)} />
                <span className="text-sm font-semibold text-fg">{col.label}</span>
                <span className="text-xs text-muted bg-surface-2 px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
              </div>
              <button
                onClick={() => onAddToColumn(col.key)}
                className="text-muted hover:text-primary transition-colors"
                title={`Add task to ${col.label}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><path d="M12 5v14"/>
                </svg>
              </button>
            </div>

            {/* Cards */}
            <div
              className="flex-1 p-2 space-y-2 overflow-y-auto"
              onDragEnd={handleDragEnd}
            >
              {colTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={onEdit}
                  onDragStart={handleDragStart}
                  isDragging={draggingId === task.id}
                />
              ))}
              {colTasks.length === 0 && (
                <div className={cn(
                  'text-center py-8 rounded-lg border-2 border-dashed text-muted text-xs transition-colors',
                  isOver ? 'border-primary/50 text-primary' : 'border-border'
                )}>
                  {isOver ? 'Drop here' : 'No tasks'}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Todo List View ───────────────────────────────────────────────────────────

interface TodoViewProps {
  tasks: BusinessTask[]
  onEdit: (task: BusinessTask) => void
  onToggleDone: (task: BusinessTask) => Promise<void>
  filter: string
  onFilterChange: (f: string) => void
}

function TodoView({ tasks, onEdit, onToggleDone, filter, onFilterChange }: TodoViewProps) {
  const activeTasks = tasks.filter(t => t.status !== 'done')
  const doneTasks = tasks.filter(t => t.status === 'done')

  const filterFn = (t: BusinessTask) => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      t.title.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q) ||
      (t.category ?? '').toLowerCase().includes(q) ||
      (t.assigned_to ?? '').toLowerCase().includes(q)
    )
  }

  const filteredActive = activeTasks.filter(filterFn)
  const filteredDone = doneTasks.filter(filterFn)

  const sortedActive = [...filteredActive].sort((a, b) => {
    const pOrder: TaskPriority[] = ['urgent', 'high', 'medium', 'low']
    const pDiff = pOrder.indexOf(a.priority) - pOrder.indexOf(b.priority)
    if (pDiff !== 0) return pDiff
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    if (a.due_date) return -1
    if (b.due_date) return 1
    return 0
  })

  function TodoRow({ task }: { task: BusinessTask }) {
    const pri = PRIORITY_CONFIG[task.priority]
    const overdue = isOverdue(task.due_date)
    const done = task.status === 'done'

    return (
      <div className={cn(
        'flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors group',
        done ? 'bg-surface/50 opacity-60' : 'bg-surface-2'
      )}>
        {/* Checkbox */}
        <button
          onClick={() => onToggleDone(task)}
          className={cn(
            'mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
            done
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-border hover:border-primary'
          )}
        >
          {done && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(task)}>
          <p className={cn('text-sm font-medium text-fg', done && 'line-through text-muted')}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-muted mt-0.5 line-clamp-1">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {task.category && (
              <span className="text-[10px] text-muted bg-surface px-1.5 py-0.5 rounded border border-border">{task.category}</span>
            )}
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', pri.cls)}>{pri.label}</span>
            {task.assigned_to && (
              <span className="text-[10px] text-muted">→ {task.assigned_to}</span>
            )}
            {task.due_date && (
              <span className={cn('text-[10px] ml-auto', overdue ? 'text-red-400 font-semibold' : 'text-muted')}>
                {overdue ? '⚠ Overdue · ' : ''}{formatDue(task.due_date)}
              </span>
            )}
          </div>
        </div>

        {/* Status badge */}
        <span className="text-[10px] text-muted hidden sm:block flex-shrink-0 mt-0.5">
          {COLUMNS.find(c => c.key === task.status)?.label}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Filter */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          className="input pl-9 w-full"
          placeholder="Search tasks…"
          value={filter}
          onChange={e => onFilterChange(e.target.value)}
        />
      </div>

      {/* Active tasks */}
      {sortedActive.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">
            Active · {sortedActive.length}
          </h3>
          {sortedActive.map(t => <TodoRow key={t.id} task={t} />)}
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-muted">🎉 All done! No active tasks.</p>
        </div>
      )}

      {/* Done tasks */}
      {filteredDone.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">
            Completed · {filteredDone.length}
          </h3>
          {filteredDone.map(t => <TodoRow key={t.id} task={t} />)}
        </div>
      )}
    </div>
  )
}

// ─── Main Board Component ─────────────────────────────────────────────────────

export default function BusinessBoard() {
  const [tasks, setTasks] = useState<BusinessTask[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'kanban' | 'todo'>('kanban')
  const [modal, setModal] = useState<{ open: boolean; task?: BusinessTask | null; defaultStatus?: TaskStatus }>({ open: false })
  const [todoFilter, setTodoFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/business-tasks')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setTasks(json.tasks)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(data: Partial<BusinessTask>) {
    if (modal.task) {
      // Update
      const res = await fetch(`/api/business-tasks/${modal.task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (json.task) {
        setTasks(prev => prev.map(t => t.id === json.task.id ? json.task : t))
      }
    } else {
      // Create
      const res = await fetch('/api/business-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, status: data.status ?? modal.defaultStatus ?? 'todo' }),
      })
      const json = await res.json()
      if (json.task) {
        setTasks(prev => [...prev, json.task])
      }
    }
    setModal({ open: false })
  }

  async function handleDelete() {
    if (!modal.task) return
    await fetch(`/api/business-tasks/${modal.task.id}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== modal.task!.id))
    setModal({ open: false })
  }

  async function handleDrop(newStatus: TaskStatus, taskId: string) {
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    await fetch(`/api/business-tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  async function handleToggleDone(task: BusinessTask) {
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done'
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    await fetch(`/api/business-tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  // Stats
  const total = tasks.length
  const done = tasks.filter(t => t.status === 'done').length
  const urgent = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length
  const overdue = tasks.filter(t => isOverdue(t.due_date) && t.status !== 'done').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-400 mb-3">{error}</p>
        <button onClick={load} className="btn-secondary text-sm">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-fg">Business Board</h1>
          <p className="text-muted text-sm mt-0.5">
            {total - done} active task{total - done !== 1 ? 's' : ''} · {done} completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-surface-2 rounded-lg p-1 gap-1 border border-border">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                view === 'kanban' ? 'bg-primary text-white' : 'text-muted hover:text-fg'
              )}
            >
              Kanban
            </button>
            <button
              onClick={() => setView('todo')}
              className={cn(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                view === 'todo' ? 'bg-primary text-white' : 'text-muted hover:text-fg'
              )}
            >
              To-Do List
            </button>
          </div>
          <button
            onClick={() => setModal({ open: true, task: null })}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            Add Task
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-xs text-muted">Total Tasks</p>
          <p className="text-2xl font-bold text-fg mt-1">{total}</p>
        </div>
        <div className="card">
          <p className="text-xs text-muted">Completed</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{done}</p>
          {total > 0 && <p className="text-xs text-muted mt-0.5">{Math.round((done / total) * 100)}%</p>}
        </div>
        <div className="card">
          <p className="text-xs text-muted">Urgent</p>
          <p className={cn('text-2xl font-bold mt-1', urgent > 0 ? 'text-red-400' : 'text-fg')}>{urgent}</p>
        </div>
        <div className="card">
          <p className="text-xs text-muted">Overdue</p>
          <p className={cn('text-2xl font-bold mt-1', overdue > 0 ? 'text-orange-400' : 'text-fg')}>{overdue}</p>
        </div>
      </div>

      {/* Board / List */}
      {view === 'kanban' ? (
        <KanbanView
          tasks={tasks}
          onEdit={task => setModal({ open: true, task })}
          onAddToColumn={status => setModal({ open: true, task: null, defaultStatus: status })}
          onDrop={handleDrop}
        />
      ) : (
        <TodoView
          tasks={tasks}
          onEdit={task => setModal({ open: true, task })}
          onToggleDone={handleToggleDone}
          filter={todoFilter}
          onFilterChange={setTodoFilter}
        />
      )}

      {/* Task Modal */}
      {modal.open && (
        <TaskModal
          task={modal.task}
          defaultStatus={modal.defaultStatus}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
          onDelete={modal.task ? handleDelete : undefined}
        />
      )}
    </div>
  )
}
