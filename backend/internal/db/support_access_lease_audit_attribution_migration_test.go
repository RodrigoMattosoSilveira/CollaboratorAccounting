package db_test

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	dbpkg "enterpriseremotesystems/backend/internal/db"
)

func TestSupportAccessLeaseAuditAttributionMigrationAddsAndRemovesColumn(t *testing.T) {
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
INSERT INTO authz_audit_logs(id, occurred_at, operation, target_type, target_id, decision, created_at)
VALUES ('historical', CURRENT_TIMESTAMP, 'support_access_leases.request', 'tenant_support_access_lease', 'lease-old', 'AUTHORIZED', CURRENT_TIMESTAMP);
`); err != nil {
		t.Fatalf("create pre-30I.3 audit schema: %v", err)
	}

	applySupportAccessAuditMigrationFile(t, sqlDB, "000066_support_access_lease_audit_attribution.up.sql")

	var supportLeaseID sql.NullString
	if err := sqlDB.QueryRow(`SELECT support_lease_id FROM authz_audit_logs WHERE id='historical'`).Scan(&supportLeaseID); err != nil {
		t.Fatalf("read historical row after migration: %v", err)
	}
	if supportLeaseID.Valid {
		t.Fatalf("historical immutable row should remain NULL, got %q", supportLeaseID.String)
	}
	if _, err := sqlDB.Exec(`
INSERT INTO authz_audit_logs(id, occurred_at, support_lease_id, operation, decision, created_at)
VALUES ('new', CURRENT_TIMESTAMP, 'lease-new', 'support_access.use', 'AUTHORIZED', CURRENT_TIMESTAMP)
`); err != nil {
		t.Fatalf("insert support-attributed audit row: %v", err)
	}
	var indexCount int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_authz_audit_logs_support_lease_id'`).Scan(&indexCount); err != nil {
		t.Fatalf("count support lease audit index: %v", err)
	}
	if indexCount != 1 {
		t.Fatalf("expected support lease audit index, got %d", indexCount)
	}

	applySupportAccessAuditMigrationFile(t, sqlDB, "000066_support_access_lease_audit_attribution.down.sql")

	rows, err := sqlDB.Query(`PRAGMA table_info(authz_audit_logs)`)
	if err != nil {
		t.Fatalf("inspect audit schema after down migration: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, columnType string
		var notNull, pk int
		var defaultValue any
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &pk); err != nil {
			t.Fatalf("scan audit column: %v", err)
		}
		if name == "support_lease_id" {
			t.Fatal("support_lease_id should be removed by down migration")
		}
	}
}

func applySupportAccessAuditMigrationFile(t *testing.T, sqlDB *sql.DB, name string) {
	t.Helper()
	contents, err := os.ReadFile(filepath.Join("..", "..", "migrations", name))
	if err != nil {
		t.Fatalf("read migration %s: %v", name, err)
	}
	if _, err := sqlDB.Exec(string(contents)); err != nil {
		t.Fatalf("apply migration %s: %v", name, err)
	}
}
