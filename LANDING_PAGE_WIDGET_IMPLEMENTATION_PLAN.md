# Landing Page Widget Implementation Plan
**Date:** December 5, 2025  
**Goal:** Integrate lightweight chat widget into landing page for dogfooding/demo purposes  
**Status:** PENDING APPROVAL

---

## 📋 Executive Summary

Integrate the existing lightweight GraphRAG chat widget into the landing page at `/app/landing/page.tsx` to allow visitors to interact with Atlas (fine-tuned Mistral/Qwen 8-14B model) and learn about Fine Tune Lab without requiring authentication.

**Key Decision:** Use the simplest widget implementation (GraphRAGWidget - 60 lines) as the foundation, creating an inline React component wrapper for the landing page.

---

## 🔍 Current State Analysis

### Existing Widget Implementations Found

1. **GraphRAGWidget** (`/public/widget.js` lines 1-60) ✅ **MOST LIGHTWEIGHT**
   - **Size:** ~60 lines
   - **Complexity:** Minimal - just button + iframe toggle
   - **Features:** Floating button, iframe overlay, click-to-toggle
   - **Dependencies:** None - pure vanilla JS
   - **Use Case:** External website embedding

2. **ModelTestingWidget** (`/public/widget.js` lines 62-263)
   - **Size:** ~200 lines
   - **Complexity:** Medium - postMessage API, session tracking
   - **Features:** API key validation, config system, user tracking
   - **Dependencies:** postMessage protocol
   - **Use Case:** Production model testing for companies

3. **FeedbackWidget** (`/public/feedback-widget.js`)
   - **Size:** ~815 lines
   - **Complexity:** High - full feedback UI system
   - **Features:** Ratings, sentiment, tags, modal UI
   - **Dependencies:** Feedback API endpoint
   - **Use Case:** Collecting user feedback

### Widget Architecture (Already Built)

```
External Website                    Fine Tune Lab
┌──────────────────┐              ┌──────────────────────┐
│  widget.js       │    iframe    │  /app/chat/page.tsx  │
│  (Floating btn)  │──────────────▶│  ?widget=true        │
│                  │              │  &model=X            │
└──────────────────┘              │  &session=Y          │
                                   │  &key=Z              │
                                   └──────────────────────┘
```

**URL Parameters for Widget Mode:**
- `widget=true` - Enables widget mode (skips auth)
- `session=<sessionId>` - Unique session identifier
- `model=<modelId>` - Model to use for chat
- `key=<apiKey>` - Widget API key for authentication
- `user=<userId>` (optional) - User identifier for tracking
- `theme=<theme>` (optional) - UI theme (light/dark)

### Chat Page Widget Support

**File:** `/app/chat/page.tsx`
- ✅ Detects widget mode via `?widget=true` parameter
- ✅ Extracts configuration from URL params
- ✅ Skips authentication when `isWidgetMode = true`
- ✅ Passes `widgetConfig` to Chat component
- ✅ Shows loading state while validating

**File:** `/components/Chat.tsx` (line 430)
- ✅ Accepts optional `widgetConfig` prop
- ✅ Handles widget mode detection: `const isWidgetMode = !!widgetConfig`
- ✅ Adjusts UI for widget display

### API Key System (Already Implemented)

**Widget API Key Format:** `wak_` + 32 alphanumeric characters  
**Example:** `wak_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p`

**Validation Flow:**
1. Widget sends `X-API-Key` header with request
2. API validates key format (`/lib/auth/api-key-generator.ts`)
3. API verifies hash against database (`widget_api_keys` table)
4. API extracts `user_id` from key record
5. API creates service role Supabase client (bypasses RLS)

**Files:**
- `/lib/auth/api-key-generator.ts` - Key generation & validation
- `/lib/auth/api-key-validator.ts` - Database validation & rate limiting
- `/app/api/chat/route.ts` (lines 120-200) - Widget mode detection & auth

---

## 🎯 Implementation Plan

### Phase 1: Create EmbeddedChatWidget Component ✅ READY

**Goal:** Create React component wrapper for inline widget display

**File to Create:** `/components/widget/EmbeddedChatWidget.tsx`

**Component Spec:**
```typescript
interface EmbeddedChatWidgetProps {
  title: string;
  subtitle: string;
  defaultModel: string;
  welcomeMessage: string;
  height?: string; // Default: "600px"
  theme?: 'light' | 'dark'; // Default: 'light'
  apiKey?: string; // If not provided, must create demo key
}
```

**Behavior:**
- Renders an iframe pointing to `/app/chat?widget=true&...`
- Inline display (not floating button) - fits within landing page layout
- Generates unique session ID on mount
- Uses provided or demo API key
- Responsive design (mobile-friendly)
- Loading state while iframe loads

**Implementation Strategy:**
```tsx
'use client';

import { useEffect, useState } from 'react';

export function EmbeddedChatWidget({
  title,
  subtitle,
  defaultModel,
  welcomeMessage,
  height = '600px',
  theme = 'light',
  apiKey
}: EmbeddedChatWidgetProps) {
  const [sessionId, setSessionId] = useState<string>('');
  const [iframeUrl, setIframeUrl] = useState<string>('');
  
  useEffect(() => {
    // Generate unique session ID
    const newSessionId = `landing_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setSessionId(newSessionId);
    
    // Build iframe URL
    const params = new URLSearchParams({
      widget: 'true',
      session: newSessionId,
      model: defaultModel,
      key: apiKey || 'DEMO_KEY_PLACEHOLDER', // TODO: Use demo key
      theme: theme
    });
    
    setIframeUrl(`/chat?${params.toString()}`);
  }, [defaultModel, apiKey, theme]);
  
  if (!iframeUrl) {
    return <div className="animate-pulse">Loading chat...</div>;
  }
  
  return (
    <div className="border rounded-lg overflow-hidden shadow-lg">
      <div className="bg-slate-100 dark:bg-slate-800 p-4 border-b">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <iframe
        src={iframeUrl}
        className="w-full"
        style={{ height }}
        allow="clipboard-write"
        title="Fine Tune Lab Chat"
      />
    </div>
  );
}
```

**Dependencies:**
- No new packages required
- Uses existing Next.js router and React hooks
- Leverages existing `/app/chat` widget infrastructure

---

### Phase 2: Configure Demo API Key 🔑 REQUIRED

**Challenge:** Landing page needs widget API key for authentication

**Options:**

#### Option A: Create Dedicated Demo User & API Key (RECOMMENDED)
**Pros:**
- Proper separation of concerns
- Can track demo usage separately
- Can set rate limits for demo users
- Secure and production-ready

**Cons:**
- Requires manual setup once
- Need to protect demo key (env variable)

**Steps:**
1. Create demo user account in Supabase (email: `demo@finetunelab.ai`)
2. Generate widget API key via `/app/api/user/api-keys` endpoint
3. Store in environment variable: `NEXT_PUBLIC_DEMO_WIDGET_API_KEY`
4. Use in EmbeddedChatWidget component

#### Option B: Public Guest Mode (ALTERNATIVE)
**Pros:**
- No API key needed
- Simpler implementation

**Cons:**
- Requires new "guest mode" logic in API
- Less secure
- Harder to track/rate-limit demo usage
- More code changes

**Recommendation:** Use Option A - it's cleaner and uses existing infrastructure.

---

### Phase 3: Update Landing Page ✏️ SIMPLE

**File to Modify:** `/app/landing/page.tsx`

**Changes Required:**

1. **Remove non-existent import** (line 6):
   ```tsx
   // REMOVE THIS:
   import { EmbeddedChatWidget } from '@/components/widget/EmbeddedChatWidget';
   
   // REPLACE WITH (after creating component):
   import { EmbeddedChatWidget } from '@/components/widget/EmbeddedChatWidget';
   ```

2. **Update widget usage** (lines 92-97):
   ```tsx
   // CURRENT (broken):
   <EmbeddedChatWidget 
     title="Chat with Fine Tune Lab"
     subtitle="Ask me anything about model fine-tuning, features, or pricing"
     defaultModel="gpt-4o-mini"
     welcomeMessage="👋 Hi! I'm here to help you learn about Fine Tune Lab..."
   />
   
   // NEW (with demo key and Atlas model):
   <EmbeddedChatWidget 
     title="Talk to Atlas - Our AI Assistant"
     subtitle="Ask me anything about Fine Tune Lab, model fine-tuning, or pricing"
     defaultModel="your-finetuned-mistral-or-qwen-model-id"
     welcomeMessage="👋 Hi! I'm Atlas, Fine Tune Lab's AI assistant. Ask me anything!"
     height="700px"
     theme="light"
   />
   ```

**Note:** You mentioned serving a fine-tuned Mistral or Qwen 8-14B model. We need the model ID from your deployment to use here.

---

### Phase 4: Environment Configuration 🔧 SIMPLE

**File to Modify:** `.env.local` (or `.env`)

**Add:**
```bash
# Demo Widget API Key for Landing Page
NEXT_PUBLIC_DEMO_WIDGET_API_KEY=wak_your_demo_key_here_32_chars
```

**Security Note:** This is a `NEXT_PUBLIC_` variable, meaning it's exposed in browser. This is acceptable because:
1. The key is for demo purposes only
2. Rate limiting protects against abuse
3. Key can be revoked/rotated if needed
4. Tracks usage under demo account (not production data)

---

## 🔒 Security Considerations

### Rate Limiting (Already Implemented)
- Widget API keys have built-in rate limiting
- Defined in `/lib/auth/api-key-validator.ts`
- Default limits prevent abuse

### RLS (Row Level Security)
- Widget mode uses service role client (bypasses RLS)
- Conversations marked with `is_widget_session: true`
- Demo user has separate context from production users

### API Key Protection
- Demo key stored in env variable (not hardcoded)
- Can be rotated if compromised
- Monitored via analytics

---

## 📊 Files Affected

### New Files (1)
- ✅ `/components/widget/EmbeddedChatWidget.tsx` - Widget component wrapper

### Modified Files (2)
- ✅ `/app/landing/page.tsx` - Update widget import and props
- ✅ `.env.local` - Add demo API key

### Existing Files (No Changes Required)
- `/public/widget.js` - Keep as-is (external embedding)
- `/app/chat/page.tsx` - Already supports widget mode
- `/components/Chat.tsx` - Already handles widgetConfig
- `/app/api/chat/route.ts` - Already validates widget API keys

---

## ✅ Verification Steps

### After Implementation
1. ✅ Dev server starts without errors
2. ✅ Navigate to `/landing` - page loads without breaking
3. ✅ Widget iframe appears in demo section
4. ✅ Chat interface loads inside iframe
5. ✅ Can send messages and receive responses
6. ✅ Messages use correct model (Atlas - your fine-tuned model)
7. ✅ No authentication required
8. ✅ Session tracked separately in database
9. ✅ Landing page responsive on mobile
10. ✅ No console errors

### Database Verification
```sql
-- Check demo conversations are being created
SELECT id, title, is_widget_session, created_at
FROM conversations
WHERE is_widget_session = true
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🚨 Potential Issues & Mitigations

### Issue 1: Model ID Unknown
**Problem:** You haven't deployed Atlas model yet  
**Mitigation:** Use `gpt-4o-mini` temporarily until model is deployed

### Issue 2: Demo API Key Not Created
**Problem:** No demo user/key exists yet  
**Mitigation:** Create demo account manually, generate key, add to env

### Issue 3: CORS or iframe blocking
**Problem:** Browser blocks iframe  
**Mitigation:** Same-origin iframe (no CORS issues)

### Issue 4: Widget doesn't fit on mobile
**Problem:** Fixed height breaks on small screens  
**Mitigation:** Use responsive height (vh units) or min-height

---

## 🎨 UI/UX Enhancements (Future)

### Phase 2 Enhancements (After MVP)
- Add welcome animation
- Pre-populate suggested questions ("Ask about pricing", "How to fine-tune?")
- Add typing indicators
- Show "Powered by Fine Tune Lab" badge
- Add feedback buttons in widget
- Track analytics (messages sent, topics asked)

---

## 📝 Testing Checklist

- [ ] Component compiles without TypeScript errors
- [ ] Landing page renders without breaking
- [ ] Widget iframe loads successfully
- [ ] Chat interface visible inside iframe
- [ ] Can send and receive messages
- [ ] Messages use correct model
- [ ] Session ID generated correctly
- [ ] API key validation works
- [ ] Rate limiting prevents spam
- [ ] Mobile responsive
- [ ] Dark mode support (if enabled)
- [ ] Console has no errors
- [ ] Database tracks widget sessions

---

## 🔄 Rollback Plan

If implementation fails:
1. Revert `/app/landing/page.tsx` to remove widget component
2. Delete `/components/widget/EmbeddedChatWidget.tsx`
3. Remove demo API key from `.env.local`
4. No database changes needed (widget sessions self-contained)

---

## 📈 Success Metrics

### Immediate (Post-Deploy)
- Widget loads successfully on landing page
- Users can interact with Atlas
- No console errors
- Mobile responsive

### Short-term (Week 1)
- Track number of landing page widget sessions
- Measure engagement (messages per session)
- Monitor common questions asked
- Identify any UX issues

### Long-term (Month 1)
- Conversion rate (landing page → signup)
- Demo quality (thumbs up/down if implemented)
- Most asked topics (guide content strategy)

---

## ❓ Questions for You

Before proceeding with implementation:

1. **Model Configuration:**
   - What's the model ID for your fine-tuned Mistral/Qwen model?
   - Is it deployed yet? If not, should we use `gpt-4o-mini` as fallback?

2. **Demo API Key:**
   - Do you already have a demo user account?
   - Should I generate the API key creation steps, or do you want to do it manually?

3. **Styling:**
   - Any specific height preference for the widget? (Current plan: 700px)
   - Any custom branding/colors for the widget header?

4. **Features:**
   - Do you want suggested starter questions displayed?
   - Should we add a "Powered by Fine Tune Lab" badge?

---

## 🚀 Ready to Proceed?

**Once you approve:**
1. I'll create `/components/widget/EmbeddedChatWidget.tsx`
2. Update `/app/landing/page.tsx` with correct model ID
3. Provide instructions for demo API key creation
4. Test the implementation
5. Verify no breaking changes

**Estimated Time:** 15-20 minutes

**Risk Level:** LOW
- Using existing widget infrastructure
- No breaking changes to other files
- Easy rollback if needed

---

**AWAITING YOUR APPROVAL TO PROCEED** ✋

Please answer the questions above, and I'll implement the solution.
