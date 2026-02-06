/**
 * Moodboard Module
 * Точка входу для модуля мудборду
 */

// Main component
export { default as MoodboardPage } from './app/MoodboardPage';
export { default as MoodboardShell } from './components/MoodboardShell';

// Canvas components
export { default as CanvasStage } from './components/canvas/CanvasStage';
export { default as DecorItemNode } from './components/canvas/DecorItemNode';
export { default as TextNode } from './components/canvas/TextNode';

// Panels
export { default as TopBar } from './components/panels/TopBar';
export { default as LeftPanel } from './components/panels/LeftPanel';
export { default as RightPanel } from './components/panels/RightPanel';

// Store
export { default as useMoodboardStore } from './store/moodboardStore';

// Domain
export * from './domain/moodboard.types';
export * from './domain/moodboard.ops';

// Utils
export * from './utils/imageUtils';
