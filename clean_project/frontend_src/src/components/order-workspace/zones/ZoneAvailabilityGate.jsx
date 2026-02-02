/* eslint-disable */
import React from 'react'
import ZoneCard from '../ZoneCard'
import TonePill from '../TonePill'

/**
 * Zone: Availability Gate - Перевірка доступності
 * Для статусу: WAITING_CONFIRMATION
 */
export default function ZoneAvailabilityGate({
  conflicts = [],    // [{ sku, name, type, level, available, requested }]
  isChecking = false,
  hasItems = false,
  hasDates = false,
  onCheckConflicts,
}) {
  const hasConflicts = conflicts.length > 0
  const hasErrors = conflicts.some(c => c.level === 'error')
  
  const tone = isChecking ? 'info' : hasErrors ? 'danger' : hasConflicts ? 'warn' : 'ok'
  
  const getConflictLabel = (type) => {
    const labels = {
      'out_of_stock': '🔴 Немає на складі',
      'insufficient': '❌ Недостатньо',
      'tight_schedule': '⚠️ Щільний графік',
      'low_stock': '📦 Малий запас',
    }
    return labels[type] || type
  }
  
  return (
    <ZoneCard
      title="📊 Доступність товарів"
      hint="Перевірка конфліктів та доступності на вказані дати"
      tone={tone}
      actions={onCheckConflicts ? [
        { label: '🔄 Перевірити', onClick: onCheckConflicts, disabled: isChecking }
      ] : []}
    >
      {isChecking ? (
        <div className="text-center py-4 text-blue-600">
          <span className="animate-pulse">Перевірка доступності...</span>
        </div>
      ) : !hasItems ? (
        <div className="text-center py-4 text-slate-400">
          Додайте товари для перевірки
        </div>
      ) : !hasDates ? (
        <div className="text-center py-4 text-slate-400">
          Вкажіть дати оренди
        </div>
      ) : hasConflicts ? (
        <div className="space-y-2">
          {conflicts.map((conflict, idx) => (
            <div 
              key={idx}
              className={`rounded-lg border p-3 text-sm ${
                conflict.level === 'error' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-800">
                    {conflict.sku} — {conflict.name}
                  </div>
                  <div className="text-xs mt-1">
                    <TonePill tone={conflict.level === 'error' ? 'danger' : 'warn'}>
                      {getConflictLabel(conflict.type)}
                    </TonePill>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div>Доступно: <b>{conflict.available || 0}</b></div>
                  <div>Запитано: <b>{conflict.requested || 0}</b></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-emerald-600">
          ✅ Всі товари доступні на вказані дати
        </div>
      )}
    </ZoneCard>
  )
}
