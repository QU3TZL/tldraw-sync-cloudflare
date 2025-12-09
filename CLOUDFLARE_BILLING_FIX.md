# Cloudflare Durable Objects Billing Issue - Resolution Guide

## The Problem

You received an email saying you exceeded `2147483647` duration, which is:

- **2^31 - 1** (maximum 32-bit signed integer)
- A **known bug** in Cloudflare's notification system
- **NOT your actual usage**

## Actual Free Tier Limits

According to Cloudflare's official documentation:

- **Free Plan**: 13,000 GB-seconds of duration per day
- **Paid Plan**: 400,000 GB-seconds per month (plus $12.50 per million GB-seconds after that)

## Steps to Resolve

### 1. Check Your Actual Usage

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** → **Analytics**
3. Click on your worker: `tldraw-sync`
4. Check the **Durable Objects** tab
5. Review the actual duration usage (should be much less than 2 billion!)

### 2. Contact Cloudflare Support

**Option A: Through Dashboard**

1. Go to [Cloudflare Support](https://support.cloudflare.com/)
2. Click **Get Help** → **Open a Support Ticket**
3. Select **Billing & Account** → **Billing Issue**
4. Include this information:

   ```
   Subject: Durable Objects Billing Notification Bug

   I received an email stating I exceeded 2147483647 duration for Durable Objects,
   which appears to be a notification system bug (max 32-bit integer value).

   Account: Matt@rhombus[.]ventures's Account
   Worker: tldraw-sync
   Issue Date: 2025-12-08

   Please verify my actual usage and correct the notification system.
   ```

**Option B: Community Forum**

- Post in [Cloudflare Community](https://community.cloudflare.com/)
- Tag: `durable-objects`, `billing`, `bug`

### 3. Monitor Usage Going Forward

With hibernation now implemented, you should see:

- **Lower duration charges** (objects hibernate when idle)
- **More accurate usage tracking** in the dashboard

### 4. If You Actually Need More Capacity

If your real usage exceeds 13,000 GB-seconds/day:

**Upgrade to Paid Plan:**

- $5/month base Workers plan
- 400,000 GB-seconds/month included
- $12.50 per million GB-seconds after that
- Typically very affordable for small-medium apps

**To Upgrade:**

1. Dashboard → **Billing** → **Plans**
2. Select **Workers Paid Plan**
3. Review pricing and upgrade

## Verification Checklist

- [ ] Checked actual usage in Cloudflare Dashboard
- [ ] Confirmed usage is below 13,000 GB-seconds/day
- [ ] Contacted Cloudflare support about the bug
- [ ] Verified hibernation is working (objects hibernate when idle)
- [ ] Monitoring usage daily for the next week

## Understanding Your Usage Chart (Dec 7th)

Based on your usage chart showing "only me testing":

**What Happened:**

- **Without hibernation**: Durable Objects stayed alive even when you closed your browser
- **Duration accumulated continuously** while objects were active
- The high blue bars (40-80) show sustained activity during testing
- Purple bars show decline after you stopped testing (objects eventually shut down)
- Orange bars at end may be cleanup/final persistence

**Key Insight:**
Even brief testing sessions can generate significant duration if objects don't hibernate. A single test session that leaves objects active for hours can accumulate thousands of GB-seconds.

**Free Tier Limit:**

- **13,000 GB-seconds per day**
- If your chart shows values like 40-80 per time period, you need to sum all bars to see total daily usage
- Check the dashboard for the exact total (should show daily sum)

## Expected Behavior After Hibernation

With hibernation now deployed:

- Durable Objects hibernate **immediately** when you close your browser/end testing
- Duration charges **stop** when hibernated
- Objects wake up automatically when you start testing again
- **You should see dramatically lower usage** - bars should drop to near-zero when you're not actively testing
- Testing sessions will only accumulate duration while you're actively connected

## Useful Links

- [Cloudflare Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Durable Objects Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/hibernation/)
- [Cloudflare Support](https://support.cloudflare.com/)
