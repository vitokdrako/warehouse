/**
 * Top Bar
 * Верхня панель з назвою, undo/redo, zoom, export
 */

import React, { useRef } from 'react';
import useMoodboardStore from '../../store/moodboardStore';

const TopBar = ({ boardName, onSave, onBack }) => {
  const {
    scene,
    setSceneName,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    undo,
    redo,
    canUndo,
    canRedo,
    isDirty,
    isSaving
  } = useMoodboardStore();
  
  const handleExportPNG = async () => {
    // Знаходимо Konva Stage
    const stageContainer = document.querySelector('.konvajs-content');
    if (!stageContainer) {
      alert('Canvas не знайдено');
      return;
    }
    
    try {
      // Знаходимо Konva Stage через window.Konva або напряму
      const canvas = stageContainer.querySelector('canvas');
      if (!canvas) {
        alert('Canvas не знайдено');
        return;
      }
      
      // Створюємо новий canvas з високою роздільністю
      const pixelRatio = 3; // Висока якість
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = scene.width * pixelRatio;
      exportCanvas.height = scene.height * pixelRatio;
      
      const ctx = exportCanvas.getContext('2d');
      ctx.scale(pixelRatio, pixelRatio);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Малюємо фон
      ctx.fillStyle = scene.background?.value || '#ffffff';
      ctx.fillRect(0, 0, scene.width, scene.height);
      
      // Малюємо оригінальний canvas
      ctx.drawImage(canvas, 0, 0, scene.width, scene.height);
      
      // Експортуємо
      const dataUrl = exportCanvas.toDataURL('image/png', 1.0);
      
      const link = document.createElement('a');
      link.download = `${scene.name || 'moodboard'}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Export error:', error);
      alert('Помилка експорту: ' + error.message);
    }
  };
  
  // PDF експорт
  const handleExportPDF = async () => {
    const stageContainer = document.querySelector('.konvajs-content');
    if (!stageContainer) {
      alert('Canvas не знайдено');
      return;
    }
    
    try {
      const canvas = stageContainer.querySelector('canvas');
      if (!canvas) {
        alert('Canvas не знайдено');
        return;
      }
      
      // Створюємо високоякісний canvas
      const pixelRatio = 3;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = scene.width * pixelRatio;
      exportCanvas.height = scene.height * pixelRatio;
      
      const ctx = exportCanvas.getContext('2d');
      ctx.scale(pixelRatio, pixelRatio);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      ctx.fillStyle = scene.background?.value || '#ffffff';
      ctx.fillRect(0, 0, scene.width, scene.height);
      ctx.drawImage(canvas, 0, 0, scene.width, scene.height);
      
      const imgData = exportCanvas.toDataURL('image/jpeg', 0.95);
      
      // Використовуємо jsPDF якщо доступний, інакше - PNG
      if (window.jspdf) {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
          orientation: scene.width > scene.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [scene.width, scene.height]
        });
        pdf.addImage(imgData, 'JPEG', 0, 0, scene.width, scene.height);
        pdf.save(`${scene.name || 'moodboard'}.pdf`);
      } else {
        // Fallback to PNG
        handleExportPNG();
      }
    } catch (error) {
      console.error('PDF Export error:', error);
      alert('Помилка експорту PDF');
    }
  };
  
  return (
    <div style={{
      height: '56px',
      background: '#fff',
      borderBottom: '1px solid #e0e0e0',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '16px'
    }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: '#666'
        }}
      >
        ← Назад
      </button>
      
      {/* Separator */}
      <div style={{ width: '1px', height: '24px', background: '#e0e0e0' }} />
      
      {/* Board name */}
      <input
        type="text"
        value={scene.name}
        onChange={(e) => setSceneName(e.target.value)}
        style={{
          border: 'none',
          fontSize: '16px',
          fontWeight: '500',
          color: '#333',
          background: 'transparent',
          width: '200px',
          padding: '4px 8px',
          borderRadius: '4px'
        }}
        onFocus={(e) => e.target.style.background = '#f5f5f5'}
        onBlur={(e) => e.target.style.background = 'transparent'}
      />
      
      {/* Dirty indicator */}
      {isDirty && (
        <span style={{ color: '#999', fontSize: '12px' }}>
          (не збережено)
        </span>
      )}
      
      {/* Spacer */}
      <div style={{ flex: 1 }} />
      
      {/* Undo/Redo */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          onClick={undo}
          disabled={!canUndo()}
          title="Скасувати (Ctrl+Z)"
          style={{
            background: 'none',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            padding: '6px 10px',
            cursor: canUndo() ? 'pointer' : 'not-allowed',
            opacity: canUndo() ? 1 : 0.5
          }}
        >
          ↩
        </button>
        <button
          onClick={redo}
          disabled={!canRedo()}
          title="Повторити (Ctrl+Shift+Z)"
          style={{
            background: 'none',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            padding: '6px 10px',
            cursor: canRedo() ? 'pointer' : 'not-allowed',
            opacity: canRedo() ? 1 : 0.5
          }}
        >
          ↪
        </button>
      </div>
      
      {/* Separator */}
      <div style={{ width: '1px', height: '24px', background: '#e0e0e0' }} />
      
      {/* Zoom controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={zoomOut}
          disabled={zoom <= 0.1}
          style={{
            background: 'none',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            padding: '6px 10px',
            cursor: 'pointer'
          }}
        >
          −
        </button>
        <button
          onClick={resetZoom}
          style={{
            background: 'none',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            minWidth: '60px'
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={zoomIn}
          disabled={zoom >= 3}
          style={{
            background: 'none',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            padding: '6px 10px',
            cursor: 'pointer'
          }}
        >
          +
        </button>
      </div>
      
      {/* Separator */}
      <div style={{ width: '1px', height: '24px', background: '#e0e0e0' }} />
      
      {/* Export */}
      <button
        onClick={handleExportPNG}
        style={{
          background: 'none',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          padding: '6px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        Експорт PNG
      </button>
      
      {/* Save */}
      <button
        onClick={onSave}
        disabled={isSaving}
        style={{
          background: isDirty ? '#8B0000' : '#666',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          padding: '8px 16px',
          cursor: 'pointer',
          fontWeight: '500'
        }}
      >
        {isSaving ? 'Збереження...' : 'Зберегти'}
      </button>
    </div>
  );
};

export default TopBar;
