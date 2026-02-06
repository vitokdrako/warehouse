/**
 * Right Panel
 * Права панель з товарами підбірки
 */

import React, { useState } from 'react';
import useMoodboardStore from '../../store/moodboardStore';
import { createDecorItemNode, A4_WIDTH, A4_HEIGHT } from '../../domain/moodboard.types';
import { getThumbnailUrl } from '../../utils/imageUtils';

const RightPanel = ({ boardItems = [], onOpenCatalog }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { scene, addNode, currentPage } = useMoodboardStore();
  
  const filteredItems = boardItems.filter(item => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const product = item.product || item;
    return (
      product.name?.toLowerCase().includes(search) ||
      product.sku?.toLowerCase().includes(search)
    );
  });
  
  const handleAddToCanvas = (item) => {
    const product = item.product || item;
    const node = createDecorItemNode({
      product_id: product.product_id,
      name: product.name,
      sku: product.sku,
      image_url: product.image_url,
      rental_price: product.rental_price
    }, {
      x: scene.width / 2 - 100,
      y: scene.height / 2 - 100,
      width: 200,
      height: 200,
      quantity: item.quantity || 1
    });
    addNode(node);
  };
  
  const handleDragStart = (e, item) => {
    const product = item.product || item;
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'decor_item',
      product,
      quantity: item.quantity || 1
    }));
  };
  
  return (
    <div style={{
      width: '280px',
      background: '#fff',
      borderLeft: '1px solid #e0e0e0',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <div style={{ fontWeight: '500', fontSize: '14px' }}>
            Товари підбірки
          </div>
          <span style={{ 
            background: '#f5f5f5', 
            padding: '2px 8px', 
            borderRadius: '10px',
            fontSize: '12px',
            color: '#666'
          }}>
            {boardItems.length}
          </span>
        </div>
        
        <input
          type="text"
          placeholder="Пошук товарів..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            fontSize: '13px'
          }}
        />
      </div>
      
      {/* Items list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {filteredItems.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px',
            color: '#999'
          }}>
            {boardItems.length === 0 ? (
              <>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📦</div>
                <div style={{ marginBottom: '16px' }}>Підбірка порожня</div>
                <button
                  onClick={onOpenCatalog}
                  style={{
                    padding: '10px 20px',
                    background: '#8B0000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Відкрити каталог
                </button>
              </>
            ) : (
              'Нічого не знайдено'
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredItems.map((item, index) => {
              const product = item.product || item;
              return (
                <div
                  key={`${product.product_id}-${index}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '10px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    background: '#fff',
                    cursor: 'grab'
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    background: '#f5f5f5',
                    flexShrink: 0
                  }}>
                    {product.image_url && (
                      <img
                        src={getThumbnailUrl(product.image_url)}
                        alt={product.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                  </div>
                  
                  {/* Info */}
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
                    {item.quantity > 1 && (
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#666',
                        marginTop: '4px'
                      }}>
                        Кількість: {item.quantity}
                      </div>
                    )}
                  </div>
                  
                  {/* Add button */}
                  <button
                    onClick={() => handleAddToCanvas(item)}
                    title="Додати на полотно"
                    style={{
                      background: '#f5f5f5',
                      border: 'none',
                      borderRadius: '6px',
                      width: '32px',
                      height: '32px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      alignSelf: 'center'
                    }}
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Footer hint */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #e0e0e0',
        background: '#f9f9f9',
        fontSize: '11px',
        color: '#999',
        textAlign: 'center'
      }}>
        Перетягніть товар на полотно або натисніть +
      </div>
    </div>
  );
};

export default RightPanel;
