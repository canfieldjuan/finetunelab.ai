/**
 * Worker Agent Management Component
 * Main management interface with setup and worker list sections
 * Date: 2025-12-30
 */

'use client';

import React, { useState } from 'react';
import { WorkerAgentSetupSection } from './WorkerAgentSetupSection';
import { WorkerAgentListSection } from './WorkerAgentListSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, List } from 'lucide-react';

interface WorkerAgentManagementProps {
  userId: string;
  sessionToken: string;
}

export function WorkerAgentManagement({ userId, sessionToken }: WorkerAgentManagementProps) {
  const [activeTab, setActiveTab] = useState<'setup' | 'workers'>('setup');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Callback to refresh worker list after setup
  const handleWorkerRegistered = () => {
    setRefreshTrigger((prev) => prev + 1);
    setActiveTab('workers');
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'setup' | 'workers')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="setup" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <span>Setup & Download</span>
          </TabsTrigger>
          <TabsTrigger value="workers" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            <span>My Workers</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-6">
          <WorkerAgentSetupSection
            sessionToken={sessionToken}
            onWorkerRegistered={handleWorkerRegistered}
          />
        </TabsContent>

        <TabsContent value="workers" className="mt-6">
          <WorkerAgentListSection
            userId={userId}
            sessionToken={sessionToken}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
