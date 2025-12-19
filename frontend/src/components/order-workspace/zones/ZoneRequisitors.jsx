/* eslint-disable */
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import ZoneCard from '../ZoneCard'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

/**
 * Zone: Requisitors - Вибір комплектувальників (тільки реквізитори)
 * Дозволяє обрати кількох працівників для комплектації
 */
export default function ZoneRequisitors({
  selectedIds = [],
  onSelectionChange,
  readOnly = false,
  title = "Комплектувальники",
  hint = "Оберіть хто займається комплектацією"
}) {
  const [requisitors, setRequisitors] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadRequisitors()
  }, [])
  
  const loadRequisitors = async () => {
    try {
      // Завантажуємо працівників
      const response = await axios.get(`${BACKEND_URL}/api/admin/staff`)
      // Фільтруємо ТІЛЬКИ реквізиторів
      const allStaff = response.data?.all || response.data?.requisitors || []
      const onlyRequisitors = allStaff.filter(s => s.role === 'requisitor')
      setRequisitors(onlyRequisitors)
    } catch (err) {
      console.error('Error loading requisitors:', err)
      setRequisitors([])
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
        <div className="text-center py-4 text-corp-text-muted">Завантаження...</div>
      ) : requisitors.length === 0 ? (
        <div className="text-center py-4 text-corp-text-muted">Немає доступних комплектувальників</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {requisitors.map((person) => {
            const isSelected = selectedIds.includes(person.user_id)
            
            return (
              <button
                key={person.user_id}
                onClick={() => toggleRequisitor(person.user_id)}
                disabled={readOnly}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-lg border font-medium text-sm
                  transition-all duration-150
                  ${isSelected 
                    ? 'bg-corp-primary/10 border-corp-primary text-corp-primary' 
                    : 'bg-white border-corp-border text-corp-text-main hover:border-corp-primary/50 hover:bg-corp-bg-light'
                  }
                  ${readOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <span>{person.full_name}</span>
                {isSelected && <span className="text-corp-primary font-bold">✓</span>}
              </button>
            )
          })}
        </div>
      )}
      
      {/* Показати обраних - завжди якщо є */}
      {(selectedIds.length > 0 || selectedNames.length > 0) && (
        <div className="mt-3 pt-3 border-t border-corp-border">
          <div className="text-xs text-corp-text-muted mb-1">Відповідальні за комплектацію:</div>
          <div className="font-medium text-corp-text-dark">
            {selectedNames.length > 0 
              ? selectedNames.join(', ') 
              : `${selectedIds.length} обрано (завантаження...)`
            }
          </div>
        </div>
      )}
    </ZoneCard>
  )
}
