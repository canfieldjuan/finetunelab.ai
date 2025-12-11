
import { useState, useEffect } from 'react';
import { log } from '../../lib/utils/logger';
import type { UserSettings } from '@/lib/settings/types';

interface Session {
  access_token: string;
}

/**
 * A hook for managing user settings.
 * @param userId - The ID of the current user.
 * @param session - The current session.
 * @returns The user settings and a function to update them.
 */
export function useSettings(userId: string | null, session: Session | null) {
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      if (!userId || !session?.access_token) {
        return;
      }

      try {
        log.debug('useSettings', 'Loading user settings');
        const response = await fetch('/api/settings', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to load settings: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        if (data.settings) {
          setUserSettings(data.settings);
        }
      } catch (error) {
        log.error('useSettings', 'Error loading settings', { error });
      }
    };

    loadSettings();
  }, [userId, session?.access_token]);

  return { userSettings, setUserSettings };
}
