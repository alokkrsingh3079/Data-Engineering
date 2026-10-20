#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${CODESPACE_NAME:-}" ]]; then
  printf 'Run this script inside GitHub Codespaces.\n' >&2
  exit 1
fi

for command in docker gh openssl; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "$command" >&2
    exit 1
  fi
done

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
runner_env="$repo_root/deploy/runners/.env"
mkdir -p "$(dirname -- "$runner_env")"

rotate_tokens=false
if [[ "${1:-}" == "--rotate" ]]; then
  rotate_tokens=true
elif [[ -n "${1:-}" ]]; then
  printf 'Usage: bash scripts/start-codespace-runners.sh [--rotate]\n' >&2
  exit 2
fi

if [[ ! -s "$runner_env" || "$rotate_tokens" == true ]]; then
  spark_token="$(openssl rand -hex 32)"
  python_token="$(openssl rand -hex 32)"
  umask 077
  printf 'SPARK_RUNNER_TOKEN=%s\nPYTHON_RUNNER_TOKEN=%s\n' "$spark_token" "$python_token" > "$runner_env"
  printf 'Generated tokens and saved them to the Git-ignored file deploy/runners/.env.\n'
  printf 'Add these exact values to Render as SPARK_RUNNER_TOKEN and PYTHON_RUNNER_TOKEN before testing:\n\n'
  printf 'SPARK_RUNNER_TOKEN=%s\nPYTHON_RUNNER_TOKEN=%s\n\n' "$spark_token" "$python_token"
fi

export DOCKER_GID="$(stat -c '%g' /var/run/docker.sock)"
cd "$repo_root"
docker compose --env-file "$runner_env" up -d --build spark_runner python_runner
gh codespace ports visibility 4020:public 4021:public --codespace "$CODESPACE_NAME"
gh codespace ports --codespace "$CODESPACE_NAME" --json sourcePort,browseUrl,visibility

printf '\nKeep this Codespace running while Render uses the runners.\n'