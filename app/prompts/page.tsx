"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { LoadingState } from '@/components/ui/LoadingState';
import { PromptVersionManager } from '@/components/prompts/PromptVersionManager';

export default function PromptsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <LoadingState fullScreen message="Loading authentication..." />;
  }

  if (!user) {
    return null;
  }

  return (
    <PageWrapper user={user}>
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Prompt Management</h1>
        <PromptVersionManager promptName="default_system_prompt" />
      </div>
    </PageWrapper>
  );
}
