
import React from 'react';
import { SettingsDialog } from '../settings/SettingsDialog';
import { ArchiveManager } from '../export/ArchiveManager';
import { ContextInspectorPanel } from '../debug/ContextInspectorPanel';
import { ModelComparisonView } from '../evaluation/ModelComparisonView';
import { ExportDialog } from '../export/ExportDialog';
import { DocumentUpload } from '../graphrag/DocumentUpload';
import type { OpenModal, SidebarConversation } from '../chat/types';
import type { UserSettings } from '@/lib/settings/types';
import type { User } from '@supabase/supabase-js';
import type { ContextUsage } from '../../lib/context/types';
import type { JsonValue } from '@/lib/types';

interface Session {
  access_token: string;
}

interface ModalManagerProps {
  openModal: OpenModal;
  onClose: () => void;
  user: User | null;
  session: Session | null;
  userSettings: UserSettings | null;
  onSettingsSave: (settings: UserSettings) => void;
  activeId: string;
  conversations: SidebarConversation[];
  onRestore: () => void;
  contextUsage: ContextUsage | null;
  isWidgetMode: boolean;
  widgetConfig: JsonValue;
  refetchDocuments: () => void;
}

export function ModalManager({
  openModal,
  onClose,
  user,
  session,
  onSettingsSave,
  activeId,
  onRestore,
  contextUsage,
  refetchDocuments
}: ModalManagerProps) {
  if (!openModal) {
    return null;
  }

  switch (openModal) {
    case 'settings':
      return <SettingsDialog isOpen={true} onClose={onClose} sessionToken={session?.access_token} onSettingsChange={onSettingsSave} />;
    case 'archive-manager':
      return <ArchiveManager onClose={onClose} onRestore={onRestore} />;
    case 'context-inspector':
      return <ContextInspectorPanel open={true} onClose={onClose} usage={contextUsage} />;
    case 'model-comparison':
      return <ModelComparisonView open={true} onClose={onClose} sessionToken={session?.access_token} />;
    case 'export-dialog':
      return <ExportDialog conversationIds={[activeId]} onClose={onClose} />;
    case 'knowledge-base':
      return <DocumentUpload userId={user?.id || ''} onUploadComplete={refetchDocuments} />;
    default:
      return null;
  }
}
