import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, Send } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const OrderNotes = ({ orderId }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (orderId) {
      fetchNotes();
    }
  }, [orderId]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/user-tracking/orders/${orderId}/notes`);
      setNotes(response.data.notes || []);
    } catch (err) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      setSubmitting(true);
      await axios.post(
        `${BACKEND_URL}/api/user-tracking/orders/${orderId}/notes`,
        { note: newNote },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setNewNote('');
      await fetchNotes();
    } catch (err) {
      console.error('Error adding note:', err);
      alert('Не вдалося додати нотатку');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm('Видалити цю нотатку?')) return;

    try {
      await axios.delete(
        `${BACKEND_URL}/api/user-tracking/notes/${noteId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      await fetchNotes();
    } catch (err) {
      console.error('Error deleting note:', err);
      alert('Не вдалося видалити нотатку');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <MessageSquare className="w-5 h-5" />
        Внутрішні нотатки ({notes.length})
      </h3>

      {/* Add note form */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Додати внутрішню нотатку (не видима клієнту)..."
          className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows="3"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleAddNote}
            disabled={!newNote.trim() || submitting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Додаємо...' : 'Додати нотатку'}
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Нотатки відсутні</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-gray-900 whitespace-pre-wrap">{note.note}</p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                    <span className="font-medium">{note.created_by_name}</span>
                    <span>•</span>
                    <span>{formatDate(note.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  title="Видалити нотатку"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderNotes;