# Python and Spark Runner Operations

The Python and PySpark controllers are separate from the web API. They launch disposable job containers and require access to the host Docker socket. Treat the controller host as privileged infrastructure; do not run unrelated untrusted workloads there or expose the Docker socket.

## Current hosting options

The deployed API can use runner endpoints configured through `PYTHON_RUNNER_URL`/`PYTHON_RUNNER_TOKEN` and `SPARK_RUNNER_URL`/`SPARK_RUNNER_TOKEN`. At the last status check on 2026-10-24, both reported configured and available.

The Codespaces helper in `scripts/start-codespace-runners.sh` supports on-demand testing. A Codespace must remain running; stopping it interrupts access. Use a dedicated Docker-compatible VM for a continuously available service. The runners are not hosted by Cloudflare Workers or the regular Render API service.

## Dedicated host requirements

- Ubuntu 24.04 or compatible Linux with Docker Engine and Compose.
- Stable IP and two DNS names, one per runner.
- Recommended 8 GB RAM for concurrent Spark jobs.
- Inbound HTTPS through Caddy; do not expose runner ports 4020/4021 or the Docker socket publicly.

The Spark job uses Python 3.11, PySpark 3.5.6, and Java 17 in local Spark mode. It is a single-host Spark environment, not a multi-node cluster. The Spark controller queue is in-memory and limited; it does not survive controller restarts or support safe horizontal replication.

## Configure a dedicated runner host

1. Install Docker Engine and Compose on a dedicated host.
2. Point DNS-only A records for the Python and Spark domains to the host while Caddy obtains certificates.
3. Clone the project and create `deploy/runners/.env` (Git-ignored) with:

   ```env
   SPARK_RUNNER_DOMAIN=spark-runner.example.com
   PYTHON_RUNNER_DOMAIN=python-runner.example.com
   SPARK_RUNNER_TOKEN=<fresh-random-token>
   PYTHON_RUNNER_TOKEN=<different-fresh-random-token>
   DOCKER_GID=<numeric-docker-socket-group-id>
   ```

   Generate separate long random tokens with a secure local method. Never paste tokens into chat or commit them.
4. Start the runners:

   ```bash
   docker compose --env-file deploy/runners/.env -f docker-compose.runners.yml up -d --build
   docker compose --env-file deploy/runners/.env -f docker-compose.runners.yml ps
   ```
5. Configure the matching HTTPS runner URLs and tokens in the backend host's secret manager, then restart/redeploy the API.
6. Check `GET /api/learning/runners/status` and run one Python and one PySpark exercise with a test account.

## On-demand Codespaces

From a Codespace, run:

```bash
bash scripts/start-codespace-runners.sh
```

The helper manages local runner configuration and Codespaces port visibility. Keep its generated `.env` private and use the printed tokens only in the backend secret manager. For token rotation, use the script's documented `--rotate` option, update the backend and runner together, and verify both services afterward. Stopping the Codespace makes the runners unavailable.

## Troubleshooting

- **Runner unavailable:** check API `/api/learning/runners/status`, host health, DNS/TLS, and matching backend/runner token configuration.
- **401:** backend and runner bearer tokens do not match, or the request lacks the expected authorization.
- **404:** confirm the runner base URL points to the controller root and the requested route exists.
- **Timeout/capacity errors:** inspect host resources and queue status; do not remove limits to mask overload.
- **Spark job failure:** correlate safe request IDs from browser and backend logs. Do not share tokens, cookies, private data, or full submitted code in support requests.

Logs should not include credentials or private test payloads. Rotate runner tokens on suspected exposure and update both ends together.
