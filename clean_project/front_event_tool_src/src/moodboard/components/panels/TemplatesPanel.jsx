/**
 * Templates Panel
 * Панель шаблонів компоновки мудборду
 */

import React from 'react';
import useMoodboardStore from '../../store/moodboardStore';
import { LAYOUT_TEMPLATES, BACKGROUND_PRESETS } from '../../domain/moodboard.types';

const TemplatesPanel = () => {
  const {
    scene,
    setSceneBackground,
    applyLayoutTemplate
  } = useMoodboardStore();
  
  const currentBackground = scene?.background?.value || '#ffffff';
  
  // Попередній перегляд шаблону
  const renderTemplatePreview = (template) => {
    const previewSize = 80;
    const padding = 4;
    
    return (
      <svg width={previewSize} height={previewSize} viewBox="0 0 100 100">
        <rect x="0" y="0" width="100" height="100" fill="#f0f0f0" rx="4" />
        {template.cells.map((cell, i) => (
          <rect
            key={i}
            x={cell.x + padding/2}
            y={cell.y + padding/2}
            width={cell.width - padding}
            height={cell.height - padding}
            fill="#8B0000"
            rx="2"
            opacity={0.7 - i * 0.1}
          />
        ))}
      </svg>
    );
  };
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Templates Section */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
        <div style={{ 
          fontWeight: '500', 
          fontSize: '13px',
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Шаблони компоновки</span>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px'
        }}>
          {LAYOUT_TEMPLATES.map(template => (
            <button
              key={template.id}
              onClick={() => applyLayoutTemplate(template.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                padding: '10px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#8B0000';
                e.currentTarget.style.background = '#fef7f7';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.background = '#fff';
              }}
            >
              {renderTemplatePreview(template)}
              <span style={{ fontSize: '11px', color: '#666' }}>
                {template.name}
              </span>
            </button>
          ))}
        </div>
        
        <div style={{ 
          marginTop: '12px', 
          fontSize: '11px', 
          color: '#999',
          textAlign: 'center'
        }}>
          Шаблон розмістить товари автоматично
        </div>
      </div>
      
      {/* Canvas Size */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
        <div style={{ 
          fontWeight: '500', 
          fontSize: '13px',
          marginBottom: '12px'
        }}>
          Розмір полотна
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { name: 'A4 Portrait', width: 794, height: 1123 },
            { name: 'A4 Landscape', width: 1123, height: 794 },
            { name: 'Square', width: 1000, height: 1000 },
            { name: 'Instagram', width: 1080, height: 1080 }
          ].map(size => (
            <button
              key={size.name}
              onClick={() => {
                // Оновити розмір сцени
                useMoodboardStore.getState().setSceneSize(size.width, size.height);
              }}
              style={{
                flex: 1,
                padding: '8px 4px',
                border: scene?.width === size.width && scene?.height === size.height 
                  ? '2px solid #8B0000' 
                  : '1px solid #e0e0e0',
                borderRadius: '6px',
                background: scene?.width === size.width && scene?.height === size.height 
                  ? '#fef7f7' 
                  : '#fff',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              {size.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* Background Section */}
      <div style={{ padding: '16px', flex: 1, overflow: 'auto' }}>
        <div style={{ 
          fontWeight: '500', 
          fontSize: '13px',
          marginBottom: '12px'
        }}>
          Фон полотна
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '6px'
        }}>
          {BACKGROUND_PRESETS.map(bg => (
            <button
              key={bg.id}
              onClick={() => setSceneBackground({ type: 'solid', value: bg.value })}
              title={bg.name}
              style={{
                width: '100%',
                aspectRatio: '1',
                border: currentBackground === bg.value 
                  ? '3px solid #8B0000' 
                  : '1px solid #e0e0e0',
                borderRadius: '6px',
                background: bg.value,
                cursor: 'pointer',
                boxShadow: bg.value === '#ffffff' ? 'inset 0 0 0 1px #eee' : 'none'
              }}
            />
          ))}
        </div>
        
        {/* Custom color */}
        <div style={{ marginTop: '12px' }}>
          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>
            Свій колір
          </label>
          <input
            type="color"
            value={currentBackground}
            onChange={(e) => setSceneBackground({ type: 'solid', value: e.target.value })}
            style={{
              width: '100%',
              height: '36px',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default TemplatesPanel;
