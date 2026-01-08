/**
 * Training Agent Page
 * Download, configure, and monitor local training agents
 * Date: 2026-01-07
 */

'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import { TrainingAgentSetup } from '@/components/workers/TrainingAgentSetup';
import { TrainingAgentStatus } from '@/components/workers/TrainingAgentStatus';

export default function WorkersPage() {
  const { user, signOut, session } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to manage training agents.</p>
      </div>
    );
  }

  return (
    <PageWrapper currentPage="workers" user={user} signOut={signOut}>
      <PageHeader
        title="Training Agent"
        description="Download and run a local training agent to execute fine-tuning jobs on your own hardware"
      />

      <div className="space-y-8">
        {/* Agent Status Section */}
        {session?.access_token && (
          <TrainingAgentStatus sessionToken={session.access_token} />
        )}

        {/* Setup Section */}
        {session?.access_token && (
          <TrainingAgentSetup sessionToken={session.access_token} />
        )}
      </div>
    </PageWrapper>
  );
}
