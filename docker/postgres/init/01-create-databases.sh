#!/bin/bash
# Creates one database + one owning role per service.
#
# Runs ONLY when the postgres data volume is empty. To add a service later,
# either add a line here and recreate the volume (docker compose down -v),
# or run the equivalent SQL manually against the running container.
set -euo pipefail

create_service_db() {
  local db="$1" role="$2" password="$3"

  echo "  creating database '${db}' owned by role '${role}'"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
    CREATE ROLE "${role}" WITH LOGIN PASSWORD '${password}';
    CREATE DATABASE "${db}" OWNER "${role}";
EOSQL
}

# service databases: <database> <role> <password>
create_service_db tennis_content content content

echo "service databases ready"
