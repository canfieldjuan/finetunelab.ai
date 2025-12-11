/**
 * DAG Pipeline Management Page
 *
 * Main page integrating DAG builder, execution dashboard, and template library
 */

'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DagBuilder, DagBuilderRef } from '@/components/training/dag/DagBuilder';
import { ExecutionList } from '@/components/training/dag/ExecutionList';
import { ExecutionDetail } from '@/components/training/dag/ExecutionDetail';
import { TemplateLibrary } from '@/components/training/dag/TemplateLibrary';
import { Template } from '@/components/training/dag/types';
import { jobConfigsToDag } from '@/components/training/dag/dag-client';

export default function DagPage() {
  console.log('[DagPage] Rendering DAG management page');

  const [activeTab, setActiveTab] = useState('builder');
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const dagBuilderRef = useRef<DagBuilderRef>(null);

  const handleSelectExecution = (id: string) => {
    console.log('[DagPage] Selected execution:', id);
    setSelectedExecutionId(id);
    setActiveTab('executions');
  };

  const handleCloseExecutionDetail = () => {
    console.log('[DagPage] Closing execution detail');
    setSelectedExecutionId(null);
  };

  const handleLoadTemplate = (template: Template) => {
    console.log('[DagPage] Loading template:', template.name);
    const { nodes, edges } = jobConfigsToDag(template.config.jobs);
    console.log('[DagPage] Converted to', nodes.length, 'nodes and', edges.length, 'edges');
    
    // Load into builder via ref
    if (dagBuilderRef.current) {
      dagBuilderRef.current.loadNodes(nodes, edges);
      console.log('[DagPage] Template loaded into builder');
    }
    
    setActiveTab('builder');
  };

  const handleExecuteTemplate = async (template: Template) => {
    console.log('[DagPage] Executing template:', template.name);
    setActiveTab('executions');
  };

  const handleCreateNew = () => {
    console.log('[DagPage] Creating new DAG');
    setActiveTab('builder');
  };

  /**
   * Handle workflow execution completion - navigate to executions tab
   */
  const handleExecutionComplete = (executionId: string) => {
    console.log('[DagPage] Workflow execution started:', executionId);
    setSelectedExecutionId(executionId);
    setActiveTab('executions');
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        {/* Back to Training button */}
        <Link href="/training">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Training
          </Button>
        </Link>

        <h1 className="text-3xl font-bold">
          DAG Pipeline Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Build, execute, and monitor training pipeline workflows
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="executions">Executions</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="mt-6">
          <div className="bg-card rounded-lg border border-border">
            <div className="h-[calc(100vh-220px)]">
              <DagBuilder 
                ref={dagBuilderRef}
                onExecute={handleExecutionComplete}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="executions" className="mt-6">
          {selectedExecutionId ? (
            <ExecutionDetail
              executionId={selectedExecutionId}
              onClose={handleCloseExecutionDetail}
            />
          ) : (
            <ExecutionList onSelectExecution={handleSelectExecution} />
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <TemplateLibrary
            onLoadTemplate={handleLoadTemplate}
            onExecuteTemplate={handleExecuteTemplate}
            onCreateNew={handleCreateNew}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
