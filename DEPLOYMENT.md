# Deployment and Operations

## Current hosting layout

The production application uses three hosting boundaries:

1. **Cloudflare Worker** serves the Vite-built frontend and proxies `/api/*`.
2. **Render web service** runs the Node.js/Express API.
3. **MongoDB, PostgreSQL, and code runners** are separate services. MongoDB stores platform records; PostgreSQL remains the SQL practice engine. Python and PySpark code runs in separate container-based services.

Production origins:

- Frontend: `https://dataengineering.kumaralok265265.workers.dev`
- API: `https://data-engineering-api.onrender.com`

At the last documented check on 2026-10-24, the API health endpoint returned HTTP 200 and both Python and PySpark runners reported available. Check the live endpoints before troubleshooting; runner availability can change independently of the API.

## Automatic deployment

### API on Render

The `data-engineering-api` Render service is connected to `alokkrsingh3079/Data-Engineering`, branch `main`, with automatic deploy enabled. Its build command is `npm ci --include=dev --prefix backend && npm run build --prefix backend`; its start command is `npm start --prefix backend`; its health path is `/api/health`.

Push a reviewed change to `main` to start an API deployment. Verify the deployed commit and status in Render, then check `/api/health` and relevant feature endpoints. Never put secret values in `render.yaml` or source control.

### Frontend on Cloudflare

The [GitHub Actions workflow](.github/workflows/deploy-cloudflare.yml) builds the frontend and deploys the Worker on pushes to `main`. It requires the repository Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. If they are absent, the workflow intentionally skips the publish step. `API_ORIGIN` in [wrangler.jsonc](wrangler.jsonc) points to the API origin; keep the Worker proxy and Render `ALLOWED_ORIGIN` aligned.

After a change, verify the workflow actually published the Worker rather than merely completing its build step. Confirm the live page and its referenced asset hashes match the expected commit.

## Required backend services

The API requires MongoDB and PostgreSQL. Use TLS-enabled managed services with backups and restricted network access. PostgreSQL credentials must permit the schema and per-workspace role provisioning required by the app. `DATABASE_URL` and `PRACTICE_DATABASE_URL` must address the same PostgreSQL database unless the isolation design is deliberately changed and tested.

Set backend variables through Render's secret/environment configuration. See [environment variables](docs/ENVIRONMENT_VARIABLES.md) for purposes and required values. Do not copy a local `.env` into production wholesale.

## Python and Spark runners

The runners are independent from Render's API and Cloudflare. Their URLs and bearer tokens are configured on the backend; do not expose tokens to the frontend. For production, use a dedicated Docker-compatible host and the [self-hosted runner guide](docs/SELF_HOSTED_RUNNERS.md). Codespaces can be used for temporary testing, but stopping the Codespace makes its public runner endpoints unavailable.

The runner controller needs Docker socket access to create disposable jobs. Treat that host as privileged infrastructure. Do not expose ports 4020/4021 or the Docker socket publicly; publish HTTPS endpoints through the documented reverse proxy. Spark runs local mode on one machine, uses a bounded in-memory queue, and is not a multi-node production cluster. Do not horizontally scale it without a durable queue and coordination mechanism.

Verify runner configuration and health at:

```text
GET https://data-engineering-api.onrender.com/api/learning/runners/status
```

The public API health check does not prove that the AI provider or each runner is available; check those separately.

## Release verification checklist

- Confirm the expected commit is deployed to Render and Cloudflare.
- Check `/api/health` for MongoDB and PostgreSQL status.
- Check `/api/learning/runners/status` before testing Python/PySpark execution.
- Test login, dataset upload/preview, SQL execution, and relevant question-bank flows with a non-admin test account.
- Confirm no secrets or private dataset contents appear in browser assets or logs.
- Inspect GitHub CI; do not treat deployment workflow success as proof that all tests pass.
- Back up MongoDB and PostgreSQL before migrations or data-affecting operations.
- Document deployment failures and rollback actions; never delete production resources as a troubleshooting shortcut.

## Current known release caveat

The API and frontend are deployed, but the latest backend CI run checked during this documentation update failed at `npm test`; the preceding two recent runs also failed at that step. The TypeScript check and frontend build passed locally. The full local backend test command did not terminate within the review window and was stopped, so it is not reported as passing. See [the QA report](docs/FINAL_QA_REPORT.md). Resolve and verify the CI failure before claiming a fully green release.
