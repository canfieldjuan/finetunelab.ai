#!/bin/bash
# Screenshot Capture Script for Product Hunt Assets
# Run this after starting the dev server

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Finetune Lab - Product Hunt Screenshot Guide        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Create directory for screenshots
SCREENSHOT_DIR="product-hunt-assets"
mkdir -p "$SCREENSHOT_DIR/gallery"
mkdir -p "$SCREENSHOT_DIR/raw"

echo -e "${GREEN}✓${NC} Created directories:"
echo "  - $SCREENSHOT_DIR/"
echo "  - $SCREENSHOT_DIR/gallery/"
echo "  - $SCREENSHOT_DIR/raw/"
echo ""

# Check if dev server is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Dev server not detected on port 3000${NC}"
    echo "Starting dev server..."
    npm run dev &
    SERVER_PID=$!
    echo "Waiting for server to start..."
    sleep 10
else
    echo -e "${GREEN}✓${NC} Dev server running on http://localhost:3000"
    SERVER_PID=""
fi
echo ""

# Check for screenshot tools
echo "Checking for screenshot tools..."
SCREENSHOT_TOOL=""

if command -v flameshot &> /dev/null; then
    SCREENSHOT_TOOL="flameshot"
    echo -e "${GREEN}✓${NC} Found: flameshot"
elif command -v gnome-screenshot &> /dev/null; then
    SCREENSHOT_TOOL="gnome-screenshot"
    echo -e "${GREEN}✓${NC} Found: gnome-screenshot"
elif command -v scrot &> /dev/null; then
    SCREENSHOT_TOOL="scrot"
    echo -e "${GREEN}✓${NC} Found: scrot"
else
    echo -e "${YELLOW}⚠ No screenshot tool found${NC}"
    echo "Install one of: flameshot, gnome-screenshot, or scrot"
    echo "  Ubuntu/Debian: sudo apt install flameshot"
    echo "  Fedora: sudo dnf install flameshot"
fi
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  SCREENSHOT CAPTURE INSTRUCTIONS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${GREEN}📸 Screenshot 1: Training Predictions Dashboard${NC}"
echo "   URL: http://localhost:3000/training"
echo "   Focus: Live training metrics, prediction table, loss curves"
echo "   File: $SCREENSHOT_DIR/raw/1-training-predictions.png"
echo ""
echo "   Steps:"
echo "   1. Navigate to /training page"
echo "   2. Press F11 for fullscreen"
echo "   3. Capture screenshot"
echo "   4. Press F11 to exit fullscreen"
echo ""
read -p "Press ENTER when screenshot 1 is ready..."
echo ""

echo -e "${GREEN}📸 Screenshot 2: Batch Testing Analytics${NC}"
echo "   URL: http://localhost:3000/testing"
echo "   Focus: Analytics charts, success rates, latency distribution"
echo "   File: $SCREENSHOT_DIR/raw/2-batch-testing.png"
echo ""
echo "   Steps:"
echo "   1. Navigate to /testing page"
echo "   2. Press F11 for fullscreen"
echo "   3. Capture screenshot showing analytics"
echo "   4. Press F11 to exit fullscreen"
echo ""
read -p "Press ENTER when screenshot 2 is ready..."
echo ""

echo -e "${GREEN}📸 Screenshot 3: Production Monitoring${NC}"
echo "   URL: http://localhost:3000/models"
echo "   Focus: Request logs, latency trends, cost tracking"
echo "   File: $SCREENSHOT_DIR/raw/3-production-monitoring.png"
echo ""
echo "   Steps:"
echo "   1. Navigate to /models page"
echo "   2. Click on a deployed model"
echo "   3. Press F11 for fullscreen"
echo "   4. Capture monitoring dashboard"
echo "   5. Press F11 to exit fullscreen"
echo ""
read -p "Press ENTER when screenshot 3 is ready..."
echo ""

echo -e "${GREEN}📸 Screenshot 4: Analytics Dashboard${NC}"
echo "   URL: http://localhost:3000/analytics"
echo "   Focus: Overall platform analytics, charts, metrics"
echo "   File: $SCREENSHOT_DIR/raw/4-analytics-dashboard.png"
echo ""
echo "   Steps:"
echo "   1. Navigate to /analytics page"
echo "   2. Press F11 for fullscreen"
echo "   3. Capture full dashboard"
echo "   4. Press F11 to exit fullscreen"
echo ""
read -p "Press ENTER when screenshot 4 is ready..."
echo ""

echo -e "${GREEN}📸 Screenshot 5: Model Comparison (Optional)${NC}"
echo "   URL: http://localhost:3000/demo/comparison"
echo "   Focus: Side-by-side model comparison"
echo "   File: $SCREENSHOT_DIR/raw/5-model-comparison.png"
echo ""
read -p "Press ENTER when screenshot 5 is ready (or skip)..."
echo ""

echo -e "${GREEN}📸 Screenshot 6: Full Workflow Overview${NC}"
echo "   URL: http://localhost:3000/welcome"
echo "   Focus: Overview of complete platform"
echo "   File: $SCREENSHOT_DIR/raw/6-full-workflow.png"
echo ""
read -p "Press ENTER when screenshot 6 is ready..."
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  HERO IMAGE CREATION${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "Hero image should be created using a design tool (Figma/Canva)"
echo "Combine 2-3 best screenshots with overlay text"
echo ""
echo "Requirements:"
echo "  - Dimensions: 1270x760px"
echo "  - Format: PNG"
echo "  - File: $SCREENSHOT_DIR/hero-image.png"
echo ""
echo "Content suggestions:"
echo "  - Split view: Training dashboard + Production monitoring"
echo "  - Overlay text: 'Monitor Models From Training to Production'"
echo "  - Dark background with gradient"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  POST-PROCESSING STEPS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "For each screenshot:"
echo "  1. Crop to focus on key elements"
echo "  2. Add overlay text (optional):"
echo "     - Font: Bold, white with dark shadow"
echo "     - Size: 48-72px"
echo "     - Position: Top or bottom"
echo "  3. Compress for web:"
echo "     - Use TinyPNG.com or imagemagick"
echo "     - Target: < 500KB per image"
echo "  4. Save to $SCREENSHOT_DIR/gallery/"
echo ""

echo "Compression command (if ImageMagick installed):"
echo "  mogrify -path $SCREENSHOT_DIR/gallery/ -resize 1920x1080 -quality 85 $SCREENSHOT_DIR/raw/*.png"
echo ""

# Check if ImageMagick is installed
if command -v mogrify &> /dev/null; then
    read -p "Compress images now? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Compressing images..."
        mogrify -path "$SCREENSHOT_DIR/gallery/" -resize 1920x1080 -quality 85 "$SCREENSHOT_DIR/raw/"*.png 2>/dev/null || echo "No images found to compress"
        echo -e "${GREEN}✓${NC} Images compressed"
    fi
fi
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  NEXT STEPS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "1. Review screenshots in: $SCREENSHOT_DIR/"
echo "2. Create hero image (1270x760px)"
echo "3. Add overlay text to gallery images"
echo "4. Review PRODUCT_HUNT_ASSETS.md for upload checklist"
echo ""

echo -e "${GREEN}✓${NC} Screenshot capture guide complete!"
echo ""

# Open screenshot directory
if command -v xdg-open &> /dev/null; then
    xdg-open "$SCREENSHOT_DIR" 2>/dev/null || true
fi

# Cleanup: kill server if we started it
if [ -n "$SERVER_PID" ]; then
    echo "Stopping dev server..."
    kill $SERVER_PID 2>/dev/null || true
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo "Happy launching! 🚀"
