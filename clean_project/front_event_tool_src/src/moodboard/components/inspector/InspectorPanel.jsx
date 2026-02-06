/**
 * Inspector Panel
 * Панель інспектора для редагування властивостей виділеного елемента
 */

import React from 'react';
import useMoodboardStore from '../../store/moodboardStore';
import { NodeType } from '../../domain/moodboard.types';

const InspectorPanel = () => {
  const {
    selectedNodeIds,
    getSelectedNodes,
    updateNodeWithHistory,
    bringToFront,
    sendToBack,
    removeSelectedNodes,
    duplicateSelectedNodes
  } = useMoodboardStore();
  
  const selectedNodes = getSelectedNodes();
  
  if (selectedNodes.length === 0) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#999',
        fontSize: '13px'
      }}>
        Виберіть елемент для редагування
      </div>
    );
  }
  
  const node = selectedNodes[0];
  const isMultiple = selectedNodes.length > 1;
  
  const handleUpdateNode = (updates) => {
    if (isMultiple) {
      selectedNodeIds.forEach(id => updateNodeWithHistory(id, updates));
    } else {
      updateNodeWithHistory(node.id, updates);
    }
  };
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid #e0e0e0',
        background: '#fafafa'
      }}>
        <div style={{ fontWeight: '500', fontSize: '13px' }}>
          {isMultiple ? `${selectedNodes.length} елементів` : (
            node.type === NodeType.DECOR_ITEM ? node.productName :
            node.type === NodeType.TEXT ? 'Текст' : 'Елемент'
          )}
        </div>
        {node.productSku && (
          <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
            {node.productSku}
          </div>
        )}
      </div>
      
      {/* Position & Size */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
          Позиція та розмір
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#999', display: 'block', marginBottom: '4px' }}>X</label>
            <input
              type="number"
              value={Math.round(node.x)}
              onChange={(e) => handleUpdateNode({ x: Number(e.target.value) })}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                fontSize: '13px'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#999', display: 'block', marginBottom: '4px' }}>Y</label>
            <input
              type="number"
              value={Math.round(node.y)}
              onChange={(e) => handleUpdateNode({ y: Number(e.target.value) })}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                fontSize: '13px'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#999', display: 'block', marginBottom: '4px' }}>Ширина</label>
            <input
              type="number"
              value={Math.round(node.width)}
              onChange={(e) => handleUpdateNode({ width: Math.max(20, Number(e.target.value)) })}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                fontSize: '13px'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#999', display: 'block', marginBottom: '4px' }}>Висота</label>
            <input
              type="number"
              value={Math.round(node.height)}
              onChange={(e) => handleUpdateNode({ height: Math.max(20, Number(e.target.value)) })}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                fontSize: '13px'
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Rotation & Opacity */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
          Трансформації
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', color: '#999', display: 'block', marginBottom: '4px' }}>
            Поворот: {Math.round(node.rotation || 0)}°
          </label>
          <input
            type="range"
            min="-180"
            max="180"
            value={node.rotation || 0}
            onChange={(e) => handleUpdateNode({ rotation: Number(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>
        
        <div>
          <label style={{ fontSize: '11px', color: '#999', display: 'block', marginBottom: '4px' }}>
            Прозорість: {Math.round((node.opacity || 1) * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={(node.opacity || 1) * 100}
            onChange={(e) => handleUpdateNode({ opacity: Number(e.target.value) / 100 })}
            style={{ width: '100%' }}
          />
        </div>
      </div>
      
      {/* Decor Item specific */}
      {node.type === NodeType.DECOR_ITEM && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
            Кількість
          </div>
          <input
            type="number"
            min="1"
            value={node.quantity || 1}
            onChange={(e) => handleUpdateNode({ quantity: Math.max(1, Number(e.target.value)) })}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              fontSize: '13px'
            }}
          />
        </div>
      )}
      
      {/* Text specific */}
      {node.type === NodeType.TEXT && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
            Текст
          </div>
          <textarea
            value={node.content || ''}
            onChange={(e) => handleUpdateNode({ content: e.target.value })}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              fontSize: '13px',
              minHeight: '60px',
              resize: 'vertical'
            }}
          />
          
          <div style={{ marginTop: '12px' }}>
            <label style={{ fontSize: '11px', color: '#999', display: 'block', marginBottom: '4px' }}>
              Розмір шрифту: {node.fontSize || 24}px
            </label>
            <input
              type="range"
              min="8"
              max="72"
              value={node.fontSize || 24}
              onChange={(e) => handleUpdateNode({ fontSize: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginTop: '12px' }}>
            <label style={{ fontSize: '11px', color: '#999', display: 'block', marginBottom: '4px' }}>
              Колір тексту
            </label>
            <input
              type="color"
              value={node.fill || '#333333'}
              onChange={(e) => handleUpdateNode({ fill: e.target.value })}
              style={{
                width: '100%',
                height: '32px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>
      )}
      
      {/* Layer controls */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
          Шари
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            onClick={() => bringToFront(node.id)}
            style={{
              padding: '8px',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Наверх
          </button>
          <button
            onClick={() => sendToBack(node.id)}
            style={{
              padding: '8px',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Вниз
          </button>
        </div>
      </div>
      
      {/* Actions */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
          Дії
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={duplicateSelectedNodes}
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Дублювати
          </button>
          <button
            onClick={removeSelectedNodes}
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #ffcdd2',
              borderRadius: '4px',
              background: '#ffebee',
              color: '#c62828',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Видалити
          </button>
        </div>
      </div>
    </div>
  );
};

export default InspectorPanel;
