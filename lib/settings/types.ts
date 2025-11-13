/**
 * User Settings Types
 * Date: 2025-10-24
 */

export interface UserSettings {
  id: string;
  userId: string;

  // Voice & Audio Settings
  ttsEnabled: boolean;
  ttsVoiceUri: string | null;
  ttsAutoPlay: boolean;
  ttsRate: number;
  sttEnabled: boolean;

  // Future settings
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface UserSettingsUpdate {
  // Voice & Audio Settings
  ttsEnabled?: boolean;
  ttsVoiceUri?: string | null;
  ttsAutoPlay?: boolean;
  ttsRate?: number;
  sttEnabled?: boolean;

  // Future settings
  theme?: 'light' | 'dark' | 'system';
  fontSize?: 'small' | 'medium' | 'large';
}

export interface UserSettingsResponse {
  settings: UserSettings | null;
  error?: string;
}
