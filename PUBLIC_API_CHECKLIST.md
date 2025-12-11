# Public API Documentation Checklist

Critical endpoints that external customers/users can access.

## ✅ Documented (In OpenAPI Spec)

- [x] **POST** `/api/widget-apps` - Create widget app
- [x] **GET** `/api/widget-apps` - List widget apps
- [x] **POST** `/api/batch-testing/run` - Run batch tests
- [x] **GET** `/api/analytics/data` - Get analytics metrics

---

## 🔄 High Priority (Need JSDoc)

### Batch Testing APIs
- [ ] **POST** `/api/batch-testing/extract` - Extract prompts from conversations
- [ ] **GET** `/api/batch-testing/status/[id]` - Get batch test status
- [ ] **POST** `/api/batch-testing/cancel` - Cancel running batch test

### Analytics APIs (Headless - No UI Required)
- [ ] **GET** `/api/analytics/traces` - Get trace/log data
- [ ] **GET** `/api/analytics/sentiment/insights` - Sentiment analysis insights
- [ ] **GET** `/api/analytics/anomalies` - Detect anomalies in model behavior
- [ ] **GET** `/api/analytics/sentiment/trends` - Sentiment trends over time

### Model Management
- [ ] **GET** `/api/models` - List registered models
- [ ] **POST** `/api/models` - Register new model
- [ ] **DELETE** `/api/models/[id]` - Delete model
- [ ] **POST** `/api/models/test-connection` - Test model API connection

### Inference/Deployment
- [ ] **POST** `/api/inference/deploy` - Deploy model to production
- [ ] **GET** `/api/inference/deployments/[id]/status` - Get deployment status
- [ ] **DELETE** `/api/inference/deployments/[id]/stop` - Stop deployment

---

## 📋 Medium Priority

### Widget Apps (Extended)
- [ ] **GET** `/api/widget-apps/[id]` - Get widget app details
- [ ] **PUT** `/api/widget-apps/[id]` - Update widget app
- [ ] **DELETE** `/api/widget-apps/[id]` - Delete widget app

### Analytics (Extended)
- [ ] **GET** `/api/analytics/cohorts` - List user cohorts
- [ ] **GET** `/api/analytics/cohorts/[id]/metrics` - Cohort-specific metrics
- [ ] **GET** `/api/analytics/benchmark-analysis` - Benchmark comparisons
- [ ] **GET** `/api/analytics/model-comparison` - Compare model performance

### Chat/Conversations (If public-facing)
- [ ] **POST** `/api/chat` - Send chat message (for widget users)

---

## 🔧 How to Add More Endpoints

1. **Pick an endpoint** from the list above
2. **Add JSDoc comments** to the route file (see examples in `/app/api/widget-apps/route.ts`)
3. **Regenerate spec**: `npm run generate:openapi`
4. **Test in Swagger UI**: http://localhost:3000/docs/api-spec

### Example Template:

```typescript
/**
 * @swagger
 * /api/your-endpoint:
 *   post:
 *     summary: Brief description
 *     description: Detailed description with use cases
 *     tags:
 *       - Tag Name
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *                 example: "value"
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
export async function POST(req: NextRequest) {
  // Your implementation
}
```

---

## 📖 Documentation Resources

- **OpenAPI Guide**: `/OPENAPI_GUIDE.md`
- **Example with JSDoc**: `/app/api/widget-apps/route.ts`
- **Example with JSDoc**: `/app/api/batch-testing/run/route.ts`
- **Example with JSDoc**: `/app/api/analytics/data/route.ts`
- **Swagger UI**: http://localhost:3000/docs/api-spec
- **OpenAPI Spec**: `/public/openapi.json`

---

## 🎯 Goal

Document **all public-facing endpoints** that:
- External customers use
- Can be embedded in user applications
- Don't require the full UI
- Are part of your widget/monitoring/analytics offering

Internal-only routes (used by your frontend) can be documented later or separately.
