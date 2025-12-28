# VS Code AI Code Review Integration

Real-time AI code suggestions powered by your local Ollama + qwen2.5-coder:32b model!

## Features

✅ **On-Demand Review** - Review current file with a keyboard shortcut
✅ **Interactive Auto-Fix** - AI suggests fixes, you approve them
✅ **Real-time Watcher** - Auto-review files as you save them
✅ **Batch Review** - Review all staged files or entire workspace
✅ **$0 Cost** - Uses your RTX 3090 locally
✅ **100% Private** - Code never leaves your machine

---

## Quick Start

### 1. Install Keybindings (Optional but Recommended)

Copy the keybindings to your user settings:

```bash
# Linux/Mac
cat .vscode/keybindings.json >> ~/.config/Code/User/keybindings.json

# Windows
type .vscode\keybindings.json >> %APPDATA%\Code\User\keybindings.json
```

Or manually:
1. Press `Ctrl+Shift+P` (Command Palette)
2. Type "Open Keyboard Shortcuts (JSON)"
3. Copy contents from `.vscode/keybindings.json`

### 2. Available Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+R` | Review current file |
| `Ctrl+Shift+F` | Review + Interactive auto-fix |
| `Ctrl+Shift+W` | Start real-time file watcher |

### 3. Or Use Command Palette

Press `Ctrl+Shift+P` and type:
- "Tasks: Run Task"
- Select one of the AI Code Review tasks

---

## Available Tasks

### 📝 AI Code Review: Current File

Reviews the currently open file.

**Usage:**
- Press `Ctrl+Shift+R`
- Or: Command Palette → "Tasks: Run Task" → "AI Code Review: Current File"

**Example output:**
```
🔍 Local Ollama Code Review - qwen2.5-coder:32b

📂 Reviewing 1 file(s):
   app/api/chat/route.ts

================================================================================
📋 CODE REVIEW RESULTS
================================================================================
app/api/chat/route.ts:245 - HIGH SEVERITY
⚠️  SQL Injection Risk: User input passed directly to query
   Fix: Use parameterized query
```

---

### 🔧 AI Code Review: Current File (Interactive Auto-Fix)

Reviews the current file AND offers to automatically fix simple issues.

**Usage:**
- Press `Ctrl+Shift+F`
- AI will:
  1. Find issues
  2. Categorize as "simple" or "complex"
  3. Auto-fix simple issues (SQL injection, missing types, etc.)
  4. Prompt you for each fix
  5. Create backups before applying changes

**Example interaction:**
```
🔧 AUTO-FIXING SIMPLE ISSUES:

   Critical: SQL injection vulnerability
   📁 app/api/route.ts:245

================================================================================
📝 Preview changes for: app/api/route.ts
================================================================================
Line 245:
  - const query = `SELECT * FROM users WHERE id = ${userId}`;
  + const query = `SELECT * FROM users WHERE id = $1`;
================================================================================

   Apply auto-fix? (y/N): y
   ✅ Applied fix to app/api/route.ts
   📦 Backup saved: app/api/route.ts.backup
```

---

### 🔁 AI Code Review: Current File (Auto-Fix All)

Same as interactive auto-fix, but skips prompts and applies ALL simple fixes automatically.

**Usage:**
- Command Palette → "Tasks: Run Task" → "AI Code Review: Current File (Auto-Fix All)"

**⚠️ Warning:** This applies fixes without confirmation! Review the changes after.

---

### 👀 AI Code Review: Start Real-time Watcher

Starts a file watcher that automatically reviews files when you save them.

**Usage:**
- Press `Ctrl+Shift+W`
- Or: Command Palette → "Tasks: Run Task" → "AI Code Review: Start Real-time Watcher"

**How it works:**
1. Watches for file changes in your workspace
2. Waits 2 seconds after you stop typing (debounced)
3. Automatically runs AI code review
4. Shows results in the terminal

**Example:**
```
🚀 Real-time AI Code Review - qwen2.5-coder:32b
👀 Watching: .
⏱️  Debounce: 2000ms
📝 File types: .ts, .tsx, .js, .jsx

Waiting for file changes...

📝 Detected change: app/api/chat/route.ts
💡 1 file(s) changed, running review...

================================================================================
🔍 Reviewing: app/api/chat/route.ts
================================================================================
⚠️  High-severity issues found. Consider addressing them.
```

**To stop:** Press `Ctrl+C` in the terminal

---

### 📁 AI Code Review: Staged Files

Reviews all files you've `git add`ed.

**Usage:**
- Command Palette → "Tasks: Run Task" → "AI Code Review: Staged Files"

**Perfect for:**
- Pre-commit checks
- Quick review before committing

---

### 🌍 AI Code Review: Workspace (All Files)

Reviews ALL TypeScript/JavaScript files in your workspace.

**Usage:**
- Command Palette → "Tasks: Run Task" → "AI Code Review: Workspace (All Files)"

**⚠️ Warning:** This can take a while for large projects!

**Finds all files:**
```bash
find . -name '*.ts' -o -name '*.tsx' | grep -v node_modules
```

---

## Advanced: Watch Specific Directory

If you only want to watch a specific directory (e.g., just `app/api`):

**Usage:**
- Command Palette → "Tasks: Run Task" → "AI Code Review: Start Watcher (Specific Directory)"
- Enter directory: `app/api`

**Or from terminal:**
```bash
npx tsx scripts/watch-and-review.ts app/api
npx tsx scripts/watch-and-review.ts lib components
```

---

## Configuration

### Change AI Model

Edit the tasks in `.vscode/tasks.json`:

```json
{
  "label": "AI Code Review: Current File",
  "command": "MODEL=qwen2.5-coder:7b npx tsx scripts/ollama-code-review.ts ${file}"
}
```

### Adjust Debounce Time

Edit `scripts/watch-and-review.ts`:

```typescript
const DEBOUNCE_MS = 2000; // Change to 5000 for 5 seconds
```

### Watch Different File Types

Edit `scripts/watch-and-review.ts`:

```typescript
const validExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go'];
```

---

## Workflow Examples

### Workflow 1: Write Code with Real-time Feedback

1. Press `Ctrl+Shift+W` to start the watcher
2. Write your code
3. Save the file (`Ctrl+S`)
4. AI automatically reviews after 2 seconds
5. See issues in the terminal
6. Fix issues
7. Save again → AI reviews again

**Perfect for:** TDD-style development with instant feedback

---

### Workflow 2: Review Before Committing

1. Make changes to several files
2. `git add` the files you want to commit
3. Command Palette → "AI Code Review: Staged Files"
4. Review the output
5. Fix any issues
6. Commit with confidence

**Perfect for:** Clean commits with no issues

---

### Workflow 3: Interactive Fix Session

1. Open a file with issues
2. Press `Ctrl+Shift+F` (Interactive Auto-Fix)
3. AI finds and categorizes issues
4. For each simple issue:
   - See the diff
   - Approve or skip
5. For complex issues, review manually
6. Re-run to verify all issues fixed

**Perfect for:** Cleaning up legacy code

---

### Workflow 4: Deep Workspace Audit

1. Command Palette → "AI Code Review: Workspace (All Files)"
2. Make coffee ☕ (this takes a few minutes)
3. Review all issues found
4. Prioritize by severity
5. Fix critical/high issues first

**Perfect for:** Security audits, code quality initiatives

---

## Integration with Git Hooks

The pre-commit hook (`.git/hooks/pre-commit`) already uses the AI review!

**Flow:**
1. `git commit`
2. Pre-commit hook runs `npm run review:ai`
3. AI reviews staged files
4. If critical issues found:
   - Shows issues
   - Asks "Commit anyway? (y/N)"
5. You decide

**To bypass for urgent commits:**
```bash
git commit --no-verify
```

---

## Troubleshooting

### Task doesn't run

**Check:**
1. Is Ollama running? `curl http://localhost:11434/api/tags`
2. Start Ollama: `ollama serve`

### "Model not found" error

**Fix:**
```bash
ollama pull qwen2.5-coder:32b
```

### Watcher not detecting changes

**Possible causes:**
1. File is in `node_modules` (ignored by default)
2. File extension not `.ts/.tsx/.js/.jsx`
3. VS Code autosave is disabled

**Enable autosave:**
- File → Preferences → Settings
- Search "Auto Save"
- Set to "afterDelay"

### Too many notifications

The real-time watcher can be noisy. Options:
1. Use manual review instead (`Ctrl+Shift+R`)
2. Watch specific directory only
3. Increase debounce time (edit `watch-and-review.ts`)

### Review is slow

**Optimize:**
1. Use smaller model: `MODEL=qwen2.5-coder:7b`
2. Watch specific directories only
3. Increase debounce time
4. Don't run on entire workspace frequently

---

## What's Being Reviewed?

The AI checks for:

### 1. Security Vulnerabilities
- SQL injection
- XSS vulnerabilities
- Hardcoded secrets/API keys
- Authentication bypasses
- Insecure API calls

### 2. Performance Issues
- Inefficient algorithms (O(n²) when O(n) exists)
- Memory leaks
- Unnecessary re-renders in React
- Missing memoization

### 3. Type Safety
- Missing type annotations
- Unsafe type assertions (as any)
- Potential runtime errors
- Type inconsistencies

### 4. Best Practices
- Code organization
- Error handling
- Missing edge cases
- Use of deprecated APIs
- Consistent formatting

---

## Next Steps

1. ✅ Try the keyboard shortcuts!
2. ✅ Run the real-time watcher while coding
3. ✅ Use interactive auto-fix for legacy code
4. ✅ Set up GitHub Actions for PR reviews (see `.github/GITHUB_ACTIONS_SETUP.md`)

---

## Keyboard Shortcuts Reference Card

Print this and put it on your desk:

```
╔════════════════════════════════════════╗
║   AI CODE REVIEW SHORTCUTS             ║
╠════════════════════════════════════════╣
║  Ctrl+Shift+R   Review current file    ║
║  Ctrl+Shift+F   Interactive auto-fix   ║
║  Ctrl+Shift+W   Start real-time watch  ║
║  Ctrl+Shift+P   Command Palette        ║
╚════════════════════════════════════════╝
```

---

## Cost & Performance

All operations are **FREE** because they run locally:

| Task | Time | Cost | Model Used |
|------|------|------|------------|
| Review current file | 2-5s | $0 | qwen2.5-coder:32b |
| Interactive auto-fix | 3-8s | $0 | qwen2.5-coder:32b |
| Real-time watch (per save) | 2-5s | $0 | qwen2.5-coder:32b |
| Workspace review | 5-30min | $0 | qwen2.5-coder:32b |

Compare to cloud AI:
- GPT-4: $0.50 per review
- Claude Opus: $0.40 per review
- GitHub Copilot: $10/month

**Your setup:** $0/month, unlimited reviews, 100% private

---

Questions? Issues? Check the main README or create an issue!
