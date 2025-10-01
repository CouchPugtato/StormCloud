-- Add team notes columns to teams table
ALTER TABLE teams ADD COLUMN pit_notes TEXT DEFAULT '';
ALTER TABLE teams ADD COLUMN scouting_notes TEXT DEFAULT '';

-- Create index for team notes queries
CREATE INDEX IF NOT EXISTS idx_teams_notes ON teams(team_key);