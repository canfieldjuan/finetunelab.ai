# Landing Page Widget - Setup Instructions
**Date:** December 5, 2025  
**Status:** Component Created - API Key Setup Required

---

## ✅ Files Created/Modified

### Created:
- ✅ `/components/widget/EmbeddedChatWidget.tsx` - Widget component (142 lines)

### Modified:
- ✅ `/app/landing/page.tsx` - Updated widget props to use gpt-4o-mini and your API key

---

## 🔑 Next Step: Create Widget API Key

Since you're using your own account (no demo user), you need to create a widget API key for the landing page.

### Option A: Create via UI (Easiest)

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Navigate to your settings page (if you have an API key management page)

3. Create a new API key named "Landing Page Demo Widget"

4. Copy the generated key (format: `wak_...`)

5. Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_DEMO_WIDGET_API_KEY=wak_your_key_here
   ```

### Option B: Create via API (Terminal)

If you don't have a UI for API key creation yet, run this:

```bash
# 1. Get your auth token
curl -X POST 'http://localhost:3000/api/auth/signin' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'

# 2. Use the token to create API key
curl -X POST 'http://localhost:3000/api/user/api-keys' \
  -H 'Authorization: Bearer YOUR_TOKEN_FROM_STEP_1' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Landing Page Demo Widget"
  }'

# 3. Copy the returned API key and add to .env.local
```

### Option C: Create via Supabase (Database)

If the API endpoint doesn't exist yet, you can create it directly in Supabase:

```sql
-- Run in Supabase SQL Editor

-- 1. Generate API key (you'll need to replace the hash)
-- Use this Node.js script to generate key:
-- const { generateApiKey } = require('./lib/auth/api-key-generator');
-- const { key, keyHash } = generateApiKey();
-- console.log('Key:', key, 'Hash:', keyHash);

INSERT INTO widget_api_keys (
  user_id,
  name,
  key_hash,
  key_prefix,
  is_active
) VALUES (
  'YOUR_USER_ID_HERE',
  'Landing Page Demo Widget',
  'GENERATED_KEY_HASH_HERE',
  'wak_first12chars',
  true
);
```

---

## 🔧 Environment Variable Setup

Add this to your `.env.local` file:

```bash
# Landing Page Widget API Key
NEXT_PUBLIC_DEMO_WIDGET_API_KEY=wak_your_generated_key_here
```

**Note:** The `NEXT_PUBLIC_` prefix is required because this runs in the browser. The key will be visible in the client-side code, but that's acceptable for a demo widget. You can monitor usage and revoke/rotate the key if needed.

---

## 🚀 Testing After Setup

1. **Restart dev server** (to pick up new env variable):
   ```bash
   npm run dev
   ```

2. **Navigate to landing page**:
   ```
   http://localhost:3000/landing
   ```

3. **Verify widget loads**:
   - Should see "Talk to Atlas" widget
   - Chat interface loads in iframe
   - Can send and receive messages
   - Uses gpt-4o-mini model

4. **Check console** for any errors:
   - Open browser DevTools (F12)
   - Look for `[EmbeddedChatWidget]` logs
   - Verify no API key validation errors

---

## 🐛 Troubleshooting

### Widget shows "Loading chat..." forever
- **Cause:** Missing or invalid API key
- **Fix:** Verify `NEXT_PUBLIC_DEMO_WIDGET_API_KEY` is set correctly

### "Invalid API key" error in console
- **Cause:** API key format incorrect or not in database
- **Fix:** Regenerate API key, verify it starts with `wak_`

### Chat page requires login
- **Cause:** Widget mode not detected
- **Fix:** Verify iframe URL includes `?widget=true&key=...`

### Iframe doesn't load
- **Cause:** CORS or sandbox restrictions
- **Fix:** Check console for errors, verify same-origin policy

---

## 📝 Update Main Page Router

Don't forget - you already updated `/app/page.tsx` to redirect to `/landing` for non-authenticated users:

```tsx
// app/page.tsx
if (!loading) {
  if (user) {
    router.push('/chat');  // Authenticated users → chat
  } else {
    router.push('/landing');  // Non-authenticated → landing page
  }
}
```

This means visitors will automatically see your new landing page with the widget! 🎉

---

## 🔄 When Ready to Deploy Your Model

When your fine-tuned Mistral/Qwen model is ready:

1. Deploy model to your inference server
2. Get model ID (e.g., `ft-mistral-8b-atlas-v1`)
3. Update landing page:

```tsx
// app/landing/page.tsx
<EmbeddedChatWidget 
  defaultModel="ft-mistral-8b-atlas-v1"  // ← Change this
  // ... rest of props
/>
```

---

## ✅ Success Checklist

- [ ] Widget API key created
- [ ] API key added to `.env.local`
- [ ] Dev server restarted
- [ ] Landing page loads at `/landing`
- [ ] Widget visible on page
- [ ] Chat interface loads in iframe
- [ ] Can send messages
- [ ] Receives responses from gpt-4o-mini
- [ ] No console errors
- [ ] Mobile responsive

---

**Ready to create your API key?** Let me know if you need help with any of the steps above!
