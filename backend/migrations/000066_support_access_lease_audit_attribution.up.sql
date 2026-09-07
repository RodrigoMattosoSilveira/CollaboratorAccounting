-- Bite 30I.3 — Support Access Lease UX / Auditability
--
-- Authorization audit rows remain append-only. New rows can identify the exact
-- Tenant Support Access Lease that supplied exceptional Tenant authority.
-- Historical 30I.2 lifecycle rows remain immutable and retain their existing
-- target_type/target_id provenance; readers may derive the lease ID from that
-- evidence when support_lease_id is NULL.
ALTER TABLE authz_audit_logs ADD COLUMN support_lease_id TEXT;

CREATE INDEX IF NOT EXISTS idx_authz_audit_logs_support_lease_id
  ON authz_audit_logs(support_lease_id);
