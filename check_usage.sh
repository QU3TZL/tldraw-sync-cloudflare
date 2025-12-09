#!/bin/bash
# Quick script to check if hibernation code is deployed

echo "🔍 Checking if hibernation code is in deployed bundle..."
echo ""

cd "$(dirname "$0")"

if [ ! -f "dist/tldraw_sync/index.js" ]; then
    echo "❌ Build not found. Run: npm run build"
    exit 1
fi

echo "Checking for hibernation functions..."
echo ""

# Check for key hibernation functions
if grep -q "webSocketClose" dist/tldraw_sync/index.js; then
    echo "✅ webSocketClose found"
else
    echo "❌ webSocketClose NOT found"
fi

if grep -q "acceptWebSocket" dist/tldraw_sync/index.js; then
    echo "✅ acceptWebSocket found"
else
    echo "❌ acceptWebSocket NOT found"
fi

if grep -q "activeConnections" dist/tldraw_sync/index.js; then
    echo "✅ activeConnections tracking found"
else
    echo "❌ activeConnections NOT found"
fi

echo ""
echo "📊 Checking deployment info..."
if [ -f ".wrangler/deploy/config.json" ]; then
    echo "Last deployment config found"
    grep -q "tldraw-sync" .wrangler/deploy/config.json && echo "✅ Worker name: tldraw-sync"
fi

echo ""
echo "💡 To verify hibernation is working:"
echo "   1. Open your canvas app"
echo "   2. Close browser completely"
echo "   3. Wait 5 minutes"
echo "   4. Check Cloudflare dashboard → Analytics → Durable Objects"
echo "   5. Usage should drop to near-zero after you close browser"

