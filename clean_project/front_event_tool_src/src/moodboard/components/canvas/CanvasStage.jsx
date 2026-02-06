/**
 * Canvas Stage
 * Головний компонент canvas на Konva.js
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Line } from 'react-konva';
import useMoodboardStore from '../../store/moodboardStore';
import DecorItemNode from './DecorItemNode';
import TextNode from './TextNode';
import { NodeType } from '../domain/moodboard.types';

const CanvasStage = () => {
  const stageRef = useRef(null);
  const containerRef = useRef(null);
  
  const {
    scene,
    zoom,
    panOffset,
    showGrid,
    gridSize,
    selectedNodeIds,
    getSortedNodes,
    selectNode,
    clearSelection,
    updateNode
  } = useMoodboardStore();
  
  const nodes = getSortedNodes();
  
  // Обробка кліку на пустому місці
  const handleStageClick = useCallback((e) => {
    // Клік на stage (не на елементі)
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
    
    // Reset scale and apply to width/height
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
    
    switch (background.type) {
      case 'gradient':
        return background.gradientColors?.[0] || '#ffffff';
      case 'color':
      default:
        return background.value || '#ffffff';
    }
  };
  
  // Рендер сітки
  const renderGrid = () => {
    if (!showGrid) return null;
    
    const lines = [];
    const { width, height } = scene;
    
    // Вертикальні лінії
    for (let i = 0; i <= width; i += gridSize) {
      lines.push(
        <Line
          key={`v-${i}`}
          points={[i, 0, i, height]}
          stroke="#e0e0e0"
          strokeWidth={0.5}
        />
      );
    }
    
    // Горизонтальні лінії
    for (let i = 0; i <= height; i += gridSize) {
      lines.push(
        <Line
          key={`h-${i}`}
          points={[0, i, width, i]}
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
        background: '#e8e8e8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px'
      }}
    >
      <div
        style={{
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          borderRadius: '4px',
          overflow: 'hidden'
        }}
      >
        <Stage
          ref={stageRef}
          width={scene.width}
          height={scene.height}
          scaleX={zoom}
          scaleY={zoom}
          x={panOffset.x}
          y={panOffset.y}
          onClick={handleStageClick}
          onTap={handleStageClick}
          style={{ background: getBackgroundFill() }}
        >
          {/* Background Layer */}
          <Layer>
            <Rect
              x={0}
              y={0}
              width={scene.width}
              height={scene.height}
              fill={getBackgroundFill()}
            />
            {renderGrid()}
          </Layer>
          
          {/* Nodes Layer */}
          <Layer>
            {nodes.filter(n => n.visible !== false).map(renderNode)}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

export default CanvasStage;
