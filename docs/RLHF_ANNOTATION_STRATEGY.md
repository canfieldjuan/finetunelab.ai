# RLHF Annotation Strategy - Scale AI Approach

**Document Purpose:** Implementation guide for fast, accurate RLHF dataset annotation
**Target Feature:** Dataset Doctor - Build and validate training datasets
**Date:** 2025-11-30

---

## 🎯 How Scale AI Achieves Fast & Accurate RLHF Annotation

### **1. Multi-Tier Workforce Architecture**

Scale AI uses a **pyramidal workforce structure**:

#### **Tier 1: Expert Annotators (Top 5%)**
- Subject matter experts (PhDs, domain specialists)
- Handle complex, ambiguous cases
- Create "golden standard" examples
- $50-150/hour rates

#### **Tier 2: Trained Generalists (30%)**
- Extensively trained on guidelines
- Handle majority of standard tasks
- Validated against expert examples
- $15-30/hour rates

#### **Tier 3: Initial Screeners (65%)**
- Basic filtering and categorization
- Flag edge cases for upper tiers
- High volume, simple tasks
- $8-15/hour rates

#### **Why This Works:**
- Expert time focused on hardest 5% of decisions
- Generalists handle 80% of work at lower cost
- Screeners do bulk filtering
- Overall cost per annotation: $2-10 vs $50-150 if all expert

---

### **2. Consensus & Calibration System**

#### **Multi-Annotator Consensus:**
```
Same prompt → 3-5 different annotators → Aggregate scores

Example RLHF comparison:
Response A vs Response B

Annotator 1: A wins (confidence: 0.8)
Annotator 2: A wins (confidence: 0.9)
Annotator 3: B wins (confidence: 0.5)
Annotator 4: A wins (confidence: 0.7)
Annotator 5: A wins (confidence: 0.8)

Consensus: A wins (4/5, avg confidence: 0.74)
```

#### **Calibration Sets:**
- Every annotator gets 10-20% "test" examples with known answers
- Real-time accuracy tracking
- Auto-escalate if accuracy drops below 85%
- Weekly re-calibration on new golden examples

---

### **3. Active Learning Pipeline**

#### **Smart Task Routing:**
```
New Response Pair
    ↓
Is it similar to existing clusters?
    ↓ No → Route to Expert
    ↓ Yes → Route to Generalist
         ↓
    Low confidence? → Route to Expert Review
    High confidence? → Accept
```

#### **Uncertainty Sampling:**
- ML model predicts which pairs are hardest to judge
- Those get multiple expert reviews
- Easy pairs get single generalist review
- Saves 60-70% of expert time

---

### **4. Tooling & UX Optimization**

#### **Annotation Interface Speed Hacks:**

```typescript
// Keyboard shortcuts for everything
'1' → Response A is better
'2' → Response B is better
'=' → Tie
'?' → Flag for review

// Side-by-side diff highlighting
- Shows exact differences between responses
- Highlights factual claims (auto-detected)
- Color codes: Safe/Unsafe, Helpful/Unhelpful

// Contextual guidelines
- Inline examples appear based on task type
- Previous similar judgments shown
- Real-time feedback on annotation patterns
```

#### **Speed Improvements:**
- Average time per comparison: 30 seconds (vs 3-5 minutes without tooling)
- Batch loading (100 tasks cached locally)
- Keyboard-only workflow (no mouse needed)

---

### **5. Quality Gates**

#### **Multi-Stage Validation:**

```
Stage 1: Initial Annotation (Tier 3)
    ↓
Stage 2: Spot Check (10% reviewed by Tier 2)
    ↓
Stage 3: Calibration Check (5% reviewed by Tier 1)
    ↓
Stage 4: ML Agreement Check
    ↓ If ML disagrees → Expert Review
    ↓ If ML agrees → Accept

Final Accuracy: ~95%
```

---

## 🛠️ Implementation for Dataset Doctor

### **Phase 1: Self-Service RLHF for Users** (Easiest)

#### **User Experience:**
```
Your Training Job: "Customer Support Bot"

📊 Dataset Quality: 73% (Need 85% for training)

Next Comparison (47/200):
┌─────────────────────────────────────────┐
│ Prompt: "How do I reset my password?"  │
├─────────────────────────────────────────┤
│ Response A:                             │
│ Click "Forgot Password" on login page. │
│ Check your email for reset link.       │
│                                         │
│ Response B:                             │
│ To reset: 1) Go to login 2) Click      │
│ "Forgot Password" 3) Enter email       │
│ 4) Check inbox 5) Click link 6) Set    │
│ new password. Let me know if issues!   │
└─────────────────────────────────────────┘

Which response is better?
[A] Response A  [B] Response B  [=] Tie  [?] Skip

Why? (optional):
[More helpful    ] [More accurate  ]
[Better tone     ] [More complete  ]
```

#### **Database Schema:**
```sql
-- New table for RLHF comparisons
CREATE TABLE rlhf_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  dataset_id UUID REFERENCES training_datasets(id),
  prompt TEXT NOT NULL,
  response_a TEXT NOT NULL,
  response_b TEXT NOT NULL,
  winner TEXT, -- 'a', 'b', 'tie', NULL (unanswered)
  confidence FLOAT, -- 0.0-1.0
  reasons TEXT[], -- ['more_helpful', 'better_tone']
  annotator_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for performance
  INDEX idx_comparisons_unanswered (dataset_id, user_id, winner)
    WHERE winner IS NULL
);

-- RLS Policies
ALTER TABLE rlhf_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own comparisons"
  ON rlhf_comparisons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own comparisons"
  ON rlhf_comparisons FOR UPDATE
  USING (auth.uid() = user_id);
```

#### **React Component:**

**File:** `/components/training/RLHFComparison.tsx`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabaseClient';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';

interface ComparisonPair {
  id: string;
  prompt: string;
  response_a: string;
  response_b: string;
}

interface ProgressStats {
  completed: number;
  total: number;
  quality_score: number;
}

export function RLHFComparison({
  datasetId,
  userId
}: {
  datasetId: string;
  userId: string;
}) {
  const [currentPair, setCurrentPair] = useState<ComparisonPair | null>(null);
  const [progress, setProgress] = useState<ProgressStats>({
    completed: 0,
    total: 0,
    quality_score: 0
  });
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '1') handleChoice('a');
      if (e.key === '2') handleChoice('tie');
      if (e.key === '3') handleChoice('b');
      if (e.key === '?') handleSkip();
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPair]);

  useEffect(() => {
    loadNextPair();
    loadProgress();
  }, []);

  const loadNextPair = async () => {
    // Get next unanswered comparison
    const { data, error } = await supabase
      .from('rlhf_comparisons')
      .select('*')
      .eq('dataset_id', datasetId)
      .eq('user_id', userId)
      .is('winner', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error) {
      console.error('Error loading comparison:', error);
      return;
    }

    if (data) {
      setCurrentPair(data);
      setStartTime(Date.now());
      setSelectedReasons([]);
    } else {
      setCurrentPair(null);
    }
  };

  const loadProgress = async () => {
    const { count: total } = await supabase
      .from('rlhf_comparisons')
      .select('*', { count: 'exact', head: true })
      .eq('dataset_id', datasetId)
      .eq('user_id', userId);

    const { count: completed } = await supabase
      .from('rlhf_comparisons')
      .select('*', { count: 'exact', head: true })
      .eq('dataset_id', datasetId)
      .eq('user_id', userId)
      .not('winner', 'is', null);

    // Calculate quality score (example: based on completion rate)
    const qualityScore = total ? Math.round((completed / total) * 100) : 0;

    setProgress({
      completed: completed || 0,
      total: total || 0,
      quality_score: qualityScore
    });
  };

  const handleChoice = async (winner: 'a' | 'b' | 'tie') => {
    if (!currentPair) return;

    const timeMs = Date.now() - startTime;

    const { error } = await supabase
      .from('rlhf_comparisons')
      .update({
        winner,
        annotator_time_ms: timeMs,
        confidence: 1.0, // Could add confidence slider
        reasons: selectedReasons
      })
      .eq('id', currentPair.id);

    if (error) {
      console.error('Error saving choice:', error);
      return;
    }

    // Load next
    await loadProgress();
    await loadNextPair();
  };

  const handleSkip = async () => {
    // Just load next without saving
    await loadNextPair();
  };

  const toggleReason = (reason: string) => {
    setSelectedReasons(prev =>
      prev.includes(reason)
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    );
  };

  // Completion state
  if (progress.total === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-3" />
            <p>No comparison pairs available.</p>
            <p className="text-sm mt-2">Generate pairs first using the Dataset Doctor tools.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentPair) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h3 className="text-xl font-semibold mb-2">All Comparisons Complete! 🎉</h3>
            <p className="text-muted-foreground">
              You've annotated {progress.completed} pairs.
            </p>
            <p className="text-sm mt-2">
              Dataset Quality Score: <strong>{progress.quality_score}%</strong>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressPercent = (progress.completed / progress.total) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>RLHF Annotation</CardTitle>
            <CardDescription>
              Compare responses to improve your training dataset
            </CardDescription>
          </div>
          <Badge variant="outline">
            {progress.completed}/{progress.total}
          </Badge>
        </div>
        <Progress value={progressPercent} className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Prompt */}
        <div className="p-4 bg-muted rounded-lg">
          <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Prompt</h4>
          <p className="text-sm">{currentPair.prompt}</p>
        </div>

        {/* Responses Side by Side */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Response A</h4>
              <Badge variant="secondary">Option 1</Badge>
            </div>
            <p className="text-sm whitespace-pre-wrap">{currentPair.response_a}</p>
          </div>

          <div className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Response B</h4>
              <Badge variant="secondary">Option 2</Badge>
            </div>
            <p className="text-sm whitespace-pre-wrap">{currentPair.response_b}</p>
          </div>
        </div>

        {/* Reason Tags (Optional) */}
        <div>
          <h4 className="text-sm font-medium mb-2">Why is one better? (optional)</h4>
          <div className="flex flex-wrap gap-2">
            {['more_helpful', 'more_accurate', 'better_tone', 'more_complete', 'safer'].map(reason => (
              <Badge
                key={reason}
                variant={selectedReasons.includes(reason) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleReason(reason)}
              >
                {reason.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        </div>

        {/* Choice Buttons */}
        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => handleChoice('a')}
            variant="outline"
            size="lg"
            className="flex-1"
          >
            <strong className="mr-2">1</strong> A is Better
          </Button>
          <Button
            onClick={() => handleChoice('tie')}
            variant="outline"
            size="lg"
            className="flex-1"
          >
            <strong className="mr-2">2</strong> Tie
          </Button>
          <Button
            onClick={() => handleChoice('b')}
            variant="outline"
            size="lg"
            className="flex-1"
          >
            <strong className="mr-2">3</strong> B is Better
          </Button>
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            💡 Keyboard shortcuts: <strong>1</strong> (A) | <strong>2</strong> (Tie) | <strong>3</strong> (B) | <strong>?</strong> (Skip)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Average time: {startTime ? Math.round((Date.now() - startTime) / 1000) : 0}s
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### **Phase 2: Auto-Generate Comparisons** (Smarter)

#### **API Endpoint: Generate Response Pairs**

**File:** `/app/api/datasets/generate-rlhf-pairs/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { UnifiedLLMClient } from '@/lib/llm/unified-client';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { datasetId, userId, modelIds } = await request.json();

    if (!datasetId || !userId || !modelIds || modelIds.length < 2) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get dataset content
    const { data: dataset, error: datasetError } = await supabaseAdmin
      .from('training_datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (datasetError || !dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      );
    }

    // Parse JSONL content to get prompts
    const prompts = parseJSONL(dataset.content);

    const unifiedClient = new UnifiedLLMClient();
    const pairsCreated = [];

    // Generate comparison pairs
    for (const example of prompts.slice(0, 50)) { // Limit to first 50
      const messages = example.messages;
      const lastMessage = messages[messages.length - 1];

      if (lastMessage.role !== 'user') continue;

      try {
        // Generate two responses from different models
        const [responseA, responseB] = await Promise.all([
          unifiedClient.generate(modelIds[0], messages, { userId }),
          unifiedClient.generate(modelIds[1], messages, { userId })
        ]);

        // Create comparison pair
        const { data: pair, error: pairError } = await supabaseAdmin
          .from('rlhf_comparisons')
          .insert({
            user_id: userId,
            dataset_id: datasetId,
            prompt: lastMessage.content,
            response_a: responseA.content,
            response_b: responseB.content,
            winner: null
          })
          .select()
          .single();

        if (!pairError && pair) {
          pairsCreated.push(pair.id);
        }
      } catch (error) {
        console.error('Error generating pair:', error);
        // Continue with next prompt
      }
    }

    return NextResponse.json({
      success: true,
      pairs_created: pairsCreated.length,
      total_prompts: prompts.length
    });

  } catch (error) {
    console.error('Error in generate-rlhf-pairs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function parseJSONL(content: string): any[] {
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
```

---

### **Phase 3: Multi-User Collaboration** (Scale AI Style)

#### **Database Schema for Collaboration:**

```sql
-- Allow multiple users to annotate same dataset
CREATE TABLE dataset_collaborators (
  dataset_id UUID REFERENCES training_datasets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'owner', 'annotator', 'reviewer'
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (dataset_id, user_id)
);

-- Track individual annotations for consensus
CREATE TABLE rlhf_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_id UUID REFERENCES rlhf_comparisons(id) ON DELETE CASCADE,
  annotator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  winner TEXT NOT NULL, -- 'a', 'b', 'tie'
  confidence FLOAT DEFAULT 1.0,
  reasons TEXT[],
  annotation_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (comparison_id, annotator_id)
);

-- Annotator quality metrics
CREATE TABLE annotator_metrics (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  dataset_id UUID REFERENCES training_datasets(id),
  total_annotations INTEGER DEFAULT 0,
  agreement_rate FLOAT DEFAULT 0.0, -- % agreement with consensus
  avg_annotation_time_ms INTEGER,
  quality_tier TEXT, -- 'expert', 'proficient', 'learning'
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE dataset_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE rlhf_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotator_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collaborators can view dataset collaborators"
  ON dataset_collaborators FOR SELECT
  USING (
    user_id = auth.uid() OR
    dataset_id IN (
      SELECT dataset_id FROM dataset_collaborators
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own annotations"
  ON rlhf_annotations FOR SELECT
  USING (annotator_id = auth.uid());

CREATE POLICY "Users can insert own annotations"
  ON rlhf_annotations FOR INSERT
  WITH CHECK (annotator_id = auth.uid());
```

#### **Consensus Calculation Function:**

**File:** `/lib/rlhf/consensus.ts`

```typescript
import { supabase } from '@/lib/supabaseClient';

export interface ConsensusResult {
  winner: 'a' | 'b' | 'tie' | 'needs_review';
  confidence: number;
  annotation_count: number;
  agreement_rate: number;
}

export async function calculateConsensus(
  comparisonId: string
): Promise<ConsensusResult> {
  // Get all annotations for this comparison
  const { data: annotations, error } = await supabase
    .from('rlhf_annotations')
    .select('winner, confidence')
    .eq('comparison_id', comparisonId);

  if (error || !annotations || annotations.length === 0) {
    return {
      winner: 'needs_review',
      confidence: 0,
      annotation_count: 0,
      agreement_rate: 0
    };
  }

  // Weighted voting
  const votes: Record<string, number> = { a: 0, b: 0, tie: 0 };

  annotations.forEach(({ winner, confidence }) => {
    votes[winner] = (votes[winner] || 0) + (confidence || 1.0);
  });

  const total = votes.a + votes.b + votes.tie;

  // Find winner
  const winner = (Object.keys(votes) as Array<'a' | 'b' | 'tie'>).reduce((a, b) =>
    votes[a] > votes[b] ? a : b
  );

  const winnerVotes = votes[winner];
  const consensusConfidence = winnerVotes / total;

  // Calculate agreement rate (how many annotators agreed with winner)
  const agreementCount = annotations.filter(a => a.winner === winner).length;
  const agreementRate = agreementCount / annotations.length;

  // Require 70% confidence threshold
  if (consensusConfidence >= 0.7) {
    return {
      winner,
      confidence: consensusConfidence,
      annotation_count: annotations.length,
      agreement_rate: agreementRate
    };
  }

  return {
    winner: 'needs_review',
    confidence: consensusConfidence,
    annotation_count: annotations.length,
    agreement_rate: agreementRate
  };
}

export async function updateConsensus(comparisonId: string) {
  const consensus = await calculateConsensus(comparisonId);

  if (consensus.winner !== 'needs_review') {
    // Update the main comparison record
    await supabase
      .from('rlhf_comparisons')
      .update({
        winner: consensus.winner,
        confidence: consensus.confidence
      })
      .eq('id', comparisonId);
  }

  return consensus;
}
```

---

### **Phase 4: Quality Scoring & Auto-Routing** (Advanced)

#### **Annotator Quality Calculation:**

**File:** `/lib/rlhf/quality.ts`

```typescript
import { supabase } from '@/lib/supabaseClient';
import { calculateConsensus } from './consensus';

export interface AnnotatorQuality {
  user_id: string;
  total_annotations: number;
  agreement_rate: number;
  avg_time_ms: number;
  quality_tier: 'expert' | 'proficient' | 'learning';
}

export async function calculateAnnotatorQuality(
  userId: string,
  datasetId: string
): Promise<AnnotatorQuality> {
  // Get user's annotations
  const { data: myAnnotations } = await supabase
    .from('rlhf_annotations')
    .select('comparison_id, winner, annotation_time_ms')
    .eq('annotator_id', userId)
    .eq('comparison_id', supabase
      .from('rlhf_comparisons')
      .select('id')
      .eq('dataset_id', datasetId)
    );

  if (!myAnnotations || myAnnotations.length === 0) {
    return {
      user_id: userId,
      total_annotations: 0,
      agreement_rate: 0,
      avg_time_ms: 0,
      quality_tier: 'learning'
    };
  }

  let agreements = 0;
  let totalTime = 0;

  // Compare each annotation with consensus
  for (const { comparison_id, winner, annotation_time_ms } of myAnnotations) {
    const consensus = await calculateConsensus(comparison_id);

    if (consensus.winner === winner) {
      agreements++;
    }

    if (annotation_time_ms) {
      totalTime += annotation_time_ms;
    }
  }

  const agreementRate = agreements / myAnnotations.length;
  const avgTimeMs = totalTime / myAnnotations.length;

  // Determine quality tier
  let quality_tier: 'expert' | 'proficient' | 'learning' = 'learning';

  if (agreementRate >= 0.9 && myAnnotations.length >= 100) {
    quality_tier = 'expert';
  } else if (agreementRate >= 0.8 && myAnnotations.length >= 50) {
    quality_tier = 'proficient';
  }

  // Save to metrics table
  await supabase
    .from('annotator_metrics')
    .upsert({
      user_id: userId,
      dataset_id: datasetId,
      total_annotations: myAnnotations.length,
      agreement_rate: agreementRate,
      avg_annotation_time_ms: Math.round(avgTimeMs),
      quality_tier,
      last_updated: new Date().toISOString()
    });

  return {
    user_id: userId,
    total_annotations: myAnnotations.length,
    agreement_rate: agreementRate,
    avg_time_ms: avgTimeMs,
    quality_tier
  };
}
```

#### **Smart Task Routing:**

```typescript
export async function getNextComparison(
  userId: string,
  datasetId: string
): Promise<any> {
  // Get user's quality tier
  const { data: metrics } = await supabase
    .from('annotator_metrics')
    .select('quality_tier')
    .eq('user_id', userId)
    .eq('dataset_id', datasetId)
    .single();

  const qualityTier = metrics?.quality_tier || 'learning';

  // Route based on quality tier
  if (qualityTier === 'expert') {
    // Experts get hardest cases (low initial confidence or disagreements)
    return supabase
      .from('rlhf_comparisons')
      .select('*')
      .eq('dataset_id', datasetId)
      .is('winner', null)
      .order('confidence', { ascending: true, nullsFirst: true })
      .limit(1)
      .single();
  } else {
    // Others get random unanswered
    return supabase
      .from('rlhf_comparisons')
      .select('*')
      .eq('dataset_id', datasetId)
      .is('winner', null)
      .order('created_at')
      .limit(1)
      .single();
  }
}
```

---

## 📊 Implementation Roadmap

### **Week 1: Foundation**
- [ ] Create database tables (rlhf_comparisons, rlhf_annotations)
- [ ] Build basic RLHFComparison component
- [ ] Add keyboard shortcuts
- [ ] Test with manual data entry

### **Week 2: Auto-Generation**
- [ ] Build generate-rlhf-pairs API endpoint
- [ ] Add UI to select models for comparison
- [ ] Test with 2 different models (e.g., GPT-4 vs Claude)
- [ ] Add progress tracking

### **Week 3: Collaboration**
- [ ] Add dataset_collaborators table
- [ ] Build invite system
- [ ] Implement consensus calculation
- [ ] Show agreement metrics

### **Week 4: Quality & Routing**
- [ ] Calculate annotator quality scores
- [ ] Implement smart task routing
- [ ] Add quality badges/tiers
- [ ] Build quality dashboard

### **Week 5: Polish & UX**
- [ ] Add diff highlighting for responses
- [ ] Batch loading (100 tasks)
- [ ] Offline support (cache locally)
- [ ] Analytics dashboard

---

## 🎯 Dataset Doctor Integration

### **Where to Add in Current UI:**

1. **Dataset Manager Page** (`/app/datasets/page.tsx`)
   - Add "Generate RLHF Pairs" button next to dataset
   - Shows quality score badge

2. **New RLHF Tab** (Training Page)
   - Add as separate tab in training workflow
   - "Annotate" → "Review" → "Train"

3. **Quality Metrics** (Dashboard)
   - Show dataset quality scores
   - Annotator leaderboard
   - Time savings metrics

---

## 💡 Key Success Metrics

Track these to measure Dataset Doctor effectiveness:

1. **Annotation Speed**
   - Target: <30 seconds per comparison
   - Track: `annotator_time_ms` field

2. **Dataset Quality**
   - Target: >85% consensus confidence
   - Track: `confidence` field average

3. **Annotator Agreement**
   - Target: >80% agreement with consensus
   - Track: `agreement_rate` in metrics

4. **Throughput**
   - Target: 100+ comparisons per hour per user
   - Track: `total_annotations` / time

---

## 🔗 Related Files

- `/components/training/DatasetManager.tsx` - Existing dataset UI
- `/components/training/TrainingWorkflow.tsx` - Where to integrate
- `/lib/llm/unified-client.ts` - For generating responses
- `/app/api/datasets/` - Existing dataset APIs

---

**End of Document**
