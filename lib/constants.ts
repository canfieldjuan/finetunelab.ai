/**
 * Application-wide constants
 */

export const STATUS = {
  // Special status
  ALL: 'all',

  // Job statuses
  RUNNING: 'running',
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
  SUCCEEDED: 'succeeded',
  QUEUED: 'queued',
  STARTING: 'starting',

  // Deployment statuses
  ACTIVE: 'active',
  DEPLOYING: 'deploying',
  SCALING: 'scaling',
  STOPPED: 'stopped',
  ERROR: 'error',
  IDLE: 'idle',
  SUCCESS: 'success',

  // VLLM statuses
  CHECKING: 'checking',
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',

  // Server types
  VLLM: 'vllm',
  OLLAMA: 'ollama',
  RUNPOD: 'runpod',

  // Providers
  RUNPOD_SERVERLESS: 'runpod-serverless',
} as const;

export type Status = typeof STATUS[keyof typeof STATUS];

export const DATASET_FORMATS = {
  CHATML: 'chatml',
  SHAREGPT: 'sharegpt',
  JSONL: 'jsonl',
  DPO: 'dpo',
  RLHF: 'rlhf',
  ALPACA: 'alpaca',
  OPENORCA: 'openorca',
  UNNATURAL: 'unnatural',
  RAW_TEXT: 'raw_text',
} as const;

export type DatasetFormat = typeof DATASET_FORMATS[keyof typeof DATASET_FORMATS];

export const TRAINING_METHODS = {
  SFT: 'sft',
  DPO: 'dpo',
  RLHF: 'rlhf',
  ORPO: 'orpo',
  CPT: 'cpt',
} as const;

export type TrainingMethod = typeof TRAINING_METHODS[keyof typeof TRAINING_METHODS];

export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;

export type MessageRole = typeof MESSAGE_ROLES[keyof typeof MESSAGE_ROLES];

export const RESEARCH_EVENT_TYPES = {
  RESEARCH_COMPLETE: 'research_complete',
  CONNECTED: 'connected',
} as const;

export type ResearchEventType = typeof RESEARCH_EVENT_TYPES[keyof typeof RESEARCH_EVENT_TYPES];

export const RESEARCH_STEP_STATUS = {
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type ResearchStepStatus = typeof RESEARCH_STEP_STATUS[keyof typeof RESEARCH_STEP_STATUS];

export const RESEARCH_STEP_NAMES = {
  INITIAL_SEARCH: 'initial_search',
  SUB_QUERY_GENERATION: 'sub_query_generation',
  SUB_QUERY_SEARCH: 'sub_query_search',
  REPORT_GENERATION: 'report_generation',
} as const;

export type ResearchStepName = typeof RESEARCH_STEP_NAMES[keyof typeof RESEARCH_STEP_NAMES];

export const PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  HUGGINGFACE: 'huggingface',
  OLLAMA: 'ollama',
  VLLM: 'vllm',
  AZURE: 'azure',
  CUSTOM: 'custom',
} as const;

export type Provider = typeof PROVIDERS[keyof typeof PROVIDERS];

export const PROMPT_TESTER_OPERATIONS = {
  TEST_PROMPT: 'test_prompt',
} as const;

export type PromptTesterOperation = typeof PROMPT_TESTER_OPERATIONS[keyof typeof PROMPT_TESTER_OPERATIONS];

export const PLAN_NAMES = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
  FREE_TRIAL: 'free_trial',
} as const;

export type PlanName = typeof PLAN_NAMES[keyof typeof PLAN_NAMES];

export const OWNERSHIP_FILTERS = {
  ALL: 'all',
  GLOBAL: 'global',
  MINE: 'mine',
} as const;

export type OwnershipFilter = typeof OWNERSHIP_FILTERS[keyof typeof OWNERSHIP_FILTERS];