CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  x_id TEXT NOT NULL UNIQUE,
  handle TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  wallet_address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tweet_url TEXT NOT NULL,
  lore TEXT NOT NULL,
  powers TEXT NOT NULL,
  image_key TEXT NOT NULL,
  image_content_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  bonus_winner INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nominations (
  user_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, submission_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_nominations_submission_id ON nominations(submission_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
