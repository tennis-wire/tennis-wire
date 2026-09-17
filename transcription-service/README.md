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
- Keycloak (every request under `/api/transcribe` is verified against it)
- FFmpeg
- NVIDIA GPU (optional, for fast transcription)

### Development Setup

```bash
# Install uv (if not installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Clone and setup
cd transcription-service
uv sync

# Start infrastructure (from the repository root)
docker compose up -d

# Copy environment
cp .env.example .env

# Run API server
uv run python -m transcription.main

# In another terminal - run worker
uv run arq transcription.worker.tasks.WorkerSettings
```

### API Endpoints

Everything under `/api/transcribe` needs a bearer token with the `author` role. The service
checks it itself, as the Java services do: signature against the realm's JWKS, `iss`, `aud`
(`tennis-wire-api`), `exp`. No token or a bad one is 401, a valid token without the role is 403,
Keycloak unreachable on a key refresh is 503. `/api/health` stays anonymous for probes.

A job belongs to the author who started it (`sub` from the token). Status, result and cancel
answer 404 on someone else's job, the same as on a missing one.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check, anonymous |
| POST | `/api/transcribe/url` | Start transcription from URL |
| POST | `/api/transcribe/file` | Upload file and transcribe |
| GET | `/api/transcribe/jobs` | The caller's jobs, newest first (`limit` 1-100, default 50) |
| GET | `/api/transcribe/{job_id}` | Get job status |
| GET | `/api/transcribe/{job_id}/result` | Get transcription result |
| DELETE | `/api/transcribe/{job_id}` | Cancel job |

### Example Usage

A token for the local `dev` user (Keycloak from the root `docker-compose.yml`):

```bash
TOKEN=$(curl -s -d grant_type=password -d client_id=dev-cli \
  -d username=dev -d password=dev \
  http://localhost:8180/realms/tennis-wire/protocol/openid-connect/token \
  | jq -r .access_token)

# Transcribe YouTube video
curl -X POST http://localhost:8001/api/transcribe/url \
  -H "Authorization: Bearer $TOKEN" \
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
curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/transcribe/abc123

# My jobs
curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/transcribe/jobs

# Get result (when completed)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/transcribe/abc123/result
```

The worker logs the owner's username when it picks a job up: that is where to look for who is
holding the GPU.

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
| `KEYCLOAK_ISSUER_URI` | Token issuer; JWKS is read from `<issuer>/protocol/openid-connect/certs` | `http://localhost:8180/realms/tennis-wire` |

## License

MIT
