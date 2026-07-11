#!/usr/bin/env bash
# Runs on the DigitalOcean droplet after GitHub Actions has rsynced a fresh
# checkout into /opt/skyprints/releases/$RELEASE_ID (see
# .github/workflows/deploy-backend-prod.yml). Builds fully in that isolated
# directory first — a failure here never touches the currently running
# release. Only after a successful build + migration + post-reload health
# check does `current` get repointed. If the health check fails after the
# swap, automatically rolls back to the previous release.
set -euo pipefail

RELEASE_ID="$1"
BASE=/opt/skyprints
RELEASE_DIR="$BASE/releases/$RELEASE_ID"
SHARED_ENV="$BASE/shared/apps/backend/.env"
CURRENT_LINK="$BASE/current"

if [ ! -d "$RELEASE_DIR" ]; then
  echo "Release dir $RELEASE_DIR not found (rsync step must run first)" >&2
  exit 1
fi

PREVIOUS_TARGET=""
if [ -L "$CURRENT_LINK" ]; then
  PREVIOUS_TARGET="$(readlink -f "$CURRENT_LINK")"
fi

cd "$RELEASE_DIR"
ln -sfn "$SHARED_ENV" apps/backend/.env

echo "[deploy $RELEASE_ID] installing dependencies"
npm install

echo "[deploy $RELEASE_ID] building contracts + backend"
npm run build --workspace=@app/contracts
npm run build --workspace=@app/backend

echo "[deploy $RELEASE_ID] running prisma migrate deploy"
(cd apps/backend && npx prisma migrate deploy)

echo "[deploy $RELEASE_ID] build succeeded — cutting over"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
pm2 reload "$BASE/ecosystem.config.js" --update-env

HEALTHY=false
for i in $(seq 1 20); do
  if curl -sf http://127.0.0.1:3001/api/v1/health >/dev/null; then
    HEALTHY=true
    break
  fi
  sleep 1
done

if [ "$HEALTHY" = true ]; then
  echo "[deploy $RELEASE_ID] health check passed — deploy successful"
  # Keep the 5 most recent releases, prune older ones
  cd "$BASE/releases" && ls -1t | grep -v CURRENT_RELEASE_ID | tail -n +6 | xargs -r rm -rf
  echo "$RELEASE_ID" > "$BASE/releases/CURRENT_RELEASE_ID"
  exit 0
fi

echo "[deploy $RELEASE_ID] health check FAILED — rolling back" >&2
if [ -n "$PREVIOUS_TARGET" ]; then
  ln -sfn "$PREVIOUS_TARGET" "$CURRENT_LINK"
  pm2 reload "$BASE/ecosystem.config.js" --update-env
  echo "[deploy $RELEASE_ID] rolled back to $PREVIOUS_TARGET" >&2
fi
exit 1
