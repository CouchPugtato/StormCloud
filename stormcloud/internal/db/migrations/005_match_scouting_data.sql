CREATE TABLE IF NOT EXISTS match_scouting_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_key TEXT NOT NULL,
  team_key TEXT NOT NULL,
  scout_name TEXT,
  
  auto_coral_l1 INTEGER DEFAULT 0,
  auto_coral_l2 INTEGER DEFAULT 0,
  auto_coral_l3 INTEGER DEFAULT 0,
  auto_coral_l4 INTEGER DEFAULT 0,
  auto_algae_net INTEGER DEFAULT 0,
  auto_algae_processor INTEGER DEFAULT 0,
  auto_reef INTEGER DEFAULT 0,
  auto_mobility BOOLEAN DEFAULT FALSE,
  
  teleop_coral_l1 INTEGER DEFAULT 0,
  teleop_coral_l2 INTEGER DEFAULT 0,
  teleop_coral_l3 INTEGER DEFAULT 0,
  teleop_coral_l4 INTEGER DEFAULT 0,
  teleop_algae_net INTEGER DEFAULT 0,
  teleop_algae_processor INTEGER DEFAULT 0,
  teleop_reef INTEGER DEFAULT 0,
  
  climb_level TEXT DEFAULT 'None', -- None, Low, Mid, High, Traversal
  climb_time INTEGER DEFAULT 0, -- seconds
  
  defense_rating INTEGER DEFAULT 0, -- 0-5 scale
  speed_rating INTEGER DEFAULT 0, -- 0-5 scale
  stability_rating INTEGER DEFAULT 0, -- 0-5 scale
  
  robot_broke BOOLEAN DEFAULT FALSE,
  general_notes TEXT DEFAULT '',
  
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  
  UNIQUE(match_key, team_key, scout_name),
  FOREIGN KEY(team_key) REFERENCES teams(team_key),
  FOREIGN KEY(match_key) REFERENCES matches(match_key)
);

CREATE INDEX IF NOT EXISTS idx_match_scouting_match ON match_scouting_data(match_key);
CREATE INDEX IF NOT EXISTS idx_match_scouting_team ON match_scouting_data(team_key);
CREATE INDEX IF NOT EXISTS idx_match_scouting_scout ON match_scouting_data(scout_name);
CREATE INDEX IF NOT EXISTS idx_match_scouting_created ON match_scouting_data(created_at);
CREATE TRIGGER IF NOT EXISTS update_match_scouting_timestamp 
  AFTER UPDATE ON match_scouting_data
  FOR EACH ROW
  BEGIN
    UPDATE match_scouting_data SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
  END;