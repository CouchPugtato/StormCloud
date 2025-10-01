-- Migration: Add pit scouting fields to teams table
-- This migration adds columns for storing detailed pit scouting information
-- Note: Columns already exist, so this migration only ensures the index is created

-- Create index for pit scouting queries
CREATE INDEX IF NOT EXISTS idx_teams_pit_scouting ON teams(robot_weight, robot_dimensions, drivebase_type);