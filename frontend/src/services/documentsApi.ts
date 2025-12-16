/**
 * Documents API Service
 * Генерація та управління документами
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export interface Document {
  id: string;
  doc_type: string;
  doc_type_name: string;
  doc_number: string;
  status: string;
  created_at: string;
  preview_url: string;
  pdf_url: string;
}

export interface DocType {
  doc_type: string;
  name: string;
  entity_type: string;
}

export const documentsApi = {
  // Get available document types
  getTypes: async (entityType?: string): Promise<DocType[]> => {
    try {
      const url = entityType 
        ? `${BACKEND_URL}/api/documents/types/${entityType}`
        : `${BACKEND_URL}/api/documents/types`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error('Documents API error:', err);
      return [];
    }
  },

  // Get documents for an entity
  getEntityDocuments: async (entityType: string, entityId: string | number) => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/documents/entity/${entityType}/${entityId}`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error('Documents API error:', err);
      return { documents: [], available_types: [] };
    }
  },

  // Generate a new document
  generate: async (docType: string, entityId: string | number, options?: Record<string, any>) => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/documents/generate?doc_type=${docType}&entity_id=${entityId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options || {}),
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error('Documents API error:', err);
      return { success: false, error: String(err) };
    }
  },

  // Get preview URL
  getPreviewUrl: (documentId: string) => {
    return `${BACKEND_URL}/api/documents/${documentId}/preview`;
  },

  // Get PDF URL
  getPdfUrl: (documentId: string) => {
    return `${BACKEND_URL}/api/documents/${documentId}/pdf`;
  },

  // Download PDF
  downloadPdf: (documentId: string) => {
    window.open(`${BACKEND_URL}/api/documents/${documentId}/pdf`, '_blank');
  },

  // Open preview in new window
  openPreview: (documentId: string) => {
    window.open(`${BACKEND_URL}/api/documents/${documentId}/preview`, '_blank');
  },
};

export default documentsApi;
