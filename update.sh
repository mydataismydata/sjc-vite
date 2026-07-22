#!/bin/sh
# Update SJC-Vite to the latest committed version and restart it.
#
#     ./update.sh
#
# Pulls the latest code, installs dependencies, rebuilds the admin app,
# restarts the service, and waits for the health check to pass. Safe to run
# any time — if nothing changed it simply rebuilds and restarts.
#
# Overrides (rarely needed):
#     SJC_SERVICE=my-service ./update.sh     # systemd unit name (default sjc-vite)
set -eu

# The whole body is wrapped in a brace group so the shell parses it fully
# before running. That way `git pull` replacing this very file mid-run can't
# corrupt what's executing.
{
  cd "$(dirname "$0")"

  SERVICE="${SJC_SERVICE:-sjc-vite}"
  # Health check port: read PORT from .env if set, otherwise 3000.
  PORT="$(sed -n 's/^[[:space:]]*PORT[[:space:]]*=[[:space:]]*//p' .env 2>/dev/null | tail -n1 || true)"
  PORT="${PORT:-3000}"

  echo "==> Pulling latest code"
  BEFORE="$(git rev-parse --short HEAD)"
  git pull --ff-only
  AFTER="$(git rev-parse --short HEAD)"
  if [ "$BEFORE" = "$AFTER" ]; then
    echo "    Already at $AFTER — rebuilding and restarting anyway."
  else
    echo "    Updated $BEFORE -> $AFTER"
  fi

  echo "==> Installing dependencies"
  # --include=dev so the build tools are present even if NODE_ENV=production.
  npm install --include=dev --no-audit --no-fund

  echo "==> Building the admin app"
  npm run build

  echo "==> Restarting $SERVICE"
  sudo systemctl restart "$SERVICE"

  echo "==> Waiting for the server to come back"
  n=0
  while [ "$n" -lt 30 ]; do
    if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
      echo ""
      echo "Done — SJC-Vite is up to date and healthy (now at $AFTER)."
      exit 0
    fi
    n=$((n + 1))
    sleep 1
  done

  echo "" >&2
  echo "WARNING: the server did not answer on port $PORT within 30s." >&2
  echo "Check the logs:  sudo journalctl -u $SERVICE -n 50 --no-pager" >&2
  exit 1
}
