// ============================================================================
// Register Dynamic Parallelism Handlers
// ============================================================================
// Registers fan-out and fan-in handlers with the DAG orchestrator
//
// Author: System
// Last Modified: 2024
// ============================================================================

import DAGOrchestrator from './dag-orchestrator';
import { fanOutHandler, fanInHandler } from './dynamic-handlers';

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = '[HANDLER-REGISTRATION]';

const REGISTRATION_MESSAGES = {
  REGISTERING: 'Registering dynamic parallelism handlers',
  FANOUT_REGISTERED: 'Fan-out handler registered',
  FANIN_REGISTERED: 'Fan-in handler registered',
  COMPLETE: 'Dynamic parallelism handlers registration complete',
};

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Register dynamic parallelism handlers with the orchestrator
 * 
 * Registers:
 * - fan-out: Generates parallel jobs from parameter specifications
 * - fan-in: Aggregates results from dynamically generated jobs
 */
export function registerDynamicHandlers(orchestrator: DAGOrchestrator): void {
  console.log(`${LOG_PREFIX} ${REGISTRATION_MESSAGES.REGISTERING}`);

  // Register fan-out handler
  orchestrator.registerHandler('fan-out', fanOutHandler);
  console.log(`${LOG_PREFIX} ${REGISTRATION_MESSAGES.FANOUT_REGISTERED}`);

  // Register fan-in handler
  orchestrator.registerHandler('fan-in', fanInHandler);
  console.log(`${LOG_PREFIX} ${REGISTRATION_MESSAGES.FANIN_REGISTERED}`);

  console.log(`${LOG_PREFIX} ${REGISTRATION_MESSAGES.COMPLETE}`);
}

// ============================================================================
// Exports
// ============================================================================

export default registerDynamicHandlers;
