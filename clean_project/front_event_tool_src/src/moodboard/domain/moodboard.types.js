/**
 * Moodboard Domain Types
 * Основні типи даних для мудборду
 */

// ============================================================================
// NODE TYPES - елементи на canvas
// ============================================================================

export const NodeType = {
  DECOR_ITEM: 'decor_item',
  TEXT: 'text',
  IMAGE: 'image',
  SHAPE: 'shape',
  PALETTE: 'palette'
};

// Базовий тип для всіх нод
export const createBaseNode = (type, overrides = {}) => ({
  id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type,
  x: 100,
  y: 100,
  width: 200,
  height: 200,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  locked: false,
  visible: true,
  zIndex: 0,
  ...overrides
});

// Декор товар
export const createDecorItemNode = (product, overrides = {}) => ({
  ...createBaseNode(NodeType.DECOR_ITEM, overrides),
  productId: product.product_id,
  productName: product.name,
  productSku: product.sku,
  imageUrl: product.image_url,
  quantity: 1,
  rentalPrice: product.rental_price || 0,
  // Візуальні налаштування
  shadow: null,
  borderRadius: 0,
  borderWidth: 0,
  borderColor: '#000000'
});

// Текстовий елемент
export const createTextNode = (overrides = {}) => ({
  ...createBaseNode(NodeType.TEXT, {
    width: 300,
    height: 60,
    ...overrides
  }),
  content: 'Введіть текст',
  fontSize: 24,
  fontFamily: 'Arial',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textAlign: 'center',
  fill: '#333333',
  backgroundColor: 'transparent',
  padding: 10
});

// Зображення (не товар)
export const createImageNode = (imageUrl, overrides = {}) => ({
  ...createBaseNode(NodeType.IMAGE, overrides),
  imageUrl,
  crop: null,
  filters: []
});

// Фігура
export const createShapeNode = (shapeType = 'rect', overrides = {}) => ({
  ...createBaseNode(NodeType.SHAPE, {
    width: 150,
    height: 150,
    ...overrides
  }),
  shapeType, // rect, circle, line, arrow
  fill: '#f0f0f0',
  stroke: '#333333',
  strokeWidth: 2
});

// Палітра кольорів
export const createPaletteNode = (colors = [], overrides = {}) => ({
  ...createBaseNode(NodeType.PALETTE, {
    width: 300,
    height: 80,
    ...overrides
  }),
  colors: colors.length > 0 ? colors : ['#ffffff', '#f5f5dc', '#d4a574', '#8b4513', '#333333'],
  swatchSize: 40,
  gap: 8
});

// ============================================================================
// BACKGROUND TYPES
// ============================================================================

export const BackgroundType = {
  COLOR: 'color',
  GRADIENT: 'gradient',
  IMAGE: 'image'
};

export const createBackground = (type = BackgroundType.COLOR, value = '#ffffff') => ({
  type,
  value,
  // Для gradient
  gradientColors: ['#ffffff', '#f0f0f0'],
  gradientDirection: 'to bottom',
  // Для image
  imageUrl: null,
  imageFit: 'cover', // cover, contain, stretch
  imageOpacity: 1,
  blur: 0
});

// ============================================================================
// SCENE - повний стан мудборду
// ============================================================================

export const createScene = (overrides = {}) => ({
  id: `scene-${Date.now()}`,
  name: 'Новий мудборд',
  width: 1200,
  height: 800,
  nodes: [],
  background: createBackground(),
  // Метадані
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
  ...overrides
});

// ============================================================================
// HISTORY для Undo/Redo
// ============================================================================

export const createHistoryState = (scene) => ({
  timestamp: Date.now(),
  scene: JSON.parse(JSON.stringify(scene)) // Deep clone
});

// ============================================================================
// SELECTION
// ============================================================================

export const createSelection = () => ({
  nodeIds: [],
  isMultiSelect: false,
  boundingBox: null
});

// ============================================================================
// LAYOUT TEMPLATES
// ============================================================================

export const LAYOUT_TEMPLATES = [
  {
    id: 'grid-2x2',
    name: 'Сітка 2×2',
    preview: '▦',
    cells: [
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 50, y: 0, width: 50, height: 50 },
      { x: 0, y: 50, width: 50, height: 50 },
      { x: 50, y: 50, width: 50, height: 50 }
    ]
  },
  {
    id: 'grid-3x2',
    name: 'Сітка 3×2',
    preview: '▤',
    cells: [
      { x: 0, y: 0, width: 33.33, height: 50 },
      { x: 33.33, y: 0, width: 33.33, height: 50 },
      { x: 66.66, y: 0, width: 33.34, height: 50 },
      { x: 0, y: 50, width: 33.33, height: 50 },
      { x: 33.33, y: 50, width: 33.33, height: 50 },
      { x: 66.66, y: 50, width: 33.34, height: 50 }
    ]
  },
  {
    id: 'asymmetric',
    name: 'Асиметричний',
    preview: '▧',
    cells: [
      { x: 0, y: 0, width: 50, height: 100 },
      { x: 50, y: 0, width: 50, height: 40 },
      { x: 50, y: 40, width: 25, height: 30 },
      { x: 75, y: 40, width: 25, height: 30 },
      { x: 50, y: 70, width: 50, height: 30 }
    ]
  },
  {
    id: 'center-focus',
    name: 'Центральний',
    preview: '▣',
    cells: [
      { x: 20, y: 10, width: 60, height: 60 },
      { x: 0, y: 75, width: 25, height: 25 },
      { x: 25, y: 75, width: 25, height: 25 },
      { x: 50, y: 75, width: 25, height: 25 },
      { x: 75, y: 75, width: 25, height: 25 }
    ]
  },
  {
    id: 'horizontal',
    name: 'Горизонтальний',
    preview: '▬',
    cells: [
      { x: 0, y: 0, width: 100, height: 35 },
      { x: 0, y: 35, width: 50, height: 35 },
      { x: 50, y: 35, width: 50, height: 35 },
      { x: 0, y: 70, width: 100, height: 30 }
    ]
  },
  {
    id: 'masonry',
    name: 'Мозаїка',
    preview: '▨',
    cells: [
      { x: 0, y: 0, width: 40, height: 60 },
      { x: 40, y: 0, width: 30, height: 30 },
      { x: 70, y: 0, width: 30, height: 45 },
      { x: 40, y: 30, width: 30, height: 35 },
      { x: 70, y: 45, width: 30, height: 55 },
      { x: 0, y: 60, width: 40, height: 40 },
      { x: 40, y: 65, width: 30, height: 35 }
    ]
  }
];

// ============================================================================
// BACKGROUND PRESETS
// ============================================================================

export const BACKGROUND_PRESETS = [
  { id: 'white', name: 'Білий', value: '#ffffff' },
  { id: 'ivory', name: 'Слонова кістка', value: '#fffff0' },
  { id: 'beige', name: 'Бежевий', value: '#f5f5dc' },
  { id: 'cream', name: 'Кремовий', value: '#fffdd0' },
  { id: 'light-gray', name: 'Світло-сірий', value: '#f5f5f5' },
  { id: 'warm-gray', name: 'Теплий сірий', value: '#e8e4e1' },
  { id: 'blush', name: 'Рум\'янець', value: '#fce4ec' },
  { id: 'sage', name: 'Шавлія', value: '#e8f5e9' },
  { id: 'dusty-blue', name: 'Пильний блакитний', value: '#e3f2fd' },
  { id: 'charcoal', name: 'Антрацит', value: '#37474f' }
];

export default {
  NodeType,
  BackgroundType,
  createBaseNode,
  createDecorItemNode,
  createTextNode,
  createImageNode,
  createShapeNode,
  createPaletteNode,
  createBackground,
  createScene,
  createHistoryState,
  createSelection,
  LAYOUT_TEMPLATES,
  BACKGROUND_PRESETS
};
