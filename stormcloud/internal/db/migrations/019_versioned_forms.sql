CREATE TABLE scouting_forms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  season INTEGER NOT NULL CHECK (season BETWEEN 1992 AND 9999),
  kind TEXT NOT NULL CHECK (kind IN ('match', 'pit', 'alliance')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE scouting_form_versions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES scouting_forms(id),
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  revision INTEGER NOT NULL DEFAULT 1,
  definition TEXT NOT NULL CHECK (json_valid(definition)),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER,
  UNIQUE(form_id, version)
);

CREATE TABLE scouting_form_submissions (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES scouting_form_versions(id),
  scout_user_id TEXT NOT NULL REFERENCES users(id),
  event_key TEXT NOT NULL REFERENCES events(event_key),
  team_key TEXT REFERENCES teams(team_key),
  match_key TEXT REFERENCES matches(match_key),
  alliance_color TEXT CHECK (alliance_color IN ('red', 'blue')),
  answers TEXT NOT NULL CHECK (json_valid(answers)),
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_scouting_forms_season_kind ON scouting_forms(season, kind);
CREATE INDEX idx_form_versions_form ON scouting_form_versions(form_id, status, version);
CREATE INDEX idx_form_submissions_context ON scouting_form_submissions(event_key, team_key, match_key);
CREATE INDEX idx_form_submissions_scout ON scouting_form_submissions(scout_user_id, created_at);

CREATE TRIGGER immutable_published_form_version_update
BEFORE UPDATE ON scouting_form_versions WHEN OLD.status = 'published'
BEGIN
  SELECT RAISE(ABORT, 'published form versions are immutable');
END;

CREATE TRIGGER immutable_published_form_version_delete
BEFORE DELETE ON scouting_form_versions WHEN OLD.status = 'published'
BEGIN
  SELECT RAISE(ABORT, 'published form versions are immutable');
END;

CREATE TRIGGER submission_requires_published_version
BEFORE INSERT ON scouting_form_submissions
WHEN NOT EXISTS (SELECT 1 FROM scouting_form_versions WHERE id = NEW.version_id AND status = 'published')
BEGIN
  SELECT RAISE(ABORT, 'submissions require a published form version');
END;
