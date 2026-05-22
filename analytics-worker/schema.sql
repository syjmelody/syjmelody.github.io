CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visited_at TEXT NOT NULL,
  path TEXT NOT NULL,
  title TEXT,
  ip TEXT,
  ip_hash TEXT NOT NULL,
  country TEXT,
  user_agent TEXT,
  referer TEXT
);

CREATE INDEX IF NOT EXISTS idx_visits_visited_at ON visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_visits_ip_hash ON visits(ip_hash);
CREATE INDEX IF NOT EXISTS idx_visits_path ON visits(path);
