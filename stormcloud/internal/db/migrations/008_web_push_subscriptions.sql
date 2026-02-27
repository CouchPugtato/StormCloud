CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT,
  auth TEXT,
  platform TEXT DEFAULT 'web',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user
  ON web_push_subscriptions(user_id);
