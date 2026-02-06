/**
 * Moodboard Store
 * Централізоване сховище стану мудборду на Zustand
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { 
  createScene, 
  createBackground,
  createHistoryState,
  BackgroundType,
  A4_WIDTH,
  A4_HEIGHT 
} from '../domain/moodboard.types';
import {
  addNode,
  updateNode,
  removeNode,
  removeNodes,
  duplicateNode,
  bringToFront,
  sendToBack,
  bringForward,
  sendBackward,
  sortNodesByZIndex,
  applyTemplate,
  toggleNodeLock as toggleNodeLockOp,
  toggleNodeVisibility as toggleNodeVisibilityOp
} from '../domain/moodboard.ops';

const MAX_HISTORY = 50;

export const useMoodboardStore = create(
  immer((set, get) => ({
    // ========================================================================
    // SCENE STATE
    // ========================================================================
    scene: createScene(),
    
    // ========================================================================
    // PAGE STATE
    // ========================================================================
    currentPage: 0,
    totalPages: 1,
    
    // ========================================================================
    // SELECTION STATE
    // ========================================================================
    selectedNodeIds: [],
    isMultiSelect: false,
    
    // ========================================================================
    // UI STATE
    // ========================================================================
    zoom: 1,
    isPanning: false,
    panOffset: { x: 0, y: 0 },
    showGrid: false,
    snapToGrid: true,
    gridSize: 20,
    
    // Panels
    leftPanelOpen: true,
    rightPanelOpen: true,
    inspectorOpen: false,
    
    // Active tools
    activeTool: 'select', // select, text, shape, pan
    
    // ========================================================================
    // HISTORY STATE (Undo/Redo)
    // ========================================================================
    history: [],
    historyIndex: -1,
    
    // ========================================================================
    // SAVING STATE
    // ========================================================================
    isDirty: false,
    isSaving: false,
    lastSaved: null,
    
    // ========================================================================
    // SCENE ACTIONS
    // ========================================================================
    
    initScene: (sceneData) => set(state => {
      state.scene = { ...createScene(), ...sceneData };
      state.history = [createHistoryState(state.scene)];
      state.historyIndex = 0;
      state.isDirty = false;
    }),
    
    setSceneName: (name) => set(state => {
      state.scene.name = name;
      state.isDirty = true;
    }),
    
    setSceneSize: (width, height) => set(state => {
      state.scene.width = width;
      state.scene.height = height;
      state.isDirty = true;
    }),
    
    // ========================================================================
    // PAGE ACTIONS
    // ========================================================================
    
    setCurrentPage: (pageIndex) => set(state => {
      if (pageIndex >= 0 && pageIndex < state.totalPages) {
        state.currentPage = pageIndex;
        state.selectedNodeIds = [];
      }
    }),
    
    addPage: () => {
      set(state => {
        state.totalPages += 1;
        state.scene.totalPages = state.totalPages;
        state.currentPage = state.totalPages - 1;
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    removePage: (pageIndex) => {
      const { totalPages, scene } = get();
      if (totalPages <= 1) return; // Мінімум 1 сторінка
      
      set(state => {
        // Видаляємо всі ноди на цій сторінці
        state.scene.nodes = state.scene.nodes.filter(n => n.pageIndex !== pageIndex);
        // Оновлюємо pageIndex для нод на наступних сторінках
        state.scene.nodes.forEach(n => {
          if (n.pageIndex > pageIndex) {
            n.pageIndex -= 1;
          }
        });
        state.totalPages -= 1;
        state.scene.totalPages = state.totalPages;
        if (state.currentPage >= state.totalPages) {
          state.currentPage = state.totalPages - 1;
        }
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    getNodesForPage: (pageIndex) => {
      const { scene } = get();
      return scene.nodes.filter(n => n.pageIndex === pageIndex);
    },
    
    // ========================================================================
    // NODE ACTIONS
    // ========================================================================
    
    addNode: (node) => {
      const { currentPage } = get();
      set(state => {
        // Додаємо pageIndex до нової ноди
        const nodeWithPage = { ...node, pageIndex: currentPage };
        state.scene.nodes = addNode(state.scene.nodes, nodeWithPage);
        state.selectedNodeIds = [nodeWithPage.id];
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    updateNode: (nodeId, updates) => {
      set(state => {
        state.scene.nodes = updateNode(state.scene.nodes, nodeId, updates);
        state.isDirty = true;
      });
    },
    
    updateNodeWithHistory: (nodeId, updates) => {
      set(state => {
        state.scene.nodes = updateNode(state.scene.nodes, nodeId, updates);
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    removeNode: (nodeId) => {
      set(state => {
        state.scene.nodes = removeNode(state.scene.nodes, nodeId);
        state.selectedNodeIds = state.selectedNodeIds.filter(id => id !== nodeId);
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    removeSelectedNodes: () => {
      const { selectedNodeIds } = get();
      if (selectedNodeIds.length === 0) return;
      
      set(state => {
        state.scene.nodes = removeNodes(state.scene.nodes, selectedNodeIds);
        state.selectedNodeIds = [];
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    duplicateNode: (nodeId) => {
      set(state => {
        state.scene.nodes = duplicateNode(state.scene.nodes, nodeId);
        const newNode = state.scene.nodes[state.scene.nodes.length - 1];
        state.selectedNodeIds = [newNode.id];
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    duplicateSelectedNodes: () => {
      const { selectedNodeIds, scene } = get();
      if (selectedNodeIds.length === 0) return;
      
      set(state => {
        const newIds = [];
        selectedNodeIds.forEach((id, index) => {
          state.scene.nodes = duplicateNode(
            state.scene.nodes, 
            id, 
            { x: 20 + index * 10, y: 20 + index * 10 }
          );
          const newNode = state.scene.nodes[state.scene.nodes.length - 1];
          newIds.push(newNode.id);
        });
        state.selectedNodeIds = newIds;
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    // Toggle lock/visibility
    toggleNodeLock: (nodeId) => {
      set(state => {
        state.scene.nodes = toggleNodeLockOp(state.scene.nodes, nodeId);
        state.isDirty = true;
      });
    },
    
    toggleNodeVisibility: (nodeId) => {
      set(state => {
        state.scene.nodes = toggleNodeVisibilityOp(state.scene.nodes, nodeId);
        state.isDirty = true;
      });
    },
    
    // ========================================================================
    // LAYER ACTIONS
    // ========================================================================
    
    bringToFront: (nodeId) => {
      set(state => {
        state.scene.nodes = bringToFront(state.scene.nodes, nodeId || state.selectedNodeIds[0]);
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    sendToBack: (nodeId) => {
      set(state => {
        state.scene.nodes = sendToBack(state.scene.nodes, nodeId || state.selectedNodeIds[0]);
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    bringForward: (nodeId) => {
      set(state => {
        state.scene.nodes = bringForward(state.scene.nodes, nodeId || state.selectedNodeIds[0]);
        state.isDirty = true;
      });
    },
    
    sendBackward: (nodeId) => {
      set(state => {
        state.scene.nodes = sendBackward(state.scene.nodes, nodeId || state.selectedNodeIds[0]);
        state.isDirty = true;
      });
    },
    
    // ========================================================================
    // BACKGROUND ACTIONS
    // ========================================================================
    
    setBackgroundColor: (color) => {
      set(state => {
        state.scene.background = {
          ...state.scene.background,
          type: BackgroundType.COLOR,
          value: color
        };
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    setBackgroundGradient: (colors, direction = 'to bottom') => {
      set(state => {
        state.scene.background = {
          ...state.scene.background,
          type: BackgroundType.GRADIENT,
          gradientColors: colors,
          gradientDirection: direction
        };
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    setBackgroundImage: (imageUrl, fit = 'cover') => {
      set(state => {
        state.scene.background = {
          ...state.scene.background,
          type: BackgroundType.IMAGE,
          imageUrl,
          imageFit: fit
        };
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    // Universal background setter
    setSceneBackground: (background) => {
      set(state => {
        state.scene.background = {
          ...state.scene.background,
          ...background
        };
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    // Scene size
    setSceneSize: (width, height) => {
      set(state => {
        state.scene.width = width;
        state.scene.height = height;
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    // ========================================================================
    // TEMPLATE ACTIONS
    // ========================================================================
    
    applyTemplate: (templateId, products) => {
      const { scene } = get();
      const nodes = applyTemplate(templateId, products, scene.width, scene.height);
      
      set(state => {
        state.scene.nodes = nodes;
        state.selectedNodeIds = [];
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    // Apply layout template to existing nodes
    applyLayoutTemplate: (templateId) => {
      const { scene } = get();
      const { LAYOUT_TEMPLATES } = require('../domain/moodboard.types');
      
      const template = LAYOUT_TEMPLATES.find(t => t.id === templateId);
      if (!template || scene.nodes.length === 0) return;
      
      const cells = template.cells;
      
      set(state => {
        state.scene.nodes.forEach((node, index) => {
          if (index < cells.length) {
            const cell = cells[index];
            node.x = (cell.x / 100) * state.scene.width;
            node.y = (cell.y / 100) * state.scene.height;
            node.width = (cell.width / 100) * state.scene.width;
            node.height = (cell.height / 100) * state.scene.height;
          }
        });
        state.isDirty = true;
      });
      get()._pushHistory();
    },
    
    // ========================================================================
    // SELECTION ACTIONS
    // ========================================================================
    
    selectNode: (nodeId, addToSelection = false) => set(state => {
      if (addToSelection) {
        if (state.selectedNodeIds.includes(nodeId)) {
          state.selectedNodeIds = state.selectedNodeIds.filter(id => id !== nodeId);
        } else {
          state.selectedNodeIds.push(nodeId);
        }
        state.isMultiSelect = state.selectedNodeIds.length > 1;
      } else {
        state.selectedNodeIds = [nodeId];
        state.isMultiSelect = false;
      }
      state.inspectorOpen = state.selectedNodeIds.length > 0;
    }),
    
    selectNodes: (nodeIds) => set(state => {
      state.selectedNodeIds = nodeIds;
      state.isMultiSelect = nodeIds.length > 1;
      state.inspectorOpen = nodeIds.length > 0;
    }),
    
    selectMultipleNodes: (nodeIds) => set(state => {
      state.selectedNodeIds = [...new Set(nodeIds)]; // Remove duplicates
      state.isMultiSelect = state.selectedNodeIds.length > 1;
      state.inspectorOpen = state.selectedNodeIds.length > 0;
    }),
    
    selectAll: () => set(state => {
      state.selectedNodeIds = state.scene.nodes.map(n => n.id);
      state.isMultiSelect = state.selectedNodeIds.length > 1;
    }),
    
    clearSelection: () => set(state => {
      state.selectedNodeIds = [];
      state.isMultiSelect = false;
      state.inspectorOpen = false;
    }),
    
    // ========================================================================
    // ZOOM & PAN ACTIONS
    // ========================================================================
    
    setZoom: (zoom) => set(state => {
      state.zoom = Math.max(0.1, Math.min(3, zoom));
    }),
    
    zoomIn: () => set(state => {
      state.zoom = Math.min(3, state.zoom + 0.1);
    }),
    
    zoomOut: () => set(state => {
      state.zoom = Math.max(0.1, state.zoom - 0.1);
    }),
    
    resetZoom: () => set(state => {
      state.zoom = 1;
      state.panOffset = { x: 0, y: 0 };
    }),
    
    setPanOffset: (offset) => set(state => {
      state.panOffset = offset;
    }),
    
    // ========================================================================
    // UI ACTIONS
    // ========================================================================
    
    setActiveTool: (tool) => set(state => {
      state.activeTool = tool;
    }),
    
    toggleGrid: () => set(state => {
      state.showGrid = !state.showGrid;
    }),
    
    toggleSnapToGrid: () => set(state => {
      state.snapToGrid = !state.snapToGrid;
    }),
    
    setGridSize: (size) => set(state => {
      state.gridSize = size;
    }),
    
    toggleLeftPanel: () => set(state => {
      state.leftPanelOpen = !state.leftPanelOpen;
    }),
    
    toggleRightPanel: () => set(state => {
      state.rightPanelOpen = !state.rightPanelOpen;
    }),
    
    toggleInspector: () => set(state => {
      state.inspectorOpen = !state.inspectorOpen;
    }),
    
    // ========================================================================
    // HISTORY ACTIONS (Undo/Redo)
    // ========================================================================
    
    _pushHistory: () => set(state => {
      // Видаляємо все після поточного індексу
      state.history = state.history.slice(0, state.historyIndex + 1);
      // Додаємо новий стан
      state.history.push(createHistoryState(state.scene));
      // Обмежуємо розмір історії
      if (state.history.length > MAX_HISTORY) {
        state.history = state.history.slice(-MAX_HISTORY);
      }
      state.historyIndex = state.history.length - 1;
    }),
    
    undo: () => {
      const { historyIndex, history } = get();
      if (historyIndex <= 0) return;
      
      set(state => {
        state.historyIndex = historyIndex - 1;
        state.scene = JSON.parse(JSON.stringify(history[state.historyIndex].scene));
        state.selectedNodeIds = [];
        state.isDirty = true;
      });
    },
    
    redo: () => {
      const { historyIndex, history } = get();
      if (historyIndex >= history.length - 1) return;
      
      set(state => {
        state.historyIndex = historyIndex + 1;
        state.scene = JSON.parse(JSON.stringify(history[state.historyIndex].scene));
        state.selectedNodeIds = [];
        state.isDirty = true;
      });
    },
    
    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,
    
    // ========================================================================
    // SAVE ACTIONS
    // ========================================================================
    
    setSaving: (isSaving) => set(state => {
      state.isSaving = isSaving;
    }),
    
    markSaved: () => set(state => {
      state.isDirty = false;
      state.lastSaved = new Date().toISOString();
    }),
    
    // ========================================================================
    // GETTERS
    // ========================================================================
    
    getSelectedNodes: () => {
      const { scene, selectedNodeIds } = get();
      return scene.nodes.filter(n => selectedNodeIds.includes(n.id));
    },
    
    getNodeById: (nodeId) => {
      return get().scene.nodes.find(n => n.id === nodeId);
    },
    
    getSortedNodes: () => {
      const { scene, currentPage } = get();
      // Фільтруємо ноди для поточної сторінки
      const pageNodes = scene.nodes.filter(n => n.pageIndex === currentPage);
      return sortNodesByZIndex(pageNodes);
    },
    
    getAllNodes: () => {
      return sortNodesByZIndex(get().scene.nodes);
    }
  }))
);

export default useMoodboardStore;
