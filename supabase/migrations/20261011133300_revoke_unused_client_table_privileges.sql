-- Remove client-side table privileges that are not part of the RPC-only app contract.
-- Current and future postgres-owned public tables should not grant these DDL/maintenance
-- capabilities to anon/authenticated. Preserve all other privileges and service_role grants.
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES
  FROM anon, authenticated;

-- MAINTAIN is available on PostgreSQL 17+. Use dynamic SQL so this migration remains
-- parseable on local PostgreSQL 16 CI runners while removing the privilege on PG17+.
DO $revoke_maintain$
BEGIN
  IF current_setting('server_version_num')::integer >= 170000 THEN
    EXECUTE 'REVOKE MAINTAIN ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE MAINTAIN ON TABLES FROM anon, authenticated';
  END IF;
END
$revoke_maintain$;

NOTIFY pgrst, 'reload schema';
