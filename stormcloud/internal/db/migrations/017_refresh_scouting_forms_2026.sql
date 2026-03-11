DROP TRIGGER IF EXISTS update_match_scouting_timestamp;
DROP TRIGGER IF EXISTS update_pit_scouting_timestamp;
DROP TRIGGER IF EXISTS update_alliance_scouting_timestamp;

DROP TABLE IF EXISTS match_scouting_data;
CREATE TABLE IF NOT EXISTS match_scouting_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_key TEXT NOT NULL,
  team_key TEXT NOT NULL,
  scout_name TEXT DEFAULT '',
  was_auto BOOLEAN DEFAULT FALSE,
  conflicted_own_alliance BOOLEAN DEFAULT FALSE,
  conflicted_opposing_alliance BOOLEAN DEFAULT FALSE,
  used_outpost BOOLEAN DEFAULT FALSE,
  used_depot BOOLEAN DEFAULT FALSE,
  cycles INTEGER DEFAULT 0,
  percent_contributed INTEGER DEFAULT 0,
  auto_points_contributed INTEGER DEFAULT 0,
  got_disabled BOOLEAN DEFAULT FALSE,
  bps_rating INTEGER DEFAULT 0,
  obvious_penalties TEXT DEFAULT '',
  primary_path TEXT DEFAULT '',
  index_via_intake BOOLEAN DEFAULT FALSE,
  intake_speed INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  shooter_range_close BOOLEAN DEFAULT FALSE,
  shooter_range_mid BOOLEAN DEFAULT FALSE,
  shooter_range_far BOOLEAN DEFAULT FALSE,
  climb BOOLEAN DEFAULT FALSE,
  climb_level TEXT DEFAULT '',
  climb_location TEXT DEFAULT '',
  accuracy_successful INTEGER DEFAULT 0,
  accuracy_attempted INTEGER DEFAULT 0,
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

DROP TABLE IF EXISTS pit_scouting_data;
CREATE TABLE IF NOT EXISTS pit_scouting_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_key TEXT NOT NULL,
  event_key TEXT DEFAULT '',
  scout_name TEXT DEFAULT '',
  estimated_bps TEXT DEFAULT '',
  shooter_archetype TEXT DEFAULT '',
  can_trench BOOLEAN DEFAULT FALSE,
  can_bump BOOLEAN DEFAULT FALSE,
  climb_level TEXT DEFAULT '',
  auto_climb BOOLEAN DEFAULT FALSE,
  climb_location TEXT DEFAULT '',
  weight TEXT DEFAULT '',
  height TEXT DEFAULT '',
  vision_capabilities TEXT DEFAULT '',
  dimensions TEXT DEFAULT '',
  auto_picture TEXT DEFAULT '',
  battery_count INTEGER DEFAULT 0,
  auto_count INTEGER DEFAULT 0,
  index_via_intake BOOLEAN DEFAULT FALSE,
  intake_always_out BOOLEAN DEFAULT FALSE,
  feeding TEXT DEFAULT '',
  full_field BOOLEAN DEFAULT FALSE,
  half_field BOOLEAN DEFAULT FALSE,
  push_fuel BOOLEAN DEFAULT FALSE,
  drivetrain TEXT DEFAULT '',
  swerve_level TEXT DEFAULT '',
  programming_language TEXT DEFAULT '',
  years_used_programming_language TEXT DEFAULT '',
  indexer_type TEXT DEFAULT '',
  has_spindexer BOOLEAN DEFAULT FALSE,
  has_rollers BOOLEAN DEFAULT FALSE,
  has_belts BOOLEAN DEFAULT FALSE,
  indexer_other TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  must_point_at_hub BOOLEAN DEFAULT FALSE,
  motors_besides_drivetrain INTEGER DEFAULT 0,
  drivetrain_motors INTEGER DEFAULT 0,
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

DROP TABLE IF EXISTS alliance_scouting_data;
CREATE TABLE IF NOT EXISTS alliance_scouting_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_key TEXT NOT NULL,
  alliance_color TEXT NOT NULL,
  scout_name TEXT DEFAULT '',
  defense_played BOOLEAN DEFAULT FALSE,
  defense_quality TEXT DEFAULT '',
  general_strategy TEXT DEFAULT '[]',
  notes TEXT DEFAULT '',
  feeding_distance TEXT DEFAULT '',
  auto_points_scored INTEGER DEFAULT 0,
  auto_result TEXT DEFAULT '',
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
    UPDATE alliance_scouting_data SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
  END;
