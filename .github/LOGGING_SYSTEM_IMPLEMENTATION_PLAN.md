# Structured Logging System - Implementation Plan

**Created:** 2025-10-28  
**Status:** Planning Phase  
**Objective:** Replace scattered console.log statements with structured, filterable logging system

---

## 📊 Current State Analysis

### Console.log Usage Across Project

- **Chat.tsx**: 100+ console statements (render tracking, TTS, STT, research, conversations)
- **API routes**: Extensive DEBUG/ERROR logging in settings, chat, graphrag routes  
- **Test files**: 50+ console statements in E2E and integration tests
- **Total estimated**: 500+ console statements across codebase

### Problems Identified

1. **Console Noise**: Cannot filter by module or severity
2. **No Production Control**: All logs run in production
3. **Inconsistent Format**: Mix of `[Module]`, `[DEBUG]`, no standards
4. **Performance Impact**: Excessive logging in render paths
5. **Hard to Debug**: Cannot isolate specific subsystems

---

## 🎯 Solution: Structured Logger

### Design Principles

- ✅ **Zero Breaking Changes**: Drop-in replacement for console.log
- ✅ **Environment-Aware**: Auto-detect dev vs production
- ✅ **Performance**: Zero overhead when disabled
- ✅ **Filterable**: By module, level, timestamp
- ✅ **Backwards Compatible**: Existing logs continue working during migration

---

## 📦 Phase 1: Create Logger Infrastructure (Safe, No Dependencies)

### File: `lib/utils/logger.ts`

```typescript
// Log levels (ordered by severity)
export enum LogLevel {
  ERROR = 0,   // Critical errors only
  WARN = 1,    // Warnings and errors
  INFO = 2,    // General information (default for production)
  DEBUG = 3,   // Detailed debugging (default for development)
  TRACE = 4    // Ultra-verbose (render cycles, etc.)
}

// Module names for filtering
export type LogModule = 
  | 'Chat'
  | 'API'
  | 'Settings'
  | 'GraphRAG'
  | 'Research'
  | 'Auth'
  | 'Training'
  | 'Export'
  | 'TTS'
  | 'STT'
  | 'Models'
  | 'Supabase'
  | 'Widget'
  | 'System';

interface LoggerConfig {
  level: LogLevel;
  enabledModules: LogModule[] | 'all';
  enableTimestamp: boolean;
  enableStackTrace: boolean;
}

class Logger {
  private config: LoggerConfig;

  constructor() {
    // Default config based on environment
    const isDev = process.env.NODE_ENV !== 'production';
    
    this.config = {
      level: isDev ? LogLevel.DEBUG : LogLevel.INFO,
      enabledModules: 'all',
      enableTimestamp: true,
      enableStackTrace: false,
    };

    // Allow runtime configuration via localStorage (browser only)
    if (typeof window !== 'undefined') {
      this.loadBrowserConfig();
    }
  }

  private loadBrowserConfig() {
    try {
      const stored = localStorage.getItem('logger_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = { ...this.config, ...parsed };
      }
    } catch (e) {
      // Silently fail - don't break app if localStorage issues
    }
  }

  private shouldLog(level: LogLevel, module: LogModule): boolean {
    // Check level threshold
    if (level > this.config.level) return false;
    
    // Check module filter
    if (this.config.enabledModules !== 'all') {
      if (!this.config.enabledModules.includes(module)) return false;
    }
    
    return true;
  }

  private formatMessage(
    level: LogLevel,
    module: LogModule,
    message: string,
    data?: any
  ): string {
    const parts: string[] = [];
    
    // Timestamp
    if (this.config.enableTimestamp) {
      parts.push(new Date().toISOString());
    }
    
    // Level
    parts.push(`[${LogLevel[level]}]`);
    
    // Module
    parts.push(`[${module}]`);
    
    // Message
    parts.push(message);
    
    return parts.join(' ');
  }

  error(module: LogModule, message: string, data?: any) {
    if (!this.shouldLog(LogLevel.ERROR, module)) return;
    
    const formatted = this.formatMessage(LogLevel.ERROR, module, message, data);
    console.error(formatted, data || '');
    
    // Optionally send to error tracking service (Sentry, etc.)
  }

  warn(module: LogModule, message: string, data?: any) {
    if (!this.shouldLog(LogLevel.WARN, module)) return;
    
    const formatted = this.formatMessage(LogLevel.WARN, module, message, data);
    console.warn(formatted, data || '');
  }

  info(module: LogModule, message: string, data?: any) {
    if (!this.shouldLog(LogLevel.INFO, module)) return;
    
    const formatted = this.formatMessage(LogLevel.INFO, module, message, data);
    console.info(formatted, data || '');
  }

  debug(module: LogModule, message: string, data?: any) {
    if (!this.shouldLog(LogLevel.DEBUG, module)) return;
    
    const formatted = this.formatMessage(LogLevel.DEBUG, module, message, data);
    console.log(formatted, data || '');
  }

  trace(module: LogModule, message: string, data?: any) {
    if (!this.shouldLog(LogLevel.TRACE, module)) return;
    
    const formatted = this.formatMessage(LogLevel.TRACE, module, message, data);
    console.log(formatted, data || '');
  }

  // Runtime configuration helpers
  setLevel(level: LogLevel) {
    this.config.level = level;
    this.saveBrowserConfig();
  }

  setModules(modules: LogModule[] | 'all') {
    this.config.enabledModules = modules;
    this.saveBrowserConfig();
  }

  private saveBrowserConfig() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('logger_config', JSON.stringify(this.config));
      } catch (e) {
        // Silently fail
      }
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const log = {
  error: (module: LogModule, msg: string, data?: any) => logger.error(module, msg, data),
  warn: (module: LogModule, msg: string, data?: any) => logger.warn(module, msg, data),
  info: (module: LogModule, msg: string, data?: any) => logger.info(module, msg, data),
  debug: (module: LogModule, msg: string, data?: any) => logger.debug(module, msg, data),
  trace: (module: LogModule, msg: string, data?: any) => logger.trace(module, msg, data),
};
```

**Validation Steps:**

1. ✅ Create file - no dependencies, pure TypeScript
2. ✅ Test in isolation - create test file
3. ✅ Verify no build errors
4. ✅ Test browser runtime configuration

---

## 📦 Phase 2: Create Migration Test Case (Verify Before Wide Rollout)

### File: `components/__tests__/logger-migration.test.tsx`

```typescript
import { log } from '@/lib/utils/logger';

describe('Logger Migration', () => {
  it('should replace console.log without breaking', () => {
    // Old way
    console.log('[Chat] Test message');
    
    // New way - exactly equivalent
    log.debug('Chat', 'Test message');
    
    expect(true).toBe(true);
  });

  it('should handle data objects', () => {
    const testData = { userId: '123', action: 'send' };
    
    // Old way
    console.log('[Chat] User action:', testData);
    
    // New way
    log.debug('Chat', 'User action', testData);
    
    expect(true).toBe(true);
  });

  it('should respect log levels', () => {
    // These should be visible in dev
    log.debug('Chat', 'Debug message');
    log.trace('Chat', 'Trace message');
    
    // These should always be visible
    log.error('Chat', 'Error message');
    log.warn('Chat', 'Warning message');
  });
});
```

**Validation Steps:**

1. ✅ Run test - verify logger works
2. ✅ Test in browser console manually
3. ✅ Verify localStorage configuration works

---

## 📦 Phase 3: Migrate One Component (Chat.tsx) - Proof of Concept

### Target: `components/Chat.tsx` (100+ log statements)

**Migration Strategy:**

1. **Group A - Render Logs** (TRACE level):

   ```typescript
   // Before:
   console.log('[Chat] RENDER #', renderCount.current);
   
   // After:
   log.trace('Chat', `RENDER #${renderCount.current}`);
   ```

2. **Group B - User Actions** (DEBUG level):

   ```typescript
   // Before:
   console.log('[Chat] Toggle TTS for message:', messageId);
   
   // After:
   log.debug('Chat', 'Toggle TTS for message', { messageId });
   ```

3. **Group C - Errors** (ERROR level):

   ```typescript
   // Before:
   console.error('[Chat] TTS error:', error);
   
   // After:
   log.error('Chat', 'TTS error', { error });
   ```

**Validation Steps:**

1. ✅ Import logger at top of file
2. ✅ Replace logs in small batches (10-20 at a time)
3. ✅ Test each batch:
   - Page loads correctly
   - Console shows logs
   - No TypeScript errors
   - No runtime errors
4. ✅ Test filtering:
   - Set level to ERROR - should only see errors
   - Set modules to ['API'] - should not see Chat logs
5. ✅ Commit after successful batch

---

## 📦 Phase 4: Rollout to API Routes

### Target: `app/api/**/*.ts` files

**Examples:**

- `app/api/settings/route.ts`
- `app/api/chat/route.ts`  
- `app/api/graphrag/**/route.ts`

**Migration Pattern:**

```typescript
// Before:
console.log('[Settings API] [DEBUG] Fetching settings for user:', user.id);

// After:
log.debug('Settings', 'Fetching settings for user', { userId: user.id });
```

**Validation:** Same as Phase 3 - batch migrate, test, commit

---

## 📦 Phase 5: Global Console Filter (Optional Enhancement)

### Create Browser DevTools Helper

Add to `public/logger-helper.js`:

```javascript
// Run in browser console to filter logs
window.setLogLevel = (level) => {
  localStorage.setItem('logger_config', JSON.stringify({
    level: { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3, TRACE: 4 }[level],
    enabledModules: 'all'
  }));
  console.log('✅ Log level set to:', level, '- Reload page to apply');
};

window.setLogModules = (modules) => {
  localStorage.setItem('logger_config', JSON.stringify({
    level: 3, // DEBUG
    enabledModules: modules
  }));
  console.log('✅ Log modules set to:', modules, '- Reload page to apply');
};

// Helpers
window.showOnlyErrors = () => window.setLogLevel('ERROR');
window.showOnlyChat = () => window.setLogModules(['Chat']);
window.showAllLogs = () => {
  localStorage.removeItem('logger_config');
  console.log('✅ Showing all logs - Reload page to apply');
};
```

---

## 📋 Progress Tracking Checklist

### Phase 1: Infrastructure ✅ READY TO IMPLEMENT

- [ ] Create `lib/utils/logger.ts`
- [ ] Verify TypeScript compilation
- [ ] Test logger in browser console
- [ ] Verify localStorage config works

### Phase 2: Testing

- [ ] Create test file
- [ ] Run tests - verify logger works
- [ ] Manual browser testing

### Phase 3: Pilot Migration (Chat.tsx)

- [ ] Import logger
- [ ] Batch 1: Render logs (lines 114-117) → TRACE
- [ ] Test - page loads, logs visible
- [ ] Batch 2: TTS logs (lines 186-227) → DEBUG
- [ ] Test - TTS functionality works
- [ ] Batch 3: Research logs (lines 255-531) → DEBUG/INFO
- [ ] Test - research polling works
- [ ] Batch 4: Conversation logs (lines 562-670) → DEBUG/INFO
- [ ] Test - conversations load correctly
- [ ] Batch 5: Remaining logs
- [ ] Final test - full smoke test of Chat page
- [ ] Commit: "feat: Migrate Chat.tsx to structured logger"

### Phase 4: API Routes Migration

- [ ] Migrate `app/api/settings/route.ts`
- [ ] Migrate `app/api/chat/route.ts`
- [ ] Migrate GraphRAG routes
- [ ] Commit: "feat: Migrate API routes to structured logger"

### Phase 5: Global Rollout

- [ ] Migrate remaining components
- [ ] Add logger helper script
- [ ] Update documentation
- [ ] Commit: "feat: Complete structured logging migration"

---

## 🚨 Rollback Plan

If anything breaks:

```bash
# Revert last commit
git revert HEAD

# Or reset to before migration
git reset --hard <commit-before-migration>
```

Each phase is one commit - easy to revert individual pieces.

---

## 🎯 Success Criteria

**Before declaring success:**

1. ✅ All existing functionality works identically
2. ✅ Can filter logs by module in browser console
3. ✅ Can set log level (ERROR only in prod)
4. ✅ Performance unchanged (render times same)
5. ✅ Zero new console errors
6. ✅ Documentation updated

---

## 📝 Notes & Decisions

**2025-10-28 Initial Planning:**

- User confirmed 10GB+ project, 500+ console statements
- Goal: Better debugging, less noise, production-ready
- Approach: Phased rollout, test each step, commit frequently
- Timeline: Implement over multiple sessions, validate thoroughly

**Key Decisions:**

- Use localStorage for browser config (easy to test/debug)
- Singleton logger pattern (simple, zero config needed)
- Backwards compatible (old console.log still works)
- TRACE level for render logs (easily disabled)
- Module names match existing `[Module]` tags

---

## 🔄 Session Continuity Context

**What was done this session:**

- ✅ Analyzed current console.log usage (100+ in Chat.tsx alone)
- ✅ Created implementation plan with phases
- ✅ Designed logger system (zero dependencies, safe)
- ✅ Defined validation steps for each phase
- ✅ Created rollback plan

**Next session should:**

1. Review this plan
2. Ask user to confirm approach
3. Implement Phase 1 (create logger.ts)
4. Test thoroughly before proceeding
5. Get user approval before Phase 2

**Critical Reminders:**

- ⚠️ NEVER delete or overwrite progress logs
- ⚠️ ALWAYS verify changes work before next phase
- ⚠️ TEST each batch of migrations individually
- ⚠️ COMMIT after each successful phase
- ⚠️ NEVER assume - always verify with actual testing

---

**Last Updated:** 2025-10-28  
**Next Review:** When starting implementation session
