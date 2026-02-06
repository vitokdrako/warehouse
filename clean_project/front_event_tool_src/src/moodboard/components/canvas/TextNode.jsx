/**
 * Text Node
 * Текстовий елемент на canvas
 */

import React, { useRef, useEffect, useState } from 'react';
import { Group, Rect, Text, Transformer } from 'react-konva';
import useMoodboardStore from '../../store/moodboardStore';

const TextNode = ({ node, isSelected, onSelect, onDragEnd, onTransformEnd }) => {
  const shapeRef = useRef();
  const trRef = useRef();
  const [isEditing, setIsEditing] = useState(false);
  
  const { updateNode } = useMoodboardStore();
  
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
  
  const handleDblClick = () => {
    if (node.locked) return;
    setIsEditing(true);
    
    // Створюємо textarea для редагування
    const stage = shapeRef.current.getStage();
    const container = stage.container();
    const stageBox = container.getBoundingClientRect();
    
    const textNode = shapeRef.current;
    const textPosition = textNode.absolutePosition();
    
    const areaPosition = {
      x: stageBox.left + textPosition.x,
      y: stageBox.top + textPosition.y
    };
    
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    
    textarea.value = node.content;
    textarea.style.position = 'absolute';
    textarea.style.top = areaPosition.y + 'px';
    textarea.style.left = areaPosition.x + 'px';
    textarea.style.width = node.width + 'px';
    textarea.style.height = node.height + 'px';
    textarea.style.fontSize = node.fontSize + 'px';
    textarea.style.fontFamily = node.fontFamily || 'Arial';
    textarea.style.fontWeight = node.fontWeight || 'normal';
    textarea.style.textAlign = node.textAlign || 'center';
    textarea.style.color = node.fill || '#333';
    textarea.style.background = node.backgroundColor || 'transparent';
    textarea.style.border = '2px solid #2196F3';
    textarea.style.borderRadius = '4px';
    textarea.style.padding = '8px';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.overflow = 'hidden';
    textarea.style.zIndex = '10000';
    
    textarea.focus();
    textarea.select();
    
    const handleBlur = () => {
      updateNode(node.id, { content: textarea.value });
      document.body.removeChild(textarea);
      setIsEditing(false);
    };
    
    textarea.addEventListener('blur', handleBlur);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(textarea);
        setIsEditing(false);
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        handleBlur();
      }
    });
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
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
        onDragEnd={onDragEnd}
        onTransformEnd={onTransformEnd}
        opacity={isEditing ? 0 : 1}
      >
        {/* Фон тексту */}
        {node.backgroundColor && node.backgroundColor !== 'transparent' && (
          <Rect
            width={node.width}
            height={node.height}
            fill={node.backgroundColor}
            cornerRadius={4}
          />
        )}
        
        {/* Рамка при виділенні */}
        <Rect
          width={node.width}
          height={node.height}
          stroke={isSelected ? '#2196F3' : 'transparent'}
          strokeWidth={isSelected ? 1 : 0}
          dash={[5, 5]}
        />
        
        {/* Текст */}
        <Text
          text={node.content}
          width={node.width}
          height={node.height}
          fontSize={node.fontSize || 24}
          fontFamily={node.fontFamily || 'Arial'}
          fontStyle={node.fontStyle || 'normal'}
          fontWeight={node.fontWeight || 'normal'}
          fill={node.fill || '#333333'}
          align={node.textAlign || 'center'}
          verticalAlign="middle"
          padding={node.padding || 10}
          wrap="word"
        />
        
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
      {isSelected && !node.locked && !isEditing && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          keepRatio={false}
          enabledAnchors={[
            'middle-left', 'middle-right',
            'top-center', 'bottom-center'
          ]}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 50 || newBox.height < 30) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default TextNode;
