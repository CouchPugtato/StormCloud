CREATE TABLE IF NOT EXISTS managed_events (
    event_key TEXT PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'tba',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
