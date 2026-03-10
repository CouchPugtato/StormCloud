CREATE TABLE IF NOT EXISTS alliance_scouting_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_key TEXT NOT NULL,
  alliance_color TEXT NOT NULL,
  scout_name TEXT DEFAULT '',
  general_info TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

  UNIQUE(match_key, alliance_color, scout_name),
  FOREIGN KEY(match_key) REFERENCES matches(match_key)
);

CREATE INDEX IF NOT EXISTS idx_alliance_scouting_match ON alliance_scouting_data(match_key);
CREATE INDEX IF NOT EXISTS idx_alliance_scouting_alliance ON alliance_scouting_data(alliance_color);
CREATE INDEX IF NOT EXISTS idx_alliance_scouting_scout ON alliance_scouting_data(scout_name);

CREATE TRIGGER IF NOT EXISTS update_alliance_scouting_timestamp
  AFTER UPDATE ON alliance_scouting_data
  FOR EACH ROW
  BEGIN
    UPDATE alliance_scouting_data
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
  END;
