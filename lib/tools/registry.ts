// Tool System - Dynamic Tool Registry
// Phase 1.3: Loads and manages tool modules
// Date: October 10, 2025

import { ToolDefinition, ToolExecutionResult } from './types';
import { globalToolConfig } from './config';
import { toolValidator } from './validator';

/**
 * Tool Registry - Central store for all available tools
 */
class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private loadedAt: Date = new Date();

  /**
   * Register a tool in the registry
   */
  register(tool: ToolDefinition): void {
    if (!tool.name) {
      throw new Error('Tool must have a name');
    }
    
    console.log(`[ToolRegistry] Registering tool: ${tool.name} v${tool.version}`);
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all enabled tools
   */
  getEnabled(): ToolDefinition[] {
    return this.getAll().filter(tool => tool.config.enabled);
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool count
   */
  count(): number {
    return this.tools.size;
  }

  /**
   * Unregister a tool (for dynamic loading/unloading)
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Clear all tools (for testing)
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get registry metadata
   */
  getMetadata() {
    return {
      toolCount: this.count(),
      enabledCount: this.getEnabled().length,
      loadedAt: this.loadedAt,
      tools: this.getAll().map(t => ({
        name: t.name,
        version: t.version,
        enabled: t.config.enabled
      }))
    };
  }
}

// Create singleton instance
const registry = new ToolRegistry();

/**
 * Public API - Register a tool
 */
export function registerTool(tool: ToolDefinition): void {
  registry.register(tool);
}

/**
 * Public API - Get tool by name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

/**
 * Public API - Get all tools
 */
export function getAllTools(): ToolDefinition[] {
  return registry.getAll();
}

/**
 * Public API - Get enabled tools only
 */
export function getEnabledTools(): ToolDefinition[] {
  return registry.getEnabled();
}

/**
 * Public API - Execute a tool
 */
export async function executeToolFromRegistry(
  name: string,
  params: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const tool = registry.get(name);
  
  if (!tool) {
    return {
      success: false,
      error: `Tool '${name}' not found in registry`
    };
  }

  if (!tool.config.enabled) {
    return {
      success: false,
      error: `Tool '${name}' is disabled`
    };
  }

  if (!globalToolConfig.enableToolExecution) {
    return {
      success: false,
      error: 'Tool execution is globally disabled'
    };
  }

  // Validate parameters before execution
  const validation = toolValidator.validateParameters(params, tool);
  if (!validation.valid) {
    return {
      success: false,
      error: `Parameter validation failed: ${validation.errors.join(', ')}`
    };
  }

  const startTime = Date.now();
  
  try {
    const result = await tool.execute(params);
    const executionTimeMs = Date.now() - startTime;
    
    if (globalToolConfig.logExecutions) {
      console.log(`[ToolRegistry] Executed ${name} in ${executionTimeMs}ms`);
    }
    
    return {
      success: true,
      result,
      executionTimeMs
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`[ToolRegistry] Error executing ${name}:`, errorMessage);
    
    return {
      success: false,
      error: errorMessage,
      executionTimeMs
    };
  }
}

/**
 * Public API - Get registry metadata
 */
export function getRegistryMetadata() {
  return registry.getMetadata();
}

// Export the registry instance for testing
export { registry };

// ============================================
// AUTO-REGISTER MODULAR TOOLS
// ============================================

// Import client-safe tools (no Node.js dependencies)
import calculatorTool from './calculator';
import datetimeTool from './datetime';
import webSearchTool from './web-search';
import datasetManagerTool from './dataset-manager';
import promptTesterTool from './prompt-tester';
import { tokenAnalyzerTool } from './token-analyzer';
import { evaluationMetricsTool } from './evaluation-metrics';
// REMOVED: promptInjectorTool - developer/QA load testing tool
// REMOVED: promptExtractorTool - developer benchmarking tool
import intelligentEmailTool from './intelligent_email';
import emailAnalysisTool from './intelligent_email/analysis.tool';
import { emailSecurityTool } from './intelligent_email/security.tool';
import { analyticsExportTool } from './analytics-export';
import { trainingControlTool } from './trainingControl';
import graphragQueryTool from './graphrag';

// Auto-register client-safe tools
console.log('[ToolRegistry] Auto-registering client-safe tools...');
registerTool(calculatorTool);
registerTool(datetimeTool);
registerTool(webSearchTool);
registerTool(datasetManagerTool);
registerTool(promptTesterTool);
registerTool(tokenAnalyzerTool);
registerTool(evaluationMetricsTool);
// REMOVED: promptInjectorTool - developer/QA load testing tool
// REMOVED: promptExtractorTool - developer benchmarking tool
registerTool(intelligentEmailTool);
registerTool(emailAnalysisTool);
registerTool(emailSecurityTool);
registerTool(analyticsExportTool);
registerTool(trainingControlTool);
registerTool(graphragQueryTool);

// REMOVED: Server-only tools (filesystem, system_monitor) - security risk in cloud deployments
// These tools are kept in codebase but not registered for chat portal use

console.log('[ToolRegistry] Registered', registry.count(), 'tools (client-safe)');
