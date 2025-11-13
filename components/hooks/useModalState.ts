
import { useState } from 'react';
import type { OpenModal } from '../chat/types';

/**
 * Hook for managing modal and menu visibility state.
 * Handles modal dialogs, menu dropdowns, and loading indicators.
 */
export function useModalState() {
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const [evaluatingMessageId, setEvaluatingMessageId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  return {
    openModal,
    setOpenModal,
    evaluatingMessageId,
    setEvaluatingMessageId,
    openMenuId,
    setOpenMenuId,
    archivingId,
    setArchivingId,
  };
}
