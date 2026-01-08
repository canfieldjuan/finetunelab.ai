# Release Process for Training Agent

This document describes how to create and publish release assets for the FineTune Lab Training Agent.

## Release Assets

For each release, we publish three platform-specific archives:

1. **training-agent-linux-amd64.tar.gz** - Linux (systemd)
2. **training-agent-darwin-amd64.tar.gz** - macOS (launchd)
3. **training-agent-windows-amd64.zip** - Windows (Task Scheduler)

Each archive contains:
- All source code (`src/`, `requirements.txt`, `.env.example`)
- Installation scripts (`scripts/install.sh`, `scripts/install.ps1`, `scripts/agentctl`)
- Documentation (`README.md`, `LICENSE`, etc.)

## Automated Release (Recommended)

### Prerequisites

1. Install GitHub CLI: `gh` ([installation guide](https://cli.github.com/manual/installation))
2. Authenticate: `gh auth login`

### Create Release

```bash
# From the training-agent root directory
./scripts/create-release.sh v1.0.0
```

This will:
1. Create the three platform archives
2. Create a GitHub release with auto-generated notes
3. Upload all three archives as release assets
4. Tag the commit

## Manual Release

### 1. Create Archives

```bash
# Set version
VERSION="v1.0.0"

# Create build directory
mkdir -p build

# Linux/macOS tarball
tar -czf "build/training-agent-linux-amd64.tar.gz" \
  --exclude='.git' \
  --exclude='venv' \
  --exclude='__pycache__' \
  --exclude='build' \
  --exclude='*.pyc' \
  src/ scripts/ requirements.txt .env.example README.md LICENSE

# macOS is same as Linux (both use install.sh)
cp "build/training-agent-linux-amd64.tar.gz" "build/training-agent-darwin-amd64.tar.gz"

# Windows zip
zip -r "build/training-agent-windows-amd64.zip" \
  src/ scripts/ requirements.txt .env.example README.md LICENSE \
  -x '*.git*' '*venv*' '*__pycache__*' '*build*' '*.pyc'
```

### 2. Create GitHub Release

1. Go to https://github.com/FineTune-Lab/training-agent/releases/new
2. Tag: `v1.0.0` (create new tag)
3. Title: `Training Agent v1.0.0`
4. Generate release notes (auto-generated)
5. Upload the three files from `build/`:
   - `training-agent-linux-amd64.tar.gz`
   - `training-agent-darwin-amd64.tar.gz`
   - `training-agent-windows-amd64.zip`
6. Publish release

## Release Checklist

Before publishing a release:

- [ ] Update version in `src/config.py` (if applicable)
- [ ] Test install.sh on Linux
- [ ] Test install.sh on macOS
- [ ] Test install.ps1 on Windows
- [ ] Verify agentctl works on Linux/macOS
- [ ] Update CHANGELOG.md
- [ ] Run tests: `pytest`
- [ ] Build and verify all three archives
- [ ] Tag commit: `git tag v1.0.0 && git push --tags`

## Post-Release

After publishing:

1. Test one-liner install commands from README
2. Update documentation if needed
3. Announce in Discord/Slack
4. Update main FineTune Lab docs

## Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (v2.0.0): Breaking API changes
- **MINOR** (v1.1.0): New features, backward compatible
- **PATCH** (v1.0.1): Bug fixes, backward compatible

## Troubleshooting

**Archive too large?**
- Ensure `venv/`, `.git/`, and `__pycache__/` are excluded
- Check for large model files that shouldn't be included

**Install script not executable in archive?**
- Add `chmod +x scripts/*.sh` after extraction
- Or preserve permissions: `tar -czpf ...` (note the `p` flag)

**Windows users report "script blocked"?**
- Document PowerShell execution policy: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
