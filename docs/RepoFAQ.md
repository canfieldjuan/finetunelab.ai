# Project FAQ (auto-generated)

> Derived from source routes and server endpoints.

## 1. What does GET /api/widget-apps do?

Create widget app    description: Create a new widget app for production monitoring. Returns an API token (shown only once).    tags:      - Widget Apps    security:      - bearerAuth: []    requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - name            properties:              name:                type: string                description: Widget app name                example: "My Production App"              description:                type: string                description: Optional description                example: "Monitors chatbot performance"              allowed_origins:                type: array                items:                  type: string                description: CORS allowed origins                example: ["https://myapp.com", "https://www.myapp.com"]    responses:      201:        description: Widget app created successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true                app:                  type: object                  properties:                    id:                      type: string                      example: "app_abc123xyz"                    token:                      type: string                      description: API token (only shown once, save it!)                      example: "widget_xyz789abc..."                    name:                      type: string                      example: "My Production App"                    description:                      type: string                      example: "Monitors chatbot performance"                    allowed_origins:                      type: array                      items:                        type: string                      example: ["https://myapp.com"]      400:        description: Bad request - Missing required fields        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized - Missing or invalid bearer token        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      500:        description: Internal server error        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 2. What is the request body for GET /api/widget-apps?

requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - name            properties:              name:                type: string

## 3. What responses does GET /api/widget-apps return?

responses:      201:

## 4. Does GET /api/widget-apps require authentication?

security:      - bearerAuth: []

## 5. Can you describe GET /api/widget-apps?

description: Create a new widget app for production monitoring. Returns an API token (shown only once).

## 6. What tags classify GET /api/widget-apps?

tags:      - Widget Apps

## 7. What does POST /api/widget-apps do?

Create widget app    description: Create a new widget app for production monitoring. Returns an API token (shown only once).    tags:      - Widget Apps    security:      - bearerAuth: []    requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - name            properties:              name:                type: string                description: Widget app name                example: "My Production App"              description:                type: string                description: Optional description                example: "Monitors chatbot performance"              allowed_origins:                type: array                items:                  type: string                description: CORS allowed origins                example: ["https://myapp.com", "https://www.myapp.com"]    responses:      201:        description: Widget app created successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true                app:                  type: object                  properties:                    id:                      type: string                      example: "app_abc123xyz"                    token:                      type: string                      description: API token (only shown once, save it!)                      example: "widget_xyz789abc..."                    name:                      type: string                      example: "My Production App"                    description:                      type: string                      example: "Monitors chatbot performance"                    allowed_origins:                      type: array                      items:                        type: string                      example: ["https://myapp.com"]      400:        description: Bad request - Missing required fields        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized - Missing or invalid bearer token        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      500:        description: Internal server error        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 8. What is the request body for POST /api/widget-apps?

requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - name            properties:              name:                type: string

## 9. What responses does POST /api/widget-apps return?

responses:      201:

## 10. Does POST /api/widget-apps require authentication?

security:      - bearerAuth: []

## 11. Can you describe POST /api/widget-apps?

description: Create a new widget app for production monitoring. Returns an API token (shown only once).

## 12. What tags classify POST /api/widget-apps?

tags:      - Widget Apps

## 13. Which HTTP methods are implemented for /api/widget-apps?

GET, POST

## 14. Where is the source file for /api/widget-apps?

app/api/widget-apps/route.ts

## 15. What does GET /api/settings do?

POST /api/settingsUpdate user settings (upsert)

## 16. What does POST /api/settings do?

POST /api/settingsUpdate user settings (upsert)

## 17. Which HTTP methods are implemented for /api/settings?

GET, POST

## 18. Where is the source file for /api/settings?

app/api/settings/route.ts

## 19. What does GET /api/benchmarks do?

API Route - Benchmark ManagementCRUD operations for custom benchmarksPOST /api/benchmarks - Create benchmarkGET /api/benchmarks - List user's benchmarks

## 20. What does POST /api/benchmarks do?

API Route - Benchmark ManagementCRUD operations for custom benchmarksPOST /api/benchmarks - Create benchmarkGET /api/benchmarks - List user's benchmarks

## 21. Which HTTP methods are implemented for /api/benchmarks?

GET, POST

## 22. Where is the source file for /api/benchmarks?

app/api/benchmarks/route.ts

## 23. What does GET /api/models do?

List available models    description: |      Retrieve all available LLM models (global + user's personal models).      Returns models from:      - Global model registry (available to all users)      - User's personal models (if authenticated)Use Cases:      - Populate model selection dropdowns      - Discover available models for testing      - Check model availability before batch testing    tags:      - Models    security:      - bearerAuth: []    responses:      200:        description: Models retrieved successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true                count:                  type: integer                  example: 12                models:                  type: array                  items:                    $ref: '#/components/schemas/Model'  post:    summary: Register new model    description: |      Register a new LLM model in the system.      Supports:      - OpenAI models (GPT-4, GPT-3.5, etc.)      - Anthropic models (Claude)      - Google models (Gemini)      - Local modelsUse Cases:      - Add custom fine-tuned models      - Register models with custom API keys      - Configure model-specific settings    tags:      - Models    security:      - bearerAuth: []    requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - name              - provider              - model_id            properties:              name:                type: string                description: Display name for the model                example: "GPT-4 Turbo"              provider:                type: string                enum: [openai, anthropic, google, local]                example: "openai"              model_id:                type: string                description: Provider-specific model identifier                example: "gpt-4-turbo-preview"              api_key_encrypted:                type: string                format: password                description: Encrypted API key (optional, uses global key if not provided)              context_length:                type: integer                description: Maximum context window size                example: 128000              max_output_tokens:                type: integer                description: Maximum output tokens                example: 4096              default_temperature:                type: number                description: Default temperature (0.0 - 2.0)                example: 0.7              default_top_p:                type: number                description: Default top_p (0.0 - 1.0)                example: 1.0    responses:      201:        description: Model registered successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true                model:                  $ref: '#/components/schemas/Model'      400:        description: Bad request - Invalid parameters        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 24. What is the request body for GET /api/models?

requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - name              - provider              - model_id            properties:              name:                type: string

## 25. What responses does GET /api/models return?

responses:      200:

## 26. Does GET /api/models require authentication?

security:      - bearerAuth: []

## 27. Can you describe GET /api/models?

description: |      Retrieve all available LLM models (global + user's personal models).      Returns models from:      - Global model registry (available to all users)      - User's personal models (if authenticated)Use Cases:      - Populate model selection dropdowns      - Discover available models for testing      - Check model availability before batch testing

## 28. What tags classify GET /api/models?

tags:      - Models

## 29. What does POST /api/models do?

List available models    description: |      Retrieve all available LLM models (global + user's personal models).      Returns models from:      - Global model registry (available to all users)      - User's personal models (if authenticated)Use Cases:      - Populate model selection dropdowns      - Discover available models for testing      - Check model availability before batch testing    tags:      - Models    security:      - bearerAuth: []    responses:      200:        description: Models retrieved successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true                count:                  type: integer                  example: 12                models:                  type: array                  items:                    $ref: '#/components/schemas/Model'  post:    summary: Register new model    description: |      Register a new LLM model in the system.      Supports:      - OpenAI models (GPT-4, GPT-3.5, etc.)      - Anthropic models (Claude)      - Google models (Gemini)      - Local modelsUse Cases:      - Add custom fine-tuned models      - Register models with custom API keys      - Configure model-specific settings    tags:      - Models    security:      - bearerAuth: []    requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - name              - provider              - model_id            properties:              name:                type: string                description: Display name for the model                example: "GPT-4 Turbo"              provider:                type: string                enum: [openai, anthropic, google, local]                example: "openai"              model_id:                type: string                description: Provider-specific model identifier                example: "gpt-4-turbo-preview"              api_key_encrypted:                type: string                format: password                description: Encrypted API key (optional, uses global key if not provided)              context_length:                type: integer                description: Maximum context window size                example: 128000              max_output_tokens:                type: integer                description: Maximum output tokens                example: 4096              default_temperature:                type: number                description: Default temperature (0.0 - 2.0)                example: 0.7              default_top_p:                type: number                description: Default top_p (0.0 - 1.0)                example: 1.0    responses:      201:        description: Model registered successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true                model:                  $ref: '#/components/schemas/Model'      400:        description: Bad request - Invalid parameters        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 30. What is the request body for POST /api/models?

requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - name              - provider              - model_id            properties:              name:                type: string

## 31. What responses does POST /api/models return?

responses:      200:

## 32. Does POST /api/models require authentication?

security:      - bearerAuth: []

## 33. Can you describe POST /api/models?

description: |      Retrieve all available LLM models (global + user's personal models).      Returns models from:      - Global model registry (available to all users)      - User's personal models (if authenticated)Use Cases:      - Populate model selection dropdowns      - Discover available models for testing      - Check model availability before batch testing

## 34. What tags classify POST /api/models?

tags:      - Models

## 35. Which HTTP methods are implemented for /api/models?

GET, POST

## 36. Where is the source file for /api/models?

app/api/models/route.ts

## 37. What does GET /api/research do?

Next.js API route implemented in app/api/research/route.ts

## 38. What does POST /api/research do?

Next.js API route implemented in app/api/research/route.ts

## 39. Which HTTP methods are implemented for /api/research?

GET, POST

## 40. Where is the source file for /api/research?

app/api/research/route.ts

## 41. What does POST /api/chat do?

Next.js API route implemented in app/api/chat/route.ts

## 42. Which HTTP methods are implemented for /api/chat?

POST

## 43. Where is the source file for /api/chat?

app/api/chat/route.ts

## 44. What does POST /api/evaluate-message do?

Example usage from frontend:const response = await fetch('/api/evaluate-message', {  method: 'POST',  headers: { 'Content-Type': 'application/json' },  body: JSON.stringify({    messageId: 'msg-id-123',    domain: 'company_expert',    retrievedSources: [      { text: 'Company pol

## 45. Which HTTP methods are implemented for /api/evaluate-message?

POST

## 46. Where is the source file for /api/evaluate-message?

app/api/evaluate-message/route.ts

## 47. What does GET /api/secrets do?

Next.js API route implemented in app/api/secrets/route.ts

## 48. What does POST /api/secrets do?

Next.js API route implemented in app/api/secrets/route.ts

## 49. Which HTTP methods are implemented for /api/secrets?

GET, POST

## 50. Where is the source file for /api/secrets?

app/api/secrets/route.ts

## 51. What does GET /api/approvals do?

Next.js API route implemented in app/api/approvals/route.ts

## 52. Which HTTP methods are implemented for /api/approvals?

GET

## 53. Where is the source file for /api/approvals?

app/api/approvals/route.ts

## 54. What does POST /api/evaluate do?

Next.js API route implemented in app/api/evaluate/route.ts

## 55. Which HTTP methods are implemented for /api/evaluate?

POST

## 56. Where is the source file for /api/evaluate?

app/api/evaluate/route.ts

## 57. What does GET /api/training do?

List training configurations    description: |      Retrieve all training configurations for the authenticated user.      Training configurations define the hyperparameters, model architecture,      and training settings for fine-tuning jobs.Use Cases:      - List all saved training configurations      - Select a config to start a training job      - Review previously used training settings    tags:      - Training    security:      - bearerAuth: []    responses:      200:        description: Configurations retrieved successfully        content:          application/json:            schema:              type: object              properties:                configs:                  type: array                  items:                    type: object                    properties:                      id:                        type: string                        example: "cfg_abc123"                      name:                        type: string                        example: "Llama 2 7B Fine-tune"                      description:                        type: string                        example: "Customer support chatbot training config"                      template_type:                        type: string                        enum: [lora, full_finetune, qlora, dpo, rlhf]                        example: "lora"                      config_json:                        type: object                        description: Training hyperparameters and settings                      is_validated:                        type: boolean                        example: true                      created_at:                        type: string                        format: date-time      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  post:    summary: Create training configuration    description: |      Create a new training configuration with hyperparameters and settings.      Training configurations are validated before being saved. Invalid configs      will still be created but flagged with validation errors.Use Cases:      - Save reusable training configurations      - Create configs for different model types or use cases      - Template configs for team membersSupported Template Types:      - `lora` - LoRA (Low-Rank Adaptation) fine-tuning      - `qlora` - QLoRA (Quantized LoRA) for memory efficiency      - `full_finetune` - Full parameter fine-tuning      - `dpo` - Direct Preference Optimization      - `rlhf` - Reinforcement Learning from Human Feedback    tags:      - Training    security:      - bearerAuth: []    requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - name              - template_type              - config_json            properties:              name:                type: string                description: Configuration name                example: "Llama 2 7B LoRA"              description:                type: string                description: Optional description                example: "LoRA fine-tuning for customer support chatbot"              template_type:                type: string                enum: [lora, full_finetune, qlora, dpo, rlhf]                example: "lora"              config_json:                type: object                description: Training hyperparameters                properties:                  model_name:                    type: string                    example: "meta-llama/Llama-2-7b-hf"                  training:                    type: object                    properties:                      learning_rate:                        type: number                        example: 2e-5                      epochs:                        type: integer                        example: 3                      batch_size:                        type: integer                        example: 4                      warmup_ratio:                        type: number                        example: 0.1                  lora:                    type: object                    properties:                      r:                        type: integer                        example: 16                      alpha:                        type: integer                        example: 32                      dropout:                        type: number                        example: 0.05    responses:      201:        description: Configuration created successfully        content:          application/json:            schema:              type: object              properties:                config:                  type: object                  properties:                    id:                      type: string                    name:                      type: string                    is_validated:                      type: boolean                    validation_errors:                      type: array                      items:                        type: string      400:        description: Missing required fields        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 58. What is the request body for GET /api/training?

requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - name              - template_type              - config_json            properties:              name:                type: string

## 59. What responses does GET /api/training return?

responses:      200:

## 60. Does GET /api/training require authentication?

security:      - bearerAuth: []

## 61. Can you describe GET /api/training?

description: |      Retrieve all training configurations for the authenticated user.      Training configurations define the hyperparameters, model architecture,      and training settings for fine-tuning jobs.Use Cases:      - List all saved training configurations      - Select a config to start a training job      - Review previously used training settings

## 62. What tags classify GET /api/training?

tags:      - Training

## 63. What does POST /api/training do?

List training configurations    description: |      Retrieve all training configurations for the authenticated user.      Training configurations define the hyperparameters, model architecture,      and training settings for fine-tuning jobs.Use Cases:      - List all saved training configurations      - Select a config to start a training job      - Review previously used training settings    tags:      - Training    security:      - bearerAuth: []    responses:      200:        description: Configurations retrieved successfully        content:          application/json:            schema:              type: object              properties:                configs:                  type: array                  items:                    type: object                    properties:                      id:                        type: string                        example: "cfg_abc123"                      name:                        type: string                        example: "Llama 2 7B Fine-tune"                      description:                        type: string                        example: "Customer support chatbot training config"                      template_type:                        type: string                        enum: [lora, full_finetune, qlora, dpo, rlhf]                        example: "lora"                      config_json:                        type: object                        description: Training hyperparameters and settings                      is_validated:                        type: boolean                        example: true                      created_at:                        type: string                        format: date-time      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  post:    summary: Create training configuration    description: |      Create a new training configuration with hyperparameters and settings.      Training configurations are validated before being saved. Invalid configs      will still be created but flagged with validation errors.Use Cases:      - Save reusable training configurations      - Create configs for different model types or use cases      - Template configs for team membersSupported Template Types:      - `lora` - LoRA (Low-Rank Adaptation) fine-tuning      - `qlora` - QLoRA (Quantized LoRA) for memory efficiency      - `full_finetune` - Full parameter fine-tuning      - `dpo` - Direct Preference Optimization      - `rlhf` - Reinforcement Learning from Human Feedback    tags:      - Training    security:      - bearerAuth: []    requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - name              - template_type              - config_json            properties:              name:                type: string                description: Configuration name                example: "Llama 2 7B LoRA"              description:                type: string                description: Optional description                example: "LoRA fine-tuning for customer support chatbot"              template_type:                type: string                enum: [lora, full_finetune, qlora, dpo, rlhf]                example: "lora"              config_json:                type: object                description: Training hyperparameters                properties:                  model_name:                    type: string                    example: "meta-llama/Llama-2-7b-hf"                  training:                    type: object                    properties:                      learning_rate:                        type: number                        example: 2e-5                      epochs:                        type: integer                        example: 3                      batch_size:                        type: integer                        example: 4                      warmup_ratio:                        type: number                        example: 0.1                  lora:                    type: object                    properties:                      r:                        type: integer                        example: 16                      alpha:                        type: integer                        example: 32                      dropout:                        type: number                        example: 0.05    responses:      201:        description: Configuration created successfully        content:          application/json:            schema:              type: object              properties:                config:                  type: object                  properties:                    id:                      type: string                    name:                      type: string                    is_validated:                      type: boolean                    validation_errors:                      type: array                      items:                        type: string      400:        description: Missing required fields        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 64. What is the request body for POST /api/training?

requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - name              - template_type              - config_json            properties:              name:                type: string

## 65. What responses does POST /api/training return?

responses:      200:

## 66. Does POST /api/training require authentication?

security:      - bearerAuth: []

## 67. Can you describe POST /api/training?

description: |      Retrieve all training configurations for the authenticated user.      Training configurations define the hyperparameters, model architecture,      and training settings for fine-tuning jobs.Use Cases:      - List all saved training configurations      - Select a config to start a training job      - Review previously used training settings

## 68. What tags classify POST /api/training?

tags:      - Training

## 69. Which HTTP methods are implemented for /api/training?

GET, POST

## 70. Where is the source file for /api/training?

app/api/training/route.ts

## 71. What does GET /api/user/api-keys do?

Next.js API route implemented in app/api/user/api-keys/route.ts

## 72. What does POST /api/user/api-keys do?

Next.js API route implemented in app/api/user/api-keys/route.ts

## 73. Which HTTP methods are implemented for /api/user/api-keys?

GET, POST

## 74. Where is the source file for /api/user/api-keys?

app/api/user/api-keys/route.ts

## 75. What does DELETE /api/user/api-keys/[id] do?

Next.js API route implemented in app/api/user/api-keys/[id]/route.ts

## 76. Which HTTP methods are implemented for /api/user/api-keys/[id]?

DELETE

## 77. Where is the source file for /api/user/api-keys/[id]?

app/api/user/api-keys/[id]/route.ts

## 78. What does POST /api/tools/prompt-tester do?

Next.js API route implemented in app/api/tools/prompt-tester/route.ts

## 79. Which HTTP methods are implemented for /api/tools/prompt-tester?

POST

## 80. Where is the source file for /api/tools/prompt-tester?

app/api/tools/prompt-tester/route.ts

## 81. What does GET /api/telemetry/web-search/aggregate do?

Next.js API route implemented in app/api/telemetry/web-search/aggregate/route.ts

## 82. Which HTTP methods are implemented for /api/telemetry/web-search/aggregate?

GET

## 83. Where is the source file for /api/telemetry/web-search/aggregate?

app/api/telemetry/web-search/aggregate/route.ts

## 84. What does DELETE /api/widget-apps/[id] do?

DELETE /api/widget-apps/[id]Delete a widget app (and all associated data via CASCADE)

## 85. Which HTTP methods are implemented for /api/widget-apps/[id]?

DELETE

## 86. Where is the source file for /api/widget-apps/[id]?

app/api/widget-apps/[id]/route.ts

## 87. What does DELETE /api/benchmarks/[id] do?

API Route - Benchmark Management by IDPATCH /api/benchmarks/[id] - Update benchmarkDELETE /api/benchmarks/[id] - Delete benchmark

## 88. Which HTTP methods are implemented for /api/benchmarks/[id]?

DELETE

## 89. Where is the source file for /api/benchmarks/[id]?

app/api/benchmarks/[id]/route.ts

## 90. What does GET /api/models/training-compatible do?

GET /api/models/training-compatibleReturns models suitable for training:- Global base models (GPT-2, Llama, Mistral, etc.)- User's custom trained modelsUsed by DAG Builder for model selection

## 91. Which HTTP methods are implemented for /api/models/training-compatible?

GET

## 92. Where is the source file for /api/models/training-compatible?

app/api/models/training-compatible/route.ts

## 93. What does GET /api/models/search do?

Model Search APIPurpose: Search HuggingFace models from client-sideDate: 2025-10-31

## 94. Which HTTP methods are implemented for /api/models/search?

GET

## 95. Where is the source file for /api/models/search?

app/api/models/search/route.ts

## 96. What does POST /api/models/test-connection do?

Next.js API route implemented in app/api/models/test-connection/route.ts

## 97. Which HTTP methods are implemented for /api/models/test-connection?

POST

## 98. Where is the source file for /api/models/test-connection?

app/api/models/test-connection/route.ts

## 99. What does DELETE /api/models/[id] do?

Next.js API route implemented in app/api/models/[id]/route.ts

## 100. What does GET /api/models/[id] do?

Next.js API route implemented in app/api/models/[id]/route.ts

## 101. Which HTTP methods are implemented for /api/models/[id]?

DELETE, GET

## 102. Where is the source file for /api/models/[id]?

app/api/models/[id]/route.ts

## 103. What does GET /api/models/local do?

GET /api/models/localList locally available models from AI_Models directoryQuery Parameters:- category: Filter by category (nlp, vision, audio, etc.)- format: Filter by format (huggingface, pytorch, onnx, safetensors)- refresh: Force refresh cache (true/false)Returns:{  success: 

## 104. What does POST /api/models/local do?

GET /api/models/localList locally available models from AI_Models directoryQuery Parameters:- category: Filter by category (nlp, vision, audio, etc.)- format: Filter by format (huggingface, pytorch, onnx, safetensors)- refresh: Force refresh cache (true/false)Returns:{  success: 

## 105. Which HTTP methods are implemented for /api/models/local?

GET, POST

## 106. Where is the source file for /api/models/local?

app/api/models/local/route.ts

## 107. What does POST /api/feedback/collect do?

Next.js API route implemented in app/api/feedback/collect/route.ts

## 108. Which HTTP methods are implemented for /api/feedback/collect?

POST

## 109. Where is the source file for /api/feedback/collect?

app/api/feedback/collect/route.ts

## 110. What does GET /api/research/stream do?

SSE streaming endpoint for research progress eventsStreams outline, section, citation, progress, and completion events

## 111. Which HTTP methods are implemented for /api/research/stream?

GET

## 112. Where is the source file for /api/research/stream?

app/api/research/stream/route.ts

## 113. What does GET /api/research/[jobId]/status do?

Next.js API route implemented in app/api/research/[jobId]/status/route.ts

## 114. Which HTTP methods are implemented for /api/research/[jobId]/status?

GET

## 115. Where is the source file for /api/research/[jobId]/status?

app/api/research/[jobId]/status/route.ts

## 116. What does GET /api/research/[jobId]/results do?

Next.js API route implemented in app/api/research/[jobId]/results/route.ts

## 117. Which HTTP methods are implemented for /api/research/[jobId]/results?

GET

## 118. Where is the source file for /api/research/[jobId]/results?

app/api/research/[jobId]/results/route.ts

## 119. What does POST /api/inference/deploy do?

Deploy model to production inference endpoint    description: |      Deploy your trained models to serverless GPU inference endpoints.      This endpoint creates a production-ready, auto-scaling inference deployment on RunPod Serverless.      Your model will be deployed with:      - Auto-scaling GPU workers (scale to zero when idle)      - Budget controls and spending limits      - Production-grade load balancing      - Per-request billingUse Cases:      - Deploy fine-tuned models to production      - Serve custom LLMs at scale      - A/B test different model versions      - Control infrastructure costs with budget limitsWorkflow:      1. Train your model or upload model artifacts      2. Store model weights in cloud storage (S3, GCS, etc.)      3. Call this endpoint with model URL and config      4. Use the returned endpoint_url for inference requestsNote:Requires RunPod API key configured in Settings > Secrets    tags:      - Inference    security:      - bearerAuth: []    requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - provider              - deployment_name              - base_model              - model_type              - model_storage_url              - budget_limit            properties:              provider:                type: string                enum: [runpod-serverless]                description: Infrastructure provider                example: "runpod-serverless"              deployment_name:                type: string                description: Unique name for this deployment                example: "my-finetuned-llama-v1"              base_model:                type: string                description: Base model architecture                example: "meta-llama/Llama-2-7b-hf"              model_type:                type: string                enum: [base, finetuned, quantized]                description: Type of model deployment                example: "finetuned"              model_storage_url:                type: string                format: uri                description: Cloud storage URL where model weights are stored (S3, GCS, etc.)                example: "s3://my-bucket/models/llama2-finetuned/"              training_config_id:                type: string                description: Associated training configuration ID (optional)                example: "config_abc123"              training_job_id:                type: string                description: Associated training job ID (optional)                example: "job_xyz789"              model_artifact_id:                type: string                description: Model artifact ID from training (optional)                example: "artifact_def456"              gpu_type:                type: string                enum: [NVIDIA_A100_80GB, NVIDIA_A40, NVIDIA_RTX_A6000, NVIDIA_RTX_A5000]                description: GPU type for inference workers (defaults to optimal for model size)                example: "NVIDIA_A100_80GB"              min_workers:                type: integer                default: 0                description: Minimum number of workers (0 = scale to zero when idle)                example: 0              max_workers:                type: integer                default: 3                description: Maximum number of workers for auto-scaling                example: 5              budget_limit:                type: number                description: Monthly budget limit in USD                example: 100.00              auto_stop_on_budget:                type: boolean                default: true                description: Automatically stop deployment when budget is reached                example: true              environment_variables:                type: object                description: Custom environment variables for inference container                additionalProperties:                  type: string                example:                  MAX_BATCH_SIZE: "8"                  TEMPERATURE: "0.7"    responses:      200:        description: Deployment created successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true                deployment_id:                  type: string                  description: Unique deployment identifier                  example: "dep_abc123xyz"                endpoint_url:                  type: string                  format: uri                  description: Production inference endpoint URL                  example: "https://api.runpod.ai/v2/my-endpoint-abc123/runsync"                status:                  type: string                  enum: [INITIALIZING, RUNNING, STOPPED, FAILED]                  description: Current deployment status                  example: "INITIALIZING"      400:        description: Bad request - Missing required fields or invalid provider        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: false                error:                  type: object                  properties:                    code:                      type: string                      enum: [VALIDATION_ERROR, UNSUPPORTED_PROVIDER]                      example: "VALIDATION_ERROR"                    message:                      type: string                      example: "Missing required field: budget_limit"      401:        description: Unauthorized - Missing or invalid credentials        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: false                error:                  type: object                  properties:                    code:                      type: string                      enum: [UNAUTHORIZED, NO_CREDENTIALS]                      example: "NO_CREDENTIALS"                    message:                      type: string                      example: "No RunPod API key found"                    details:                      type: string                      example: "Please add your RunPod API key in Settings > Secrets"      500:        description: Internal server error - Deployment failed        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: false                error:                  type: object                  properties:                    code:                      type: string                      enum: [DEPLOYMENT_FAILED, INTERNAL_ERROR]                      example: "DEPLOYMENT_FAILED"                    message:                      type: string                      example: "Failed to create inference endpoint"                    details:                      type: string                      example: "RunPod API error: Invalid GPU type"

## 120. What is the request body for POST /api/inference/deploy?

requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - provider              - deployment_name              - base_model              - model_type              - model_storage_url              - budget_limit            properties:              provider:                type: string                enum: [runpod-serverless]

## 121. What responses does POST /api/inference/deploy return?

responses:      200:

## 122. Does POST /api/inference/deploy require authentication?

security:      - bearerAuth: []

## 123. Can you describe POST /api/inference/deploy?

description: |      Deploy your trained models to serverless GPU inference endpoints.      This endpoint creates a production-ready, auto-scaling inference deployment on RunPod Serverless.      Your model will be deployed with:      - Auto-scaling GPU workers (scale to zero when idle)      - Budget controls and spending limits      - Production-grade load balancing      - Per-request billingUse Cases:      - Deploy fine-tuned models to production      - Serve custom LLMs at scale      - A/B test different model versions      - Control infrastructure costs with budget limitsWorkflow:      1. Train your model or upload model artifacts      2. Store model weights in cloud storage (S3, GCS, etc.)      3. Call this endpoint with model URL and config      4. Use the returned endpoint_url for inference requestsNote:Requires RunPod API key configured in Settings > Secrets

## 124. What tags classify POST /api/inference/deploy?

tags:      - Inference

## 125. Which HTTP methods are implemented for /api/inference/deploy?

POST

## 126. Where is the source file for /api/inference/deploy?

app/api/inference/deploy/route.ts

## 127. What does GET /api/inference/deployments/[id]/status do?

Inference Deployment Status APIPurpose: Get status of a deployed inference endpointEndpoint: GET /api/inference/deployments/[id]/statusDate: 2025-11-12

## 128. Which HTTP methods are implemented for /api/inference/deployments/[id]/status?

GET

## 129. Where is the source file for /api/inference/deployments/[id]/status?

app/api/inference/deployments/[id]/status/route.ts

## 130. What does DELETE /api/inference/deployments/[id]/stop do?

Inference Deployment Stop APIPurpose: Stop/terminate a deployed inference endpointEndpoint: DELETE /api/inference/deployments/[id]/stopDate: 2025-11-12

## 131. Which HTTP methods are implemented for /api/inference/deployments/[id]/stop?

DELETE

## 132. Where is the source file for /api/inference/deployments/[id]/stop?

app/api/inference/deployments/[id]/stop/route.ts

## 133. What does POST /api/workspaces/invite do?

Workspace Member Invitation APIPOST /api/workspaces/inviteInvites a user to a workspace by emailRequires admin or owner role

## 134. Which HTTP methods are implemented for /api/workspaces/invite?

POST

## 135. Where is the source file for /api/workspaces/invite?

app/api/workspaces/invite/route.ts

## 136. What does DELETE /api/workspaces/[id]/share do?

Next.js API route implemented in app/api/workspaces/[id]/share/route.ts

## 137. What does GET /api/workspaces/[id]/share do?

Next.js API route implemented in app/api/workspaces/[id]/share/route.ts

## 138. What does POST /api/workspaces/[id]/share do?

Next.js API route implemented in app/api/workspaces/[id]/share/route.ts

## 139. Which HTTP methods are implemented for /api/workspaces/[id]/share?

DELETE, GET, POST

## 140. Where is the source file for /api/workspaces/[id]/share?

app/api/workspaces/[id]/share/route.ts

## 141. What does POST /api/graphrag/search do?

Next.js API route implemented in app/api/graphrag/search/route.ts

## 142. Which HTTP methods are implemented for /api/graphrag/search?

POST

## 143. Where is the source file for /api/graphrag/search?

app/api/graphrag/search/route.ts

## 144. What does GET /api/graphrag/documents do?

Next.js API route implemented in app/api/graphrag/documents/route.ts

## 145. Which HTTP methods are implemented for /api/graphrag/documents?

GET

## 146. Where is the source file for /api/graphrag/documents?

app/api/graphrag/documents/route.ts

## 147. What does POST /api/graphrag/upload do?

Next.js API route implemented in app/api/graphrag/upload/route.ts

## 148. Which HTTP methods are implemented for /api/graphrag/upload?

POST

## 149. Where is the source file for /api/graphrag/upload?

app/api/graphrag/upload/route.ts

## 150. What does POST /api/graphrag/process/[id] do?

Next.js API route implemented in app/api/graphrag/process/[id]/route.ts

## 151. Which HTTP methods are implemented for /api/graphrag/process/[id]?

POST

## 152. Where is the source file for /api/graphrag/process/[id]?

app/api/graphrag/process/[id]/route.ts

## 153. What does DELETE /api/graphrag/delete/[id] do?

Next.js API route implemented in app/api/graphrag/delete/[id]/route.ts

## 154. Which HTTP methods are implemented for /api/graphrag/delete/[id]?

DELETE

## 155. Where is the source file for /api/graphrag/delete/[id]?

app/api/graphrag/delete/[id]/route.ts

## 156. What does POST /api/conversations/generate-title do?

Next.js API route implemented in app/api/conversations/generate-title/route.ts

## 157. Which HTTP methods are implemented for /api/conversations/generate-title?

POST

## 158. Where is the source file for /api/conversations/generate-title?

app/api/conversations/generate-title/route.ts

## 159. What does POST /api/conversations/promote do?

Next.js API route implemented in app/api/conversations/promote/route.ts

## 160. Which HTTP methods are implemented for /api/conversations/promote?

POST

## 161. Where is the source file for /api/conversations/promote?

app/api/conversations/promote/route.ts

## 162. What does GET /api/conversations/[id]/context do?

Conversation Context APIGET: Fetch context tracker state for a conversationPOST: Save/Update context tracker stateDate: 2025-10-24

## 163. What does POST /api/conversations/[id]/context do?

Conversation Context APIGET: Fetch context tracker state for a conversationPOST: Save/Update context tracker stateDate: 2025-10-24

## 164. Which HTTP methods are implemented for /api/conversations/[id]/context?

GET, POST

## 165. Where is the source file for /api/conversations/[id]/context?

app/api/conversations/[id]/context/route.ts

## 166. What does GET /api/usage/current do?

GET /api/usage/currentFetch current month's usage with plan limits

## 167. Which HTTP methods are implemented for /api/usage/current?

GET

## 168. Where is the source file for /api/usage/current?

app/api/usage/current/route.ts

## 169. What does GET /api/subscriptions/current do?

GET /api/subscriptions/currentFetch current user's subscription with plan details

## 170. Which HTTP methods are implemented for /api/subscriptions/current?

GET

## 171. Where is the source file for /api/subscriptions/current?

app/api/subscriptions/current/route.ts

## 172. What does GET /api/servers/status do?

Server Status API EndpointGET /api/servers/statusReturns status of all user's vLLM/Ollama inference serversPhase: vLLM Server Management UI - Phase 1Date: 2025-11-02

## 173. Which HTTP methods are implemented for /api/servers/status?

GET

## 174. Where is the source file for /api/servers/status?

app/api/servers/status/route.ts

## 175. What does POST /api/servers/stop do?

Server Stop API EndpointPOST /api/servers/stopStops a running vLLM/Ollama inference serverPhase: vLLM Server Management UI - Phase 1Date: 2025-11-02

## 176. Which HTTP methods are implemented for /api/servers/stop?

POST

## 177. Where is the source file for /api/servers/stop?

app/api/servers/stop/route.ts

## 178. What does POST /api/servers/start do?

Server Start API EndpointPOST /api/servers/startStarts a stopped vLLM/Ollama inference serverPhase: vLLM Server Management UI - Phase 1Date: 2025-11-02

## 179. Which HTTP methods are implemented for /api/servers/start?

POST

## 180. Where is the source file for /api/servers/start?

app/api/servers/start/route.ts

## 181. What does DELETE /api/secrets/[provider] do?

Next.js API route implemented in app/api/secrets/[provider]/route.ts

## 182. What does GET /api/secrets/[provider] do?

Next.js API route implemented in app/api/secrets/[provider]/route.ts

## 183. What does PUT /api/secrets/[provider] do?

Next.js API route implemented in app/api/secrets/[provider]/route.ts

## 184. Which HTTP methods are implemented for /api/secrets/[provider]?

DELETE, GET, PUT

## 185. Where is the source file for /api/secrets/[provider]?

app/api/secrets/[provider]/route.ts

## 186. What does GET /api/web-search/research/[id] do?

Next.js API route implemented in app/api/web-search/research/[id]/route.ts

## 187. Which HTTP methods are implemented for /api/web-search/research/[id]?

GET

## 188. Where is the source file for /api/web-search/research/[id]?

app/api/web-search/research/[id]/route.ts

## 189. What does GET /api/web-search/research/list do?

Next.js API route implemented in app/api/web-search/research/list/route.ts

## 190. Which HTTP methods are implemented for /api/web-search/research/list?

GET

## 191. Where is the source file for /api/web-search/research/list?

app/api/web-search/research/list/route.ts

## 192. What does GET /api/web-search/research/[id]/steps do?

Next.js API route implemented in app/api/web-search/research/[id]/steps/route.ts

## 193. Which HTTP methods are implemented for /api/web-search/research/[id]/steps?

GET

## 194. Where is the source file for /api/web-search/research/[id]/steps?

app/api/web-search/research/[id]/steps/route.ts

## 195. What does GET /api/web-search/research/[id]/report do?

Next.js API route implemented in app/api/web-search/research/[id]/report/route.ts

## 196. Which HTTP methods are implemented for /api/web-search/research/[id]/report?

GET

## 197. Where is the source file for /api/web-search/research/[id]/report?

app/api/web-search/research/[id]/report/route.ts

## 198. What does DELETE /api/batch-testing/archive do?

API Route - Batch Test Run Archive OperationsHandles batch test run archiving, restoration, and deletion.POST /api/batch-testing/archive - Archive test runsPATCH /api/batch-testing/archive - Restore test runsDELETE /api/batch-testing/archive - Permanently delete test runs

## 199. What does POST /api/batch-testing/archive do?

API Route - Batch Test Run Archive OperationsHandles batch test run archiving, restoration, and deletion.POST /api/batch-testing/archive - Archive test runsPATCH /api/batch-testing/archive - Restore test runsDELETE /api/batch-testing/archive - Permanently delete test runs

## 200. Which HTTP methods are implemented for /api/batch-testing/archive?

DELETE, POST

## 201. Where is the source file for /api/batch-testing/archive?

app/api/batch-testing/archive/route.ts

## 202. What does POST /api/batch-testing/cancel do?

API Route - Cancel Batch Testing RunCancels a running or pending batch test by marking it as failed.POST /api/batch-testing/cancel

## 203. Which HTTP methods are implemented for /api/batch-testing/cancel?

POST

## 204. Where is the source file for /api/batch-testing/cancel?

app/api/batch-testing/cancel/route.ts

## 205. What does POST /api/batch-testing/run do?

Run batch tests on model    description: |      Execute batch testing to measure real-time model performance metrics.      This endpoint runs prompts through the /api/chat endpoint, automatically      collecting and persisting analytics data including:      - Response quality metrics      - Latency measurements      - Token usage      - Error ratesUse Cases:      - Continuous model monitoring      - A/B testing different models      - Regression testing after model updates      - Performance benchmarking    tags:      - Batch Testing    security:      - bearerAuth: []    requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - config            properties:              config:                type: object                required:                  - model_id                properties:                  model_id:                    type: string                    description: Model ID from your registered models                    example: "gpt-4-turbo"                  dataset_id:                    type: string                    description: ID of saved dataset (alternative to source_path)                    example: "dataset_abc123"                  source_path:                    type: string                    description: File path to prompts (alternative to dataset_id)                    example: "/path/to/prompts.json"                  prompt_limit:                    type: integer                    default: 25                    description: Maximum number of prompts to test                    example: 100                  concurrency:                    type: integer                    default: 3                    description: Number of concurrent requests                    example: 5                  delay_ms:                    type: integer                    default: 1000                    description: Delay between requests in milliseconds                    example: 500    responses:      200:        description: Batch test completed successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true                test_id:                  type: string                  description: Unique test run identifier                  example: "test_xyz789"                results:                  type: object                  properties:                    total_prompts:                      type: integer                      example: 100                    successful:                      type: integer                      example: 98                    failed:                      type: integer                      example: 2                    avg_latency_ms:                      type: number                      example: 1234.56                    total_tokens:                      type: integer                      example: 15000                analytics_url:                  type: string                  description: URL to view detailed analytics                  example: "https://app.example.com/analytics/test_xyz789"      400:        description: Bad request - Missing or invalid parameters        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized - Invalid or missing bearer token        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      500:        description: Internal server error        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 206. What is the request body for POST /api/batch-testing/run?

requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - config            properties:              config:                type: object                required:                  - model_id                properties:                  model_id:                    type: string

## 207. What responses does POST /api/batch-testing/run return?

responses:      200:

## 208. Does POST /api/batch-testing/run require authentication?

security:      - bearerAuth: []

## 209. Can you describe POST /api/batch-testing/run?

description: |      Execute batch testing to measure real-time model performance metrics.      This endpoint runs prompts through the /api/chat endpoint, automatically      collecting and persisting analytics data including:      - Response quality metrics      - Latency measurements      - Token usage      - Error ratesUse Cases:      - Continuous model monitoring      - A/B testing different models      - Regression testing after model updates      - Performance benchmarking

## 210. What tags classify POST /api/batch-testing/run?

tags:      - Batch Testing

## 211. Which HTTP methods are implemented for /api/batch-testing/run?

POST

## 212. Where is the source file for /api/batch-testing/run?

app/api/batch-testing/run/route.ts

## 213. What does POST /api/batch-testing/extract do?

Extract prompts from conversations    description: |      Extract prompts from Claude Desktop conversation JSON files or other sources.      This is the first step before running batch tests - it extracts and validates      prompts from your conversation history or custom JSON files.Use Cases:      - Prepare test datasets from production conversations      - Extract prompts from exported chat histories      - Build regression test suites from real user interactions    tags:      - Batch Testing    security:      - bearerAuth: []    requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - source_path            properties:              source_path:                type: string                description: Path to conversation JSON files                example: "/path/to/conversations"              limit:                type: integer                default: 50                description: Maximum number of prompts to extract                example: 100    responses:      200:        description: Prompts extracted successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true                total:                  type: integer                  description: Total prompts extracted                  example: 87                prompts:                  type: array                  items:                    type: string                  example: ["What is machine learning?", "Explain neural networks"]                filesProcessed:                  type: integer                  description: Number of files scanned                  example: 12      400:        description: Bad request - Invalid source path        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 214. What is the request body for POST /api/batch-testing/extract?

requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - source_path            properties:              source_path:                type: string

## 215. What responses does POST /api/batch-testing/extract return?

responses:      200:

## 216. Does POST /api/batch-testing/extract require authentication?

security:      - bearerAuth: []

## 217. Can you describe POST /api/batch-testing/extract?

description: |      Extract prompts from Claude Desktop conversation JSON files or other sources.      This is the first step before running batch tests - it extracts and validates      prompts from your conversation history or custom JSON files.Use Cases:      - Prepare test datasets from production conversations      - Extract prompts from exported chat histories      - Build regression test suites from real user interactions

## 218. What tags classify POST /api/batch-testing/extract?

tags:      - Batch Testing

## 219. Which HTTP methods are implemented for /api/batch-testing/extract?

POST

## 220. Where is the source file for /api/batch-testing/extract?

app/api/batch-testing/extract/route.ts

## 221. What does GET /api/batch-testing/[id]/validators do?

Next.js API route implemented in app/api/batch-testing/[id]/validators/route.ts

## 222. Which HTTP methods are implemented for /api/batch-testing/[id]/validators?

GET

## 223. Where is the source file for /api/batch-testing/[id]/validators?

app/api/batch-testing/[id]/validators/route.ts

## 224. What does GET /api/batch-testing/status/[id] do?

Get batch test status    description: |      Check the status of a running or completed batch test.      Returns real-time progress information including:      - Total, completed, and failed prompts      - Current execution stage      - Estimated time remaining      - Preliminary results (if available)Use Cases:      - Poll for test completion      - Monitor long-running tests      - Display progress in your UI      - Track test execution in real-time    tags:      - Batch Testing    security:      - bearerAuth: []    parameters:      - in: path        name: id        required: true        schema:          type: string        description: Batch test run ID (returned from /api/batch-testing/run)        example: "test_xyz789"    responses:      200:        description: Status retrieved successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true                test_id:                  type: string                  example: "test_xyz789"                status:                  type: string                  enum: [pending, running, completed, failed, cancelled]                  example: "running"                progress:                  type: object                  properties:                    total:                      type: integer                      example: 100                    completed:                      type: integer                      example: 67                    failed:                      type: integer                      example: 3                    percentage:                      type: number                      example: 67.0                estimated_time_remaining_ms:                  type: integer                  description: Estimated milliseconds until completion                  example: 45000                preliminary_results:                  type: object                  description: Partial results (only if test is running/completed)                  properties:                    avg_latency_ms:                      type: number                      example: 1234.56                    success_rate:                      type: number                      example: 0.96      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      404:        description: Test run not found        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 225. Which parameters does GET /api/batch-testing/status/[id] accept?

parameters:      - in: path        name: id        required: true        schema:          type: string

## 226. What responses does GET /api/batch-testing/status/[id] return?

responses:      200:

## 227. Does GET /api/batch-testing/status/[id] require authentication?

security:      - bearerAuth: []

## 228. Can you describe GET /api/batch-testing/status/[id]?

description: |      Check the status of a running or completed batch test.      Returns real-time progress information including:      - Total, completed, and failed prompts      - Current execution stage      - Estimated time remaining      - Preliminary results (if available)Use Cases:      - Poll for test completion      - Monitor long-running tests      - Display progress in your UI      - Track test execution in real-time

## 229. What tags classify GET /api/batch-testing/status/[id]?

tags:      - Batch Testing

## 230. Which HTTP methods are implemented for /api/batch-testing/status/[id]?

GET

## 231. Where is the source file for /api/batch-testing/status/[id]?

app/api/batch-testing/status/[id]/route.ts

## 232. What does DELETE /api/search-summaries/delete do?

API Route - Delete Search SummariesDeletes saved search result summaries for the authenticated userDELETE /api/search-summaries/delete - Delete one or more summaries  Body: { summaryIds: string[] }Phase 7: Web Search Tool Enhancement - Summary ManagementDate: 2025-12-16

## 233. Which HTTP methods are implemented for /api/search-summaries/delete?

DELETE

## 234. Where is the source file for /api/search-summaries/delete?

app/api/search-summaries/delete/route.ts

## 235. What does GET /api/search-summaries/export do?

Web Search Summaries Export APIGET /api/search-summaries/export?format=csv|json|md&conversationId=...&savedOnly=trueReturns a downloadable export of the user's saved search summaries

## 236. Which HTTP methods are implemented for /api/search-summaries/export?

GET

## 237. Where is the source file for /api/search-summaries/export?

app/api/search-summaries/export/route.ts

## 238. What does GET /api/search-summaries/retrieve do?

API Route - Retrieve Search SummariesRetrieves saved search result summaries for the authenticated userGET /api/search-summaries/retrieve - Get saved summaries  Query params:  - conversationId?: Filter by conversation  - limit?: Max number of results (default: 50)  - offset?: Pag

## 239. Which HTTP methods are implemented for /api/search-summaries/retrieve?

GET

## 240. Where is the source file for /api/search-summaries/retrieve?

app/api/search-summaries/retrieve/route.ts

## 241. What does POST /api/search-summaries/save do?

API Route - Save Search SummariesSaves AI-generated search result summaries for later usePOST /api/search-summaries/save - Save one or more summariesPhase 7: Web Search Tool Enhancement - Summary ManagementDate: 2025-12-16

## 242. Which HTTP methods are implemented for /api/search-summaries/save?

POST

## 243. Where is the source file for /api/search-summaries/save?

app/api/search-summaries/save/route.ts

## 244. What does GET /api/analytics/traces do?

Get execution traces    description: |      Retrieve detailed execution traces of LLM operations for debugging and analysis.      Traces provide hierarchical view of:      - Request/response cycles      - Tool calls and their execution      - Model invocations      - Performance timing data      - Error informationUse Cases:      - Debug production issues      - Performance profiling      - Track multi-step agent operations      - Audit model behavior    tags:      - Analytics    security:      - bearerAuth: []    parameters:      - in: query        name: conversation_id        schema:          type: string        description: Filter by conversation ID      - in: query        name: limit        schema:          type: integer          default: 100        description: Maximum traces to return      - in: query        name: start_date        schema:          type: string          format: date-time        description: Filter traces after this date    responses:      200:        description: Traces retrieved successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true                traces:                  type: array                  items:                    type: object                    properties:                      trace_id:                        type: string                      span_name:                        type: string                        example: "llm.completion"                      duration_ms:                        type: number                        example: 1234.56                      model_name:                        type: string                        example: "gpt-4-turbo"                      operation_type:                        type: string                        example: "completion"                      children:                        type: array                        description: Nested child traces      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  post:    summary: Capture execution trace    description: |      Send a trace event for an LLM operation. Used to track and debug production systems.      Typically called automatically by your application code when integrated with      tracing middleware.    tags:      - Analytics    security:      - bearerAuth: []    requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - trace_id              - span_id              - span_name              - start_time            properties:              trace_id:                type: string                example: "trace_abc123"              span_id:                type: string                example: "span_xyz789"              span_name:                type: string                example: "llm.completion"              start_time:                type: string                format: date-time              end_time:                type: string                format: date-time              duration_ms:                type: number              operation_type:                type: string                example: "completion"              model_name:                type: string                example: "gpt-4-turbo"              metadata:                type: object    responses:      201:        description: Trace captured successfully      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 245. What is the request body for GET /api/analytics/traces?

requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - trace_id              - span_id              - span_name              - start_time            properties:              trace_id:                type: string                example: "trace_abc123"              span_id:                type: string                example: "span_xyz789"              span_name:                type: string                example: "llm.completion"              start_time:                type: string                format: date-time              end_time:                type: string                format: date-time              duration_ms:                type: number              operation_type:                type: string                example: "completion"              model_name:                type: string                example: "gpt-4-turbo"              metadata:                type: object

## 246. Which parameters does GET /api/analytics/traces accept?

parameters:      - in: query        name: conversation_id        schema:          type: string

## 247. What responses does GET /api/analytics/traces return?

responses:      200:

## 248. Does GET /api/analytics/traces require authentication?

security:      - bearerAuth: []

## 249. Can you describe GET /api/analytics/traces?

description: |      Retrieve detailed execution traces of LLM operations for debugging and analysis.      Traces provide hierarchical view of:      - Request/response cycles      - Tool calls and their execution      - Model invocations      - Performance timing data      - Error informationUse Cases:      - Debug production issues      - Performance profiling      - Track multi-step agent operations      - Audit model behavior

## 250. What tags classify GET /api/analytics/traces?

tags:      - Analytics

## 251. What does POST /api/analytics/traces do?

Get execution traces    description: |      Retrieve detailed execution traces of LLM operations for debugging and analysis.      Traces provide hierarchical view of:      - Request/response cycles      - Tool calls and their execution      - Model invocations      - Performance timing data      - Error informationUse Cases:      - Debug production issues      - Performance profiling      - Track multi-step agent operations      - Audit model behavior    tags:      - Analytics    security:      - bearerAuth: []    parameters:      - in: query        name: conversation_id        schema:          type: string        description: Filter by conversation ID      - in: query        name: limit        schema:          type: integer          default: 100        description: Maximum traces to return      - in: query        name: start_date        schema:          type: string          format: date-time        description: Filter traces after this date    responses:      200:        description: Traces retrieved successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true                traces:                  type: array                  items:                    type: object                    properties:                      trace_id:                        type: string                      span_name:                        type: string                        example: "llm.completion"                      duration_ms:                        type: number                        example: 1234.56                      model_name:                        type: string                        example: "gpt-4-turbo"                      operation_type:                        type: string                        example: "completion"                      children:                        type: array                        description: Nested child traces      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  post:    summary: Capture execution trace    description: |      Send a trace event for an LLM operation. Used to track and debug production systems.      Typically called automatically by your application code when integrated with      tracing middleware.    tags:      - Analytics    security:      - bearerAuth: []    requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - trace_id              - span_id              - span_name              - start_time            properties:              trace_id:                type: string                example: "trace_abc123"              span_id:                type: string                example: "span_xyz789"              span_name:                type: string                example: "llm.completion"              start_time:                type: string                format: date-time              end_time:                type: string                format: date-time              duration_ms:                type: number              operation_type:                type: string                example: "completion"              model_name:                type: string                example: "gpt-4-turbo"              metadata:                type: object    responses:      201:        description: Trace captured successfully      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 252. What is the request body for POST /api/analytics/traces?

requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - trace_id              - span_id              - span_name              - start_time            properties:              trace_id:                type: string                example: "trace_abc123"              span_id:                type: string                example: "span_xyz789"              span_name:                type: string                example: "llm.completion"              start_time:                type: string                format: date-time              end_time:                type: string                format: date-time              duration_ms:                type: number              operation_type:                type: string                example: "completion"              model_name:                type: string                example: "gpt-4-turbo"              metadata:                type: object

## 253. Which parameters does POST /api/analytics/traces accept?

parameters:      - in: query        name: conversation_id        schema:          type: string

## 254. What responses does POST /api/analytics/traces return?

responses:      200:

## 255. Does POST /api/analytics/traces require authentication?

security:      - bearerAuth: []

## 256. Can you describe POST /api/analytics/traces?

description: |      Retrieve detailed execution traces of LLM operations for debugging and analysis.      Traces provide hierarchical view of:      - Request/response cycles      - Tool calls and their execution      - Model invocations      - Performance timing data      - Error informationUse Cases:      - Debug production issues      - Performance profiling      - Track multi-step agent operations      - Audit model behavior

## 257. What tags classify POST /api/analytics/traces?

tags:      - Analytics

## 258. Which HTTP methods are implemented for /api/analytics/traces?

GET, POST

## 259. Where is the source file for /api/analytics/traces?

app/api/analytics/traces/route.ts

## 260. What does GET /api/analytics/benchmark-analysis do?

API Route - Benchmark AnalysisGET /api/analytics/benchmark-analysisAuth required (Supabase JWT via Authorization bearer)

## 261. Which HTTP methods are implemented for /api/analytics/benchmark-analysis?

GET

## 262. Where is the source file for /api/analytics/benchmark-analysis?

app/api/analytics/benchmark-analysis/route.ts

## 263. What does GET /api/analytics/model-comparison do?

API Route - Model Comparison AnalyticsReturns detailed comparison of model performance including:- Quality metrics per model (average rating, success rate)- Cost metrics per model (average cost, quality per dollar)- Performance trends (improving/declining/stable)- Recommendations

## 264. Which HTTP methods are implemented for /api/analytics/model-comparison?

GET

## 265. Where is the source file for /api/analytics/model-comparison?

app/api/analytics/model-comparison/route.ts

## 266. What does POST /api/analytics/chat do?

Next.js API route implemented in app/api/analytics/chat/route.ts

## 267. Which HTTP methods are implemented for /api/analytics/chat?

POST

## 268. Where is the source file for /api/analytics/chat?

app/api/analytics/chat/route.ts

## 269. What does GET /api/analytics/anomalies do?

API Route - Anomaly DetectionRetrieves and acknowledges detected anomalies for proactive monitoringGET /api/analytics/anomalies - List anomalies with filteringPATCH /api/analytics/anomalies - Acknowledge anomalyPhase 2.2: Anomaly Detection APIDate: 2025-10-25

## 270. Which HTTP methods are implemented for /api/analytics/anomalies?

GET

## 271. Where is the source file for /api/analytics/anomalies?

app/api/analytics/anomalies/route.ts

## 272. What does GET /api/analytics/data do?

Get production model analytics    description: |      Retrieve aggregated analytics and metrics for your deployed models.Metrics Available:      - Token usage (input/output tokens, costs)      - Quality metrics (response quality, hallucination rates)      - Tool usage statistics      - Conversation metrics (length, turns, satisfaction)      - Error rates and types      - Latency measurements (p50, p95, p99)Use Cases:      - Embed real-time dashboards in your application      - Monitor production model performance      - Track costs and usage across time periods      - Detect anomalies and degradation      - Generate custom reportsNo UI Required- Perfect for headless integrations!    tags:      - Analytics    security:      - bearerAuth: []    parameters:      - in: query        name: startDate        required: true        schema:          type: string          format: date-time        description: Start of date range (ISO 8601)        example: "2024-01-01T00:00:00Z"      - in: query        name: endDate        required: true        schema:          type: string          format: date-time        description: End of date range (ISO 8601)        example: "2024-01-31T23:59:59Z"      - in: query        name: period        schema:          type: string          enum: [hour, day, week, month, all]          default: day        description: Aggregation period        example: "day"      - in: query        name: metrics        schema:          type: string        description: Comma-separated metrics to fetch (or "all")        example: "tokens,quality,latency"      - in: query        name: model_id        schema:          type: string        description: Filter by specific model ID        example: "gpt-4-turbo"    responses:      200:        description: Analytics data retrieved successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true                dateRange:                  type: object                  properties:                    start:                      type: string                      format: date-time                    end:                      type: string                      format: date-time                    period:                      type: string                      example: "day"                data:                  type: object                  properties:                    tokens:                      type: object                      description: Token usage metrics                      properties:                        total_input_tokens:                          type: integer                          example: 150000                        total_output_tokens:                          type: integer                          example: 75000                        estimated_cost:                          type: number                          example: 12.45                    quality:                      type: object                      description: Response quality metrics                      properties:                        avg_quality_score:                          type: number                          example: 0.87                        hallucination_rate:                          type: number                          example: 0.03                    latency:                      type: object                      description: Latency statistics                      properties:                        p50_ms:                          type: number                          example: 1234.5                        p95_ms:                          type: number                          example: 2456.8                        p99_ms:                          type: number                          example: 3890.2                    errors:                      type: object                      properties:                        total_errors:                          type: integer                          example: 12                        error_rate:                          type: number                          example: 0.012      400:        description: Bad request - Invalid parameters        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      500:        description: Internal server error        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 273. Which parameters does GET /api/analytics/data accept?

parameters:      - in: query        name: startDate        required: true        schema:          type: string          format: date-time

## 274. What responses does GET /api/analytics/data return?

responses:      200:

## 275. Does GET /api/analytics/data require authentication?

security:      - bearerAuth: []

## 276. Can you describe GET /api/analytics/data?

description: |      Retrieve aggregated analytics and metrics for your deployed models.Metrics Available:      - Token usage (input/output tokens, costs)      - Quality metrics (response quality, hallucination rates)      - Tool usage statistics      - Conversation metrics (length, turns, satisfaction)      - Error rates and types      - Latency measurements (p50, p95, p99)Use Cases:      - Embed real-time dashboards in your application      - Monitor production model performance      - Track costs and usage across time periods      - Detect anomalies and degradation      - Generate custom reportsNo UI Required- Perfect for headless integrations!

## 277. What tags classify GET /api/analytics/data?

tags:      - Analytics

## 278. Which HTTP methods are implemented for /api/analytics/data?

GET

## 279. Where is the source file for /api/analytics/data?

app/api/analytics/data/route.ts

## 280. What does DELETE /api/analytics/cohorts do?

Cohorts API RouteHandles CRUD operations for user cohorts.Endpoints:- GET: List cohorts with optional filtering- POST: Create a new cohort- PATCH: Update an existing cohort- DELETE: Delete a cohort (non-system only)Phase 3.1: User Cohort BackendDate: 2025-10-25

## 281. What does GET /api/analytics/cohorts do?

Cohorts API RouteHandles CRUD operations for user cohorts.Endpoints:- GET: List cohorts with optional filtering- POST: Create a new cohort- PATCH: Update an existing cohort- DELETE: Delete a cohort (non-system only)Phase 3.1: User Cohort BackendDate: 2025-10-25

## 282. What does POST /api/analytics/cohorts do?

Cohorts API RouteHandles CRUD operations for user cohorts.Endpoints:- GET: List cohorts with optional filtering- POST: Create a new cohort- PATCH: Update an existing cohort- DELETE: Delete a cohort (non-system only)Phase 3.1: User Cohort BackendDate: 2025-10-25

## 283. Which HTTP methods are implemented for /api/analytics/cohorts?

DELETE, GET, POST

## 284. Where is the source file for /api/analytics/cohorts?

app/api/analytics/cohorts/route.ts

## 285. What does GET /api/analytics/judgment-examples do?

API Route - Judgment Examples by TagGET /api/analytics/judgment-examples?tag=hallucination&page=1&pageSize=10&startDate=...&endDate=...Auth required (Supabase JWT via Authorization bearer)

## 286. Which HTTP methods are implemented for /api/analytics/judgment-examples?

GET

## 287. Where is the source file for /api/analytics/judgment-examples?

app/api/analytics/judgment-examples/route.ts

## 288. What does POST /api/analytics/export do?

Analytics Export APIPOST /api/analytics/exportGenerate analytics export files (CSV, JSON, or Report)Phase 3: Backend API EndpointsDate: October 25, 2025

## 289. Which HTTP methods are implemented for /api/analytics/export?

POST

## 290. Where is the source file for /api/analytics/export?

app/api/analytics/export/route.ts

## 291. What does GET /api/analytics/experiments do?

API Route - A/B Testing Experiments ManagementManages experiments, variants, and traffic splitting for A/B testingGET /api/analytics/experiments - List experimentsPOST /api/analytics/experiments - Create new experimentPATCH /api/analytics/experiments - Update experimentDELETE /ap

## 292. What does POST /api/analytics/experiments do?

API Route - A/B Testing Experiments ManagementManages experiments, variants, and traffic splitting for A/B testingGET /api/analytics/experiments - List experimentsPOST /api/analytics/experiments - Create new experimentPATCH /api/analytics/experiments - Update experimentDELETE /ap

## 293. Which HTTP methods are implemented for /api/analytics/experiments?

GET, POST

## 294. Where is the source file for /api/analytics/experiments?

app/api/analytics/experiments/route.ts

## 295. What does GET /api/analytics/download/[id] do?

Analytics Download APIGET /api/analytics/download/[id]Download a previously generated export filePhase 3: Backend API EndpointsDate: October 25, 2025

## 296. Which HTTP methods are implemented for /api/analytics/download/[id]?

GET

## 297. Where is the source file for /api/analytics/download/[id]?

app/api/analytics/download/[id]/route.ts

## 298. What does GET /api/analytics/sentiment/insights do?

Get sentiment insights and anomalies    description: |      Detect sentiment-related patterns, anomalies, and insights from user conversations.      Analyzes conversation sentiment to identify:      - Sudden sentiment drops (user dissatisfaction)      - Sentiment improvement patterns      - Recurring negative topics      - User satisfaction trends      - Emotional engagement patternsUse Cases:      - Monitor user satisfaction in production      - Detect quality regressions after model updates      - Identify problematic conversation patterns      - Track customer sentiment over time      - Trigger alerts for negative sentiment spikes    tags:      - Analytics    security:      - bearerAuth: []    parameters:      - in: query        name: lookback_days        schema:          type: integer          default: 30        description: Number of days to analyze        example: 7    responses:      200:        description: Sentiment insights retrieved successfully        content:          application/json:            schema:              type: object              properties:                insights:                  type: array                  items:                    type: object                    properties:                      type:                        type: string                        enum: [sentiment_drop, sentiment_improvement, negative_pattern, positive_trend]                        example: "sentiment_drop"                      severity:                        type: string                        enum: [low, medium, high, critical]                        example: "high"                      description:                        type: string                        example: "Sentiment dropped by 35% in the last 24 hours"                      affected_conversations:                        type: integer                        example: 23                      timestamp:                        type: string                        format: date-time                      metadata:                        type: object                        description: Additional context about the insight      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 299. Which parameters does GET /api/analytics/sentiment/insights accept?

parameters:      - in: query        name: lookback_days        schema:          type: integer          default: 30

## 300. What responses does GET /api/analytics/sentiment/insights return?

responses:      200:

## 301. Does GET /api/analytics/sentiment/insights require authentication?

security:      - bearerAuth: []

## 302. Can you describe GET /api/analytics/sentiment/insights?

description: |      Detect sentiment-related patterns, anomalies, and insights from user conversations.      Analyzes conversation sentiment to identify:      - Sudden sentiment drops (user dissatisfaction)      - Sentiment improvement patterns      - Recurring negative topics      - User satisfaction trends      - Emotional engagement patternsUse Cases:      - Monitor user satisfaction in production      - Detect quality regressions after model updates      - Identify problematic conversation patterns      - Track customer sentiment over time      - Trigger alerts for negative sentiment spikes

## 303. What tags classify GET /api/analytics/sentiment/insights?

tags:      - Analytics

## 304. Which HTTP methods are implemented for /api/analytics/sentiment/insights?

GET

## 305. Where is the source file for /api/analytics/sentiment/insights?

app/api/analytics/sentiment/insights/route.ts

## 306. What does GET /api/analytics/sentiment/trends do?

Sentiment Trends API RouteReturns sentiment analysis trends for a user over a date range.Query Parameters:- start_date: Optional ISO date string (defaults to 30 days ago)- end_date: Optional ISO date string (defaults to now)Phase 3.3: Advanced Sentiment AnalysisDate: 2025-10-25

## 307. Which HTTP methods are implemented for /api/analytics/sentiment/trends?

GET

## 308. Where is the source file for /api/analytics/sentiment/trends?

app/api/analytics/sentiment/trends/route.ts

## 309. What does GET /api/analytics/sentiment/conversations/[id] do?

Conversation Sentiment Analysis API RouteAnalyzes sentiment for a specific conversation.Path Parameters:- id: Conversation IDPhase 3.3: Advanced Sentiment AnalysisDate: 2025-10-25

## 310. Which HTTP methods are implemented for /api/analytics/sentiment/conversations/[id]?

GET

## 311. Where is the source file for /api/analytics/sentiment/conversations/[id]?

app/api/analytics/sentiment/conversations/[id]/route.ts

## 312. What does POST /api/analytics/cohorts/[id]/refresh do?

Cohort Refresh API RouteHandles refreshing dynamic cohort membership based on criteria.Endpoints:- POST: Refresh cohort membership by re-evaluating criteriaPhase 3.1: User Cohort BackendDate: 2025-10-25

## 313. Which HTTP methods are implemented for /api/analytics/cohorts/[id]/refresh?

POST

## 314. Where is the source file for /api/analytics/cohorts/[id]/refresh?

app/api/analytics/cohorts/[id]/refresh/route.ts

## 315. What does DELETE /api/analytics/cohorts/[id]/members do?

Cohort Members API RouteHandles member management for cohorts.Endpoints:- GET: List cohort members- POST: Add members to cohort- DELETE: Remove member from cohortPhase 3.1: User Cohort BackendDate: 2025-10-25

## 316. What does GET /api/analytics/cohorts/[id]/members do?

Cohort Members API RouteHandles member management for cohorts.Endpoints:- GET: List cohort members- POST: Add members to cohort- DELETE: Remove member from cohortPhase 3.1: User Cohort BackendDate: 2025-10-25

## 317. What does POST /api/analytics/cohorts/[id]/members do?

Cohort Members API RouteHandles member management for cohorts.Endpoints:- GET: List cohort members- POST: Add members to cohort- DELETE: Remove member from cohortPhase 3.1: User Cohort BackendDate: 2025-10-25

## 318. Which HTTP methods are implemented for /api/analytics/cohorts/[id]/members?

DELETE, GET, POST

## 319. Where is the source file for /api/analytics/cohorts/[id]/members?

app/api/analytics/cohorts/[id]/members/route.ts

## 320. What does GET /api/analytics/cohorts/[id]/metrics do?

Cohort Metrics API RouteHandles metrics calculation and comparison for cohorts.Endpoints:- GET: Get cohort metrics with optional baseline comparison and trendsPhase 3.1: User Cohort BackendDate: 2025-10-25

## 321. Which HTTP methods are implemented for /api/analytics/cohorts/[id]/metrics?

GET

## 322. Where is the source file for /api/analytics/cohorts/[id]/metrics?

app/api/analytics/cohorts/[id]/metrics/route.ts

## 323. What does POST /api/export/generate do?

API Route - Export GenerationGenerates conversation exports in various formats.POST /api/export/generate

## 324. Which HTTP methods are implemented for /api/export/generate?

POST

## 325. Where is the source file for /api/export/generate?

app/api/export/generate/route.ts

## 326. What does GET /api/export/archive do?

API Route - Archive OperationsHandles conversation archiving, restoration, and listing.POST /api/export/archive - Archive conversationsPATCH /api/export/archive - Restore conversationsGET /api/export/archive - List archived conversations

## 327. What does POST /api/export/archive do?

API Route - Archive OperationsHandles conversation archiving, restoration, and listing.POST /api/export/archive - Archive conversationsPATCH /api/export/archive - Restore conversationsGET /api/export/archive - List archived conversations

## 328. Which HTTP methods are implemented for /api/export/archive?

GET, POST

## 329. Where is the source file for /api/export/archive?

app/api/export/archive/route.ts

## 330. What does DELETE /api/export/download/[id] do?

API Route - Export DownloadDownloads a generated export file.GET /api/export/download/[id]

## 331. What does GET /api/export/download/[id] do?

API Route - Export DownloadDownloads a generated export file.GET /api/export/download/[id]

## 332. Which HTTP methods are implemented for /api/export/download/[id]?

DELETE, GET

## 333. Where is the source file for /api/export/download/[id]?

app/api/export/download/[id]/route.ts

## 334. What does GET /api/approvals/[id] do?

Next.js API route implemented in app/api/approvals/[id]/route.ts

## 335. What does POST /api/approvals/[id] do?

Next.js API route implemented in app/api/approvals/[id]/route.ts

## 336. Which HTTP methods are implemented for /api/approvals/[id]?

GET, POST

## 337. Where is the source file for /api/approvals/[id]?

app/api/approvals/[id]/route.ts

## 338. What does GET /api/approvals/stats do?

Next.js API route implemented in app/api/approvals/stats/route.ts

## 339. Which HTTP methods are implemented for /api/approvals/stats?

GET

## 340. Where is the source file for /api/approvals/stats?

app/api/approvals/stats/route.ts

## 341. What does POST /api/approvals/[id]/reject do?

Next.js API route implemented in app/api/approvals/[id]/reject/route.ts

## 342. Which HTTP methods are implemented for /api/approvals/[id]/reject?

POST

## 343. Where is the source file for /api/approvals/[id]/reject?

app/api/approvals/[id]/reject/route.ts

## 344. What does POST /api/approvals/[id]/approve do?

Next.js API route implemented in app/api/approvals/[id]/approve/route.ts

## 345. Which HTTP methods are implemented for /api/approvals/[id]/approve?

POST

## 346. Where is the source file for /api/approvals/[id]/approve?

app/api/approvals/[id]/approve/route.ts

## 347. What does POST /api/approvals/[id]/cancel do?

Next.js API route implemented in app/api/approvals/[id]/cancel/route.ts

## 348. Which HTTP methods are implemented for /api/approvals/[id]/cancel?

POST

## 349. Where is the source file for /api/approvals/[id]/cancel?

app/api/approvals/[id]/cancel/route.ts

## 350. What does POST /api/stripe/create-portal-session do?

Stripe Customer Portal Session CreationPOST /api/stripe/create-portal-sessionCreates a Stripe billing portal session for subscription managementDate: 2025-10-24

## 351. Which HTTP methods are implemented for /api/stripe/create-portal-session?

POST

## 352. Where is the source file for /api/stripe/create-portal-session?

app/api/stripe/create-portal-session/route.ts

## 353. What does POST /api/stripe/create-checkout-session do?

Stripe Checkout Session CreationPOST /api/stripe/create-checkout-sessionCreates a Stripe checkout session for plan upgradesDate: 2025-10-24

## 354. Which HTTP methods are implemented for /api/stripe/create-checkout-session?

POST

## 355. Where is the source file for /api/stripe/create-checkout-session?

app/api/stripe/create-checkout-session/route.ts

## 356. What does POST /api/stripe/webhook do?

Stripe Webhook HandlerPOST /api/stripe/webhookHandles Stripe webhook events for subscription lifecycleCRITICAL: This endpoint MUST verify webhook signaturesDate: 2025-10-24

## 357. Which HTTP methods are implemented for /api/stripe/webhook?

POST

## 358. Where is the source file for /api/stripe/webhook?

app/api/stripe/webhook/route.ts

## 359. What does POST /api/v1/ingest do?

Widget Event Ingest APIPublic endpoint for receiving events from embedded widgetHandles batched events with JWT authentication

## 360. Which HTTP methods are implemented for /api/v1/ingest?

POST

## 361. Where is the source file for /api/v1/ingest?

app/api/v1/ingest/route.ts

## 362. What does GET /api/evaluation/judge do?

API Route: LLM-Judge EvaluationPOST /api/evaluation/judgeEvaluates AI messages using GPT-4 or Claude as judgesCompetes with LangSmith's evaluation capabilities

## 363. What does POST /api/evaluation/judge do?

API Route: LLM-Judge EvaluationPOST /api/evaluation/judgeEvaluates AI messages using GPT-4 or Claude as judgesCompetes with LangSmith's evaluation capabilities

## 364. Which HTTP methods are implemented for /api/evaluation/judge?

GET, POST

## 365. Where is the source file for /api/evaluation/judge?

app/api/evaluation/judge/route.ts

## 366. What does POST /api/training/execute do?

Training Execution APIPOST /api/training/executePurpose: Trigger training execution via different providersSupports: Colab, HuggingFace, OpenAI, LocalDate: 2025-10-24Updated: 2025-01-07 - Integrated with local training server at port 8000

## 367. Which HTTP methods are implemented for /api/training/execute?

POST

## 368. Where is the source file for /api/training/execute?

app/api/training/execute/route.ts

## 369. What does POST /api/training/refresh-token do?

Token Refresh API for Long Training JobsPOST /api/training/refresh-tokenPurpose: Refresh expired access tokens for training serverCalled by: Python training server (localhost:8000) every 45 minutesAuth: Requires valid user session (even if token expired)Date: 2025-11-05

## 370. Which HTTP methods are implemented for /api/training/refresh-token?

POST

## 371. Where is the source file for /api/training/refresh-token?

app/api/training/refresh-token/route.ts

## 372. What does POST /api/training/inspect-cookies do?

Cookie Inspection Endpoint - TEMPORARY FOR RESEARCHPOST /api/training/inspect-cookiesPurpose: Understand what cookies are available in Next.js API routesThis is a research endpoint to verify cookie access before implementingthe actual refresh token logic.

## 373. Which HTTP methods are implemented for /api/training/inspect-cookies?

POST

## 374. Where is the source file for /api/training/inspect-cookies?

app/api/training/inspect-cookies/route.ts

## 375. What does GET /api/training/jobs do?

List training jobs    description: |      Retrieve all training jobs for the authenticated user.      Returns recent training jobs with their current status, including jobs      running locally, on RunPod, Lambda Labs, or other platforms.      The system automatically reconciles job statuses with the backend to      detect stale or orphaned jobs.Use Cases:      - Monitor all training jobs in one place      - Check job status and progress      - Review training history      - Filter and search past jobs    tags:      - Training    security:      - bearerAuth: []    responses:      200:        description: Jobs retrieved successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true                count:                  type: integer                  example: 15                jobs:                  type: array                  items:                    type: object                    properties:                      id:                        type: string                        example: "job_abc123"                      model_name:                        type: string                        example: "meta-llama/Llama-2-7b-hf"                      status:                        type: string                        enum: [pending, queued, running, completed, failed, cancelled]                        example: "running"                      started_at:                        type: string                        format: date-time                      completed_at:                        type: string                        format: date-time                        nullable: true                      created_at:                        type: string                        format: date-time      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 376. What responses does GET /api/training/jobs return?

responses:      200:

## 377. Does GET /api/training/jobs require authentication?

security:      - bearerAuth: []

## 378. Can you describe GET /api/training/jobs?

description: |      Retrieve all training jobs for the authenticated user.      Returns recent training jobs with their current status, including jobs      running locally, on RunPod, Lambda Labs, or other platforms.      The system automatically reconciles job statuses with the backend to      detect stale or orphaned jobs.Use Cases:      - Monitor all training jobs in one place      - Check job status and progress      - Review training history      - Filter and search past jobs

## 379. What tags classify GET /api/training/jobs?

tags:      - Training

## 380. Which HTTP methods are implemented for /api/training/jobs?

GET

## 381. Where is the source file for /api/training/jobs?

app/api/training/jobs/route.ts

## 382. What does DELETE /api/training/baselines do?

Baseline Management APIEndpoints for managing model baselines and viewing validation historyPhase: Phase 4 - Regression GatesDate: 2025-10-28

## 383. What does GET /api/training/baselines do?

Baseline Management APIEndpoints for managing model baselines and viewing validation historyPhase: Phase 4 - Regression GatesDate: 2025-10-28

## 384. What does POST /api/training/baselines do?

Baseline Management APIEndpoints for managing model baselines and viewing validation historyPhase: Phase 4 - Regression GatesDate: 2025-10-28

## 385. What does PUT /api/training/baselines do?

Baseline Management APIEndpoints for managing model baselines and viewing validation historyPhase: Phase 4 - Regression GatesDate: 2025-10-28

## 386. Which HTTP methods are implemented for /api/training/baselines?

DELETE, GET, POST, PUT

## 387. Where is the source file for /api/training/baselines?

app/api/training/baselines/route.ts

## 388. What does DELETE /api/training/[id] do?

Get training configuration    description: Retrieve a specific training configuration by ID    tags:      - Training    security:      - bearerAuth: []    parameters:      - in: path        name: id        required: true        schema:          type: string        description: Training configuration ID        example: "cfg_abc123"    responses:      200:        description: Configuration retrieved successfully        content:          application/json:            schema:              type: object              properties:                config:                  type: object      404:        description: Configuration not found        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  put:    summary: Update training configuration    description: Update an existing training configuration's settings    tags:      - Training    security:      - bearerAuth: []    parameters:      - in: path        name: id        required: true        schema:          type: string        example: "cfg_abc123"    requestBody:      required: true      content:        application/json:          schema:            type: object            properties:              name:                type: string              description:                type: string              config_json:                type: object    responses:      200:        description: Configuration updated successfully        content:          application/json:            schema:              type: object              properties:                config:                  type: object      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  delete:    summary: Delete training configuration    description: Delete a training configuration    tags:      - Training    security:      - bearerAuth: []    parameters:      - in: path        name: id        required: true        schema:          type: string        example: "cfg_abc123"    responses:      200:        description: Configuration deleted successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 389. What is the request body for DELETE /api/training/[id]?

requestBody:      required: true      content:        application/json:          schema:            type: object            properties:              name:                type: string

## 390. Which parameters does DELETE /api/training/[id] accept?

parameters:      - in: path        name: id        required: true        schema:          type: string

## 391. What responses does DELETE /api/training/[id] return?

responses:      200:

## 392. Does DELETE /api/training/[id] require authentication?

security:      - bearerAuth: []

## 393. Can you describe DELETE /api/training/[id]?

description: Retrieve a specific training configuration by ID

## 394. What tags classify DELETE /api/training/[id]?

tags:      - Training

## 395. What does GET /api/training/[id] do?

Get training configuration    description: Retrieve a specific training configuration by ID    tags:      - Training    security:      - bearerAuth: []    parameters:      - in: path        name: id        required: true        schema:          type: string        description: Training configuration ID        example: "cfg_abc123"    responses:      200:        description: Configuration retrieved successfully        content:          application/json:            schema:              type: object              properties:                config:                  type: object      404:        description: Configuration not found        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  put:    summary: Update training configuration    description: Update an existing training configuration's settings    tags:      - Training    security:      - bearerAuth: []    parameters:      - in: path        name: id        required: true        schema:          type: string        example: "cfg_abc123"    requestBody:      required: true      content:        application/json:          schema:            type: object            properties:              name:                type: string              description:                type: string              config_json:                type: object    responses:      200:        description: Configuration updated successfully        content:          application/json:            schema:              type: object              properties:                config:                  type: object      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  delete:    summary: Delete training configuration    description: Delete a training configuration    tags:      - Training    security:      - bearerAuth: []    parameters:      - in: path        name: id        required: true        schema:          type: string        example: "cfg_abc123"    responses:      200:        description: Configuration deleted successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 396. What is the request body for GET /api/training/[id]?

requestBody:      required: true      content:        application/json:          schema:            type: object            properties:              name:                type: string

## 397. Which parameters does GET /api/training/[id] accept?

parameters:      - in: path        name: id        required: true        schema:          type: string

## 398. What responses does GET /api/training/[id] return?

responses:      200:

## 399. Does GET /api/training/[id] require authentication?

security:      - bearerAuth: []

## 400. Can you describe GET /api/training/[id]?

description: Retrieve a specific training configuration by ID

## 401. What tags classify GET /api/training/[id]?

tags:      - Training

## 402. What does PUT /api/training/[id] do?

Get training configuration    description: Retrieve a specific training configuration by ID    tags:      - Training    security:      - bearerAuth: []    parameters:      - in: path        name: id        required: true        schema:          type: string        description: Training configuration ID        example: "cfg_abc123"    responses:      200:        description: Configuration retrieved successfully        content:          application/json:            schema:              type: object              properties:                config:                  type: object      404:        description: Configuration not found        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  put:    summary: Update training configuration    description: Update an existing training configuration's settings    tags:      - Training    security:      - bearerAuth: []    parameters:      - in: path        name: id        required: true        schema:          type: string        example: "cfg_abc123"    requestBody:      required: true      content:        application/json:          schema:            type: object            properties:              name:                type: string              description:                type: string              config_json:                type: object    responses:      200:        description: Configuration updated successfully        content:          application/json:            schema:              type: object              properties:                config:                  type: object      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  delete:    summary: Delete training configuration    description: Delete a training configuration    tags:      - Training    security:      - bearerAuth: []    parameters:      - in: path        name: id        required: true        schema:          type: string        example: "cfg_abc123"    responses:      200:        description: Configuration deleted successfully        content:          application/json:            schema:              type: object              properties:                success:                  type: boolean                  example: true      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 403. What is the request body for PUT /api/training/[id]?

requestBody:      required: true      content:        application/json:          schema:            type: object            properties:              name:                type: string

## 404. Which parameters does PUT /api/training/[id] accept?

parameters:      - in: path        name: id        required: true        schema:          type: string

## 405. What responses does PUT /api/training/[id] return?

responses:      200:

## 406. Does PUT /api/training/[id] require authentication?

security:      - bearerAuth: []

## 407. Can you describe PUT /api/training/[id]?

description: Retrieve a specific training configuration by ID

## 408. What tags classify PUT /api/training/[id]?

tags:      - Training

## 409. Which HTTP methods are implemented for /api/training/[id]?

DELETE, GET, PUT

## 410. Where is the source file for /api/training/[id]?

app/api/training/[id]/route.ts

## 411. What does GET /api/training/local do?

Local Training Connection API RouteHandles testing and validating connection to local training serverPhase 2.3: Local Training ConnectionDate: 2025-10-26

## 412. What does POST /api/training/local do?

Local Training Connection API RouteHandles testing and validating connection to local training serverPhase 2.3: Local Training ConnectionDate: 2025-10-26

## 413. Which HTTP methods are implemented for /api/training/local?

GET, POST

## 414. Where is the source file for /api/training/local?

app/api/training/local/route.ts

## 415. What does GET /api/training/dataset do?

Upload training dataset    description: |      Upload and validate a training dataset for fine-tuning.      Datasets are automatically validated and normalized to a standard format.      Supported formats include ChatML, ShareGPT, JSONL, DPO, and RLHF.      The system will:      - Detect the dataset format automatically      - Normalize to standard JSONL format      - Compress with gzip for efficient storage      - Validate data quality (input/output lengths, structure)Use Cases:      - Upload training data for fine-tuning jobs      - Validate dataset format before training      - Reuse datasets across multiple training runsSupported Formats:      - `chatml` - ChatML conversation format      - `sharegpt` - ShareGPT conversation format      - `jsonl` - JSON Lines format      - `dpo` - Direct Preference Optimization pairs      - `rlhf` - RLHF preference data    tags:      - Training    security:      - bearerAuth: []    requestBody:      required: true      content:        multipart/form-data:          schema:            type: object            required:              - file              - name              - format            properties:              file:                type: string                format: binary                description: Training dataset file              name:                type: string                description: Dataset name                example: "Customer Support Conversations"              description:                type: string                description: Optional dataset description                example: "10K customer support interactions from Q4 2024"              format:                type: string                enum: [chatml, sharegpt, jsonl, dpo, rlhf]                description: Dataset format                example: "chatml"              config_id:                type: string                description: Optional training config to associate with                example: "cfg_abc123"    responses:      200:        description: Dataset uploaded successfully        content:          application/json:            schema:              type: object              properties:                dataset:                  type: object                  properties:                    id:                      type: string                      example: "ds_xyz789"                    name:                      type: string                    format:                      type: string                    total_examples:                      type: integer                      example: 1000                    avg_input_length:                      type: number                      example: 245.5                    avg_output_length:                      type: number                      example: 128.3                    file_size_bytes:                      type: integer                    metadata:                      type: object                      properties:                        original_format:                          type: string                        normalized:                          type: boolean                        compressed:                          type: boolean      400:        description: Invalid dataset or missing fields        content:          application/json:            schema:              type: object              properties:                error:                  type: string                details:                  type: array                  items:                    type: string      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  get:    summary: List training datasets    description: |      Retrieve all uploaded datasets for the authenticated user.Use Cases:      - List available datasets for training      - Select dataset for a training job      - Review dataset statistics    tags:      - Training    security:      - bearerAuth: []    responses:      200:        description: Datasets retrieved successfully        content:          application/json:            schema:              type: object              properties:                datasets:                  type: array                  items:                    type: object                    properties:                      id:                        type: string                      name:                        type: string                      format:                        type: string                      total_examples:                        type: integer                      file_size_bytes:                        type: integer                      created_at:                        type: string                        format: date-time      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 416. What is the request body for GET /api/training/dataset?

requestBody:      required: true      content:        multipart/form-data:          schema:            type: object            required:              - file              - name              - format            properties:              file:                type: string                format: binary

## 417. What responses does GET /api/training/dataset return?

responses:      200:

## 418. Does GET /api/training/dataset require authentication?

security:      - bearerAuth: []

## 419. Can you describe GET /api/training/dataset?

description: |      Upload and validate a training dataset for fine-tuning.      Datasets are automatically validated and normalized to a standard format.      Supported formats include ChatML, ShareGPT, JSONL, DPO, and RLHF.      The system will:      - Detect the dataset format automatically      - Normalize to standard JSONL format      - Compress with gzip for efficient storage      - Validate data quality (input/output lengths, structure)Use Cases:      - Upload training data for fine-tuning jobs      - Validate dataset format before training      - Reuse datasets across multiple training runsSupported Formats:      - `chatml` - ChatML conversation format      - `sharegpt` - ShareGPT conversation format      - `jsonl` - JSON Lines format      - `dpo` - Direct Preference Optimization pairs      - `rlhf` - RLHF preference data

## 420. What tags classify GET /api/training/dataset?

tags:      - Training

## 421. What does POST /api/training/dataset do?

Upload training dataset    description: |      Upload and validate a training dataset for fine-tuning.      Datasets are automatically validated and normalized to a standard format.      Supported formats include ChatML, ShareGPT, JSONL, DPO, and RLHF.      The system will:      - Detect the dataset format automatically      - Normalize to standard JSONL format      - Compress with gzip for efficient storage      - Validate data quality (input/output lengths, structure)Use Cases:      - Upload training data for fine-tuning jobs      - Validate dataset format before training      - Reuse datasets across multiple training runsSupported Formats:      - `chatml` - ChatML conversation format      - `sharegpt` - ShareGPT conversation format      - `jsonl` - JSON Lines format      - `dpo` - Direct Preference Optimization pairs      - `rlhf` - RLHF preference data    tags:      - Training    security:      - bearerAuth: []    requestBody:      required: true      content:        multipart/form-data:          schema:            type: object            required:              - file              - name              - format            properties:              file:                type: string                format: binary                description: Training dataset file              name:                type: string                description: Dataset name                example: "Customer Support Conversations"              description:                type: string                description: Optional dataset description                example: "10K customer support interactions from Q4 2024"              format:                type: string                enum: [chatml, sharegpt, jsonl, dpo, rlhf]                description: Dataset format                example: "chatml"              config_id:                type: string                description: Optional training config to associate with                example: "cfg_abc123"    responses:      200:        description: Dataset uploaded successfully        content:          application/json:            schema:              type: object              properties:                dataset:                  type: object                  properties:                    id:                      type: string                      example: "ds_xyz789"                    name:                      type: string                    format:                      type: string                    total_examples:                      type: integer                      example: 1000                    avg_input_length:                      type: number                      example: 245.5                    avg_output_length:                      type: number                      example: 128.3                    file_size_bytes:                      type: integer                    metadata:                      type: object                      properties:                        original_format:                          type: string                        normalized:                          type: boolean                        compressed:                          type: boolean      400:        description: Invalid dataset or missing fields        content:          application/json:            schema:              type: object              properties:                error:                  type: string                details:                  type: array                  items:                    type: string      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  get:    summary: List training datasets    description: |      Retrieve all uploaded datasets for the authenticated user.Use Cases:      - List available datasets for training      - Select dataset for a training job      - Review dataset statistics    tags:      - Training    security:      - bearerAuth: []    responses:      200:        description: Datasets retrieved successfully        content:          application/json:            schema:              type: object              properties:                datasets:                  type: array                  items:                    type: object                    properties:                      id:                        type: string                      name:                        type: string                      format:                        type: string                      total_examples:                        type: integer                      file_size_bytes:                        type: integer                      created_at:                        type: string                        format: date-time      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 422. What is the request body for POST /api/training/dataset?

requestBody:      required: true      content:        multipart/form-data:          schema:            type: object            required:              - file              - name              - format            properties:              file:                type: string                format: binary

## 423. What responses does POST /api/training/dataset return?

responses:      200:

## 424. Does POST /api/training/dataset require authentication?

security:      - bearerAuth: []

## 425. Can you describe POST /api/training/dataset?

description: |      Upload and validate a training dataset for fine-tuning.      Datasets are automatically validated and normalized to a standard format.      Supported formats include ChatML, ShareGPT, JSONL, DPO, and RLHF.      The system will:      - Detect the dataset format automatically      - Normalize to standard JSONL format      - Compress with gzip for efficient storage      - Validate data quality (input/output lengths, structure)Use Cases:      - Upload training data for fine-tuning jobs      - Validate dataset format before training      - Reuse datasets across multiple training runsSupported Formats:      - `chatml` - ChatML conversation format      - `sharegpt` - ShareGPT conversation format      - `jsonl` - JSON Lines format      - `dpo` - Direct Preference Optimization pairs      - `rlhf` - RLHF preference data

## 426. What tags classify POST /api/training/dataset?

tags:      - Training

## 427. Which HTTP methods are implemented for /api/training/dataset?

GET, POST

## 428. Where is the source file for /api/training/dataset?

app/api/training/dataset/route.ts

## 429. What does GET /api/training/validations do?

Validation History APIEndpoints for viewing validation history and resultsPhase: Phase 4 - Regression GatesDate: 2025-10-28

## 430. Which HTTP methods are implemented for /api/training/validations?

GET

## 431. Where is the source file for /api/training/validations?

app/api/training/validations/route.ts

## 432. What does DELETE /api/training/deploy do?

Training Deployment APIDeploy trained models to local inference servers (vLLM, Ollama)POST /api/training/deploy- Spawns vLLM/Ollama server with trained model- Adds model to llm_models table- Returns deployment status and model IDPhase: Tier 2 - Training IntegrationDate: 2025-10-2

## 433. What does GET /api/training/deploy do?

Training Deployment APIDeploy trained models to local inference servers (vLLM, Ollama)POST /api/training/deploy- Spawns vLLM/Ollama server with trained model- Adds model to llm_models table- Returns deployment status and model IDPhase: Tier 2 - Training IntegrationDate: 2025-10-2

## 434. What does POST /api/training/deploy do?

Training Deployment APIDeploy trained models to local inference servers (vLLM, Ollama)POST /api/training/deploy- Spawns vLLM/Ollama server with trained model- Adds model to llm_models table- Returns deployment status and model IDPhase: Tier 2 - Training IntegrationDate: 2025-10-2

## 435. Which HTTP methods are implemented for /api/training/deploy?

DELETE, GET, POST

## 436. Where is the source file for /api/training/deploy?

app/api/training/deploy/route.ts

## 437. What does GET /api/training/execute/[id]/status do?

Training Execution Status APIGET /api/training/execute/{id}/statusPurpose: Check status of training execution and sync with providerSupports: Colab, OpenAI, HuggingFace, LocalDate: 2025-10-24

## 438. Which HTTP methods are implemented for /api/training/execute/[id]/status?

GET

## 439. Where is the source file for /api/training/execute/[id]/status?

app/api/training/execute/[id]/status/route.ts

## 440. What does GET /api/training/config/available do?

Training Config Available APIGET /api/training/config/availableReturns simplified list of user's training configs for dropdown selection

## 441. Which HTTP methods are implemented for /api/training/config/available?

GET

## 442. Where is the source file for /api/training/config/available?

app/api/training/config/available/route.ts

## 443. What does GET /api/training/public/[id] do?

Next.js API route implemented in app/api/training/public/[id]/route.ts

## 444. Which HTTP methods are implemented for /api/training/public/[id]?

GET

## 445. Where is the source file for /api/training/public/[id]?

app/api/training/public/[id]/route.ts

## 446. What does GET /api/training/public/[id]/dataset do?

Next.js API route implemented in app/api/training/public/[id]/dataset/route.ts

## 447. Which HTTP methods are implemented for /api/training/public/[id]/dataset?

GET

## 448. Where is the source file for /api/training/public/[id]/dataset?

app/api/training/public/[id]/dataset/route.ts

## 449. What does GET /api/training/vllm/check do?

vLLM Availability APIGET /api/training/vllm/check - Check if vLLM is available

## 450. Which HTTP methods are implemented for /api/training/vllm/check?

GET

## 451. Where is the source file for /api/training/vllm/check?

app/api/training/vllm/check/route.ts

## 452. What does POST /api/training/dag/validate do?

DAG Validation EndpointPOST /api/training/dag/validate - Validate a DAG configuration

## 453. Which HTTP methods are implemented for /api/training/dag/validate?

POST

## 454. Where is the source file for /api/training/dag/validate?

app/api/training/dag/validate/route.ts

## 455. What does GET /api/training/dag/execute do?

GET /api/training/dag/executeGet list of recent executions (redirects to /api/training/dag/list)

## 456. What does POST /api/training/dag/execute do?

GET /api/training/dag/executeGet list of recent executions (redirects to /api/training/dag/list)

## 457. Which HTTP methods are implemented for /api/training/dag/execute?

GET, POST

## 458. Where is the source file for /api/training/dag/execute?

app/api/training/dag/execute/route.ts

## 459. What does POST /api/training/dag/resume do?

DAG Resume EndpointPOST /api/training/dag/resume - Resume a paused execution or from checkpoint

## 460. Which HTTP methods are implemented for /api/training/dag/resume?

POST

## 461. Where is the source file for /api/training/dag/resume?

app/api/training/dag/resume/route.ts

## 462. What does POST /api/training/dag/pause do?

DAG Pause EndpointPOST /api/training/dag/pause - Pause a running execution

## 463. Which HTTP methods are implemented for /api/training/dag/pause?

POST

## 464. Where is the source file for /api/training/dag/pause?

app/api/training/dag/pause/route.ts

## 465. What does GET /api/training/dag/checkpoint do?

DAG Checkpoint EndpointPOST /api/training/dag/checkpoint - Create a checkpoint for an execution

## 466. What does POST /api/training/dag/checkpoint do?

DAG Checkpoint EndpointPOST /api/training/dag/checkpoint - Create a checkpoint for an execution

## 467. Which HTTP methods are implemented for /api/training/dag/checkpoint?

GET, POST

## 468. Where is the source file for /api/training/dag/checkpoint?

app/api/training/dag/checkpoint/route.ts

## 469. What does GET /api/training/dag/list do?

DAG List EndpointGET /api/training/dag/list - List recent DAG executions from database

## 470. Which HTTP methods are implemented for /api/training/dag/list?

GET

## 471. Where is the source file for /api/training/dag/list?

app/api/training/dag/list/route.ts

## 472. What does GET /api/training/dag/backfill do?

POST /api/training/dag/backfillExecute a DAG pipeline across a date rangeRequest body:{  templateName: string;        // Name for the backfill execution  templateId: string;          // Template identifier  jobs: JobConfig[];           // Jobs with date placeholders ({{DATE}}, {{

## 473. What does POST /api/training/dag/backfill do?

POST /api/training/dag/backfillExecute a DAG pipeline across a date rangeRequest body:{  templateName: string;        // Name for the backfill execution  templateId: string;          // Template identifier  jobs: JobConfig[];           // Jobs with date placeholders ({{DATE}}, {{

## 474. Which HTTP methods are implemented for /api/training/dag/backfill?

GET, POST

## 475. Where is the source file for /api/training/dag/backfill?

app/api/training/dag/backfill/route.ts

## 476. What does GET /api/training/dag/templates do?

DAG Pipeline Templates EndpointGET /api/training/dag/templates - Get all pipeline templatesPOST /api/training/dag/templates - Create a new pipeline template

## 477. What does POST /api/training/dag/templates do?

DAG Pipeline Templates EndpointGET /api/training/dag/templates - Get all pipeline templatesPOST /api/training/dag/templates - Create a new pipeline template

## 478. Which HTTP methods are implemented for /api/training/dag/templates?

GET, POST

## 479. Where is the source file for /api/training/dag/templates?

app/api/training/dag/templates/route.ts

## 480. What does POST /api/training/dag/cancel/[id] do?

DAG Execution Cancel EndpointPOST /api/training/dag/cancel/[id] - Cancel a running execution

## 481. Which HTTP methods are implemented for /api/training/dag/cancel/[id]?

POST

## 482. Where is the source file for /api/training/dag/cancel/[id]?

app/api/training/dag/cancel/[id]/route.ts

## 483. What does GET /api/training/dag/status/[id] do?

DAG Execution Status EndpointGET /api/training/dag/status/[id] - Get execution status

## 484. Which HTTP methods are implemented for /api/training/dag/status/[id]?

GET

## 485. Where is the source file for /api/training/dag/status/[id]?

app/api/training/dag/status/[id]/route.ts

## 486. What does GET /api/training/dag/logs/[id] do?

DAG Logs Endpoint (Server-Sent Events)GET /api/training/dag/logs/[id] - Stream real-time logs for a DAG execution

## 487. Which HTTP methods are implemented for /api/training/dag/logs/[id]?

GET

## 488. Where is the source file for /api/training/dag/logs/[id]?

app/api/training/dag/logs/[id]/route.ts

## 489. What does GET /api/training/dag/metrics/[id] do?

DAG Metrics EndpointGET /api/training/dag/metrics/[id] - Get real-time metrics for a DAG execution

## 490. Which HTTP methods are implemented for /api/training/dag/metrics/[id]?

GET

## 491. Where is the source file for /api/training/dag/metrics/[id]?

app/api/training/dag/metrics/[id]/route.ts

## 492. What does DELETE /api/training/dag/templates/[id] do?

DAG Pipeline Template by ID EndpointGET /api/training/dag/templates/[id] - Get a specific templateDELETE /api/training/dag/templates/[id] - Delete a template

## 493. What does GET /api/training/dag/templates/[id] do?

DAG Pipeline Template by ID EndpointGET /api/training/dag/templates/[id] - Get a specific templateDELETE /api/training/dag/templates/[id] - Delete a template

## 494. Which HTTP methods are implemented for /api/training/dag/templates/[id]?

DELETE, GET

## 495. Where is the source file for /api/training/dag/templates/[id]?

app/api/training/dag/templates/[id]/route.ts

## 496. What does GET /api/training/dag/checkpoints/list do?

DAG Checkpoints List EndpointGET /api/training/dag/checkpoints/list - List checkpoints with optional filtering

## 497. Which HTTP methods are implemented for /api/training/dag/checkpoints/list?

GET

## 498. Where is the source file for /api/training/dag/checkpoints/list?

app/api/training/dag/checkpoints/list/route.ts

## 499. What does POST /api/training/jobs/[jobId]/metrics do?

Training Job Metrics APIPOST /api/training/jobs/[jobId]/metricsPurpose: Receive metrics updates from training scripts (local or cloud)Auth: Job-specific token (no user auth required)Date: 2025-11-14

## 500. Which HTTP methods are implemented for /api/training/jobs/[jobId]/metrics?

POST

## 501. Where is the source file for /api/training/jobs/[jobId]/metrics?

app/api/training/jobs/[jobId]/metrics/route.ts

## 502. What does POST /api/training/[id]/download-package do?

Next.js API route implemented in app/api/training/[id]/download-package/route.ts

## 503. Which HTTP methods are implemented for /api/training/[id]/download-package?

POST

## 504. Where is the source file for /api/training/[id]/download-package?

app/api/training/[id]/download-package/route.ts

## 505. What does GET /api/training/[id]/datasets do?

Next.js API route implemented in app/api/training/[id]/datasets/route.ts

## 506. Which HTTP methods are implemented for /api/training/[id]/datasets?

GET

## 507. Where is the source file for /api/training/[id]/datasets?

app/api/training/[id]/datasets/route.ts

## 508. What does DELETE /api/training/[id]/attach-dataset do?

Next.js API route implemented in app/api/training/[id]/attach-dataset/route.ts

## 509. What does POST /api/training/[id]/attach-dataset do?

Next.js API route implemented in app/api/training/[id]/attach-dataset/route.ts

## 510. Which HTTP methods are implemented for /api/training/[id]/attach-dataset?

DELETE, POST

## 511. Where is the source file for /api/training/[id]/attach-dataset?

app/api/training/[id]/attach-dataset/route.ts

## 512. What does DELETE /api/training/[id]/generate-package do?

Get compatible training methods for a config's datasets

## 513. What does POST /api/training/[id]/generate-package do?

Get compatible training methods for a config's datasets

## 514. Which HTTP methods are implemented for /api/training/[id]/generate-package?

DELETE, POST

## 515. Where is the source file for /api/training/[id]/generate-package?

app/api/training/[id]/generate-package/route.ts

## 516. What does GET /api/training/workflow/step1-config do?

API Route: GET /api/training/workflow/step1-configReturns Step1ModelSelection configurationServer-side only - loads YAML config and returns as JSON

## 517. Which HTTP methods are implemented for /api/training/workflow/step1-config?

GET

## 518. Where is the source file for /api/training/workflow/step1-config?

app/api/training/workflow/step1-config/route.ts

## 519. What does POST /api/training/local/jobs do?

Local Training Jobs Persistence APIPOST /api/training/local/jobsPurpose: Create or update local training job records for analyticsCalled by: Python training server (localhost:8000)Phase: Metrics PersistenceDate: 2025-10-27Auth: Requires user authentication via Bearer token

## 520. Which HTTP methods are implemented for /api/training/local/jobs?

POST

## 521. Where is the source file for /api/training/local/jobs?

app/api/training/local/jobs/route.ts

## 522. What does POST /api/training/local/metrics do?

Local Training Metrics Persistence APIPOST /api/training/local/metricsPurpose: Batch insert training metrics for analyticsCalled by: Python training server (localhost:8000)Phase: Metrics PersistenceDate: 2025-10-27Auth: Requires user authentication via Bearer token

## 523. Which HTTP methods are implemented for /api/training/local/metrics?

POST

## 524. Where is the source file for /api/training/local/metrics?

app/api/training/local/metrics/route.ts

## 525. What does POST /api/training/local/[jobId]/control do?

Next.js API route implemented in app/api/training/local/[jobId]/control/route.ts

## 526. Which HTTP methods are implemented for /api/training/local/[jobId]/control?

POST

## 527. Where is the source file for /api/training/local/[jobId]/control?

app/api/training/local/[jobId]/control/route.ts

## 528. What does POST /api/training/local/[jobId]/resume do?

POST handler - Resume training from checkpointAccepts: { checkpoint_path?, resume_from_best?, config_adjustments? }Returns: { success, job_id, resumed_from, checkpoint_path }Phase 4: Intelligent Resume - Added config_adjustments parameterto allow merging config changes when resum

## 529. Which HTTP methods are implemented for /api/training/local/[jobId]/resume?

POST

## 530. Where is the source file for /api/training/local/[jobId]/resume?

app/api/training/local/[jobId]/resume/route.ts

## 531. What does GET /api/training/local/[jobId]/status do?

Get real-time training job status    description: |      Monitor a training job in real-time with comprehensive status and performance metrics.      This endpoint provides everything you need to build a live training dashboard:      -Progress tracking- Current step, epoch, and percentage complete      -Loss metrics- Training and validation loss with trend analysis      -Performance metrics- Throughput, GPU usage, and estimated time remaining      -Quality indicators- Perplexity calculations and improvement tracking      -Health monitoring- Stale job detection and error reportingUse Cases:      - Build real-time training dashboards      - Monitor long-running fine-tuning jobs      - Track training progress programmatically      - Detect training failures early      - Display live metrics in your applicationMetrics Included:      - Progress: steps, epochs, percentage, time estimates      - Loss: train_loss, eval_loss, best_eval_loss, trend analysis      - GPU: memory usage (allocated/reserved), utilization %      - Throughput: samples/second, tokens/second      - Quality: perplexity, epochs without improvement    tags:      - Metrics    security:      - bearerAuth: []    parameters:      - in: path        name: jobId        required: true        schema:          type: string        description: Training job ID        example: "job_abc123"    responses:      200:        description: Training status retrieved successfully        content:          application/json:            schema:              type: object              properties:                job_id:                  type: string                  example: "job_abc123"                status:                  type: string                  enum: [pending, running, completed, failed, cancelled]                  example: "running"                model_name:                  type: string                  example: "meta-llama/Llama-2-7b-hf"                model_display_name:                  type: string                  example: "Llama 2 7B"                job_name:                  type: string                  example: "Customer Support Fine-tune"                dataset_name:                  type: string                  example: "support-conversations-v2"                current_step:                  type: integer                  example: 450                current_epoch:                  type: integer                  example: 2                total_steps:                  type: integer                  example: 1000                total_epochs:                  type: integer                  example: 3                progress:                  type: integer                  description: Percentage complete (0-100)                  example: 45                loss:                  type: number                  description: Current training loss                  example: 0.234                eval_loss:                  type: number                  description: Current validation loss                  example: 0.198                best_eval_loss:                  type: number                  description: Best validation loss achieved                  example: 0.187                loss_trend:                  type: string                  enum: [improving, stable, degrading]                  example: "improving"                train_perplexity:                  type: number                  example: 1.26                eval_perplexity:                  type: number                  example: 1.22                learning_rate:                  type: number                  example: 0.00002                gpu_memory_allocated_gb:                  type: number                  example: 22.4                gpu_memory_reserved_gb:                  type: number                  example: 24.0                gpu_utilization_percent:                  type: number                  example: 98.5                samples_per_second:                  type: number                  example: 12.3                tokens_per_second:                  type: number                  example: 2450.0                elapsed_seconds:                  type: integer                  example: 3600                remaining_seconds:                  type: integer                  example: 4400                epochs_without_improvement:                  type: integer                  description: Epochs since last validation improvement                  example: 0                warning:                  type: string                  description: Warning message for stale jobs                  example: "⚠️ No updates received in 12 minute(s). The training process may have terminated unexpectedly."                error:                  type: string                  description: Error message if status is failed                  example: "CUDA out of memory"      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      404:        description: Training job not found        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 532. Which parameters does GET /api/training/local/[jobId]/status accept?

parameters:      - in: path        name: jobId        required: true        schema:          type: string

## 533. What responses does GET /api/training/local/[jobId]/status return?

responses:      200:

## 534. Does GET /api/training/local/[jobId]/status require authentication?

security:      - bearerAuth: []

## 535. Can you describe GET /api/training/local/[jobId]/status?

description: |      Monitor a training job in real-time with comprehensive status and performance metrics.      This endpoint provides everything you need to build a live training dashboard:      -Progress tracking- Current step, epoch, and percentage complete      -Loss metrics- Training and validation loss with trend analysis      -Performance metrics- Throughput, GPU usage, and estimated time remaining      -Quality indicators- Perplexity calculations and improvement tracking      -Health monitoring- Stale job detection and error reportingUse Cases:      - Build real-time training dashboards      - Monitor long-running fine-tuning jobs      - Track training progress programmatically      - Detect training failures early      - Display live metrics in your applicationMetrics Included:      - Progress: steps, epochs, percentage, time estimates      - Loss: train_loss, eval_loss, best_eval_loss, trend analysis      - GPU: memory usage (allocated/reserved), utilization %      - Throughput: samples/second, tokens/second      - Quality: perplexity, epochs without improvement

## 536. What tags classify GET /api/training/local/[jobId]/status?

tags:      - Metrics

## 537. Which HTTP methods are implemented for /api/training/local/[jobId]/status?

GET

## 538. Where is the source file for /api/training/local/[jobId]/status?

app/api/training/local/[jobId]/status/route.ts

## 539. What does GET /api/training/local/[jobId]/logs do?

Get training logs    description: |      Stream training logs in real-time with pagination support.      Access the raw console output from your training job, including:      - Model initialization logs      - Training progress messages      - Warning and error messages      - Debug output      - Checkpoint save notificationsUse Cases:      - Debug training failures      - Monitor training progress in detail      - Tail logs in real-time      - Export logs for troubleshooting      - Build log viewers in your applicationPagination:      - Use `limit` and `offset` to paginate through large log files      - Default limit: 100 lines      - Logs are returned in chronological order    tags:      - Metrics    security:      - bearerAuth: []    parameters:      - in: path        name: jobId        required: true        schema:          type: string        description: Training job ID        example: "job_abc123"      - in: query        name: limit        schema:          type: integer          default: 100        description: Maximum number of log lines to return        example: 50      - in: query        name: offset        schema:          type: integer          default: 0        description: Line offset to start from (for pagination)        example: 0    responses:      200:        description: Logs retrieved successfully        content:          application/json:            schema:              type: object              properties:                logs:                  type: array                  description: Array of log lines                  items:                    type: string                  example:                    - "[2024-11-15 10:23:45] Loading model meta-llama/Llama-2-7b-hf..."                    - "[2024-11-15 10:24:12] Model loaded successfully"                    - "[2024-11-15 10:24:15] Starting training..."                    - "[2024-11-15 10:24:30] Step 1/1000 | Loss: 2.456"                total_lines:                  type: integer                  description: Total number of log lines available                  example: 1523                offset:                  type: integer                  description: Current offset                  example: 0                limit:                  type: integer                  description: Current limit                  example: 100      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      503:        description: Training server unavailable        content:          application/json:            schema:              type: object              properties:                error:                  type: string                  example: "Failed to connect to local training server"                details:                  type: string

## 540. Which parameters does GET /api/training/local/[jobId]/logs accept?

parameters:      - in: path        name: jobId        required: true        schema:          type: string

## 541. What responses does GET /api/training/local/[jobId]/logs return?

responses:      200:

## 542. Does GET /api/training/local/[jobId]/logs require authentication?

security:      - bearerAuth: []

## 543. Can you describe GET /api/training/local/[jobId]/logs?

description: |      Stream training logs in real-time with pagination support.      Access the raw console output from your training job, including:      - Model initialization logs      - Training progress messages      - Warning and error messages      - Debug output      - Checkpoint save notificationsUse Cases:      - Debug training failures      - Monitor training progress in detail      - Tail logs in real-time      - Export logs for troubleshooting      - Build log viewers in your applicationPagination:      - Use `limit` and `offset` to paginate through large log files      - Default limit: 100 lines      - Logs are returned in chronological order

## 544. What tags classify GET /api/training/local/[jobId]/logs?

tags:      - Metrics

## 545. Which HTTP methods are implemented for /api/training/local/[jobId]/logs?

GET

## 546. Where is the source file for /api/training/local/[jobId]/logs?

app/api/training/local/[jobId]/logs/route.ts

## 547. What does GET /api/training/local/[jobId]/analyze-failure do?

Training Failure Analysis APIGET /api/training/local/[jobId]/analyze-failurePurpose: Analyze a failed training job and return intelligent config suggestionsPhase: Intelligent Resume Implementation - Phase 3Date: 2025-11-10

## 548. Which HTTP methods are implemented for /api/training/local/[jobId]/analyze-failure?

GET

## 549. Where is the source file for /api/training/local/[jobId]/analyze-failure?

app/api/training/local/[jobId]/analyze-failure/route.ts

## 550. What does GET /api/training/local/[jobId]/metrics do?

Get training metrics history    description: |      Retrieve the complete training metrics history for visualization and analysis.      This endpoint returns all metric points collected during training, perfect for:      -Loss curves- Plot training and validation loss over time      -Performance charts- Visualize GPU usage, throughput, and learning rate      -Trend analysis- Analyze perplexity, gradient norms, and other metrics      -Export data- Download full training history for external analysis      Each metric point includes:      - Step and epoch numbers      - Loss metrics (train_loss, eval_loss)      - GPU metrics (memory, utilization)      - Performance metrics (samples/sec, tokens/sec)      - Training parameters (learning_rate, grad_norm)      - Quality metrics (perplexity)Use Cases:      - Build interactive training charts      - Export metrics to TensorBoard, W&B, or MLflow      - Analyze training dynamics post-hoc      - Compare multiple training runs    tags:      - Metrics    security:      - bearerAuth: []    parameters:      - in: path        name: jobId        required: true        schema:          type: string        description: Training job ID        example: "job_abc123"    responses:      200:        description: Metrics history retrieved successfully        content:          application/json:            schema:              type: object              properties:                job_id:                  type: string                  example: "job_abc123"                metrics:                  type: array                  description: Array of metric points ordered by step                  items:                    type: object                    properties:                      step:                        type: integer                        example: 100                      epoch:                        type: integer                        example: 1                      train_loss:                        type: number                        example: 0.345                      eval_loss:                        type: number                        example: 0.298                      learning_rate:                        type: number                        example: 0.00002                      grad_norm:                        type: number                        example: 0.512                      gpu_memory_allocated_gb:                        type: number                        example: 22.1                      gpu_memory_reserved_gb:                        type: number                        example: 24.0                      gpu_utilization_percent:                        type: number                        example: 97.5                      samples_per_second:                        type: number                        example: 12.5                      tokens_per_second:                        type: number                        example: 2500.0                      train_perplexity:                        type: number                        example: 1.41                      perplexity:                        type: number                        example: 1.35                      timestamp:                        type: string                        format: date-time      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      500:        description: Server error        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 551. Which parameters does GET /api/training/local/[jobId]/metrics accept?

parameters:      - in: path        name: jobId        required: true        schema:          type: string

## 552. What responses does GET /api/training/local/[jobId]/metrics return?

responses:      200:

## 553. Does GET /api/training/local/[jobId]/metrics require authentication?

security:      - bearerAuth: []

## 554. Can you describe GET /api/training/local/[jobId]/metrics?

description: |      Retrieve the complete training metrics history for visualization and analysis.      This endpoint returns all metric points collected during training, perfect for:      -Loss curves- Plot training and validation loss over time      -Performance charts- Visualize GPU usage, throughput, and learning rate      -Trend analysis- Analyze perplexity, gradient norms, and other metrics      -Export data- Download full training history for external analysis      Each metric point includes:      - Step and epoch numbers      - Loss metrics (train_loss, eval_loss)      - GPU metrics (memory, utilization)      - Performance metrics (samples/sec, tokens/sec)      - Training parameters (learning_rate, grad_norm)      - Quality metrics (perplexity)Use Cases:      - Build interactive training charts      - Export metrics to TensorBoard, W&B, or MLflow      - Analyze training dynamics post-hoc      - Compare multiple training runs

## 555. What tags classify GET /api/training/local/[jobId]/metrics?

tags:      - Metrics

## 556. Which HTTP methods are implemented for /api/training/local/[jobId]/metrics?

GET

## 557. Where is the source file for /api/training/local/[jobId]/metrics?

app/api/training/local/[jobId]/metrics/route.ts

## 558. What does GET /api/training/local/[jobId]/update-params do?

Update Training Parameters APIPATCH /api/training/local/[jobId]/update-paramsPurpose: Modify learning rate, batch size during active trainingPhase 1: Advanced Training Features - Runtime Parameter Modification APIDate: 2025-11-02

## 559. What does POST /api/training/local/[jobId]/update-params do?

Update Training Parameters APIPATCH /api/training/local/[jobId]/update-paramsPurpose: Modify learning rate, batch size during active trainingPhase 1: Advanced Training Features - Runtime Parameter Modification APIDate: 2025-11-02

## 560. Which HTTP methods are implemented for /api/training/local/[jobId]/update-params?

GET, POST

## 561. Where is the source file for /api/training/local/[jobId]/update-params?

app/api/training/local/[jobId]/update-params/route.ts

## 562. What does DELETE /api/training/dataset/[id] do?

Next.js API route implemented in app/api/training/dataset/[id]/route.ts

## 563. What does GET /api/training/dataset/[id] do?

Next.js API route implemented in app/api/training/dataset/[id]/route.ts

## 564. Which HTTP methods are implemented for /api/training/dataset/[id]?

DELETE, GET

## 565. Where is the source file for /api/training/dataset/[id]?

app/api/training/dataset/[id]/route.ts

## 566. What does GET /api/training/dataset/available do?

GET /api/training/dataset/availableReturns user's datasets in dropdown-friendly formatUsed by DAG Builder for dataset selection

## 567. Which HTTP methods are implemented for /api/training/dataset/available?

GET

## 568. Where is the source file for /api/training/dataset/available?

app/api/training/dataset/available/route.ts

## 569. What does GET /api/training/predictions/[jobId] do?

Get training predictions    description: |      Retrieve model predictions generated during training for quality analysis.      Track how your model's predictions improve across epochs. This endpoint      returns predictions on sample prompts, allowing you to visualize quality      evolution during training (similar to Weights & Biases).Use Cases:      - Track prediction quality over time      - Compare predictions across epochs      - Identify model improvement or degradation      - Build prediction comparison visualizations      - Export predictions for analysisPagination:      - Use `limit` and `offset` for paginating large result sets      - Default limit: 50 predictions      - Filter by specific epoch using `epoch` parameter    tags:      - Metrics    security:      - bearerAuth: []    parameters:      - in: path        name: jobId        required: true        schema:          type: string        description: Training job ID        example: "job_abc123"      - in: query        name: epoch        schema:          type: integer        description: Filter predictions by specific epoch        example: 2      - in: query        name: limit        schema:          type: integer          default: 50        description: Maximum number of predictions to return        example: 50      - in: query        name: offset        schema:          type: integer          default: 0        description: Offset for pagination        example: 0    responses:      200:        description: Predictions retrieved successfully        content:          application/json:            schema:              type: object              properties:                job_id:                  type: string                  example: "job_abc123"                predictions:                  type: array                  items:                    type: object                    properties:                      id:                        type: string                      job_id:                        type: string                      epoch:                        type: integer                        example: 2                      step:                        type: integer                        example: 450                      sample_index:                        type: integer                        example: 0                      prompt:                        type: string                        example: "What is the capital of France?"                      ground_truth:                        type: string                        example: "The capital of France is Paris."                      prediction:                        type: string                        example: "Paris is the capital of France."                      created_at:                        type: string                        format: date-time                total_count:                  type: integer                  description: Total predictions for this job                  example: 150                epoch_count:                  type: integer                  description: Number of unique epochs                  example: 3      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      404:        description: Job not found        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 570. Which parameters does GET /api/training/predictions/[jobId] accept?

parameters:      - in: path        name: jobId        required: true        schema:          type: string

## 571. What responses does GET /api/training/predictions/[jobId] return?

responses:      200:

## 572. Does GET /api/training/predictions/[jobId] require authentication?

security:      - bearerAuth: []

## 573. Can you describe GET /api/training/predictions/[jobId]?

description: |      Retrieve model predictions generated during training for quality analysis.      Track how your model's predictions improve across epochs. This endpoint      returns predictions on sample prompts, allowing you to visualize quality      evolution during training (similar to Weights & Biases).Use Cases:      - Track prediction quality over time      - Compare predictions across epochs      - Identify model improvement or degradation      - Build prediction comparison visualizations      - Export predictions for analysisPagination:      - Use `limit` and `offset` for paginating large result sets      - Default limit: 50 predictions      - Filter by specific epoch using `epoch` parameter

## 574. What tags classify GET /api/training/predictions/[jobId]?

tags:      - Metrics

## 575. Which HTTP methods are implemented for /api/training/predictions/[jobId]?

GET

## 576. Where is the source file for /api/training/predictions/[jobId]?

app/api/training/predictions/[jobId]/route.ts

## 577. What does GET /api/training/predictions/[jobId]/epochs do?

Get prediction epochs summary    description: |      List all epochs with prediction counts for a training job.      Use this endpoint to build epoch selectors or get an overview of      prediction data availability across training epochs.Use Cases:      - Build epoch dropdown selectors in UI      - Show prediction coverage across epochs      - Validate prediction data availability      - Display training progress summary    tags:      - Metrics    security:      - bearerAuth: []    parameters:      - in: path        name: jobId        required: true        schema:          type: string        description: Training job ID        example: "job_abc123"    responses:      200:        description: Epoch summary retrieved successfully        content:          application/json:            schema:              type: object              properties:                job_id:                  type: string                  example: "job_abc123"                epochs:                  type: array                  items:                    type: object                    properties:                      epoch:                        type: integer                        example: 1                      prediction_count:                        type: integer                        example: 5                      latest_step:                        type: integer                        example: 250      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      404:        description: Job not found        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 578. Which parameters does GET /api/training/predictions/[jobId]/epochs accept?

parameters:      - in: path        name: jobId        required: true        schema:          type: string

## 579. What responses does GET /api/training/predictions/[jobId]/epochs return?

responses:      200:

## 580. Does GET /api/training/predictions/[jobId]/epochs require authentication?

security:      - bearerAuth: []

## 581. Can you describe GET /api/training/predictions/[jobId]/epochs?

description: |      List all epochs with prediction counts for a training job.      Use this endpoint to build epoch selectors or get an overview of      prediction data availability across training epochs.Use Cases:      - Build epoch dropdown selectors in UI      - Show prediction coverage across epochs      - Validate prediction data availability      - Display training progress summary

## 582. What tags classify GET /api/training/predictions/[jobId]/epochs?

tags:      - Metrics

## 583. Which HTTP methods are implemented for /api/training/predictions/[jobId]/epochs?

GET

## 584. Where is the source file for /api/training/predictions/[jobId]/epochs?

app/api/training/predictions/[jobId]/epochs/route.ts

## 585. What does DELETE /api/training/deploy/google-colab do?

Google Colab Deployment APIPurpose: Deploy training packages to Google Colab with OAuth/API key supportEndpoint: POST /api/training/deploy/google-colabDate: 2025-11-12

## 586. What does GET /api/training/deploy/google-colab do?

Google Colab Deployment APIPurpose: Deploy training packages to Google Colab with OAuth/API key supportEndpoint: POST /api/training/deploy/google-colabDate: 2025-11-12

## 587. What does POST /api/training/deploy/google-colab do?

Google Colab Deployment APIPurpose: Deploy training packages to Google Colab with OAuth/API key supportEndpoint: POST /api/training/deploy/google-colabDate: 2025-11-12

## 588. Which HTTP methods are implemented for /api/training/deploy/google-colab?

DELETE, GET, POST

## 589. Where is the source file for /api/training/deploy/google-colab?

app/api/training/deploy/google-colab/route.ts

## 590. What does DELETE /api/training/deploy/hf-spaces do?

HuggingFace Spaces Deployment API RoutesPurpose: Handle deployment to HuggingFace Spaces with cost trackingDate: 2025-10-31Endpoints:- POST /api/training/deploy/hf-spaces - Deploy training to HF Space- GET /api/training/deploy/hf-spaces?deployment_id=<space_id> - Get deployment s

## 591. What does GET /api/training/deploy/hf-spaces do?

HuggingFace Spaces Deployment API RoutesPurpose: Handle deployment to HuggingFace Spaces with cost trackingDate: 2025-10-31Endpoints:- POST /api/training/deploy/hf-spaces - Deploy training to HF Space- GET /api/training/deploy/hf-spaces?deployment_id=<space_id> - Get deployment s

## 592. What does POST /api/training/deploy/hf-spaces do?

HuggingFace Spaces Deployment API RoutesPurpose: Handle deployment to HuggingFace Spaces with cost trackingDate: 2025-10-31Endpoints:- POST /api/training/deploy/hf-spaces - Deploy training to HF Space- GET /api/training/deploy/hf-spaces?deployment_id=<space_id> - Get deployment s

## 593. Which HTTP methods are implemented for /api/training/deploy/hf-spaces?

DELETE, GET, POST

## 594. Where is the source file for /api/training/deploy/hf-spaces?

app/api/training/deploy/hf-spaces/route.ts

## 595. What does DELETE /api/training/deploy/runpod do?

Deploy training job to RunPod    description: |      Start a fine-tuning training job on RunPod's GPU infrastructure.      This endpoint provisions a GPU pod, sets up the training environment,      and begins model fine-tuning with your specified configuration and dataset.Features:      - Auto-provisioned GPU pods (A100, A6000, RTX 4090, etc.)      - Automatic environment setup      - Real-time metrics reporting      - Budget controls and cost monitoring      - Auto-shutdown on completionUse Cases:      - Start fine-tuning jobs programmatically      - Scale training across multiple GPUs      - Train models without local GPU hardwareWorkflow:      1. Create training configuration      2. Upload dataset      3. Deploy to RunPod      4. Monitor via status endpoint      5. Retrieve trained model artifactsNote:Requires RunPod API key configured in Settings > Secrets    tags:      - Training    security:      - bearerAuth: []    requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - training_config_id            properties:              training_config_id:                type: string                description: Training configuration ID                example: "cfg_abc123"              gpu_type:                type: string                enum: [NVIDIA_A100_80GB, NVIDIA_A100_40GB, NVIDIA_A6000, NVIDIA_RTX_A5000, NVIDIA_RTX_4090]                description: GPU type to use                example: "NVIDIA_A100_80GB"              gpu_count:                type: integer                default: 1                description: Number of GPUs                example: 1              docker_image:                type: string                description: Custom Docker image (optional)                example: "runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel"              volume_size_gb:                type: integer                default: 50                description: Persistent volume size in GB                example: 100              budget_limit:                type: number                description: Maximum budget in USD                example: 50.00              environment_variables:                type: object                description: Custom environment variables                additionalProperties:                  type: string                example:                  WANDB_API_KEY: "your-wandb-key"                  HF_TOKEN: "your-hf-token"    responses:      200:        description: Training job deployed successfully        content:          application/json:            schema:              type: object              properties:                deployment_id:                  type: string                  example: "pod_abc123"                pod_id:                  type: string                  example: "pod_abc123"                pod_url:                  type: string                  format: uri                  example: "https://pod-abc123.runpod.io"                status:                  type: string                  enum: [CREATED, RUNNING, EXITED, FAILED]                  example: "RUNNING"                gpu_type:                  type: string                  example: "NVIDIA_A100_80GB"                gpu_count:                  type: integer                  example: 1                cost:                  type: object                  properties:                    estimated_cost:                      type: number                      example: 25.50                    cost_per_hour:                      type: number                      example: 1.89                message:                  type: string                  example: "RunPod deployment created successfully"      400:        description: Missing required fields or RunPod API key not configured        content:          application/json:            schema:              type: object              properties:                error:                  type: string                  example: "RunPod API key not configured"      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      404:        description: Training configuration not found        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  get:    summary: Get RunPod deployment status    description: |      Check the status of a running or completed RunPod training deployment.      Returns real-time information about:      - Pod status (running, stopped, failed)      - Training metrics      - Cost information      - Resource usage    tags:      - Training    security:      - bearerAuth: []    parameters:      - in: query        name: deployment_id        required: true        schema:          type: string        description: RunPod deployment/pod ID        example: "pod_abc123"    responses:      200:        description: Status retrieved successfully        content:          application/json:            schema:              type: object              properties:                deployment_id:                  type: string                status:                  type: string                  enum: [CREATED, RUNNING, EXITED, FAILED]                pod_url:                  type: string                cost:                  type: object                  properties:                    actual_cost:                      type: number                      example: 12.45                metrics:                  type: object                  description: Training metrics (if available)      400:        description: Missing deployment_id parameter        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  delete:    summary: Stop RunPod deployment    description: |      Stop a running RunPod training deployment.      This will:      - Stop the training process      - Terminate the GPU pod      - Save final model checkpoints (if configured)      - Update cost tracking    tags:      - Training    security:      - bearerAuth: []    parameters:      - in: query        name: deployment_id        required: true        schema:          type: string        description: RunPod deployment/pod ID        example: "pod_abc123"    responses:      200:        description: Deployment stopped successfully        content:          application/json:            schema:              type: object              properties:                deployment_id:                  type: string                status:                  type: string                  example: "stopped"                message:                  type: string                  example: "RunPod deployment stopped successfully"      400:        description: Missing deployment_id parameter        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 596. What is the request body for DELETE /api/training/deploy/runpod?

requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - training_config_id            properties:              training_config_id:                type: string

## 597. Which parameters does DELETE /api/training/deploy/runpod accept?

parameters:      - in: query        name: deployment_id        required: true        schema:          type: string

## 598. What responses does DELETE /api/training/deploy/runpod return?

responses:      200:

## 599. Does DELETE /api/training/deploy/runpod require authentication?

security:      - bearerAuth: []

## 600. Can you describe DELETE /api/training/deploy/runpod?

description: |      Start a fine-tuning training job on RunPod's GPU infrastructure.      This endpoint provisions a GPU pod, sets up the training environment,      and begins model fine-tuning with your specified configuration and dataset.Features:      - Auto-provisioned GPU pods (A100, A6000, RTX 4090, etc.)      - Automatic environment setup      - Real-time metrics reporting      - Budget controls and cost monitoring      - Auto-shutdown on completionUse Cases:      - Start fine-tuning jobs programmatically      - Scale training across multiple GPUs      - Train models without local GPU hardwareWorkflow:      1. Create training configuration      2. Upload dataset      3. Deploy to RunPod      4. Monitor via status endpoint      5. Retrieve trained model artifactsNote:Requires RunPod API key configured in Settings > Secrets

## 601. What tags classify DELETE /api/training/deploy/runpod?

tags:      - Training

## 602. What does GET /api/training/deploy/runpod do?

Deploy training job to RunPod    description: |      Start a fine-tuning training job on RunPod's GPU infrastructure.      This endpoint provisions a GPU pod, sets up the training environment,      and begins model fine-tuning with your specified configuration and dataset.Features:      - Auto-provisioned GPU pods (A100, A6000, RTX 4090, etc.)      - Automatic environment setup      - Real-time metrics reporting      - Budget controls and cost monitoring      - Auto-shutdown on completionUse Cases:      - Start fine-tuning jobs programmatically      - Scale training across multiple GPUs      - Train models without local GPU hardwareWorkflow:      1. Create training configuration      2. Upload dataset      3. Deploy to RunPod      4. Monitor via status endpoint      5. Retrieve trained model artifactsNote:Requires RunPod API key configured in Settings > Secrets    tags:      - Training    security:      - bearerAuth: []    requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - training_config_id            properties:              training_config_id:                type: string                description: Training configuration ID                example: "cfg_abc123"              gpu_type:                type: string                enum: [NVIDIA_A100_80GB, NVIDIA_A100_40GB, NVIDIA_A6000, NVIDIA_RTX_A5000, NVIDIA_RTX_4090]                description: GPU type to use                example: "NVIDIA_A100_80GB"              gpu_count:                type: integer                default: 1                description: Number of GPUs                example: 1              docker_image:                type: string                description: Custom Docker image (optional)                example: "runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel"              volume_size_gb:                type: integer                default: 50                description: Persistent volume size in GB                example: 100              budget_limit:                type: number                description: Maximum budget in USD                example: 50.00              environment_variables:                type: object                description: Custom environment variables                additionalProperties:                  type: string                example:                  WANDB_API_KEY: "your-wandb-key"                  HF_TOKEN: "your-hf-token"    responses:      200:        description: Training job deployed successfully        content:          application/json:            schema:              type: object              properties:                deployment_id:                  type: string                  example: "pod_abc123"                pod_id:                  type: string                  example: "pod_abc123"                pod_url:                  type: string                  format: uri                  example: "https://pod-abc123.runpod.io"                status:                  type: string                  enum: [CREATED, RUNNING, EXITED, FAILED]                  example: "RUNNING"                gpu_type:                  type: string                  example: "NVIDIA_A100_80GB"                gpu_count:                  type: integer                  example: 1                cost:                  type: object                  properties:                    estimated_cost:                      type: number                      example: 25.50                    cost_per_hour:                      type: number                      example: 1.89                message:                  type: string                  example: "RunPod deployment created successfully"      400:        description: Missing required fields or RunPod API key not configured        content:          application/json:            schema:              type: object              properties:                error:                  type: string                  example: "RunPod API key not configured"      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      404:        description: Training configuration not found        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  get:    summary: Get RunPod deployment status    description: |      Check the status of a running or completed RunPod training deployment.      Returns real-time information about:      - Pod status (running, stopped, failed)      - Training metrics      - Cost information      - Resource usage    tags:      - Training    security:      - bearerAuth: []    parameters:      - in: query        name: deployment_id        required: true        schema:          type: string        description: RunPod deployment/pod ID        example: "pod_abc123"    responses:      200:        description: Status retrieved successfully        content:          application/json:            schema:              type: object              properties:                deployment_id:                  type: string                status:                  type: string                  enum: [CREATED, RUNNING, EXITED, FAILED]                pod_url:                  type: string                cost:                  type: object                  properties:                    actual_cost:                      type: number                      example: 12.45                metrics:                  type: object                  description: Training metrics (if available)      400:        description: Missing deployment_id parameter        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  delete:    summary: Stop RunPod deployment    description: |      Stop a running RunPod training deployment.      This will:      - Stop the training process      - Terminate the GPU pod      - Save final model checkpoints (if configured)      - Update cost tracking    tags:      - Training    security:      - bearerAuth: []    parameters:      - in: query        name: deployment_id        required: true        schema:          type: string        description: RunPod deployment/pod ID        example: "pod_abc123"    responses:      200:        description: Deployment stopped successfully        content:          application/json:            schema:              type: object              properties:                deployment_id:                  type: string                status:                  type: string                  example: "stopped"                message:                  type: string                  example: "RunPod deployment stopped successfully"      400:        description: Missing deployment_id parameter        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 603. What is the request body for GET /api/training/deploy/runpod?

requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - training_config_id            properties:              training_config_id:                type: string

## 604. Which parameters does GET /api/training/deploy/runpod accept?

parameters:      - in: query        name: deployment_id        required: true        schema:          type: string

## 605. What responses does GET /api/training/deploy/runpod return?

responses:      200:

## 606. Does GET /api/training/deploy/runpod require authentication?

security:      - bearerAuth: []

## 607. Can you describe GET /api/training/deploy/runpod?

description: |      Start a fine-tuning training job on RunPod's GPU infrastructure.      This endpoint provisions a GPU pod, sets up the training environment,      and begins model fine-tuning with your specified configuration and dataset.Features:      - Auto-provisioned GPU pods (A100, A6000, RTX 4090, etc.)      - Automatic environment setup      - Real-time metrics reporting      - Budget controls and cost monitoring      - Auto-shutdown on completionUse Cases:      - Start fine-tuning jobs programmatically      - Scale training across multiple GPUs      - Train models without local GPU hardwareWorkflow:      1. Create training configuration      2. Upload dataset      3. Deploy to RunPod      4. Monitor via status endpoint      5. Retrieve trained model artifactsNote:Requires RunPod API key configured in Settings > Secrets

## 608. What tags classify GET /api/training/deploy/runpod?

tags:      - Training

## 609. What does POST /api/training/deploy/runpod do?

Deploy training job to RunPod    description: |      Start a fine-tuning training job on RunPod's GPU infrastructure.      This endpoint provisions a GPU pod, sets up the training environment,      and begins model fine-tuning with your specified configuration and dataset.Features:      - Auto-provisioned GPU pods (A100, A6000, RTX 4090, etc.)      - Automatic environment setup      - Real-time metrics reporting      - Budget controls and cost monitoring      - Auto-shutdown on completionUse Cases:      - Start fine-tuning jobs programmatically      - Scale training across multiple GPUs      - Train models without local GPU hardwareWorkflow:      1. Create training configuration      2. Upload dataset      3. Deploy to RunPod      4. Monitor via status endpoint      5. Retrieve trained model artifactsNote:Requires RunPod API key configured in Settings > Secrets    tags:      - Training    security:      - bearerAuth: []    requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - training_config_id            properties:              training_config_id:                type: string                description: Training configuration ID                example: "cfg_abc123"              gpu_type:                type: string                enum: [NVIDIA_A100_80GB, NVIDIA_A100_40GB, NVIDIA_A6000, NVIDIA_RTX_A5000, NVIDIA_RTX_4090]                description: GPU type to use                example: "NVIDIA_A100_80GB"              gpu_count:                type: integer                default: 1                description: Number of GPUs                example: 1              docker_image:                type: string                description: Custom Docker image (optional)                example: "runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel"              volume_size_gb:                type: integer                default: 50                description: Persistent volume size in GB                example: 100              budget_limit:                type: number                description: Maximum budget in USD                example: 50.00              environment_variables:                type: object                description: Custom environment variables                additionalProperties:                  type: string                example:                  WANDB_API_KEY: "your-wandb-key"                  HF_TOKEN: "your-hf-token"    responses:      200:        description: Training job deployed successfully        content:          application/json:            schema:              type: object              properties:                deployment_id:                  type: string                  example: "pod_abc123"                pod_id:                  type: string                  example: "pod_abc123"                pod_url:                  type: string                  format: uri                  example: "https://pod-abc123.runpod.io"                status:                  type: string                  enum: [CREATED, RUNNING, EXITED, FAILED]                  example: "RUNNING"                gpu_type:                  type: string                  example: "NVIDIA_A100_80GB"                gpu_count:                  type: integer                  example: 1                cost:                  type: object                  properties:                    estimated_cost:                      type: number                      example: 25.50                    cost_per_hour:                      type: number                      example: 1.89                message:                  type: string                  example: "RunPod deployment created successfully"      400:        description: Missing required fields or RunPod API key not configured        content:          application/json:            schema:              type: object              properties:                error:                  type: string                  example: "RunPod API key not configured"      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      404:        description: Training configuration not found        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  get:    summary: Get RunPod deployment status    description: |      Check the status of a running or completed RunPod training deployment.      Returns real-time information about:      - Pod status (running, stopped, failed)      - Training metrics      - Cost information      - Resource usage    tags:      - Training    security:      - bearerAuth: []    parameters:      - in: query        name: deployment_id        required: true        schema:          type: string        description: RunPod deployment/pod ID        example: "pod_abc123"    responses:      200:        description: Status retrieved successfully        content:          application/json:            schema:              type: object              properties:                deployment_id:                  type: string                status:                  type: string                  enum: [CREATED, RUNNING, EXITED, FAILED]                pod_url:                  type: string                cost:                  type: object                  properties:                    actual_cost:                      type: number                      example: 12.45                metrics:                  type: object                  description: Training metrics (if available)      400:        description: Missing deployment_id parameter        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'  delete:    summary: Stop RunPod deployment    description: |      Stop a running RunPod training deployment.      This will:      - Stop the training process      - Terminate the GPU pod      - Save final model checkpoints (if configured)      - Update cost tracking    tags:      - Training    security:      - bearerAuth: []    parameters:      - in: query        name: deployment_id        required: true        schema:          type: string        description: RunPod deployment/pod ID        example: "pod_abc123"    responses:      200:        description: Deployment stopped successfully        content:          application/json:            schema:              type: object              properties:                deployment_id:                  type: string                status:                  type: string                  example: "stopped"                message:                  type: string                  example: "RunPod deployment stopped successfully"      400:        description: Missing deployment_id parameter        content:          application/json:            schema:              $ref: '#/components/schemas/Error'      401:        description: Unauthorized        content:          application/json:            schema:              $ref: '#/components/schemas/Error'

## 610. What is the request body for POST /api/training/deploy/runpod?

requestBody:      required: true      content:        application/json:          schema:            type: object            required:              - training_config_id            properties:              training_config_id:                type: string

## 611. Which parameters does POST /api/training/deploy/runpod accept?

parameters:      - in: query        name: deployment_id        required: true        schema:          type: string

## 612. What responses does POST /api/training/deploy/runpod return?

responses:      200:

## 613. Does POST /api/training/deploy/runpod require authentication?

security:      - bearerAuth: []

## 614. Can you describe POST /api/training/deploy/runpod?

description: |      Start a fine-tuning training job on RunPod's GPU infrastructure.      This endpoint provisions a GPU pod, sets up the training environment,      and begins model fine-tuning with your specified configuration and dataset.Features:      - Auto-provisioned GPU pods (A100, A6000, RTX 4090, etc.)      - Automatic environment setup      - Real-time metrics reporting      - Budget controls and cost monitoring      - Auto-shutdown on completionUse Cases:      - Start fine-tuning jobs programmatically      - Scale training across multiple GPUs      - Train models without local GPU hardwareWorkflow:      1. Create training configuration      2. Upload dataset      3. Deploy to RunPod      4. Monitor via status endpoint      5. Retrieve trained model artifactsNote:Requires RunPod API key configured in Settings > Secrets

## 615. What tags classify POST /api/training/deploy/runpod?

tags:      - Training

## 616. Which HTTP methods are implemented for /api/training/deploy/runpod?

DELETE, GET, POST

## 617. Where is the source file for /api/training/deploy/runpod?

app/api/training/deploy/runpod/route.ts

## 618. What does DELETE /api/training/deploy/kaggle do?

Kaggle Deployment APIPurpose: Deploy training packages to Kaggle Notebooks with free GPU supportEndpoint: POST /api/training/deploy/kaggleDate: 2025-10-31

## 619. What does GET /api/training/deploy/kaggle do?

Kaggle Deployment APIPurpose: Deploy training packages to Kaggle Notebooks with free GPU supportEndpoint: POST /api/training/deploy/kaggleDate: 2025-10-31

## 620. What does POST /api/training/deploy/kaggle do?

Kaggle Deployment APIPurpose: Deploy training packages to Kaggle Notebooks with free GPU supportEndpoint: POST /api/training/deploy/kaggleDate: 2025-10-31

## 621. Which HTTP methods are implemented for /api/training/deploy/kaggle?

DELETE, GET, POST

## 622. Where is the source file for /api/training/deploy/kaggle?

app/api/training/deploy/kaggle/route.ts

## 623. What does GET /api/training/checkpoints/list do?

Checkpoint Listing APIGET /api/training/checkpoints/list?jobId=xxxReturns list of available checkpoints for a training jobPhase: Checkpoint Selection FeatureDate: 2025-10-31

## 624. Which HTTP methods are implemented for /api/training/checkpoints/list?

GET

## 625. Where is the source file for /api/training/checkpoints/list?

app/api/training/checkpoints/list/route.ts

## 626. What does POST /api/distributed/execute do?

API Route: POST /api/distributed/executeStart distributed execution

## 627. Which HTTP methods are implemented for /api/distributed/execute?

POST

## 628. Where is the source file for /api/distributed/execute?

app/api/distributed/execute/route.ts

## 629. What does GET /api/distributed/health do?

API Route: GET /api/distributed/healthHealth check for all distributed components

## 630. Which HTTP methods are implemented for /api/distributed/health?

GET

## 631. Where is the source file for /api/distributed/health?

app/api/distributed/health/route.ts

## 632. What does GET /api/distributed/workers do?

API Route: GET /api/distributed/workersList all registered workers

## 633. Which HTTP methods are implemented for /api/distributed/workers?

GET

## 634. Where is the source file for /api/distributed/workers?

app/api/distributed/workers/route.ts

## 635. What does POST /api/distributed/queue/resume do?

API Route: POST /api/distributed/queue/resumeResume job processing

## 636. Which HTTP methods are implemented for /api/distributed/queue/resume?

POST

## 637. Where is the source file for /api/distributed/queue/resume?

app/api/distributed/queue/resume/route.ts

## 638. What does POST /api/distributed/queue/pause do?

API Route: POST /api/distributed/queue/pausePause job processing

## 639. Which HTTP methods are implemented for /api/distributed/queue/pause?

POST

## 640. Where is the source file for /api/distributed/queue/pause?

app/api/distributed/queue/pause/route.ts

## 641. What does GET /api/distributed/queue/stats do?

API Route: GET /api/distributed/queue/statsGet queue statistics

## 642. Which HTTP methods are implemented for /api/distributed/queue/stats?

GET

## 643. Where is the source file for /api/distributed/queue/stats?

app/api/distributed/queue/stats/route.ts

## 644. What does GET /api/distributed/execute/[executionId] do?

API Route: GET /api/distributed/execute/[executionId]Get execution status

## 645. Which HTTP methods are implemented for /api/distributed/execute/[executionId]?

GET

## 646. Where is the source file for /api/distributed/execute/[executionId]?

app/api/distributed/execute/[executionId]/route.ts

## 647. What does DELETE /api/distributed/workers/[workerId] do?

API Route: DELETE /api/distributed/workers/[workerId]Deregister a worker

## 648. Which HTTP methods are implemented for /api/distributed/workers/[workerId]?

DELETE

## 649. Where is the source file for /api/distributed/workers/[workerId]?

app/api/distributed/workers/[workerId]/route.ts

## 650. What does POST /api/distributed/workers/register do?

API Route: POST /api/distributed/workers/registerRegister a new worker in the distributed system

## 651. Which HTTP methods are implemented for /api/distributed/workers/register?

POST

## 652. Where is the source file for /api/distributed/workers/register?

app/api/distributed/workers/register/route.ts

## 653. What does POST /api/distributed/workers/[workerId]/heartbeat do?

API Route: POST /api/distributed/workers/[workerId]/heartbeatSend heartbeat for a worker

## 654. Which HTTP methods are implemented for /api/distributed/workers/[workerId]/heartbeat?

POST

## 655. Where is the source file for /api/distributed/workers/[workerId]/heartbeat?

app/api/distributed/workers/[workerId]/heartbeat/route.ts

## 656. What does GET /health in the training server do?

Health check endpoint with GPU info (silent - no logging to reduce noise)

## 657. What does POST /api/training/execute in the training server do?

Execute a training job with provided configuration

## 658. What does POST /api/training/validate in the training server do?

Execute model validation on test dataset and compute metrics

## 659. What does GET /api/training/status/{job_id} in the training server do?

Get status of a training job with current metrics

## 660. What does GET /api/training/metrics/{job_id} in the training server do?

Get full metrics history for a training job.
    Returns all historical data points for charting.

## 661. What does GET /api/training/logs/{job_id} in the training server do?

Get training logs for a job.

    Args:
        job_id: Job identifier
        limit: Max number of lines to return (default: 100)
        offset: Line offset to start from (default: 0)

## 662. What parameters does GET /api/training/logs/{job_id} accept?

Get training logs for a job.

    Args:
        job_id: Job identifier
        limit: Max number of lines to return (default: 100)
        offset: Line offset to start from (default: 0)

## 663. What does GET /api/training/queue in the training server do?

Get current job queue status.
    Shows running jobs and queued jobs with their positions.
    
    Returns:
        JSON with queue statistics and job details

## 664. What does GET /api/training/queue return?

Get current job queue status.
    Shows running jobs and queued jobs with their positions.
    
    Returns:
        JSON with queue statistics and job details

## 665. What does POST /api/training/cancel/{job_id} in the training server do?

FastAPI endpoint defined in training_server.py

## 666. What does POST /api/training/pause/{job_id} in the training server do?

FastAPI endpoint defined in training_server.py

## 667. What does POST /api/training/resume/{job_id} in the training server do?

FastAPI endpoint defined in training_server.py

## 668. What does POST /api/training/{job_id}/force-start in the training server do?

FastAPI endpoint defined in training_server.py

## 669. What does GET /api/training/checkpoints/{job_id} in the training server do?

List all checkpoint directories for a training job.
    Returns checkpoint metadata including eval loss, train loss, and file size.

    Args:
        job_id: Job identifier

    Returns:
        JSON response with list of checkpoints and metadata

## 670. What parameters does GET /api/training/checkpoints/{job_id} accept?

List all checkpoint directories for a training job.
    Returns checkpoint metadata including eval loss, train loss, and file size.

    Args:
        job_id: Job identifier

    Returns:
        JSON response with list of checkpoints and metadata

## 671. What does GET /api/training/checkpoints/{job_id} return?

List all checkpoint directories for a training job.
    Returns checkpoint metadata including eval loss, train loss, and file size.

    Args:
        job_id: Job identifier

    Returns:
        JSON response with list of checkpoints and metadata

## 672. What does GET /api/training/{job_id}/download/model in the training server do?

FastAPI endpoint defined in training_server.py

## 673. What does GET /api/training/{job_id}/download/logs in the training server do?

Download training logs as ZIP file.
    
    Includes:
    - training.log: Full training logs
    - progress.json: Progress metrics (if available)
    
    Args:
        job_id: Job identifier
    
    Returns:
        StreamingResponse with ZIP file containing log files
    
    Phase 4 - Logs Download

## 674. What parameters does GET /api/training/{job_id}/download/logs accept?

Download training logs as ZIP file.
    
    Includes:
    - training.log: Full training logs
    - progress.json: Progress metrics (if available)
    
    Args:
        job_id: Job identifier
    
    Returns:
        StreamingResponse with ZIP file containing log files
    
    Phase 4 - Logs Download

## 675. What does GET /api/training/{job_id}/download/logs return?

Download training logs as ZIP file.
    
    Includes:
    - training.log: Full training logs
    - progress.json: Progress metrics (if available)
    
    Args:
        job_id: Job identifier
    
    Returns:
        StreamingResponse with ZIP file containing log files
    
    Phase 4 - Logs Download

## 676. What does GET /api/training/{job_id}/analytics in the training server do?

FastAPI endpoint defined in training_server.py

## 677. What does GET /api/training/analytics/summary in the training server do?

FastAPI endpoint defined in training_server.py

## 678. What does GET /api/training/analytics/compare in the training server do?

FastAPI endpoint defined in training_server.py

## 679. What does GET /api/filesystem/models in the training server do?

List all models in the user's AI_MODELS_DIR.
    
    Returns list of model directories with metadata.
    
    Phase 1 - Filesystem API

## 680. What does GET /api/filesystem/models/{model_name}/info in the training server do?

Get detailed information about a specific model.
    
    Args:
        model_name: Name of the model directory
    
    Returns:
        Detailed model metadata including file breakdown
    
    Phase 1 - Filesystem API

## 681. What parameters does GET /api/filesystem/models/{model_name}/info accept?

Get detailed information about a specific model.
    
    Args:
        model_name: Name of the model directory
    
    Returns:
        Detailed model metadata including file breakdown
    
    Phase 1 - Filesystem API

## 682. What does GET /api/filesystem/models/{model_name}/info return?

Get detailed information about a specific model.
    
    Args:
        model_name: Name of the model directory
    
    Returns:
        Detailed model metadata including file breakdown
    
    Phase 1 - Filesystem API

## 683. What does GET /api/filesystem/checkpoints/{job_id} in the training server do?

List all checkpoints for a specific training job.
    
    Args:
        job_id: Training job ID
    
    Returns:
        List of checkpoints with metadata
    
    Phase 1 - Filesystem API

## 684. What parameters does GET /api/filesystem/checkpoints/{job_id} accept?

List all checkpoints for a specific training job.
    
    Args:
        job_id: Training job ID
    
    Returns:
        List of checkpoints with metadata
    
    Phase 1 - Filesystem API

## 685. What does GET /api/filesystem/checkpoints/{job_id} return?

List all checkpoints for a specific training job.
    
    Args:
        job_id: Training job ID
    
    Returns:
        List of checkpoints with metadata
    
    Phase 1 - Filesystem API

## 686. What does POST /api/filesystem/list in the training server do?

FastAPI endpoint defined in training_server.py

## 687. What does POST /api/filesystem/read in the training server do?

FastAPI endpoint defined in training_server.py

## 688. What does POST /api/filesystem/info in the training server do?

FastAPI endpoint defined in training_server.py

## 689. How does the training jobs realtime hook keep the UI updated?

The hook `lib/hooks/useTrainingJobsRealtime.ts` subscribes to Supabase Postgres changes on the `local_training_jobs` table (INSERT/UPDATE/DELETE) filtered by the current user_id. It performs an initial fetch, then maintains a live channel. If the channel errors, times out, or closes, it falls back to polling every 30s and schedules exponential backoff reconnect attempts (up to ~30s). It also clears channels when the auth token changes to prevent stale connections.
