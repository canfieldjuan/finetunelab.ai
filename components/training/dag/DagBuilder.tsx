/**
 * DAG Builder Component
 *
 * Visual DAG builder with drag-and-drop node creation and connection
 */

'use client';

import { useCallback, useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  NodeTypes,
  Edge,
  ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { JobType } from '@/lib/training/dag-orchestrator';
import { DagNode as DagNodeComponent } from './DagNode';
import { DagNode, Template } from './types';
import { DagToolbar } from './DagToolbar';
import { DagSidebar } from './DagSidebar';
import { validateDAG, saveTemplate, dagToJobConfigs, jobConfigsToDag } from './dag-client';
import { servicesConfig } from '@/lib/config/services';

export interface DagBuilderRef {
  addNode: (type: JobType) => void;
  getNodes: () => DagNode[];
  getEdges: () => Edge[];
  clearCanvas: () => void;
  loadNodes: (nodes: DagNode[], edges: Edge[]) => void;
}

export interface DagBuilderProps {
  initialNodes?: DagNode[];
  initialEdges?: Edge[];
  onValidate?: (result: { valid: boolean; errors?: string[] }) => void;
  onSave?: (templateId: string) => void;
  onExecute?: (executionId: string) => void;
}

const DagBuilderComponent = forwardRef<DagBuilderRef, DagBuilderProps>(({ 
  initialNodes = [],
  initialEdges = [],
 
  onExecute: onExecuteCallback 
}, ref) => {
  console.log('[DagBuilder] Initializing component');

  const [nodes, setNodes, onNodesChange] = useNodesState<DagNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Register custom node type
  const nodeTypes: NodeTypes = useMemo(
    () => ({
      custom: DagNodeComponent,
    }),
    []
  );

  console.log('[DagBuilder] Current state - nodes:', nodes.length, 'edges:', edges.length);

  /**
   * Get default configuration for a job type
   */
  const getDefaultConfig = useCallback((type: JobType): Record<string, unknown> => {
    switch (type) {
      case 'training':
        return {
          provider: '',
          trainingConfigId: undefined,
          modelId: undefined,
          datasetId: undefined,
        };
      case 'preprocessing':
        return {
          inputPath: '',
          outputPath: '',
          operations: '',
          apiEndpoint: `${servicesConfig.training.serverUrl}/api`,
        };
      case 'validation':
        return {
          modelPath: '',
          testDataset: '',
          metrics: 'accuracy, f1',
          apiEndpoint: `${servicesConfig.training.serverUrl}/api`,
        };
      case 'deployment':
        return {
          modelPath: '',
          deploymentTarget: 'production',
          endpoint: '/v1/model',
          apiEndpoint: `${servicesConfig.training.serverUrl}/api`,
        };
      case 'regression-gate':
        return {
          baselineId: '',
          modelPath: '',
          testDatasetId: undefined,
          failureThreshold: 0.05,
          requiredMetrics: ['accuracy'],
          blockOnFailure: true,
        };
      default:
        return {};
    }
  }, []);

  /**
   * Add a new node to the canvas
   * Uses diagonal cascade positioning for better visibility
   */
  const addNode = useCallback((type: JobType) => {
    const timestamp = Date.now();
    const nodeId = `${type}_${timestamp}`;
    
    // Calculate diagonal cascade position
    // Nodes appear in a stair-step pattern going down and to the right
    const baseX = 50;  // Start closer to left edge
    const baseY = 50;  // Start higher up
    const offsetX = nodes.length * 40;  // Small horizontal step per node
    const offsetY = nodes.length * 40;  // Small vertical step per node
    
    const newNode: DagNode = {
      id: nodeId,
      type: 'custom',
      position: { 
        x: baseX + offsetX, 
        y: baseY + offsetY 
      },
      data: {
        id: nodeId,
        type,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Job`,
        config: getDefaultConfig(type),
        status: 'pending',
      },
    };

    console.log('[DagBuilder] Adding node:', {
      id: nodeId,
      type,
      position: newNode.position,
      totalNodes: nodes.length + 1,
      cascade: `Diagonal (${offsetX}px right, ${offsetY}px down)`
    });

    setNodes((nds) => [...nds, newNode]);
  }, [nodes.length, setNodes, getDefaultConfig]);

  /**
   * Clear all nodes and edges from canvas
   */
  const clearCanvas = useCallback(() => {
    console.log('[DagBuilder] Clear clicked - current nodes:', nodes.length);
    
    if (nodes.length === 0) {
      console.log('[DagBuilder] Canvas already empty');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to clear the entire workflow?\n\n` +
      `This will delete ${nodes.length} node(s) and ${edges.length} connection(s).\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) {
      console.log('[DagBuilder] Clear cancelled by user');
      return;
    }

    console.log('[DagBuilder] Clearing canvas - removing', nodes.length, 'nodes and', edges.length, 'edges');
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    console.log('[DagBuilder] ✅ Canvas cleared');
  }, [nodes.length, edges.length, setNodes, setEdges]);

  /**
   * Update node data
   */
  const updateNode = useCallback((id: string, updates: Partial<DagNode['data']>) => {
    console.log('[DagBuilder] Updating node:', id, updates);
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    );
  }, [setNodes]);

  /**
   * Delete node
   */
  const deleteNode = useCallback((id: string) => {
    console.log('[DagBuilder] Deleting node:', id);
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  /**
   * Execute workflow
   */
  const executeWorkflow = useCallback(async () => {
    console.log('[DagBuilder] Starting workflow execution');
    
    // Validate node configurations first
    const configErrors: string[] = [];
    nodes.forEach(node => {
      const { type, config } = node.data;
      
      if (type === 'training') {
        if (!config.modelType) configErrors.push(`${node.data.name}: Model Type is required`);
        if (!config.dataset) configErrors.push(`${node.data.name}: Dataset is required`);
        if (!config.apiEndpoint) configErrors.push(`${node.data.name}: API Endpoint is required`);
      } else if (type === 'preprocessing') {
        if (!config.inputPath) configErrors.push(`${node.data.name}: Input Path is required`);
        if (!config.outputPath) configErrors.push(`${node.data.name}: Output Path is required`);
        if (!config.apiEndpoint) configErrors.push(`${node.data.name}: API Endpoint is required`);
      } else if (type === 'validation') {
        if (!config.modelPath) configErrors.push(`${node.data.name}: Model Path is required`);
        if (!config.testDataset) configErrors.push(`${node.data.name}: Test Dataset is required`);
        if (!config.apiEndpoint) configErrors.push(`${node.data.name}: API Endpoint is required`);
      } else if (type === 'deployment') {
        if (!config.modelPath) configErrors.push(`${node.data.name}: Model Path is required`);
        if (!config.deploymentTarget) configErrors.push(`${node.data.name}: Deployment Target is required`);
        if (!config.apiEndpoint) configErrors.push(`${node.data.name}: API Endpoint is required`);
      }
    });
    
    if (configErrors.length > 0) {
      console.error('[DagBuilder] ❌ Configuration validation failed:', configErrors);
      alert(`Cannot execute: Node configuration incomplete\n\n${configErrors.join('\n')}`);
      return;
    }
    
    console.log('[DagBuilder] ✅ Configuration validation passed');
    
    // Validate DAG structure
    try {
      const validationResult = await validateDAG(nodes, edges);
      
      if (!validationResult.valid) {
        console.error('[DagBuilder] ❌ Validation failed:', validationResult.errors);
        alert(`Cannot execute: Workflow validation failed\n\n${(validationResult.errors || []).join('\n')}`);
        return;
      }

      console.log('[DagBuilder] ✅ Validation passed');
    } catch (error) {
      console.error('[DagBuilder] ❌ Validation error:', error);
      alert(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return;
    }

    // Convert to job configs
    const jobs = dagToJobConfigs(nodes, edges);
    console.log('[DagBuilder] Executing workflow with', jobs.length, 'jobs');

    try {
      const response = await fetch('/api/training/dag/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Workflow ${new Date().toISOString()}`,
          jobs
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Execution failed');
      }

      const result = await response.json();
      console.log('[DagBuilder] ✅ Execution started:', result.executionId);
      
      // Call callback if provided
      if (onExecuteCallback) {
        onExecuteCallback(result.executionId);
      }

      alert(`Workflow execution started!\nExecution ID: ${result.executionId}\n\nSwitch to the Executions tab to view progress.`);
    } catch (error) {
      console.error('[DagBuilder] ❌ Execution error:', error);
      alert(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [nodes, edges, onExecuteCallback]);

  /**
   * Load nodes and edges into builder (for template loading)
   */
  const loadNodes = useCallback((newNodes: DagNode[], newEdges: Edge[]) => {
    console.log('[DagBuilder] Loading template:', newNodes.length, 'nodes,', newEdges.length, 'edges');
    setNodes(newNodes);
    setEdges(newEdges);
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    addNode,
    getNodes: () => nodes,
    getEdges: () => edges,
    clearCanvas,
    loadNodes,
  }), [addNode, nodes, edges, clearCanvas, loadNodes]);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[DagBuilder] Connection attempt:', {
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle
      });
      
      if (!params.source || !params.target) {
        console.error('[DagBuilder] ❌ Invalid connection - missing source or target');
        return;
      }
      
      // Create edge with explicit type
      const newEdge: Edge = {
        id: `${params.source}-${params.target}`,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle ?? 'source',
        targetHandle: params.targetHandle ?? 'target',
        type: 'smoothstep',
        animated: true,
      };
      
      console.log('[DagBuilder] ✅ Creating edge:', newEdge);
      setEdges((eds) => [...eds, newEdge]);
    },
    [setEdges]
  );

  /**
   * Validate if connection is allowed
   */
  const isValidConnection = useCallback((connection: Connection | Edge) => {
    console.log('[DagBuilder] Validating connection:', connection);
    
    // Prevent self-connections
    if (connection.source === connection.target) {
      console.log('[DagBuilder] ❌ Self-connection not allowed');
      return false;
    }
    
    console.log('[DagBuilder] ✅ Connection is valid');
    return true;
  }, []);

  const onNodesChangeHandler = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      console.log('[DagBuilder] Nodes changed:', changes.length, 'changes');
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const onEdgesChangeHandler = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      console.log('[DagBuilder] Edges changed:', changes.length, 'changes');
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  /**
   * Handle node selection
   */
  const onNodeClick = useCallback((_event: React.MouseEvent, node: DagNode) => {
    console.log('[DagBuilder] Node clicked:', node.id);
    setSelectedNodeId(node.id);
  }, []);

  /**
   * Handle pane click (deselect)
   */
  const onPaneClick = useCallback(() => {
    console.log('[DagBuilder] Pane clicked - deselecting node');
    setSelectedNodeId(null);
  }, []);

  /**
   * Handle save workflow
   */
  const handleSave = useCallback(async () => {
    console.log('[DagBuilder] Save clicked - nodes:', nodes.length, 'edges:', edges.length);
    
    if (nodes.length === 0) {
      console.warn('[DagBuilder] No nodes to save');
      alert('Cannot save: No nodes in the workflow');
      return;
    }

    // Get workflow name from user
    const workflowName = prompt('Enter a name for this workflow:');
    if (!workflowName || workflowName.trim() === '') {
      console.log('[DagBuilder] Save cancelled - no name provided');
      return;
    }

    const workflowDescription = prompt('Enter a description (optional):') || undefined;

    try {
      // Validate first
      console.log('[DagBuilder] Validating before save...');
      const validation = await validateDAG(nodes, edges);
      
      if (!validation.valid) {
        console.error('[DagBuilder] Cannot save invalid workflow:', validation.errors);
        alert(`❌ Cannot save invalid workflow:\n\n${validation.errors?.join('\n')}`);
        return;
      }

      console.log('[DagBuilder] Saving template:', workflowName);
      const template = await saveTemplate(
        workflowName.trim(),
        nodes,
        edges,
        workflowDescription
      );
      
      console.log('[DagBuilder] ✅ Template saved:', template.id);
      alert(`✅ Workflow saved successfully!\n\nName: ${workflowName}\nID: ${template.id}`);
    } catch (error) {
      console.error('[DagBuilder] Save error:', error);
      alert(`❌ Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [nodes, edges]);

  /**
   * Handle validate workflow
   */
  const handleValidate = useCallback(async () => {
    console.log('[DagBuilder] Validate clicked - validating', nodes.length, 'nodes');
    
    if (nodes.length === 0) {
      console.warn('[DagBuilder] No nodes to validate');
      alert('Cannot validate: No nodes in the workflow');
      return;
    }

    try {
      const validation = await validateDAG(nodes, edges);
      console.log('[DagBuilder] Validation result:', validation);
      
      if (validation.valid) {
        console.log('[DagBuilder] ✅ Validation passed');
        alert(`✅ Workflow is valid!\n\nTotal jobs: ${validation.totalJobs}\nMax parallel: ${validation.maxParallelJobs}`);
      } else {
        console.error('[DagBuilder] ❌ Validation failed:', validation.errors);
        alert(`❌ Validation failed:\n\n${validation.errors?.join('\n')}`);
      }
    } catch (error) {
      console.error('[DagBuilder] Validation error:', error);
      alert(`❌ Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [nodes, edges]);

  /**
   * Handle load workflow - fetch templates and let user select
   */
  const handleLoad = useCallback(async () => {
    console.log('[DagBuilder] Load clicked - fetching templates');
    
    try {
      const response = await fetch('/api/training/dag/templates');
      const data = await response.json();
      
      if (!data.success || data.templates.length === 0) {
        console.warn('[DagBuilder] No templates available');
        alert('No templates available to load');
        return;
      }
      
      console.log('[DagBuilder] Found', data.templates.length, 'templates');
      
      // Create simple picker using prompt
      const templateList = data.templates.map((t: Template, i: number) => 
        `${i + 1}. ${t.name} (${t.config.jobs.length} jobs)`
      ).join('\n');
      
      const selection = prompt(
        `Select a template to load:\n\n${templateList}\n\nEnter number (1-${data.templates.length}):`
      );
      
      if (!selection) {
        console.log('[DagBuilder] Load cancelled');
        return;
      }
      
      const index = parseInt(selection) - 1;
      if (isNaN(index) || index < 0 || index >= data.templates.length) {
        alert('Invalid selection');
        return;
      }
      
      const template = data.templates[index];
      console.log('[DagBuilder] Loading template:', template.name);
      
      // Convert template jobs to nodes/edges and load
      const { nodes: templateNodes, edges: templateEdges } = jobConfigsToDag(template.config.jobs);
      loadNodes(templateNodes, templateEdges);
      
      console.log('[DagBuilder] ✅ Template loaded:', template.name);
      alert(`✅ Template loaded: ${template.name}\n\n${templateNodes.length} nodes, ${templateEdges.length} edges`);
      
    } catch (error) {
      console.error('[DagBuilder] Load error:', error);
      alert(`❌ Load failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [loadNodes]);

  /**
   * Get selected node data
   */
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((node) => node.id === selectedNodeId)?.data || null;
  }, [selectedNodeId, nodes]);

  /**
   * Handle sidebar close
   */
  const handleSidebarClose = useCallback(() => {
    console.log('[DagBuilder] Sidebar closed');
    setSelectedNodeId(null);
  }, []);

  return (
    <div className="h-full w-full flex flex-col">
      <DagToolbar
        onAddNode={addNode}
        onSave={handleSave}
        onLoad={handleLoad}
        onValidate={handleValidate}
        onExecute={executeWorkflow}
        onClear={clearCanvas}
        disabled={false}
        hasNodes={nodes.length > 0}
      />
      
      <div className="flex-1 flex relative">
        <div className="flex-1 w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChangeHandler}
            onEdgesChange={onEdgesChangeHandler}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            fitViewOptions={{
              padding: 0.15,
              minZoom: 0.5,
              maxZoom: 1.5,
            }}
            defaultViewport={{
              x: 0,
              y: 0,
              zoom: 0.75,
            }}
            minZoom={0.3}
            maxZoom={2}
            className="bg-gray-50 dark:bg-gray-900"
            connectionLineType={ConnectionLineType.SmoothStep}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: true,
            }}
            snapToGrid
            snapGrid={[15, 15]}
          >
            <Background gap={16} size={1} />
            <Controls />
            <MiniMap
              className="bg-white dark:bg-gray-800"
              maskColor="rgb(0, 0, 0, 0.1)"
            />
          </ReactFlow>
        </div>
        
        {selectedNode && (
          <div className="absolute right-0 top-0 h-full z-50 pointer-events-none">
            <div className="pointer-events-auto">
              <DagSidebar
                selectedNode={selectedNode}
                onUpdateNode={updateNode}
                onDeleteNode={deleteNode}
                onClose={handleSidebarClose}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

DagBuilderComponent.displayName = 'DagBuilder';

export { DagBuilderComponent as DagBuilder };

