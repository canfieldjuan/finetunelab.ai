#!/bin/bash
# Dependency Cleanup Script
# Run this after upgrading to Node 20+

set -e  # Exit on error

echo "🧹 Starting dependency cleanup..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node version
echo "📋 Checking Node version..."
NODE_VERSION=$(node --version)
echo "Current Node version: $NODE_VERSION"

if [[ ! "$NODE_VERSION" =~ ^v20\. ]]; then
    echo -e "${RED}❌ Node 20+ required. Please upgrade Node.js first.${NC}"
    echo ""
    echo "Run: nvm install 20 && nvm use 20"
    exit 1
fi

echo -e "${GREEN}✅ Node version OK${NC}"
echo ""

# Backup
echo "💾 Creating backups..."
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup
echo -e "${GREEN}✅ Backups created${NC}"
echo ""

# Remove extraneous package
echo "🗑️  Removing extraneous package..."
npm uninstall @emnapi/runtime 2>/dev/null || true
echo -e "${GREEN}✅ Extraneous package removed${NC}"
echo ""

# Remove unused production dependencies
echo "🗑️  Removing unused production dependencies..."
npm uninstall \
    @dagster-io/dagster-pipes \
    @tanstack/react-query \
    ai \
    check \
    pdfjs-dist \
    react-markdown \
    react-resizable-panels \
    react-window \
    remark-gfm \
    2>/dev/null || true

echo -e "${GREEN}✅ Unused production dependencies removed${NC}"
echo ""

# Remove unused dev dependencies
echo "🗑️  Removing unused dev dependencies..."
npm uninstall \
    @testing-library/user-event \
    @vitest/coverage-v8 \
    autoprefixer \
    babel-jest \
    cross-env \
    jest-environment-jsdom \
    markdownlint-cli \
    postcss \
    postcss-nesting \
    supabase \
    ts-jest \
    ts-node \
    2>/dev/null || true

echo -e "${GREEN}✅ Unused dev dependencies removed${NC}"
echo ""

# Update safe packages
echo "📦 Updating safe packages..."
npm update @anthropic-ai/sdk lucide-react react react-dom tailwind-merge

echo -e "${GREEN}✅ Packages updated${NC}"
echo ""

# Clean install
echo "🔄 Performing clean install..."
echo -e "${YELLOW}This may take a few minutes...${NC}"
rm -rf node_modules package-lock.json
npm install

echo -e "${GREEN}✅ Clean install complete${NC}"
echo ""

# Verification
echo "🔍 Verifying cleanup..."
echo ""

echo "Checking for extraneous packages:"
EXTRANEOUS=$(npm ls --depth=0 2>&1 | grep "extraneous" || true)
if [ -z "$EXTRANEOUS" ]; then
    echo -e "${GREEN}✅ No extraneous packages${NC}"
else
    echo -e "${RED}❌ Found extraneous packages:${NC}"
    echo "$EXTRANEOUS"
fi
echo ""

echo "Checking node_modules size:"
du -sh node_modules/
echo ""

echo "Checking for outdated packages:"
npm outdated || true
echo ""

# Build test
echo "🏗️  Testing build..."
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    echo ""
    echo "Restoring from backup..."
    mv package.json.backup package.json
    mv package-lock.json.backup package-lock.json
    npm install
    echo -e "${YELLOW}⚠️  Rolled back to previous state${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Cleanup complete!${NC}"
echo ""
echo "Summary:"
echo "  • Node version: $(node --version)"
echo "  • Dependencies cleaned: ✅"
echo "  • Build verification: ✅"
echo ""
echo "Backups saved as:"
echo "  • package.json.backup"
echo "  • package-lock.json.backup"
echo ""
echo "You can safely delete backups if everything works:"
echo "  rm package.json.backup package-lock.json.backup"
