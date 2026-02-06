/**
 * Moodboard Shell
 * Головний контейнер мудборду
 */

import React, { useEffect, useCallback, useState } from 'react';
import useMoodboardStore from '../store/moodboardStore';
import TopBar from './panels/TopBar';
import LeftPanel from './panels/LeftPanel';
import RightPanel from './panels/RightPanel';
import InspectorPanel from './inspector/InspectorPanel';
import CanvasStage from './canvas/CanvasStage';
import { createDecorItemNode } from '../domain/moodboard.types';

const MoodboardShell = ({ 
  board,
  boardItems = [],
  onSave,
  onBack,
  onOpenCatalog
}) => {
  const {
    initScene,
    scene,
    addNode,
    undo,
    redo,
    removeSelectedNodes,
    duplicateSelectedNodes,
    selectAll,
    selectedNodeIds,
    inspectorOpen
  } = useMoodboardStore();
  
  // Ініціалізація при монтуванні
  useEffect(() => {
    if (board) {
      const sceneData = board.canvas_layout ? 
        (typeof board.canvas_layout === 'string' ? 
          JSON.parse(board.canvas_layout) : board.canvas_layout) : 
        {};
      
      initScene({
        id: board.id,
        name: board.board_name || 'Мудборд',
        ...sceneData
      });
    } else {
      initScene({
        name: 'Новий мудборд'
      });
    }
  }, [board?.id]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ігноруємо якщо фокус в інпуті
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Ctrl/Cmd + Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y - Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      
      // Delete / Backspace - видалити виділені
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSelectedNodes();
      }
      
      // Ctrl/Cmd + D - дублювати
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelectedNodes();
      }
      
      // Ctrl/Cmd + A - виділити все
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, removeSelectedNodes, duplicateSelectedNodes, selectAll]);
  
  // Handle drop на canvas
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      
      if (data.type === 'decor_item' && data.product) {
        const product = data.product;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left - 100;
        const y = e.clientY - rect.top - 100;
        
        const node = createDecorItemNode({
          product_id: product.product_id,
          name: product.name,
          sku: product.sku,
          image_url: product.image_url,
          rental_price: product.rental_price
        }, {
          x: Math.max(0, x),
          y: Math.max(0, y),
          width: 200,
          height: 200,
          quantity: data.quantity || 1
        });
        
        addNode(node);
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  }, [addNode]);
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  
  // Handle save
  const handleSave = async () => {
    if (onSave) {
      await onSave(scene);
    }
  };
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#f5f5f5'
    }}>
      <TopBar 
        boardName={board?.board_name}
        onSave={handleSave}
        onBack={onBack}
      />
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <LeftPanel boardItems={boardItems} />
        
        <div
          style={{ flex: 1, overflow: 'hidden' }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <CanvasStage />
        </div>
        
        {/* Inspector panel - показується при виділенні */}
        {selectedNodeIds.length > 0 && (
          <div style={{
            width: '260px',
            background: '#fff',
            borderLeft: '1px solid #e0e0e0',
            overflow: 'auto'
          }}>
            <InspectorPanel />
          </div>
        )}
        
        <RightPanel 
          boardItems={boardItems}
          onOpenCatalog={onOpenCatalog}
        />
      </div>
    </div>
  );
};

export default MoodboardShell;
