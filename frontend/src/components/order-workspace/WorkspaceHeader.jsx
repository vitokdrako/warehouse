/* eslint-disable */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TonePill from './TonePill'
import { getStatusConfig } from './statusConfig'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * WorkspaceHeader - Компактний sticky хедер з collapse функціоналом
 * Mobile: 1 рядок (назва + чіп), деталі в expandable блок
 * Desktop: повна версія
 */
export default function WorkspaceHeader({
  orderId,
  orderNumber,
  status,
  issueDate,
  returnDate,
  createdAt,
  title,
  backUrl = '/manager',
}) {
  const navigate = useNavigate()
  const config = getStatusConfig(status)
  const [expanded, setExpanded] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  
  // Відстеження скролу для компактного хедера
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
  }
  
  const calculateDays = () => {
    if (!issueDate || !returnDate) return null
    const start = new Date(issueDate)
    const end = new Date(returnDate)
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    return days > 0 ? days : 1
  }
  
  const rentalDays = calculateDays()
  
  return (
    <div className={`
      bg-white border-b border-slate-200 sticky top-0 z-30 transition-all duration-200
      ${scrolled ? 'shadow-md' : ''}
    `}>
      <div className="mx-auto max-w-7xl px-3 sm:px-6">
        {/* Mobile: компактний 1-рядковий хедер */}
        <div className="flex items-center justify-between py-2 sm:py-3 gap-2">
          {/* Назад */}
          <button 
            onClick={() => navigate(backUrl)}
            className="flex-shrink-0 p-1.5 -ml-1.5 rounded-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200"
          >
            <span className="text-lg">←</span>
          </button>
          
          {/* Центр: Назва + статус */}
          <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
            <h1 className={`font-bold text-slate-900 truncate transition-all ${scrolled ? 'text-sm' : 'text-base sm:text-xl'}`}>
              {title || `#${orderNumber || orderId}`}
            </h1>
            <TonePill tone={config.tone} icon={config.icon} compact>
              {scrolled ? '' : config.title}
            </TonePill>
          </div>
          
          {/* Info кнопка для розкриття деталей (mobile) */}
          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 p-1.5 -mr-1.5 rounded-lg text-slate-500 hover:bg-slate-100 active:bg-slate-200 sm:hidden"
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </button>
          
          {/* Desktop: показуємо дати inline */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
              <span className="text-slate-500">Дати: </span>
              <span className="font-medium text-slate-800">
                {formatDate(issueDate)} — {formatDate(returnDate)}
                {rentalDays && <span className="text-slate-500"> • {rentalDays}д</span>}
              </span>
            </div>
          </div>
        </div>
        
        {/* Expandable details (mobile) */}
        <div className={`
          overflow-hidden transition-all duration-200 sm:hidden
          ${expanded ? 'max-h-32 pb-3' : 'max-h-0'}
        `}>
          <div className="flex flex-wrap gap-2 pt-1">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
              <span className="text-slate-500">Дати: </span>
              <span className="font-medium">{formatDate(issueDate)} — {formatDate(returnDate)}</span>
              {rentalDays && <span className="text-slate-400"> • {rentalDays}д</span>}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
              <span className="text-slate-500">Статус: </span>
              <span className="font-medium">{config.mode}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
