# Run Locally

This guide starts the React/Vite frontend, Express API, MongoDB, PostgreSQL, and isolated Python/Spark runners from a clean Linux checkout. It does not reset or delete existing database volumes.

## Prerequisites

- Git
- Node.js 20 or newer and npm
- Docker Engine with the Compose plugin, or Docker Desktop with a working Docker socket
- `openssl` for generating local application secrets
- At least 4 GB of available memory for the Spark runner and isolated Spark jobs

The Python and Spark runners create disposable, network-isolated Docker containers. A working Docker daemon/socket is required for their execution features.

## 1. Get the project

If you have not cloned the repository yet:

```bash
git clone https://github.com/sameep20252026/Data-Engineering.git
cd Data-Engineering
```

Otherwise, open a terminal at the repository root.

## 2. Configure the backend

Create the ignored local environment file and generate local-only credentials:

```bash
cp backend/.env.example backend/.env
AUTH_SECRET="$(openssl rand -hex 32)"
PRACTICE_ROLE_SECRET="$(openssl rand -hex 32)"
sed -i \
  -e "s|replace-with-local-role-password|local-only-practice-password|" \
  -e "s|replace-with-a-stable-random-secret|${PRACTICE_ROLE_SECRET}|" \
  -e "s|replace-with-at-least-32-random-characters|${AUTH_SECRET}|" \
  -e 's|replace-with-a-unique-password|LocalDevAdmin!42|' \
  -e 's|^DATABASE_URL=.*|DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/sql_practice|' \
  -e 's|^PRACTICE_DATABASE_URL=.*|PRACTICE_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/sql_practice|' \
  -e 's|^MONGODB_URI=.*|MONGODB_URI=mongodb://127.0.0.1:27017|' \
  -e 's|^PYTHON_RUNNER_URL=.*|PYTHON_RUNNER_URL=http://127.0.0.1:4020|' \
  -e 's|^PYTHON_RUNNER_TOKEN=.*|PYTHON_RUNNER_TOKEN=local-development-python-token|' \
  -e 's|^SPARK_RUNNER_URL=.*|SPARK_RUNNER_URL=http://127.0.0.1:4021|' \
  -e 's|^SPARK_RUNNER_TOKEN=.*|SPARK_RUNNER_TOKEN=local-development-only-token|' \
  backend/.env
unset AUTH_SECRET PRACTICE_ROLE_SECRET
```

These values are for local development only. `backend/.env` is ignored by Git. Do not reuse the sample local admin password or runner tokens in production. `OPENAI_API_KEY` is optional for normal app startup, but AI features and SQL question generation require a valid key.

The local setup explicitly points both PostgreSQL URLs at the Compose `sql_practice` database and MongoDB at `127.0.0.1:27017`, even if an existing `backend/.env` contains cloud database URLs. The backend uses MongoDB for platform records and keeps PostgreSQL for SQL-practice schemas and query execution. The local runner tokens must match the Compose defaults (`local-development-python-token` and `local-development-only-token`); if you change either token in Compose, change the matching backend value too.

## 3. Install dependencies

Run from the repository root:

```bash
npm ci --prefix backend
npm ci --prefix frontend
```

## 4. Start databases and execution runners

On Linux, set Compose's Docker socket group to the group that owns the socket, then build and start the local services:

```bash
export DOCKER_GID="$(stat -c '%g' /var/run/docker.sock)"
docker compose up -d --build mongodb postgres python_runner spark_runner
docker compose ps
```

The first build downloads the Python and Spark base images and may take several minutes. Wait until MongoDB, PostgreSQL, `python_runner`, and `spark_runner` report healthy. The Spark controller creates a disposable Docker job container for each Spark execution.

Optional database checks:

```bash
docker compose exec -T mongodb mongosh --quiet --eval 'db.adminCommand({ping:1}).ok'
docker compose exec -T postgres pg_isready -U postgres -d sql_practice
curl -fsS http://127.0.0.1:4020/health
curl -fsS http://127.0.0.1:4021/health
```

MongoDB is exposed only on loopback. PostgreSQL is exposed on port `5432`; keep these local services off untrusted networks.

## 5. Start the backend and frontend

Keep each server running in its own terminal. Open both terminals from the repository root.

Terminal 1, backend:

```bash
cd backend
npm run dev
```

The backend loads `backend/.env`, connects to MongoDB and PostgreSQL, initializes/migrates local app data, seeds the learning curriculum and starter SQL questions, and then listens on port `4000`.

Terminal 2, frontend:

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

Open the app at <http://localhost:5173>. The Vite development server proxies `/api` requests to `http://localhost:4000`.

Verify the API after the backend prints its ready message:

```bash
curl -fsS http://127.0.0.1:4000/api/health
```

The response should report MongoDB and PostgreSQL as healthy.

## 6. Sign in

On a fresh local MongoDB volume, the backend creates the initial administrator during startup using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `backend/.env`:

- Email: `admin@sqlpractice.local`
- Password: `LocalDevAdmin!42`

Sign in through <http://localhost:5173/login>. A normal learner can register from that page. Existing MongoDB data is preserved: changing `ADMIN_PASSWORD` does not reset an already-created administrator's password.

## 7. Optional: generate the SQL A–R question bank

The regular startup seeds the curated starter SQL questions. To generate the additional 270 SQL questions (15 for each level A–R), first set a valid `OPENAI_API_KEY` in `backend/.env`, start the app once so the demo database is initialized, then run:

```bash
cd backend
npm run seed:sql-levels
```

This makes OpenAI API calls and may incur charges. The seeder validates reference queries against the demo PostgreSQL schema before inserting the full bank; if generation or validation is incomplete, it inserts nothing. SQL question records are migrated to MongoDB for the app's question API, while their practice schemas and data remain in PostgreSQL.

## Tests and builds

Run from the repository root:

```bash
npm run check --prefix backend
npm test --prefix backend
npm run build --prefix backend
npm run build --prefix frontend
```

Some database integration tests require their dedicated test database environment variables; isolated-runner tests may skip when the host does not support the required Linux namespace sandbox.

## Stop and preserve data

Stop the frontend and backend with `Ctrl+C` in their terminals. Stop the containers while preserving their named database volumes with:

```bash
docker compose down
```

Start them again with the Compose command in section 4. Do not add `-v` to `docker compose down` unless you explicitly intend to delete all local MongoDB and PostgreSQL data.
