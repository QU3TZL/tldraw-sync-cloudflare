#!/bin/bash
# ============================================================================
# TLDraw Sync Server - Cloudflare Deploy Script
# ============================================================================
#
# Usage: ./deploy.sh
#
# This script:
# 1. Switches to Node 22 (required by Vite 7)
# 2. Installs dependencies (including devDependencies)
# 3. Builds the worker and client
# 4. Deploys to Cloudflare Workers
#
# Prerequisites:
# - nvm installed
# - Cloudflare wrangler authenticated (run `wrangler login` first)
# - Node 22 installed via nvm (`nvm install 22`)
#
# When to run this script:
# - After adding new custom shapes to worker/sharedSchema.ts
# - After modifying the sync server worker code
# - After updating tldraw dependencies
# ============================================================================

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 TLDraw Sync Server Deploy"
echo "============================"
echo ""

# Source nvm
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
elif [ -s "/usr/local/opt/nvm/nvm.sh" ]; then
    source "/usr/local/opt/nvm/nvm.sh"
else
    echo "❌ nvm not found. Please install nvm first."
    exit 1
fi

# Switch to Node 22
echo "📦 Switching to Node 22..."
nvm use 22 || {
    echo "⚠️  Node 22 not installed. Installing..."
    nvm install 22
    nvm use 22
}
echo "✅ Using Node $(node --version)"
echo ""

# Clean and install dependencies
echo "📦 Installing dependencies..."
rm -rf node_modules package-lock.json
npm install --include=dev
echo "✅ Dependencies installed"
echo ""

# Build
echo "🔨 Building sync server..."
rm -rf dist .wrangler
node_modules/.bin/vite build
echo "✅ Build complete"
echo ""

# Deploy
echo "☁️  Deploying to Cloudflare..."
wrangler deploy
echo ""
echo "✅ Deploy complete!"
echo ""
echo "🎉 The sync server has been deployed."
echo "   Users should hard refresh their browsers (Cmd+Shift+R) to get the new schema."
echo ""

