# Cloudflare Account Setup

## Current Status

You were logged in as: **matt@mattmarcus.net**

If this is the wrong account, you need to:

## Option 1: OAuth Login (Recommended)

1. Run: `wrangler login`
2. Browser will open - **make sure you're logged into the correct Cloudflare account**
3. Click "Allow" to grant permissions
4. Verify with: `wrangler whoami`

## Option 2: API Token (Alternative)

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use template: "Edit Cloudflare Workers"
4. Add permissions:
   - Account: Read
   - Zone: Read (if using custom domain)
   - Workers Scripts: Edit
   - Workers KV: Edit
   - Durable Objects: Edit
   - R2: Edit
5. Copy the token
6. Set environment variable:
   ```bash
   export CLOUDFLARE_API_TOKEN=your_token_here
   ```

## Verify Account

After logging in, check which account you're using:

```bash
wrangler whoami
```

## Enable R2

Once logged into the correct account:

1. Go to https://dash.cloudflare.com → R2
2. Click "Get Started" or "Enable R2" if prompted
3. Create bucket: `tldraw-content`
4. Note the bucket name for `wrangler.toml`

## Next Steps

After authenticating with the correct account and enabling R2:

1. Update `wrangler.toml` with your bucket name
2. Run `npm run build`
3. Run `wrangler deploy`

