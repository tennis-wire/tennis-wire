# Development

## Prerequisites

- JDK 25 (the Gradle toolchain resolves it automatically)
- Node 20+
- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- Docker with Compose v2
- ffmpeg (required by the transcription worker for audio extraction)

## Local infrastructure

All shared infrastructure lives in the root `docker-compose.yml`:

```bash
docker compose up -d      # start
docker compose ps         # check
docker compose down       # stop, keep data
docker compose down -v    # stop and wipe all volumes
```

Individual components, when the full stack is not needed:

```bash
docker compose up -d postgres                  # java services only
docker compose up -d redis minio minio-init    # transcription only
```

Application services are not containerised yet and are expected to run from the
IDE or the command line against this stack. There is no restart policy: after a
Docker Desktop or machine restart the containers stay down until `up -d`.

| Component | Image | Port | Credentials |
|---|---|---|---|
| PostgreSQL | `postgres:18-alpine` | 5432 | `postgres` / `postgres` (superuser) |
| Redis | `redis:8-alpine` | 6379 | — |
| MinIO (S3 API) | `minio/minio` pinned | 9000 | `minioadmin` / `minioadmin` |
| MinIO console | — | 9001 | `minioadmin` / `minioadmin` |

These credentials are local development defaults and are intentionally in the
repository. They must never be reused anywhere else.

### Databases

One PostgreSQL instance, one database and one owning role per service. They are
created by `docker/postgres/init/01-create-databases.sh`, which runs **only when
the data volume is empty**. Services connect under their own role, never as the
superuser.

| Service | Database | Role | Password |
|---|---|---|---|
| content-service | `tennis_content` | `content` | `content` |

To add a service, append a `create_service_db` line to the init script, then
either recreate the volume:

```bash
docker compose down -v && docker compose up -d   # wipes all local data
```

or apply the same change to the running instance:

```bash
docker compose exec postgres psql -U postgres -c \
  "CREATE ROLE <role> WITH LOGIN PASSWORD '<password>'; CREATE DATABASE <db> OWNER <role>;"
```

The PostgreSQL major version is pinned in two places that must move together:
the root `docker-compose.yml` and `TestcontainersConfiguration` in
content-service.

Note for PostgreSQL 18+: the data volume mounts at `/var/lib/postgresql`, not
`/var/lib/postgresql/data`. The entrypoint refuses to start if it finds a mount
at the old path.

### Object storage

MinIO emulates S3 locally. The `transcription` bucket is created on startup by
the one-shot `minio-init` container, which exits once done and therefore does
not appear in `docker compose ps` (use `ps -a`).

The MinIO community edition is archived upstream: the image is pinned to the
last release published to Docker Hub and will not receive updates. This is
acceptable for a local-only emulator; production object storage is a separate
decision. The community console is a read-only object
browser — bucket administration is done with `mc`.

## Services

| Service | Port | Notes |
|---|---|---|
| api-gateway | 8090 | routes `/api/**` to the services below |
| editorial-bff | 8080 | |
| content-service | 8091 | requires PostgreSQL |
| transcription-service | 8001 | requires Redis + MinIO |
| editorial-ui (Vite) | 5173 | |

### Java services

```bash
./gradlew :content-service:bootRun
./gradlew :editorial-bff:bootRun
./gradlew :api-gateway:bootRun
```

Datasource settings are overridable via `DB_HOST`, `DB_PORT`, `DB_NAME`,
`DB_USERNAME` and `DB_PASSWORD`.

### Transcription service

```bash
cd transcription-service
cp .env.example .env
uv sync
uv run python -m transcription.main                       # API
uv run arq transcription.worker.tasks.WorkerSettings      # worker
```

Set `WHISPER_DEVICE=cpu` in `.env` on machines without an NVIDIA GPU.

## Checks

```bash
./gradlew check                       # spotless, PMD, SpotBugs, tests
cd transcription-service && uv run ruff check . && uv run mypy src && uv run pytest
```

CI runs the same checks in `.github/workflows/ci-java.yml` and `ci-python.yml`,
each with path filters.
