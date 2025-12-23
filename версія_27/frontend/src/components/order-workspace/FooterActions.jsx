/* eslint-disable */
import React from 'react'
import { getStatusConfig } from './statusConfig'

/**
 * FooterActions - Фіксований футер з діями (Zone D)
 */
export default function FooterActions({
  status,
  onPrimaryAction,
  onSecondaryAction,
  onSave,
  primaryLabel,        // Override primary action label
  primaryDisabled = false,
  primaryDisabledReason,
  saving = false,
  showSave = true,
  additionalActions = [], // [{ label, onClick, variant }]
  children,            // Кастомний контент зліва
}) {
  const config = getStatusConfig(status)
  const effectivePrimaryLabel = primaryLabel || config.primaryAction
  
  return (
    <div className="sticky bottom-0 bg-white border-t border-slate-200 shadow-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Left side - status info or custom content */}
          <div className="flex items-center gap-2 text-sm">
            {children || (
              <>
                <span className="text-slate-500">Статус:</span>
                <span className="font-medium text-slate-800">{config.title}</span>
              </>
            )}
          </div>
          
          {/* Right side - actions */}
          <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
            {/* Additional actions */}
            {additionalActions.map((action, idx) => (
              <button
                key={idx}
                onClick={action.onClick}
                disabled={action.disabled}
                className={`
                  rounded-lg border px-4 py-2 text-sm font-medium transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${action.variant === 'danger'
                    ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }
                `}
              >
                {action.label}
              </button>
            ))}
            
            {/* Save button */}
            {showSave && onSave && (
              <button
                onClick={onSave}
                disabled={saving}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {saving ? '⏳ Збереження...' : '💾 Зберегти'}
              </button>
            )}
            
            {/* Primary action */}
            {effectivePrimaryLabel && onPrimaryAction && (
              <button
                onClick={onPrimaryAction}
                disabled={primaryDisabled || saving}
                title={primaryDisabledReason}
                className={`
                  rounded-lg px-4 py-2 text-sm font-medium transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${primaryDisabled 
                    ? 'bg-slate-400 text-white cursor-not-allowed' 
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                  }
                `}
              >
                {effectivePrimaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
