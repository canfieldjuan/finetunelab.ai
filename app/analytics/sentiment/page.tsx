/**
 * Sentiment Analysis Dashboard Page
 *
 * Dedicated page for comprehensive sentiment analysis and insights.
 * Provides detailed views of sentiment trends, patterns, and anomalies.
 *
 * Phase 3.4: Sentiment Dashboard
 * Date: 2025-10-25
 */

'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { SentimentDashboard } from '@/components/analytics/SentimentDashboard';

export default function SentimentAnalyticsPage() {
  console.log('[SentimentAnalyticsPage] Rendering');

  const { user, signOut, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('[SentimentAnalyticsPage] Auth state:', { user: user?.email, loading });

    if (!loading && !user) {
      console.warn('[SentimentAnalyticsPage] No authenticated user, redirecting to login');
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">Authentication Required</h2>
          <p className="text-yellow-700 mb-4">You must be logged in to access sentiment analytics.</p>
          <p className="text-sm text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar currentPage="analytics" user={user} signOut={signOut} />
      <div className="flex-1 overflow-y-auto">
        <SentimentDashboard />
      </div>
    </div>
  );
}
