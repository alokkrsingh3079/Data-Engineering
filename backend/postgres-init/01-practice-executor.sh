#!/bin/sh
set -eu
: "${PRACTICE_DATABASE_PASSWORD:?Set PRACTICE_DATABASE_PASSWORD}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=practice_password="$PRACTICE_DATABASE_PASSWORD" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'practice_executor') THEN
    CREATE ROLE practice_executor LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;
ALTER ROLE practice_executor PASSWORD :'practice_password';
SQL
