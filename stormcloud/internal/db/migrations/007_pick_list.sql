-- Pick list persistence: stores ordered teams with notes and strike state

CREATE TABLE IF NOT EXISTS pick_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key TEXT,                 -- optional; if null, global list
  team_key TEXT NOT NULL,         -- e.g., "frc2876"
  team_num INTEGER NOT NULL,      -- numeric team number for sorting/display
  rank INTEGER NOT NULL,          -- position in the pick list (1-based)
  notes TEXT,                     -- strategy notes specific to pick list
  struck_through INTEGER NOT NULL DEFAULT 0, -- 0=false, 1=true
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE(event_key, team_key)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_pick_list_event ON pick_list_items(event_key);
CREATE INDEX IF NOT EXISTS idx_pick_list_rank ON pick_list_items(event_key, rank);

-- Trigger to keep updated_at fresh
CREATE TRIGGER IF NOT EXISTS trg_pick_list_items_updated
AFTER UPDATE ON pick_list_items
FOR EACH ROW
BEGIN
  UPDATE pick_list_items SET updated_at = strftime('%s','now') WHERE id = NEW.id;
END;