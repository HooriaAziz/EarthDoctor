#!/usr/bin/env bash
set -euo pipefail
cd /opt/earthdoctor
exec 9>.deploy.lock
flock 9
new_image="${1:?image digest required}"
[[ "$new_image" =~ ^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$ ]] || exit 2
previous=$(cat current-image 2>/dev/null || true)
export APP_IMAGE="$new_image"
docker compose -f compose.production.yml pull
if docker compose -f compose.production.yml up -d --wait --wait-timeout 120 && curl -fsS http://localhost/ >/dev/null; then
  printf '%s\n' "$new_image" > current-image
  printf '%s\n' "$previous" > previous-image
else
  if [[ -n "$previous" ]]; then
    export APP_IMAGE="$previous"
    docker compose -f compose.production.yml up -d --wait --wait-timeout 120
  fi
  exit 1
fi
