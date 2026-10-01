# Telegram GitHub Index

The Telegram media index is intentionally stored outside this repository.

## Repository

Set:

```env
TELEGRAM_INDEX_GITHUB_OWNER=Telebotfaroff
TELEGRAM_INDEX_GITHUB_REPO=javtiful-telegram-index
TELEGRAM_INDEX_GITHUB_BRANCH=main
TELEGRAM_INDEX_GITHUB_TOKEN=...
```

The token must have Contents read/write access to the index repository.

## Layout

```text
videos/<PREFIX>/<NUMBER>.json
messages/<2-char-sha256>.json
media-groups/<MEDIA_GROUP_ID>.json
pending-groups/<MEDIA_GROUP_ID>.json
catalog/recent.json
catalog/stats.json
```

A video record contains Telegram media information only:

```json
{
  "code": "016DHT-0881",
  "telegram": {
    "channel_id": "-100...",
    "message_id": 12345,
    "video_file_id": "BAAC...",
    "gallery": []
  },
  "indexed_at": "2026-10-01T12:00:00.000Z"
}
```

`javtiful-scraper` remains the read-only metadata source.

The application never clones this repository and never loads the full database into RAM. Individual video lookups read one JSON file. Message deduplication reads one deterministic shard. A bounded in-memory cache is used only for recently accessed records.

## Required GitHub token

Use a fine-grained GitHub token with repository Contents read/write access to the Telegram index repository only. Do not put the token in VITE variables or frontend code.
