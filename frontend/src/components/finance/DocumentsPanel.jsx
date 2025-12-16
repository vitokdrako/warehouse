/* eslint-disable */
/**
 * DocumentsPanel - Секція документів для замовлення
 * Генерація, перегляд, друк документів
 */
import React, { useState, useEffect } from 'react';
import { documentsApi, Document, DocType } from '../../services/documentsApi';

interface DocumentsPanelProps {
  orderId: number;
  issueCardId?: string;
  entityType?: 'order' | 'issue' | 'return';
  compact?: boolean;
}

// UI Components
const Pill = ({ t = 'neutral', children, className = '' }: { t?: string; children: React.ReactNode; className?: string }) => {
  const tones: Record<string, string> = {
    ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warn: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
    info: 'bg-sky-50 text-sky-800 border-sky-200',
    neutral: 'bg-slate-50 text-slate-800 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${tones[t] || tones.neutral} ${className}`}>
      {children}
    </span>
  );
};

const Btn = ({ variant = 'outline', className = '', children, ...props }: any) => {
  const base = 'inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm transition disabled:opacity-50';
  const v = variant === 'primary' 
    ? 'bg-lime-600 text-white hover:bg-lime-700'
    : variant === 'dark' 
    ? 'bg-slate-900 text-white hover:bg-slate-800'
    : 'border bg-white hover:bg-slate-50';
  return <button className={`${base} ${v} ${className}`} {...props}>{children}</button>;
};

// Quick action buttons for common docs
export const DocumentQuickActions = ({ orderId, onGenerated }: { orderId: number; onGenerated?: () => void }) => {
  const [generating, setGenerating] = useState<string | null>(null);

  const quickDocs = [
    { type: 'invoice_offer', label: 'Рахунок', icon: '📄' },
    { type: 'contract_rent', label: 'Договір', icon: '📋' },
  ];

  const handleGenerate = async (docType: string) => {
    setGenerating(docType);
    try {
      const result = await documentsApi.generate(docType, orderId);
      if (result.success && result.pdf_url) {
        documentsApi.downloadPdf(result.document_id);
        onGenerated?.();
      }
    } catch (err) {
      console.error('Generate error:', err);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {quickDocs.map((doc) => (
        <Btn
          key={doc.type}
          onClick={() => handleGenerate(doc.type)}
          disabled={generating === doc.type}
          className="gap-1"
        >
          <span>{doc.icon}</span>
          <span>{generating === doc.type ? '...' : doc.label}</span>
        </Btn>
      ))}
    </div>
  );
};

// Full documents panel
export default function DocumentsPanel({ orderId, issueCardId, entityType = 'order', compact = false }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [availableTypes, setAvailableTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  const entityId = entityType === 'issue' && issueCardId ? issueCardId : String(orderId);

  useEffect(() => {
    loadDocuments();
  }, [orderId, issueCardId, entityType]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await documentsApi.getEntityDocuments(entityType, entityId);
      setDocuments(data.documents || []);
      setAvailableTypes(data.available_types || []);
    } catch (err) {
      console.error('Load documents error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (docType: string) => {
    setGenerating(docType);
    try {
      const result = await documentsApi.generate(docType, entityId);
      if (result.success) {
        await loadDocuments();
        // Open preview
        if (result.document_id) {
          setPreviewDoc({
            id: result.document_id,
            doc_number: result.doc_number,
            preview_url: result.preview_url,
            pdf_url: result.pdf_url,
          } as Document);
        }
      }
    } catch (err) {
      console.error('Generate error:', err);
    } finally {
      setGenerating(null);
    }
  };

  const getDocIcon = (docType: string) => {
    const icons: Record<string, string> = {
      invoice_offer: '📄',
      contract_rent: '📋',
      issue_act: '📦',
      return_act: '📥',
      picking_list: '📝',
      return_intake_checklist: '✅',
    };
    return icons[docType] || '📄';
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; t: string }> = {
      draft: { label: 'Чернетка', t: 'neutral' },
      signed: { label: 'Підписано', t: 'ok' },
      void: { label: 'Анульовано', t: 'danger' },
    };
    return badges[status] || badges.draft;
  };

  if (compact) {
    return (
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Документи</div>
          <Pill t="info">docs</Pill>
        </div>
        
        {/* Quick generate buttons */}
        <div className="flex flex-wrap gap-2 mb-3">
          {availableTypes.slice(0, 4).map((type) => (
            <Btn
              key={type.doc_type}
              onClick={() => handleGenerate(type.doc_type)}
              disabled={generating === type.doc_type}
              className="gap-1 text-xs"
            >
              <span>{getDocIcon(type.doc_type)}</span>
              <span>{generating === type.doc_type ? '...' : type.name}</span>
            </Btn>
          ))}
        </div>

        {/* Recent docs */}
        {documents.length > 0 && (
          <div className="space-y-1">
            {documents.slice(0, 3).map((doc) => (
              <div key={doc.id} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                <span className="truncate">{doc.doc_number}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPreviewDoc(doc)} className="p-1 hover:bg-slate-200 rounded">👁️</button>
                  <button onClick={() => documentsApi.downloadPdf(doc.id)} className="p-1 hover:bg-slate-200 rounded">📥</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div>
            <div className="text-sm font-semibold">📄 Документи</div>
            <div className="mt-0.5 text-xs text-slate-500">Генерація рахунків, договорів, актів</div>
          </div>
          <Pill t="info">documents</Pill>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-4 text-slate-500">Завантаження...</div>
          ) : (
            <>
              {/* Generate buttons */}
              {availableTypes.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-slate-500 mb-2">Створити документ:</div>
                  <div className="flex flex-wrap gap-2">
                    {availableTypes.map((type) => (
                      <Btn
                        key={type.doc_type}
                        onClick={() => handleGenerate(type.doc_type)}
                        disabled={generating === type.doc_type}
                        className="gap-1"
                      >
                        <span>{getDocIcon(type.doc_type)}</span>
                        <span>{generating === type.doc_type ? '...' : type.name}</span>
                      </Btn>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents list */}
              {documents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Тип</th>
                        <th className="px-3 py-2 text-left font-medium">Номер</th>
                        <th className="px-3 py-2 text-left font-medium">Статус</th>
                        <th className="px-3 py-2 text-left font-medium">Створено</th>
                        <th className="px-3 py-2 text-right font-medium">Дії</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => {
                        const status = getStatusBadge(doc.status);
                        return (
                          <tr key={doc.id} className="border-t">
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="mr-1">{getDocIcon(doc.doc_type)}</span>
                              {doc.doc_type_name}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{doc.doc_number}</td>
                            <td className="px-3 py-2">
                              <Pill t={status.t}>{status.label}</Pill>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                              {doc.created_at ? new Date(doc.created_at).toLocaleDateString('uk-UA') : '—'}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => setPreviewDoc(doc)}
                                  className="p-1.5 rounded hover:bg-slate-100"
                                  title="Переглянути"
                                >
                                  👁️
                                </button>
                                <button
                                  onClick={() => documentsApi.downloadPdf(doc.id)}
                                  className="p-1.5 rounded hover:bg-slate-100"
                                  title="Завантажити PDF"
                                >
                                  📥
                                </button>
                                <button
                                  onClick={() => documentsApi.openPreview(doc.id)}
                                  className="p-1.5 rounded hover:bg-slate-100"
                                  title="Друк"
                                >
                                  🖨️
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 text-slate-400 text-sm">
                  Документів ще немає
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b">
              <div>
                <h3 className="font-semibold text-slate-800">{previewDoc.doc_number}</h3>
                <p className="text-sm text-slate-500">Перегляд документа</p>
              </div>
              <div className="flex items-center gap-2">
                <Btn variant="primary" onClick={() => documentsApi.downloadPdf(previewDoc.id)}>
                  📥 PDF
                </Btn>
                <Btn onClick={() => documentsApi.openPreview(previewDoc.id)}>
                  🖨️ Друк
                </Btn>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-100">
              <iframe
                src={documentsApi.getPreviewUrl(previewDoc.id)}
                className="w-full h-full min-h-[600px] bg-white rounded-lg shadow-inner"
                title="Document Preview"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { DocumentsPanel };
