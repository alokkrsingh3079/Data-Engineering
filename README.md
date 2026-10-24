# Data Engineering Practice Platform

A web learning and interview-practice platform for data engineers. It combines a PostgreSQL SQL lab, Python and PySpark coding labs, guided learning tracks, dataset-grounded question generation, interview practice, AI study tools, notes, and progress tracking.

> **Deployment status:** The application is deployed on Cloudflare Workers and Render. On 2026-10-24, the production API health endpoint returned HTTP 200 with MongoDB and PostgreSQL healthy; the Python and PySpark runner status endpoint reported both runners available. These checks describe the time of verification, not an uptime guarantee. The latest GitHub deployment workflow succeeded, but the latest backend CI workflow failed in `npm test`; see [the QA report](docs/FINAL_QA_REPORT.md). Do not interpret deployment as a production-readiness certification.

## Product capabilities

| Area | What it does |
|---|---|
| SQL Lab | Create and inspect PostgreSQL practice workspaces, execute bounded read-only queries, work through SQL questions, and use snapshots and schema tools. |
| Learning Studio | Browse lessons and question banks, filter by track/topic/difficulty, track progress, bookmark and mark questions for revision. |
| Python and PySpark Labs | Practice coding tasks in dedicated labs. Code runs through separate isolated runner services when they are configured and available. Spark uses local mode on a dedicated worker; it is not a distributed cluster. |
| Dataset question generation | Upload CSV, JSON, JSONL, Parquet, or supported PostgreSQL SQL scripts; inspect tables and generate SQL, Python, or PySpark challenges grounded in the selected dataset. Generated coding questions are validated by their isolated runner before being saved. |
| Interview practice | Start timed learning interviews, save answers, and receive optional AI rubric feedback. AI feedback is coaching, not an authoritative assessment. |
| AI and study tools | Ask the assistant, generate study notes and reminders, and organize notes and uploaded PDFs. Availability depends on server-side AI configuration. |
| Progress and administration | Review learning activity and analytics; administrators can manage users, access, questions, and platform settings. |

Dataset uploads are limited to 5 MB, up to 10,000 rows, 80 columns, and 20 tables. Python/PySpark question generation supports 1–10 requested questions per run. AI receives the selected schema and a sample of records, so **do not upload personal, confidential, or otherwise sensitive data**.

## Architecture

```text
Browser
  └── Cloudflare Worker: React/Vite assets and /api proxy
        └── Render Node.js/Express API
              ├── MongoDB: platform, learning, and user records
              ├── PostgreSQL: SQL workspaces and SQL execution
              ├── Python runner: isolated Python jobs
              ├── Spark runner: isolated PySpark jobs
              └── OpenAI API: optional AI features
```

The API does not execute learner Python or Spark code in its own process. Runner services execute submissions in bounded, disposable containers. The Spark controller needs Docker access and must run on a Docker-compatible host, not on Cloudflare Workers or the ordinary Render API service. Runner availability is independent of API availability.

## Production

- Frontend: [dataengineering.kumaralok265265.workers.dev](https://dataengineering.kumaralok265265.workers.dev)
- API: [data-engineering-api.onrender.com](https://data-engineering-api.onrender.com)
- API health: [`/api/health`](https://data-engineering-api.onrender.com/api/health)
- Runner status: [`/api/learning/runners/status`](https://data-engineering-api.onrender.com/api/learning/runners/status)

GitHub Actions deploys the Worker from `main`; Render auto-deploys the API from `main`. See [deployment](DEPLOYMENT.md), [environment variables](docs/ENVIRONMENT_VARIABLES.md), and [runner operations](docs/SELF_HOSTED_RUNNERS.md).

## Run locally

See the [local development guide](docs/LOCAL_DEVELOPMENT.md) for prerequisites, environment setup, Docker services, and startup instructions. In brief:

```bash
npm ci --prefix backend
npm ci --prefix frontend
docker compose up -d --build mongodb postgres python_runner spark_runner
```

Then start the backend and frontend in separate terminals using the commands in the local guide.

## Checks

```bash
npm run check --prefix backend
npm run build --prefix backend
npm test --prefix backend
npm run build --prefix frontend
```

Optional database integration tests require disposable databases and their documented environment variables. Some sandbox tests skip when the host does not support Linux namespaces. The current CI status and validation limits are recorded in the [QA report](docs/FINAL_QA_REPORT.md).

## Repository map

```text
backend/                 Express API, persistence, validation, runner adapters
frontend/                React/Vite application and labs
worker/                  Python and Spark runner controllers and job images
deploy/runners/          Runner reverse-proxy configuration
docs/                    Setup, deployment, QA, audit, and roadmap
examples/                Example learning/practice data
archive/                 Historical files; not current setup instructions
```

## Documentation

- [Deployment and production operations](DEPLOYMENT.md)
- [Local development](docs/LOCAL_DEVELOPMENT.md)
- [Environment variables](docs/ENVIRONMENT_VARIABLES.md)
- [Python and Spark runners](docs/SELF_HOSTED_RUNNERS.md)
- [Current QA report](docs/FINAL_QA_REPORT.md)
- [Architecture and project audit](docs/PROJECT_AUDIT.md)
- [Prioritized product roadmap](docs/IMPLEMENTATION_ROADMAP.md)

## Privacy and security

Never commit populated environment files or expose backend credentials in frontend code. Keep database and AI credentials in the backend host's secret manager, and keep runner tokens only on the backend and runner hosts. Uploaded dataset contents and AI prompts can leave the browser and be sent to configured backend/AI services; only upload data you are authorized to use. Review the deployment and runner guides before exposing a runner endpoint.
