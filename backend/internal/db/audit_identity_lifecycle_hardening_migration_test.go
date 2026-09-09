package db_test

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	dbpkg "enterpriseremotesystems/backend/internal/db"
)

func TestAuditIdentityLifecycleHardeningMigrationPreservesHistoryAndRequiresNewIdentityEvidence(t *testing.T) {
	database, err := dbpkg.Open(filepath.Join(t.TempDir(), "app.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	sqlDB, err := database.DB()
	if err != nil {
		t.Fatalf("access SQL database: %v", err)
	}
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`
CREATE TABLE authz_audit_logs (
  id TEXT PRIMARY KEY,
  occurred_at DATETIME NOT NULL,
  actor_id TEXT,
  actor_record_id TEXT,
  tenant_id TEXT,
  permission_code TEXT,
  support_lease_id TEXT,
  operation TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  decision TEXT NOT NULL,
  reason TEXT,
  metadata_json TEXT,
  request_method TEXT,
  request_path TEXT,
  created_at DATETIME NOT NULL
);
CREATE TRIGGER trg_authz_audit_logs_no_update
BEFORE UPDATE ON authz_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'authz_audit_logs are immutable; append a new audit event instead');
END;
CREATE TRIGGER trg_authz_audit_logs_no_delete
BEFORE DELETE ON authz_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'authz_audit_logs are immutable; append a new audit event instead');
END;
INSERT INTO authz_audit_logs(
  id, occurred_at, actor_id, actor_record_id, tenant_id, permission_code,
  operation, target_type, target_id, decision, created_at
) VALUES (
  'historical', CURRENT_TIMESTAMP, 'bootstrap-admin', 'actor-bootstrap-admin', '*',
  'authz.manage', 'authz.actors.create', 'authz_actor', 'actor-old', 'AUTHORIZED', CURRENT_TIMESTAMP
);
`); err != nil {
		t.Fatalf("create pre-30J audit schema: %v", err)
	}

	applyAuditIdentityLifecycleMigrationFile(t, sqlDB, "000067_audit_identity_lifecycle_hardening.up.sql")

	var accountID, actorScope, personID, membershipID, sessionID, correlationID, authorizationSource sql.NullString
	if err := sqlDB.QueryRow(`
SELECT account_id, actor_scope, person_id, membership_id, session_id, correlation_id, authorization_source
FROM authz_audit_logs WHERE id = 'historical'
`).Scan(&accountID, &actorScope, &personID, &membershipID, &sessionID, &correlationID, &authorizationSource); err != nil {
		t.Fatalf("read historical row after migration: %v", err)
	}
	for field, value := range map[string]sql.NullString{
		"account_id": accountID, "actor_scope": actorScope, "person_id": personID,
		"membership_id": membershipID, "session_id": sessionID,
		"correlation_id": correlationID, "authorization_source": authorizationSource,
	} {
		if value.Valid {
			t.Fatalf("historical immutable %s must remain NULL, got %q", field, value.String)
		}
	}

	if _, err := sqlDB.Exec(`
INSERT INTO authz_audit_logs(id, occurred_at, operation, decision, created_at)
VALUES ('missing-correlation', CURRENT_TIMESTAMP, 'test', 'AUTHORIZED', CURRENT_TIMESTAMP)
`); err == nil || !strings.Contains(err.Error(), "authz_audit_identity_required") {
		t.Fatalf("expected missing correlation identity to be rejected, got %v", err)
	}

	if _, err := sqlDB.Exec(`
INSERT INTO authz_audit_logs(
  id, occurred_at, actor_record_id, correlation_id, operation, decision, created_at
) VALUES (
  'missing-scope', CURRENT_TIMESTAMP, 'actor-1', 'correlation-1', 'test', 'AUTHORIZED', CURRENT_TIMESTAMP
)
`); err == nil || !strings.Contains(err.Error(), "authz_audit_identity_required") {
		t.Fatalf("expected persisted Actor without scope to be rejected, got %v", err)
	}

	if _, err := sqlDB.Exec(`
INSERT INTO authz_audit_logs(
  id, occurred_at, correlation_id, operation, decision, created_at
) VALUES (
  'missing-source', CURRENT_TIMESTAMP, 'correlation-source-missing', 'test', 'AUTHORIZED', CURRENT_TIMESTAMP
)
`); err == nil || !strings.Contains(err.Error(), "authz_audit_identity_required") {
		t.Fatalf("expected missing authorization source to be rejected, got %v", err)
	}

	if _, err := sqlDB.Exec(`
INSERT INTO authz_audit_logs(
  id, occurred_at, correlation_id, authorization_source, operation, decision, created_at
) VALUES (
  'invalid-source', CURRENT_TIMESTAMP, 'correlation-source-invalid', 'UNKNOWN', 'test', 'AUTHORIZED', CURRENT_TIMESTAMP
)
`); err == nil || !strings.Contains(err.Error(), "authz_audit_identity_required") {
		t.Fatalf("expected invalid authorization source to be rejected, got %v", err)
	}

	if _, err := sqlDB.Exec(`
INSERT INTO authz_audit_logs(
  id, occurred_at, account_id, actor_id, actor_record_id, actor_scope,
  person_id, membership_id, tenant_id, session_id, correlation_id,
  permission_code, authorization_source, authorization_source_id,
  authorization_role_code, operation, decision, created_at
) VALUES (
  'new', CURRENT_TIMESTAMP, 'account-1', 'tenant-admin@example.test', 'actor-1', 'TENANT',
  'person-1', 'membership-1', 'tenant-a', 'session-1', 'correlation-1',
  'people.update', 'ROLE_GRANT', 'grant-1', 'TENANT_ADMIN',
  'people.memberships.status_change', 'AUTHORIZED', CURRENT_TIMESTAMP
)
`); err != nil {
		t.Fatalf("insert fully attributed post-30J audit row: %v", err)
	}

	if _, err := sqlDB.Exec(`UPDATE authz_audit_logs SET decision='DENIED' WHERE id='historical'`); err == nil || !strings.Contains(err.Error(), "immutable") {
		t.Fatalf("expected historical update to remain blocked, got %v", err)
	}
	if _, err := sqlDB.Exec(`DELETE FROM authz_audit_logs WHERE id='historical'`); err == nil || !strings.Contains(err.Error(), "immutable") {
		t.Fatalf("expected historical delete to remain blocked, got %v", err)
	}

	for _, name := range []string{
		"idx_authz_audit_logs_account_id",
		"idx_authz_audit_logs_session_id",
		"idx_authz_audit_logs_correlation_id",
		"idx_authz_audit_logs_authorization_source",
	} {
		var count int
		if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name=?`, name).Scan(&count); err != nil {
			t.Fatalf("count index %s: %v", name, err)
		}
		if count != 1 {
			t.Fatalf("expected index %s, got count %d", name, count)
		}
	}

	applyAuditIdentityLifecycleMigrationFile(t, sqlDB, "000067_audit_identity_lifecycle_hardening.down.sql")

	var identityTriggerCount int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name='trg_authz_audit_identity_required_insert'`).Scan(&identityTriggerCount); err != nil {
		t.Fatalf("count identity trigger after down migration: %v", err)
	}
	if identityTriggerCount != 0 {
		t.Fatalf("expected identity insert trigger removed by down migration, got %d", identityTriggerCount)
	}

	for _, name := range []string{"trg_authz_audit_logs_no_update", "trg_authz_audit_logs_no_delete"} {
		var count int
		if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name=?`, name).Scan(&count); err != nil {
			t.Fatalf("count immutable trigger %s: %v", name, err)
		}
		if count != 1 {
			t.Fatalf("pre-existing immutable trigger %s must survive down migration", name)
		}
	}
}

func applyAuditIdentityLifecycleMigrationFile(t *testing.T, sqlDB *sql.DB, name string) {
	t.Helper()
	contents, err := os.ReadFile(filepath.Join("..", "..", "migrations", name))
	if err != nil {
		t.Fatalf("read migration %s: %v", name, err)
	}
	if _, err := sqlDB.Exec(string(contents)); err != nil {
		t.Fatalf("apply migration %s: %v", name, err)
	}
}
