-- Bite 30J — Audit Identity and Lifecycle Hardening
--
-- Historical audit rows remain immutable. The new columns are nullable so
-- pre-30J evidence is preserved exactly as written; all new runtime audit rows
-- populate the complete effective identity/authorization chain where
-- applicable.
ALTER TABLE authz_audit_logs ADD COLUMN account_id TEXT;
ALTER TABLE authz_audit_logs ADD COLUMN actor_scope TEXT;
ALTER TABLE authz_audit_logs ADD COLUMN person_id TEXT;
ALTER TABLE authz_audit_logs ADD COLUMN membership_id TEXT;
ALTER TABLE authz_audit_logs ADD COLUMN session_id TEXT;
ALTER TABLE authz_audit_logs ADD COLUMN correlation_id TEXT;
ALTER TABLE authz_audit_logs ADD COLUMN authorization_source TEXT;
ALTER TABLE authz_audit_logs ADD COLUMN authorization_source_id TEXT;
ALTER TABLE authz_audit_logs ADD COLUMN authorization_role_code TEXT;

CREATE INDEX IF NOT EXISTS idx_authz_audit_logs_account_id
  ON authz_audit_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_authz_audit_logs_session_id
  ON authz_audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_authz_audit_logs_correlation_id
  ON authz_audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_authz_audit_logs_authorization_source
  ON authz_audit_logs(authorization_source);

-- Reassert the database-level append-only boundary as part of the hardening
-- migration. These triggers already exist on healthy pre-30J databases; IF
-- NOT EXISTS also repairs a database that has the table but lost a guard.
CREATE TRIGGER IF NOT EXISTS trg_authz_audit_logs_no_update
BEFORE UPDATE ON authz_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'authz_audit_logs are immutable; append a new audit event instead');
END;

CREATE TRIGGER IF NOT EXISTS trg_authz_audit_logs_no_delete
BEFORE DELETE ON authz_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'authz_audit_logs are immutable; append a new audit event instead');
END;

-- Every post-30J row must have a server-generated correlation identity and an
-- explicit authorization source (NONE is the canonical value when no source
-- supplied the permission). Rows written for a persisted Actor must also
-- identify its effective scope. The application layer supplies richer
-- Account/Person/Membership/Session evidence when those concepts apply.
CREATE TRIGGER IF NOT EXISTS trg_authz_audit_identity_required_insert
BEFORE INSERT ON authz_audit_logs
FOR EACH ROW
WHEN TRIM(COALESCE(NEW.correlation_id, '')) = ''
  OR UPPER(TRIM(COALESCE(NEW.authorization_source, ''))) NOT IN (
    'INTRINSIC', 'ROLE_GRANT', 'GLOBAL_CONTROL_PLANE', 'SUPPORT_LEASE', 'NONE'
  )
  OR (
    TRIM(COALESCE(NEW.actor_record_id, '')) <> ''
    AND TRIM(COALESCE(NEW.actor_scope, '')) = ''
  )
BEGIN
  SELECT RAISE(ABORT, 'authz_audit_identity_required');
END;
