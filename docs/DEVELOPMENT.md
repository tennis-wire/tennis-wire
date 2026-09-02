# Development

## Prerequisites

- JDK 25 (the Gradle toolchain resolves it automatically)
- Node 24 LTS, pinned in `.nvmrc`
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
| Keycloak | `quay.io/keycloak/keycloak` pinned | 8180 | `admin` / `admin` |

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

### Identity

Keycloak holds identity only: who someone is, which roles they have, which
tokens they get. Everything else about a user lives in the services.

The realm is imported from `docker/keycloak/import/tennis-wire-realm.json` at
container creation. There is **no volume**: the container keeps its H2 store on
its own filesystem, so recreating it wipes the realm and reimports the file.
That is what keeps the file the single source of truth.

```bash
docker compose up -d --force-recreate keycloak   # after editing the realm file
```

`docker compose restart keycloak` keeps the filesystem and does **not**
reimport. Neither does plain `up -d` when only the mounted JSON changed. The
log line to look for is `Import finished successfully`; `Strategy:
IGNORE_EXISTING` above it means an existing realm is left alone.

The file is written by hand and is not a Keycloak export. Use the admin console
at <http://localhost:8180> to try things out, then port the result back into the
JSON yourself. Three reasons not to export:

- `kc.sh export` cannot run against a live `start-dev` server — the H2 file is
  locked by the running process, and there is no volume to export from once the
  container is gone.
- Partial export from the console omits users entirely and replaces client
  secrets with asterisks.
- A full export is thousands of lines of generated UUIDs, which makes every
  diff unreadable.

Keep the file small and describe only what is ours. Keycloak creates the
built-in client scopes, authentication flows and `default-roles-tennis-wire`
itself. One trap worth knowing: a realm-level `clientScopes` array **replaces**
the built-in scopes rather than adding to them, which strips `roles`, `profile`
and `email` from every client and produces tokens with no `realm_access.roles`.
That is why the audience mapper is repeated on each client instead.

Local principals:

| Principal | Credentials | Roles |
|---|---|---|
| `dev` | `dev` / `dev` | `author`, `admin` (so also `moderator` and `user`) |
| `reader` | `reader` / `reader` | `user` |
| `moderation-bot` | client secret `dev-moderation-bot-secret` | `moderator-bot` |

`dev-cli` is a password-grant client that exists only for `curl` and for the
gateway integration test. ROPC is deprecated in OAuth 2.1; this client must
never appear in a deployed realm.

```bash
TOKEN=$(curl -s -d grant_type=password -d client_id=dev-cli \
  -d username=dev -d password=dev \
  http://localhost:8180/realms/tennis-wire/protocol/openid-connect/token \
  | jq -r .access_token)

echo "$TOKEN" | jq -R 'split(".")[1] | @base64d | fromjson | {aud, azp, realm_access}'
```

Production is a separate problem, deliberately unsolved: `--import-realm` only
creates a realm that does not exist yet and never updates one, so it is not a
configuration-management mechanism. What must not drift between local and
production are the role, client and scope names, and those are fixed in
`architecture/auth.md`, not here.

## Services

All browser and mobile traffic goes through the gateway, including the
editorial UI: the frontends know one backend host and nothing else.

CORS lives only on the gateway. The services behind it have none, so pointing
a frontend straight at `:8080` or `:8001` will fail preflight — that is the
intended behaviour, not a misconfiguration.

| Service | Port | Notes |
|---|---|---|
| api-gateway | 8090 | routes `/api/**` to the services below; terminates CORS |
| editorial-bff | 8080 | AI chat and translation |
| content-service | 8091 | requires PostgreSQL |
| transcription-service | 8001 | requires Redis + MinIO |
| editorial-ui (Vite) | 5173 | |
| public-web (Next.js) | 3000 | |
| mobile (Expo dev server) | 8081 | |

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

### Frontends

Each app under `apps/` has its own `package-lock.json` and is installed
separately — there is no workspace root.

```bash
cd apps/editorial-ui && npm ci && npm run dev     # :5173
cd apps/public-web   && npm ci && npm run dev     # :3000
cd apps/mobile       && npm ci && npm start       # Expo
```

Formatting is shared: a single `.prettierrc` at the repository root applies to
all three apps, each of which keeps its own `.prettierignore`. ESLint config is
per app.

`apps/mobile/.npmrc` sets `legacy-peer-deps=true` and is committed on purpose,
so that CI resolves peers the same way a local install does. The reason is
documented in the file itself.

Expo dependencies are updated with `expo install --fix`, never with
`npm update`. Renovate is configured accordingly: mobile packages are grouped
into one PR and majors are disabled, because a major there means an SDK bump.

## Checks

```bash
./gradlew check                       # spotless, PMD, SpotBugs, tests

cd transcription-service
uv run ruff check .
uv run ruff format --check .
uv run mypy src
uv run pytest

cd apps/<app>                         # editorial-ui | public-web | mobile
npx prettier . --check
npm run lint
npx tsc -b                            # editorial-ui
npx tsc --noEmit                      # mobile
npm run build                         # editorial-ui, public-web (next build type-checks)
```

## CI

Three workflows: `ci-java.yml`, `ci-python.yml`, `ci-frontend.yml`. They run the
same checks as above.

Path filters are applied on `push` only. On pull requests every workflow runs
unconditionally, so that every check always reports a status.

This is deliberate. `main` is protected and all jobs are required checks, and a
workflow skipped by a `paths` filter never reports its check at all — the pull
request then waits forever on a status that will never arrive. **Do not add
`paths` to a `pull_request` trigger.** If a job ever needs to be conditional,
gate it with a job-level `if:` instead: a job skipped by a conditional reports
as successful and satisfies the required check.

Running everything on every pull request is cheap here: the repository is
public, and standard GitHub-hosted runners are free for public repositories.
Filtering per job (a `dorny/paths-filter` job feeding `if:` conditions) is worth
revisiting only once a job gets slow enough that waiting on it hurts.
