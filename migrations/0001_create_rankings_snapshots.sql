-- Append-only history of OpenRouter rankings.
-- Cron writes one row per (kind, period, identifier) on each successful scrape.
-- 24h tab reads the latest "day" snapshot.
-- 7d tab reads either the latest "week" snapshot (models) or aggregates 7 days
-- of daily snapshots (apps). 30d aggregates 30 days of daily snapshots.

CREATE TABLE IF NOT EXISTS rankings_snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_at  TEXT    NOT NULL,                     -- ISO8601 UTC
  snapshot_day TEXT    NOT NULL,                     -- YYYY-MM-DD (derived for grouping)
  kind         TEXT    NOT NULL CHECK (kind IN ('model','app')),
  period       TEXT    NOT NULL CHECK (period IN ('day','week')),
  rank         INTEGER NOT NULL,
  identifier   TEXT    NOT NULL,                     -- modelSlug for models, title for apps
  name         TEXT,                                 -- display name (models)
  description  TEXT,                                 -- app description (apps)
  total_tokens INTEGER NOT NULL,
  origin_url   TEXT,                                 -- app origin URL (apps)
  favicon_url  TEXT                                  -- favicon URL (apps)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_lookup
  ON rankings_snapshots (kind, period, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_day
  ON rankings_snapshots (kind, snapshot_day, period);

CREATE INDEX IF NOT EXISTS idx_snapshots_identifier
  ON rankings_snapshots (identifier, snapshot_at DESC);
