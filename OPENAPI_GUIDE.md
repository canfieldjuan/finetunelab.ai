# OpenAPI Implementation Guide

Complete guide for adding OpenAPI spec to Fine-Tune Labs API routes.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Adding Endpoints to OpenAPI Spec](#adding-endpoints-to-openapi-spec)
4. [JSDoc Syntax Reference](#jsdoc-syntax-reference)
5. [Generating the Spec](#generating-the-spec)
6. [Viewing Interactive Docs](#viewing-interactive-docs)
7. [Generating SDKs](#generating-sdks)
8. [Best Practices](#best-practices)

---

## Overview

We use **swagger-jsdoc** to generate OpenAPI 3.0 specifications from JSDoc comments in our Next.js API routes.

**Benefits:**
- ✅ Interactive API playground (Swagger UI)
- ✅ Auto-generated client SDKs (TypeScript, Python, etc.)
- ✅ API documentation always in sync with code
- ✅ Validation and type safety

**Files:**
- `openapi.config.js` - OpenAPI configuration
- `scripts/generate-openapi.js` - Generation script
- `public/openapi.json` - Generated spec (JSON)
- `public/openapi.yaml` - Generated spec (YAML)
- `app/docs/api-spec/page.tsx` - Swagger UI page

---

## Quick Start

### 1. Add JSDoc Comments to Your API Route

```typescript
// app/api/your-endpoint/route.ts

/**
 * @swagger
 * /api/your-endpoint:
 *   get:
 *     summary: Your endpoint description
 *     tags:
 *       - YourTag
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
export async function GET(request: NextRequest) {
  // Your implementation
}
```

### 2. Generate the Spec

```bash
npm run generate:openapi
```

### 3. View Interactive Docs

Visit: http://localhost:3000/docs/api-spec

---

## Adding Endpoints to OpenAPI Spec

### Step 1: Update `openapi.config.js` (if needed)

If your API route is in a new directory, add it to the `apis` array:

```javascript
// openapi.config.js
module.exports = {
  // ...
  apis: [
    './app/api/widget-apps/**/*.ts',
    './app/api/analytics/**/*.ts',
    './app/api/inference/**/*.ts',
    './app/api/models/**/*.ts',
    './app/api/your-new-feature/**/*.ts', // ← Add here
  ],
};
```

### Step 2: Add JSDoc Comments

Add `@swagger` JSDoc comments above your HTTP method exports.

**Example: GET Endpoint**

```typescript
/**
 * @swagger
 * /api/analytics/metrics:
 *   get:
 *     summary: Get analytics metrics
 *     description: Retrieve real-time analytics metrics for deployed models
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: model_id
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by model ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of metrics to return
 *     responses:
 *       200:
 *         description: Successfully retrieved metrics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Metrics'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export async function GET(request: NextRequest) {
  // Implementation
}
```

**Example: POST Endpoint with Request Body**

```typescript
/**
 * @swagger
 * /api/models:
 *   post:
 *     summary: Create new model
 *     description: Register a new LLM model in the system
 *     tags:
 *       - Models
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - provider
 *               - model_id
 *             properties:
 *               name:
 *                 type: string
 *                 example: "GPT-4"
 *               provider:
 *                 type: string
 *                 enum: [openai, anthropic, google, local]
 *                 example: "openai"
 *               model_id:
 *                 type: string
 *                 example: "gpt-4-turbo"
 *               api_key:
 *                 type: string
 *                 format: password
 *                 description: API key (will be encrypted)
 *     responses:
 *       201:
 *         description: Model created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Model'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
export async function POST(request: NextRequest) {
  // Implementation
}
```

**Example: DELETE Endpoint with Path Parameter**

```typescript
/**
 * @swagger
 * /api/models/{id}:
 *   delete:
 *     summary: Delete model
 *     tags:
 *       - Models
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Model ID
 *     responses:
 *       200:
 *         description: Model deleted successfully
 *       404:
 *         description: Model not found
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Implementation
}
```

---

## JSDoc Syntax Reference

### Basic Structure

```yaml
@swagger
/api/path:
  method:
    summary: Short description
    description: Longer description (optional)
    tags:
      - TagName
    security:
      - bearerAuth: []
    parameters: [...]
    requestBody: {...}
    responses: {...}
```

### HTTP Methods

- `get` - GET request
- `post` - POST request
- `put` - PUT request
- `patch` - PATCH request
- `delete` - DELETE request

### Tags

Group related endpoints together:

```yaml
tags:
  - Widget Apps
  - Analytics
  - Models
  - Training
  - Inference
  - Metrics
```

Available tags are defined in `openapi.config.js`.

### Security

For endpoints requiring authentication:

```yaml
security:
  - bearerAuth: []
```

For public endpoints, omit the `security` field.

### Parameters

#### Query Parameters

```yaml
parameters:
  - in: query
    name: limit
    schema:
      type: integer
      default: 100
    required: false
    description: Maximum number of results
```

#### Path Parameters

```yaml
parameters:
  - in: path
    name: id
    required: true
    schema:
      type: string
    description: Resource ID
```

#### Header Parameters

```yaml
parameters:
  - in: header
    name: X-Custom-Header
    schema:
      type: string
    required: false
```

### Request Body

```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - name
        properties:
          name:
            type: string
            example: "Example"
          optional_field:
            type: number
```

### Responses

```yaml
responses:
  200:
    description: Success
    content:
      application/json:
        schema:
          type: object
          properties:
            message:
              type: string
  400:
    description: Bad request
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Error'
```

### Schema References

Use `$ref` to reference shared schemas defined in `openapi.config.js`:

```yaml
schema:
  $ref: '#/components/schemas/Model'
```

Available schemas:
- `Error` - Standard error response
- `WidgetApp` - Widget app object
- `Model` - LLM model object
- `Metrics` - Metrics object

**Add new schemas in `openapi.config.js`:**

```javascript
components: {
  schemas: {
    YourNewSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' }
      }
    }
  }
}
```

---

## Generating the Spec

### Generate OpenAPI JSON/YAML

```bash
npm run generate:openapi
```

**Output:**
- `/public/openapi.json`
- `/public/openapi.yaml`

### What Happens:

1. `swagger-jsdoc` scans all API routes matching patterns in `openapi.config.js`
2. Extracts `@swagger` JSDoc comments
3. Merges with base config from `openapi.config.js`
4. Generates OpenAPI 3.0 spec
5. Writes JSON and YAML files to `/public`

---

## Viewing Interactive Docs

### Swagger UI (Interactive Playground)

Visit: http://localhost:3000/docs/api-spec

**Features:**
- ✅ Try out endpoints directly in browser
- ✅ View request/response examples
- ✅ Filter endpoints by tag
- ✅ Authenticate with Bearer token
- ✅ Download OpenAPI spec

### Static Documentation

Visit: http://localhost:3000/docs/api-reference

**Features:**
- ✅ Human-readable documentation
- ✅ Code examples in multiple languages
- ✅ Copy-to-clipboard

---

## Generating SDKs

### TypeScript SDK

```bash
npm run generate:sdk
```

**Output:** `/sdk/typescript/`

**Usage:**

```typescript
import { ApiClient } from '@/sdk/typescript';

const client = new ApiClient({
  BASE: 'http://localhost:3000',
  HEADERS: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});

// List widget apps
const apps = await client.widgetApps.getApiWidgetApps();

// Create widget app
const newApp = await client.widgetApps.postApiWidgetApps({
  requestBody: {
    name: 'My App',
    description: 'Production monitoring'
  }
});
```

### Python SDK

```bash
npm run generate:sdk:python
```

**Output:** `/sdk/python/`

**Usage:**

```python
from sdk.python import ApiClient, Configuration

config = Configuration()
config.host = "http://localhost:3000"
config.access_token = "YOUR_TOKEN"

client = ApiClient(config)

# List widget apps
apps = client.widget_apps_api.get_api_widget_apps()

# Create widget app
new_app = client.widget_apps_api.post_api_widget_apps({
    "name": "My App",
    "description": "Production monitoring"
})
```

### Custom SDK Generators

```bash
# See available generators
npx @openapitools/openapi-generator-cli list

# Generate for any language
npx @openapitools/openapi-generator-cli generate \
  -i public/openapi.json \
  -g <generator-name> \
  -o sdk/<language>
```

**Popular generators:**
- `typescript-fetch` - TypeScript with fetch
- `typescript-axios` - TypeScript with axios
- `python` - Python client
- `go` - Go client
- `java` - Java client
- `ruby` - Ruby client
- `php` - PHP client

---

## Best Practices

### 1. Use Descriptive Summaries

```yaml
# ❌ Bad
summary: Get data

# ✅ Good
summary: Retrieve analytics metrics for deployed models
```

### 2. Add Examples

```yaml
properties:
  name:
    type: string
    example: "GPT-4 Turbo"  # ← Helps developers
```

### 3. Document All Response Codes

```yaml
responses:
  200:
    description: Success
  400:
    description: Bad request - Invalid parameters
  401:
    description: Unauthorized - Missing or invalid token
  403:
    description: Forbidden - Insufficient permissions
  404:
    description: Resource not found
  500:
    description: Internal server error
```

### 4. Use Enums for Fixed Values

```yaml
provider:
  type: string
  enum: [openai, anthropic, google, local]
```

### 5. Mark Required Fields

```yaml
required:
  - name
  - provider
properties:
  name:
    type: string
  provider:
    type: string
```

### 6. Group with Tags

```yaml
tags:
  - Analytics  # Groups with other analytics endpoints
```

### 7. Reference Shared Schemas

```yaml
# ❌ Bad - Repeat schema everywhere
schema:
  type: object
  properties:
    id: { type: string }
    name: { type: string }

# ✅ Good - Reference shared schema
schema:
  $ref: '#/components/schemas/Model'
```

### 8. Keep Descriptions Clear

```yaml
description: |
  Retrieve real-time analytics metrics for deployed models.

  Supports filtering by model ID and time range.
  Returns up to 1000 metrics per request.
```

### 9. Version Your API

Update version in `openapi.config.js`:

```javascript
info: {
  version: '2.0.0', // Increment on breaking changes
}
```

### 10. Regenerate After Changes

```bash
# Always regenerate spec after adding/updating JSDoc comments
npm run generate:openapi

# Regenerate SDK if spec changed
npm run generate:sdk
```

---

## Troubleshooting

### No Endpoints Generated

**Problem:** `npm run generate:openapi` shows 0 endpoints

**Solution:**
1. Check that your route file is in a directory listed in `openapi.config.js` → `apis`
2. Verify JSDoc comment starts with `@swagger`
3. Ensure path matches actual route (e.g., `/api/widget-apps` not `/widget-apps`)

### TypeScript Errors in Generated SDK

**Problem:** TypeScript errors in `/sdk/typescript/`

**Solution:**
1. Ensure your OpenAPI spec is valid: https://editor.swagger.io/
2. Check that all `$ref` references exist in `components.schemas`
3. Regenerate SDK: `npm run generate:sdk`

### Swagger UI Not Loading

**Problem:** http://localhost:3000/docs/api-spec shows blank page

**Solution:**
1. Check browser console for errors
2. Verify `/public/openapi.json` exists
3. Restart Next.js dev server: `npm run dev`
4. Clear browser cache and hard refresh (Ctrl+Shift+R)

### Authentication Not Working in Swagger UI

**Problem:** Can't test authenticated endpoints

**Solution:**
1. Click "Authorize" button in Swagger UI
2. Enter: `Bearer YOUR_TOKEN` (include "Bearer " prefix)
3. Click "Authorize" then "Close"
4. Try the endpoint again

---

## Next Steps

1. **Add more endpoints:** Add `@swagger` JSDoc to your existing API routes
2. **Create shared schemas:** Add reusable schemas to `openapi.config.js`
3. **Generate SDKs:** Share TypeScript/Python SDKs with your customers
4. **Publish docs:** Deploy Swagger UI to production
5. **CI/CD integration:** Auto-generate spec on every commit

---

## Example: Complete API Route with OpenAPI

```typescript
// app/api/analytics/metrics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * @swagger
 * /api/analytics/metrics:
 *   get:
 *     summary: Get analytics metrics
 *     description: |
 *       Retrieve real-time analytics metrics for deployed models.
 *       Supports filtering by model ID, time range, and metric type.
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: model_id
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter metrics by model ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 1000
 *         description: Maximum number of metrics to return
 *       - in: query
 *         name: start_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start of time range (ISO 8601)
 *         example: "2024-01-01T00:00:00Z"
 *     responses:
 *       200:
 *         description: Successfully retrieved metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 42
 *                 metrics:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Metrics'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const model_id = searchParams.get('model_id');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Fetch metrics (example)
    const { data: metrics, error: fetchError } = await supabase
      .from('analytics_metrics')
      .select('*')
      .eq('user_id', user.id)
      .limit(limit);

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch metrics' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: metrics?.length || 0,
      metrics: metrics || [],
    });

  } catch (error) {
    console.error('[Analytics Metrics API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## Resources

- **OpenAPI Specification:** https://swagger.io/specification/
- **Swagger Editor:** https://editor.swagger.io/ (validate your spec)
- **swagger-jsdoc Docs:** https://github.com/Surnet/swagger-jsdoc
- **OpenAPI Generator:** https://openapi-generator.tech/
- **Swagger UI:** https://swagger.io/tools/swagger-ui/

---

## Questions?

If you need help adding OpenAPI docs to your endpoints, check:
1. This guide
2. Existing examples in `/app/api/widget-apps/route.ts`
3. OpenAPI spec at `/public/openapi.json`
4. Swagger UI at http://localhost:3000/docs/api-spec
