// Tool Manager - Main Export
// Phase 2.4: Unified exports for tool system
// Updated: Phase 6 - Uses modular registry

// Type exports
export type { ToolDefinition, ToolParameter, ToolConfig, ToolExecutionResult, ToolMetadata } from './types';
export type { Tool, ToolExecution } from './toolManager';

// Registry functions
export { 
  registerTool,
  getToolByName, 
  getAllTools,
  getEnabledTools as getEnabledToolsFromRegistry,
  executeToolFromRegistry,
  getRegistryMetadata
} from './registry';

// Tool management functions (database operations)
export { 
  getEnabledTools, 
  executeTool, 
  getToolExecutions 
} from './toolManager';

// Configuration exports
export { toolConfigs } from './config';

