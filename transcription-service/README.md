# Transcription Service

Video/audio transcription service using WhisperX for Tennis Wire.

## Features

- 🎙️ High-quality transcription with WhisperX
- 🎯 Word-level timestamps
- 👥 Speaker diarization (who said what)
- 🌍 Automatic language detection
- 📺 YouTube and direct URL support
- 📁 File upload support
- ⚡ Async processing with ARQ

## Quick Start

### Prerequisites

- Python 3.12+
- Redis (for task queue)
- FFmpeg
- NVIDIA GPU (optional, for fast transcription)

### Development Setup

```bash
# Install uv (if not installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Clone and setup
cd transcription-service
uv sync

# Start infrastructure
docker compose up -d

# Copy environment
cp .env.example .env

# Run API server
uv run python -m transcription.main

# In another terminal - run worker
uv run arq transcription.worker.tasks.WorkerSettings
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/transcribe/url` | Start transcription from URL |
| POST | `/api/transcribe/file` | Upload file and transcribe |
| GET | `/api/transcribe/{job_id}` | Get job status |
| GET | `/api/transcribe/{job_id}/result` | Get transcription result |
| DELETE | `/api/transcribe/{job_id}` | Cancel job |

### Example Usage

```bash
# Transcribe YouTube video
curl -X POST http://localhost:8001/api/transcribe/url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://youtube.com/watch?v=...",
    "language": "en",
    "enable_diarization": true
  }'

# Response
{
  "job_id": "abc123...",
  "status": "pending",
  "message": "Transcription job created"
}

# Check status
curl http://localhost:8001/api/transcribe/abc123

# Get result (when completed)
curl http://localhost:8001/api/transcribe/abc123/result
```

## Development

```bash
# Format code
uv run ruff format .

# Lint
uv run ruff check --fix .

# Type check
uv run mypy src

# Run tests
uv run pytest -v

# Run tests with coverage
uv run pytest --cov=src --cov-report=html

# All checks
uv run ruff check . && uv run ruff format --check . && uv run mypy src && uv run pytest
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Editorial  │────▶│   FastAPI   │────▶│    Redis    │
│     UI      │     │    Server   │     │   (Queue)   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                    ┌─────────────┐     ┌─────────────┐
                    │     S3      │◀────│   Worker    │
                    │   Storage   │     │  (WhisperX) │
                    └─────────────┘     └─────────────┘
```

## Configuration

See `.env.example` for all configuration options.

Key settings:

| Variable | Description | Default |
|----------|-------------|---------|
| `WHISPER_MODEL` | WhisperX model | `large-v3` |
| `WHISPER_DEVICE` | `cuda` or `cpu` | `cuda` |
| `HF_TOKEN` | HuggingFace token for diarization | - |
| `MAX_DURATION_MINUTES` | Max video length | `180` |

## License

MIT
