/* eslint-disable */
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import ZoneCard from '../ZoneCard'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

/**
 * Zone: Requisitors - Вибір комплектувальників (реквізиторів)
 * Дозволяє обрати кількох працівників для комплектації
 */
export default function ZoneRequisitors({
  selectedIds = [],
  onSelectionChange,
  readOnly = false,
  title = "👷 Комплектувальники",
  hint = "Оберіть хто займається комплектацією"
}) {
  const [requisitors, setRequisitors] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadRequisitors()
  }, [])
  
  const loadRequisitors = async () => {
    try {
      // Завантажуємо всіх працівників
      const response = await axios.get(`${BACKEND_URL}/api/admin/staff`)
      // API повертає { managers, requisitors, all }
      // Беремо всіх - реквізиторів та менеджерів для вибору
      const allStaff = response.data?.all || response.data?.requisitors || []
      setRequisitors(allStaff)
    } catch (err) {
      console.error('Error loading requisitors:', err)
      // Fallback список
      setRequisitors([
        { user_id: 1, full_name: 'Менеджер', role: 'manager' },
        { user_id: 2, full_name: 'Складський працівник', role: 'warehouse' },
      ])
    } finally {
      setLoading(false)
    }
  }
  
  const toggleRequisitor = (userId) => {
    if (readOnly) return
    
    const newSelection = selectedIds.includes(userId)
      ? selectedIds.filter(id => id !== userId)
      : [...selectedIds, userId]
    
    onSelectionChange?.(newSelection)
  }
  
  const selectedNames = requisitors
    .filter(r => selectedIds.includes(r.user_id))
    .map(r => r.full_name)
  
  const tone = selectedIds.length > 0 ? 'ok' : 'warn'
  
  return (
    <ZoneCard
      title={title}
      hint={selectedIds.length > 0 ? `Обрано: ${selectedNames.join(', ')}` : hint}
      tone={tone}
    >
      {loading ? (
        <div className="text-center py-4 text-slate-400">Завантаження...</div>
      ) : requisitors.length === 0 ? (
        <div className="text-center py-4 text-slate-400">Немає доступних працівників</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {requisitors.map((person) => {
            const isSelected = selectedIds.includes(person.user_id)
            const roleLabel = {
              'requisitor': '📦',
              'warehouse': '🏭',
              'manager': '👔',
              'admin': '⚙️',
              'office_manager': '🏢'
            }[person.role] || '👤'
            
            return (
              <button
                key={person.user_id}
                onClick={() => toggleRequisitor(person.user_id)}
                disabled={readOnly}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-medium text-sm
                  transition-all duration-150
                  ${isSelected 
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-800 shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }
                  ${readOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <span>{roleLabel}</span>
                <span>{person.full_name}</span>
                {isSelected && <span className="text-emerald-600">✓</span>}
              </button>
            )
          })}
        </div>
      )}
      
      {/* Показати обраних */}
      {selectedIds.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-500 mb-1">Відповідальні за комплектацію:</div>
          <div className="font-medium text-slate-800">
            {selectedNames.join(', ')}
          </div>
        </div>
      )}
    </ZoneCard>
  )
}
