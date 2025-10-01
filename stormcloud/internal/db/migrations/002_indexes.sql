CREATE INDEX IF NOT EXISTS idx_teams_num ON teams(team_num);
CREATE INDEX IF NOT EXISTS idx_events_year ON events(year);
CREATE INDEX IF NOT EXISTS idx_matches_event ON matches(event_key);
CREATE INDEX IF NOT EXISTS idx_notes_match ON notes(match_key);
