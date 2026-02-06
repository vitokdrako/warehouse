/**
 * Moodboard Page
 * Сторінка редактора мудборду
 */

import React from 'react';
import MoodboardShell from '../components/MoodboardShell';

const MoodboardPage = ({ 
  board,
  boardItems = [],
  onSave,
  onBack,
  onOpenCatalog
}) => {
  return (
    <MoodboardShell
      board={board}
      boardItems={boardItems}
      onSave={onSave}
      onBack={onBack}
      onOpenCatalog={onOpenCatalog}
    />
  );
};

export default MoodboardPage;
