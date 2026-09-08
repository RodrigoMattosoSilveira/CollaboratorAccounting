DROP INDEX IF EXISTS idx_authz_audit_logs_support_lease_id;
ALTER TABLE authz_audit_logs DROP COLUMN support_lease_id;
