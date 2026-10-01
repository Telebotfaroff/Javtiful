CREATE TABLE IF NOT EXISTS telegram_videos (
  code TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  message_id BIGINT NOT NULL,
  video_file_id TEXT,
  file_unique_id TEXT,
  duration INTEGER,
  width INTEGER,
  height INTEGER,
  file_size BIGINT,
  mime_type TEXT,
  media_group_id TEXT,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_gallery (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL REFERENCES telegram_videos(code) ON DELETE CASCADE,
  message_id BIGINT NOT NULL,
  file_id TEXT NOT NULL,
  file_unique_id TEXT,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code, message_id)
);

CREATE TABLE IF NOT EXISTS telegram_media_groups (
  media_group_id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_pending_groups (
  media_group_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_messages (
  channel_id TEXT NOT NULL,
  message_id BIGINT NOT NULL,
  PRIMARY KEY (channel_id, message_id)
);

CREATE TABLE IF NOT EXISTS telegram_recent (
  code TEXT PRIMARY KEY,
  indexed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS telegram_recent_indexed_at_idx ON telegram_recent (indexed_at DESC);
CREATE INDEX IF NOT EXISTS telegram_gallery_code_idx ON telegram_gallery (code);
CREATE INDEX IF NOT EXISTS telegram_videos_indexed_at_idx ON telegram_videos (indexed_at DESC);
