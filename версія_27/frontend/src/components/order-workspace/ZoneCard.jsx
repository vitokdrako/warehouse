/* eslint-disable */
import React from 'react'
import TonePill from './TonePill'

/**
 * ZoneCard - Уніфікована картка зони в Workspace
 * 
 * Структура:
 * ┌────────────────────────────────────────┐
 * │ Title                    [TonePill]   │
 * │ hint/description                       │
 * │                                        │
 * │ {children - content}                   │
 * │                                        │
 * │ [CTA Button 1] [CTA Button 2]         │
 * └────────────────────────────────────────┘
 */
export default function ZoneCard({ 
  title,           // Заголовок зони
  hint,            // Підказка / опис
  tone = 'neutral', // Тон: neutral | info | ok | warn | danger
  icon,            // Іконка для badge
  children,        // Основний контент
  actions = [],    // Масив дій: [{ label, onClick, variant, disabled }]
  collapsible = false, // Чи можна згортати
  defaultCollapsed = false, // Початковий стан
  className = '',
  rightContent,    // Контент справа від заголовка
}) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)
  
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {collapsible && (
              <button 
                onClick={() => setCollapsed(!collapsed)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                {collapsed ? '▶' : '▼'}
              </button>
            )}
            <h3 className="font-semibold text-slate-800">{title}</h3>
            {tone !== 'neutral' && (
              <TonePill tone={tone} icon={icon}>
                {tone === 'ok' ? 'OK' : tone === 'warn' ? '!' : tone === 'danger' ? '!!' : tone}
              </TonePill>
            )}
          </div>
          {hint && !collapsed && (
            <p className="mt-1 text-sm text-slate-500">{hint}</p>
          )}
        </div>
        {rightContent && (
          <div className="flex-shrink-0">
            {rightContent}
          </div>
        )}
      </div>
      
      {/* Content */}
      {!collapsed && children && (
        <div className="mb-3">
          {children}
        </div>
      )}
      
      {/* Actions */}
      {!collapsed && actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={action.onClick}
              disabled={action.disabled}
              className={`
                rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                ${action.variant === 'primary' 
                  ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800' 
                  : action.variant === 'success'
                  ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                  : action.variant === 'danger'
                  ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }
              `}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
