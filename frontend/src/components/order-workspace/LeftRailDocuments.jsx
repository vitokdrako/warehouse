/* eslint-disable */
import React, { useState, useEffect } from 'react'
import { FileText, Printer, Download, Mail, Eye, ChevronDown, ChevronUp } from 'lucide-react'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

/**
 * LeftRailDocuments - Документи в лівій панелі
 * Показує документи відповідно до статусу замовлення
 * Не блокує жодних дій - тільки для генерації/друку
 */

// Документи по статусах замовлення
const DOCS_BY_STATUS = {
  // Draft/Waiting - тільки preview рахунку
  'pending': [],
  'awaiting_customer': [],
  'draft': [],
  
  // Confirm - рахунок-оферта
  'confirmed': [
    { type: 'invoice_offer', name: 'Рахунок-оферта', icon: '📄', printRequired: false, emailRequired: true },
  ],
  
  // Packing/Processing - внутрішні документи + договір
  'processing': [
    { type: 'invoice_offer', name: 'Рахунок-оферта', icon: '📄', printRequired: false },
    { type: 'contract_rent', name: 'Договір оренди', icon: '📋', printRequired: true },
    { type: 'issue_checklist', name: 'Чеклист видачі', icon: '✅', printRequired: true, internal: true },
    { type: 'picking_list', name: 'Лист комплектації', icon: '📦', printRequired: true, internal: true },
  ],
  
  // Ready for issue - акт передачі
  'ready_for_issue': [
    { type: 'invoice_offer', name: 'Рахунок-оферта', icon: '📄' },
    { type: 'contract_rent', name: 'Договір оренди', icon: '📋', printRequired: true },
    { type: 'issue_checklist', name: 'Чеклист видачі', icon: '✅', internal: true },
    { type: 'picking_list', name: 'Лист комплектації', icon: '📦', internal: true },
    { type: 'issue_act', name: 'Акт передачі', icon: '📤', printRequired: true, critical: true },
  ],
  
  // Issued / On rent
  'issued': [
    { type: 'issue_act', name: 'Акт передачі', icon: '📤', printRequired: true },
    { type: 'rental_extension', name: 'Додаткова угода', icon: '📝', showIf: 'dates_changed' },
  ],
  'on_rent': [
    { type: 'issue_act', name: 'Акт передачі', icon: '📤' },
    { type: 'rental_extension', name: 'Додаткова угода', icon: '📝' },
  ],
  
  // Returning
  'returning': [
    { type: 'partial_return_act', name: 'Акт часткового поверн.', icon: '📦', printRequired: true },
    { type: 'return_act', name: 'Акт приймання', icon: '📥', printRequired: true, critical: true },
  ],
  'returned': [
    { type: 'return_act', name: 'Акт приймання', icon: '📥', printRequired: true },
    { type: 'damage_report', name: 'Акт пошкоджень', icon: '⚠️' },
    { type: 'damage_settlement_act', name: 'Акт утримання', icon: '💰' },
    { type: 'damage_invoice', name: 'Рахунок на пошкодження', icon: '💳' },
  ],
  
  // Completed
  'completed': [
    { type: 'deposit_refund_act', name: 'Акт поверн. застави', icon: '✅', printRequired: true },
    { type: 'damage_settlement_act', name: 'Акт утримання', icon: '💰' },
  ],
  
  // Cancelled
  'cancelled': [],
}

export default function LeftRailDocuments({ 
  orderId, 
  orderNumber,
  orderStatus = 'pending',
  issueCardId = null,
  customerEmail = '',
  onDocumentGenerated = () => {}
}) {
  const [expanded, setExpanded] = useState(true)
  const [generating, setGenerating] = useState(null)
  const [sending, setSending] = useState(null)
  const [generatedDocs, setGeneratedDocs] = useState({})
  const [error, setError] = useState(null)

  const getToken = () => localStorage.getItem('token')

  // Отримати документи для поточного статусу
  const getAvailableDocs = () => {
    return DOCS_BY_STATUS[orderStatus] || DOCS_BY_STATUS['pending'] || []
  }

  // Документи які потребують issueCardId замість orderId
  const ISSUE_CARD_DOCS = ['issue_act', 'picking_list', 'issue_checklist']
  
  // Генерація документа
  const generateDocument = async (docType, action = 'preview') => {
    setGenerating(docType)
    setError(null)
    
    // Визначаємо правильний entity_id
    const entityId = ISSUE_CARD_DOCS.includes(docType) 
      ? (issueCardId || orderId) 
      : orderId
    
    if (!entityId) {
      setError('ID не знайдено')
      setGenerating(null)
      return
    }
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/documents/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          doc_type: docType,
          entity_id: String(entityId),
          format: action === 'pdf' ? 'pdf' : 'html',
          options: {}
        })
      })
      
      if (!response.ok) {
        throw new Error(`Помилка: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (action === 'preview' && data.html_content) {
        // Відкрити preview
        const win = window.open('', '_blank')
        if (win) {
          win.document.write(data.html_content)
          win.document.close()
        } else {
          // Popup заблоковано - показати в новій вкладці через data URL
          const blob = new Blob([data.html_content], { type: 'text/html' })
          const url = URL.createObjectURL(blob)
          window.open(url, '_blank')
        }
      } else if (action === 'pdf' && data.download_url) {
        window.open(`${BACKEND_URL}${data.download_url}`, '_blank')
      } else if (action === 'print' && data.html_content) {
        // Друк
        const printWin = window.open('', '_blank')
        if (printWin) {
          printWin.document.write(`
            <!DOCTYPE html>
            <html><head><title>Друк</title>
            <style>@media print { @page { size: A4; margin: 15mm; } }</style>
            </head><body>${data.html_content}
            <script>window.onload=function(){window.print();}</script>
            </body></html>
          `)
          printWin.document.close()
        } else {
          alert('Дозвольте popup вікна для друку документів')
        }
      }
      
      setGeneratedDocs(prev => ({ ...prev, [docType]: data.doc_number }))
      onDocumentGenerated(docType, data)
      
    } catch (err) {
      console.error('Document error:', err)
      setError(err.message)
    } finally {
      setGenerating(null)
    }
  }

  // Відправка email
  const sendEmail = async (docType) => {
    if (!customerEmail) {
      alert('Email клієнта не вказано')
      return
    }
    
    // Визначаємо правильний entity_id
    const entityId = ISSUE_CARD_DOCS.includes(docType) 
      ? (issueCardId || orderId) 
      : orderId
    
    setSending(docType)
    try {
      // Спочатку генеруємо документ
      const genResponse = await fetch(`${BACKEND_URL}/api/documents/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          doc_type: docType,
          entity_id: String(entityId),
          format: 'html',
          options: {}
        })
      })
      
      if (!genResponse.ok) throw new Error('Помилка генерації')
      const genData = await genResponse.json()
      
      // Відправляємо документ на email
      const emailResponse = await fetch(`${BACKEND_URL}/api/email/send-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          to_email: customerEmail,
          document_type: docType,
          document_html: genData.html_content,
          order_number: orderNumber || `#${orderId}`,
          customer_name: null // TODO: pass customer name
        })
      })
      
      if (!emailResponse.ok) {
        const errData = await emailResponse.json()
        throw new Error(errData.detail || 'Помилка відправки email')
      }
      
      const emailResult = await emailResponse.json()
      alert(`✅ ${emailResult.message}`)
      
    } catch (err) {
      setError(err.message)
      alert(`❌ Помилка: ${err.message}`)
    } finally {
      setSending(null)
    }
  }

  const availableDocs = getAvailableDocs()
  
  // Не показувати блок якщо немає документів (draft/awaiting)
  if (availableDocs.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-600" />
          <span className="font-medium text-slate-800">Документи</span>
          <span className="text-xs text-slate-500">({availableDocs.length})</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      
      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          
          {availableDocs.map((doc) => (
            <div 
              key={doc.type}
              className={`
                p-3 rounded-xl border transition-all
                ${doc.critical ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}
                ${doc.internal ? 'opacity-75' : ''}
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>{doc.icon}</span>
                  <span className="text-sm font-medium">{doc.name}</span>
                </div>
                {doc.internal && (
                  <span className="text-xs text-slate-500">внутр.</span>
                )}
                {doc.critical && (
                  <span className="text-xs text-amber-600 font-medium">обов'язк.</span>
                )}
              </div>
              
              {generatedDocs[doc.type] && (
                <div className="text-xs text-green-600 mb-2">
                  ✓ {generatedDocs[doc.type]}
                </div>
              )}
              
              <div className="flex flex-wrap gap-1">
                {/* Preview */}
                <button
                  onClick={() => generateDocument(doc.type, 'preview')}
                  disabled={generating === doc.type}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-white border rounded hover:bg-slate-100 disabled:opacity-50"
                  title="Переглянути"
                >
                  <Eye className="w-3 h-3" />
                  {generating === doc.type ? '...' : 'Перегляд'}
                </button>
                
                {/* Print */}
                <button
                  onClick={() => generateDocument(doc.type, 'print')}
                  disabled={generating === doc.type}
                  className={`
                    flex items-center gap-1 px-2 py-1 text-xs rounded disabled:opacity-50
                    ${doc.printRequired 
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                      : 'bg-white border hover:bg-slate-100'}
                  `}
                  title="Друкувати"
                >
                  <Printer className="w-3 h-3" />
                </button>
                
                {/* PDF */}
                <button
                  onClick={() => generateDocument(doc.type, 'pdf')}
                  disabled={generating === doc.type}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-white border rounded hover:bg-slate-100 disabled:opacity-50"
                  title="Завантажити PDF"
                >
                  <Download className="w-3 h-3" />
                </button>
                
                {/* Email - тільки для не-внутрішніх */}
                {!doc.internal && (
                  <button
                    onClick={() => sendEmail(doc.type)}
                    disabled={sending === doc.type || !customerEmail}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-white border rounded hover:bg-slate-100 disabled:opacity-50"
                    title={customerEmail ? `Надіслати на ${customerEmail}` : 'Email не вказано'}
                  >
                    <Mail className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {/* Legend */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-amber-300 rounded"></span>
              Критичний
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-300 rounded"></span>
              Друкувати
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
