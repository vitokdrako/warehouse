/**
 * Moodboard Shell
 * Головний контейнер мудборду з мобільною адаптацією
 */

import React, { useEffect, useCallback, useState } from 'react';
import useMoodboardStore from '../store/moodboardStore';
import TopBar from './panels/TopBar';
import LeftPanel from './panels/LeftPanel';
import RightPanel from './panels/RightPanel';
import InspectorPanel from './inspector/InspectorPanel';
import CanvasStage from './canvas/CanvasStage';
import { createDecorItemNode, A4_WIDTH, A4_HEIGHT } from '../domain/moodboard.types';

const MoodboardShell = ({ 
  board,
  boardItems = [],
  onSave,
  onBack,
  onOpenCatalog
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [activePanel, setActivePanel] = useState(null); // 'left', 'right', 'inspector', null
  
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
    inspectorOpen,
    currentPage
  } = useMoodboardStore();
  
  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Auto open inspector when node selected on mobile
  useEffect(() => {
    if (isMobile && selectedNodeIds.length > 0) {
      setActivePanel('inspector');
    }
  }, [selectedNodeIds, isMobile]);
  
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
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSelectedNodes();
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelectedNodes();
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }
      
      // Escape to close panels on mobile
      if (e.key === 'Escape' && isMobile) {
        setActivePanel(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, removeSelectedNodes, duplicateSelectedNodes, selectAll, isMobile]);
  
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
          quantity: data.quantity || 1,
          pageIndex: currentPage
        });
        
        addNode(node);
        
        // Close panel after drop on mobile
        if (isMobile) {
          setActivePanel(null);
        }
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  }, [addNode, currentPage, isMobile]);
  
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

  const togglePanel = (panel) => {
    setActivePanel(activePanel === panel ? null : panel);
  };
  
  // Desktop layout
  if (!isMobile) {
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
  }
  
  // Mobile layout
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#f5f5f5',
      overflow: 'hidden'
    }}>
      {/* Mobile Top Bar */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e0e0e0',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        flexShrink: 0
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '14px',
            cursor: 'pointer',
            padding: '8px',
            color: '#666'
          }}
        >
          ← Назад
        </button>
        
        <div style={{
          flex: 1,
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: '500',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {scene.name || board?.board_name}
        </div>
        
        <button
          onClick={handleSave}
          style={{
            background: '#8B0000',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 12px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Зберегти
        </button>
      </div>
      
      {/* Canvas Area */}
      <div
        style={{ 
          flex: 1, 
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <CanvasStage />
      </div>
      
      {/* Mobile Bottom Navigation */}
      <div style={{
        background: '#fff',
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '8px 0',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        flexShrink: 0
      }}>
        <MobileNavButton
          icon="➕"
          label="Додати"
          active={activePanel === 'left'}
          onClick={() => togglePanel('left')}
        />
        <MobileNavButton
          icon="📦"
          label="Товари"
          active={activePanel === 'right'}
          onClick={() => togglePanel('right')}
          badge={boardItems.length}
        />
        <MobileNavButton
          icon="⚙️"
          label="Властивості"
          active={activePanel === 'inspector'}
          onClick={() => togglePanel('inspector')}
          disabled={selectedNodeIds.length === 0}
        />
      </div>
      
      {/* Mobile Panel Overlay */}
      {activePanel && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000
          }}
          onClick={() => setActivePanel(null)}
        >
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: '#fff',
              borderRadius: '16px 16px 0 0',
              maxHeight: '70vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                {activePanel === 'left' && 'Додати елементи'}
                {activePanel === 'right' && 'Товари підбірки'}
                {activePanel === 'inspector' && 'Властивості'}
              </h3>
              <button
                onClick={() => setActivePanel(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  color: '#999'
                }}
              >
                ×
              </button>
            </div>
            
            {/* Panel Content */}
            <div style={{ 
              flex: 1, 
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}>
              {activePanel === 'left' && (
                <MobileLeftPanel 
                  boardItems={boardItems} 
                  onClose={() => setActivePanel(null)}
                />
              )}
              {activePanel === 'right' && (
                <MobileRightPanel 
                  boardItems={boardItems}
                  onOpenCatalog={onOpenCatalog}
                  onClose={() => setActivePanel(null)}
                />
              )}
              {activePanel === 'inspector' && selectedNodeIds.length > 0 && (
                <InspectorPanel />
              )}
              {activePanel === 'inspector' && selectedNodeIds.length === 0 && (
                <div style={{ 
                  padding: '40px 20px', 
                  textAlign: 'center', 
                  color: '#999' 
                }}>
                  Виберіть елемент на полотні
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Mobile Navigation Button
const MobileNavButton = ({ icon, label, active, onClick, badge, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      background: active ? '#fff5f5' : 'transparent',
      border: 'none',
      padding: '8px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      borderRadius: '8px',
      position: 'relative',
      minWidth: '70px'
    }}
  >
    <span style={{ fontSize: '20px' }}>{icon}</span>
    <span style={{ 
      fontSize: '10px', 
      color: active ? '#8B0000' : '#666',
      fontWeight: active ? '600' : '400'
    }}>
      {label}
    </span>
    {badge > 0 && (
      <span style={{
        position: 'absolute',
        top: '2px',
        right: '10px',
        background: '#8B0000',
        color: '#fff',
        fontSize: '9px',
        padding: '2px 5px',
        borderRadius: '10px',
        minWidth: '16px',
        textAlign: 'center'
      }}>
        {badge}
      </span>
    )}
  </button>
);

// Mobile Left Panel Content
const MobileLeftPanel = ({ boardItems, onClose }) => {
  const { addNode, scene, currentPage } = useMoodboardStore();
  
  const handleAddText = () => {
    const { createTextNode, A4_WIDTH, A4_HEIGHT } = require('../domain/moodboard.types');
    const node = createTextNode({
      x: A4_WIDTH / 2 - 150,
      y: A4_HEIGHT / 2 - 30,
      pageIndex: currentPage
    });
    addNode(node);
    onClose();
  };
  
  return (
    <div style={{ padding: '16px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px'
      }}>
        <button
          onClick={handleAddText}
          style={{
            padding: '20px 16px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '28px' }}>T</span>
          <span style={{ fontSize: '12px', color: '#666' }}>Додати текст</span>
        </button>
        
        <button
          style={{
            padding: '20px 16px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            background: '#f9f9f9',
            cursor: 'not-allowed',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            opacity: 0.5
          }}
          disabled
        >
          <span style={{ fontSize: '28px' }}>🖼️</span>
          <span style={{ fontSize: '12px', color: '#999' }}>Зображення</span>
        </button>
      </div>
      
      <div style={{ 
        marginTop: '20px',
        padding: '12px',
        background: '#f9f9f9',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#666',
        textAlign: 'center'
      }}>
        Перейдіть до "Товари" щоб додати декор з підбірки на полотно
      </div>
    </div>
  );
};

// Mobile Right Panel Content
const MobileRightPanel = ({ boardItems, onOpenCatalog, onClose }) => {
  const { addNode, currentPage } = useMoodboardStore();
  const { createDecorItemNode, A4_WIDTH, A4_HEIGHT } = require('../domain/moodboard.types');
  
  const handleAddToCanvas = (item) => {
    const product = item.product || item;
    const node = createDecorItemNode({
      product_id: product.product_id,
      name: product.name,
      sku: product.sku,
      image_url: product.image_url,
      rental_price: product.rental_price
    }, {
      x: A4_WIDTH / 2 - 100,
      y: A4_HEIGHT / 2 - 100,
      width: 200,
      height: 200,
      quantity: item.quantity || 1,
      pageIndex: currentPage
    });
    addNode(node);
    onClose();
  };
  
  if (boardItems.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>📦</div>
        <div style={{ color: '#666', marginBottom: '20px' }}>Підбірка порожня</div>
        <button
          onClick={() => {
            onClose();
            if (onOpenCatalog) onOpenCatalog();
          }}
          style={{
            padding: '12px 24px',
            background: '#8B0000',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Відкрити каталог
        </button>
      </div>
    );
  }
  
  return (
    <div style={{ padding: '12px' }}>
      {boardItems.map((item, index) => {
        const product = item.product || item;
        return (
          <div
            key={`${product.product_id}-${index}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              borderBottom: '1px solid #f0f0f0'
            }}
          >
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#f5f5f5',
              flexShrink: 0
            }}>
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                />
              )}
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '13px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {product.name}
              </div>
              <div style={{ fontSize: '11px', color: '#999' }}>
                {product.sku}
              </div>
            </div>
            
            <button
              onClick={() => handleAddToCanvas(item)}
              style={{
                background: '#8B0000',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: '12px',
                whiteSpace: 'nowrap'
              }}
            >
              + Додати
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default MoodboardShell;
