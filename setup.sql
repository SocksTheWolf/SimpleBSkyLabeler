CREATE TABLE IF NOT EXISTS labeled (
  id INTEGER PRIMARY KEY, 
  account STRING UNIQUE NOT NULL, 
  time TIMESTAMP DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW', 'localtime')) NOT NULL, 
  neg INTEGER DEFAULT 0 NOT NULL 
);
CREATE INDEX IF NOT EXISTS idx_labeled_non_removed ON labeled(neg) WHERE neg == 0;
pragma optimize
