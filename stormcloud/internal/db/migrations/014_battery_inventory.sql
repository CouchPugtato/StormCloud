CREATE TABLE IF NOT EXISTS battery_inventory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rank INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_battery_inventory_rank
  ON battery_inventory(rank ASC);
