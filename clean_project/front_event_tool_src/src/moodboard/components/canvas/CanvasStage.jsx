/**
 * Canvas Stage
 * Головний компонент canvas на Konva.js з підтримкою A4 сторінок
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Stage, Layer, Rect, Line, Image as KonvaImage, Text } from 'react-konva';
import useMoodboardStore from '../../store/moodboardStore';
import DecorItemNode from './DecorItemNode';
import TextNode from './TextNode';
import { NodeType, BackgroundType, A4_WIDTH, A4_HEIGHT } from '../../domain/moodboard.types';

const CanvasStage = () => {
  const stageRef = useRef(null);
  const containerRef = useRef(null);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  
  const {
    scene,
    zoom,
    panOffset,
    showGrid,
    gridSize,
    selectedNodeIds,
    currentPage,
    totalPages,
    getSortedNodes,
    selectNode,
    clearSelection,
    updateNode,
    setCurrentPage,
    addPage,
    removePage,
    setZoom
  } = useMoodboardStore();
  
  const nodes = getSortedNodes();
  
  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-adjust zoom for mobile
      if (mobile) {
        const containerWidth = window.innerWidth - 40;
        const optimalZoom = Math.min(containerWidth / A4_WIDTH, 0.6);
        setZoom(optimalZoom);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [setZoom]);
  
  // Завантаження background image
  useEffect(() => {
    if (scene.background?.type === BackgroundType.IMAGE && scene.background?.imageUrl) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setBackgroundImage(img);
      img.onerror = () => setBackgroundImage(null);
      img.src = scene.background.imageUrl;
    } else {
      setBackgroundImage(null);
    }
  }, [scene.background?.type, scene.background?.imageUrl]);
  
  // Обробка кліку на пустому місці
  const handleStageClick = useCallback((e) => {
    if (e.target === e.target.getStage()) {
      clearSelection();
    }
  }, [clearSelection]);
  
  // Обробка drag елемента
  const handleDragEnd = useCallback((nodeId, e) => {
    updateNode(nodeId, {
      x: e.target.x(),
      y: e.target.y()
    });
  }, [updateNode]);
  
  // Обробка transform елемента
  const handleTransformEnd = useCallback((nodeId, e) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    node.scaleX(1);
    node.scaleY(1);
    
    updateNode(nodeId, {
      x: node.x(),
      y: node.y(),
      width: Math.max(20, node.width() * scaleX),
      height: Math.max(20, node.height() * scaleY),
      rotation: node.rotation()
    });
  }, [updateNode]);
  
  // Отримати фон
  const getBackgroundFill = () => {
    const { background } = scene;
    if (!background) return '#ffffff';
    
    if (background.type === BackgroundType.IMAGE && backgroundImage) {
      return 'transparent';
    }
    
    switch (background.type) {
      case 'gradient':
        return background.gradientColors?.[0] || '#ffffff';
      case 'color':
      default:
        return background.value || '#ffffff';
    }
  };
  
  // Розрахувати розміри та позицію background image
  const getBackgroundImageProps = () => {
    if (!backgroundImage) return null;
    
    const fit = scene.background?.imageFit || 'cover';
    const imgRatio = backgroundImage.width / backgroundImage.height;
    const canvasRatio = A4_WIDTH / A4_HEIGHT;
    
    let width, height, x = 0, y = 0;
    
    if (fit === 'cover') {
      if (imgRatio > canvasRatio) {
        height = A4_HEIGHT;
        width = height * imgRatio;
        x = (A4_WIDTH - width) / 2;
      } else {
        width = A4_WIDTH;
        height = width / imgRatio;
        y = (A4_HEIGHT - height) / 2;
      }
    } else if (fit === 'contain') {
      if (imgRatio > canvasRatio) {
        width = A4_WIDTH;
        height = width / imgRatio;
        y = (A4_HEIGHT - height) / 2;
      } else {
        height = A4_HEIGHT;
        width = height * imgRatio;
        x = (A4_WIDTH - width) / 2;
      }
    } else {
      width = A4_WIDTH;
      height = A4_HEIGHT;
    }
    
    return { x, y, width, height };
  };
  
  // Рендер сітки
  const renderGrid = () => {
    if (!showGrid) return null;
    
    const lines = [];
    
    // Вертикальні лінії
    for (let i = 0; i <= A4_WIDTH; i += gridSize) {
      lines.push(
        <Line
          key={`v-${i}`}
          points={[i, 0, i, A4_HEIGHT]}
          stroke="#e0e0e0"
          strokeWidth={0.5}
        />
      );
    }
    
    // Горизонтальні лінії
    for (let i = 0; i <= A4_HEIGHT; i += gridSize) {
      lines.push(
        <Line
          key={`h-${i}`}
          points={[0, i, A4_WIDTH, i]}
          stroke="#e0e0e0"
          strokeWidth={0.5}
        />
      );
    }
    
    return lines;
  };
  
  // Рендер вузла в залежності від типу
  const renderNode = (node) => {
    const isSelected = selectedNodeIds.includes(node.id);
    const commonProps = {
      key: node.id,
      node,
      isSelected,
      onSelect: () => selectNode(node.id),
      onDragEnd: (e) => handleDragEnd(node.id, e),
      onTransformEnd: (e) => handleTransformEnd(node.id, e)
    };
    
    switch (node.type) {
      case NodeType.DECOR_ITEM:
        return <DecorItemNode {...commonProps} />;
      case NodeType.TEXT:
        return <TextNode {...commonProps} />;
      default:
        return null;
    }
  };
  
  return (
    <div 
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'auto',
        background: '#d0d0d0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: isMobile ? '12px' : '30px',
        paddingTop: isMobile ? '12px' : '20px',
        WebkitOverflowScrolling: 'touch',
        minHeight: '100%'
      }}
    >
      {/* Page Navigation & Zoom Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '6px' : '12px',
        marginBottom: isMobile ? '16px' : '20px',
        padding: isMobile ? '8px 12px' : '10px 20px',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        justifyContent: 'center'
      }}>
        {/* Zoom controls */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px',
          marginRight: isMobile ? '0' : '8px'
        }}>
          <button
            onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}
            style={{
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            −
          </button>
          <span style={{ 
            padding: '0 8px', 
            fontSize: '12px',
            minWidth: '45px',
            textAlign: 'center',
            fontWeight: '500'
          }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            style={{
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            +
          </button>
        </div>
        
        {!isMobile && (
          <div style={{ width: '1px', height: '24px', background: '#ddd' }} />
        )}
        
        <button
          onClick={() => setCurrentPage(currentPage - 1)}
          disabled={currentPage === 0}
          style={{
            background: currentPage === 0 ? '#f0f0f0' : '#fff',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: isMobile ? '6px 10px' : '6px 12px',
            cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
            opacity: currentPage === 0 ? 0.5 : 1,
            fontSize: isMobile ? '12px' : '14px'
          }}
        >
          ←{!isMobile && ' Попередня'}
        </button>
        
        <div style={{ 
          padding: '0 8px',
          fontSize: isMobile ? '12px' : '14px',
          fontWeight: '500',
          whiteSpace: 'nowrap'
        }}>
          {currentPage + 1} / {totalPages}
        </div>
        
        <button
          onClick={() => setCurrentPage(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          style={{
            background: currentPage >= totalPages - 1 ? '#f0f0f0' : '#fff',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: isMobile ? '6px 10px' : '6px 12px',
            cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage >= totalPages - 1 ? 0.5 : 1,
            fontSize: isMobile ? '12px' : '14px'
          }}
        >
          {!isMobile && 'Наступна '}→
        </button>
        
        {!isMobile && (
          <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }} />
        )}
        
        <button
          onClick={addPage}
          style={{
            background: '#8B0000',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: isMobile ? '6px 10px' : '6px 12px',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: isMobile ? '11px' : '13px'
          }}
        >
          + {isMobile ? 'Стор.' : 'Додати сторінку'}
        </button>
        
        {totalPages > 1 && (
          <button
            onClick={() => {
              if (window.confirm(`Видалити сторінку ${currentPage + 1}?`)) {
                removePage(currentPage);
              }
            }}
            style={{
              background: '#fff',
              color: '#c00',
              border: '1px solid #c00',
              borderRadius: '4px',
              padding: isMobile ? '6px 10px' : '6px 12px',
              cursor: 'pointer',
              fontSize: isMobile ? '11px' : '13px'
            }}
          >
            {isMobile ? '✕' : 'Видалити'}
          </button>
        )}
      </div>
      
      {/* A4 Page Container */}
      <div
        style={{
          boxShadow: '0 8px 32px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)',
          borderRadius: '2px',
          overflow: 'visible',
          background: '#fff',
          position: 'relative',
          border: '1px solid #ccc',
          transform: `scale(${zoom})`,
          transformOrigin: 'top center',
          transition: 'transform 0.2s ease'
        }}
      >
        {/* Page number indicator */}
        <div style={{
          position: 'absolute',
          top: '-30px',
          right: '0px',
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          padding: '4px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: '500',
          zIndex: 10
        }}>
          Сторінка {currentPage + 1} / {totalPages}
        </div>
        
        {/* A4 Format label */}
        <div style={{
          position: 'absolute',
          top: '-30px',
          left: '0px',
          background: '#8B0000',
          color: '#fff',
          padding: '4px 12px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: '500',
          zIndex: 10
        }}>
          A4 (210×297 мм)
        </div>

        <Stage
          ref={stageRef}
          width={A4_WIDTH}
          height={A4_HEIGHT}
          onClick={handleStageClick}
          onTap={handleStageClick}
          style={{ 
            background: getBackgroundFill(),
            display: 'block'
          }}
        >
          {/* Background Layer */}
          <Layer>
            {/* Solid color background */}
            <Rect
              x={0}
              y={0}
              width={A4_WIDTH}
              height={A4_HEIGHT}
              fill={scene.background?.type === BackgroundType.IMAGE ? '#ffffff' : getBackgroundFill()}
            />
            
            {/* Background image */}
            {backgroundImage && scene.background?.type === BackgroundType.IMAGE && (
              <KonvaImage
                image={backgroundImage}
                {...getBackgroundImageProps()}
                opacity={scene.background?.imageOpacity || 1}
              />
            )}
            
            {renderGrid()}
            
            {/* Page border for visual clarity */}
            <Rect
              x={0}
              y={0}
              width={A4_WIDTH}
              height={A4_HEIGHT}
              stroke="#ccc"
              strokeWidth={1}
              fill="transparent"
            />
          </Layer>
          
          {/* Nodes Layer */}
          <Layer>
            {nodes.filter(n => n.visible !== false).map(renderNode)}
          </Layer>
        </Stage>
      </div>
      
      {/* Page thumbnails */}
      {totalPages > 1 && !isMobile && (
        <div style={{
          display: 'flex',
          gap: '12px',
          marginTop: '20px',
          padding: '16px',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          overflowX: 'auto',
          maxWidth: '100%'
        }}>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              style={{
                width: '60px',
                height: '85px',
                border: i === currentPage ? '2px solid #8B0000' : '1px solid #ddd',
                borderRadius: '4px',
                background: i === currentPage ? '#fff5f5' : '#fff',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              <div style={{
                width: '100%',
                height: '60px',
                background: '#f9f9f9',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: '#999'
              }}>
                A4
              </div>
              <span style={{
                fontSize: '10px',
                marginTop: '4px',
                fontWeight: i === currentPage ? '600' : '400',
                color: i === currentPage ? '#8B0000' : '#666'
              }}>
                {i + 1}
              </span>
            </button>
          ))}
        </div>
      )}
      
      {/* Format info */}
      {!isMobile && (
        <div style={{
          marginTop: '12px',
          fontSize: '11px',
          color: '#999',
          textAlign: 'center'
        }}>
          Формат A4 (210 × 297 мм) • {A4_WIDTH} × {A4_HEIGHT} px
        </div>
      )}
    </div>
  );
};

export default CanvasStage;
