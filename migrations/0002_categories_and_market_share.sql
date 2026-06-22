-- Phase C: category-scoped app rankings + market-share-by-author history.
-- See docs/superpowers/specs/2026-06-22-rankings-spike-findings.md.

-- 1) Category column on the existing snapshots table.
--    NULL  = global board (all existing + future hourly global app rows).
--    <slug>= a category-scoped app row (kind='app', period='day', category=slug).
ALTER TABLE rankings_snapshots ADD COLUMN category TEXT;

CREATE INDEX IF NOT EXISTS idx_snapshots_category
  ON rankings_snapshots (kind, category, snapshot_at DESC);

-- 2) Token share by model author over time (OpenRouter /rankings #market-share).
--    One row per (author, scrape). Read path takes the LAST row per author/day.
CREATE TABLE IF NOT EXISTS market_share_snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_at  TEXT    NOT NULL,                 -- ISO8601 UTC
  snapshot_day TEXT    NOT NULL,                 -- YYYY-MM-DD
  author       TEXT    NOT NULL,                 -- provider slug, e.g. 'anthropic'
  token_total  INTEGER NOT NULL,
  share_pct    REAL    NOT NULL,                 -- 0..100
  period       TEXT    NOT NULL DEFAULT 'day'
);

CREATE INDEX IF NOT EXISTS idx_market_share_lookup
  ON market_share_snapshots (snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_share_author
  ON market_share_snapshots (author, snapshot_at DESC);
