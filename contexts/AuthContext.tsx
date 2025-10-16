"use client";

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { appConfig } from "../lib/config/app";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithOAuth: (provider: 'github' | 'google', scopes?: string[]) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const logSessionEvent = useCallback(
    async (event: string) => {
      if (!user) {
        if (appConfig.debug.auth) {
          console.log('[AuthContext] Skipping session log - no user');
        }
        return;
      }

      if (appConfig.debug.auth) {
        console.log('[AuthContext] Logging session event:', event, 'for user:', user.id);
      }
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
    if (appConfig.debug.auth) {
      console.log('[AuthContext] Setting up auth state listener');
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (appConfig.debug.auth) {
        console.log('[AuthContext] Auth state changed:', event, 'user:', session?.user);
      }
      setSession(session);
      if (session?.user && typeof session.user === 'object' && 'id' in session.user) {
        setUser(session.user);
      } else {
        console.warn('[AuthContext] Invalid user object in session:', session?.user);
        setUser(null);
      }
      setLoading(false);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        logSessionEvent(event.toLowerCase());
      }
    });

    if (appConfig.debug.auth) {
      console.log('[AuthContext] Getting initial session');
    }
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('[AuthContext] Error getting session:', error);
      } else if (appConfig.debug.auth) {
        console.log('[AuthContext] Initial session:', data.session?.user);
      }
      setSession(data.session);
      if (data.session?.user && typeof data.session.user === 'object' && 'id' in data.session.user) {
        setUser(data.session.user);
      } else {
        console.warn('[AuthContext] Invalid user object in initial session:', data.session?.user);
        setUser(null);
      }
      setLoading(false);
    });
    
    return () => {
      if (appConfig.debug.auth) {
        console.log('[AuthContext] Cleaning up auth listener');
      }
      listener.subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // NOTE: logSessionEvent intentionally excluded to prevent infinite loop from recreating auth listener

  async function signUp(email: string, password: string) {
    if (appConfig.debug.auth) {
      console.log('[AuthContext] Attempting signup for:', email);
    }
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error('[AuthContext] Signup error:', error);
    } else if (appConfig.debug.auth) {
      console.log('[AuthContext] Signup successful for:', email);
    }
    return { error: error?.message || null };
  }

  async function signIn(email: string, password: string) {
    if (appConfig.debug.auth) {
      console.log('[AuthContext] Attempting sign in for:', email);
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[AuthContext] Sign in error:', error);
    } else if (appConfig.debug.auth) {
      console.log('[AuthContext] Sign in successful for:', email);
    }
    return { error: error?.message || null };
  }

  async function signInWithOAuth(provider: 'github' | 'google', scopes?: string[]) {
    if (appConfig.debug.auth) {
      console.log('[AuthContext] OAuth sign in with:', provider, 'scopes:', scopes);
    }

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
    if (appConfig.debug.auth) {
      console.log('[AuthContext] Signing out user:', user?.email);
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[AuthContext] Sign out error:', error);
    } else if (appConfig.debug.auth) {
      console.log('[AuthContext] Sign out successful');
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
