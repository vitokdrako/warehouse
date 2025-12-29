/* eslint-disable */
import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * useAutoRefresh - Хук для автоматичного оновлення даних
 * Корисно коли кілька людей працюють над одним замовленням
 * 
 * @param {Function} fetchFn - Функція для завантаження даних
 * @param {number} intervalMs - Інтервал оновлення в мілісекундах (default: 30000 = 30 сек)
 * @param {boolean} enabled - Чи включено автооновлення (default: true)
 * @param {Array} deps - Залежності для перезапуску
 */
export function useAutoRefresh(fetchFn, intervalMs = 30000, enabled = true, deps = []) {
  const [lastUpdate, setLastUpdate] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const intervalRef = useRef(null)
  const fetchFnRef = useRef(fetchFn)
  
  // Оновлюємо ref при зміні fetchFn
  useEffect(() => {
    fetchFnRef.current = fetchFn
  }, [fetchFn])

  const refresh = useCallback(async (silent = true) => {
    if (!enabled) return
    
    try {
      if (!silent) setIsRefreshing(true)
      await fetchFnRef.current()
      setLastUpdate(new Date())
    } catch (err) {
      console.error('[useAutoRefresh] Error refreshing:', err)
    } finally {
      setIsRefreshing(false)
    }
  }, [enabled])

  // Запуск polling
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Запускаємо interval
    intervalRef.current = setInterval(() => {
      refresh(true) // silent refresh
    }, intervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, intervalMs, refresh, ...deps])

  return {
    refresh,
    lastUpdate,
    isRefreshing,
  }
}

/**
 * Форматування часу останнього оновлення
 */
export function formatLastUpdate(date) {
  if (!date) return ''
  
  const now = new Date()
  const diff = Math.floor((now - date) / 1000) // різниця в секундах
  
  if (diff < 10) return 'щойно'
  if (diff < 60) return `${diff} сек тому`
  if (diff < 3600) return `${Math.floor(diff / 60)} хв тому`
  
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
}

export default useAutoRefresh
