/**
 * Top Bar
 * Верхня панель з назвою, undo/redo, zoom, export
 */

import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import useMoodboardStore from '../../store/moodboardStore';
import { A4_WIDTH, A4_HEIGHT } from '../../domain/moodboard.types';

const TopBar = ({ boardName, onSave, onBack }) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  
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
    isSaving,
    totalPages,
    currentPage,
    setCurrentPage
  } = useMoodboardStore();
  
  // Отримати canvas для експорту поточної сторінки
  const getExportCanvas = async (pixelRatio = 3) => {
    const stageContainer = document.querySelector('.konvajs-content');
    if (!stageContainer) {
      throw new Error('Canvas не знайдено');
    }
    
    const canvas = stageContainer.querySelector('canvas');
    if (!canvas) {
      throw new Error('Canvas не знайдено');
    }
    
    // Створюємо новий canvas з високою роздільністю
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = A4_WIDTH * pixelRatio;
    exportCanvas.height = A4_HEIGHT * pixelRatio;
    
    const ctx = exportCanvas.getContext('2d');
    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Малюємо фон
    ctx.fillStyle = scene.background?.value || '#ffffff';
    ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);
    
    // Малюємо оригінальний canvas
    ctx.drawImage(canvas, 0, 0, A4_WIDTH, A4_HEIGHT);
    
    return exportCanvas;
  };
  
  const handleExportPNG = async () => {
    setExporting(true);
    setShowExportMenu(false);
    
    try {
      const exportCanvas = await getExportCanvas(3);
      const dataUrl = exportCanvas.toDataURL('image/png', 1.0);
      
      const link = document.createElement('a');
      link.download = `${scene.name || 'moodboard'}-page${currentPage + 1}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Export error:', error);
      alert('Помилка експорту: ' + error.message);
    } finally {
      setExporting(false);
    }
  };
  
  const handleExportPDF = async () => {
    setExporting(true);
    setShowExportMenu(false);
    
    try {
      // Створюємо PDF в форматі A4
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const originalPage = currentPage;
      
      // Експортуємо всі сторінки
      for (let page = 0; page < totalPages; page++) {
        // Переключаємось на сторінку
        setCurrentPage(page);
        
        // Чекаємо рендер
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const exportCanvas = await getExportCanvas(2);
        const imgData = exportCanvas.toDataURL('image/jpeg', 0.92);
        
        if (page > 0) {
          pdf.addPage();
        }
        
        // Додаємо зображення на повну сторінку A4
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        
        // Додаємо номер сторінки
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`${page + 1} / ${totalPages}`, 200, 292, { align: 'right' });
      }
      
      // Повертаємось на оригінальну сторінку
      setCurrentPage(originalPage);
      
      // Зберігаємо
      pdf.save(`${scene.name || 'moodboard'}-${Date.now()}.pdf`);
    } catch (error) {
      console.error('PDF Export error:', error);
      alert('Помилка експорту PDF: ' + error.message);
    } finally {
      setExporting(false);
    }
  };
  
  const handleExportAllPNG = async () => {
    setExporting(true);
    setShowExportMenu(false);
    
    try {
      const originalPage = currentPage;
      
      for (let page = 0; page < totalPages; page++) {
        setCurrentPage(page);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const exportCanvas = await getExportCanvas(3);
        const dataUrl = exportCanvas.toDataURL('image/png', 1.0);
        
        const link = document.createElement('a');
        link.download = `${scene.name || 'moodboard'}-page${page + 1}.png`;
        link.href = dataUrl;
        link.click();
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setCurrentPage(originalPage);
    } catch (error) {
      console.error('Export error:', error);
      alert('Помилка експорту: ' + error.message);
    } finally {
      setExporting(false);
    }
  };
  
  const handleExportJPG = async () => {
    setExporting(true);
    setShowExportMenu(false);
    
    try {
      const exportCanvas = await getExportCanvas(3);
      const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.92);
      
      const link = document.createElement('a');
      link.download = `${scene.name || 'moodboard'}-page${currentPage + 1}-${Date.now()}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Export error:', error);
      alert('Помилка експорту: ' + error.message);
    } finally {
      setExporting(false);
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
      
      {/* Export dropdown */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          disabled={exporting}
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
          {exporting ? 'Експорт...' : 'Експорт ▾'}
        </button>
        
        {showExportMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            background: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            minWidth: '180px',
            zIndex: 100,
            overflow: 'hidden'
          }}>
            <div style={{ padding: '8px 14px', borderBottom: '1px solid #f0f0f0', fontSize: '11px', color: '#999', fontWeight: '500' }}>
              ПОТОЧНА СТОРІНКА
            </div>
            <button
              onClick={handleExportPNG}
              style={exportMenuItemStyle}
            >
              <div>
                <div style={{ fontWeight: '500' }}>PNG</div>
                <div style={{ fontSize: '10px', color: '#999' }}>Висока якість</div>
              </div>
            </button>
            <button
              onClick={handleExportJPG}
              style={exportMenuItemStyle}
            >
              <div>
                <div style={{ fontWeight: '500' }}>JPG</div>
                <div style={{ fontSize: '10px', color: '#999' }}>Менший розмір</div>
              </div>
            </button>
            
            <div style={{ padding: '8px 14px', borderBottom: '1px solid #f0f0f0', borderTop: '1px solid #f0f0f0', fontSize: '11px', color: '#999', fontWeight: '500', marginTop: '4px' }}>
              ВСІ СТОРІНКИ ({totalPages})
            </div>
            <button
              onClick={handleExportPDF}
              style={exportMenuItemStyle}
            >
              <div>
                <div style={{ fontWeight: '500' }}>PDF (A4)</div>
                <div style={{ fontSize: '10px', color: '#999' }}>Всі сторінки для друку</div>
              </div>
            </button>
            {totalPages > 1 && (
              <button
                onClick={handleExportAllPNG}
                style={exportMenuItemStyle}
              >
                <div>
                  <div style={{ fontWeight: '500' }}>PNG (усі)</div>
                  <div style={{ fontSize: '10px', color: '#999' }}>Завантажити кожну сторінку</div>
                </div>
              </button>
            )}
          </div>
        )}
      </div>
      
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

const exportMenuItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  width: '100%',
  padding: '10px 14px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: '13px',
  borderBottom: '1px solid #f0f0f0'
};

export default TopBar;
