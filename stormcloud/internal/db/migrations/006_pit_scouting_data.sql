CREATE TABLE IF NOT EXISTS pit_scouting_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_key TEXT NOT NULL,
  event_key TEXT,
  scout_name TEXT,
  
  robot_weight TEXT DEFAULT '',
  robot_dimensions TEXT DEFAULT '',
  drivebase_type TEXT DEFAULT '',
  
  max_coral_level INTEGER DEFAULT 0, -- 1-4
  can_climb BOOLEAN DEFAULT FALSE,
  max_climb_level TEXT DEFAULT 'None', -- None, Low, Mid, High, Traversal
  climb_time_estimate INTEGER DEFAULT 0, -- seconds
  
  auto_mobility BOOLEAN DEFAULT FALSE,
  auto_scoring_capability TEXT DEFAULT '', -- Description of auto scoring
  
  preferred_starting_position TEXT DEFAULT '',
  strategy_notes TEXT DEFAULT '',
  strengths TEXT DEFAULT '',
  weaknesses TEXT DEFAULT '',
  general_notes TEXT DEFAULT '',
  
  programming_language TEXT DEFAULT '',
  vision_system BOOLEAN DEFAULT FALSE,
  autonomous_reliability INTEGER DEFAULT 0, -- 0-5 scale
  
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  
  UNIQUE(team_key, event_key, scout_name),
  FOREIGN KEY(team_key) REFERENCES teams(team_key),
  FOREIGN KEY(event_key) REFERENCES events(event_key)
);

CREATE INDEX IF NOT EXISTS idx_pit_scouting_team ON pit_scouting_data(team_key);
CREATE INDEX IF NOT EXISTS idx_pit_scouting_event ON pit_scouting_data(event_key);
CREATE INDEX IF NOT EXISTS idx_pit_scouting_scout ON pit_scouting_data(scout_name);
CREATE INDEX IF NOT EXISTS idx_pit_scouting_created ON pit_scouting_data(created_at);
CREATE TRIGGER IF NOT EXISTS update_pit_scouting_timestamp 
  AFTER UPDATE ON pit_scouting_data
  FOR EACH ROW
  BEGIN
    UPDATE pit_scouting_data SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
  END;