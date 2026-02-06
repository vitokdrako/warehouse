/**
 * Layers Panel
 * Панель керування шарами елементів на canvas
 */

import React from 'react';
import useMoodboardStore from '../../store/moodboardStore';
import { NodeType } from '../../domain/moodboard.types';
import { getThumbnailUrl } from '../../utils/imageUtils';

const LayersPanel = () => {
  const {
    scene,
    selectedNodeIds,
    selectNode,
    selectMultipleNodes,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    toggleNodeLock,
    toggleNodeVisibility,
    removeNode
  } = useMoodboardStore();
  
  // Сортуємо ноди по zIndex (зверху вниз)
  const sortedNodes = [...(scene?.nodes || [])].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
  
  const getNodeIcon = (node) => {
    switch (node.type) {
      case NodeType.DECOR_ITEM:
        return '📦';
      case NodeType.TEXT:
        return '✏️';
      case NodeType.IMAGE:
        return '🖼️';
      case NodeType.SHAPE:
        return '⬜';
      default:
        return '•';
    }
  };
  
  const getNodeName = (node) => {
    switch (node.type) {
      case NodeType.DECOR_ITEM:
        return node.productName || 'Товар';
      case NodeType.TEXT:
        return node.content?.substring(0, 20) || 'Текст';
      case NodeType.IMAGE:
        return 'Зображення';
      case NodeType.SHAPE:
        return 'Фігура';
      default:
        return 'Елемент';
    }
  };
  
  const handleNodeClick = (nodeId, e) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      // Multi-select
      selectMultipleNodes([...selectedNodeIds, nodeId]);
    } else {
      selectNode(nodeId);
    }
  };
  
  if (sortedNodes.length === 0) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#999',
        fontSize: '13px'
      }}>
        Шари порожні.<br/>
        Додайте елементи на полотно.
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e0e0e0',
        background: '#fafafa',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontWeight: '500', fontSize: '13px' }}>Шари</span>
        <span style={{ fontSize: '11px', color: '#999' }}>{sortedNodes.length}</span>
      </div>
      
      {/* Layer ordering buttons */}
      {selectedNodeIds.length === 1 && (
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          gap: '4px',
          justifyContent: 'center'
        }}>
          <button
            onClick={() => bringToFront(selectedNodeIds[0])}
            title="На передній план"
            style={layerBtnStyle}
          >
            ⬆️⬆️
          </button>
          <button
            onClick={() => bringForward(selectedNodeIds[0])}
            title="На рівень вище"
            style={layerBtnStyle}
          >
            ⬆️
          </button>
          <button
            onClick={() => sendBackward(selectedNodeIds[0])}
            title="На рівень нижче"
            style={layerBtnStyle}
          >
            ⬇️
          </button>
          <button
            onClick={() => sendToBack(selectedNodeIds[0])}
            title="На задній план"
            style={layerBtnStyle}
          >
            ⬇️⬇️
          </button>
        </div>
      )}
      
      {/* Layers list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {sortedNodes.map((node, index) => {
          const isSelected = selectedNodeIds.includes(node.id);
          const isLocked = node.locked;
          const isHidden = node.visible === false;
          
          return (
            <div
              key={node.id}
              onClick={(e) => handleNodeClick(node.id, e)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderBottom: '1px solid #f0f0f0',
                background: isSelected ? '#e3f2fd' : (isHidden ? '#f9f9f9' : '#fff'),
                cursor: 'pointer',
                opacity: isHidden ? 0.5 : 1
              }}
            >
              {/* Thumbnail or Icon */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                background: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0
              }}>
                {node.type === NodeType.DECOR_ITEM && node.imageUrl ? (
                  <img
                    src={getThumbnailUrl(node.imageUrl)}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => e.target.parentNode.innerHTML = '📦'}
                  />
                ) : (
                  <span style={{ fontSize: '16px' }}>{getNodeIcon(node)}</span>
                )}
              </div>
              
              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: isSelected ? '500' : '400',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {getNodeName(node)}
                </div>
                <div style={{ fontSize: '10px', color: '#999' }}>
                  {Math.round(node.x)}, {Math.round(node.y)}
                </div>
              </div>
              
              {/* Controls */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNodeVisibility(node.id);
                  }}
                  title={isHidden ? 'Показати' : 'Сховати'}
                  style={{
                    ...controlBtnStyle,
                    opacity: isHidden ? 0.5 : 1
                  }}
                >
                  {isHidden ? '👁️‍🗨️' : '👁️'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNodeLock(node.id);
                  }}
                  title={isLocked ? 'Розблокувати' : 'Заблокувати'}
                  style={{
                    ...controlBtnStyle,
                    background: isLocked ? '#ffebee' : 'transparent'
                  }}
                >
                  {isLocked ? '🔒' : '🔓'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeNode(node.id);
                  }}
                  title="Видалити"
                  style={{
                    ...controlBtnStyle,
                    color: '#c62828'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const layerBtnStyle = {
  background: '#f5f5f5',
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: '12px'
};

const controlBtnStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '4px',
  borderRadius: '4px'
};

export default LayersPanel;
