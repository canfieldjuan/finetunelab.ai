# Apply Export/Archive Schema

## Quick Steps:

1. **Open Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard/project/tkizlemssfmrfluychsn/sql

2. **Open the SQL Editor** (left sidebar)

3. **Create a new query**

4. **Copy the entire contents** of:
   ```
   docs/schema_updates/05_export_archive.sql
   ```

5. **Paste into the SQL editor**

6. **Click "Run" button** (or press Cmd/Ctrl + Enter)

7. **Wait for confirmation** - Should see "Success" messages

## What This Schema Adds:

- ✅ `archived`, `archived_at`, `archived_by` columns to `conversations` table
- ✅ `conversation_exports` table for tracking exports
- ✅ RLS policies for security
- ✅ Helper functions for bulk operations
- ✅ Indexes for performance

## Verify UI Elements (Already Available):

Even before applying the schema, you should see these new elements at http://localhost:3000:

### Header (Top Right):
- **Export** button (between Knowledge and Logout)
- **Archive** button

### Conversation Menu (...):
- **Archive** option (between "Add to Graph" and "Delete")

The buttons will work after applying the schema!

## Troubleshooting:

If you don't see the UI elements:
1. Make sure dev server is running: `npm run dev`
2. Hard refresh browser: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
3. Check browser console for errors
