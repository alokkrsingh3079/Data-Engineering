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

### Staged AWS Lambda migration

The AWS deployment is prepared as a separate path and does not change the live Worker origin. It provisions an API Gateway HTTP API, a Node.js Lambda API, an SQS queue and Lambda worker for long-running generation, plus a one-shot migration function. API Gateway supplies an HTTPS `execute-api` URL; no DuckDNS or custom domain is needed. MongoDB Atlas and the existing PostgreSQL database remain external and are not copied.

Before deploying:

1. Back up MongoDB and PostgreSQL. The deploy workflow invokes the app's existing initialization and migration routines against those databases.
2. In AWS Systems Manager Parameter Store, create **SecureString** parameters under `/data-engineering/prod/backend/`. Required values are `MONGODB_URI`, `DATABASE_URL`, and `AUTH_SECRET`. Set `PRACTICE_DATABASE_URL` and `PRACTICE_ROLE_SECRET` to the current production values when configured. Add `ALLOWED_ORIGIN` as `https://dataengineering.kumaralok265265.workers.dev`; add `GEMENI_API_KEY` (or `GEMINI_API_KEY`/`GOOGLE_API_KEY`), `ADMIN_PASSWORD`, and runner URLs/tokens only if those features need them. Never put these values in GitHub variables, workflow files, or chat.
3. This AWS account's Free Plan does not allow creating the IAM OIDC identity provider required by the preferred deployment method. AWS documentation says [activating advanced features requires upgrading to the Paid Plan](https://docs.aws.amazon.com/accounts/latest/reference/upgrade-account.html) and [removes spend limits](https://docs.aws.amazon.com/accounts/latest/reference/activate-advanced-features.html); do not activate it if you want to avoid that. Instead, create a dedicated IAM deploy user (not the root user), grant it only the SAM/CloudFormation deployment permissions needed for Lambda, API Gateway, SQS, IAM role passing, the SAM artifact bucket, invoking the migration function, and listing parameter names with `ssm:GetParametersByPath` (without decryption), then create an access key for that user.
4. In the GitHub repository, add `ACCESS_KEY` and `SECRET_ACCESS_KEY` under **Settings → Secrets and variables → Actions → Secrets**. Codespaces user secrets are not available to GitHub Actions. Optionally add the repository Actions variable `AWS_REGION` (defaults to `ap-south-1`). These are long-lived credentials and are less secure than OIDC: never print them or commit them, restrict the IAM user's permissions, and rotate or revoke the key when no longer needed.
5. Run **Deploy AWS Lambda API** manually from Actions. The workflow is manual-only and verifies both repository secrets are present before using them.
6. Confirm the workflow's database initialization and `/api/health` check succeed. The API URL is shown in the workflow summary. Test login, job polling, and uploads before changing `API_ORIGIN` in [wrangler.jsonc](wrangler.jsonc). The existing Worker remains on Render until that deliberate cutover.

The API and worker roles can read/decrypt only the configured SSM parameter path; generation jobs are handed to SQS so they continue after the API response. The job worker is bounded to two concurrent executions and the API to five. After three failed deliveries, the dead-letter worker marks a generation job failed so the learner can retry. Check CloudWatch logs and AWS billing/Free-plan credits after testing. AWS's introductory Free plan is temporary, not a permanent zero-cost hosting guarantee; API Gateway, Lambda, SQS, logs, storage, and data transfer can incur charges. Do not convert the account to a paid plan if that is not acceptable.

**Known compatibility limits:** API Gateway HTTP API has a 30-second integration limit and buffers the existing NDJSON note-assist response, so that endpoint no longer displays incremental chunks and may time out on long generations. Lambda's synchronous request payload limit can also reject requests near the app's current 5 MB upload limit because API Gateway encodes binary bodies. Test representative uploads; if the full limit is required, implement a direct-to-S3 upload path before cutover. Do not widen MongoDB Atlas or PostgreSQL network access to `0.0.0.0/0` to make Lambda connect; if current database allowlists block AWS's dynamic Lambda egress, stop and choose a secure network-egress design before cutover.

After confirming production login, data persistence, runner connectivity, uploads, and both queued generation flows on AWS, update and deploy the Worker origin. Keep Render available for rollback until the AWS endpoint has been stable; then pause the old Render service only after its active jobs have finished.

### API on Render

The `data-engineering-api` Render service is connected to `alokkrsingh3079/Data-Engineering`, branch `main`, with automatic deploy enabled. Its build command is `npm ci --include=dev --prefix backend && npm run build --prefix backend`; its start command is `npm start --prefix backend`; its health path is `/api/health`.

Push a reviewed change to `main` to start an API deployment. Verify the deployed commit and status in Render, then check `/api/health` and relevant feature endpoints. Never put secret values in `render.yaml` or source control.

For AI features, set `GEMINI_API_KEY` in the Render service's Environment settings (the Blueprint declares it as an unsynced secret). `GEMINI_MODEL` defaults to `gemini-2.5-flash`. Local `backend/.env` values are not uploaded or deployed automatically; adding the key in Render is required to enable production AI. The API can deploy without the optional key, but AI endpoints will remain unavailable until it is configured.

### Frontend on Cloudflare

The [GitHub Actions workflow](.github/workflows/deploy-cloudflare.yml) builds the frontend and deploys the Worker on pushes to `main`. It requires the repository Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. If they are absent, the workflow intentionally skips the publish step. `API_ORIGIN` in [wrangler.jsonc](wrangler.jsonc) points to the API origin; keep the Worker proxy and Render `ALLOWED_ORIGIN` aligned. The Worker retries once when Render marks a response `hibernate-rate-limited`; this may help with transient wake-up throttling but cannot remove free-tier limits.

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
