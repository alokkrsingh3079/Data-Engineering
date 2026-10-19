# Deployment Guide

## Hosting layout

The Cloudflare Worker serves the built React/Vite frontend and forwards `/api/*` requests to the Express API. The Node API uses MongoDB for platform records and PostgreSQL for the existing SQL practice workspaces and query execution. The backend is an Express server, so it cannot be deployed unchanged as a Workers function.

```text
Browser -> Cloudflare Worker (frontend assets and /api proxy)
                          -> HTTPS -> Node/Express API -> MongoDB (platform data)
                                                     -> PostgreSQL (SQL practice)
                                                     -> OpenAI (optional)
```

Deploy the backend to a Node.js host with managed MongoDB and PostgreSQL services reachable from that host. Keep both database URIs, `PRACTICE_ROLE_SECRET`, and OpenAI credentials on the backend host. `DATABASE_URL` currently provisions workspace schemas and dedicated per-workspace SQL roles, so its PostgreSQL identity needs schema/role provisioning privileges; do not give it to the practice runner. The Worker only needs the public HTTPS origin of the deployed API.

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

Start the local MongoDB and PostgreSQL services with `docker compose up -d mongodb postgres`, then run the Express API and Vite frontend using the commands in the root [README](README.md). The local MongoDB port is bound to loopback only. To exercise the Worker locally after building the frontend, set `API_ORIGIN` in Wrangler's local environment or use a local `.dev.vars` file (which must not be committed), then run:

```bash
npm run build
npx wrangler dev
```

## Before production

- Use managed MongoDB and PostgreSQL services with backups, TLS, and restricted network access.
- Use strong, unique `AUTH_SECRET` and admin credentials; do not use example values.
- Set the backend's `ALLOWED_ORIGIN` to the deployed frontend origin.
- Keep `OPENAI_API_KEY`, database credentials, and Cloudflare API tokens in provider secret stores.
- Test signup/login, SQL execution, uploads, and AI endpoints against the deployed API and database.
- Python/Spark execution requires separate hardened services. The API expects the runner routes and response format documented in [environment variables](docs/ENVIRONMENT_VARIABLES.md); configuring only a URL does not establish isolation.
- Learning-interview AI feedback uses the optional OpenAI provider. It is subjective coaching, and responses remain saved if evaluation is unavailable.
- Python/Spark execution requires separate hardened services. The API expects the runner routes and response format documented in [environment variables](ENVIRONMENT_VARIABLES.md); configuring only a URL does not establish isolation.
- The learning-interview rubric uses the optional OpenAI provider. Feedback is subjective and the saved answer remains available when the provider is unavailable.