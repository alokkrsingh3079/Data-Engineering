# Environment Variables

Supply secrets through the deployment platform's secret store. Do not commit populated environment files or place backend values in the frontend or Cloudflare Worker configuration.

| Variable | Required | Service | Purpose |
|---|---|---|---|
| `MONGODB_URI` | Production | Backend | MongoDB connection URI for platform records. Development defaults to local MongoDB if unset. |
| `MONGODB_DATABASE` | No | Backend | MongoDB database name; defaults to `sql_software`. |
| `DATABASE_URL` | Current backend startup | Backend | Legacy/application PostgreSQL database used by startup migrations and account/workspace provisioning. This remains required by the current runtime despite the Mongo target. |
| `PRACTICE_DATABASE_URL` | Yes for SQL practice | Backend | PostgreSQL connection for the constrained SQL-practice executor. |
| `PRACTICE_ROLE_SECRET` | No | Backend | HMAC key used to derive deterministic credentials for per-workspace PostgreSQL roles. Defaults to `AUTH_SECRET`; use a separate stable secret in production and preserve it during rotations. |
| `PRACTICE_DATABASE_PASSWORD` | Local Compose initialization | PostgreSQL | Initializes the legacy `practice_executor` role. Current backend execution uses per-workspace roles and revokes this legacy role's workspace grants. |
| `AUTH_SECRET` | Yes | Backend | Secret used to sign session tokens; production values must be at least 32 characters. |
| `ADMIN_PASSWORD` | First administrator bootstrap | Backend | Initial administrator password. No default is supplied. |
| `ADMIN_EMAIL` | No | Backend | Initial administrator email; defaults to `admin@sqlpractice.local`. |
| `ADMIN_NAME` | No | Backend | Initial administrator display name. |
| `OPENAI_API_KEY` | No | Backend | Enables AI question generation, tutoring, and schema-image assistance. |
| `OPENAI_MODEL` | No | Backend | AI model name; defaults to `gpt-4o-mini`. |
| `PYTHON_RUNNER_URL` | No | Backend | Trusted isolated Python runner origin. Must be HTTPS in production and expose authenticated `/health` and `/v1/execute` routes. Without it, Python execution reports unavailable. |
| `PYTHON_RUNNER_TOKEN` | No | Backend | Server-only bearer token for the Python runner; store in the backend secret manager. |
| `SPARK_RUNNER_URL` | No | Backend | Trusted isolated Spark runner origin. Must be HTTPS in production and expose authenticated `/health` and `/v1/execute` routes. Without it, PySpark execution reports unavailable. |
| `SPARK_RUNNER_TOKEN` | No | Backend | Server-only bearer token for the Spark runner; store in the backend secret manager. |
| `PORT` | No | Backend | Express listen port; defaults to `4000`. |
| `ALLOWED_ORIGIN` | Production | Backend | Allowed browser origin for credentialed API requests. |
| `RATE_LIMIT_PER_MINUTE` | No | Backend | Per-IP/path in-memory request limit; defaults to `180`. |
| `SESSION_DAYS` | No | Backend | Session lifetime in days; defaults to `7`. |
| `DB_POOL_SIZE` | No | Backend | Maximum PostgreSQL pool connections; defaults to `10`. |
| `API_ORIGIN` | Local Worker / secret | Cloudflare Worker | HTTPS origin of the deployed Express API, used by the Worker proxy. |
| `NODE_ENV` | Deployment | Backend | Set to `production` in production to enforce production auth validation and secure cookies. |

`DATABASE_URL` is not merely a SQL-practice database setting yet: current migrations and provisioning still query application tables there. MongoDB-only platform storage and removal of this dependency are not complete. The Python and Spark runner adapters are implemented, but no real runner service is configured or verified in this environment.

The runner contract is: `GET /health` with bearer auth; `POST /v1/execute` with `{ taskId, language, code, testCases }`; and a bounded JSON response `{ status, executionMs, tests: [{ name, passed }] }`. Redirects are rejected so bearer tokens are not forwarded. The separate service must independently enforce CPU, memory, process, output, filesystem, network, and wall-clock limits. An endpoint URL alone is not proof of isolation; do not advertise execution until the deployed runner is reviewed and tested.