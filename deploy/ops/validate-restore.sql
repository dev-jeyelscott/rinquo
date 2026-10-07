-- Read-only validation of a restored Rinquo database. Run with:
--   psql -X -v ON_ERROR_STOP=1 -At -F '|' -v expected_migrations=N -f validate-restore.sql
-- Each row is: check|pass-or-fail|detail. Details are counts and names only: never row contents.
-- The whole script runs in a read-only transaction, so it cannot change the restored data.

BEGIN READ ONLY;

SELECT 'server-version', 'pass', current_setting('server_version');

SELECT 'extensions', 'pass', coalesce(string_agg(extname, ',' ORDER BY extname), 'none') FROM pg_extension;

SELECT 'migrations-recorded',
       CASE WHEN count(*) = :expected_migrations THEN 'pass' ELSE 'fail' END,
       count(*) || ' recorded, ' || :expected_migrations || ' expected'
FROM migrations;

SELECT 'constraints-validated',
       CASE WHEN count(*) = 0 THEN 'pass' ELSE 'fail' END,
       count(*) || ' unvalidated constraint(s)'
FROM pg_constraint WHERE NOT convalidated;

SELECT 'foreign-keys-present',
       CASE WHEN count(*) > 0 THEN 'pass' ELSE 'fail' END,
       count(*) || ' foreign key(s)'
FROM pg_constraint WHERE contype = 'f';

-- Tenant scope: every tenant-owned table has no row without an organization.
SELECT 'tenant-scope-' || t.table_name,
       CASE WHEN (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I where organization_id is null', t.table_schema, t.table_name), false, true, '')))[1]::text::int = 0 THEN 'pass' ELSE 'fail' END,
       'rows without organization_id'
FROM information_schema.columns t
WHERE t.column_name = 'organization_id' AND t.table_schema = 'public'
ORDER BY t.table_name;

-- Private media references are object keys, never URLs.
SELECT 'media-keys-are-not-urls',
       CASE WHEN count(*) = 0 THEN 'pass' ELSE 'fail' END,
       count(*) || ' media row(s) storing a URL'
FROM organization_media WHERE storage_key ~* '^[a-z][a-z0-9+.-]*://';

-- Append-only guarantees survived the restore.
SELECT 'platform-audit-immutable',
       CASE WHEN count(*) = 1 THEN 'pass' ELSE 'fail' END,
       count(*) || ' of 1 append-only trigger'
FROM pg_trigger WHERE tgname = 'platform_audit_events_no_change' AND NOT tgisinternal;

SELECT 'plan-terms-immutable',
       CASE WHEN count(*) = 1 THEN 'pass' ELSE 'fail' END,
       count(*) || ' of 1 immutability trigger'
FROM pg_trigger WHERE tgname = 'plan_term_versions_no_change' AND NOT tgisinternal;

-- Representative record counts (evidence only; compare with the source in the drill record).
SELECT 'count-' || c.relname, 'pass', (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I', c.relname), false, true, '')))[1]::text
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('organizations', 'users', 'organization_memberships', 'bookings', 'organization_audit_events', 'platform_admins', 'platform_audit_events', 'subscriptions', 'plan_term_versions')
ORDER BY c.relname;

COMMIT;
