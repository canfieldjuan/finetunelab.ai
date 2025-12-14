# SAML SSO Implementation - Multi-Tenant Enterprise SSO
**Date:** 2025-12-13
**Status:** PAUSED - UI Complete, IdP Config Pending
**Priority:** High

## Current State (as of 2025-12-13)

### COMPLETED
- [x] `signInWithSSO` function added to `contexts/AuthContext.tsx` (lines 221-242)
- [x] "Sign in with SSO" button added to login page
- [x] SSO email input flow implemented in `app/login/page.tsx`
- [x] Domain extraction from email working
- [x] Error handling for unconfigured domains
- [x] TypeScript types verified, no errors

### PENDING (IdP Configuration)
- [ ] Enable SAML 2.0 in Supabase Dashboard
- [ ] Configure Auth0 SAML app with correct ACS URL
- [ ] Get metadata URL from Auth0
- [ ] Run `supabase sso add` command
- [ ] Test end-to-end SSO flow

### Configuration Details (When Resuming)
**Supabase Project:** `tkizlemssfmrfluychsn`
**Target Domain:** `finetunelab.ai`
**IdP:** Auth0 (`dev-odbkn3pnh508hmnn.us.auth0.com`)

**Auth0 SAML Settings:**
- ACS URL: `https://tkizlemssfmrfluychsn.supabase.co/auth/v1/sso/saml/acs`
- Audience: `https://tkizlemssfmrfluychsn.supabase.co/auth/v1/sso/saml/metadata`

**Supabase CLI Command:**
```bash
supabase sso add \
  --type saml \
  --domain finetunelab.ai \
  --metadata-url "https://dev-odbkn3pnh508hmnn.us.auth0.com/samlp/metadata/<CLIENT_ID>"
```

---

## Overview
Add "Sign in with SSO" button to login page that allows enterprise customers to authenticate via their identity provider (Okta, Azure AD, Google Workspace).

## Requirements
- SSO button on login page
- User enters email → extract domain → redirect to appropriate IdP
- Support: Okta, Azure AD, Google Workspace
- Multi-tenant: Each enterprise customer can connect their own IdP

---

## How Supabase SAML SSO Works

### Sign-In Flow (SP-Initiated)
```typescript
// User enters email: john@company.com
// Extract domain: company.com
// Call Supabase SSO method:
const { data, error } = await supabase.auth.signInWithSSO({
  domain: 'company.com',
  options: {
    redirectTo: 'https://finetunelab.ai/auth/callback',
  },
});

// User is redirected to their IdP (e.g., Okta)
// After auth, redirected back to our callback URL
```

### Prerequisites
1. Supabase Pro plan or higher
2. SSO providers registered via Supabase CLI
3. Each enterprise domain configured with their IdP

---

## Phased Implementation Plan

### Phase 1: Supabase SSO Configuration
**Goal:** Register SSO providers in Supabase

**Steps:**
1. Enable SAML 2.0 in Supabase Dashboard (Auth → Providers)
2. Use Supabase CLI to add SSO providers:
```bash
# Add an Okta provider for company.com
supabase sso add \
  --type saml \
  --domain company.com \
  --metadata-url https://company.okta.com/app/xxx/sso/saml/metadata
```

**Supabase CLI Commands:**
| Command | Purpose |
|---------|---------|
| `supabase sso add` | Add new SSO provider |
| `supabase sso list` | List configured providers |
| `supabase sso show <id>` | Show provider details |
| `supabase sso update <id>` | Update provider config |
| `supabase sso remove <id>` | Remove provider |

---

### Phase 2: Login Page UI Changes
**Goal:** Add SSO sign-in flow to login page

**File to modify:** `app/login/page.tsx`

**UI Flow:**
```
1. Initial State:
   [Continue with GitHub]
   [Continue with Google]
   [Sign in with SSO]  ← NEW
   ─────────────────
   Or continue with email
   [Email input]
   [Password input]
   [Login]

2. After clicking "Sign in with SSO":
   [← Back]
   Enter your work email
   [Email input: john@company.com]
   [Continue with SSO]

3. On submit:
   - Extract domain from email
   - Call signInWithSSO({ domain })
   - Handle redirect
```

**Code Changes:**
```typescript
// New state for SSO flow
const [showSSOFlow, setShowSSOFlow] = useState(false);
const [ssoEmail, setSsoEmail] = useState('');

// SSO sign-in handler
async function handleSSOSignIn(e: React.FormEvent) {
  e.preventDefault();
  setError(null);

  // Extract domain from email
  const domain = ssoEmail.split('@')[1];
  if (!domain) {
    setError('Please enter a valid work email');
    return;
  }

  console.log('[Login] SSO sign in for domain:', domain);

  const { data, error } = await supabase.auth.signInWithSSO({
    domain: domain,
    options: {
      redirectTo: `${window.location.origin}/chat`,
    },
  });

  if (error) {
    // Domain not configured for SSO
    if (error.message.includes('No SSO provider')) {
      setError('SSO is not configured for this domain. Please contact your administrator.');
    } else {
      setError(error.message);
    }
    return;
  }

  // Redirect to IdP
  if (data?.url) {
    window.location.href = data.url;
  }
}
```

---

### Phase 3: Auth Callback Handler (if needed)
**Goal:** Handle SSO callback for token exchange

**File:** `app/auth/callback/route.ts` (may already exist)

Supabase typically handles this automatically, but verify the callback route exists.

---

### Phase 4: Admin UI for SSO Management (Future)
**Goal:** Allow admins to configure SSO for their organization

**Features:**
- View SSO configuration status
- Download SP metadata for IdP setup
- Test SSO connection

**Note:** Initial setup will be done via Supabase CLI. Admin UI is a future enhancement.

---

## Files to Modify

| File | Changes | Risk |
|------|---------|------|
| `app/login/page.tsx` | Add SSO button and flow | Low |
| `contexts/AuthContext.tsx` | Add signInWithSSO if not exposed | Low |

## Files to Create

| File | Purpose |
|------|---------|
| `app/auth/callback/route.ts` | SSO callback handler (if not exists) |

---

## Identity Provider Setup Guides

### Okta Setup
1. Create SAML 2.0 app in Okta Admin
2. Set ACS URL: `https://<project>.supabase.co/auth/v1/sso/saml/acs`
3. Set Entity ID: `https://<project>.supabase.co/auth/v1/sso/saml/metadata`
4. Download metadata XML or get metadata URL
5. Register in Supabase via CLI

### Azure AD Setup
1. Create Enterprise Application in Azure AD
2. Configure SAML SSO
3. Set Reply URL: `https://<project>.supabase.co/auth/v1/sso/saml/acs`
4. Set Identifier: `https://<project>.supabase.co/auth/v1/sso/saml/metadata`
5. Download Federation Metadata XML
6. Register in Supabase via CLI

### Google Workspace Setup
1. Admin Console → Apps → SAML Apps
2. Add custom SAML app
3. Set ACS URL and Entity ID (same as above)
4. Download IdP metadata
5. Register in Supabase via CLI

---

## Azure Blob for Datasets (Separate Feature)

User also mentioned "Azure blob for datasets" - this is a separate feature:
- Allow users to connect Azure Blob Storage as a dataset source
- Import training data from Azure Blob containers
- **Will be tracked separately**

---

## Testing Checklist

### Phase 1 Verification
- [ ] SAML 2.0 enabled in Supabase Dashboard
- [ ] At least one test SSO provider registered via CLI
- [ ] `supabase sso list` shows the provider

### Phase 2 Verification
- [ ] "Sign in with SSO" button appears on login page
- [ ] Clicking button shows email input form
- [ ] Entering email extracts domain correctly
- [ ] signInWithSSO called with correct domain
- [ ] Redirect to IdP works
- [ ] Return from IdP logs user in
- [ ] Error shown for unconfigured domains

---

## Error Handling

| Error | User Message |
|-------|--------------|
| Domain not configured | "SSO is not configured for this domain. Please contact your administrator or use email/password login." |
| IdP unreachable | "Unable to reach your identity provider. Please try again." |
| SAML assertion invalid | "Authentication failed. Please try again or contact support." |

---

## Approval Required

Please confirm:
1. You're on Supabase Pro plan (required for SAML)
2. You have a test IdP to configure (Okta/Azure AD dev account)
3. Login page UI changes look acceptable

**Awaiting approval before implementation.**
