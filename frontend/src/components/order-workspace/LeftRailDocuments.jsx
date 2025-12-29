/* eslint-disable */
import React, { useState, useEffect } from 'react'
import { FileText, Printer, Download, Mail, Eye, ChevronDown, ChevronUp, RefreshCw, History, Clock } from 'lucide-react'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

/**
 * LeftRailDocuments - Документи з версіонуванням
 * 
 * Нова логіка:
 * - "Перегляд" - показує ОСТАННІЙ згенерований документ
 * - "Генерувати" - створює НОВУ версію документа
 * - "Історія" - показує всі версії
 */

// Документи по статусах замовлення
const DOCS_BY_STATUS = {
  'pending': [],
  'awaiting_customer': [],
  'draft': [],
  'confirmed': [
    { type: 'invoice_offer', name: 'Рахунок-оферта', icon: '📄', emailRequired: true },
  ],
  'processing': [
    { type: 'picking_list', name: 'Лист комплектації', icon: '📦', printRequired: true, internal: true },
  ],
  'ready_for_issue': [
    { type: 'issue_act', name: 'Акт передачі', icon: '📤', printRequired: true, critical: true, emailRequired: true },
    { type: 'damage_breakdown', name: 'Розшифровка пошкоджень', icon: '⚠️', emailRequired: true },
  ],
  'issued': [
    { type: 'issue_act', name: 'Акт передачі', icon: '📤', emailRequired: true },
    { type: 'damage_breakdown', name: 'Розшифровка пошкоджень', icon: '⚠️', emailRequired: true },
  ],
  'on_rent': [
    { type: 'issue_act', name: 'Акт передачі', icon: '📤', emailRequired: true },
    { type: 'damage_breakdown', name: 'Розшифровка пошкоджень', icon: '⚠️', emailRequired: true },
  ],
  'returning': [
    { type: 'return_act', name: 'Акт приймання', icon: '📥', printRequired: true, critical: true, emailRequired: true },
    { type: 'damage_breakdown', name: 'Розшифровка пошкоджень', icon: '⚠️', emailRequired: true },
  ],
  'returned': [
    { type: 'return_act', name: 'Акт приймання', icon: '📥', printRequired: true, emailRequired: true },
    { type: 'damage_breakdown', name: 'Розшифровка пошкоджень', icon: '⚠️', emailRequired: true },
    { type: 'damage_report', name: 'Акт пошкоджень', icon: '⚠️', emailRequired: true },
  ],
  'completed': [
    { type: 'return_act', name: 'Акт приймання', icon: '📥', emailRequired: true },
    { type: 'damage_breakdown', name: 'Розшифровка пошкоджень', icon: '⚠️', emailRequired: true },
    { type: 'deposit_refund_act', name: 'Акт поверн. застави', icon: '✅', emailRequired: true },
  ],
  'cancelled': [],
}

// Документи які потребують issueCardId
const ISSUE_CARD_DOCS = ['issue_act', 'picking_list', 'issue_checklist']

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
  const [error, setError] = useState(null)
  const [docVersions, setDocVersions] = useState({}) // { docType: { exists, version, id, ... } }
  const [historyModal, setHistoryModal] = useState(null) // docType для показу історії
  const [historyData, setHistoryData] = useState([])

  const getToken = () => localStorage.getItem('token')

  // Завантажити інформацію про останні версії документів
  const loadDocumentVersions = async () => {
    const docs = DOCS_BY_STATUS[orderStatus] || []
    const versions = {}
    
    for (const doc of docs) {
      // entity_type в БД: 'issue' для issue_card документів, 'order' для решти
      const entityType = ISSUE_CARD_DOCS.includes(doc.type) ? 'issue' : 'order'
      const entityId = ISSUE_CARD_DOCS.includes(doc.type) ? (issueCardId || orderId) : orderId
      
      if (!entityId) continue
      
      try {
        const res = await fetch(`${BACKEND_URL}/api/documents/latest/${entityType}/${entityId}/${doc.type}`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
        if (res.ok) {
          const data = await res.json()
          versions[doc.type] = data
        }
      } catch (e) {
        console.error(`Error loading version for ${doc.type}:`, e)
      }
    }
    
    setDocVersions(versions)
  }

  useEffect(() => {
    if (orderId && orderStatus) {
      loadDocumentVersions()
    }
  }, [orderId, orderStatus, issueCardId])

  // Переглянути ОСТАННІЙ документ (без генерації)
  const viewLastDocument = async (docType) => {
    const docInfo = docVersions[docType]
    
    if (!docInfo?.exists) {
      alert('Документ ще не згенеровано. Натисніть "Генерувати" для створення.')
      return
    }
    
    // Відкрити preview
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(docInfo.html_content)
      win.document.close()
    } else {
      const blob = new Blob([docInfo.html_content], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    }
  }

  // Генерувати НОВИЙ документ
  const generateNewDocument = async (docType) => {
    setGenerating(docType)
    setError(null)
    
    const entityType = ISSUE_CARD_DOCS.includes(docType) ? 'issue' : 'order'
    const entityId = ISSUE_CARD_DOCS.includes(docType) ? (issueCardId || orderId) : orderId
    
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
          format: 'html',
          options: {}
        })
      })
      
      if (!response.ok) {
        throw new Error(`Помилка: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Оновити версію
      await loadDocumentVersions()
      
      // Показати новий документ
      if (data.html_content) {
        const win = window.open('', '_blank')
        if (win) {
          win.document.write(data.html_content)
          win.document.close()
        }
      }
      
      onDocumentGenerated(docType, data)
      
    } catch (err) {
      console.error('Document error:', err)
      setError(err.message)
    } finally {
      setGenerating(null)
    }
  }

  // Друк останнього документа
  const printDocument = async (docType) => {
    const docInfo = docVersions[docType]
    
    if (!docInfo?.exists) {
      // Якщо немає - генеруємо
      await generateNewDocument(docType)
      return
    }
    
    const printWin = window.open('', '_blank')
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html><head><title>Друк</title>
        <style>@media print { @page { size: A4; margin: 15mm; } }</style>
        </head><body>${docInfo.html_content}
        <script>window.onload=function(){window.print();}</script>
        </body></html>
      `)
      printWin.document.close()
    }
  }

  // Завантажити історію версій
  const loadHistory = async (docType) => {
    const entityType = ISSUE_CARD_DOCS.includes(docType) ? 'issue' : 'order'
    const entityId = ISSUE_CARD_DOCS.includes(docType) ? (issueCardId || orderId) : orderId
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/documents/history/${entityType}/${entityId}/${docType}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
      if (res.ok) {
        const data = await res.json()
        setHistoryData(data.versions || [])
        setHistoryModal(docType)
      }
    } catch (e) {
      console.error('Error loading history:', e)
    }
  }

  // Переглянути конкретну версію
  const viewVersion = async (docId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/documents/${docId}/preview`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
      if (res.ok) {
        const html = await res.text()
        const win = window.open('', '_blank')
        if (win) {
          win.document.write(html)
          win.document.close()
        }
      }
    } catch (e) {
      console.error('Error viewing version:', e)
    }
  }

  // Email
  const sendEmail = async (docType) => {
    if (!customerEmail) {
      alert('Email клієнта не вказано')
      return
    }
    
    let docInfo = docVersions[docType]
    
    // Якщо документ не існує - спочатку генеруємо
    if (!docInfo?.exists) {
      await generateNewDocument(docType)
      // Перезавантажуємо версії
      await loadDocumentVersions()
      // Оновлюємо docInfo після генерації
      docInfo = docVersions[docType]
    }
    
    setSending(docType)
    setError(null)
    
    try {
      // Використовуємо ID збереженого документа
      const documentId = docInfo?.latestDocId
      
      if (!documentId) {
        // Якщо немає збереженого документа - використовуємо новий endpoint
        const entityType = ISSUE_CARD_DOCS.includes(docType) ? 'issue' : 'order'
        const entityId = ISSUE_CARD_DOCS.includes(docType) ? (issueCardId || orderId) : orderId
        
        const emailResponse = await fetch(`${BACKEND_URL}/api/email/send-document-by-type`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({
            doc_type: docType,
            entity_id: String(entityId),
            entity_type: entityType,
            recipient_email: customerEmail,
            recipient_name: '',
            order_number: orderNumber
          })
        })
        
        if (!emailResponse.ok) {
          const errData = await emailResponse.json()
          throw new Error(errData.detail || 'Помилка відправки email')
        }
        
        const emailResult = await emailResponse.json()
        alert(`✅ ${emailResult.message}`)
      } else {
        // Відправляємо збережений документ
        const emailResponse = await fetch(`${BACKEND_URL}/api/documents/${documentId}/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({
            email: customerEmail
          })
        })
        
        if (!emailResponse.ok) {
          const errData = await emailResponse.json()
          throw new Error(errData.detail || 'Помилка відправки email')
        }
        
        const emailResult = await emailResponse.json()
        alert(`✅ ${emailResult.message || 'Документ відправлено'}`)
      }
      
    } catch (err) {
      console.error('[LeftRailDocuments] Email error:', err)
      setError(err.message)
      alert(`❌ Помилка: ${err.message}`)
    } finally {
      setSending(null)
    }
  }

  const availableDocs = DOCS_BY_STATUS[orderStatus] || []
  
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
          
          {availableDocs.map((doc) => {
            const versionInfo = docVersions[doc.type]
            const hasVersion = versionInfo?.exists
            
            return (
              <div 
                key={doc.type}
                className={`
                  p-3 rounded-xl border transition-all
                  ${doc.critical ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{doc.icon}</span>
                    <span className="text-sm font-medium">{doc.name}</span>
                  </div>
                  {doc.critical && (
                    <span className="text-xs text-amber-600 font-medium">обов'язк.</span>
                  )}
                </div>
                
                {/* Версія */}
                {hasVersion && (
                  <div className="flex items-center gap-2 text-xs text-green-600 mb-2">
                    <span>✓ v{versionInfo.version}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">{versionInfo.doc_number}</span>
                  </div>
                )}
                
                {!hasVersion && (
                  <div className="text-xs text-slate-400 mb-2">
                    Документ ще не згенеровано
                  </div>
                )}
                
                <div className="flex flex-wrap gap-1">
                  {/* Перегляд (тільки якщо є версія) */}
                  <button
                    onClick={() => viewLastDocument(doc.type)}
                    disabled={!hasVersion}
                    className={`
                      flex items-center gap-1 px-2 py-1 text-xs rounded
                      ${hasVersion 
                        ? 'bg-white border hover:bg-slate-100' 
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'}
                    `}
                    title={hasVersion ? 'Переглянути останню версію' : 'Спочатку згенеруйте документ'}
                  >
                    <Eye className="w-3 h-3" />
                    Перегляд
                  </button>
                  
                  {/* Генерувати */}
                  <button
                    onClick={() => generateNewDocument(doc.type)}
                    disabled={generating === doc.type}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                    title="Генерувати нову версію"
                  >
                    <RefreshCw className={`w-3 h-3 ${generating === doc.type ? 'animate-spin' : ''}`} />
                    {generating === doc.type ? '...' : 'Генерувати'}
                  </button>
                  
                  {/* Друк */}
                  {doc.printRequired && (
                    <button
                      onClick={() => printDocument(doc.type)}
                      disabled={generating === doc.type}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-50"
                      title="Друк"
                    >
                      <Printer className="w-3 h-3" />
                    </button>
                  )}
                  
                  {/* Історія (якщо є хоча б 1 версія) */}
                  {hasVersion && (
                    <button
                      onClick={() => loadHistory(doc.type)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-white border rounded hover:bg-slate-100"
                      title="Історія версій"
                    >
                      <History className="w-3 h-3" />
                    </button>
                  )}
                  
                  {/* Email */}
                  {doc.emailRequired && (
                    <button
                      onClick={() => sendEmail(doc.type)}
                      disabled={sending === doc.type}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                      title="Надіслати email"
                    >
                      <Mail className="w-3 h-3" />
                      {sending === doc.type ? '...' : ''}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      
      {/* History Modal */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setHistoryModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">📋 Історія документа</h3>
              <button 
                onClick={() => setHistoryModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              {historyData.length === 0 ? (
                <p className="text-slate-500 text-center py-4">Немає версій</p>
              ) : (
                <div className="space-y-2">
                  {historyData.map((ver, i) => (
                    <div 
                      key={ver.id}
                      className={`
                        p-3 rounded-lg border cursor-pointer hover:bg-slate-50
                        ${i === 0 ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}
                      `}
                      onClick={() => viewVersion(ver.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">v{ver.version}</span>
                          {i === 0 && (
                            <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">Остання</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500">{ver.doc_number}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {new Date(ver.created_at).toLocaleString('uk-UA')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
