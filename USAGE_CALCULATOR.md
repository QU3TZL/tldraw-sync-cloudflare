# Durable Objects Usage Calculator

## Free Tier Limit

**13,000 GB-seconds per day**

## How to Calculate Your Dec 7th Usage

### Option 1: Use Cloudflare Dashboard (Easiest)

1. Go to: https://dash.cloudflare.com/
2. Navigate: **Workers & Pages** → **Analytics** → **tldraw-sync**
3. Select: **Durable Objects** tab
4. Set date range: **December 7, 2025**
5. Look for: **"Total Duration"** or **"GB-seconds"** for that day
6. Compare to: **13,000 GB-seconds**

### Option 2: Estimate from Chart Bars

**Understanding the Chart:**

- Each bar represents duration for a time period (likely 15 minutes or 1 hour)
- The Y-axis shows GB-seconds for that period
- You need to **sum all bars** to get daily total

**Quick Estimation:**

1. Count the number of bars on Dec 7th
2. Estimate average value per bar
3. Multiply: `number_of_bars × average_value = estimated_total`

**Example:**

- If chart shows ~96 bars (one per 15 minutes = 24 hours)
- Average bar value: ~50 GB-seconds
- Estimated total: 96 × 50 = **4,800 GB-seconds** (under 13,000 limit ✅)

### Option 3: Manual Calculation

If you can see exact values:

1. List all bar values from the chart
2. Sum them: `value1 + value2 + value3 + ... = total`
3. Compare to 13,000

## What Your Chart Shows

Based on your description:

- **Low activity**: Bars at 2-5 (minimal usage)
- **High activity**: Bars at 40-80 (during active testing)
- **Decline**: Purple bars showing drop (after testing stopped)
- **Final spikes**: Orange bars (cleanup/persistence)

**Key Insight:**
The sustained high activity (blue bars 40-80) suggests objects stayed active for extended periods. With hibernation, these should drop to near-zero when you're not actively testing.

## Expected Usage After Hibernation

**Before Hibernation (Dec 7th):**

- Objects stayed active even after closing browser
- Duration accumulated continuously
- High sustained usage

**After Hibernation (Now):**

- Objects hibernate when you close browser
- Duration stops accumulating
- Usage should be: **only while actively testing**

**Expected Pattern:**

- **Active testing**: Bars spike to 40-80 (normal)
- **Close browser**: Bars drop to 0-2 within 1-2 minutes
- **Reopen browser**: Bars spike again (normal)
- **Daily total**: Much lower than before

## If You Exceeded 13,000 GB-seconds

**Why it happened:**

- Without hibernation, objects stayed active for hours
- Even brief testing sessions accumulated significant duration
- Multiple test sessions added up

**What to do:**

1. **Contact Cloudflare Support** - Explain it was testing without hibernation
2. **Request limit reset** - Since hibernation is now implemented
3. **Monitor going forward** - Usage should be much lower now

**Upgrade if needed:**

- Paid plan: $5/month
- 400,000 GB-seconds/month included
- Very affordable for development/testing

## Monitoring Going Forward

**Daily Check:**

1. Cloudflare Dashboard → Analytics → Durable Objects
2. Check daily total
3. Should be well under 13,000 GB-seconds/day with hibernation

**Weekly Review:**

- Compare usage before/after hibernation
- Should see 70-90% reduction in duration usage
- Only accumulate duration while actively testing

## Success Metrics

✅ **Hibernation working if:**

- Daily usage < 1,000 GB-seconds (for testing)
- Usage drops to near-zero when not testing
- No accumulation after closing browser

⚠️ **Still high usage if:**

- Daily usage > 5,000 GB-seconds (for testing)
- Usage continues after closing browser
- May need to investigate further
