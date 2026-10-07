# Sourced by ops-test.sh when OPS_TEST_INTEGRATION=1. Real execution, no stubs for PostgreSQL:
#   1. dump a migrated source database (OPS_TEST_SOURCE_DUMP_CMD writes a custom-format dump to stdout),
#   2. encrypt it with a throwaway key exactly as backup-dump.sh does,
#   3. start a throwaway PostgreSQL 17 with TLS (certificate CN/SAN localhost) as the isolated target,
#   4. run restore-drill.sh in dump mode with verify-full, and validate read-only,
#   5. prove evidence was written and the target refuses a second restore into the same database.
#
# Default source: the local Docker Compose database (`docker compose exec -T pgsql pg_dump ...`).

image="${OPS_TEST_PG_IMAGE:-postgres:17.11-alpine}"
source_cmd="${OPS_TEST_SOURCE_DUMP_CMD:-docker compose exec -T pgsql pg_dump -U rinquo --format=custom --no-owner --no-privileges ${OPS_TEST_SOURCE_DB:-rinquo}}"
port="${OPS_TEST_TARGET_PORT:-55433}"
name="rinquo-ops-drill-$$"
certs="$tmp/certs"
mkdir -p "$certs"

openssl req -x509 -newkey rsa:2048 -nodes -keyout "$certs/server.key" -out "$certs/server.crt" -days 1 \
    -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1
chmod 644 "$certs/server.key" "$certs/server.crt"

cleanup_target() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap 'cleanup_target; rm -rf "$tmp"' EXIT

docker run -d --name "$name" -p "127.0.0.1:${port}:5432" -e POSTGRES_PASSWORD=drill-only-password -v "$certs:/certs:ro" "$image" \
    sh -c 'cp /certs/server.* /var/lib/postgresql/ && chown postgres /var/lib/postgresql/server.* && chmod 600 /var/lib/postgresql/server.key && exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/var/lib/postgresql/server.crt -c ssl_key_file=/var/lib/postgresql/server.key' >/dev/null
for _ in $(seq 1 60); do
    docker exec "$name" pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 1
done
check "the throwaway TLS target is up" docker exec "$name" pg_isready -U postgres

# 1 and 2: dump and encrypt like backup-dump.sh.
dump="$tmp/rinquo-20261006T030000Z.dump.gpg"
$source_cmd | gpg --batch --yes --trust-model always --encrypt --recipient "$fingerprint" --output "$dump"
check "the source dump was encrypted" test -s "$dump"
printf '%s  %s\n' "$(sha256_of "$dump")" "$(basename "$dump")" >"$dump.sha256"

docker_pg() { # docker_pg <tool>: run a PostgreSQL client tool in a container against the TLS target
    printf 'docker run --rm -i --network host -e PGHOST -e PGPORT -e PGUSER -e PGPASSWORD -e PGSSLMODE -e PGSSLROOTCERT -e PGDATABASE -v %s:%s:ro -v %s:%s:ro -v %s:%s %s %s' \
        "$certs" "$certs" "$ops" "$ops" "$tmp" "$tmp" "$image" "$1"
}

evidence="$tmp/evidence"
drill_env=(
    env PATH="$PATH" GNUPGHOME="$GNUPGHOME" TMPDIR="$tmp"
    PSQL="$(docker_pg psql)" PG_RESTORE="$(docker_pg pg_restore)" CREATEDB="$(docker_pg createdb)"
    RINQUO_DRILL_TICKET=OPS-INTEGRATION RINQUO_DRILL_OPERATOR=ops@example.test
    RINQUO_DRILL_PGHOST=localhost RINQUO_DRILL_PGPORT="$port" RINQUO_DRILL_PGUSER=postgres
    RINQUO_DRILL_PGPASSWORD=drill-only-password RINQUO_DRILL_PGDATABASE=restore_drill
    RINQUO_DRILL_PGSSLROOTCERT="$certs/server.crt" RINQUO_PRODUCTION_PGHOST=production.invalid
)

"${drill_env[@]}" "$ops/restore-drill.sh" --mode dump --dump "$dump" --evidence-dir "$evidence" >"$tmp/drill.out" 2>"$tmp/drill.err"
drill_status=$?
check "the restore drill succeeded against the TLS target (verify-full)" test "$drill_status" -eq 0
check "every validation check passed" bash -c "grep -q '|pass|' '$tmp/drill.out' && ! grep -q '|fail|' '$tmp/drill.out'"
check "tenant scope was checked on tenant tables" grep -q 'tenant-scope-' "$tmp/drill.out"
check "the append-only audit triggers survived the restore" grep -q 'platform-audit-immutable|pass' "$tmp/drill.out"
check "evidence was written" test -n "$(find "$evidence" -name 'restore-drill-OPS-INTEGRATION-*.json' -type f)"
evidence_file="$(find "$evidence" -name 'restore-drill-OPS-INTEGRATION-*.json' -type f | head -n1)"
check "evidence records the objectives and pending cleanup" bash -c "grep -q '\"rto_hours\": 4' '$evidence_file' && grep -q '\"status\": \"pending\"' '$evidence_file'"
check "evidence contains no password" bash -c "! grep -q 'drill-only-password' '$evidence_file' '$tmp/drill.out' '$tmp/drill.err'"

# A second restore must never overwrite the first.
"${drill_env[@]}" "$ops/restore-drill.sh" --mode dump --dump "$dump" --evidence-dir "$evidence" >/dev/null 2>"$tmp/second.err"
second_status=$?
check "a second restore into the same database is refused" test "$second_status" -ne 0
check "the refusal says why" grep -q 'already exists' "$tmp/second.err"

# Time the drill for the evidence record.
echo "  info drill restore+validation seconds: $(grep -o '"total_seconds": [0-9]*' "$evidence_file" | head -n1)"

# The validator must be able to fail: a wrong expected migration count is a failed drill.
validate_env=(env PATH="$PATH" PSQL="$(docker_pg psql)" PGHOST=localhost PGPORT="$port" PGUSER=postgres PGPASSWORD=drill-only-password PGDATABASE=restore_drill PGSSLMODE=verify-full PGSSLROOTCERT="$certs/server.crt")
check_fails "validation fails when the migration count does not match" "${validate_env[@]}" "$ops/validate-restore.sh" 9999
