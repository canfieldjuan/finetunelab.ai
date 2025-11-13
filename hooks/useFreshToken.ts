/**
 * Hook to get fresh authentication token
 *
 * This hook provides a way to get the current session token without
 * causing unnecessary re-renders. It uses a ref to track the latest
 * session and provides a function to get the token on-demand.
 *
 * Usage:
 *   const getFreshToken = useFreshToken();
 *
 *   // Later, when making API call:
 *   const token = getFreshToken();
 *   fetch('/api/endpoint', {
 *     headers: { 'Authorization': `Bearer ${token}` }
 *   });
 *
 * This solves the issue where components capture stale tokens in closures
 * but can't add session to dependency arrays without causing infinite loops.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useFreshToken() {
  const { session } = useAuth();
  const sessionRef = useRef(session);

  // Keep ref updated with latest session
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Return function that always gets current token
  const getFreshToken = useCallback((): string | null => {
    return sessionRef.current?.access_token ?? null;
  }, []);

  return getFreshToken;
}

/**
 * Hook to get fresh session object
 *
 * Similar to useFreshToken but returns the entire session object.
 * Use this when you need access to other session properties besides the token.
 */
export function useFreshSession() {
  const { session } = useAuth();
  const sessionRef = useRef(session);

  // Keep ref updated with latest session
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Return function that always gets current session
  const getFreshSession = useCallback(() => {
    return sessionRef.current;
  }, []);

  return getFreshSession;
}
