/* eslint-disable */
import React from 'react'

/**
 * LeftRailTimeline - Таймлайн подій в лівій панелі
 */
export default function LeftRailTimeline({
  events = [],  // [{ text, at, tone, user }]
  maxVisible = 5,
}) {
  const [showAll, setShowAll] = React.useState(false)
  
  const visibleEvents = showAll ? events : events.slice(0, maxVisible)
  const hasMore = events.length > maxVisible
  
  const toneColors = {
    green: 'bg-emerald-500',
    red: 'bg-rose-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    slate: 'bg-slate-400',
  }
  
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-slate-800 mb-3">Таймлайн</h3>
      
      {events.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-4">
          Немає подій
        </div>
      ) : (
        <>
          <ol className="space-y-3 text-sm max-h-60 overflow-auto">
            {visibleEvents.map((event, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <div 
                  className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${toneColors[event.tone] || toneColors.slate}`} 
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800">{event.text}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span>{event.at}</span>
                    {event.user && <span>• {event.user}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          
          {hasMore && (
            <button 
              onClick={() => setShowAll(!showAll)}
              className="mt-3 w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showAll ? 'Згорнути' : `Показати ще ${events.length - maxVisible}`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
