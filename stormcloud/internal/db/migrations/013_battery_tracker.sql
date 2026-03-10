CREATE TABLE IF NOT EXISTS battery_tracker_entries (
  id TEXT PRIMARY KEY,
  battery_name TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  created_by_user_id TEXT,
  unplugged_at INTEGER,
  safe_to_plug_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_battery_tracker_created_at
  ON battery_tracker_entries(created_at DESC);
