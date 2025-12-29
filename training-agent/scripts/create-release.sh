#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
BUILD_DIR="$REPO_ROOT/build"

log() { echo "[create-release] $*"; }

# Check for version argument
if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 v1.0.0"
  exit 1
fi

VERSION="$1"

# Validate version format
if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Version must be in format v1.2.3"
  exit 1
fi

# Check for gh CLI
if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) not found. Install from https://cli.github.com"
  exit 1
fi

# Verify we're in a git repo
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Error: Not in a git repository"
  exit 1
fi

log "Creating release $VERSION"

# Create build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
cd "$REPO_ROOT"

# Files to include
FILES_TO_INCLUDE=(
  "src"
  "scripts"
  "requirements.txt"
  ".env.example"
  "README.md"
  "LICENSE"
  "QUICK_START.md"
)

# Create Linux/macOS tarball
log "Creating Linux tarball..."
tar -czf "$BUILD_DIR/training-agent-linux-amd64.tar.gz" \
  --exclude='.git' \
  --exclude='venv' \
  --exclude='__pycache__' \
  --exclude='build' \
  --exclude='*.pyc' \
  --exclude='.env' \
  "${FILES_TO_INCLUDE[@]}"

# macOS uses same tarball
log "Creating macOS tarball..."
cp "$BUILD_DIR/training-agent-linux-amd64.tar.gz" "$BUILD_DIR/training-agent-darwin-amd64.tar.gz"

# Create Windows zip
log "Creating Windows zip..."
if command -v zip >/dev/null 2>&1; then
  zip -q -r "$BUILD_DIR/training-agent-windows-amd64.zip" \
    "${FILES_TO_INCLUDE[@]}" \
    -x '*.git*' '*venv*' '*__pycache__*' '*build*' '*.pyc' '*.env'
else
  # Fallback to tar if zip not available
  tar -czf "$BUILD_DIR/training-agent-windows-amd64.tar.gz" \
    --exclude='.git' \
    --exclude='venv' \
    --exclude='__pycache__' \
    --exclude='build' \
    --exclude='*.pyc' \
    --exclude='.env' \
    "${FILES_TO_INCLUDE[@]}"
  log "Warning: 'zip' not found, created .tar.gz instead of .zip for Windows"
fi

# Verify archives exist
log "Verifying archives..."
ls -lh "$BUILD_DIR/"

# Create release notes
RELEASE_NOTES="$BUILD_DIR/release-notes.md"
cat > "$RELEASE_NOTES" <<EOF
# Training Agent $VERSION

## Installation

Download the appropriate archive for your platform and follow the instructions:

### Linux
\`\`\`bash
curl -sSL https://github.com/FineTune-Lab/training-agent/releases/download/${VERSION}/training-agent-linux-amd64.tar.gz | tar -xz
cd training-agent
./scripts/install.sh
\`\`\`

### macOS
\`\`\`bash
curl -sSL https://github.com/FineTune-Lab/training-agent/releases/download/${VERSION}/training-agent-darwin-amd64.tar.gz | tar -xz
cd training-agent
./scripts/install.sh
\`\`\`

### Windows
\`\`\`powershell
Invoke-WebRequest https://github.com/FineTune-Lab/training-agent/releases/download/${VERSION}/training-agent-windows-amd64.zip -OutFile agent.zip
Expand-Archive agent.zip -DestinationPath training-agent
cd training-agent
scripts\install.ps1
\`\`\`

## Configuration

After installation, edit your \`.env\` file:
- **Linux/macOS**: \`~/.finetunelab/training-agent/.env\`
- **Windows**: \`%LOCALAPPDATA%\FineTuneLab\training-agent\.env\`

Set \`BACKEND_URL\` and \`API_KEY\`, then restart the service:
- **Linux/macOS**: \`./scripts/agentctl restart\`
- **Windows**: Re-run the scheduled task or reboot

## What's Changed

EOF

# Prompt for changelog
log ""
log "Release notes template created at: $RELEASE_NOTES"
log ""
read -p "Do you want to create the release now? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  log "Aborted. Archives saved in $BUILD_DIR"
  exit 0
fi

# Create and push tag
log "Creating and pushing tag $VERSION..."
if git tag -l | grep -q "^${VERSION}$"; then
  log "Tag $VERSION already exists"
else
  git tag -a "$VERSION" -m "Release $VERSION"
  git push finetune-lab "$VERSION"
fi

# Create GitHub release
log "Creating GitHub release..."
gh release create "$VERSION" \
  --repo FineTune-Lab/training-agent \
  --title "Training Agent $VERSION" \
  --notes-file "$RELEASE_NOTES" \
  "$BUILD_DIR/training-agent-linux-amd64.tar.gz" \
  "$BUILD_DIR/training-agent-darwin-amd64.tar.gz" \
  "$BUILD_DIR/training-agent-windows-amd64.zip"

log "✅ Release $VERSION created successfully!"
log "View at: https://github.com/FineTune-Lab/training-agent/releases/tag/$VERSION"
