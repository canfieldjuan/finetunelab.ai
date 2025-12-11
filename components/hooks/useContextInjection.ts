// Hook to manage context injection preference
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useContextInjection() {
  const { user, session } = useAuth();
  const [enabled, setEnabled] = useState<boolean>(true); // Default to enabled
  const [loading, setLoading] = useState<boolean>(true);

  // Load preference on mount
  useEffect(() => {
    if (!user || !session) {
      setLoading(false);
      return;
    }

    loadPreference();
  }, [user, session]);

  const loadPreference = async () => {
    if (!user || !session?.access_token) return;

    try {
      const response = await fetch('/api/user/context-preference', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEnabled(data.enabled);
      }
    } catch (error) {
      console.error('Failed to load context preference:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEnabled = async () => {
    if (!user || !session?.access_token) return;

    const newValue = !enabled;

    // Optimistic update
    setEnabled(newValue);

    try {
      const response = await fetch('/api/user/context-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ enabled: newValue }),
      });

      if (!response.ok) {
        // Revert on error
        setEnabled(!newValue);
        const errorText = await response.text();
        console.error('Failed to update context preference:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
      }
    } catch (error) {
      // Revert on error
      setEnabled(!newValue);
      console.error('Failed to update context preference:', error);
    }
  };

  return {
    enabled,
    loading,
    toggleEnabled,
  };
}
