/**
 * Decor Item Node
 * Компонент товару на canvas - з підтримкою різних режимів відображення
 */

import React, { useRef, useEffect, useState } from 'react';
import { Group, Rect, Image, Text, Transformer } from 'react-konva';

// API URL для proxy
const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://backrentalhub.farforrent.com.ua';
const BACKEND_URL = 'https://backrentalhub.farforrent.com.ua';

/**
 * Режими відображення:
 * - 'card' - з рамкою, тінню та артикулом (за замовчуванням)
 * - 'clean' - тільки зображення без фону/рамки (для прозорих PNG)
 */
export const DISPLAY_MODES = {
  CARD: 'card',
  CLEAN: 'clean'
};

const DecorItemNode = ({ node, isSelected, onSelect, onDragEnd, onTransformEnd }) => {
  const shapeRef = useRef();
  const trRef = useRef();
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 200, height: 200 });
  
  // Режим відображення (за замовчуванням 'card')
  const displayMode = node.displayMode || DISPLAY_MODES.CARD;
  const isCleanMode = displayMode === DISPLAY_MODES.CLEAN;
  
  // Завантажуємо зображення
  useEffect(() => {
    if (!node.imageUrl) {
      setLoading(false);
      setError(true);
      return;
    }
    
    setLoading(true);
    setError(false);
    
    // Формуємо URL
    let imageUrl = node.imageUrl;
    
    // Якщо не повний URL - додаємо backend
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      const cleanPath = imageUrl.replace(/^\/+/, '');
      imageUrl = `${BACKEND_URL}/${cleanPath}`;
    }
    
    // Завантажуємо БЕЗ crossOrigin
    const img = new window.Image();
    
    img.onload = () => {
      setImage(img);
      // Зберігаємо оригінальні пропорції
      setNaturalSize({ width: img.width, height: img.height });
      setLoading(false);
      setError(false);
    };
    
    img.onerror = () => {
      console.error('Failed to load image:', imageUrl);
      // Спробуємо альтернативний URL
      if (node.imageUrl.includes('catalog/')) {
        const altImg = new window.Image();
        altImg.onload = () => {
          setImage(altImg);
          setNaturalSize({ width: altImg.width, height: altImg.height });
          setLoading(false);
          setError(false);
        };
        altImg.onerror = () => {
          setError(true);
          setLoading(false);
        };
        altImg.src = `https://www.farforrent.com.ua/image/${node.imageUrl}`;
      } else {
        setError(true);
        setLoading(false);
      }
    };
    
    img.src = imageUrl;
  }, [node.imageUrl]);
  
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
  
  // Розраховуємо розміри зображення зі збереженням пропорцій (contain)
  const getImageDimensions = () => {
    if (!image) return { x: 0, y: 0, width: node.width, height: node.height };
    
    const padding = isCleanMode ? 0 : 4;
    const availableWidth = node.width - (padding * 2);
    const availableHeight = node.height - (padding * 2) - (isCleanMode ? 0 : 24); // місце для SKU
    
    const imgRatio = naturalSize.width / naturalSize.height;
    const boxRatio = availableWidth / availableHeight;
    
    let renderWidth, renderHeight;
    
    if (imgRatio > boxRatio) {
      // Зображення ширше - підганяємо по ширині
      renderWidth = availableWidth;
      renderHeight = availableWidth / imgRatio;
    } else {
      // Зображення вище - підганяємо по висоті
      renderHeight = availableHeight;
      renderWidth = availableHeight * imgRatio;
    }
    
    // Центруємо зображення
    const x = padding + (availableWidth - renderWidth) / 2;
    const y = padding + (availableHeight - renderHeight) / 2;
    
    return { x, y, width: renderWidth, height: renderHeight };
  };
  
  const imageDims = getImageDimensions();
  
  // CLEAN MODE - тільки зображення без рамки
  if (isCleanMode) {
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
          {/* Прозорий фон для взаємодії */}
          <Rect
            width={node.width}
            height={node.height}
            fill="transparent"
            stroke={isSelected ? '#2196F3' : 'transparent'}
            strokeWidth={isSelected ? 2 : 0}
            dash={isSelected ? [5, 5] : []}
          />
          
          {/* Зображення товару */}
          {image && !error && (
            <Image
              image={image}
              x={imageDims.x}
              y={imageDims.y}
              width={imageDims.width}
              height={imageDims.height}
              opacity={node.opacity || 1}
              imageSmoothingEnabled={true}
              perfectDrawEnabled={false}
            />
          )}
          
          {/* Індикатор завантаження */}
          {loading && (
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
          
          {/* Помилка завантаження */}
          {error && !loading && (
            <Text
              text={node.productName || '?'}
              x={0}
              y={node.height / 2 - 10}
              width={node.width}
              height={20}
              align="center"
              fontSize={12}
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
                fill="rgba(139,0,0,0.9)"
                cornerRadius={4}
              />
              <Text
                x={node.width - 30}
                y={5}
                width={25}
                height={20}
                text={`×${node.quantity}`}
                fontSize={11}
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
                y={3}
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
        
        {/* Трансформер */}
        {isSelected && !node.locked && (
          <Transformer
            ref={trRef}
            rotateEnabled={true}
            keepRatio={true}
            enabledAnchors={[
              'top-left', 'top-right', 
              'bottom-left', 'bottom-right'
            ]}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 30 || newBox.height < 30) {
                return oldBox;
              }
              return newBox;
            }}
          />
        )}
      </>
    );
  }
  
  // CARD MODE - з рамкою та артикулом (за замовчуванням)
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
        {/* Фон / рамка */}
        <Rect
          width={node.width}
          height={node.height}
          fill="#ffffff"
          cornerRadius={node.borderRadius || 4}
          stroke={isSelected ? '#2196F3' : '#e0e0e0'}
          strokeWidth={isSelected ? 2 : 1}
          shadowColor={node.shadow?.color || 'rgba(0,0,0,0.1)'}
          shadowBlur={node.shadow?.blur || 8}
          shadowOffset={{ x: 0, y: 2 }}
          shadowOpacity={0.3}
        />
        
        {/* Зображення товару зі збереженням пропорцій */}
        {image && !error && (
          <Image
            image={image}
            x={imageDims.x}
            y={imageDims.y}
            width={imageDims.width}
            height={imageDims.height}
            opacity={node.opacity || 1}
            imageSmoothingEnabled={true}
            perfectDrawEnabled={false}
          />
        )}
        
        {/* Індикатор завантаження */}
        {loading && (
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
        
        {/* Помилка завантаження */}
        {error && !loading && (
          <>
            <Rect
              x={4}
              y={4}
              width={node.width - 8}
              height={node.height - 28}
              fill="#f5f5f5"
              cornerRadius={2}
            />
            <Text
              text={node.productName || 'Фото'}
              x={8}
              y={node.height / 2 - 30}
              width={node.width - 16}
              height={40}
              align="center"
              verticalAlign="middle"
              fontSize={12}
              fill="#666"
              wrap="word"
            />
          </>
        )}
        
        {/* SKU бейдж знизу */}
        {node.productSku && (
          <>
            <Rect
              x={4}
              y={node.height - 24}
              width={node.width - 8}
              height={20}
              fill="rgba(255,255,255,0.95)"
              cornerRadius={2}
            />
            <Text
              x={4}
              y={node.height - 24}
              width={node.width - 8}
              height={20}
              text={node.productSku}
              fontSize={10}
              fill="#666"
              align="center"
              verticalAlign="middle"
            />
          </>
        )}
        
        {/* Бейдж кількості */}
        {node.quantity > 1 && (
          <>
            <Rect
              x={node.width - 30}
              y={5}
              width={25}
              height={20}
              fill="rgba(139,0,0,0.9)"
              cornerRadius={4}
            />
            <Text
              x={node.width - 30}
              y={5}
              width={25}
              height={20}
              text={`×${node.quantity}`}
              fontSize={11}
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
              y={3}
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
          keepRatio={true}
          enabledAnchors={[
            'top-left', 'top-right', 
            'bottom-left', 'bottom-right'
          ]}
          boundBoxFunc={(oldBox, newBox) => {
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
