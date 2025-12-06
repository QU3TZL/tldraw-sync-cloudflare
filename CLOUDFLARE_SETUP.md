# TLDraw Sync Server - Cloudflare Setup

## Quick Deploy

After making changes to the sync server (especially `worker/sharedSchema.ts`):

```bash
cd tldraw-sync-server
./deploy.sh
```

That's it! The script handles Node version, dependencies, build, and deploy.

---

## When to Redeploy

You **MUST redeploy** the sync server when:

1. **Adding new custom shapes** - Update `worker/sharedSchema.ts` with the new shape schema
2. **Modifying shape properties** - Any changes to shape prop definitions
3. **Upgrading tldraw packages** - Schema might have changed
4. **Fixing sync issues** - When client/server schema mismatch causes "rejecting empty sync store" errors

### Signs You Need to Redeploy

If you see these console errors in the browser:

```
🛡️ STORE PROTECTION: Rejecting empty sync store!
🛡️ SYNC RESET DETECTED - reloading from backend!
```

This usually means the client knows about shapes the server doesn't (schema mismatch).

---

## First-Time Setup

### 1. Install Prerequisites

```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node 22
nvm install 22

# Install wrangler globally
npm install -g wrangler
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

This opens a browser - make sure you're logged into the correct Cloudflare account.

Verify with:

```bash
wrangler whoami
```

### 3. Enable R2 Storage

1. Go to https://dash.cloudflare.com → R2
2. Click "Get Started" or "Enable R2" if prompted
3. Create bucket: `tldraw-content`

### 4. Deploy

```bash
cd tldraw-sync-server
./deploy.sh
```

---

## Adding a New Custom Shape

When you add a new shape to the canvas (like `canvas-marker`), you need to:

### 1. Add Shape Schema to Sync Server

Edit `worker/sharedSchema.ts` and add the shape definition:

```typescript
// Example: Adding a new shape type
"my-new-shape": {
  props: {
    w: { type: "number", default: 100 },
    h: { type: "number", default: 100 },
    // ... other props
  },
  migrations: {
    firstVersion: 1,
    currentVersion: 1,
    migrators: {
      1: { up: (shape: any) => shape, down: (shape: any) => shape },
    },
  },
},
```

### 2. Deploy

```bash
./deploy.sh
```

### 3. Tell Users to Hard Refresh

After deploying, users need to hard refresh (Cmd+Shift+R) to get the new schema.

---

## Troubleshooting

### "Cannot find module @tldraw/tldraw"

The build is trying to compile the shared folder. This is expected - the sync server uses its own schema in `worker/sharedSchema.ts`, not the shared folder.

### "Wrangler requires Node.js v20.0.0"

The deploy script handles this automatically. If running manually:

```bash
source ~/.nvm/nvm.sh && nvm use 22
```

### Infinite sync loop / Racing

This is a schema mismatch. Redeploy the sync server with `./deploy.sh`.

### After deploy, still seeing errors

Clear browser IndexedDB:

1. Open DevTools → Application → IndexedDB
2. Delete all `tldraw-canvas-*` databases
3. Hard refresh

---

## Current Account

Logged in as: **matt@mattmarcus.net**

Worker URL: `https://tldraw-sync.matic-worker.workers.dev`
