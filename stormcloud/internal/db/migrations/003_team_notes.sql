ALTER TABLE teams ADD COLUMN pit_notes TEXT DEFAULT '';
ALTER TABLE teams ADD COLUMN scouting_notes TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_teams_notes ON teams(team_key);