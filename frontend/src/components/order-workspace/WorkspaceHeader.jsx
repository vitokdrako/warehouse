/* eslint-disable */
import React from 'react'
import { useNavigate } from 'react-router-dom'
import TonePill from './TonePill'
import { getStatusConfig } from './statusConfig'

/**
 * WorkspaceHeader - Фіксований заголовок (Zone A)
 * 
 * ┌─────────────────────────────────────────────────────────────┐
 * │ ← Назад   Order Workspace                                  │
 * │ Замовлення #ID        [Status Badge]     Дати • Таймлайн  │
 * └─────────────────────────────────────────────────────────────┘
 */
export default function WorkspaceHeader({
  orderId,
  orderNumber,
  status,           // backend status string
  issueDate,
  returnDate,
  createdAt,
  title,            // Опціональний кастомний заголовок
  backUrl = '/manager',
}) {
  const navigate = useNavigate()
  const config = getStatusConfig(status)
  
  // Форматування дати
  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
  }
  
  // Розрахунок днів оренди
  const calculateDays = () => {
    if (!issueDate || !returnDate) return null
    const start = new Date(issueDate)
    const end = new Date(returnDate)
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    return days > 0 ? days : 1
  }
  
  const rentalDays = calculateDays()
  
  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
        {/* Top row - Back button */}
        <div className="flex items-center gap-4 mb-3">
          <button 
            onClick={() => navigate(backUrl)}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            <span>←</span>
            <span>Назад</span>
          </button>
          <div className="text-sm text-slate-400">Order Workspace</div>
        </div>
        
        {/* Main row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Left: Title + Status */}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {title || `Замовлення #${orderNumber || orderId}`}
            </h1>
            <TonePill tone={config.tone} icon={config.icon}>
              {config.title}
            </TonePill>
          </div>
          
          {/* Right: Dates */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="text-xs text-slate-500">Дати</div>
              <div className="font-medium text-slate-800">
                {formatDate(issueDate)} — {formatDate(returnDate)}
                {rentalDays && <span className="text-slate-500"> • {rentalDays} дн.</span>}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="text-xs text-slate-500">Статус</div>
              <div className="font-medium text-slate-800">
                {config.mode}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
