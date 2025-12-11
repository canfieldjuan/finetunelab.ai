/**
 * Centralized endpoint configuration with environment variable fallbacks
 * All URLs can be customized via .env files for flexible deployment
 */

export const ENDPOINTS = {
  // Training Server
  TRAINING_SERVER: process.env.LOCAL_TRAINING_SERVER_URL || 'http://localhost:8000',
  
  // Next.js Application
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  
  // Inference Servers
  OLLAMA: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  VLLM: process.env.VLLM_EXTERNAL_URL || 'http://localhost:8001',
  
  // APIs
  VALIDATION_API: process.env.VALIDATION_API_URL || 'http://localhost:8001',
  GOVERNANCE_API: process.env.GOVERNANCE_API_URL || 'http://localhost:9000',
  GRAPHITI_API: process.env.GRAPHITI_API_URL || 'http://localhost:8002',
} as const;

export const PORTS = {
  TRAINING_SERVER: 8000,
  APP: 3000,
  OLLAMA: 11434,
  VLLM: 8001,
  VALIDATION_API: 8001,
  GOVERNANCE_API: 9000,
  GRAPHITI_API: 8002,
} as const;

// Type exports for autocomplete
export type Endpoint = typeof ENDPOINTS[keyof typeof ENDPOINTS];
export type Port = typeof PORTS[keyof typeof PORTS];
