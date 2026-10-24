# Environment Variables

Configure values in the service that uses them. Keep secrets in a host secret manager or GitHub Actions secrets; never commit populated `.env` files or put server-only values in frontend/Worker variables.

## Backend

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV` | Production | Set to `production` to enable production auth/cookie behavior. |
| `PORT` | No | HTTP listen port; defaults to `4000`. The host may inject this value. |
| `MONGODB_URI` | Yes in production | MongoDB connection URI for platform records. Local development defaults to loopback MongoDB if unset. |
| `MONGODB_DATABASE` | No | MongoDB database name; defaults to `sql_software`. |
| `DATABASE_URL` | Yes | PostgreSQL database used by startup compatibility migrations/provisioning and SQL practice. Its identity needs the privileges used for schema and practice-role setup. |
| `PRACTICE_DATABASE_URL` | No | Optional practice connection override; defaults to `DATABASE_URL`. It must target the same PostgreSQL database because roles are provisioned using `DATABASE_URL`. |
| `AUTH_SECRET` | Yes | Session signing key. Production configuration must be at least 32 characters and should be randomly generated. |
| `PRACTICE_ROLE_SECRET` | Recommended in production | Stable, separate HMAC key for deterministic per-workspace PostgreSQL credentials. If omitted, the app falls back to `AUTH_SECRET`. Preserve it during rotation to avoid breaking existing practice roles. |
| `ADMIN_EMAIL` | No | Email for first administrator bootstrap; defaults to `admin@sqlpractice.local`. |
| `ADMIN_PASSWORD` | Initial bootstrap | Required only when creating the initial administrator. Use a unique strong password. Changing it does not reset an existing account. |
| `ADMIN_NAME` | No | Initial administrator display name. |
| `OPENAI_API_KEY` | Optional | Enables AI question generation, tutoring, interview feedback, note generation, and schema-image assistance. |
| `OPENAI_MODEL` | No | OpenAI model name; defaults to `gpt-4o-mini`. |
| `ALLOWED_ORIGIN` | Production | Allowed browser origin for credentialed API requests, normally the Cloudflare Worker origin. |
| `PYTHON_RUNNER_URL` | Required for Python execution | HTTPS origin of the trusted Python runner in production. |
| `PYTHON_RUNNER_TOKEN` | Required with runner URL | Backend-to-runner bearer token. Configure the matching value on the runner host. |
| `SPARK_RUNNER_URL` | Required for PySpark execution | HTTPS origin of the trusted Spark runner in production. |
| `SPARK_RUNNER_TOKEN` | Required with runner URL | Backend-to-runner bearer token. Configure the matching value on the runner host. |
| `SPARK_RUNNER_ALLOW_PRIVATE_HTTP` | Private Compose only | Enables HTTP only for the documented internal `spark_runner` service. Do not use for public endpoints. |
| `RATE_LIMIT_PER_MINUTE` | No | Default per-IP/path rate limit; defaults to `180`, with stricter limits for expensive routes. |
| `SESSION_DAYS` | No | Session lifetime in days; defaults to `7`. |
| `DB_POOL_SIZE` | No | PostgreSQL API pool size; defaults to `10`. |

`PRACTICE_DATABASE_PASSWORD` is used by the local Compose PostgreSQL initialization for the legacy `practice_executor` role. The current workspace practice roles are provisioned separately.

## Python and Spark runner host

| Variable | Service | Purpose |
|---|---|---|
| `PYTHON_RUNNER_TOKEN` | Python controller | Bearer credential accepted by the Python runner. Must match the backend value. |
| `PYTHON_JOB_IMAGE` | Python controller | Optional Python execution image override. |
| `SPARK_RUNNER_TOKEN` | Spark controller | Bearer credential accepted by the Spark runner. Must match the backend value. |
| `SPARK_JOB_IMAGE` | Spark controller | Optional pinned Spark job image override. |
| `DOCKER_GID` | Runner Compose | Numeric group ID owning `/var/run/docker.sock`, for controller access. |
| `PYTHON_RUNNER_DOMAIN` | Runner Compose/Caddy | HTTPS hostname routed to the Python controller. |
| `SPARK_RUNNER_DOMAIN` | Runner Compose/Caddy | HTTPS hostname routed to the Spark controller. |

Runner tokens are server-to-server credentials. Do not include them in browser requests, frontend build variables, or public issue reports.

## Cloudflare and GitHub Actions

| Variable/secret | Location | Purpose |
|---|---|---|
| `API_ORIGIN` | Cloudflare Worker variable | HTTPS origin of the Express API; configured in `wrangler.jsonc` for this deployment. |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions secret | Scoped Cloudflare token used by Wrangler to deploy the Worker. |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions secret | Cloudflare account targeted by the deploy workflow. |

The frontend workflow skips the deployment step if either Cloudflare secret is missing. Confirm an actual Worker publish in logs after each deployment.

## Local configuration

Start from `backend/.env.example`, replace placeholders with local-only values, and keep the resulting `backend/.env` untracked. Use `docker-compose.yml` defaults only for local development; do not reuse sample passwords or tokens in production.
