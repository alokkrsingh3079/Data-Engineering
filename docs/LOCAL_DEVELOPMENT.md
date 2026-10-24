# Local Development

This guide starts the React/Vite frontend, Express API, MongoDB, PostgreSQL, and optional isolated Python/Spark runners. The commands do not remove existing database volumes.

## Prerequisites

- Git
- Node.js 20+ and npm
- Docker Engine and Docker Compose plugin, with a working Docker daemon
- Linux namespace/bubblewrap support for local Python sandbox tests
- At least 4 GB available memory for local Spark work; more is recommended

## 1. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Replace the placeholder `AUTH_SECRET` and `PRACTICE_ROLE_SECRET` with fresh local-only random values. Set the local database URLs and runner URLs/tokens to match `docker-compose.yml`; do not use production credentials. `OPENAI_API_KEY` is optional for non-AI workflows.

`backend/.env` is ignored by Git. Never commit or share a populated environment file.

## 2. Install dependencies

From the repository root:

```bash
npm ci --prefix backend
npm ci --prefix frontend
```

## 3. Start local services

On Linux, identify the Docker socket group and start the services:

```bash
export DOCKER_GID="$(stat -c '%g' /var/run/docker.sock)"
docker compose up -d --build mongodb postgres python_runner spark_runner
docker compose ps
```

Wait until MongoDB, PostgreSQL, and the runners are healthy. Optional checks:

```bash
docker compose exec -T mongodb mongosh --quiet --eval 'db.adminCommand({ping:1}).ok'
docker compose exec -T postgres pg_isready -U postgres -d sql_practice
curl -fsS http://127.0.0.1:4020/health
curl -fsS http://127.0.0.1:4021/health
```

MongoDB and runner ports bind to loopback. Do not expose them to an untrusted network.

## 4. Start backend and frontend

Use separate terminals from the repository root.

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

Open <http://localhost:5173>. The Vite server proxies `/api` to the local backend on port 4000. Confirm the backend is healthy:

```bash
curl -fsS http://127.0.0.1:4000/api/health
```

On a fresh local database, the initial administrator is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env`. Choose your own values; do not reuse example credentials in production. Existing administrator passwords are not reset by changing the environment variable.

## Tests and builds

```bash
npm run check --prefix backend
npm run build --prefix backend
npm test --prefix backend
npm run build --prefix frontend
```

Some tests are opt-in and need disposable test databases. Python sandbox tests can skip if the host disallows Linux namespaces. Check the test runner's final summary and exit code; partial test output is not proof that the suite completed. Current known CI status is in the [QA report](FINAL_QA_REPORT.md).

## Optional SQL bank generation

The SQL-level seeder calls the configured AI provider and may incur costs:

```bash
cd backend
npm run seed:sql-levels
```

Only run it against a local/test database after confirming its configured connection. The seeder validates generated SQL against the demo schema before insertion.

## Stop while preserving data

Stop backend/frontend terminals with `Ctrl+C`, then stop Compose services:

```bash
docker compose down
```

This preserves named database volumes. Do not add `-v` unless you explicitly intend to delete local MongoDB and PostgreSQL data.
