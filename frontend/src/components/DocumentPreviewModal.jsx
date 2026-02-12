/* eslint-disable */
/**
 * DocumentPreviewModal Component
 * 
 * Full-screen modal for document preview with:
 * - HTML iframe preview
 * - Sign, Download PDF, Send Email actions
 * - Manual fields form (before generation)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { SignatureModal } from './SignatureCanvas';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helper for auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Manual Fields Form for document generation
 */
function ManualFieldsForm({ docType, onSubmit, onCancel, loading }) {
  const [fields, setFields] = useState({
    contact_person: "",
    contact_channel: "Telegram",
    contact_value: "",
    pickup_time: "17:00",
    condition_mode: "ok",
    issue_notes: "",
    return_notes: "",
    defect_notes: ""
  });
  
  const channelOptions = ["Telegram", "Viber", "WhatsApp", "Email"];
  const conditionOptions = [
    { value: "excellent", label: "Відмінний стан" },
    { value: "ok", label: "Справний / без зауважень" },
    { value: "damaged", label: "Є пошкодження (дефектний акт)" }
  ];
  
  const handleChange = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(fields);
  };
  
  // Different fields for different document types
  const showContactFields = ["annex_to_contract", "issue_act"].includes(docType);
  const showConditionField = docType === "return_act";
  const showDefectNotes = docType === "defect_act";
  const showIssueNotes = docType === "issue_act";
  const showReturnNotes = docType === "return_act";
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Contact Fields (for Annex) */}
      {showContactFields && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Контактна особа
            </label>
            <input
              type="text"
              value={fields.contact_person}
              onChange={(e) => handleChange("contact_person", e.target.value)}
              placeholder="Прізвище Ім'я"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Канал зв'язку
              </label>
              <select
                value={fields.contact_channel}
                onChange={(e) => handleChange("contact_channel", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {channelOptions.map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Номер / Email
              </label>
              <input
                type="text"
                value={fields.contact_value}
                onChange={(e) => handleChange("contact_value", e.target.value)}
                placeholder="@username або +380..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Час отримання
            </label>
            <input
              type="time"
              value={fields.pickup_time}
              onChange={(e) => handleChange("pickup_time", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </>
      )}
      
      {/* Condition Mode (for Return Act) */}
      {showConditionField && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Стан повернення
          </label>
          <div className="space-y-2">
            {conditionOptions.map(opt => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="condition_mode"
                  value={opt.value}
                  checked={fields.condition_mode === opt.value}
                  onChange={(e) => handleChange("condition_mode", e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      
      {/* Notes Fields */}
      {showIssueNotes && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Примітки при видачі
          </label>
          <textarea
            value={fields.issue_notes}
            onChange={(e) => handleChange("issue_notes", e.target.value)}
            rows={3}
            placeholder="Особливості стану, дефекти при видачі..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
      
      {showReturnNotes && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Примітки при поверненні
          </label>
          <textarea
            value={fields.return_notes}
            onChange={(e) => handleChange("return_notes", e.target.value)}
            rows={3}
            placeholder="Зауваження при поверненні..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
      
      {showDefectNotes && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Примітки до дефектного акту
          </label>
          <textarea
            value={fields.defect_notes}
            onChange={(e) => handleChange("defect_notes", e.target.value)}
            rows={3}
            placeholder="Загальні примітки щодо пошкоджень..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
      
      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
        >
          Скасувати
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? "Генерація..." : "Згенерувати документ"}
        </button>
      </div>
    </form>
  );
}

/**
 * Main Document Preview Modal
 */
export function DocumentPreviewModal({
  isOpen,
  onClose,
  docType,
  orderId,
  payerProfileId,
  agreementId,
  annexId,
  documentId,
  onDocumentGenerated,
  onDocumentSigned
}) {
  const [step, setStep] = useState("form"); // form | preview | signing
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [htmlContent, setHtmlContent] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signerRole, setSignerRole] = useState("tenant");
  
  const DOC_TYPE_LABELS = {
    master_agreement: "Рамковий договір",
    annex_to_contract: "Додаток до договору",
    issue_act: "Акт передачі",
    return_act: "Акт повернення",
    defect_act: "Дефектний акт",
    quote: "Кошторис",
    invoice_offer: "Рахунок-оферта",
    contract_rent: "Договір оренди"
  };
  
  // Documents that need manual fields
  const NEEDS_MANUAL_FIELDS = ["annex_to_contract", "issue_act", "return_act", "defect_act"];
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setPdfUrl(null);
      setHtmlContent("");
      
      // If document needs manual fields, start with form
      if (NEEDS_MANUAL_FIELDS.includes(docType)) {
        setStep("form");
      } else {
        // Otherwise, generate immediately
        generateDocument({});
      }
    }
  }, [isOpen, docType]);
  
  // Generate document with manual fields
  const generateDocument = async (manualFields) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/documents/render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          doc_type: docType,
          order_id: orderId,
          payer_profile_id: payerProfileId,
          agreement_id: agreementId,
          annex_id: annexId,
          manual_fields: manualFields,
          include_watermark: true
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Помилка генерації документа");
      }
      
      setHtmlContent(data.html);
      setDocNumber(data.doc_number);
      setStep("preview");
      
      if (onDocumentGenerated) {
        onDocumentGenerated(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Generate PDF
  const generatePdf = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/documents/generate-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          doc_type: docType,
          order_id: orderId,
          payer_profile_id: payerProfileId,
          agreement_id: agreementId,
          annex_id: annexId
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Помилка генерації PDF");
      }
      
      setPdfUrl(data.pdf_url);
      
      // Open PDF in new tab
      if (data.pdf_url) {
        window.open(data.pdf_url, "_blank");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle signature completion
  const handleSigned = (signData) => {
    setShowSignModal(false);
    
    if (onDocumentSigned) {
      onDocumentSigned(signData);
    }
    
    // Regenerate preview with signed watermark
    if (signData.fully_signed) {
      generateDocument({});
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {DOC_TYPE_LABELS[docType] || docType}
            </h2>
            {docNumber && (
              <p className="text-sm text-slate-500">№ {docNumber}</p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          {error && (
            <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
              {error}
            </div>
          )}
          
          {/* Form Step */}
          {step === "form" && (
            <div className="max-w-lg mx-auto">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl">📝</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Заповніть додаткові поля
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Ці дані будуть збережені в документі
                </p>
              </div>
              
              <ManualFieldsForm
                docType={docType}
                onSubmit={generateDocument}
                onCancel={onClose}
                loading={loading}
              />
            </div>
          )}
          
          {/* Preview Step */}
          {step === "preview" && (
            <div className="h-full flex flex-col">
              {/* Preview iframe */}
              <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {htmlContent ? (
                  <iframe
                    srcDoc={htmlContent}
                    className="w-full h-full"
                    title="Document Preview"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    {loading ? "Завантаження..." : "Немає даних для відображення"}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Loading Overlay */}
          {loading && step !== "form" && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-3 text-slate-600">Генерація документа...</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer Actions */}
        {step === "preview" && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex gap-2">
              <button
                onClick={() => setStep("form")}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                ← Редагувати
              </button>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={generatePdf}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition disabled:opacity-50"
              >
                📄 Завантажити PDF
              </button>
              
              <div className="relative">
                <button
                  onClick={() => setShowSignModal(true)}
                  className="px-5 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                >
                  ✍️ Підписати
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Signature Modal */}
        <SignatureModal
          isOpen={showSignModal}
          onClose={() => setShowSignModal(false)}
          onSign={handleSigned}
          documentId={documentId || docNumber}
          signerRole={signerRole}
          title={`Підпис: ${DOC_TYPE_LABELS[docType]}`}
        />
      </div>
    </div>
  );
}

export default DocumentPreviewModal;
