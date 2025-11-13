# Fix Next.js Compilation Error - Clear Cache

## Problem
Next.js has a stale compilation error causing all routes to return 500:
```
⨯ ./app/api/search-summaries/export/route.ts:78:19
Syntax error: Unexpected reserved word 'await'.
```

The file is correct but Next.js cache is stale.

## Solution: Clear Cache and Restart

### Step 1: Stop Dev Server
Press `Ctrl+C` in the terminal running `npm run dev`

### Step 2: Clear Next.js Cache
```bash
# Delete .next folder
rm -rf .next

# Or on Windows PowerShell:
Remove-Item -Recurse -Force .next

# Or on Windows Command Prompt:
rd /s /q .next
```

### Step 3: Clear node_modules/.cache (optional but recommended)
```bash
# Delete node cache
rm -rf node_modules/.cache

# Or on Windows PowerShell:
Remove-Item -Recurse -Force node_modules\.cache

# Or on Windows Command Prompt:
rd /s /q node_modules\.cache
```

### Step 4: Restart Dev Server
```bash
npm run dev
```

## Alternative: One-Line Fix

```bash
# Linux/Mac/WSL
rm -rf .next node_modules/.cache && npm run dev

# Windows PowerShell
Remove-Item -Recurse -Force .next, node_modules\.cache; npm run dev

# Windows Command Prompt
rd /s /q .next node_modules\.cache && npm run dev
```

## Verify Fix

1. Wait for dev server to start (should see "Ready" message)
2. Open browser: http://localhost:3000/chat
3. Click on a conversation
4. Should load WITHOUT freeze or 500 errors

## If Still Broken

Check terminal for compilation errors:
- Look for red ⨯ symbols
- Check for syntax errors in TypeScript files
- Run: `npx tsc --noEmit` to check TypeScript errors

If you see the same error about `await import`, the file wasn't saved correctly.

Double-check line 79 in `app/api/search-summaries/export/route.ts`:
```typescript
// CORRECT (line 79):
const hmac = crypto.createHmac('sha256', signingSecret).update(payloadB64).digest('hex');

// WRONG (would cause error):
const crypto = await import('crypto');
```
