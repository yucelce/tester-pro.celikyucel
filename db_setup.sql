
-- Vercel projenizde bağlı olan Postgres veritabanının "Query" (Sorgu) sekmesinde bu komutu bir kez çalıştırın.

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  project_uuid TEXT UNIQUE NOT NULL,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data JSONB NOT NULL,
  last_modified BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Hızlı sorgulama için index
CREATE INDEX IF NOT EXISTS idx_projects_account_id ON projects(account_id);
