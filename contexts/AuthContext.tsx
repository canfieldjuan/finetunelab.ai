"use client";

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export interface UserProfileData {
  firstName: string;
  lastName: string;
  companyName: string;
  companyEmail?: string;
  roleInCompany: string;
  teamSize?: number;
  finetuningType: 'SFT' | 'DPO' | 'RLHF' | 'ORPO' | 'Teacher Mode' | 'Multiple' | 'Undecided';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, profileData?: UserProfileData) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithOAuth: (provider: 'github' | 'google', scopes?: string[]) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const logSessionEvent = useCallback(
    async (event: string) => {
      if (!user) {
        console.log('[AuthContext] Skipping session log - no user');
        return;
      }

      console.log('[AuthContext] Logging session event:', event, 'for user:', user.id);
      const { error } = await supabase
        .from('session_logs')
        .insert({ user_id: user.id, event });

      if (error) {
        console.error('[AuthContext] Error logging session event:', error);
      }
    },
    [user]
  );

  useEffect(() => {
    console.log('[AuthContext] Setting up auth state listener');

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] Auth state changed:', event, 'user:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Log relevant events
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        logSessionEvent(event.toLowerCase());
      }

      // Handle token refresh
      if (event === "TOKEN_REFRESHED") {
        console.log('[AuthContext] Token refreshed successfully');
        logSessionEvent('token_refreshed');
      }
    });

    console.log('[AuthContext] Getting initial session');
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('[AuthContext] Error getting session:', error);
      } else {
        console.log('[AuthContext] Initial session:', data.session?.user?.email || 'no user');
      }
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => {
      console.log('[AuthContext] Cleaning up auth listener');
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount, logSessionEvent is used in closure

  // Proactive token refresh - check every 5 minutes and refresh if needed
  useEffect(() => {
    const checkAndRefreshToken = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[AuthContext] Error checking session:', error);
          return;
        }

        if (!currentSession) {
          // No session, skip silently (user not logged in)
          return;
        }

        // Check if token expires in next 10 minutes
        const expiresAt = currentSession.expires_at;
        if (expiresAt) {
          const expiresIn = expiresAt - Math.floor(Date.now() / 1000);
          const tenMinutes = 10 * 60;

          if (expiresIn < tenMinutes) {
            console.log('[AuthContext] Token expires soon (in', Math.floor(expiresIn / 60), 'minutes), refreshing...');
            const { data, error: refreshError } = await supabase.auth.refreshSession();

            if (refreshError) {
              console.error('[AuthContext] Error refreshing token:', refreshError);
            } else if (data.session) {
              console.log('[AuthContext] Token refreshed proactively. New expiry:', new Date(data.session.expires_at! * 1000).toLocaleTimeString());
              // Don't manually set session/user - onAuthStateChange will handle it
            }
          }
        }
      } catch (err) {
        console.error('[AuthContext] Exception during token refresh check:', err);
      }
    };

    // Check immediately on mount
    checkAndRefreshToken();

    // Then check every 5 minutes
    const interval = setInterval(checkAndRefreshToken, 5 * 60 * 1000);

    return () => {
      console.log('[AuthContext] Cleaning up token refresh interval');
      clearInterval(interval);
    };
  }, []); // Empty deps - run once on mount, interval persists for component lifetime

  async function signUp(email: string, password: string, profileData?: UserProfileData) {
    console.log('[AuthContext] Attempting signup for:', email);
    const { data, error } = await supabase.auth.signUp({ email, password });
    
    if (error) {
      console.error('[AuthContext] Signup error:', error);
      return { error: error.message };
    }
    
    console.log('[AuthContext] Signup successful for:', email);
    
    // If profile data provided and user was created, store it
    if (profileData && data.user) {
      console.log('[AuthContext] Storing user profile data for:', data.user.id);
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: data.user.id,
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          company_name: profileData.companyName,
          company_email: profileData.companyEmail || null,
          role_in_company: profileData.roleInCompany,
          team_size: profileData.teamSize || null,
          finetuning_type: profileData.finetuningType,
        });
      
      if (profileError) {
        console.error('[AuthContext] Error storing user profile:', profileError);
        // Don't fail the signup, but log the error
        return { error: `Account created but profile data failed to save: ${profileError.message}` };
      }
      
      console.log('[AuthContext] User profile stored successfully');
    }
    
    return { error: null };
  }

  async function signIn(email: string, password: string) {
    console.log('[AuthContext] Attempting sign in for:', email);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[AuthContext] Sign in error:', error);
    } else {
      console.log('[AuthContext] Sign in successful for:', email);
    }
    return { error: error?.message || null };
  }

  async function signInWithOAuth(provider: 'github' | 'google', scopes?: string[]) {
    console.log('[AuthContext] OAuth sign in with:', provider, 'scopes:', scopes);

    const options: { redirectTo: string; scopes?: string } = {
      redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/chat`,
    };

    if (scopes && scopes.length > 0) {
      options.scopes = scopes.join(' ');
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: options
    });

    if (error) {
      console.error('[AuthContext] OAuth error:', error);
      return { error: error.message };
    }

    return { error: null };
  }

  async function signOut() {
    console.log('[AuthContext] Signing out user:', user?.email);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[AuthContext] Sign out error:', error);
    } else {
      console.log('[AuthContext] Sign out successful, redirecting to login');
      router.push('/login');
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithOAuth, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
