# Verifying Durable Objects Hibernation

## Quick Test: Is Hibernation Working?

### Step 1: Baseline Test (Before Hibernation Behavior)

1. Open your canvas app: `https://your-app-url.com/canvas/[room-id]`
2. Note the current time
3. **Close your browser completely** (or close the tab)
4. Wait 10 minutes
5. Check Cloudflare dashboard → Workers → Analytics → Durable Objects
6. **Expected (OLD behavior)**: Duration continues accumulating even after you closed browser
7. **Expected (NEW behavior with hibernation)**: Duration should stop accumulating within 1-2 minutes

### Step 2: Active Test (Verify Hibernation)

1. Open canvas app in browser
2. **Keep it open** and draw/make changes for 2-3 minutes
3. Note the time you started
4. **Close browser completely**
5. Wait 5 minutes
6. Check the usage chart in Cloudflare dashboard
7. **Expected**:
   - Usage spikes while you're active (normal)
   - Usage drops to near-zero after you close browser (hibernation working!)

### Step 3: Reconnection Test

1. Open canvas app again (same room)
2. **Expected**: Room should load from R2 (persisted before hibernation)
3. Make a change
4. **Expected**: Change should work normally
5. This confirms hibernation → wake → persistence cycle works

## Monitoring Hibernation in Real-Time

### Check Cloudflare Logs

1. Go to Cloudflare Dashboard → Workers → `tldraw-sync` → Logs
2. Look for these log messages:
   - `🔌 WebSocket closed, object may hibernate` - Connection closed
   - `💤 Last connection closed, persisting room before hibernation` - About to hibernate
   - `✅ Final persistence completed before hibernation` - Hibernation ready

### Expected Log Pattern

```
🔍 Server connecting client: { sessionId: '...', roomId: '...' }
✅ Server connected client to room
[User closes browser]
🔌 WebSocket closed, object may hibernate: { code: 1001, remainingConnections: 0 }
💤 Last connection closed, persisting room before hibernation
✅ Final persistence completed before hibernation
```

## Calculating Your Dec 7th Usage

### Method 1: Dashboard Total

1. Cloudflare Dashboard → Workers → Analytics
2. Select date: **December 7, 2025**
3. Look for **"Total Duration"** or **"GB-seconds"** for the day
4. Compare to limit: **13,000 GB-seconds/day**

### Method 2: Estimate from Chart

If the chart shows values like:

- **40-80 per time period** (let's say these are 15-minute intervals)
- **Sustained high activity** for ~10 hours = 40 intervals
- **Average ~60 per interval**

**Rough calculation:**

- 40 intervals × 60 GB-seconds = **2,400 GB-seconds**
- Plus low activity periods: ~500 GB-seconds
- **Estimated total: ~3,000 GB-seconds** (well under 13,000 limit)

**Note**: The actual units depend on how Cloudflare aggregates the data. Check the dashboard for exact totals.

## Troubleshooting

### If Hibernation Doesn't Seem to Work

1. **Check deployment version:**

   ```bash
   cd tldraw-sync-server
   grep -r "webSocketClose\|acceptWebSocket" dist/tldraw_sync/index.js
   ```

   Should show these functions exist.

2. **Check WebSocket close events:**

   - Open browser DevTools → Network tab
   - Filter: WS (WebSocket)
   - Connect to canvas
   - Close browser
   - Check if WebSocket closes with code 1001 (normal closure)

3. **Verify acceptWebSocket is used:**
   - The code should use `ctx.acceptWebSocket()` not `ws.accept()`
   - Check: `tldraw-sync-server/worker/TldrawDurableObject.ts` line 80

### Common Issues

**Issue**: Objects still accumulating duration after closing browser

- **Cause**: WebSocket not properly closing
- **Fix**: Check browser DevTools → Network → WS tab to see if connection closes

**Issue**: Room state not persisting before hibernation

- **Cause**: Final persistence might be failing
- **Fix**: Check Cloudflare logs for persistence errors

**Issue**: Room doesn't wake up properly

- **Cause**: R2 snapshot might be corrupted
- **Fix**: Check R2 bucket for room snapshots, verify they're valid JSON

## Success Indicators

✅ **Hibernation is working if:**

- Usage drops to near-zero within 1-2 minutes after closing browser
- Logs show "WebSocket closed" and "persisting room before hibernation"
- Room state persists and loads correctly when reconnecting
- Daily usage is much lower than before hibernation

❌ **Hibernation is NOT working if:**

- Usage continues accumulating after closing browser
- No "WebSocket closed" messages in logs
- Room state is lost between sessions
- Usage pattern looks the same as before

## Next Steps After Verification

1. **If hibernation works**: Monitor for a few days to confirm reduced usage
2. **If hibernation doesn't work**: Check logs and verify deployment
3. **If usage still high**: May need to investigate other causes (memory leaks, etc.)
