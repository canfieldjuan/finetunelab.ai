# Phase 6: Quick Wins Implementation Plan

**Date:** October 13, 2025
**Status:** 📋 PLANNING PHASE
**Priority:** High
**Objective:** Add 3 quick-win features to enhance user experience

---

## 🎯 EXECUTIVE SUMMARY

This plan implements 3 focused features (2-4 hours each):

1. **Feature A:** Simple Settings Page (theme/model selection)
2. **Feature B:** GraphRAG Toggle (per-conversation enable/disable)
3. **Feature C:** Analytics Dashboard (usage/cost tracking)

**Total Estimated Time:** 8-12 hours
**Approach:** Incremental, verified, small blocks (max 30 lines)

---

## 📋 PRE-IMPLEMENTATION CHECKLIST

### Before Starting ANY Feature:

- [ ] Read all relevant files COMPLETELY
- [ ] Identify EXACT insertion points with line numbers
- [ ] Verify no conflicts with existing code
- [ ] Check dependencies are available
- [ ] Confirm database schema if needed
- [ ] Test current functionality works
- [ ] Create backup branch

---

## 🔧 FEATURE A: SIMPLE SETTINGS PAGE

**Estimated Time:** 2-3 hours
**Priority:** Medium
**Complexity:** Low

### User Stories

- As a user, I want to change my display theme (light/dark)
- As a user, I want to select my preferred AI model
- As a user, I want to manage my account preferences

### Technical Architecture

```
app/settings/
└── page.tsx                    # New settings page

lib/settings/
├── types.ts                    # Settings interfaces
├── settingsService.ts          # Settings CRUD
└── index.ts                    # Exports

components/settings/
├── ThemeSelector.tsx           # Theme toggle
├── ModelSelector.tsx           # AI model selection
└── index.ts                    # Exports

Database:
└── user_settings table         # Store user preferences
```

---

### Phase A.1: Database Schema (15 min)

**Goal:** Create user_settings table in Supabase

**Verification Steps:**
1. ✅ Check if `user_settings` table already exists
2. ✅ Verify Supabase connection works
3. ✅ Test table creation in SQL editor first

**Files to Check:**
- None (database only)

**SQL to Create:**
```sql
-- user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  preferred_model TEXT NOT NULL DEFAULT 'gpt-4',
  message_density TEXT DEFAULT 'comfortable' CHECK (message_density IN ('compact', 'comfortable', 'spacious')),
  show_timestamps BOOLEAN DEFAULT true,
  enable_sound BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- RLS Policies
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
```

**Verification:**
- [ ] Run SQL in Supabase SQL Editor
- [ ] Check table exists in Table Editor
- [ ] Verify RLS policies active
- [ ] Test insert with dummy data
- [ ] Test select with user auth

---

### Phase A.2: Settings Service (30 min)

**Goal:** Create settings CRUD service

**Files to Create:**

#### File 1: `lib/settings/types.ts` (~20 lines)

**Insertion Point:** New file

**Code Block 1:**
```typescript
// User settings types
export type Theme = 'light' | 'dark' | 'system';
export type MessageDensity = 'compact' | 'comfortable' | 'spacious';

export interface UserSettings {
  id: string;
  user_id: string;
  theme: Theme;
  preferred_model: string;
  message_density: MessageDensity;
  show_timestamps: boolean;
  enable_sound: boolean;
  created_at: string;
  updated_at: string;
}
```

**Code Block 2:**
```typescript
export interface UpdateSettingsInput {
  theme?: Theme;
  preferred_model?: string;
  message_density?: MessageDensity;
  show_timestamps?: boolean;
  enable_sound?: boolean;
}
```

**Verification:**
- [ ] File compiles without errors
- [ ] Types export correctly
- [ ] No unused imports

---

#### File 2: `lib/settings/settingsService.ts` (~80 lines)

**Dependencies to Verify:**
- ✅ `supabase` client imported from `../supabaseClient`
- ✅ Types imported from `./types`

**Code Block 1: Service Class Setup (25 lines)**
```typescript
import { supabase } from '../supabaseClient';
import { UserSettings, UpdateSettingsInput } from './types';

export class SettingsService {
  /**
   * Get user settings, create default if not exist
   */
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // If no settings exist, create default
        if (error.code === 'PGRST116') {
          return await this.createDefaultSettings(userId);
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[SettingsService] Error getting settings:', error);
      return null;
    }
  }
```

**Verification After Block 1:**
- [ ] Compiles without errors
- [ ] Supabase import works
- [ ] Method signature correct

**Code Block 2: Create Default Settings (20 lines)**
```typescript
  /**
   * Create default settings for new user
   */
  private async createDefaultSettings(userId: string): Promise<UserSettings | null> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          theme: 'light',
          preferred_model: 'gpt-4',
          message_density: 'comfortable',
          show_timestamps: true,
          enable_sound: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[SettingsService] Error creating default settings:', error);
      return null;
    }
  }
```

**Verification After Block 2:**
- [ ] Default values match schema
- [ ] Insert statement correct
- [ ] Error handling present

**Code Block 3: Update Settings (25 lines)**
```typescript
  /**
   * Update user settings
   */
  async updateSettings(
    userId: string,
    updates: UpdateSettingsInput
  ): Promise<UserSettings | null> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[SettingsService] Error updating settings:', error);
      return null;
    }
  }
}

// Export singleton instance
export const settingsService = new SettingsService();
```

**Verification After Block 3:**
- [ ] Update method works
- [ ] Timestamp updated
- [ ] Singleton exported
- [ ] Full service compiles

---

#### File 3: `lib/settings/index.ts` (~5 lines)

**Code:**
```typescript
export * from './types';
export * from './settingsService';
```

**Verification:**
- [ ] Exports work from parent folder
- [ ] No circular dependencies

---

### Phase A.3: Settings Page UI (45 min)

**Goal:** Create settings page with theme and model selection

**Files to Create:**

#### File 1: `app/settings/page.tsx` (~120 lines)

**Dependencies to Verify:**
- ✅ `useAuth` from contexts
- ✅ `settingsService` from lib/settings
- ✅ React hooks (useState, useEffect)
- ✅ Button, Input from components/ui

**Code Block 1: Imports and Setup (20 lines)**
```typescript
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { settingsService, UserSettings } from '../../lib/settings';
import { Button } from '../../components/ui/button';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);
```

**Verification After Block 1:**
- [ ] Imports resolve
- [ ] Auth check works
- [ ] State variables correct

**Code Block 2: Load Settings (20 lines)**
```typescript
  // Load user settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;

      setLoading(true);
      const userSettings = await settingsService.getUserSettings(user.id);
      if (userSettings) {
        setSettings(userSettings);
      }
      setLoading(false);
    };

    loadSettings();
  }, [user]);

  // Handle theme change
  const handleThemeChange = (newTheme: string) => {
    if (settings) {
      setSettings({ ...settings, theme: newTheme as any });
    }
  };
```

**Verification After Block 2:**
- [ ] Settings load on mount
- [ ] State updates correctly
- [ ] No infinite loops

**Code Block 3: Save Handler (20 lines)**
```typescript
  // Handle model change
  const handleModelChange = (newModel: string) => {
    if (settings) {
      setSettings({ ...settings, preferred_model: newModel });
    }
  };

  // Save settings
  const handleSave = async () => {
    if (!user || !settings) return;

    setSaving(true);
    setMessage(null);

    const updated = await settingsService.updateSettings(user.id, {
      theme: settings.theme,
      preferred_model: settings.preferred_model,
    });

    setSaving(false);
    setMessage(updated ? 'Settings saved successfully!' : 'Failed to save settings');
    setTimeout(() => setMessage(null), 3000);
  };
```

**Verification After Block 3:**
- [ ] Save function works
- [ ] Loading states correct
- [ ] Success message shows

**Code Block 4: Render UI (60 lines)**
```typescript
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-destructive">Failed to load settings</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <Button
            onClick={() => router.push('/chat')}
            variant="ghost"
          >
            Back to Chat
          </Button>
        </div>

        {message && (
          <div className="mb-4 p-4 bg-primary/10 text-primary rounded-lg">
            {message}
          </div>
        )}

        <div className="space-y-6 bg-card border rounded-lg p-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Theme</label>
            <select
              value={settings.theme}
              onChange={(e) => handleThemeChange(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Preferred Model</label>
            <select
              value={settings.preferred_model}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="claude-3-opus">Claude 3 Opus</option>
              <option value="claude-3-sonnet">Claude 3 Sonnet</option>
            </select>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Verification After Block 4:**
- [ ] Page renders correctly
- [ ] Dropdown options show
- [ ] Save button works
- [ ] Message appears on save
- [ ] Full page compiles
- [ ] Navigate to /settings works

---

### Phase A.4: Add Settings Link (15 min)

**Goal:** Add Settings button to sidebar dropdown

**File to Modify:** `components/Chat.tsx`

**Exact Location:** Inside the user settings dropdown (lines 698-748)

**Insertion Point:** After "Knowledge" button, before "Log out" button (around line 738)

**Code to Add:**
```typescript
<button
  onClick={() => {
    router.push('/settings');
    setShowUserSettings(false);
  }}
  className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3"
>
  <Settings className="w-4 h-4" />
  <span>Settings</span>
</button>
```

**Additional Import Needed:**
Add to imports at top (line 1-17 area):
```typescript
import { useRouter } from 'next/navigation';
```

Add router hook (around line 42 area):
```typescript
const router = useRouter();
```

**Verification:**
- [ ] Read Chat.tsx completely first
- [ ] Find exact line numbers for insertion
- [ ] Verify imports don't conflict
- [ ] Test navigation works
- [ ] Settings dropdown still works
- [ ] No other buttons broke

---

### Phase A.5: Feature A Verification (20 min)

**Complete Testing Checklist:**

- [ ] Database table created
- [ ] Settings service compiles
- [ ] Settings page renders
- [ ] Can navigate to /settings
- [ ] Settings load from database
- [ ] Theme dropdown shows options
- [ ] Model dropdown shows options
- [ ] Save button saves to database
- [ ] Success message appears
- [ ] Settings persist on reload
- [ ] Back button works
- [ ] Settings link in sidebar works
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Dev server still running

---

## 🎮 FEATURE B: GRAPHRAG TOGGLE (PER-CONVERSATION)

**Estimated Time:** 2-3 hours
**Priority:** High
**Complexity:** Medium

### User Stories

- As a user, I want to enable/disable GraphRAG for specific conversations
- As a user, I want to see if GraphRAG is active for current conversation
- As a user, I want GraphRAG to remember my choice per conversation

### Technical Architecture

```
Database:
└── conversations table         # Add graphrag_enabled column

lib/graphrag/
└── service/graphrag-service.ts # Check conversation setting

components/Chat.tsx
└── GraphRAG toggle UI          # Per-conversation toggle
```

---

### Phase B.1: Database Migration (10 min)

**Goal:** Add graphrag_enabled column to conversations table

**SQL to Run:**
```sql
-- Add column to conversations table
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS graphrag_enabled BOOLEAN DEFAULT true;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_conversations_graphrag_enabled
ON conversations(graphrag_enabled);

-- Update existing conversations to have default value
UPDATE conversations
SET graphrag_enabled = true
WHERE graphrag_enabled IS NULL;
```

**Verification:**
- [ ] Run SQL in Supabase SQL Editor
- [ ] Check column exists in Table Editor
- [ ] Verify existing conversations have value
- [ ] Index created

---

### Phase B.2: Update Types (10 min)

**File to Modify:** `components/Chat.tsx`

**Exact Location:** SidebarConversation interface (lines 33-39)

**Add to interface:**
```typescript
interface SidebarConversation {
  id: string;
  title: string;
  in_knowledge_graph?: boolean;
  neo4j_episode_id?: string;
  promoted_at?: string;
  graphrag_enabled?: boolean; // NEW
}
```

**Verification:**
- [ ] Interface updated
- [ ] No TypeScript errors
- [ ] Compiles successfully

---

### Phase B.3: Load GraphRAG Status (15 min)

**File to Modify:** `components/Chat.tsx`

**Exact Location:** fetchConversations query (line 77-81)

**Current Code:**
```typescript
const { data, error } = await supabase
  .from("conversations")
  .select("id, title, in_knowledge_graph, neo4j_episode_id, promoted_at")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false});
```

**Updated Code:**
```typescript
const { data, error } = await supabase
  .from("conversations")
  .select("id, title, in_knowledge_graph, neo4j_episode_id, promoted_at, graphrag_enabled")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false});
```

**Verification:**
- [ ] Query updated
- [ ] graphrag_enabled loads from database
- [ ] No errors in console
- [ ] Data structure correct

---

### Phase B.4: Toggle Handler (20 min)

**File to Modify:** `components/Chat.tsx`

**Exact Location:** After handleDeleteConversation (around line 515)

**Code to Add:**
```typescript
const handleToggleGraphRAG = async (conversationId: string, enabled: boolean) => {
  if (!user) return;

  try {
    console.log('[Chat] Toggling GraphRAG:', conversationId, enabled);

    // Update in database
    const { error } = await supabase
      .from('conversations')
      .update({ graphrag_enabled: enabled })
      .eq('id', conversationId)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(error.message);
    }

    console.log('[Chat] GraphRAG toggled successfully');

    // Update local state
    setConversations(conversations.map(c =>
      c.id === conversationId
        ? { ...c, graphrag_enabled: enabled }
        : c
    ));

    await logSessionEvent(user.id, 'graphrag_toggled', conversationId);
  } catch (error) {
    console.error('[Chat] Toggle error:', error);
    setError(error instanceof Error ? error.message : 'Failed to toggle GraphRAG');
  }
};
```

**Verification:**
- [ ] Function added after handleDeleteConversation
- [ ] No syntax errors
- [ ] Compiles successfully
- [ ] State update logic correct

---

### Phase B.5: Add Toggle UI (30 min)

**File to Modify:** `components/Chat.tsx`

**Exact Location:** Inside conversation dropdown menu (lines 650-688)

**Insertion Point:** After "Add to KGraph" button, before "Archive" button (around line 664)

**Code to Add:**
```typescript
<button
  onClick={(e) => {
    e.stopPropagation();
    handleToggleGraphRAG(
      conv.id,
      !(conv.graphrag_enabled ?? true)
    );
    setOpenMenuId(null);
  }}
  className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2"
>
  <CheckCircle
    className={`w-4 h-4 ${
      conv.graphrag_enabled !== false ? 'text-green-500' : 'text-gray-400'
    }`}
  />
  <span>
    {conv.graphrag_enabled !== false ? 'Disable' : 'Enable'} GraphRAG
  </span>
</button>
```

**Verification:**
- [ ] Button appears in dropdown
- [ ] Icon shows correct state
- [ ] Text shows correct state
- [ ] Click toggles state
- [ ] Database updates
- [ ] UI updates immediately

---

### Phase B.6: Update Chat API Integration (25 min)

**File to Modify:** `app/api/chat/route.ts`

**Goal:** Check conversation's graphrag_enabled before using GraphRAG

**Exact Location:** Before GraphRAG enhancement (need to read file first)

**Steps:**
1. ✅ Read full `app/api/chat/route.ts` file
2. ✅ Find GraphRAG integration point
3. ✅ Add conversation check
4. ✅ Skip GraphRAG if disabled

**Verification:**
- [ ] Read file completely first
- [ ] Find exact integration point
- [ ] Understand current flow
- [ ] Plan insertion carefully
- [ ] Test with toggle on/off

---

### Phase B.7: Visual Indicator (20 min)

**File to Modify:** `components/Chat.tsx`

**Goal:** Show GraphRAG status for active conversation

**Exact Location:** Input area status indicator (lines 931-945)

**Current Code Shows:**
- Documents indexed count
- "GraphRAG enabled/ready" message

**Update to Add:**
Show if GraphRAG is disabled for THIS conversation

**Code to Update (lines 931-945):**
```typescript
{/* GraphRAG Status Indicator */}
<div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
  {/* Find active conversation */}
  {(() => {
    const activeConv = conversations.find(c => c.id === activeId);
    const isEnabled = activeConv?.graphrag_enabled !== false;

    if (!isEnabled) {
      return (
        <>
          <CheckCircle className="w-3 h-3 text-gray-400" />
          <span>GraphRAG disabled for this conversation</span>
        </>
      );
    }

    if (documents.length > 0) {
      return (
        <>
          <CheckCircle className="w-3 h-3 text-green-500" />
          <span>GraphRAG enabled</span>
          <span>•</span>
          <span>{documents.length} {documents.length === 1 ? 'doc' : 'docs'} indexed</span>
        </>
      );
    }

    return (
      <>
        <CheckCircle className="w-3 h-3 text-muted-foreground" />
        <span>GraphRAG ready - no documents yet</span>
      </>
    );
  })()}
</div>
```

**Verification:**
- [ ] Status shows for active conversation
- [ ] Message changes based on toggle
- [ ] Icon color updates
- [ ] No performance issues

---

### Phase B.8: Feature B Verification (20 min)

**Complete Testing Checklist:**

- [ ] Database column added
- [ ] Types updated
- [ ] Toggle handler works
- [ ] UI toggle appears in dropdown
- [ ] Toggle updates database
- [ ] Toggle updates UI immediately
- [ ] Status indicator shows correct state
- [ ] Chat API respects toggle
- [ ] GraphRAG skipped when disabled
- [ ] GraphRAG works when enabled
- [ ] State persists on reload
- [ ] No console errors
- [ ] No TypeScript errors

---

## 📊 FEATURE C: ANALYTICS DASHBOARD

**Estimated Time:** 4-6 hours
**Priority:** Medium
**Complexity:** High

### User Stories

- As a user, I want to see my token usage
- As a user, I want to estimate my costs
- As a user, I want to see usage trends over time
- As a user, I want to export analytics data

### Technical Architecture

```
app/analytics/
└── page.tsx                    # Analytics dashboard

lib/analytics/
├── types.ts                    # Analytics interfaces
├── tracker.ts                  # Usage tracking
├── aggregator.ts               # Data aggregation
└── config.ts                   # Pricing config

components/analytics/
├── TokenUsageChart.tsx         # Usage chart
├── CostBreakdown.tsx           # Cost pie chart
└── UsageStats.tsx              # Summary cards

Database:
└── usage_analytics table       # Track token usage
```

### Phase C.1-C.8: Detailed Implementation

*[Feature C is documented in detail in PHASE_5_NEW_FEATURES_PLAN.md lines 1122-1625]*

**For this feature, we will:**
1. Reference the existing detailed plan
2. Extract and adapt for our codebase
3. Implement in small verified blocks
4. This feature requires more time due to:
   - Database schema
   - Tracking integration
   - Chart library setup
   - Multiple components

---

## 📝 SESSION CONTINUITY

### Progress Tracking

**After each completed phase, update:**

1. **This Document** - Mark phases complete with ✅
2. **SESSION_LOG_20251013_UI_FIXES.md** - Add new phase section
3. **Git Commits** - Commit after each verified phase

### Session Log Format

Add to `docs/SESSION_LOG_20251013_UI_FIXES.md`:

```markdown
## ✅ Phase 10: Settings Page (Complete)

**User Request:** "Add settings page for user preferences"

**Implementation:**
- Created user_settings table
- Built settings service
- Created settings page UI
- Added navigation link

**Files Created:**
- lib/settings/types.ts
- lib/settings/settingsService.ts
- app/settings/page.tsx

**Files Modified:**
- components/Chat.tsx (added settings link)

**Verification:**
- ✅ Settings load correctly
- ✅ Save persists to database
- ✅ Navigation works
- ✅ No errors

**Time:** 2.5 hours
```

---

## 🚨 CRITICAL RULES CHECKLIST

Before ANY coding:

- [ ] **Read files completely** - Never assume structure
- [ ] **Verify exact line numbers** - Use Read tool to find insertion points
- [ ] **Check dependencies** - Verify all imports available
- [ ] **Test current state** - Ensure everything works before changes
- [ ] **Small blocks** - Max 30 lines per code block
- [ ] **Verify each block** - Compile and test after each addition
- [ ] **No assumptions** - Verify everything explicitly
- [ ] **Backward compatibility** - Don't break existing features
- [ ] **No unicode in Python** - (not applicable here, but noted)
- [ ] **Document changes** - Update session logs

---

## 📈 SUCCESS METRICS

### Feature A: Settings Page
- [ ] Page accessible at /settings
- [ ] Settings load from database
- [ ] Theme selection works
- [ ] Model selection works
- [ ] Save persists to database
- [ ] Navigation works
- [ ] No errors

### Feature B: GraphRAG Toggle
- [ ] Toggle appears in dropdown
- [ ] Toggle updates database
- [ ] Toggle updates UI
- [ ] Chat respects toggle
- [ ] Status indicator accurate
- [ ] Persists on reload
- [ ] No errors

### Feature C: Analytics Dashboard
- [ ] Token usage tracked
- [ ] Costs calculated
- [ ] Charts display data
- [ ] Page accessible
- [ ] No errors

---

## 🔄 IMPLEMENTATION ORDER

**Recommended sequence:**

1. **Start with Feature B** (GraphRAG Toggle) - 2-3 hours
   - Highest impact
   - Least complex
   - No external dependencies

2. **Then Feature A** (Settings Page) - 2-3 hours
   - Medium complexity
   - Adds useful functionality
   - Good learning foundation

3. **Finally Feature C** (Analytics) - 4-6 hours
   - Most complex
   - Requires tracking setup
   - Can reference existing plan

---

## 📞 NEXT STEPS

**To begin implementation:**

1. User approves this plan
2. Choose which feature to start with
3. Create feature branch
4. Begin with Phase X.1
5. Verify each phase before proceeding
6. Update progress logs
7. Test thoroughly
8. Get user approval before next feature

---

**Plan Status:** 📋 AWAITING USER APPROVAL
**Created:** October 13, 2025 - 21:00
**Ready to Execute:** Yes (after approval)
