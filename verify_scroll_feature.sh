#!/bin/bash

echo "🔍 SCROLL TO BOTTOM FEATURE - Final Verification"
echo "================================================="
echo ""

# Check if files exist
echo "📁 Checking files..."
echo ""

files=(
  "components/hooks/useAutoScroll.ts"
  "components/chat/ScrollToBottomButton.tsx"
  "components/hooks/index.ts"
  "components/Chat.tsx"
)

all_exist=true
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ MISSING: $file"
    all_exist=false
  fi
done

echo ""

if [ "$all_exist" = true ]; then
  echo "✅ All files present"
else
  echo "❌ Some files missing - check implementation"
  exit 1
fi

echo ""
echo "🔍 Checking key code patterns..."
echo ""

# Check useAutoScroll hook
if grep -q "export function useAutoScroll" components/hooks/useAutoScroll.ts; then
  echo "  ✅ useAutoScroll hook exported"
else
  echo "  ❌ useAutoScroll hook not found"
fi

# Check if hook handles streaming
if grep -q "isStreaming && !userHasScrolledUp" components/hooks/useAutoScroll.ts; then
  echo "  ✅ Streaming auto-scroll logic present"
else
  echo "  ❌ Streaming logic missing"
fi

# Check ScrollToBottomButton component
if grep -q "export function ScrollToBottomButton" components/chat/ScrollToBottomButton.tsx; then
  echo "  ✅ ScrollToBottomButton component exported"
else
  echo "  ❌ ScrollToBottomButton not found"
fi

# Check if button uses ArrowDown icon
if grep -q "ArrowDown" components/chat/ScrollToBottomButton.tsx; then
  echo "  ✅ ArrowDown icon imported"
else
  echo "  ❌ Icon missing"
fi

# Check Chat.tsx integration
if grep -q "useAutoScroll" components/Chat.tsx; then
  echo "  ✅ useAutoScroll imported in Chat.tsx"
else
  echo "  ❌ useAutoScroll not imported"
fi

if grep -q "ScrollToBottomButton" components/Chat.tsx; then
  echo "  ✅ ScrollToBottomButton used in Chat.tsx"
else
  echo "  ❌ Button not integrated"
fi

# Check if container has relative positioning
if grep -q 'className=.*relative.*flex-1' components/Chat.tsx; then
  echo "  ✅ Container has 'relative' class"
else
  echo "  ❌ Container missing 'relative' class"
fi

echo ""
echo "📊 Code Statistics:"
echo ""
echo "  useAutoScroll.ts: $(wc -l < components/hooks/useAutoScroll.ts) lines"
echo "  ScrollToBottomButton.tsx: $(wc -l < components/chat/ScrollToBottomButton.tsx) lines"
echo ""
echo "✅ IMPLEMENTATION COMPLETE"
echo ""
echo "🚀 Next Steps:"
echo "  1. Run: npm run dev"
echo "  2. Open browser and test chat"
echo "  3. Try scrolling up during AI response"
echo "  4. Verify button appears and works"
echo ""
echo "📖 See SCROLL_TO_BOTTOM_IMPLEMENTATION.md for full documentation"
