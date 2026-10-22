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
| `SPARK_RUNNER_URL` | No | Backend | Trusted isolated Spark runner origin. HTTPS in production; development may use `http://127.0.0.1:4021`. Exposes authenticated `/v1/jobs`, `/v1/jobs/:id`, and `/v1/execute` routes. Without it, PySpark execution reports unavailable. |
| `SPARK_RUNNER_TOKEN` | Yes for production Compose | Spark worker and backend | Shared backend-to-worker bearer token. Generate a long random value and store it in both services' secret configuration; never expose it to the browser. |
| `SPARK_RUNNER_ALLOW_PRIVATE_HTTP` | Production Compose only | Backend | Compose sets `true` only for `http://spark_runner:4021` on the dedicated internal network. All other production runner URLs must use HTTPS. |
| `DOCKER_GID` | Yes for production Compose | Spark worker | Numeric group ID owning `/var/run/docker.sock` on the dedicated Spark host; allows the non-root controller to create restricted job containers. |
| `PORT` | No | Backend | Express listen port; defaults to `4000`. |
| `ALLOWED_ORIGIN` | Production | Backend | Allowed browser origin for credentialed API requests. |
| `RATE_LIMIT_PER_MINUTE` | No | Backend | Per-IP/path in-memory request limit; defaults to `180`. |
| `SESSION_DAYS` | No | Backend | Session lifetime in days; defaults to `7`. |
| `DB_POOL_SIZE` | No | Backend | Maximum PostgreSQL pool connections; defaults to `10`. |
| `API_ORIGIN` | Local Worker / secret | Cloudflare Worker | HTTPS origin of the deployed Express API, used by the Worker proxy. |
| `NODE_ENV` | Deployment | Backend | Set to `production` in production to enforce production auth validation and secure cookies. |

`DATABASE_URL` is not merely a SQL-practice database setting yet: current migrations and provisioning still query application tables there. MongoDB-only platform storage and removal of this dependency are not complete. The Python runner adapter exists; Python execution remains unavailable without a separate configured service. The Spark worker image and queue are implemented and locally verified, but production deployment to a dedicated Docker host is not yet verified.

Spark uses `POST /v1/jobs`, `GET /v1/jobs/:id`, and `DELETE /v1/jobs/:id`, plus `/health`. Public-example results include structured DataFrame output; hidden submission tests return anonymized summaries only. Redirects are rejected so bearer tokens are not forwarded. The Spark image pins Python 3.11.11, PySpark 3.5.6, and Java 17. It runs Spark in `local[2]`; each submission gets one disposable Docker container and one SparkContext, while test cases run with fresh Python globals and Spark SQL sessions. Containers use `network_mode=none`, a read-only root, non-root UID 10001, dropped capabilities, `no-new-privileges`, 2 GiB memory, 1 CPU, 128 PIDs, a 256 MiB temporary filesystem, 45-second wall timeout per submission, 500-row cap per case, and 256 KB output cap. JVM processor and GC thread counts are restricted explicitly. The trusted controller uses the host Docker socket and therefore must run on a dedicated Spark host/VM; learner containers never receive the socket, credentials, or network access. The controller permits two running jobs and eight queued jobs. These are single-machine local Spark limits, not a multi-node cluster. The Spark worker must run separately from Cloudflare Workers and is reachable only on the private Compose network in production.

For local development, run `docker compose up --build spark_runner`. A host-run backend should use `SPARK_RUNNER_URL=http://127.0.0.1:4021`, `SPARK_RUNNER_TOKEN=local-development-only-token`, and `NODE_ENV=development`. For production Compose, set a long random `SPARK_RUNNER_TOKEN` and `DOCKER_GID` to the Docker socket's numeric group on a dedicated Spark VM, then run `docker compose -f docker-compose.prod.yml up --build`. The private service uses HTTP only on the Compose internal network with `SPARK_RUNNER_ALLOW_PRIVATE_HTTP=true`; every external production runner endpoint remains HTTPS-only. The queue is in-memory and single-controller; do not add replicas without a durable queue and job ownership store. Cloudflare Workers/serverless hosts cannot host the Spark worker.