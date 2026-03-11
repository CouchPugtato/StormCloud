CREATE TABLE IF NOT EXISTS scouting_schedule_assignments (
  event_key TEXT NOT NULL,
  match_key TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  user_id TEXT,
  assigned_by_user_id TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  PRIMARY KEY (match_key, slot_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scouting_schedule_event_match
ON scouting_schedule_assignments(event_key, match_key);
