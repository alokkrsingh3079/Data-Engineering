# Deployment Guide

## Hosting layout

The Cloudflare Worker serves the built React/Vite frontend and forwards `/api/*` requests to the Express API. The Node API uses MongoDB for platform records and PostgreSQL for the existing SQL practice workspaces and query execution. The backend is an Express server, so it cannot be deployed unchanged as a Workers function.

```text
Browser -> Cloudflare Worker (frontend assets and /api proxy)
                          -> HTTPS -> Node/Express API -> MongoDB (platform data)
                                                     -> PostgreSQL (SQL practice)
                                                     -> private Spark host -> disposable no-network PySpark containers
                                                     -> OpenAI (optional)
```

Deploy the backend to a Node.js host with managed MongoDB and PostgreSQL services reachable from that host. Keep both database URIs, `PRACTICE_ROLE_SECRET`, and OpenAI credentials on the backend host. `DATABASE_URL` currently provisions workspace schemas and dedicated per-workspace SQL roles, so its PostgreSQL identity needs schema/role provisioning privileges; do not give it to the practice runner. The Worker only needs the public HTTPS origin of the deployed API.

## Free GitHub deployment: Render + Cloudflare

This repository includes a free Render web-service Blueprint at [`render.yaml`](render.yaml) and a GitHub Actions workflow at [`.github/workflows/deploy-cloudflare.yml`](.github/workflows/deploy-cloudflare.yml). Render deploys the Express API from GitHub; Cloudflare's free Workers plan can serve the frontend and proxy `/api`. PostgreSQL is external because Render's managed database is not a free persistent option. Provider setup and secrets are still required; never commit access tokens or database credentials. Free hosting is suitable for a demo, not production availability: Render may spin down an idle free web service, causing slow cold starts, and the free plans do not provide production uptime guarantees.

### 1. Create MongoDB Atlas

Create a production Atlas cluster, a dedicated database user with access only to the `sql_software` database, and a database named `sql_software`. Copy the Atlas application connection string and replace its username, password, and host. In Atlas Network Access, allow connections from the Render service's outbound IPs when available. If your Render plan does not provide stable outbound IPs, Atlas may require a broader IP allowlist; use a strong database password, TLS, and a least-privilege database user, and understand that `0.0.0.0/0` allows connection attempts from any IP.

### 2. Create free PostgreSQL and deploy the backend on Render

1. Create a PostgreSQL database on a provider with a free tier, for example Neon. Save its TLS-enabled connection string. The app needs a PostgreSQL login that can create schemas and roles; verify the provider grants this before relying on it. A free database tier can have storage, compute, backup, and sleep limits, so check the provider's current terms and keep backups of important data.
2. In Render, choose **New > Blueprint**, connect this GitHub repository, and select `main`. Render reads `render.yaml` and creates the API as a free Node web service; this Blueprint does not provision a paid Render database.
3. Enter the Blueprint's unsynced values: `MONGODB_URI` (your Atlas URI), `DATABASE_URL` (the external PostgreSQL connection string), `PRACTICE_DATABASE_URL` (the same connection string to start), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a temporary `ALLOWED_ORIGIN`. Use a unique admin password. Render generates `AUTH_SECRET` and `PRACTICE_ROLE_SECRET`; keep the latter stable because it derives credentials for existing SQL workspace roles.
4. After deployment, copy the service's public HTTPS origin, such as `https://sql-software-api.onrender.com`. Check `https://<render-host>/api/health`; it should report both MongoDB and PostgreSQL healthy. Then register a test account and try creating a practice schema. If PostgreSQL rejects `CREATE ROLE` or `ALTER ROLE`, that database provider/role does not support this app's current workspace isolation model. Do not work around it by sharing an unrestricted SQL role; choose a PostgreSQL provider that supports the required privileges or change the isolation design first.

PostgreSQL remains required even though accounts and platform records are stored in MongoDB: startup migrations, SQL editor schemas, and query execution use PostgreSQL. `DATABASE_URL` and `PRACTICE_DATABASE_URL` can initially use the same provider connection string, but remain separate settings. The free Render filesystem is not the database; store all persistent records in Atlas and PostgreSQL.

### 3. Deploy the frontend Worker through GitHub

1. In Cloudflare, create a custom API token limited to the deployment account with **Account > Workers Scripts > Edit** and **Account > Account Settings > Read**. Add it as the GitHub repository Actions secret `CLOUDFLARE_API_TOKEN`; add the account ID as `CLOUDFLARE_ACCOUNT_ID`. Do not paste either value into chat, source files, or `.env`.
2. Before deploying the frontend, set the Worker's `API_ORIGIN` secret to the Render API origin, without `/api` or a trailing slash. In the Worker dashboard, open **Settings > Variables and Secrets > Add**, mark it as a secret, and use the origin from the previous section. Alternatively, use `npx wrangler secret put API_ORIGIN` from a trusted local terminal.
3. Set Render's `ALLOWED_ORIGIN` to the Cloudflare `workers.dev` origin after the first Worker deploy (for example, `https://sql-software.<your-subdomain>.workers.dev`), then redeploy/restart the API. The browser calls `/api` on the Worker origin, and the Worker forwards requests and session cookies to Render.
4. Push or merge to `main`. GitHub Actions builds and deploys the Worker; Render auto-deploys the API from its connected Git branch. Visit the Worker URL and verify login, registration, SQL schema import, SQL execution, and persistence after refresh.

The Worker proxies API requests to Render; it does not host the Express API or databases. MongoDB writes persist directly to Atlas and are read back through the API. This app does not currently implement MongoDB change streams or WebSocket push, so it provides live database-backed requests, not cross-client live notifications.

### 4. Python and Spark execution

Python and PySpark execution are not hosted by this Render Blueprint. Their controllers require Docker socket access to launch isolated job containers, which the regular Render web service and Cloudflare Worker do not provide. The API, MongoDB-backed accounts and learning data, PostgreSQL SQL editor, and other features can deploy without them; execution features report unavailable until the separately documented runner services are hosted on a Docker-compatible machine and configured with HTTPS URLs and server-side tokens.

## Repository layout

The app now has one project root; `frontend/`, `backend/`, and `worker/` are siblings. The previous nested app directory and placeholder README are retained in `archive/` for reference. The original ZIP is retained in `archive/` as well.

## Cloudflare API token

In the Cloudflare dashboard, open **My Profile > API Tokens > Create Token > Create Custom Token**.

- **Token name:** `sql-software-worker-deploy`
- **Permissions:** `Account > Workers Scripts > Edit`; `Account > Account Settings > Read` if Wrangler needs to discover the account. Do not grant Zone permissions for a `workers.dev` deployment.
- **Account Resources:** Include only the Cloudflare account that will own this Worker.
- **Zone Resources:** None for the default `workers.dev` URL. If later attaching a custom domain, add only the relevant zone and the permissions Cloudflare requires for that domain/route.
- **Client IP Address Filtering:** Leave unrestricted unless you have a stable deployment IP or egress range to allowlist.
- **TTL:** Choose a limited lifetime, such as 90 days, and rotate the token before it expires.

Create the token, then store it in your own terminal or CI secret store as `CLOUDFLARE_API_TOKEN`. Do not paste it into chat, commit it, put it in `.env`, or add it to `wrangler.jsonc`. Wrangler also supports interactive Cloudflare login if you prefer not to use an API token.

To set it for the current Bash terminal without echoing it or putting it in shell history, run this and paste the token at the hidden prompt:

```bash
read -rsp "Cloudflare API token: " CLOUDFLARE_API_TOKEN
export CLOUDFLARE_API_TOKEN
printf '\n'
```

## Deploy the frontend Worker

Prerequisites: Node.js 20+, npm, a Cloudflare account, and a deployed HTTPS API origin.

1. Install the root Wrangler dependency and frontend dependencies:

   ```bash
   npm install
   npm ci --prefix frontend
   ```

2. Authenticate Wrangler using `CLOUDFLARE_API_TOKEN` in your local shell, or run `npx wrangler login` and complete the browser login. If your Cloudflare user has multiple accounts, set the intended `account_id` in `wrangler.jsonc` before deploying.

3. Set the API origin as a Worker secret. Use only the origin, for example `https://sql-api.example.com`, without `/api` or a trailing route:

   ```bash
   npx wrangler secret put API_ORIGIN
   ```

   When prompted, enter the API's HTTPS origin. Keep this value out of source control.

4. Build and deploy:

   ```bash
   npm run deploy
   ```

   Wrangler prints the public `workers.dev` URL.

5. Set the backend's `ALLOWED_ORIGIN` to that Worker URL (for example, `https://sql-software.<your-subdomain>.workers.dev`) and restart the backend. Configure `MONGODB_URI`, `MONGODB_DATABASE`, `DATABASE_URL`, `PRACTICE_DATABASE_URL`, a stable `PRACTICE_ROLE_SECRET`, `AUTH_SECRET`, admin credentials, and optional `OPENAI_API_KEY` in the backend host's secret/environment settings.

6. Open the Worker URL and verify `/api/health` reports healthy. Backend startup currently requires both database services; the health endpoint checks PostgreSQL.

## Local development

Start local MongoDB/PostgreSQL and the real Spark worker with `docker compose up -d mongodb postgres spark_runner`, then run the Express API and Vite frontend using the commands in the root [README](README.md). The backend should use `SPARK_RUNNER_URL=http://127.0.0.1:4021`, `SPARK_RUNNER_TOKEN=local-development-only-token`, and `NODE_ENV=development`. The local MongoDB port and Spark runner port bind to loopback only. Run `SPARK_RUNNER_URL=http://127.0.0.1:4021 SPARK_RUNNER_TOKEN=local-development-only-token python3 worker/spark/smoke_test.py` for real aggregation, join, window, null, syntax-error, and timeout checks. To exercise the Worker locally after building the frontend, set `API_ORIGIN` in Wrangler's local environment or use a local `.dev.vars` file (which must not be committed), then run:

```bash
npm run build
npx wrangler dev
```

## Before production

The Spark runner is separate from the Cloudflare Worker and Express API. Host it on a dedicated Docker-compatible VM/container host with Java 17, adequate memory (2 GiB per active job), Docker socket access, and the `SPARK_RUNNER_TOKEN`/`DOCKER_GID` configuration documented in [environment variables](docs/ENVIRONMENT_VARIABLES.md). The production Compose runner uses an internal network and should only be deployed on that dedicated host. The worker uses Spark local mode, not a multi-node cluster; its in-memory queue does not survive restarts and is not horizontally replicated.

- Use managed MongoDB and PostgreSQL services with backups, TLS, and restricted network access.
- Use strong, unique `AUTH_SECRET` and admin credentials; do not use example values.
- Set the backend's `ALLOWED_ORIGIN` to the deployed frontend origin.
- Keep `OPENAI_API_KEY`, database credentials, and Cloudflare API tokens in provider secret stores.
- Test signup/login, SQL execution, uploads, and AI endpoints against the deployed API and database.
- Python/Spark execution requires separate hardened services. The API expects the runner routes and response format documented in [environment variables](docs/ENVIRONMENT_VARIABLES.md); configuring only a URL does not establish isolation.
- Learning-interview AI feedback uses the optional OpenAI provider. It is subjective coaching, and responses remain saved if evaluation is unavailable.
- Python/Spark execution requires separate hardened services. The API expects the runner routes and response format documented in [environment variables](ENVIRONMENT_VARIABLES.md); configuring only a URL does not establish isolation.
- The learning-interview rubric uses the optional OpenAI provider. Feedback is subjective and the saved answer remains available when the provider is unavailable.