/**
 * OpenAPI Spec Generation Configuration
 *
 * This configuration is used by next-swagger-doc to generate OpenAPI 3.0 spec
 * from Next.js API routes with JSDoc comments.
 */

module.exports = {
  // OpenAPI definition
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Fine-Tune Labs API',
      version: '1.0.0',
      description: `
# Fine-Tune Labs Public API

Production-grade API for LLMOps, model training, and monitoring.

## Features

- 🎯 **Widget Apps** - Deploy production monitoring widgets
- 📊 **Analytics & Metrics** - Real-time model performance tracking
- 🚀 **Inference Deployment** - Deploy and manage model endpoints
- 🤖 **Model Management** - CRUD operations for LLM models
- 📈 **Training Jobs** - Monitor fine-tuning progress

## Authentication

All endpoints require Bearer token authentication:

\`\`\`
Authorization: Bearer YOUR_API_TOKEN
\`\`\`

Get your API token from the Fine-Tune Labs dashboard.

## Base URL

- **Development**: \`http://localhost:3000\`
- **Production**: \`https://finetunelab.ai\`

## Rate Limits

- 1000 requests per minute per API key
- 10,000 requests per day per API key

## Support

- Documentation: https://finetunelab.ai/docs
- Email: support@finetunelab.ai
`,
      contact: {
        name: 'Fine-Tune Labs API Support',
        email: 'support@finetunelab.ai',
        url: 'https://finetunelab.ai/support'
      },
      license: {
        name: 'Proprietary',
        url: 'https://finetunelab.ai/terms'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://finetunelab.ai',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token from Supabase authentication'
        }
      },
      schemas: {
        // =====================================================================
        // Common Schemas
        // =====================================================================
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'string',
              description: 'Additional error details'
            },
            code: {
              type: 'string',
              description: 'Error code'
            }
          },
          required: ['error']
        },

        // =====================================================================
        // Model Schemas
        // =====================================================================
        Model: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Model ID',
              example: 'model_abc123'
            },
            name: {
              type: 'string',
              description: 'Model name',
              example: 'GPT-4 Turbo'
            },
            provider: {
              type: 'string',
              enum: ['openai', 'anthropic', 'google', 'local'],
              description: 'LLM provider'
            },
            model_id: {
              type: 'string',
              description: 'Provider-specific model identifier',
              example: 'gpt-4-turbo-preview'
            },
            base_url: {
              type: 'string',
              description: 'API base URL',
              example: 'https://api.openai.com/v1'
            },
            enabled: {
              type: 'boolean',
              description: 'Whether model is enabled'
            },
            context_length: {
              type: 'integer',
              description: 'Maximum context window size',
              example: 128000
            },
            max_output_tokens: {
              type: 'integer',
              description: 'Maximum output tokens',
              example: 4096
            },
            supports_streaming: {
              type: 'boolean',
              description: 'Supports streaming responses'
            },
            supports_functions: {
              type: 'boolean',
              description: 'Supports function calling'
            },
            supports_vision: {
              type: 'boolean',
              description: 'Supports vision/image inputs'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },

        // =====================================================================
        // Training Schemas
        // =====================================================================
        TrainingConfig: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'cfg_abc123'
            },
            name: {
              type: 'string',
              example: 'Llama 2 7B LoRA Fine-tune'
            },
            description: {
              type: 'string',
              example: 'Customer support chatbot training config'
            },
            template_type: {
              type: 'string',
              enum: ['lora', 'qlora', 'full_finetune', 'dpo', 'rlhf'],
              example: 'lora'
            },
            config_json: {
              type: 'object',
              description: 'Training hyperparameters and settings'
            },
            is_validated: {
              type: 'boolean',
              example: true
            },
            validation_errors: {
              type: 'array',
              items: { type: 'string' }
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },

        TrainingJob: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'job_abc123'
            },
            model_name: {
              type: 'string',
              example: 'meta-llama/Llama-2-7b-hf'
            },
            status: {
              type: 'string',
              enum: ['pending', 'queued', 'running', 'completed', 'failed', 'cancelled'],
              example: 'running'
            },
            started_at: {
              type: 'string',
              format: 'date-time'
            },
            completed_at: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },

        TrainingDataset: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'ds_xyz789'
            },
            name: {
              type: 'string',
              example: 'Customer Support Conversations'
            },
            description: {
              type: 'string',
              example: '10K customer support interactions from Q4 2024'
            },
            format: {
              type: 'string',
              enum: ['chatml', 'sharegpt', 'jsonl', 'dpo', 'rlhf'],
              example: 'chatml'
            },
            total_examples: {
              type: 'integer',
              example: 1000
            },
            avg_input_length: {
              type: 'number',
              example: 245.5
            },
            avg_output_length: {
              type: 'number',
              example: 128.3
            },
            file_size_bytes: {
              type: 'integer',
              example: 2457600
            },
            storage_path: {
              type: 'string',
              example: 'user123/private/dataset_xyz.jsonl.gz'
            },
            metadata: {
              type: 'object',
              properties: {
                original_format: { type: 'string' },
                normalized: { type: 'boolean' },
                compressed: { type: 'boolean' },
                compression_type: { type: 'string' }
              }
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },

        TrainingMetricsPoint: {
          type: 'object',
          description: 'Single training metrics data point',
          properties: {
            step: {
              type: 'integer',
              example: 100
            },
            epoch: {
              type: 'integer',
              example: 1
            },
            train_loss: {
              type: 'number',
              example: 0.345
            },
            eval_loss: {
              type: 'number',
              example: 0.298
            },
            learning_rate: {
              type: 'number',
              example: 0.00002
            },
            grad_norm: {
              type: 'number',
              example: 0.512
            },
            gpu_memory_allocated_gb: {
              type: 'number',
              example: 22.1
            },
            gpu_memory_reserved_gb: {
              type: 'number',
              example: 24.0
            },
            gpu_utilization_percent: {
              type: 'number',
              example: 97.5
            },
            samples_per_second: {
              type: 'number',
              example: 12.5
            },
            tokens_per_second: {
              type: 'number',
              example: 2500.0
            },
            train_perplexity: {
              type: 'number',
              example: 1.41
            },
            perplexity: {
              type: 'number',
              example: 1.35
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        },

        RunPodDeployment: {
          type: 'object',
          properties: {
            deployment_id: {
              type: 'string',
              example: 'pod_abc123'
            },
            pod_id: {
              type: 'string',
              example: 'pod_abc123'
            },
            pod_url: {
              type: 'string',
              format: 'uri',
              example: 'https://pod-abc123.runpod.io'
            },
            status: {
              type: 'string',
              enum: ['CREATED', 'RUNNING', 'EXITED', 'FAILED'],
              example: 'RUNNING'
            },
            gpu_type: {
              type: 'string',
              example: 'NVIDIA_A100_80GB'
            },
            gpu_count: {
              type: 'integer',
              example: 1
            },
            cost: {
              type: 'object',
              properties: {
                estimated_cost: {
                  type: 'number',
                  example: 25.50
                },
                actual_cost: {
                  type: 'number',
                  example: 12.45
                },
                cost_per_hour: {
                  type: 'number',
                  example: 1.89
                }
              }
            }
          }
        },

        // =====================================================================
        // Training Predictions Schemas
        // =====================================================================
        TrainingPrediction: {
          type: 'object',
          description: 'Model prediction on a sample prompt during training',
          properties: {
            id: {
              type: 'string',
              example: 'pred_abc123'
            },
            job_id: {
              type: 'string',
              example: 'job_abc123'
            },
            user_id: {
              type: 'string',
              example: 'user_xyz789'
            },
            epoch: {
              type: 'integer',
              description: 'Training epoch when prediction was generated',
              example: 2
            },
            step: {
              type: 'integer',
              description: 'Training step when prediction was generated',
              example: 450
            },
            sample_index: {
              type: 'integer',
              description: 'Index of the sample in the prediction set',
              example: 0
            },
            prompt: {
              type: 'string',
              description: 'Input prompt for prediction',
              example: 'What is the capital of France?'
            },
            ground_truth: {
              type: 'string',
              description: 'Expected output (if available)',
              example: 'The capital of France is Paris.'
            },
            prediction: {
              type: 'string',
              description: 'Model-generated prediction',
              example: 'Paris is the capital of France.'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },

        // =====================================================================
        // Batch Testing Schemas
        // =====================================================================
        BatchTestRun: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'test_xyz789'
            },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
              example: 'running'
            },
            model_name: {
              type: 'string',
              example: 'gpt-4-turbo'
            },
            total_prompts: {
              type: 'integer',
              example: 100
            },
            completed_prompts: {
              type: 'integer',
              example: 67
            },
            failed_prompts: {
              type: 'integer',
              example: 3
            },
            progress: {
              type: 'number',
              description: 'Progress percentage',
              example: 67.0
            },
            started_at: {
              type: 'string',
              format: 'date-time'
            },
            completed_at: {
              type: 'string',
              format: 'date-time',
              nullable: true
            }
          }
        },

        // =====================================================================
        // Analytics Schemas
        // =====================================================================
        AnalyticsData: {
          type: 'object',
          description: 'Aggregated analytics metrics',
          properties: {
            token_usage: {
              type: 'object',
              properties: {
                total_input_tokens: { type: 'integer', example: 125000 },
                total_output_tokens: { type: 'integer', example: 87500 },
                total_cost: { type: 'number', example: 12.45 }
              }
            },
            quality_metrics: {
              type: 'object',
              properties: {
                avg_response_quality: { type: 'number', example: 0.87 },
                hallucination_rate: { type: 'number', example: 0.023 }
              }
            },
            latency_metrics: {
              type: 'object',
              properties: {
                p50_ms: { type: 'number', example: 1234.5 },
                p95_ms: { type: 'number', example: 2567.8 },
                p99_ms: { type: 'number', example: 4123.2 }
              }
            },
            error_rate: {
              type: 'number',
              example: 0.015
            }
          }
        },

        Trace: {
          type: 'object',
          description: 'Execution trace for debugging',
          properties: {
            trace_id: {
              type: 'string',
              example: 'trace_abc123'
            },
            span_id: {
              type: 'string',
              example: 'span_xyz789'
            },
            span_name: {
              type: 'string',
              example: 'llm.completion'
            },
            duration_ms: {
              type: 'number',
              example: 1234.56
            },
            operation_type: {
              type: 'string',
              example: 'completion'
            },
            model_name: {
              type: 'string',
              example: 'gpt-4-turbo'
            },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed'],
              example: 'completed'
            },
            metadata: {
              type: 'object'
            }
          }
        },

        SentimentInsight: {
          type: 'object',
          description: 'Sentiment analysis insight',
          properties: {
            type: {
              type: 'string',
              enum: ['sentiment_drop', 'sentiment_improvement', 'negative_pattern', 'positive_trend'],
              example: 'sentiment_drop'
            },
            severity: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              example: 'high'
            },
            description: {
              type: 'string',
              example: 'Sentiment dropped by 35% in the last 24 hours'
            },
            affected_conversations: {
              type: 'integer',
              example: 23
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            },
            metadata: {
              type: 'object',
              description: 'Additional context'
            }
          }
        },

        // =====================================================================
        // Widget App Schema
        // =====================================================================
        WidgetApp: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique widget app ID',
              example: 'widget_abc123'
            },
            user_id: {
              type: 'string',
              description: 'User ID who owns this widget'
            },
            name: {
              type: 'string',
              description: 'Widget app name',
              example: 'Customer Support Widget'
            },
            description: {
              type: 'string',
              description: 'Widget description',
              example: 'Production chatbot for customer support'
            },
            api_key: {
              type: 'string',
              description: 'API key for this widget',
              example: 'wgt_key_xyz789abc'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Widget Apps',
        description: 'Manage production deployment widgets'
      },
      {
        name: 'Analytics',
        description: 'Model performance analytics and metrics'
      },
      {
        name: 'Batch Testing',
        description: 'Batch testing for model performance measurement'
      },
      {
        name: 'Inference',
        description: 'Model deployment and serving'
      },
      {
        name: 'Models',
        description: 'LLM model management'
      },
      {
        name: 'Training',
        description: 'Fine-tuning and training jobs'
      },
      {
        name: 'Metrics',
        description: 'Real-time training and inference metrics'
      }
    ]
  },
  // API routes to include in spec
  apis: [
    './app/api/widget-apps/**/*.ts',
    './app/api/analytics/**/*.ts',
    './app/api/batch-testing/**/*.ts',
    './app/api/inference/**/*.ts',
    './app/api/models/**/*.ts',
    './app/api/training/route.ts',
    './app/api/training/\\[id\\]/route.ts',
    './app/api/training/dataset/route.ts',
    './app/api/training/deploy/runpod/route.ts',
    './app/api/training/jobs/route.ts',
    './app/api/training/local/\\[jobId\\]/status/route.ts',
    './app/api/training/local/\\[jobId\\]/metrics/route.ts',
    './app/api/training/local/\\[jobId\\]/logs/route.ts',
    './app/api/training/predictions/\\[jobId\\]/route.ts',
    './app/api/training/predictions/\\[jobId\\]/epochs/route.ts',
    './app/api/chat/route.ts',
  ],
};
