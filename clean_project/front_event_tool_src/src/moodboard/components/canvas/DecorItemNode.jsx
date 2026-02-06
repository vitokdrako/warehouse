/**
 * Decor Item Node
 * Компонент товару на canvas - з підтримкою image proxy для CORS
 */

import React, { useRef, useEffect, useState } from 'react';
import { Group, Rect, Image, Text, Transformer } from 'react-konva';

// API URL для proxy
const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://backrentalhub.farforrent.com.ua';
const BACKEND_URL = 'https://backrentalhub.farforrent.com.ua';

/**
 * Отримати URL зображення через proxy для обходу CORS
 */
const getProxiedImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  let fullUrl = imagePath;
  
  // Якщо не повний URL - додаємо backend
  if (!imagePath.startsWith('http://') && !imagePath.startsWith('https://')) {
    const cleanPath = imagePath.replace(/^\/+/, '');
    fullUrl = `${BACKEND_URL}/${cleanPath}`;
  }
  
  // Повертаємо URL через proxy
  return `${API_URL}/api/event/image-proxy?url=${encodeURIComponent(fullUrl)}`;
};

/**
 * Отримати прямий URL (для fallback)
 */
const getDirectImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  const cleanPath = imagePath.replace(/^\/+/, '');
  return `${BACKEND_URL}/${cleanPath}`;
};

const DecorItemNode = ({ node, isSelected, onSelect, onDragEnd, onTransformEnd }) => {
  const shapeRef = useRef();
  const trRef = useRef();
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Завантажуємо зображення
  // ВАЖЛИВО: Для відображення на canvas не використовуємо crossOrigin
  // Це дозволяє показувати зображення без CORS
  // Для експорту canvas буде "tainted", але це можна обійти через proxy
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
    
    // Завантажуємо БЕЗ crossOrigin - це дозволить відобразити на canvas
    const img = new window.Image();
    
    img.onload = () => {
      setImage(img);
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
  
  // Розрахунок crop для збереження пропорцій
  const getCrop = () => {
    if (!image) return null;
    
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
        
        {/* Зображення товару */}
        {image && !error && (
          <Image
            image={image}
            x={4}
            y={4}
            width={node.width - 8}
            height={node.height - 8}
            opacity={node.opacity || 1}
            crop={getCrop()}
            // Вимикаємо пікселізацію для якості при масштабуванні
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
              height={node.height - 8}
              fill="#f5f5f5"
              cornerRadius={2}
            />
            <Text
              text={node.productName || 'Фото'}
              x={8}
              y={node.height / 2 - 20}
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
              fill="rgba(255,255,255,0.9)"
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
