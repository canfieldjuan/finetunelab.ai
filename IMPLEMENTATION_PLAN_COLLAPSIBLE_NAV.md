# Implementation Plan: Collapsible Navigation Groups

**Feature Branch:** `feature/analytics-export`  
**Date Created:** October 30, 2025  
**Status:** Planning Phase  
**Priority:** Medium  

---

## 🎯 Objective

Implement collapsible navigation groups in the AppSidebar to reduce visual crowding on the chat page while maintaining easy access to all pages.

---

## 📋 Current State Analysis

### Existing Navigation Structure

**File:** `components/layout/AppSidebar.tsx`

**Current Nav Items (8 total):**

1. Home (`/welcome`)
2. Chat (`/chat`)
3. Models (`/models`)
4. Secrets (`/secrets`)
5. Training (`/training`)
6. DAG Pipelines (`/training/dag`)
7. Analytics (`/analytics`)
8. Account (`/account`) ← **MOVE TO BOTTOM MENU**

### Pages Using AppSidebar

- ✅ `/app/chat/page.tsx` - Uses model selector + menuItems + children (conversations)
- ✅ `/app/models/page.tsx` - Basic usage
- ✅ `/app/secrets/page.tsx` - Basic usage
- ✅ `/app/training/page.tsx` - Basic usage
- ✅ `/app/analytics/page.tsx` - Basic usage
- ✅ `/app/analytics/sentiment/page.tsx` - Basic usage
- ✅ `/app/account/page.tsx` - Basic usage
- ⚠️ `/app/account/page_old.tsx` - Old version (ignore)

### Current Bottom Menu Items (Chat Page Only)

1. Settings
2. Archived Conversations
3. Export Conversation
4. Add to KGraph

---

## 🎨 Proposed New Structure

### Navigation Groups

```
├─ 🏠 Core
│  ├─ Home
│  ├─ Chat
│  └─ Models
│
├─ 🎓 Training (collapsible)
│  ├─ Training Jobs
│  ├─ DAG Pipelines
│  └─ Analytics
│
└─ 🔑 Configuration (collapsible)
   └─ Secrets
```

### Bottom Menu (All Pages)

```
User Dropdown Menu:
├─ Settings (chat page only)
├─ Archived Conversations (chat page only)
├─ Export Conversation (chat page only)
├─ Add to KGraph (chat page only)
├─ Account Settings ← NEW
└─ Log out
```

---

## 📐 Technical Design

### New TypeScript Interfaces

```typescript
interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  defaultExpanded?: boolean;
  collapsible?: boolean;
}

interface NavItem {
  id: string;
  href: string;
  icon: LucideIcon;
  label: string;
}
```

### State Management

```typescript
// Add to AppSidebar component state
const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
  new Set(['core']) // Core always expanded by default
);

// Persist in localStorage
useEffect(() => {
  const saved = localStorage.getItem('sidebar-expanded-groups');
  if (saved) {
    setExpandedGroups(new Set(JSON.parse(saved)));
  }
}, []);

useEffect(() => {
  localStorage.setItem('sidebar-expanded-groups', 
    JSON.stringify(Array.from(expandedGroups))
  );
}, [expandedGroups]);
```

### Smart Expansion Logic

- **Core group:** Always expanded, not collapsible
- **Training group:** Auto-expand when on training/dag/analytics pages
- **Configuration group:** Auto-expand when on secrets page
- **User preference:** Persisted via localStorage

---

## 🔧 Implementation Phases

### Phase 1: Add Account to Bottom Menu ✅ (Safe, Non-Breaking)

**Files to Modify:**

1. `components/layout/AppSidebar.tsx`
   - Add Account link to user dropdown menu
   - Keep Account in main nav for now (both places temporarily)

**Changes:**

```typescript
// Line ~125 in AppSidebar.tsx - Add before Log out button
<Link href="/account">
  <button
    type="button"
    onClick={() => setShowUserSettings(false)}
    className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-3 rounded-md cursor-pointer"
  >
    <UserIcon className="w-4 h-4" />
    <span>Account Settings</span>
  </button>
</Link>
```

**Testing:**

- ✅ Verify Account link appears in dropdown
- ✅ Click Account → navigates to `/account`
- ✅ Dropdown closes after click
- ✅ All other pages still work

**Rollback:** Easy - just remove the added link

---

### Phase 2: Create Collapsible Group Component ✅ (Isolated Component)

**Files to Create:**

1. `components/layout/CollapsibleNavGroup.tsx` (NEW)

**Component Structure:**

```typescript
interface CollapsibleNavGroupProps {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  currentPage: string;
  expanded: boolean;
  onToggle: () => void;
  collapsible: boolean;
}

export function CollapsibleNavGroup({ ... }) {
  const hasActiveItem = items.some(item => item.id === currentPage);
  
  return (
    <div>
      {/* Group Header */}
      <button
        onClick={onToggle}
        disabled={!collapsible}
        className="..."
      >
        <Icon />
        <span>{label}</span>
        {collapsible && <ChevronDown className={expanded ? 'rotate-180' : ''} />}
      </button>
      
      {/* Collapsible Items */}
      {expanded && (
        <div className="ml-4 mt-1 space-y-0.5">
          {items.map(item => (
            <NavLink key={item.id} {...item} isActive={item.id === currentPage} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Testing:**

- ✅ Component renders in isolation
- ✅ Collapse/expand animation works
- ✅ Chevron icon rotates correctly
- ✅ Active state highlights work
- ✅ Non-collapsible groups stay open

**Rollback:** Delete new file, no impact on existing code

---

### Phase 3: Refactor AppSidebar to Use Groups ⚠️ (Breaking Change)

**Files to Modify:**

1. `components/layout/AppSidebar.tsx`
   - Replace flat navItems with navGroups
   - Add expandedGroups state
   - Implement smart auto-expansion
   - Remove Account from main nav

**Changes:**

```typescript
// Replace navItems array with navGroups
const navGroups: NavGroup[] = [
  {
    id: 'core',
    label: 'Core',
    icon: Home,
    collapsible: false, // Always expanded
    items: [
      { id: 'welcome', href: '/welcome', icon: Home, label: 'Home' },
      { id: 'chat', href: '/chat', icon: MessageSquare, label: 'Chat' },
      { id: 'models', href: '/models', icon: Boxes, label: 'Models' },
    ]
  },
  {
    id: 'training',
    label: 'Training',
    icon: GraduationCap,
    collapsible: true,
    defaultExpanded: true,
    items: [
      { id: 'training', href: '/training', icon: GraduationCap, label: 'Training Jobs' },
      { id: 'dag', href: '/training/dag', icon: GitBranch, label: 'DAG Pipelines' },
      { id: 'analytics', href: '/analytics', icon: BarChart3, label: 'Analytics' },
    ]
  },
  {
    id: 'config',
    label: 'Configuration',
    icon: Settings,
    collapsible: true,
    defaultExpanded: false,
    items: [
      { id: 'secrets', href: '/secrets', icon: Key, label: 'Secrets' },
    ]
  }
];

// Smart auto-expansion based on current page
useEffect(() => {
  const trainingPages = ['training', 'dag', 'analytics'];
  const configPages = ['secrets'];
  
  if (trainingPages.includes(currentPage)) {
    setExpandedGroups(prev => new Set([...prev, 'training']));
  } else if (configPages.includes(currentPage)) {
    setExpandedGroups(prev => new Set([...prev, 'config']));
  }
}, [currentPage]);
```

**Testing Checklist:**

- ✅ All 7 pages render correctly
- ✅ Active page highlights work
- ✅ Navigation links work
- ✅ Collapse/expand persists in localStorage
- ✅ Auto-expansion works on page load
- ✅ Chat page conversations still scroll properly
- ✅ Model selector still works on chat page
- ✅ Bottom menu still works

**Rollback:** Git revert to previous commit

---

### Phase 4: Visual Polish & Spacing Optimization ✨

**Files to Modify:**

1. `components/layout/AppSidebar.tsx`
2. `components/layout/CollapsibleNavGroup.tsx`

**CSS Adjustments:**

```typescript
// Reduce spacing between items
space-y-1 → space-y-0.5

// Smaller text for nav items
text-sm → text-xs

// Smaller icons
w-4 h-4 → w-3.5 h-3.5

// Tighter padding
py-2 → py-1.5
px-3 → px-2.5

// Indent for grouped items
ml-4 (for items under collapsible groups)
```

**Testing:**

- ✅ Spacing looks balanced
- ✅ Text is readable
- ✅ Icons align properly
- ✅ Touch targets are still usable (min 44px height)

**Rollback:** Revert CSS changes

---

## 🧪 Testing Strategy

### Unit Testing (Manual)

1. **Navigation Persistence**
   - Collapse Training group
   - Refresh page
   - Verify Training remains collapsed

2. **Auto-Expansion**
   - Click Training Jobs
   - Verify Training group expands
   - Navigate to Chat
   - Verify Training stays expanded (user preference)

3. **Account Migration**
   - Open user dropdown
   - Click Account Settings
   - Verify navigation to `/account`
   - Verify Account no longer in main nav

### Integration Testing

1. **Chat Page**
   - ✅ Model selector works
   - ✅ Conversations load
   - ✅ Navigation doesn't break layout
   - ✅ Bottom menu items work

2. **All Pages**
   - ✅ AppSidebar renders on all 7 pages
   - ✅ Active page highlights correctly
   - ✅ No console errors

### Browser Testing

- ✅ Chrome
- ✅ Firefox
- ✅ Edge
- ✅ Safari (if available)

### Accessibility Testing

- ✅ Keyboard navigation (Tab, Enter, Space)
- ✅ Screen reader announces group states
- ✅ ARIA attributes correct (`aria-expanded`, `aria-controls`)

---

## 🚨 Risk Assessment

### Low Risk ✅

- Phase 1 (Add Account to bottom menu) - Additive only
- Phase 2 (Create component) - Isolated, no integration

### Medium Risk ⚠️

- Phase 3 (Refactor AppSidebar) - Touches all pages
- Phase 4 (CSS changes) - Visual regression possible

### Mitigation Strategies

1. **Feature Flag** (Optional)
   - Add `useCollapsibleNav` localStorage flag
   - Fall back to old nav if flag is false
   - Easy A/B testing

2. **Git Branching**
   - Create feature branch: `feature/collapsible-nav-groups`
   - Commit after each phase
   - Easy rollback points

3. **Backup**
   - Copy `AppSidebar.tsx` → `AppSidebar.backup.tsx` before Phase 3
   - Keep for 2 weeks after deployment

---

## 📊 Success Metrics

### User Experience

- [ ] Navigation takes up 20-25% less vertical space
- [ ] No increase in clicks to reach any page (max +1 for collapsed items)
- [ ] No bugs reported in first week

### Technical

- [ ] No TypeScript errors
- [ ] No console errors
- [ ] All tests pass
- [ ] No performance degradation

### Business

- [ ] User feedback positive
- [ ] No support tickets about "can't find Account page"
- [ ] Navigation feels less crowded (subjective but measurable via survey)

---

## 📅 Timeline Estimate

### Phase 1: Add Account to Bottom Menu

- **Time:** 30 minutes
- **Testing:** 15 minutes
- **Total:** 45 minutes

### Phase 2: Create Collapsible Component

- **Development:** 1.5 hours
- **Testing:** 30 minutes
- **Total:** 2 hours

### Phase 3: Refactor AppSidebar

- **Development:** 2 hours
- **Testing:** 1 hour
- **Bug fixes:** 30 minutes (buffer)
- **Total:** 3.5 hours

### Phase 4: Visual Polish

- **Development:** 1 hour
- **Testing:** 30 minutes
- **Total:** 1.5 hours

### **Grand Total:** ~7.5 hours (one work day)

---

## 🔄 Rollback Plan

### If Phase 1 Fails

```bash
git revert HEAD
# Remove Account link from dropdown
```

### If Phase 2 Fails

```bash
# Delete CollapsibleNavGroup.tsx
rm components/layout/CollapsibleNavGroup.tsx
```

### If Phase 3 Fails

```bash
# Restore from backup
cp components/layout/AppSidebar.backup.tsx components/layout/AppSidebar.tsx
# Or revert commits
git revert <phase-3-commit-hash>
```

### If Phase 4 Fails

```bash
# Revert CSS changes only
git checkout components/layout/AppSidebar.tsx
git checkout components/layout/CollapsibleNavGroup.tsx
```

---

## 📝 Notes & Assumptions

### Assumptions

1. Users are familiar with collapsible UI patterns
2. localStorage is available (fallback to default expanded state if not)
3. No mobile-specific requirements (will inherit responsive behavior)
4. Training-related pages are accessed more frequently than Secrets

### Future Enhancements (Out of Scope)

- [ ] Drag-and-drop to reorder groups
- [ ] Custom group names
- [ ] "Pin" favorite pages to top
- [ ] Icon-only collapsed mode
- [ ] Search within navigation

---

## ✅ Pre-Implementation Checklist

Before starting Phase 1:

- [ ] Read and understand full implementation plan
- [ ] Verify current training job is stable (no pending work)
- [ ] Create feature branch: `feature/collapsible-nav-groups`
- [ ] Backup current `AppSidebar.tsx`
- [ ] Confirm all pages currently working
- [ ] Open DevTools for console monitoring

---

## 📞 Approval & Sign-Off

**Created by:** GitHub Copilot  
**Reviewed by:** Juan (Product Owner)  
**Status:** ⏳ Pending Approval  

**Approval Decision:**

- [ ] ✅ Approved - Proceed with implementation
- [ ] ⏸️ Hold - Need more discussion
- [ ] ❌ Rejected - Not needed at this time

**Comments:**
_[To be filled by Juan]_

---

**End of Implementation Plan**
