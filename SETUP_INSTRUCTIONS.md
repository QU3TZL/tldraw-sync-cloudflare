# tldraw Sync Server - Quick Setup

## 🚀 Quick Start (5 minutes)

### 1. Install Dependencies

```bash
cd tldraw-sync-server
npm install
```

### 2. Configure Cloudflare

1. **Create R2 Bucket:**
   - Go to https://dash.cloudflare.com → R2 → Create bucket
   - Name: `tldraw-content` (or your preferred name)
   - Update `wrangler.toml` → `bucket_name = 'tldraw-content'`

2. **Login to Cloudflare:**
   ```bash
   npx wrangler login
   ```

### 3. Deploy

```bash
npm run build
npx wrangler deploy
```

You'll get a URL like: `https://tldraw-sync.your-subdomain.workers.dev`

### 4. Set Environment Variable

**In your frontend `.env` or Railway environment:**

```bash
VITE_TLDRAW_SYNC_URL=wss://tldraw-sync.your-subdomain.workers.dev
```

**Important:** Use `wss://` (secure WebSocket) for production, `ws://` for local dev.

### 5. Test

1. Start your frontend app
2. Open browser console
3. Look for: `🎨 tldraw Sync Status: { isConnected: true, isSelfHosted: true }`
4. Open canvas in two windows - changes should sync!

---

## 📝 Configuration

### WebSocket Connection URL Format

The sync server expects connections at:
```
wss://your-worker.workers.dev/api/connect/{roomId}
```

Your `useTldrawSync` hook automatically constructs this URL:
- Base URL: `VITE_TLDRAW_SYNC_URL` (e.g., `wss://tldraw-sync.workers.dev`)
- Room ID: `canvas-{projectId}`
- Full URL: `wss://tldraw-sync.workers.dev/api/connect/canvas-{projectId}`

### Custom Domain (Optional)

1. In Cloudflare Dashboard → Workers → Your Worker → Settings → Triggers
2. Add custom domain (e.g., `sync.yourdomain.com`)
3. Update `VITE_TLDRAW_SYNC_URL=wss://sync.yourdomain.com`

---

## 🔍 Verification

Check if sync server is working:

```bash
# View worker logs
npx wrangler tail

# Check deployments
npx wrangler deployments list
```

---

## 📚 Full Documentation

See `TLDRAW_SYNC_SERVER_SETUP.md` for detailed setup, troubleshooting, and architecture.

