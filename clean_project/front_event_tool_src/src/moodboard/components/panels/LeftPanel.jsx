/**
 * Left Panel
 * Ліва панель з інструментами, фоном, шарами
 */

import React, { useState } from 'react';
import useMoodboardStore from '../../store/moodboardStore';
import { 
  createTextNode, 
  BACKGROUND_PRESETS,
  LAYOUT_TEMPLATES 
} from '../../domain/moodboard.types';

const LeftPanel = ({ boardItems = [] }) => {
  const [activeTab, setActiveTab] = useState('tools');
  
  const {
    scene,
    addNode,
    setBackgroundColor,
    showGrid,
    toggleGrid,
    applyTemplate,
    getSortedNodes,
    selectedNodeIds,
    selectNode,
    toggleNodeLock,
    toggleNodeVisibility,
    bringToFront,
    sendToBack,
    removeNode
  } = useMoodboardStore();
  
  const nodes = getSortedNodes();
  
  const handleAddText = () => {
    const textNode = createTextNode({
      x: scene.width / 2 - 150,
      y: scene.height / 2 - 30
    });
    addNode(textNode);
  };
  
  const handleApplyTemplate = (templateId) => {
    if (boardItems.length === 0) {
      alert('Спочатку додайте товари в підбірку');
      return;
    }
    applyTemplate(templateId, boardItems);
  };
  
  const tabs = [
    { id: 'tools', label: 'Додати' },
    { id: 'background', label: 'Фон' },
    { id: 'templates', label: 'Шаблони' },
    { id: 'layers', label: 'Шари' }
  ];
  
  return (
    <div style={{
      width: '260px',
      background: '#fff',
      borderRight: '1px solid #e0e0e0',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e0e0e0'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '12px 8px',
              border: 'none',
              background: activeTab === tab.id ? '#fff' : '#f5f5f5',
              borderBottom: activeTab === tab.id ? '2px solid #8B0000' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeTab === tab.id ? '500' : '400',
              color: activeTab === tab.id ? '#333' : '#666'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {/* Tools Tab */}
        {activeTab === 'tools' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleAddText}
              style={{
                padding: '12px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: '#f9f9f9',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                textAlign: 'left'
              }}
            >
              <span style={{ fontSize: '20px' }}>T</span>
              <div>
                <div style={{ fontWeight: '500' }}>Додати текст</div>
                <div style={{ fontSize: '11px', color: '#999' }}>Заголовок або опис</div>
              </div>
            </button>
            
            <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={toggleGrid}
                />
                <span style={{ fontSize: '13px' }}>Показати сітку</span>
              </label>
            </div>
          </div>
        )}
        
        {/* Background Tab */}
        {activeTab === 'background' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                Колір фону
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(5, 1fr)', 
                gap: '8px' 
              }}>
                {BACKGROUND_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => setBackgroundColor(preset.value)}
                    title={preset.name}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '6px',
                      border: scene.background?.value === preset.value && scene.background?.type !== 'image'
                        ? '2px solid #8B0000' 
                        : '1px solid #e0e0e0',
                      background: preset.value,
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                Довільний колір
              </div>
              <input
                type="color"
                value={scene.background?.value || '#ffffff'}
                onChange={(e) => setBackgroundColor(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              />
            </div>
            
            {/* Background Image */}
            <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '16px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                Зображення фону
              </div>
              
              {scene.background?.type === 'image' && scene.background?.imageUrl ? (
                <div style={{ 
                  position: 'relative',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  marginBottom: '8px'
                }}>
                  <img 
                    src={scene.background.imageUrl} 
                    alt="Background"
                    style={{
                      width: '100%',
                      height: '80px',
                      objectFit: 'cover'
                    }}
                  />
                  <button
                    onClick={() => setBackgroundColor('#ffffff')}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    Видалити
                  </button>
                </div>
              ) : null}
              
              <input
                type="file"
                accept="image/*"
                id="bg-image-upload"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setBackgroundImage(event.target.result, 'cover');
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <label
                htmlFor="bg-image-upload"
                style={{
                  display: 'block',
                  padding: '12px',
                  border: '2px dashed #e0e0e0',
                  borderRadius: '8px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: '#666'
                }}
              >
                Натисніть щоб завантажити
              </label>
              
              {scene.background?.type === 'image' && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px' }}>
                    Масштабування
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['cover', 'contain', 'stretch'].map(fit => (
                      <button
                        key={fit}
                        onClick={() => setBackgroundImage(scene.background.imageUrl, fit)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          border: scene.background?.imageFit === fit 
                            ? '2px solid #8B0000' 
                            : '1px solid #e0e0e0',
                          borderRadius: '4px',
                          background: scene.background?.imageFit === fit ? '#fef7f7' : '#fff',
                          cursor: 'pointer',
                          fontSize: '10px'
                        }}
                      >
                        {fit === 'cover' ? 'Заповнити' : fit === 'contain' ? 'Вмістити' : 'Розтягнути'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Товарів у підбірці: {boardItems.length}
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '8px' 
            }}>
              {LAYOUT_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleApplyTemplate(template.id)}
                  style={{
                    padding: '12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    background: '#f9f9f9',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>
                    {template.preview}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    {template.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Layers Tab */}
        {activeTab === 'layers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {nodes.length === 0 ? (
              <div style={{ color: '#999', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                Елементи відсутні
              </div>
            ) : (
              [...nodes].reverse().map(node => (
                <div
                  key={node.id}
                  onClick={() => selectNode(node.id)}
                  style={{
                    padding: '10px 12px',
                    border: selectedNodeIds.includes(node.id) 
                      ? '1px solid #8B0000' 
                      : '1px solid #e0e0e0',
                    borderRadius: '6px',
                    background: selectedNodeIds.includes(node.id) ? '#fef7f7' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: '13px', 
                      fontWeight: '500',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {node.type === 'decor_item' ? node.productName : 
                       node.type === 'text' ? node.content.substring(0, 20) : 
                       node.type}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999' }}>
                      {node.type === 'decor_item' ? node.productSku : node.type}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleNodeVisibility(node.id); }}
                      title={node.visible === false ? 'Показати' : 'Приховати'}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: node.visible === false ? 0.3 : 1,
                        fontSize: '14px'
                      }}
                    >
                      👁
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleNodeLock(node.id); }}
                      title={node.locked ? 'Розблокувати' : 'Заблокувати'}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: node.locked ? 1 : 0.3,
                        fontSize: '14px'
                      }}
                    >
                      🔒
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
                      title="Видалити"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#c00'
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeftPanel;
