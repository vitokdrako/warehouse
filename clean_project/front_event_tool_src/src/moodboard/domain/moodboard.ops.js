/**
 * Moodboard Operations
 * Операції над елементами мудборду
 */

import { 
  createDecorItemNode, 
  createTextNode, 
  createImageNode,
  createShapeNode,
  createPaletteNode,
  LAYOUT_TEMPLATES 
} from './moodboard.types';

// ============================================================================
// NODE OPERATIONS
// ============================================================================

/**
 * Додати новий вузол
 */
export const addNode = (nodes, node) => {
  const maxZ = nodes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
  return [...nodes, { ...node, zIndex: maxZ + 1 }];
};

/**
 * Оновити вузол
 */
export const updateNode = (nodes, nodeId, updates) => {
  return nodes.map(node => 
    node.id === nodeId ? { ...node, ...updates } : node
  );
};

/**
 * Видалити вузол
 */
export const removeNode = (nodes, nodeId) => {
  return nodes.filter(node => node.id !== nodeId);
};

/**
 * Видалити кілька вузлів
 */
export const removeNodes = (nodes, nodeIds) => {
  return nodes.filter(node => !nodeIds.includes(node.id));
};

/**
 * Дублювати вузол
 */
export const duplicateNode = (nodes, nodeId, offset = { x: 20, y: 20 }) => {
  const original = nodes.find(n => n.id === nodeId);
  if (!original) return nodes;
  
  const maxZ = nodes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
  const duplicate = {
    ...original,
    id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    x: original.x + offset.x,
    y: original.y + offset.y,
    zIndex: maxZ + 1
  };
  
  return [...nodes, duplicate];
};

/**
 * Перемістити вузол
 */
export const moveNode = (nodes, nodeId, x, y) => {
  return updateNode(nodes, nodeId, { x, y });
};

/**
 * Змінити розмір вузла
 */
export const resizeNode = (nodes, nodeId, width, height) => {
  return updateNode(nodes, nodeId, { width, height });
};

/**
 * Обернути вузол
 */
export const rotateNode = (nodes, nodeId, rotation) => {
  return updateNode(nodes, nodeId, { rotation });
};

/**
 * Заблокувати/розблокувати вузол
 */
export const toggleNodeLock = (nodes, nodeId) => {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return nodes;
  return updateNode(nodes, nodeId, { locked: !node.locked });
};

/**
 * Показати/приховати вузол
 */
export const toggleNodeVisibility = (nodes, nodeId) => {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return nodes;
  return updateNode(nodes, nodeId, { visible: !node.visible });
};

// ============================================================================
// Z-INDEX / LAYER OPERATIONS
// ============================================================================

/**
 * Підняти вузол наверх
 */
export const bringToFront = (nodes, nodeId) => {
  const maxZ = nodes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
  return updateNode(nodes, nodeId, { zIndex: maxZ + 1 });
};

/**
 * Опустити вузол вниз
 */
export const sendToBack = (nodes, nodeId) => {
  const minZ = nodes.reduce((min, n) => Math.min(min, n.zIndex || 0), Infinity);
  return updateNode(nodes, nodeId, { zIndex: minZ - 1 });
};

/**
 * Підняти вузол на один рівень
 */
export const bringForward = (nodes, nodeId) => {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return nodes;
  
  const currentZ = node.zIndex || 0;
  const nextNode = nodes
    .filter(n => (n.zIndex || 0) > currentZ)
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))[0];
  
  if (!nextNode) return nodes;
  
  return nodes.map(n => {
    if (n.id === nodeId) return { ...n, zIndex: nextNode.zIndex };
    if (n.id === nextNode.id) return { ...n, zIndex: currentZ };
    return n;
  });
};

/**
 * Опустити вузол на один рівень
 */
export const sendBackward = (nodes, nodeId) => {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return nodes;
  
  const currentZ = node.zIndex || 0;
  const prevNode = nodes
    .filter(n => (n.zIndex || 0) < currentZ)
    .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))[0];
  
  if (!prevNode) return nodes;
  
  return nodes.map(n => {
    if (n.id === nodeId) return { ...n, zIndex: prevNode.zIndex };
    if (n.id === prevNode.id) return { ...n, zIndex: currentZ };
    return n;
  });
};

/**
 * Відсортувати вузли за z-index
 */
export const sortNodesByZIndex = (nodes) => {
  return [...nodes].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
};

// ============================================================================
// ALIGNMENT OPERATIONS
// ============================================================================

/**
 * Вирівняти вузли по лівому краю
 */
export const alignLeft = (nodes, nodeIds, canvasWidth) => {
  const selectedNodes = nodes.filter(n => nodeIds.includes(n.id));
  const minX = Math.min(...selectedNodes.map(n => n.x));
  
  return nodes.map(node => 
    nodeIds.includes(node.id) ? { ...node, x: minX } : node
  );
};

/**
 * Вирівняти вузли по центру горизонтально
 */
export const alignCenterH = (nodes, nodeIds, canvasWidth) => {
  const selectedNodes = nodes.filter(n => nodeIds.includes(n.id));
  const avgCenter = selectedNodes.reduce((sum, n) => sum + n.x + n.width / 2, 0) / selectedNodes.length;
  
  return nodes.map(node => 
    nodeIds.includes(node.id) ? { ...node, x: avgCenter - node.width / 2 } : node
  );
};

/**
 * Вирівняти вузли по правому краю
 */
export const alignRight = (nodes, nodeIds, canvasWidth) => {
  const selectedNodes = nodes.filter(n => nodeIds.includes(n.id));
  const maxRight = Math.max(...selectedNodes.map(n => n.x + n.width));
  
  return nodes.map(node => 
    nodeIds.includes(node.id) ? { ...node, x: maxRight - node.width } : node
  );
};

/**
 * Вирівняти вузли по верхньому краю
 */
export const alignTop = (nodes, nodeIds) => {
  const selectedNodes = nodes.filter(n => nodeIds.includes(n.id));
  const minY = Math.min(...selectedNodes.map(n => n.y));
  
  return nodes.map(node => 
    nodeIds.includes(node.id) ? { ...node, y: minY } : node
  );
};

/**
 * Вирівняти вузли по центру вертикально
 */
export const alignCenterV = (nodes, nodeIds) => {
  const selectedNodes = nodes.filter(n => nodeIds.includes(n.id));
  const avgCenter = selectedNodes.reduce((sum, n) => sum + n.y + n.height / 2, 0) / selectedNodes.length;
  
  return nodes.map(node => 
    nodeIds.includes(node.id) ? { ...node, y: avgCenter - node.height / 2 } : node
  );
};

/**
 * Вирівняти вузли по нижньому краю
 */
export const alignBottom = (nodes, nodeIds) => {
  const selectedNodes = nodes.filter(n => nodeIds.includes(n.id));
  const maxBottom = Math.max(...selectedNodes.map(n => n.y + n.height));
  
  return nodes.map(node => 
    nodeIds.includes(node.id) ? { ...node, y: maxBottom - node.height } : node
  );
};

// ============================================================================
// TEMPLATE OPERATIONS
// ============================================================================

/**
 * Застосувати шаблон розташування
 */
export const applyTemplate = (templateId, products, canvasWidth, canvasHeight) => {
  const template = LAYOUT_TEMPLATES.find(t => t.id === templateId);
  if (!template) return [];
  
  const nodes = [];
  const padding = 10; // Відступ між елементами
  
  template.cells.forEach((cell, index) => {
    const product = products[index];
    if (!product) return;
    
    const x = (cell.x / 100) * canvasWidth + padding;
    const y = (cell.y / 100) * canvasHeight + padding;
    const width = (cell.width / 100) * canvasWidth - padding * 2;
    const height = (cell.height / 100) * canvasHeight - padding * 2;
    
    nodes.push(createDecorItemNode(product.product || product, {
      x,
      y,
      width,
      height,
      zIndex: index
    }));
  });
  
  return nodes;
};

// ============================================================================
// SELECTION HELPERS
// ============================================================================

/**
 * Отримати bounding box для групи вузлів
 */
export const getBoundingBox = (nodes, nodeIds) => {
  const selectedNodes = nodes.filter(n => nodeIds.includes(n.id));
  if (selectedNodes.length === 0) return null;
  
  const minX = Math.min(...selectedNodes.map(n => n.x));
  const minY = Math.min(...selectedNodes.map(n => n.y));
  const maxX = Math.max(...selectedNodes.map(n => n.x + n.width));
  const maxY = Math.max(...selectedNodes.map(n => n.y + n.height));
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

export default {
  addNode,
  updateNode,
  removeNode,
  removeNodes,
  duplicateNode,
  moveNode,
  resizeNode,
  rotateNode,
  toggleNodeLock,
  toggleNodeVisibility,
  bringToFront,
  sendToBack,
  bringForward,
  sendBackward,
  sortNodesByZIndex,
  alignLeft,
  alignCenterH,
  alignRight,
  alignTop,
  alignCenterV,
  alignBottom,
  applyTemplate,
  getBoundingBox
};
