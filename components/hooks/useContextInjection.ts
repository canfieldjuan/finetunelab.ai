// Hook to manage context injection preference
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useContextInjection() {
  const { user, session } = useAuth();

  // Initialize from localStorage if available, otherwise default to true
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('contextInjectionEnabled');
      if (stored !== null) {
        return stored === 'true';
      }
    }
    // Default to false to avoid green flash until server value loads
    return false;
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Debug: Watch state changes
  useEffect(() => {
    console.log('[useContextInjection] ===== STATE CHANGED ===== enabled is now:', enabled);
  }, [enabled]);

  // Load preference on mount
  useEffect(() => {
    console.log('[useContextInjection] useEffect triggered, user:', !!user, 'session:', !!session);

    if (!user || !session) {
      console.log('[useContextInjection] No user or session, skipping load');
      setLoading(false);
      return;
    }

    loadPreference();
  }, [user, session]);

  const loadPreference = async () => {
    if (!user || !session?.access_token) {
      console.log('[useContextInjection] Skipping load - missing user or token');
      setLoading(false);
      return;
    }

    try {
      console.log('[useContextInjection] Loading preference for user:', user.id);
      console.log('[useContextInjection] Token exists:', !!session.access_token, 'length:', session.access_token?.length);

      const response = await fetch('/api/user/context-preference', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      console.log('[useContextInjection] Response received, status:', response.status, 'ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('[useContextInjection] Loaded preference data:', data);
        console.log('[useContextInjection] Setting enabled to:', data.enabled);
        setEnabled(data.enabled);
        localStorage.setItem('contextInjectionEnabled', String(data.enabled));
        console.log('[useContextInjection] State updated');
      } else {
        console.error('[useContextInjection] Failed to load preference:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[useContextInjection] Failed to load context preference:', error);
      console.error('[useContextInjection] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('[useContextInjection] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[useContextInjection] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

      // Set loading to false even on error to prevent infinite loading state
      setLoading(false);
    } finally {
      console.log('[useContextInjection] loadPreference complete');
      if (loading) {
        setLoading(false);
      }
    }
  };

  const toggleEnabled = async () => {
    console.log('[useContextInjection] toggleEnabled called');
    console.log('[useContextInjection] user:', !!user, 'session:', !!session?.access_token);

    if (!user || !session?.access_token) {
      console.log('[useContextInjection] BLOCKED: No user or session');
      return;
    }

    const newValue = !enabled;
    console.log('[useContextInjection] Current enabled:', enabled);
    console.log('[useContextInjection] New value:', newValue);
    console.log('[useContextInjection] Toggling from', enabled, 'to', newValue);

    // Optimistic update
    setEnabled(newValue);
    localStorage.setItem('contextInjectionEnabled', String(newValue));
    console.log('[useContextInjection] State and localStorage updated');

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
        localStorage.setItem('contextInjectionEnabled', String(!newValue));
        const errorText = await response.text();
        console.error('[useContextInjection] Failed to update context preference:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
      } else {
        const data = await response.json();
        console.log('[useContextInjection] Successfully saved preference:', data);
      }
    } catch (error) {
      // Revert on error
      setEnabled(!newValue);
      localStorage.setItem('contextInjectionEnabled', String(!newValue));
      console.error('[useContextInjection] Failed to update context preference:', error);
      console.error('[useContextInjection] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('[useContextInjection] Error message:', error instanceof Error ? error.message : String(error));
    }
  };

  return {
    enabled,
    loading,
    toggleEnabled,
  };
}
