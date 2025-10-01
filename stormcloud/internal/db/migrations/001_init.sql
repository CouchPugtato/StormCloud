PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS teams(
  team_key TEXT PRIMARY KEY,  -- e.g. "frc509"
  team_num INTEGER NOT NULL,
  name TEXT, city TEXT, state TEXT, country TEXT,
  rookie_year INTEGER,
  last_synced INTEGER
);

CREATE TABLE IF NOT EXISTS events(
  event_key TEXT PRIMARY KEY,
  year INTEGER, name TEXT,
  city TEXT, state TEXT, country TEXT,
  start_date TEXT, end_date TEXT
);

CREATE TABLE IF NOT EXISTS matches(
  match_key TEXT PRIMARY KEY,
  event_key TEXT,
  comp_level TEXT,
  set_number INTEGER,
  match_number INTEGER,
  time_real INTEGER,
  time_pred INTEGER,
  blue_teams TEXT,   -- JSON array ["frcXXXX",...]
  red_teams  TEXT,   -- JSON array
  blue_score INTEGER, red_score INTEGER
);

CREATE TABLE IF NOT EXISTS epa_team_year(
  team_num INTEGER,
  year INTEGER,
  payload JSON,
  PRIMARY KEY(team_num, year)
);

CREATE TABLE IF NOT EXISTS notes(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_key TEXT, team_key TEXT,
  author TEXT, note TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS channels(
  id TEXT PRIMARY KEY,
  name TEXT
);

CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT,
  author TEXT,
  body TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS subscriptions(
  user_id TEXT,
  channel_id TEXT,
  PRIMARY KEY(user_id, channel_id)
);

CREATE TABLE IF NOT EXISTS device_tokens(
  user_id TEXT,
  platform TEXT,  -- "ios" | "android" | "web"
  token TEXT,
  PRIMARY KEY(user_id, token)
);
