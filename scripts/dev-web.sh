#!/usr/bin/env bash
# Runs the production build the same way the Docker image does (standalone
# server) without Docker. Usage: scripts/dev-web.sh start|stop|restart
# Requires `npm run build` first. Logs to .local/web.log, PID in .local/web.pid.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PIDFILE=.local/web.pid

stop() {
  if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    kill "$(cat "$PIDFILE")" && echo "stopped web ($(cat "$PIDFILE"))"
  fi
  rm -f "$PIDFILE"
}

start() {
  mkdir -p .local
  [ -f .next/standalone/server.js ] || { echo "run 'npm run build' first" >&2; exit 1; }
  rm -rf .next/standalone/.next/static .next/standalone/public
  cp -r .next/static .next/standalone/.next/static
  cp -r public .next/standalone/public
  set -a; . ./.env; set +a
  PORT="${PORT:-${PLATFORM_PORT:-3000}}" HOSTNAME="${HOSTNAME_BIND:-127.0.0.1}" \
    nohup node .next/standalone/server.js > .local/web.log 2>&1 &
  echo $! > "$PIDFILE"
  sleep 2
  echo "web started (pid $(cat "$PIDFILE")) on port ${PORT:-${PLATFORM_PORT:-3000}}"
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  *) echo "usage: $0 start|stop|restart"; exit 1 ;;
esac
