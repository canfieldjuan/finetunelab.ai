# Landing Page Redesign Plan
## From Sales Page to Authority Platform

**Date**: January 2, 2026
**Goal**: Transform from sales-focused landing page to knowledge transfer platform that demonstrates domain expertise
**Key Insight**: Show, don't sell. Let the demo prove our value.

---

## Core Positioning Shift

### Old Approach (Sales Page):
- "Buy our product!"
- Feature lists
- Generic benefits
- Traditional CTAs

### New Approach (Authority + Knowledge Transfer):
- "We understand LLM operations deeply - let us show you"
- Demonstrate expertise through insights
- Show real value through embedded demo
- Seamless transition to demo page for hands-on experience

---

## Supported Providers (For Demo):

1. **Together.ai** - `https://api.together.xyz/v1/chat/completions`
2. **Fireworks.ai** - `https://api.fireworks.ai/inference/v1/chat/completions`
3. **OpenRouter** - `https://openrouter.ai/api/v1/chat/completions`
4. **Groq** - `https://api.groq.com/openai/v1/chat/completions`
5. **vLLM (Self-hosted)** - `http://localhost:8000/v1/chat/completions`
6. **Ollama (Local)** - `http://localhost:11434/v1/chat/completions`
7. **Custom OpenAI-compatible endpoints**

---

## Demo Flow (6-Step Guided Process):

1. **Welcome** - Intro to BYOM testing
2. **Task Selection** - Choose domain (Customer Support, Code Generation, Q&A, Creative)
3. **Model Config** - Connect your model (provider select, endpoint, API key)
4. **Batch Test** - Run 10 pre-defined prompts
5. **Atlas Chat** - Chat with AI assistant about traces (10 question limit)
6. **Analytics** - View traces + 3 charts + Export (CSV/JSON)

**Current Limitation**: After 10-question limit, charts are grayed out
**New Requirement**: Show REAL metrics in charts (more value = better conversion)

---

## New Landing Page Structure

### Section 1: Hero - Demo-First Approach

**Headline**:
```
See Your LLM in Action. Right Now.
```

**Subheadline**:
```
Plug in your model. Run 10 test prompts. Get live traces, cost analysis, and quality scores.
No signup. Takes 2 minutes.
```

**Primary CTA**:
```
[Try Your Model Now →]
```
(Goes directly to `/demo/test-model`)

**Visual**:
- Option A: Embedded demo iframe (if feasible)
- Option B: Animated demo preview with "Launch Demo" button
- Option C: Side-by-side split: left = form (provider select, endpoint, API key), right = preview of results

**Supporting Text**:
```
Supported: Together.ai, Fireworks, OpenRouter, Groq, vLLM, Ollama, and any OpenAI-compatible endpoint
```

**Secondary CTA** (below fold):
```
↓ Or see why teams are ditching their duct-taped LLM stacks ↓
```

---

### Section 2: The Fragmentation Problem

**Headline**:
```
Building LLMs Today Means Juggling 8+ Tools
```

**Visual**: Chaotic diagram showing disconnected tools
```
MLflow ──────┐
W&B ─────────┤
Custom Scripts├──→ [Your Model] ──→ Production ???
Jupyter ─────┤
CloudWatch ──┘

Slack (for versioning!)
Datadog (for monitoring)
Postman (for testing)
```

**3-Column Pain Points**:

| **For Developers** | **For Users/QA** | **For Teams** |
|-------------------|------------------|---------------|
| Context switching kills flow | Can't test models easily | Tribal knowledge required |
| Debugging across 5+ platforms | Need developer to run tests | Unclear what's in prod |
| Custom glue code everywhere | No visibility into quality | Slow iteration cycles |

**CTA**: "There's a better way ↓"

---

### Section 3: One Platform, Entire Lifecycle

**Headline**:
```
What If It Was All in One Place?
```

**Bento Grid Layout** (showcasing unified workflow):

```
┌──────────────────────────────────────────────────────┐
│  [LARGE CARD - Top Row, Full Width]                 │
│  🎯 Production-Like Testing Playground              │
│  Screenshot: Chat interface with live trace panel   │
│  "Test your model like your users will use it.     │
│   No developer tools. Just conversation."          │
├───────────────────────┬──────────────────────────────┤
│  [CARD]               │  [CARD]                      │
│  📊 Live Traces       │  💰 Instant Cost Analysis   │
│  Screenshot: Trace    │  Screenshot: Cost dashboard │
│  viewer               │                             │
│  "See every call,     │  "Know what each            │
│   every token,        │   conversation costs.       │
│   every decision"     │   Before deploying."        │
├───────────────────────┼──────────────────────────────┤
│  [CARD]               │  [CARD]                      │
│  ✅ Quality Scoring   │  📈 Training & Fine-Tuning  │
│  "LLM-as-judge built  │  "Upload data. Click train. │
│   in. No setup."      │   Monitor. Deploy."         │
├───────────────────────┴──────────────────────────────┤
│  [CARD - Bottom Row, Full Width]                    │
│  🔄 Automatic Versioning & Production Monitoring    │
│  "Everything tracked. Nothing lost in Slack."       │
└──────────────────────────────────────────────────────┘
```

---

### Section 4: Test Like Users, Not Developers

**Headline**:
```
Postman is for APIs. Your Users Use Chat.
```

**Split Comparison**:

**Left Side - "How Devs Test Today":**
```
❌ Postman with JSON payloads
❌ curl commands in terminal
❌ Custom test scripts
❌ Jupyter notebooks

Result: You test like a developer.
Your users experience something different.
Quality issues slip through.
```

**Right Side - "How You Should Test":**
```
✅ Dedicated chat playground
✅ Multi-turn conversations
✅ Upload files, send images
✅ Test edge cases interactively

Result: You test exactly how users will use it.
Catch issues before deployment.
Ship with confidence.
```

**Screenshot**: Playground showing:
- Clean chat interface
- Live trace panel on side
- Quality scores appearing
- Cost ticking up in real-time

---

### Section 5: The 2-Minute Model Health Check

**Headline**:
```
See Your Model's Blind Spots in 2 Minutes
```

**Visual Step-by-Step**:

**Step 1: Connect Your Model** (15 seconds)
```
├─ Select Provider: [Together.ai ▼]
├─ Endpoint: https://api.together.xyz/v1/chat/completions
└─ API Key: ••••••••••••

Works with: Together, Fireworks, OpenRouter, Groq,
vLLM, Ollama, or any OpenAI-compatible endpoint
```

**Step 2: Run the Test Suite** (30 seconds)
```
We send 10 carefully designed prompts:
- Edge cases
- Ambiguous queries
- Multi-turn conversations
- Common failure modes

Or write your own.
```

**Step 3: Watch Live Traces** (1 minute)
```
See in real-time:
├─ Token usage per message
├─ Cost per conversation
├─ Latency breakdown
├─ Quality scoring
└─ Error detection
```

**Step 4: Get Your Report** (30 seconds)
```
├─ Total cost projection
├─ Performance bottlenecks
├─ Quality score distribution
├─ Recommended optimizations
└─ Export as CSV/JSON
```

**CTA**:
```
[Try It With Your Model →]
```

---

### Section 6: From Testing to Production

**Headline**:
```
That Was Just Testing. Here's Everything Else.
```

**Horizontal Scrollable "Belt"** of features:

```
[Playground Testing] → [Dataset Upload] → [Fine-Tuning Jobs] →
[Model Versioning] → [Evaluation Suite] → [One-Click Deploy] →
[Production Monitoring] → [Cost Analytics] → [Team Collaboration]
```

Each card shows:
- Icon
- Feature name
- Screenshot thumbnail
- "Before" (what devs do today) vs "After" (what you'll do)

**Example Card - Model Versioning**:
```
┌────────────────────────────────┐
│ 🔄 Model Versioning            │
├────────────────────────────────┤
│ Before:                        │
│ - Git tags for model references│
│ - Slack: "What's in staging?"  │
│ - Manual spreadsheet tracking  │
│                                │
│ After:                         │
│ - Click "Deploy v2.1"          │
│ - Timeline of all versions     │
│ - Rollback in one click        │
└────────────────────────────────┘
```

---

### Section 7: Democratizing Production-Quality LLMs

**Headline**:
```
Your Junior Developer Can Ship Production Models on Day One
```

**Subheadline**:
```
We removed the guessing, technical debt, and tribal knowledge.
If you can click, you can build production LLMs.
```

**Interactive Comparison**:

**Without FineTune Lab (Senior Dev Required)**:
```
1. Set up MLflow tracking
2. Write custom evaluation scripts
3. Configure monitoring pipelines
4. Debug across 5 platforms
5. Document in Slack/Notion
6. Pray it works in prod

→ Weeks, senior-dev-only work
```

**With FineTune Lab (Anyone Can Do It)**:
```
1. Upload dataset
2. Click "Train"
3. Review quality scores
4. Click "Deploy"
5. Monitor in same UI

→ Hours, any skill level
```

---

### Section 8: No Migration Needed

**Headline**:
```
Already Have Infrastructure? Keep It.
```

**3 Cards**:

| **Existing Data** | **Current Monitoring** | **Your Code** |
|------------------|----------------------|---------------|
| "Don't move your datasets. Connect them." | "Keep your observability tools. We integrate." | "Works with your existing LLM calls. Drop in our SDK." |

---

### Section 9: Ready to See It In Action?

**Final CTA Section - Three Paths**:

**Path 1: Try the Demo** (primary)
```
┌────────────────────────────────┐
│  🎮 Try Your Model Now         │
│  Test with real data           │
│  No signup required            │
│  Takes 2 minutes               │
│                                │
│  [Launch Demo →]               │
└────────────────────────────────┘
```

**Path 2: Get Full Platform** (secondary)
```
┌────────────────────────────────┐
│  🚀 Start Building             │
│  Full platform access          │
│  Free during beta              │
│                                │
│  [Sign Up →]                   │
└────────────────────────────────┘
```

**Path 3: Talk to Us** (tertiary)
```
┌────────────────────────────────┐
│  💬 Book a Walkthrough         │
│  30-min demo with your data    │
│  Questions answered live       │
│                                │
│  [Book a Call →]               │
└────────────────────────────────┘
```

---

## Tone & Voice Guidelines

**✅ DO:**
- **Direct**: "No Slack needed."
- **Confident**: "Where it should have been from the start."
- **Practical**: "Just makes sense."
- **Accessible**: "If you can click, you can build."
- **Authoritative**: "We've analyzed 10M+ traces. Here's what we learned."

**❌ DON'T:**
- **Hype**: "Revolutionary platform!"
- **Vague**: "Streamline your workflow"
- **Salesy**: "Limited time offer!"
- **Jargon-heavy**: "Leverage synergies across..."

---

## Example Copy Blocks

### Hero Variation 1:
```
Your LLM Stack Shouldn't Require 8 Tools and a PhD

FineTune Lab is the all-in-one platform for building, deploying,
and improving production LLM systems.

Experiments. Fine-tuning. Evaluation. Monitoring. Versioning.
All in one UI. As it should be.

[See It In Action →]
```

### Hero Variation 2:
```
Stop Duct-Taping Your LLM Stack Together

One platform for the entire lifecycle:
Experiments → Fine-tuning → Evaluation → Production → Monitoring

No migrations. No Slack threads. No guessing.
Just build, deploy, and improve.

[Try Your Model Now →]
```

### Feature Callout Example:
```
Automatic Model Versioning
─────────────────────────
Every training run, every deployment, every change - tracked automatically.
No Git tags. No Slack threads asking "what's in prod?"
Just a timeline showing exactly what changed and when.

It just makes sense.
```

### Democratization Message:
```
If your junior dev can't ship a production model,
your tools are the problem - not your team.

We built FineTune Lab so anyone on your team can:
- Upload data
- Train models
- Evaluate quality
- Deploy to production
- Monitor performance

No guessing. No tribal knowledge. No senior dev bottleneck.
```

---

## Technical Implementation Notes

### Demo Integration Options:

**Option A: Iframe Embed** (if feasible)
```tsx
<iframe
  src="/demo/test-model?embedded=true"
  className="w-full h-[600px] border rounded-lg"
/>
```

**Option B: Inline Form**
```tsx
// Render simplified version of ModelConfigForm directly in hero
// On submit → redirect to full demo with pre-filled values
```

**Option C: Visual Preview with CTA**
```tsx
// Animated screenshot/video of demo
// "Launch Demo" button opens /demo/test-model in same tab
```

### Chart Enhancement (Post 10-Question Limit):

**Current**: Charts grayed out after 10 questions in Atlas Chat
**New**: Show real metrics even after limit

**Implementation**:
```tsx
// In DemoBatchAnalytics component
// Remove conditional that grays out charts
// Always show: latency distribution, success rate, cost breakdown

// Instead of graying out, add subtle overlay:
"Want to explore more? [Sign up for free →]"
```

---

## File Structure Changes

### New Files to Create:
```
components/landing/
├── sections/
│   ├── HeroDemo.tsx          (New - Demo-first hero)
│   ├── FragmentationProblem.tsx (New - Show the pain)
│   ├── UnifiedPlatform.tsx   (New - Bento grid showcase)
│   ├── TestLikeUsers.tsx     (New - Playground highlight)
│   ├── TwoMinuteCheck.tsx    (New - Demo walkthrough)
│   ├── FullPlatform.tsx      (New - Feature belt)
│   ├── Democratization.tsx   (New - Jr dev = Sr dev)
│   ├── NoMigration.tsx       (New - Keep your stack)
│   └── FinalCTA.tsx          (New - Three-path CTA)
```

### Files to Modify:
```
components/landing/LandingPage.tsx  (Update section order)
components/demo/DemoBatchAnalytics.tsx (Show charts after limit)
```

### Files to Potentially Remove:
```
components/landing/Comparison.tsx   (Redundant with new sections)
components/landing/Pricing.tsx      (Move to /pricing page)
components/landing/FAQ.tsx          (Move to /faq page)
```

---

## Success Metrics

### Conversion Goals:
1. **Demo Engagement**: % of visitors who click "Try Your Model Now"
2. **Demo Completion**: % who complete all 6 steps
3. **Demo Export**: % who download CSV/JSON report
4. **Sign-Up Conversion**: % who sign up after demo
5. **Time on Page**: Increased engagement vs current sales page

### A/B Test Hypotheses:
1. Demo-first hero > Traditional hero
2. Authority positioning > Feature lists
3. Real demo > Demo video/screenshots
4. Three-path CTA > Single CTA

---

## Rollout Plan

### Phase 1: Core Redesign (Week 1)
- [ ] Create new section components
- [ ] Update LandingPage component structure
- [ ] Ensure demo page works standalone
- [ ] Test demo embed options

### Phase 2: Polish & Optimize (Week 2)
- [ ] Add animations/interactions
- [ ] Optimize for mobile
- [ ] Add analytics tracking
- [ ] SEO optimization

### Phase 3: A/B Testing (Week 3+)
- [ ] Set up A/B test framework
- [ ] Test variations
- [ ] Measure conversion rates
- [ ] Iterate based on data

---

## Questions to Address Before Building:

1. **Demo Embed**: Should we embed the demo inline or link to `/demo/test-model`?
2. **Chart Unlock**: After 10 questions, show all charts or keep some locked?
3. **Export CTA**: Where should "Export Report" CTA lead after demo?
4. **Pricing**: Keep on landing page or move to separate `/pricing` route?
5. **FAQ**: Keep on landing page or move to separate `/faq` route?
6. **Target Audience**: Primary = developers? Or also product managers/founders?

---

**Ready to build!** 🚀
