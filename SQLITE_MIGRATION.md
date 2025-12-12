# SQLite Migration - tldraw Sync Server

## Overview

Migrated from R2-only persistence to SQLite as source of truth, matching tldraw's new production strategy. This improves reliability, performance, and memory usage.

## What Changed

### Before (Old Approach)
- ❌ Entire document kept in memory
- ❌ Persisted to R2 every 10 seconds (async, fire-and-forget)
- ❌ Loaded from R2 on startup (async, slower)
- ❌ Silent failures possible (R2 persistence could fail without detection)
- ❌ Memory limits with large documents
- ❌ Multi-part upload issues

### After (New Approach)
- ✅ SQLite as source of truth (synchronous, guaranteed)
- ✅ R2 as optional backup/history (async, fire-and-forget)
- ✅ Synchronous load on startup (faster, no async overhead)
- ✅ Immediate error detection (synchronous writes)
- ✅ Lower memory usage (SQLite as off-heap storage)
- ✅ Automatic migration from R2 to SQLite

## Key Benefits

1. **Guaranteed Persistence**: SQLite writes are synchronous - we know immediately if they fail
2. **Faster Startup**: Synchronous SQLite reads are faster than async R2 fetches
3. **Lower Memory**: SQLite acts as off-heap storage, reducing memory pressure
4. **Better Reliability**: No silent failures - errors are detected immediately
5. **Backward Compatible**: Automatically migrates existing R2 snapshots to SQLite

## Implementation Details

### SQLite Schema

```sql
CREATE TABLE room_snapshots (
  room_id TEXT PRIMARY KEY,
  snapshot TEXT NOT NULL,
  schema_version TEXT,
  saved_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
```

### Persistence Flow

1. **On Data Change**:
   - Persist to SQLite synchronously (guaranteed, immediate error detection)
   - Backup to R2 asynchronously (optional, fire-and-forget)

2. **On Startup**:
   - Load from SQLite synchronously (fast, guaranteed)
   - If no SQLite data, migrate from R2 (one-time)
   - Validate schema version before loading

3. **On Hibernation**:
   - Room already persisted to SQLite
   - Optional R2 backup before hibernation (non-critical)

## Migration Path

Existing rooms are automatically migrated:
1. On first access after deployment, check SQLite
2. If no SQLite data, load from R2
3. Validate schema version
4. Persist to SQLite immediately
5. Future loads use SQLite only

## Configuration

SQLite is already enabled in `wrangler.toml`:
```toml
new_sqlite_classes = ["TldrawDurableObject"]
```

No additional configuration needed!

## Testing

After deployment, verify:
1. ✅ Rooms load from SQLite (check logs: "📦 Loaded room snapshot from SQLite")
2. ✅ Changes persist synchronously (check logs: "💾 Persisted to SQLite")
3. ✅ R2 migration works (check logs: "🔄 Migrating room snapshot from R2 to SQLite")
4. ✅ No silent failures (errors are logged immediately)

## Rollback

If needed, you can rollback by:
1. Reverting the code changes
2. Rooms will fall back to R2 automatically
3. SQLite data remains but is ignored

## Notes

- SQLite is the source of truth - R2 is just backup
- R2 failures are non-critical and logged as warnings
- SQLite failures throw errors immediately (guaranteed detection)
- Large documents (>5MB) skip R2 backup but still persist to SQLite
- Schema version validation prevents CLIENT_TOO_OLD errors

