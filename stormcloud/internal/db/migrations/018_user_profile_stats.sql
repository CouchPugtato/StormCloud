ALTER TABLE users ADD COLUMN total_match_reports INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN season_match_reports INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_event_stats (
  user_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  match_reports INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, event_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_key) REFERENCES events(event_key) ON DELETE CASCADE
);

ALTER TABLE match_scouting_data ADD COLUMN scout_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE pit_scouting_data ADD COLUMN scout_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE alliance_scouting_data ADD COLUMN scout_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_match_scouting_scout_user ON match_scouting_data(scout_user_id);
CREATE INDEX IF NOT EXISTS idx_pit_scouting_scout_user ON pit_scouting_data(scout_user_id);
CREATE INDEX IF NOT EXISTS idx_alliance_scouting_scout_user ON alliance_scouting_data(scout_user_id);
