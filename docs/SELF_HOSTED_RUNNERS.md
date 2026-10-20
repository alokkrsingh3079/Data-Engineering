# Self-Hosted Python and Spark Runners

This stack runs only the isolated Python and PySpark execution services. Keep the main API on Render, MongoDB on Atlas, and PostgreSQL on Neon. It does not start duplicate databases or the backend.

## On-demand GitHub Codespaces

For temporary testing instead of a persistent VM, run `bash scripts/start-codespace-runners.sh` from the repository root inside Codespaces. On first run, it generates separate tokens, stores them in the Git-ignored `deploy/runners/.env`, starts both runner containers, and makes ports 4020/4021 public. Copy the printed token values to the matching Render environment variables, then redeploy Render. Later runs reuse the saved tokens and restore the port visibility. The Codespace must remain running; stopping it makes the runners unavailable to Render. This is not an always-on production host and uses Codespaces compute quota.

## Host requirements

- A dedicated Ubuntu 24.04 Linux VM with Docker Engine and the Compose plugin.
- A stable public IP and two DNS names, such as `spark-runner.example.com` and `python-runner.example.com`.
- 8 GB RAM recommended for two concurrent Spark jobs (each job is limited to 2 GB); 4 GB can be used for light testing but may run out of memory.
- Allow inbound TCP ports 80 and 443 for Caddy and SSH only from trusted addresses. Do not expose ports 4020, 4021, or the Docker socket to the internet.

The runner controllers require access to the host Docker socket so they can create disposable, network-isolated execution containers. Treat this as privileged infrastructure and do not run unrelated or untrusted workloads on the VM.

## Configure and start

1. Create the VM and install Docker Engine plus the Docker Compose plugin using the provider's Ubuntu instructions.
2. Add DNS-only A records for both runner names pointing to the VM's public IP. Keep the DNS records unproxied while Caddy obtains HTTPS certificates. Confirm both names resolve to that IP and ports 80/443 are reachable.
3. Clone this repository on the VM and change into its project directory.
4. Create `deploy/runners/.env` on the VM with these values. Generate each token independently with `openssl rand -hex 32`, and keep this file out of Git:

   ```env
   SPARK_RUNNER_DOMAIN=spark-runner.example.com
   PYTHON_RUNNER_DOMAIN=python-runner.example.com
   SPARK_RUNNER_TOKEN=replace-with-a-new-random-token
   PYTHON_RUNNER_TOKEN=replace-with-a-different-random-token
   DOCKER_GID=replace-with-docker-socket-group-id
   ```

   Set `DOCKER_GID` to the numeric group ID of the VM's Docker socket, for example the output of `stat -c '%g' /var/run/docker.sock`.

5. From the repository root, build and start the runners:

   ```bash
   docker compose --env-file deploy/runners/.env -f docker-compose.runners.yml up -d --build
   docker compose --env-file deploy/runners/.env -f docker-compose.runners.yml ps
   ```

   Wait for both runner services to become healthy. Caddy obtains and renews HTTPS certificates automatically.
6. In Render, add these environment variables, using the same values as the VM's private env file:

   ```text
   SPARK_RUNNER_URL=https://spark-runner.example.com
   SPARK_RUNNER_TOKEN=<same Spark token as on the VM>
   PYTHON_RUNNER_URL=https://python-runner.example.com
   PYTHON_RUNNER_TOKEN=<same Python token as on the VM>
   ```

   Save and redeploy the backend. Open `/api/learning/runners/status` on the API to verify both runners report configured and available, then try one Python and one PySpark submission.

## Operations

Update the VM by pulling the desired Git commit and rerunning the Compose `up -d --build` command. View logs with:

```bash
docker compose --env-file deploy/runners/.env -f docker-compose.runners.yml logs -f spark_runner python_runner caddy
```

The Spark job queue is in memory and limited to one controller; do not run multiple replicas. Back up `deploy/runners/.env` securely and rotate the two runner tokens together in the VM and Render. Do not put them in Cloudflare frontend variables or commit them.