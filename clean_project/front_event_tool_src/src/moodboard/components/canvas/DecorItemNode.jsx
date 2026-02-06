/**
 * Decor Item Node
 * Компонент товару на canvas
 */

import React, { useRef, useEffect } from 'react';
import { Group, Rect, Image, Text, Transformer } from 'react-konva';
import useImage from 'use-image';
import { getLargeImageUrl } from '../../utils/imageUtils';

const DecorItemNode = ({ node, isSelected, onSelect, onDragEnd, onTransformEnd }) => {
  const shapeRef = useRef();
  const trRef = useRef();
  
  const imageUrl = getLargeImageUrl(node.imageUrl);
  const [image, status] = useImage(imageUrl, 'anonymous');
  
  // Підключити трансформер при виділенні
  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);
  
  const handleClick = (e) => {
    e.cancelBubble = true;
    onSelect();
  };
  
  return (
    <>
      <Group
        ref={shapeRef}
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rotation={node.rotation || 0}
        draggable={!node.locked}
        onClick={handleClick}
        onTap={handleClick}
        onDragEnd={onDragEnd}
        onTransformEnd={onTransformEnd}
      >
        {/* Фон / placeholder */}
        <Rect
          width={node.width}
          height={node.height}
          fill={status === 'loaded' ? 'transparent' : '#f5f5f5'}
          cornerRadius={node.borderRadius || 4}
          stroke={isSelected ? '#2196F3' : (node.borderColor || '#e0e0e0')}
          strokeWidth={isSelected ? 2 : (node.borderWidth || 1)}
          shadowColor={node.shadow?.color || 'transparent'}
          shadowBlur={node.shadow?.blur || 0}
          shadowOffset={{ x: node.shadow?.offsetX || 0, y: node.shadow?.offsetY || 0 }}
        />
        
        {/* Зображення товару */}
        {status === 'loaded' && image && (
          <Image
            image={image}
            width={node.width}
            height={node.height}
            opacity={node.opacity || 1}
            // Зберігаємо пропорції
            crop={(() => {
              const imgRatio = image.width / image.height;
              const nodeRatio = node.width / node.height;
              
              if (imgRatio > nodeRatio) {
                // Зображення ширше - обрізаємо боки
                const cropWidth = image.height * nodeRatio;
                return {
                  x: (image.width - cropWidth) / 2,
                  y: 0,
                  width: cropWidth,
                  height: image.height
                };
              } else {
                // Зображення вище - обрізаємо верх/низ
                const cropHeight = image.width / nodeRatio;
                return {
                  x: 0,
                  y: (image.height - cropHeight) / 2,
                  width: image.width,
                  height: cropHeight
                };
              }
            })()}
          />
        )}
        
        {/* Індикатор завантаження */}
        {status === 'loading' && (
          <Text
            text="..."
            width={node.width}
            height={node.height}
            align="center"
            verticalAlign="middle"
            fontSize={24}
            fill="#999"
          />
        )}
        
        {/* Бейдж кількості */}
        {node.quantity > 1 && (
          <>
            <Rect
              x={node.width - 30}
              y={5}
              width={25}
              height={20}
              fill="rgba(0,0,0,0.7)"
              cornerRadius={4}
            />
            <Text
              x={node.width - 30}
              y={5}
              width={25}
              height={20}
              text={`×${node.quantity}`}
              fontSize={12}
              fill="#fff"
              align="center"
              verticalAlign="middle"
            />
          </>
        )}
        
        {/* Іконка замка */}
        {node.locked && (
          <>
            <Rect
              x={5}
              y={5}
              width={20}
              height={20}
              fill="rgba(0,0,0,0.5)"
              cornerRadius={4}
            />
            <Text
              x={5}
              y={5}
              width={20}
              height={20}
              text="🔒"
              fontSize={12}
              align="center"
              verticalAlign="middle"
            />
          </>
        )}
      </Group>
      
      {/* Трансформер для виділеного елемента */}
      {isSelected && !node.locked && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          keepRatio={false}
          enabledAnchors={[
            'top-left', 'top-right', 
            'bottom-left', 'bottom-right',
            'middle-left', 'middle-right',
            'top-center', 'bottom-center'
          ]}
          boundBoxFunc={(oldBox, newBox) => {
            // Мінімальний розмір
            if (newBox.width < 50 || newBox.height < 50) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default DecorItemNode;
