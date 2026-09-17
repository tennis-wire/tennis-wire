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
docker compose up -d postgres keycloak mailpit   # java services only
docker compose up -d redis minio minio-init      # transcription only
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
| Mailpit (SMTP) | `axllent/mailpit` pinned | 1025 | — |
| Mailpit (web UI) | — | 8025 | — |

These credentials are local development defaults and are intentionally in the
repository. They must never be reused anywhere else.

### Which traffic goes through the gateway

Client traffic only. A browser, the mobile app and `editorial-ui` know one
backend host, the gateway; the service ports are not published outside the
cluster, and CORS is configured on the gateway alone.

Service-to-service traffic deliberately does not. `discussion-service` calls
user-service directly over cluster DNS, because `/internal/**` is not routed
through the gateway and must not be — those endpoints answer to a service
token, not to a person's.

Either way the service checks the token itself: issuer, audience and roles are
verified again behind the gateway, so reaching a service port directly buys
nothing. That is also why a direct `curl` to a service port is a legitimate way
to localise a failure while developing — if a call fails through the gateway on
8090 and succeeds against the service port, the gateway's rules are what to
look at. Prefer the gateway for anything you mean as a check: it is the only
path that exercises both sets of rules.

### Databases

One PostgreSQL instance, one database and one owning role per service. They are
created by `docker/postgres/init/01-create-databases.sh`, which runs **only when
the data volume is empty**. Services connect under their own role, never as the
superuser.

| Service | Database | Role | Password |
|---|---|---|---|
| content-service | `tennis_content` | `content` | `content` |
| discussion-service | `tennis_discussion` | `discussion` | `discussion` |
| user-service | `tennis_users` | `users` | `users` |

To add a service, append a `create_service_db` line to the init script, then
either recreate the volume:

```bash
docker compose down -v && docker compose up -d   # wipes all local data
```

or apply the same change to the running instance:

```bash
docker compose exec postgres psql -U postgres \
  -c "CREATE ROLE <role> WITH LOGIN PASSWORD '<password>'" \
  -c "CREATE DATABASE <db> OWNER <role>"
```

Two separate `-c` flags, not one with both statements: psql wraps a single
command string in an implicit transaction, and `CREATE DATABASE` cannot run
inside one. The init script above gets away with a heredoc because statements
read from stdin are each sent on their own, in autocommit.

The PostgreSQL major version is pinned in two places that must move together:
the root `docker-compose.yml` and `TestcontainersConfiguration` in each Java
service (content-service, discussion-service).

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
| `moderator` | `moderator` / `moderator` | `moderator`, `user` |
| `moderation-bot` | client secret `dev-moderation-bot-secret` | `moderator-bot` |
| `user-service` | client secret `dev-user-service-secret` | `service`, plus `realm-management`: `manage-users`, `view-realm` |
| `discussion-service` | client secret `dev-discussion-service-secret` | `service` |

`moderator` exists because `dev` is not a moderator in the shape production
has: `admin` is composite and hands it `author` and `user` as well, so a check
a real moderator would fail passes on `dev`. Moderation records who acted, and
that identity is a reader profile in `user-service` — hence `user` spelled out
on the fixture instead of assumed, per the rule under Readers below.

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

#### Readers

The realm allows self-registration. The username **is** the email address:
there is no separate username field, because the public display name lives in
`user-service`, not here. A new account must confirm its address before it can
log in, and lands in the default group `readers`, which carries the `user` role.

Default groups apply to accounts created outside the realm file — by
registration, identity brokering, the admin console or the admin API — and not
to accounts declared in it. A staff account created by an admin therefore lands
in `readers` and picks up `user` as well, which is intended: someone on the team
who comments on an article is a reader like anyone else.

The other half of that rule is easy to trip over. An account declared in the
realm file gets exactly the roles listed for it and nothing besides — Keycloak
skips both default roles and default groups on import. That is what keeps the
service accounts above free of `user`, and it is also why `reader` carries
`offline_access` explicitly: the client scope of that name is gated on the realm
role of the same name, and a user without the role does not get an error. The
scope is dropped from the request and an ordinary refresh token comes back in
place of an offline one. Whatever a fixture is meant to exercise has to be
spelled out on the fixture.

`editorial-ui` carries one more mapper of its own: realm roles into the **id**
token. The built-in `roles` scope puts them in the access token, which is
addressed to the services — a browser app reading it would be opening a token
written for someone else. The id token is the one issued to the client, so that
is where a screen decides whether to offer a moderator-only page. Composites are
expanded on the way in, so `dev` arrives carrying `moderator`. Hiding a page is
a convenience and never a control: the gateway and the service each check the
role again, and neither trusts that the browser did.

To register locally, open <http://localhost:8180/realms/tennis-wire/account>,
follow the sign-in link and choose Register. Keycloak sends the confirmation
mail to Mailpit; read it at <http://localhost:8025> and follow the link.

Mailpit accepts everything and delivers nothing. It has no volume, so the
mailbox is empty again after `down -v` — as is the realm itself.

#### Google

The Google button is a realm-level identity provider, so it shows up on the
login page of every client that uses this realm — `public-web`, `mobile` and
`editorial-ui` alike. `trustEmail` is on: an address that arrives from Google
counts as confirmed and the reader skips the verification mail. `syncMode` is
`IMPORT`, so a profile is copied on first login and never overwritten
afterwards; the name shown on the site lives in `user-service` anyway.

Everything else is left at the Keycloak default, the first broker login flow
included. When a Google address matches an account that already registered with
a password, the reader is asked to confirm the link — not signed straight in.
The identity provider names no flow of its own, which in Keycloak 26 means it
falls back to the realm's, and the realm's is the built-in `first broker login`.

The client secret is **not** in the realm file. This repository is public, and
Google scans public repositories for its own credentials and revokes what it
finds. The file carries placeholders:

```json
"config": {
"clientId": "${GOOGLE_CLIENT_ID}",
"clientSecret": "${GOOGLE_CLIENT_SECRET}"
}
```

Two substitutions with the same syntax happen in a row, and it is worth knowing
which one failed. Compose resolves `${GOOGLE_CLIENT_ID}` in `docker-compose.yml`
from `.env` and puts the result in the container's environment. Keycloak then
resolves `${GOOGLE_CLIENT_ID}` in the realm file against that environment, while
reading the file — but only when `keycloak.migration.replace-placeholders` is
set. `kc.sh import` sets it on its own; `start --import-realm` does not, which
is why the compose service passes it as a JVM option:

```yaml
JAVA_OPTS_APPEND: "-Dkeycloak.migration.replace-placeholders=true"
```

Drop that option and nothing breaks loudly: an unresolved placeholder is left in
place as a literal string, the realm imports clean, and the first Google login
fails with `invalid_client` from Google. The canary is the client id, which the
admin API returns in the clear while it masks the secret:

```bash
TOKEN=$(curl -s -d grant_type=password -d client_id=admin-cli \
  -d username=admin -d password=admin \
  http://localhost:8180/realms/master/protocol/openid-connect/token | jq -r .access_token)

curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8180/admin/realms/tennis-wire/identity-provider/instances/google \
  | jq -r .config.clientId
```

A real id means both substitutions worked. `not-set` means `.env` is missing or
empty. A literal `${GOOGLE_CLIENT_ID}` means the JVM option did not arrive.

Google side: create an OAuth client of type *Web application* and give it one
authorized redirect URI, `http://localhost:8180/realms/tennis-wire/broker/google/endpoint`.
The path is fixed by Keycloak — `/realms/{realm}/broker/{alias}/endpoint`, alias
`google` — and Google matches it exactly, so the port has to be the one the
browser uses. Plain HTTP is accepted for `localhost` and nothing else; a
deployed realm needs its own Google project, its own client and an https URI.

#### Session lengths

Staff and readers get different session lengths out of the same realm. The SSO
session is short for everyone: 30 minutes idle, 8 hours absolute. `public-web`
and `mobile` request the `offline_access` scope, which yields a refresh token
detached from the SSO session and good for 30 days of inactivity. Since Keycloak
26.1 such a login leaves no SSO session of its own, only the offline one: nothing
signs a reader of the site in silently, and `/api/auth/login` shows the login
page again unless another client's SSO session is alive in the same browser.
Every other client, `editorial-ui` included, has `offline_access` removed from
its optional scopes and cannot ask for one:

```bash
curl -s -d grant_type=password -d client_id=dev-cli -d scope=offline_access \
  -d username=reader -d password=reader \
  http://localhost:8180/realms/tennis-wire/protocol/openid-connect/token
# {"error":"invalid_scope","error_description":"Invalid scopes: offline_access"}
```

This is per-client scope assignment, not the realm-level `clientScopes` array
described above, which defines the scopes themselves and must be left alone. The
trap here is the same shape one level down: naming either list on a client makes
that client manage **both**. The moment `optionalClientScopes` appears, the
inherited defaults are dropped as well, `roles` goes with them, and tokens come
back without `realm_access.roles` — valid, correctly audienced, and authorised
for nothing. So both lists are written out in full on every client and both
match what Keycloak assigns by default, apart from the one scope actually in
question.

Keycloak's own clients (`account`, `admin-cli`, `security-admin-console` and the
rest) are not described in the realm file and keep `offline_access`. None of
them carries the `tennis-wire-api` audience mapper, so our services reject their
tokens anyway.

Login events are kept for 30 days: admin console → Events → User events. Worth
checking first when a registration mail does not arrive or a login fails for no
visible reason.

The gateway validates tokens against this realm, so it needs Keycloak running
before it can serve anything that is not anonymous. It does start without it —
the issuer is resolved lazily — and only fails when a request carries a token.

To read the gateway's own routing table, run it under the `local` profile and
present an admin token:

```bash
./gradlew :api-gateway:bootRun --args='--spring.profiles.active=local'
curl -s -H "Authorization: Bearer $TOKEN" localhost:8090/actuator/gateway
```

`/actuator/health` stays anonymous for the probes but only shows components to
a token with the admin role.

Production is a separate problem, deliberately unsolved: `--import-realm` only
creates a realm that does not exist yet and never updates one, so it is not a
configuration-management mechanism. What must not drift between local and
production are the role, client and scope names, and those are fixed in
`architecture/auth.md`, not here. The reverse holds too: the SMTP host and
every client secret in the file are local values that a deployed realm has to
override.

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
| discussion-service | 8093 | requires PostgreSQL |
| user-service | 8092 | requires PostgreSQL |
| transcription-service | 8001 | requires Redis + MinIO |
| editorial-ui (Vite) | 5173 | |
| public-web (Next.js) | 3000 | |
| mobile (Expo dev server) | 8081 | |

### Java services

```bash
./gradlew :content-service:bootRun
./gradlew :discussion-service:bootRun
./gradlew :user-service:bootRun
./gradlew :editorial-bff:bootRun
./gradlew :api-gateway:bootRun
```

Datasource settings are overridable via `DB_HOST`, `DB_PORT`, `DB_NAME`,
`DB_USERNAME` and `DB_PASSWORD`.

api-gateway keeps its rate-limit buckets in Redis, over `REDIS_HOST`
(`localhost`) and `REDIS_PORT` (`6379`). Without Redis the limiter fails open —
a request it cannot count goes through — so the gateway keeps serving and only
the counting is gone. Its Redis health indicator is switched off for that
reason: reporting DOWN would take the gateway out of rotation over a degraded
guardrail. The numbers themselves live under `gateway.rate-limit` and are tuned
by configuration rather than a rebuild.

`gateway.rate-limit.trusted-proxies` is how many proxies append to
`X-Forwarded-For` in front of the gateway; the address is counted that far from
the right, because the nearest proxy writes last and everything to its left
arrived in the request. One is right for ingress alone. **Put a CDN in front and
this has to go up**, or the last entry becomes the CDN's own address and every
anonymous reader shares one bucket. With no forwarded chain at all the peer of
the connection answers, which is what makes the address bucket work locally.

`REPORT_HASH_KEY` is the key a reporter's identity is hashed under before it is
stored, so that a repeat complaint can be recognised without keeping who
complained. It has a development default and must be overridden anywhere else:
author ids travel with every comment, so an unkeyed hash of the same pair could
be recomputed for each known reader until one matched. Failure is silent —
reports keep working, and only the anonymity is gone. Rotating the key resets
deduplication (everyone may report once more) and costs no data.

discussion-service calls user-service directly, over `USER_SERVICE_URL`
(`http://localhost:8092` by default) and never through the gateway. Without it
running, an authenticated read, any write and `scripts/smoke.sh` answer 503:
comments carry the reader's platform id and their author's display name, and
both of those live in user-service. Anonymous reads are unaffected.

user-service calls two things of its own, both as itself rather than on behalf
of whoever is on the line. Keycloak's admin API over `KEYCLOAK_BASE_URL`
(`http://localhost:8180`) and `KEYCLOAK_REALM` (`tennis-wire`), authenticating
with `USER_SERVICE_CLIENT_SECRET` — the server root and not the issuer, because
the admin API sits above the realm. And discussion-service over
`DISCUSSION_SERVICE_URL` (`http://localhost:8093`), on its own port and never
through the gateway, to take away what a reader who has left wrote.

Deleting an account finishes out of band: a job passes once a minute over the
accounts on their way out, closing the identity, waiting until a token issued
before that could no longer be good, erasing the trace, and deleting the profile
and the account. Without Keycloak it cannot learn how long a token stays good
and skips the pass rather than guess; without discussion-service the trace stays
and the account is not deleted. It comes back to both next minute, and the
request itself answers 202 either way — the deletion is written down and will
happen. `user.erasure.*` in `application.yaml` holds the intervals.

The request itself wants a recent login: `auth_time` in the token no older than
`user.deletion.login-max-age` (5 minutes), otherwise 401
`REAUTHENTICATION_REQUIRED` with an RFC 9470 `WWW-Authenticate` challenge. A token
without `auth_time` counts as an old login. The site sends the reader through
`/api/auth/login?prompt=login` right before the last button, so a `curl` against
this endpoint needs a token from a login that recent too.

### Transcription service

```bash
cd transcription-service
cp .env.example .env
uv sync
uv run python -m transcription.main                       # API
uv run arq transcription.worker.tasks.WorkerSettings      # worker
```

Set `WHISPER_DEVICE=cpu` in `.env` on machines without an NVIDIA GPU.

Like the Java services, it validates the token itself against Keycloak
(`KEYCLOAK_ISSUER_URI`), so start Keycloak first; `/api/health` is the only
path that works without it. A job is visible only to the author who started
it, and `GET /api/transcribe/jobs` lists the caller's own.

### Frontends

Each app under `apps/` has its own `package-lock.json` and is installed
separately — there is no workspace root.

```bash
cd apps/editorial-ui && npm ci && npm run dev     # :5173
cd apps/public-web   && npm ci && npm run dev     # :3000
cd apps/mobile       && npm ci && npm start       # Expo
```

`public-web` needs configuration of its own: copy `apps/public-web/.env.example`
to `.env.local` and fill in `SESSION_PASSWORD` with `openssl rand -base64 32`.
The rest of the file has working local defaults. Nothing there is secret except
that password, and `.env.local` is git-ignored anyway.

Signing in needs Keycloak; anything the reader does afterwards needs the gateway
and `user-service` behind it. Article pages read `content-service` through the
gateway, and the comments under them read `discussion-service`, which in turn
needs `user-service` for the names. So the useful local set is `postgres`,
`keycloak` and `redis` in compose plus `api-gateway`, `content-service`,
`user-service` and `discussion-service` from the IDE. Each failure stays where
it happens: with the gateway down the home page still renders and the header
falls back to a sign-in link, an article page answers with Next's error page,
and a comments block shows "не удалось загрузить" with a retry while the article
above it stays put.

The session lives in cookies the browser cannot read and the server never hands
out: `tw_session` holds the tokens, `tw_idt` the id_token for the logout hint,
and `tw_flow` exists only between `/api/auth/login` and the callback. Their
contents and the proxy that uses them are described in `architecture/auth.md`.

Formatting is shared: a single `.prettierrc` at the repository root applies to
all three apps, each of which keeps its own `.prettierignore`. ESLint config is
per app.

`apps/mobile/.npmrc` sets `legacy-peer-deps=true` and is committed on purpose,
so that CI resolves peers the same way a local install does. The reason is
documented in the file itself.

Expo dependencies are updated with `expo install --fix`, never with
`npm update`. Renovate is configured accordingly: mobile packages are grouped
into one PR and majors are disabled, because a major there means an SDK bump.

#### editorial-ui and Keycloak

Signing in needs the realm running: `docker compose up -d keycloak`. Everything
under `/editor` and `/curator` sits behind the login; `dev` / `dev` gets in.
`admin` / `admin` is the bootstrap admin of the `master` realm and cannot.

Tokens are held in memory, so every reload runs the authorization code flow
again. While the SSO cookie lives that is silent — expect a brief flash, not a
login form. Nothing of the session reaches `localStorage`; the only thing there
is the editor draft, keyed by the user's `sub`.

There are two Vite entry points: `index.html` and `popup-callback.html`. The
second is where Keycloak lands the re-authentication popup, and it is listed in
`build.rollupOptions.input` — the dev server serves any root-level HTML on its
own, but a build only emits what is listed. A third page means editing that
list.

Redirect URIs in the realm are exact paths rather than `http://localhost:5173/*`.
Adding a route Keycloak has to redirect to means editing the realm file and
recreating the container, as above. A rejected URI shows as `Invalid parameter:
redirect_uri` on a Keycloak page.

Tests run under `vitest`. The request-policy tests need no DOM and use the
default `node` environment; component tests opt into jsdom with a
`// @vitest-environment jsdom` comment on their first line, so there is no
global jsdom cost.

MUI 9 no longer accepts system props on `Stack`: `alignItems="center"` does not
compile and belongs in `sx`.

## Checks

```bash
./gradlew check                       # spotless, PMD, SpotBugs, tests
./gradlew :<module>:build             # the same for one module
./gradlew :<module>:test              # tests only — no PMD, no SpotBugs

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
