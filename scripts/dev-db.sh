#!/usr/bin/env bash
# Runs a throwaway PostgreSQL 16 cluster in ./.local/pg without Docker.
# Usage: scripts/dev-db.sh start|stop|status|reset
# Creates role tyled/tyled and databases tyled + tyled_test on first start.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PGDATA="$ROOT/.local/pg"
PGPORT="${PGPORT:-5432}"
PGLOG="$ROOT/.local/pg.log"

if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/pg_ctl" ]; then
  echo "PostgreSQL binaries not found. Install postgresql-16 or set PGBIN." >&2
  exit 1
fi

run_as() {
  # postgres refuses to run as root; drop to the 'postgres' user when we are root.
  if [ "$(id -u)" = "0" ]; then
    chown -R postgres:postgres "$ROOT/.local" 2>/dev/null || true
    su postgres -s /bin/bash -c "$*"
  else
    bash -c "$*"
  fi
}

init() {
  mkdir -p "$ROOT/.local"
  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "Initialising cluster in $PGDATA"
    run_as "$PGBIN/initdb -D '$PGDATA' -U postgres --auth=trust -E UTF8 >/dev/null"
    echo "listen_addresses = '127.0.0.1'" >> "$PGDATA/postgresql.conf"
    echo "port = $PGPORT" >> "$PGDATA/postgresql.conf"
    echo "unix_socket_directories = '/tmp'" >> "$PGDATA/postgresql.conf"
  fi
}

start() {
  init
  if run_as "$PGBIN/pg_ctl -D '$PGDATA' status" >/dev/null 2>&1; then
    echo "Postgres already running on port $PGPORT"
  else
    run_as "$PGBIN/pg_ctl -D '$PGDATA' -l '$PGLOG' -w start" >/dev/null
    echo "Postgres started on 127.0.0.1:$PGPORT"
  fi
  PSQL="$PGBIN/psql -h 127.0.0.1 -p $PGPORT -U postgres -v ON_ERROR_STOP=1 -q"
  $PSQL -tc "SELECT 1 FROM pg_roles WHERE rolname='tyled'" | grep -q 1 || $PSQL -c "CREATE ROLE tyled LOGIN PASSWORD 'tyled' SUPERUSER"
  for db in tyled tyled_test; do
    $PSQL -tc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 || $PSQL -c "CREATE DATABASE $db OWNER tyled"
  done
  echo "DATABASE_URL=postgresql://tyled:tyled@127.0.0.1:$PGPORT/tyled"
}

case "${1:-start}" in
  start) start ;;
  stop) run_as "$PGBIN/pg_ctl -D '$PGDATA' -m fast stop" ;;
  status) run_as "$PGBIN/pg_ctl -D '$PGDATA' status" ;;
  reset) run_as "$PGBIN/pg_ctl -D '$PGDATA' -m fast stop" || true; rm -rf "$PGDATA"; start ;;
  *) echo "usage: $0 start|stop|status|reset"; exit 1 ;;
esac
