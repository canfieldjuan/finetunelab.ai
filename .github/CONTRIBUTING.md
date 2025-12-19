# Git Workflow Guide - FineTune Lab

**Print this. Keep it close. Reference it daily.**

---

## 🎯 The 3 Rules That Matter Most

1. **Branch for features, commit directly to main for tiny fixes**
2. **Commit often with descriptive messages** (`type: what you did`)
3. **Review your changes before merging** (check for debug code, hardcoded values, etc.)

---

## 📋 Quick Reference

### When to Branch vs Commit to Main

#### ✅ COMMIT DIRECTLY TO MAIN (No branch):
- Typo fixes
- Documentation updates
- Quick config changes
- Dependency version bumps (patch updates)
- Takes <5 minutes and can't break anything

#### 🌿 CREATE A BRANCH:
- New features (even if "small")
- Bug fixes touching multiple files
- Refactoring code
- Database migrations
- Experimental ideas
- Anything you might need to undo

---

## 🏷️ Branch Naming Convention

Pattern: `<type>/<short-description>`

```bash
feature/stripe-integration       # New functionality
fix/runpod-alerts-broken        # Bug fix
refactor/cleanup-training-code  # Code cleanup
experiment/try-new-db           # Experimental work
hotfix/payment-crash            # URGENT production fix
chore/update-dependencies       # Maintenance
```

---

## 💬 Commit Message Format

**Pattern:** `type: description`

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code cleanup (no behavior change)
- `perf:` - Performance improvement
- `docs:` - Documentation
- `chore:` - Maintenance (deps, config)
- `test:` - Adding tests
- `wip:` - Work in progress (branches only!)

**Good Examples:**
```bash
git commit -m "fix: correct METRICS_API_URL path for RunPod"
git commit -m "feat: add alert notifications for training jobs"
git commit -m "refactor: extract alert logic to separate function"
```

**Bad Examples:**
```bash
git commit -m "fixes"
git commit -m "update"
git commit -m "asdfasdf"
```

---

## 📅 Daily Workflow

### Morning (Start work):
```bash
git checkout main
git pull origin main              # Get latest changes
git checkout -b feature/thing     # Start new branch
```

### During the day (Working):
```bash
# Make changes...
git add .
git commit -m "feat: add X"

# More changes...
git add .
git commit -m "fix: handle edge case"

# Push to backup your work
git push origin feature/thing
```

### Evening (Ship it):
```bash
# Push final commits
git push origin feature/thing

# Option A: Create PR on GitHub for review
# Go to GitHub.com → Create PR → Review → Merge

# Option B: Direct merge (if confident)
git checkout main
git merge feature/thing
git push origin main

# Clean up
git branch -D feature/thing
```

---

## 🚨 HOTFIX Workflow (Production is Broken)

**Fast track - skip the branch review:**

```bash
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# Fix the bug
git add .
git commit -m "hotfix: fix payment crash"

# Test locally first!
npm run build

# Ship immediately
git checkout main
git merge hotfix/critical-bug
git push origin main              # ← Render deploys

# Clean up
git branch -D hotfix/critical-bug
```

---

## 🔄 Working on Multiple Things

**Scenario:** Working on Feature A, urgent Bug B appears

```bash
# Save current work
git add .
git commit -m "wip: half done with feature A"
git push origin feature/feature-a

# Switch to fix bug
git checkout main
git checkout -b fix/bug-b

# Fix, commit, merge
git add .
git commit -m "fix: bug B"
git checkout main
git merge fix/bug-b
git push origin main

# Back to feature A
git checkout feature/feature-a
# Continue where you left off
```

---

## ✅ Pre-Merge Checklist

**Before merging to main, verify:**

```bash
# View all your changes
git diff main..HEAD
```

**Check for:**
- [ ] No `console.log()` statements left
- [ ] No `TODO` comments (or create issues for them)
- [ ] No hardcoded values (use env vars instead)
- [ ] No `.env` files committed (check .gitignore)
- [ ] `npm run build` passes
- [ ] Tested locally
- [ ] No duplicate code
- [ ] Removed debug/experimental code

---

## 🧹 Branch Cleanup

```bash
# See all branches
git branch -a

# Delete local branch (after merging)
git branch -D feature/old-thing

# Delete remote branch (after merging)
git push origin --delete feature/old-thing

# See unmerged branches
git branch --no-merged main
```

**Keep it clean:** Delete branches after merging.

---

## 💾 Git Stash - "Oh Shit I'm on Main"

**Scenario:** You started editing on `main` by mistake

```bash
git stash                         # Save changes temporarily
git checkout -b feature/thing     # Create proper branch
git stash pop                     # Restore changes
git add .
git commit -m "feat: the thing"
```

**Git stash = Clipboard for uncommitted changes**

---

## 🔍 Useful Git Commands

### Investigation:
```bash
git log --oneline --graph         # Visual commit history
git blame <file>                  # Who wrote each line
git show <commit>:<file>          # View old file version
git diff main..feature/thing      # Compare branches
```

### Time Travel:
```bash
git checkout <commit>             # View old commit (read-only)
git checkout main                 # Return to present
```

### Undo:
```bash
git reset --soft HEAD~1           # Undo last commit (keep changes)
git reset --hard HEAD~1           # Undo last commit (delete changes)
git checkout -- <file>            # Discard changes to file
```

---

## 🎯 PR vs Direct Merge

### Create PR (GitHub UI):
- Big features (review your own work)
- Risky changes (DB migrations, API changes)
- When you want to document what changed
- When you need a checklist

### Direct Merge (Command line):
```bash
git checkout main
git merge feature/thing
git push origin main
git branch -D feature/thing
```

Use for:
- Small features you're confident about
- Bug fixes you tested
- When moving fast solo
- Hotfixes

---

## 🚀 Example: Full Feature Workflow

```bash
# 1. Start
git checkout main
git pull origin main
git checkout -b feature/stripe-integration

# 2. Work (commit often)
git add .
git commit -m "feat: add stripe checkout component"

git add .
git commit -m "feat: add webhook handler"

git add .
git commit -m "fix: handle failed payments"

git push origin feature/stripe-integration

# 3. Review your own work
git diff main..HEAD
# Check for console.logs, TODOs, hardcoded values

# 4. Ship it
git checkout main
git merge feature/stripe-integration
git push origin main

# 5. Clean up
git branch -D feature/stripe-integration
```

---

## ⚠️ Common Mistakes to Avoid

1. **Committing to main without testing**
   - Always test locally first
   - Run `npm run build` before pushing

2. **Not pulling before starting work**
   - Always `git pull origin main` first
   - Prevents merge conflicts

3. **Leaving branches open forever**
   - Merge or delete within 1-2 days
   - Old branches = confusion

4. **Vague commit messages**
   - "update" tells you nothing
   - "fix: correct METRICS_API_URL path" tells the story

5. **Committing secrets**
   - Never commit `.env` files
   - Never hardcode API keys
   - Check `.gitignore` is working

---

## 📊 Git Stats (For Fun)

```bash
# Total commits
git rev-list --all --count

# Your commits this week
git log --author="Juan" --since="1 week ago" --oneline

# Files changed most often
git log --pretty=format: --name-only | sort | uniq -c | sort -rg | head -10

# Lines of code by author
git log --shortstat --author="Juan" | grep "files changed" | awk '{sum1+=$4; sum2+=$6} END {print "Insertions:", sum1, "Deletions:", sum2}'
```

---

## 🎓 Advanced: Git Bisect

**Use when:** "This worked last week, now it's broken - find the commit that broke it"

```bash
git bisect start
git bisect bad                    # Current state is broken
git bisect good <old-commit>      # This old commit worked

# Git checks out middle commit
# Test it... then:
git bisect bad                    # Still broken
# OR
git bisect good                   # It works here

# Repeat until Git finds the exact commit
git bisect reset                  # Done
```

---

## 📝 Remember

**Git is your safety net, not your enemy.**

- Commit often (every logical checkpoint)
- Branch for anything you might want to undo
- Review before merging (your future self will thank you)
- Keep branches short-lived (days, not weeks)
- Write commit messages for 3-months-from-now you

**When in doubt:** Make a branch. You can always delete it.

---

**Last Updated:** 2025-12-19

**Questions?** Check `git --help` or Google "git <command> examples"
