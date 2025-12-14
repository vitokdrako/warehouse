/* eslint-disable */
import React from 'react'
import ZoneCard from '../ZoneCard'

/**
 * Zone: Documents - Документи замовлення
 * Для статусу: PROCESSING, READY_FOR_ISSUE
 */
export default function ZoneDocuments({
  orderId,
  onDownloadPicklist,
  onDownloadInvoice,
  onPrintQRCodes,
  picklistReady = false,
  invoiceReady = false,
}) {
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''
  
  const handleDownloadPicklist = () => {
    if (onDownloadPicklist) {
      onDownloadPicklist()
    } else {
      window.open(`${BACKEND_URL}/api/pdf/pick-list/${orderId}`, '_blank')
    }
  }
  
  const handleDownloadInvoice = () => {
    if (onDownloadInvoice) {
      onDownloadInvoice()
    } else {
      window.open(`${BACKEND_URL}/api/pdf/invoice/${orderId}`, '_blank')
    }
  }
  
  return (
    <ZoneCard
      title="📄 Документи"
      hint="Друк накладних та документів"
      tone="neutral"
    >
      <div className="flex flex-wrap items-center gap-3">
        <button 
          onClick={handleDownloadPicklist}
          className="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium text-sm hover:bg-blue-600 transition-colors"
        >
          🖨️ Накладна (PDF)
        </button>
        
        <button 
          onClick={handleDownloadInvoice}
          className="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium text-sm hover:bg-blue-600 transition-colors"
        >
          📑 Рахунок (PDF)
        </button>
        
        {onPrintQRCodes && (
          <button 
            onClick={onPrintQRCodes}
            className="px-4 py-2 rounded-lg bg-violet-500 text-white font-medium text-sm hover:bg-violet-600 transition-colors"
          >
            📱 Друк QR кодів
          </button>
        )}
      </div>
      
      <div className="flex gap-3 mt-3 text-sm">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          picklistReady ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}>
          накладна: {picklistReady ? '✓ готова' : '—'}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          invoiceReady ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}>
          рахунок: {invoiceReady ? '✓ готовий' : '—'}
        </span>
      </div>
    </ZoneCard>
  )
}
