# SEO Implementation Plan - FineTuneLab.ai
**Created:** 2026-01-02  
**Status:** Awaiting Approval  
**Goal:** Improve traditional SEO + AI SEO (GEO) for ChatGPT/Perplexity visibility

---

## Executive Summary

This plan implements a comprehensive SEO strategy balancing traditional Google rankings with AI search engine optimization (GEO) for ChatGPT, Perplexity, and other LLM-based search tools. All changes are phased, non-breaking, and build on existing infrastructure.

### Current State Analysis

**✅ What's Working:**
- Basic schema.org markup (Organization, SoftwareApplication, FAQ)
- Sitemap with dynamic content from lab-notes and academy
- robots.txt properly configured
- Good metadata structure in layout.tsx
- Existing SEO config in `/lib/seo/config.ts`

**🔴 Critical Gaps:**
- No llms.txt file for AI crawlers (2025/2026 standard)
- Missing comparison/alternative pages (high-intent keywords)
- No Dataset schema for training data
- Limited long-tail keyword targeting
- No HowTo schema for tutorials
- Missing internal linking strategy
- No performance optimization plan for Core Web Vitals

---

## Phase 1: Quick Wins (1-2 days) - AI SEO Foundation

### 1.1 Create llms.txt File ⭐ CRITICAL
**Location:** `public/llms.txt`  
**Purpose:** Tell AI crawlers what FineTuneLab does  
**Impact:** HIGH - Makes platform discoverable by ChatGPT/Perplexity

**Implementation:**
```markdown
# FineTuneLab.ai - LLM Fine-Tuning Platform

## Overview
FineTuneLab is a complete platform for fine-tuning and deploying large language models with production monitoring.

## Core Capabilities
- Visual DAG-based AI training workflows (no shell scripts)
- Fine-tune Llama 3, Mistral, Qwen with LoRA/QLoRA, DPO, RLHF
- Real-time training metrics via WebSocket
- GraphRAG knowledge graph integration (Neo4j)
- Automated LLM-as-Judge evaluation
- Batch testing and A/B model comparison
- RunPod cloud GPU integration
- Production monitoring and drift detection

## Key Features
- Training: SFT, DPO, RLHF, ORPO with Unsloth acceleration
- Monitoring: Real-time telemetry, GPU memory tracking, prediction tracking
- Testing: Batch evaluation, model comparison, automated scoring
- Deployment: One-click RunPod Serverless, vLLM support
- Analytics: Export CSV/JSON/PDF, anomaly detection, cost tracking

## Documentation
- Getting Started: https://finetunelab.ai/lab-academy
- API Docs: https://finetunelab.ai/docs
- Case Studies: https://finetunelab.ai/case-studies
- Technical Blog: https://finetunelab.ai/lab-notes

## Pricing
- Pro: $297/month (unlimited training, pay RunPod for GPU)
- Pro Plus: $497/month (team features)
- Enterprise: $997+/month (custom SLA, dedicated support)
- Free Trial: 15 days, no credit card

## Support
- Email: support@finetunelab.ai
- Documentation: https://finetunelab.ai/docs
- GitHub: https://github.com/finetunelab
```

**Files to Create:**
- `public/llms.txt`

**Verification:**
- Check https://finetunelab.ai/llms.txt loads correctly
- Validate markdown formatting

---

### 1.2 Add Dataset Schema Markup
**Location:** `lib/seo/config.ts`  
**Purpose:** Help search engines understand training data capabilities  
**Impact:** MEDIUM-HIGH - Better visibility for "dataset" queries

**Implementation:**
Add new schema generator function:

```typescript
/**
 * Generate Dataset schema for training data
 * Helps with "training dataset" and "fine-tuning data" queries
 */
export function generateDatasetSchema(dataset: {
  name: string;
  description: string;
  format: string;
  size?: number;
  examples?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": dataset.name,
    "description": dataset.description,
    "encodingFormat": dataset.format,
    "variableMeasured": "Training examples for LLM fine-tuning",
    "distribution": {
      "@type": "DataDownload",
      "encodingFormat": dataset.format,
      "contentSize": dataset.size ? `${dataset.size} examples` : undefined
    }
  };
}
```

**Files to Modify:**
- `lib/seo/config.ts` (add function)
- Implement in dataset-related pages later (Phase 2)

---

### 1.3 Update Robots.txt for AI Crawlers
**Location:** `public/robots.txt`  
**Purpose:** Ensure AI crawlers find llms.txt  
**Impact:** LOW - Helper for AI discovery

**Implementation:**
Add to existing `public/robots.txt`:

```txt
# AI Search Engines
User-agent: GPTBot
User-agent: ChatGPT-User
User-agent: PerplexityBot
Allow: /

# LLM-specific resource
Allow: /llms.txt
```

**Files to Modify:**
- `public/robots.txt` (append)

---

## Phase 2: High-Intent Keywords (3-5 days) - Comparison Pages

### 2.1 Create "Alternatives" Directory Structure
**Location:** `app/alternatives/`  
**Purpose:** Capture "FineTuneLab vs X" searches  
**Impact:** HIGH - High-intent B2B searches

**Pages to Create:**
1. `/alternatives/weights-and-biases` - vs W&B
2. `/alternatives/langsmith` - vs LangSmith  
3. `/alternatives/airflow` - vs Airflow for AI
4. `/alternatives/mlflow` - vs MLflow
5. `/alternatives` - Hub page listing all comparisons

**Template Structure:**
```typescript
// app/alternatives/[competitor]/page.tsx
export const metadata: Metadata = {
  title: "FineTuneLab vs [Competitor] - Complete Comparison 2026",
  description: "Compare FineTuneLab to [Competitor]: Features, pricing, visual DAG workflows, closed-loop monitoring. See why teams choose FineTuneLab for LLM fine-tuning.",
  keywords: [
    "finetunelab vs [competitor]",
    "[competitor] alternative",
    "llm fine-tuning platform comparison",
    "visual dag vs [competitor approach]"
  ]
};
```

**Content Sections:**
- Overview comparison table
- Feature-by-feature breakdown
- Pricing comparison
- Visual DAG advantage (unique selling point)
- Closed-loop monitoring advantage
- Use case fit
- Migration guide
- FAQ schema

**Files to Create:**
- `app/alternatives/page.tsx` (hub)
- `app/alternatives/weights-and-biases/page.tsx`
- `app/alternatives/langsmith/page.tsx`
- `app/alternatives/airflow/page.tsx`
- `app/alternatives/mlflow/page.tsx`
- `components/alternatives/ComparisonTable.tsx` (reusable)
- `components/alternatives/FeatureComparison.tsx` (reusable)

---

### 2.2 Create "How-To" Content Pages
**Location:** `app/lab-academy/tutorials/`  
**Purpose:** Target "how to" searches with HowTo schema  
**Impact:** HIGH - Tutorial searches have high intent

**Priority Tutorials:**
1. `/lab-academy/tutorials/monitor-llm-drift-production`
2. `/lab-academy/tutorials/fine-tune-llama3-qlora`
3. `/lab-academy/tutorials/setup-graphrag-knowledge-graph`
4. `/lab-academy/tutorials/batch-test-models-judge`
5. `/lab-academy/tutorials/deploy-runpod-serverless`

**Implementation:**
Each tutorial page includes HowTo schema:

```typescript
const tutorialSteps = [
  { name: "Upload training dataset", text: "Prepare JSONL with instruction/response pairs..." },
  { name: "Select base model", text: "Choose Llama 3, Mistral, or Qwen from HuggingFace..." },
  { name: "Configure LoRA parameters", text: "Set rank=16, alpha=32, dropout=0.05..." },
  // ...
];

<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ 
    __html: JSON.stringify(generateHowToSchema({
      name: "How to Monitor LLM Drift in Production",
      description: "Step-by-step guide...",
      totalTime: "PT15M",
      steps: tutorialSteps
    }))
  }}
/>
```

**Files to Create:**
- `app/lab-academy/tutorials/page.tsx` (hub)
- Individual tutorial pages (5 listed above)
- May leverage existing `lib/academy/content.ts` structure

---

## Phase 3: Technical SEO (2-3 days) - Performance & Structure

### 3.1 Optimize Core Web Vitals
**Target Metrics:**
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms  
- CLS (Cumulative Layout Shift): < 0.1

**Implementation Tasks:**

**3.1.1 Image Optimization**
- Convert PNG assets to WebP
- Add proper width/height to prevent CLS
- Implement lazy loading for below-fold images
- Use Next.js Image component everywhere

**Files to Audit:**
- `public/` directory images
- All components using `<img>` tags

**3.1.2 JavaScript Optimization**
- Defer non-critical JavaScript
- Code-split large components
- Preload critical CSS
- Remove unused dependencies

**Files to Check:**
- `package.json` (depcheck audit)
- `next.config.ts` (bundle analyzer)

**3.1.3 Atlas Assistant Optimization**
- Lazy load Atlas chat widget
- Only initialize on user interaction
- Reduce initial bundle size

**Files to Modify:**
- Components loading Atlas assistant
- Consider dynamic imports

---

### 3.2 Implement Internal Linking Strategy
**Purpose:** Connect content, improve crawlability, pass authority  
**Impact:** MEDIUM - Helps search engines understand site structure

**Implementation:**

**3.2.1 Add Contextual Links**
Blog posts → Pricing pages with descriptive anchors:
```tsx
// In tutorial/blog content
Learn more about our <Link href="/upgrade">Pro Plus team features</Link> 
that solve orchestration hell.

Deploy with confidence using our <Link href="/features">
production monitoring dashboard</Link>.
```

**3.2.2 Breadcrumb Navigation**
Add breadcrumbs with schema to all content pages:

```tsx
// In lab-academy/[slug]/page.tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ 
    __html: JSON.stringify(generateBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Academy", path: "/lab-academy" },
      { name: article.title, path: `/lab-academy/${article.slug}` }
    ]))
  }}
/>
```

**Files to Modify:**
- `app/lab-academy/[slug]/page.tsx`
- `app/lab-notes/[slug]/page.tsx`
- `app/case-studies/[slug]/page.tsx` (if exists)
- `components/layout/Breadcrumbs.tsx` (create)

**3.2.3 Related Content Links**
Add "Related Articles" section to blog posts using:
- Tag similarity
- Category matching
- Manual curation

---

### 3.3 Add Canonical Tags & Social Meta
**Purpose:** Prevent duplicate content, improve social sharing  
**Impact:** MEDIUM - Better indexing, richer social previews

**Implementation:**

**3.3.1 Canonical Tags**
Already partially implemented in layout.tsx via metadataBase.
Verify all pages have explicit canonical:

```typescript
// In page metadata
export const metadata: Metadata = {
  // ...existing
  alternates: {
    canonical: `/lab-academy/${slug}`
  }
};
```

**3.3.2 Enhanced Open Graph**
Add images to all content pages:

```typescript
openGraph: {
  title: "...",
  description: "...",
  type: "article",
  images: [
    {
      url: `${siteConfig.url}/og-images/${slug}.png`,
      width: 1200,
      height: 630,
      alt: article.title
    }
  ]
}
```

**Files to Modify:**
- All page.tsx files with metadata
- Consider auto-generating OG images (Vercel OG)

---

## Phase 4: Content Enhancement (5-7 days) - Topical Authority

### 4.1 Expand Academy Content
**Location:** `lib/academy/content.ts`  
**Purpose:** Build topical authority in AI/MLOps space  
**Impact:** HIGH - Long-term SEO benefit

**Content Categories:**

**4.1.1 "Why" Content (Thought Leadership)**
- Why Visual DAG beats shell scripts for AI workflows
- Why closed-loop monitoring matters for LLMs
- The AI Workflow Crisis: How we fix it

**4.1.2 "Technical Deep Dives"**
- Understanding LoRA: Rank, Alpha, Dropout explained
- QLoRA 4-bit quantization: Memory savings analysis
- GraphRAG architecture: Neo4j + Vector Search

**4.1.3 "Case Studies" (E-E-A-T Signal)**
- Company X reduced training time by 60%
- How Team Y prevented model drift with monitoring
- Before/After: Moving from Airflow to FineTuneLab

**Files to Modify:**
- `lib/academy/content.ts` (add articles)
- `app/lab-academy/[slug]/page.tsx` (ensure proper metadata)
- Create `app/case-studies/[slug]/` if not exists

---

### 4.2 FAQ Expansion
**Purpose:** Capture "People also ask" and AI Overview spots  
**Impact:** MEDIUM-HIGH - Quick wins in SERP features

**Implementation:**
Add FAQ schema to key pages:

**Homepage:**
- Expand existing FAQ in `app/page.tsx`

**Features Page:**
- Add product-specific FAQs

**Pricing Page:**
- Add pricing/billing FAQs

**Tutorial Pages:**
- Add troubleshooting FAQs

**Files to Modify:**
- `app/page.tsx` (expand FAQ)
- `app/features/page.tsx` (add FAQ)
- `app/upgrade/page.tsx` (add FAQ)
- Tutorial pages (add FAQ)

---

## Phase 5: Monitoring & Iteration (Ongoing)

### 5.1 Setup SEO Monitoring
**Tools to Use:**
- Google Search Console (already verified: google7752da997a791487.html)
- Google Analytics 4
- Ahrefs/Semrush (for backlinks, rankings)
- Lighthouse CI (for Core Web Vitals)

**Metrics to Track:**
- Organic traffic (overall + by page)
- Keyword rankings (target keywords)
- Core Web Vitals (LCP, FID, CLS)
- Backlink growth
- Social shares
- Conversion rate (signup from organic)

### 5.2 Regular Audits
**Monthly:**
- Check broken links (Screaming Frog)
- Review new content for optimization
- Update outdated content
- Check competitor strategies

**Quarterly:**
- Full technical SEO audit
- Content gap analysis
- Backlink profile review
- Schema markup validation

---

## Success Metrics

### 3 Months:
- [ ] 50+ high-intent keyword rankings (position 1-20)
- [ ] 200% increase in organic traffic
- [ ] 5+ comparison pages indexed and ranking
- [ ] Core Web Vitals all "Good" (green)
- [ ] 10+ citations in AI search results (ChatGPT/Perplexity)

### 6 Months:
- [ ] 150+ keyword rankings (position 1-10)
- [ ] 500% increase in organic traffic
- [ ] 30+ quality backlinks from AI/ML publications
- [ ] 100+ AI search citations
- [ ] 25% of signups from organic search

### 12 Months:
- [ ] Top 3 for "LLM fine-tuning platform"
- [ ] Top 5 for "AI training monitoring"
- [ ] 1000% increase in organic traffic
- [ ] 50% of signups from organic + AI search
- [ ] Featured in major AI/ML publications

---

## Risk Mitigation

### Non-Breaking Changes
- All new pages are additive (no deletions)
- Schema additions don't affect existing markup
- Performance optimizations tested in staging
- Internal links added carefully to avoid clutter

### Rollback Plan
- Git branch for each phase
- Staging environment testing
- Canary deployments for risky changes
- Monitoring alerts for traffic drops

### Content Quality
- All content reviewed by technical experts
- No AI-generated fluff
- E-E-A-T principles followed
- Real data and case studies

---

## File Change Summary

### Phase 1 (Create):
- `public/llms.txt` ⭐
- `lib/seo/config.ts` (add Dataset schema function)
- `public/robots.txt` (append AI crawler rules)

### Phase 2 (Create):
- `app/alternatives/page.tsx`
- `app/alternatives/weights-and-biases/page.tsx`
- `app/alternatives/langsmith/page.tsx`
- `app/alternatives/airflow/page.tsx`
- `app/alternatives/mlflow/page.tsx`
- `components/alternatives/ComparisonTable.tsx`
- `components/alternatives/FeatureComparison.tsx`
- `app/lab-academy/tutorials/page.tsx`
- 5 tutorial pages (monitor-drift, fine-tune-llama3, etc.)

### Phase 3 (Modify + Create):
- Audit and optimize images in `public/`
- Add breadcrumbs component
- Enhance metadata in all `page.tsx` files
- Add canonical tags where missing
- Implement OG image generation

### Phase 4 (Modify):
- `lib/academy/content.ts` (add 10+ articles)
- Expand FAQs in key pages
- Create case study pages

### Phase 5 (Monitoring):
- Setup tools (no code changes)
- Regular audits (documentation updates)

---

## Next Steps

**🔴 AWAITING APPROVAL:**

1. **Review this plan** - Ensure strategy aligns with business goals
2. **Prioritize phases** - Can skip/reorder based on urgency
3. **Approve Phase 1** - Quick wins with minimal risk
4. **Provide competitor info** - For comparison page content
5. **Content resources** - Who will write tutorials/case studies?

**After Approval:**
- I'll implement Phase 1 (1-2 days)
- Verify changes work correctly
- Document in progress log
- Request approval for Phase 2

---

## Questions for You

1. **Competitors:** Which platforms should comparison pages target first? (W&B, LangSmith, Airflow, MLflow, others?)
2. **Case Studies:** Do you have real customer success stories I can use? (anonymized OK)
3. **Content Team:** Should I create placeholder tutorial pages or wait for full content?
4. **Timeline:** Any urgency? Launch event coming up?
5. **Tools:** Do you have Ahrefs/Semrush access for keyword research?

---

**Ready to proceed when you approve Phase 1!** 🚀
