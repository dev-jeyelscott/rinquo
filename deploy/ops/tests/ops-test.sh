#!/usr/bin/env bash
#
# Executable checks for the backup and restore-drill tooling.
#
#   deploy/ops/tests/ops-test.sh                 unit and stubbed checks (bash, gpg, openssl; used by CI)
#   OPS_TEST_INTEGRATION=1 deploy/ops/tests/ops-test.sh
#       also performs a REAL restore drill: dumps a migrated source database, encrypts it, restores it
#       into a throwaway TLS PostgreSQL 17 container (verify-full) and validates it.
#       Needs docker, a migrated source database (OPS_TEST_SOURCE_PSQL / OPS_TEST_SOURCE_DUMP).

set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ops="$(cd "$here/.." && pwd)"
# shellcheck source=../lib.sh
source "$ops/lib.sh"

pass=0
fail=0
check() { # check "name" command...
    local name="$1"
    shift
    if "$@" >/dev/null 2>&1; then
        pass=$((pass + 1))
        printf '  ok   %s\n' "$name"
    else
        fail=$((fail + 1))
        printf '  FAIL %s\n' "$name"
    fi
}
check_fails() { # check_fails "name" command...  (command must exit non-zero)
    local name="$1"
    shift
    if "$@" >/dev/null 2>&1; then
        fail=$((fail + 1))
        printf '  FAIL %s (expected a failure)\n' "$name"
    else
        pass=$((pass + 1))
        printf '  ok   %s\n' "$name"
    fi
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "retention and date helpers"
check "month end is detected" is_last_day_of_month 2026-02-28
check_fails "mid month is not month end" is_last_day_of_month 2026-02-27
check "leap day is month end in a leap year" is_last_day_of_month 2028-02-29
check "daily name parses" test "$(object_date 'p/daily/2026/rinquo-20261005T031500Z.dump.gpg')" = "2026-10-05"
check "monthly name parses" test "$(object_date 'p/monthly/rinquo-202610.dump.gpg')" = "2026-10-31"

daily_keys=$'p/daily/2026/rinquo-20260820T030000Z.dump.gpg\np/daily/2026/rinquo-20260831T030000Z.dump.gpg\np/daily/2026/rinquo-20260901T030000Z.dump.gpg\np/daily/2026/rinquo-20261005T030000Z.dump.gpg\np/daily/2026/unrelated.txt'
expired="$(printf '%s\n' "$daily_keys" | expired_keys daily 2026-10-06)"
check "daily older than 35 days is expired" grep -q 'rinquo-20260820T030000Z' <<<"$expired"
check "daily 36 days old is expired" grep -q 'rinquo-20260831T030000Z' <<<"$expired"
check "daily exactly 35 days old is kept (boundary)" bash -c "! grep -q 'rinquo-20260901T030000Z' <<<\"$expired\""
check "recent daily is kept" bash -c "! grep -q 'rinquo-20261005' <<<\"$expired\""
check "unknown names are never deleted" bash -c "! grep -q unrelated <<<\"$expired\""
monthly_keys=$'p/monthly/rinquo-202509.dump.gpg\np/monthly/rinquo-202510.dump.gpg\np/monthly/rinquo-202510.dump.gpg.sha256'
expired_m="$(printf '%s\n' "$monthly_keys" | expired_keys monthly 2026-10-06)"
check "monthly older than 12 months is expired" grep -q 'rinquo-202509' <<<"$expired_m"
check "monthly at 12 months is kept" bash -c "! grep -q 'rinquo-202510' <<<\"$expired_m\""

# --- Fake S3 (directory backed) and fake pg_dump ----------------------------------------------
mkdir -p "$tmp/bin" "$tmp/s3"
cat >"$tmp/bin/aws" <<'AWS'
#!/usr/bin/env bash
# Minimal fake of: aws --endpoint-url X s3 cp|ls|rm
shift 2 # --endpoint-url X
shift   # s3
cmd="$1"; shift
root="${FAKE_S3_ROOT:?}"
case "$cmd" in
    cp) args=(); for a in "$@"; do [[ "$a" == --* ]] || args+=("$a"); done
        dest="${args[1]#s3://}"; mkdir -p "$root/$(dirname "$dest")"; cp "${args[0]}" "$root/$dest" ;;
    ls) args=(); for a in "$@"; do [[ "$a" == --* ]] || args+=("$a"); done
        prefix="${args[0]#s3://}"; (cd "$root" && find "${prefix%/}" -type f 2>/dev/null | sed -e "s#^[^/]*/##" -e "s#^#2026-01-01 00:00:00 0 #") ;;
    rm) args=(); for a in "$@"; do [[ "$a" == --* ]] || args+=("$a"); done
        rm -f "$root/${args[0]#s3://}" ;;
esac
AWS
cat >"$tmp/bin/fake-pg-dump" <<'DUMP'
#!/usr/bin/env bash
if [[ "${1:-}" == "--version" ]]; then echo "pg_dump (PostgreSQL) 17.11"; exit 0; fi
printf 'PGDMP-fake-archive-%s' "$PGDATABASE"
DUMP
chmod +x "$tmp/bin/aws" "$tmp/bin/fake-pg-dump"

echo "gpg round trip with a throwaway key"
export GNUPGHOME="$tmp/gnupg"
mkdir -m 700 "$GNUPGHOME"
gpg --batch --quiet --passphrase '' --quick-generate-key 'backup-test <backup@example.test>' rsa2048 encr never 2>/dev/null
fingerprint="$(gpg --batch --with-colons --list-keys backup@example.test | awk -F: '/^fpr:/ {print $10; exit}')"
check "a test key exists" test -n "$fingerprint"

echo "backup-dump.sh (stubbed pg_dump and S3, real gpg)"
printf 'fake ca\n' >"$tmp/ca.pem"
run_backup() { # run_backup <today>
    FAKE_S3_ROOT="$tmp/s3" PATH="$tmp/bin:$PATH" \
        RINQUO_BACKUP_ENV_FILE=/nonexistent PG_DUMP="$tmp/bin/fake-pg-dump" AWS="$tmp/bin/aws" \
        PGHOST=db.example PGDATABASE=rinquo PGUSER=backup PGPASSWORD=never-printed PGSSLMODE=verify-full PGSSLROOTCERT="$tmp/ca.pem" \
        RINQUO_BACKUP_GPG_RECIPIENT="$fingerprint" RINQUO_BACKUP_BUCKET=bk RINQUO_BACKUP_ENDPOINT=https://s3.example \
        RINQUO_BACKUP_PREFIX=production AWS_ACCESS_KEY_ID=ak AWS_SECRET_ACCESS_KEY=never-printed-secret \
        RINQUO_BACKUP_TODAY="$1" "$ops/backup-dump.sh"
}
run_backup 2026-10-05 >"$tmp/backup.out" 2>&1
check "backup exits successfully" test $? -eq 0
dump="$(find "$tmp/s3" -name '*.dump.gpg' | head -n1)"
check "an encrypted dump was uploaded" test -s "$dump"
check "a checksum was uploaded" test -s "$dump.sha256"
check "a manifest was uploaded" test -s "$dump.manifest.json"
check "the checksum matches the object" bash -c "cd '$(dirname "$dump")' && sha256sum -c '$(basename "$dump").sha256'"
check "the dump decrypts to the dump bytes" bash -c "gpg --batch --quiet --decrypt '$dump' | grep -q PGDMP-fake-archive-rinquo"
check "the object is not plaintext" bash -c "! grep -q PGDMP '$dump'"
check "the manifest carries no credentials" bash -c "! grep -qi 'never-printed' '$dump.manifest.json'"
check "no secret was printed" bash -c "! grep -q 'never-printed' '$tmp/backup.out'"
check "a mid-month run keeps no monthly copy" bash -c "[ -z \"\$(find '$tmp/s3' -path '*monthly*' -type f)\" ]"
run_backup 2026-10-31 >/dev/null 2>&1
check "a month-end run also keeps a monthly copy" bash -c "[ -n \"\$(find '$tmp/s3' -path '*monthly/rinquo-202610.dump.gpg' -type f)\" ]"
check_fails "backup refuses a non verify-full connection" env PGSSLMODE=require bash -c "FAKE_S3_ROOT='$tmp/s3' PG_DUMP='$tmp/bin/fake-pg-dump' AWS='$tmp/bin/aws' PGHOST=h PGDATABASE=d PGUSER=u PGPASSWORD=p PGSSLROOTCERT='$tmp/ca.pem' RINQUO_BACKUP_GPG_RECIPIENT=$fingerprint RINQUO_BACKUP_BUCKET=b RINQUO_BACKUP_ENDPOINT=e RINQUO_BACKUP_PREFIX=p AWS_ACCESS_KEY_ID=a AWS_SECRET_ACCESS_KEY=s RINQUO_BACKUP_ENV_FILE=/nonexistent '$ops/backup-dump.sh'"
check_fails "backup refuses when configuration is missing" env -i PATH="$PATH" RINQUO_BACKUP_ENV_FILE=/nonexistent "$ops/backup-dump.sh"

echo "prune-backups.sh (fake S3)"
old="$tmp/s3/bk/production/daily/2026/rinquo-20260701T030000Z.dump.gpg"
mkdir -p "$(dirname "$old")" && : >"$old"
run_prune() {
    FAKE_S3_ROOT="$tmp/s3" PATH="$tmp/bin:$PATH" RINQUO_PRUNE_ENV_FILE=/nonexistent AWS="$tmp/bin/aws" \
        RINQUO_BACKUP_BUCKET=bk RINQUO_BACKUP_ENDPOINT=https://s3.example RINQUO_BACKUP_PREFIX=production \
        AWS_ACCESS_KEY_ID=ak AWS_SECRET_ACCESS_KEY=sk RINQUO_TODAY=2026-10-06 "$ops/prune-backups.sh" "$@"
}
run_prune --dry-run >/dev/null 2>&1
check "a dry run deletes nothing" test -e "$old"
run_prune >/dev/null 2>&1
check "an expired daily object is deleted" test ! -e "$old"
check "a current daily object is kept" bash -c "[ -n \"\$(find '$tmp/s3' -name 'rinquo-20261005T*.dump.gpg' -type f)\" ]"

echo "restore-drill.sh isolation guards"
drill() { # drill <extra env...> -- <args...>
    env -i PATH="$PATH" RINQUO_DRILL_TICKET=OPS-1 RINQUO_DRILL_OPERATOR=ops@example.test RINQUO_DRILL_PGHOST="${DRILL_HOST:-clone.example}" \
        RINQUO_DRILL_PGUSER=u RINQUO_DRILL_PGPASSWORD=never-printed RINQUO_DRILL_PGDATABASE=restore_drill \
        RINQUO_DRILL_PGSSLROOTCERT="$tmp/ca.pem" RINQUO_PRODUCTION_PGHOST=prod.example "$@"
}
check_fails "a drill against the production host is refused" drill DRILL_HOST=prod.example RINQUO_DRILL_PGHOST=prod.example "$ops/restore-drill.sh" --mode pitr
check_fails "production host match is case-insensitive" drill RINQUO_DRILL_PGHOST=PROD.EXAMPLE "$ops/restore-drill.sh" --mode pitr
check_fails "cutover needs an incident commander and approver" drill RINQUO_DRILL_PGHOST=prod.example "$ops/restore-drill.sh" --mode pitr --cutover
check_fails "cutover needs two different people" drill RINQUO_DRILL_PGHOST=prod.example RINQUO_CUTOVER_INCIDENT_COMMANDER=a RINQUO_CUTOVER_APPROVER=a "$ops/restore-drill.sh" --mode pitr --cutover
check_fails "cutover flag on a non-production target is refused" drill "$ops/restore-drill.sh" --mode pitr --cutover
check_fails "pitr mode needs the target time" drill "$ops/restore-drill.sh" --mode pitr
check_fails "dump mode needs a dump file" drill "$ops/restore-drill.sh" --mode dump
check_fails "an unknown mode is refused" drill "$ops/restore-drill.sh" --mode overwrite
check_fails "a bad target database name is refused" drill RINQUO_DRILL_PGDATABASE='x;drop' "$ops/restore-drill.sh" --mode pitr
printf 'tampered' >"$tmp/bad.dump.gpg"
printf '%064d  bad.dump.gpg\n' 0 >"$tmp/bad.dump.gpg.sha256"
check_fails "a checksum mismatch stops the drill before restoring" drill PSQL=true PG_RESTORE=true CREATEDB=true "$ops/restore-drill.sh" --mode dump --dump "$tmp/bad.dump.gpg"

if [[ "${OPS_TEST_INTEGRATION:-0}" == "1" ]]; then
    echo "integration: real restore into a throwaway TLS PostgreSQL 17 (verify-full)"
    # shellcheck source=integration.sh
    source "$here/integration.sh"
fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
((fail == 0))
