# How to Replace Tools with Your Implementations

## 🧮 Replacing Calculator with Your Sophisticated Implementation

### Option 1: Simple Replacement (Same Structure)

Replace just the service file:

**File:** `/lib/tools/calculator/calculator.service.ts`

```typescript
// Replace this entire file with your sophisticated calculator

export class CalculatorService {
  async evaluate(expression: string) {
    // YOUR SOPHISTICATED CALCULATOR LOGIC HERE
    // Import your existing calculator project
    // Use your advanced parser, solver, etc.

    const yourResult = 0; // Replace with your calculation logic

    return {
      result: yourResult,
      expression: expression
    };
  }
}

export const calculatorService = new CalculatorService();
```

### Option 2: Full Project Integration (Multiple Files)

Add your entire calculator project:

```text
lib/tools/calculator/
├── index.ts                    # KEEP THIS (exports ToolDefinition)
├── calculator.config.ts        # UPDATE with your config needs
├── calculator.service.ts       # Main entry point
│
├── YOUR PROJECT FILES:
├── parser.ts                   # Your expression parser
├── solver.ts                   # Your equation solver
├── symbolic.ts                 # Your symbolic math
├── matrix.ts                   # Your matrix operations
├── advanced-functions.ts       # Your advanced functions
│
├── utils/                      # Your utilities
│   ├── validators.ts
│   ├── formatters.ts
│   └── constants.ts
│
└── types/                      # Your types
    ├── expressions.ts
    └── results.ts
```

Keep this interface in `index.ts`:

```typescript
import { ToolDefinition } from '../types';
import { calculatorConfig } from './calculator.config';
import { calculatorService } from './calculator.service'; // Your main service

const calculatorTool: ToolDefinition = {
  name: 'calculator',
  description: 'Your sophisticated calculator description',
  version: '2.0.0', // Your version
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Math expression to evaluate',
      },
      // Add your custom parameters
      mode: {
        type: 'string',
        description: 'Calculation mode: basic, symbolic, matrix',
      },
    },
    required: ['expression'],
  },
  config: {
    enabled: calculatorConfig.enabled,
    // Your config properties
  },
  async execute(params: Record<string, unknown>) {
    const expression = params.expression as string;
    // Call your sophisticated calculator
    const result = await calculatorService.evaluate(expression, params);
    return result;
  },
};

export default calculatorTool;
```

---

## 🔍 Replacing Web Search with Your Robust Implementation

### Option 1: Replace the STUB

**File:** `/lib/tools/web-search/search.service.ts`

```typescript
// Delete the STUB implementation
// Replace with your robust search

export class SearchService {
  async search(query: string, maxResults?: number) {
    // YOUR ROBUST SEARCH LOGIC
    // Call your search providers
    // Use your caching system
    // Return your formatted results

    const yourSearchResults: any[] = []; // Replace with your search logic
    return yourSearchResults;
  }
}

export const searchService = new SearchService();
```

### Option 2: Full Multi-Provider System

Add your complete search implementation:

```text
lib/tools/web-search/
├── index.ts                    # KEEP THIS (exports ToolDefinition)
├── search.config.ts            # UPDATE with your providers
├── search.service.ts           # Main orchestrator
│
├── YOUR PROJECT FILES:
├── providers/                  # Your search providers
│   ├── duckduckgo.ts
│   ├── google.ts
│   ├── bing.ts
│   ├── custom.ts
│   └── provider-factory.ts
│
├── cache/                      # Your caching system
│   ├── redis-cache.ts
│   ├── memory-cache.ts
│   └── cache-manager.ts
│
├── parsers/                    # Result parsers
│   ├── html-parser.ts
│   ├── json-parser.ts
│   └── xml-parser.ts
│
├── filters/                    # Result filtering
│   ├── duplicate-filter.ts
│   ├── relevance-filter.ts
│   └── content-filter.ts
│
└── utils/                      # Utilities
    ├── rate-limiter.ts
    ├── retry-handler.ts
    └── validators.ts
```

Update `search.config.ts`:

```typescript
export const searchConfig = {
  enabled: process.env.TOOL_WEBSEARCH_ENABLED === 'true',

  // Your provider configurations
  providers: {
    duckduckgo: {
      enabled: true,
      apiKey: process.env.DUCKDUCKGO_API_KEY,
      timeout: 5000,
    },
    google: {
      enabled: true,
      apiKey: process.env.GOOGLE_API_KEY,
      cx: process.env.GOOGLE_CX,
      timeout: 5000,
    },
    // Your other providers
  },

  // Your caching config
  cache: {
    enabled: true,
    ttl: 3600,
    maxSize: 1000,
    provider: 'redis', // or 'memory'
  },

  // Your features
  features: {
    imageSearch: true,
    videoSearch: true,
    newsSearch: true,
    shopping: true,
  },
};
```

Update `search.service.ts`:

```typescript
import { searchConfig } from './search.config';
import { ProviderFactory } from './providers/provider-factory';
import { CacheManager } from './cache/cache-manager';
import { DuplicateFilter } from './filters/duplicate-filter';

export class SearchService {
  private providerFactory = new ProviderFactory(searchConfig);
  private cache = new CacheManager(searchConfig.cache);
  private filter = new DuplicateFilter();

  async search(query: string, maxResults?: number) {
    // Check cache
    const cached = await this.cache.get(query);
    if (cached) return cached;

    // Get provider based on config
    const provider = this.providerFactory.getProvider();

    // Execute search
    const results = await provider.search(query, maxResults);

    // Filter results
    const filtered = this.filter.filter(results);

    // Cache results
    await this.cache.set(query, filtered);

    return filtered;
  }

  // Your other methods
}
```

---

## 🆕 Adding a New Tool

### Example: Adding a "Code Executor" Tool

1. Create folder:

```bash
mkdir lib/tools/code-executor
```

1. Create config file:

**File:** `lib/tools/code-executor/executor.config.ts`

```typescript
export const executorConfig = {
  enabled: process.env.TOOL_CODE_EXECUTOR_ENABLED === 'true',
  allowedLanguages: ['python', 'javascript', 'typescript'],
  timeout: parseInt(process.env.EXECUTOR_TIMEOUT_MS || '30000'),
  maxOutputLength: parseInt(process.env.EXECUTOR_MAX_OUTPUT || '10000'),
};
```

1. Create service file:

**File:** `lib/tools/code-executor/executor.service.ts`

```typescript
import { executorConfig } from './executor.config';

export class ExecutorService {
  async execute(code: string, language: string) {
    // Your code execution logic
    return {
      output: 'execution output',
      exitCode: 0,
      executionTime: 123,
    };
  }
}

export const executorService = new ExecutorService();
```

1. Create index file:

**File:** `lib/tools/code-executor/index.ts`

```typescript
import { ToolDefinition } from '../types';
import { executorConfig } from './executor.config';
import { executorService } from './executor.service';

const codeExecutorTool: ToolDefinition = {
  name: 'code_executor',
  description: 'Execute code in various programming languages',
  version: '1.0.0',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Code to execute',
      },
      language: {
        type: 'string',
        description: 'Programming language',
        enum: ['python', 'javascript', 'typescript'],
      },
    },
    required: ['code', 'language'],
  },
  config: {
    enabled: executorConfig.enabled,
  },
  async execute(params: Record<string, unknown>) {
    const code = params.code as string;
    const language = params.language as string;
    return await executorService.execute(code, language);
  },
};

export default codeExecutorTool;
```

1. Register in registry.ts:

**File:** `/lib/tools/registry.ts` (at the bottom)

```typescript
// Add import
import codeExecutorTool from './code-executor';

// Add registration
registerTool(codeExecutorTool);
```

1. Done! Tool is now available.

---

## 🔧 Configuration via Environment Variables

Create a `.env.local` file:

```bash
# Calculator (your sophisticated version)
TOOL_CALCULATOR_ENABLED=true
CALCULATOR_PRECISION=15
CALCULATOR_ANGLE_MODE=radians
# Add your custom calculator config

# Web Search (your robust version)
TOOL_WEBSEARCH_ENABLED=true
SEARCH_PROVIDER=multi  # Use multiple providers
DUCKDUCKGO_API_KEY=your-key
GOOGLE_API_KEY=your-key
GOOGLE_CX=your-cx
SEARCH_CACHE_ENABLED=true
REDIS_URL=redis://localhost:6379
# Add your custom search config

# DateTime
TOOL_DATETIME_ENABLED=true
DEFAULT_TIMEZONE=America/New_York

# Code Executor (new tool)
TOOL_CODE_EXECUTOR_ENABLED=true
EXECUTOR_TIMEOUT_MS=60000
```

---

## ✅ Testing Your Implementation

After replacing a tool:

```typescript
import { executeTool } from '@/lib/tools';

// Test your sophisticated calculator
const calcResult = await executeTool('calculator', {
  expression: 'complex expression',
  mode: 'symbolic', // Your custom parameter
});
console.log(calcResult);

// Test your robust search
const searchResult = await executeTool('web_search', {
  query: 'test query',
  maxResults: 10,
});
console.log(searchResult);
```

---

## 📝 Checklist for Replacing a Tool

- [ ] Keep `index.ts` - it exports the ToolDefinition
- [ ] Update `*.config.ts` with your configuration needs
- [ ] Replace `*.service.ts` with your implementation
- [ ] Add any additional files your implementation needs
- [ ] Ensure `execute()` method signature matches
- [ ] Test the tool works
- [ ] Update environment variables
- [ ] Remove STUB markers/comments
- [ ] Update version number in index.ts

---

**That's it!** The modular system makes it easy to drop in your sophisticated implementations while keeping the tool system's interface intact.
