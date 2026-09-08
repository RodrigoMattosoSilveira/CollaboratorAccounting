package main

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"enterpriseremotesystems/backend/internal/authentication"
	"enterpriseremotesystems/backend/internal/authz"
	dbpkg "enterpriseremotesystems/backend/internal/db"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func TestEnsureE2ETenantFixturesSurvivesAccountActorFoundationAndIsIdempotent(t *testing.T) {
	database, err := dbpkg.Open(filepath.Join(t.TempDir(), "app.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := dbpkg.AutoMigrate(database); err != nil {
		t.Fatalf("migrate core database: %v", err)
	}
	if err := authz.AutoMigrate(database); err != nil {
		t.Fatalf("migrate authorization database: %v", err)
	}
	if err := authentication.AutoMigrate(database); err != nil {
		t.Fatalf("migrate authentication database: %v", err)
	}
	if err := dbpkg.SeedReferenceData(database); err != nil {
		t.Fatalf("seed reference data: %v", err)
	}
	if err := authz.SeedAuthorizationCatalog(database); err != nil {
		t.Fatalf("seed authorization catalog: %v", err)
	}

	ctx := context.Background()
	const password = "e2e-tenant-admin-password"
	if err := ensureE2ETenantFixtures(ctx, database, password, bcrypt.MinCost); err != nil {
		t.Fatalf("provision E2E Tenant fixtures: %v", err)
	}
	if err := authentication.EnsureAccountActorFoundation(database); err != nil {
		t.Fatalf("repair Account/Actor foundation after first provisioning: %v", err)
	}
	if err := ensureE2ETenantFixtures(ctx, database, password, bcrypt.MinCost); err != nil {
		t.Fatalf("re-provision E2E Tenant fixtures: %v", err)
	}
	if err := authentication.EnsureAccountActorFoundation(database); err != nil {
		t.Fatalf("repair Account/Actor foundation after second provisioning: %v", err)
	}

	const stem = "e2e-default-tenant-admin"
	legacyPersonID := stem + "-legacy-person"
	membershipID := stem + "-membership"
	actorID := stem + "-actor"
	accountID := stem + "-account"

	var membership dbpkg.PersonTenantMembership
	if err := database.First(&membership, "id = ?", membershipID).Error; err != nil {
		t.Fatalf("find E2E Tenant Administrator Membership: %v", err)
	}
	if membership.LegacyPersonID == nil || *membership.LegacyPersonID != legacyPersonID {
		t.Fatalf("expected Membership legacy Person %q, got %#v", legacyPersonID, membership.LegacyPersonID)
	}

	var actor authz.AuthzActor
	if err := database.First(&actor, "id = ?", actorID).Error; err != nil {
		t.Fatalf("find E2E Tenant Administrator Actor: %v", err)
	}
	if actor.PersonID == nil || *actor.PersonID != legacyPersonID {
		t.Fatalf("expected legacy actor Person projection %q, got %#v", legacyPersonID, actor.PersonID)
	}

	var binding authentication.AccountActor
	if err := database.First(&binding, "actor_id = ?", actorID).Error; err != nil {
		t.Fatalf("find E2E Tenant Administrator Account/Actor binding: %v", err)
	}
	if binding.AccountID != accountID {
		t.Fatalf("expected Account/Actor binding account %q, got %q", accountID, binding.AccountID)
	}
	if binding.TenantID == nil || *binding.TenantID != dbpkg.DefaultTenantID {
		t.Fatalf("expected Account/Actor binding tenant %q, got %#v", dbpkg.DefaultTenantID, binding.TenantID)
	}
	if binding.MembershipID == nil || *binding.MembershipID != membershipID {
		t.Fatalf("expected Account/Actor binding Membership %q, got %#v", membershipID, binding.MembershipID)
	}
}

func TestEnsureE2ESupportAccessLeaseFixturesCreatesExpiredPendingLeaseWithoutIdentityMutation(t *testing.T) {
	database, err := dbpkg.Open(filepath.Join(t.TempDir(), "app.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := dbpkg.AutoMigrate(database); err != nil {
		t.Fatalf("migrate core database: %v", err)
	}
	if err := authz.AutoMigrate(database); err != nil {
		t.Fatalf("migrate authorization database: %v", err)
	}
	if err := authentication.AutoMigrate(database); err != nil {
		t.Fatalf("migrate authentication database: %v", err)
	}
	if err := dbpkg.SeedReferenceData(database); err != nil {
		t.Fatalf("seed reference data: %v", err)
	}
	if err := authz.SeedAuthorizationCatalog(database); err != nil {
		t.Fatalf("seed authorization catalog: %v", err)
	}

	ctx := context.Background()
	const password = "e2e-support-access-password"
	applicationAdmin, err := authentication.ProvisionApplicationAdmin(ctx, database, authentication.ProvisionApplicationAdminConfig{
		ActorKey:         "e2e-application-admin",
		DisplayName:      "E2E Application Administrator",
		Login:            "admin@example.com",
		Password:         password,
		PasswordHashCost: bcrypt.MinCost,
	})
	if err != nil {
		t.Fatalf("provision E2E Application Administrator: %v", err)
	}
	if err := ensureE2ETenantFixtures(ctx, database, password, bcrypt.MinCost); err != nil {
		t.Fatalf("provision E2E Tenant fixtures: %v", err)
	}

	identityCountsBefore := countSupportFixtureIdentityRows(t, database)
	if err := ensureE2ESupportAccessLeaseFixtures(ctx, database, applicationAdmin.ActorID); err != nil {
		t.Fatalf("provision E2E support-access fixtures: %v", err)
	}
	if err := ensureE2ESupportAccessLeaseFixtures(ctx, database, applicationAdmin.ActorID); err != nil {
		t.Fatalf("re-provision E2E support-access fixtures: %v", err)
	}
	identityCountsAfter := countSupportFixtureIdentityRows(t, database)
	if identityCountsAfter != identityCountsBefore {
		t.Fatalf("support-access fixture must not mutate permanent identity: before=%v after=%v", identityCountsBefore, identityCountsAfter)
	}

	var lease authz.TenantSupportAccessLease
	if err := database.First(&lease, "id = ?", e2eExpiredPendingSupportLeaseID).Error; err != nil {
		t.Fatalf("find expired PENDING support lease fixture: %v", err)
	}
	if lease.TenantID != e2eSupportLeaseExpiredTenantID || lease.ApplicationActorID != applicationAdmin.ActorID || lease.RequestedByActorID != applicationAdmin.ActorID {
		t.Fatalf("unexpected expired support lease identity: %#v", lease)
	}
	if lease.Status != authz.SupportAccessLeaseStatusPending || !lease.ExpiresAt.Before(time.Now().UTC()) {
		t.Fatalf("expected persisted PENDING lease with past expiration, got status=%s expiresAt=%s", lease.Status, lease.ExpiresAt)
	}

	var permission authz.TenantSupportAccessLeasePermission
	if err := database.First(&permission, "lease_id = ? AND permission_code = ?", lease.ID, string(authz.PermissionPeopleRead)).Error; err != nil {
		t.Fatalf("find expired support lease permission: %v", err)
	}
	var event authz.TenantSupportAccessLeaseEvent
	if err := database.First(&event, "id = ?", e2eExpiredPendingSupportLeaseEventID).Error; err != nil {
		t.Fatalf("find expired support lease request event: %v", err)
	}
	if event.LeaseID != lease.ID || event.EventType != authz.SupportAccessLeaseEventRequested || event.ActorID != applicationAdmin.ActorID {
		t.Fatalf("unexpected expired support lease event: %#v", event)
	}

	store := authz.NewGORMStore(database)
	actor, err := store.FindAccountActor(ctx, applicationAdmin.AccountID, authz.GlobalTenantScope)
	if err != nil {
		t.Fatalf("resolve E2E Application Administrator: %v", err)
	}
	expired, err := store.ListSupportAccessLeases(ctx, actor, authz.SupportAccessLeaseFilter{TenantID: e2eSupportLeaseExpiredTenantID, Status: authz.SupportAccessLeaseStatusExpired})
	if err != nil {
		t.Fatalf("list expired support leases: %v", err)
	}
	if len(expired) != 1 || expired[0].ID != lease.ID || expired[0].Status != authz.SupportAccessLeaseStatusPending || expired[0].EffectiveStatus != authz.SupportAccessLeaseStatusExpired {
		t.Fatalf("expected one effectively EXPIRED persisted-PENDING fixture, got %#v", expired)
	}
	pending, err := store.ListSupportAccessLeases(ctx, actor, authz.SupportAccessLeaseFilter{TenantID: e2eSupportLeaseExpiredTenantID, Status: authz.SupportAccessLeaseStatusPending})
	if err != nil {
		t.Fatalf("list pending support leases: %v", err)
	}
	if len(pending) != 0 {
		t.Fatalf("expired PENDING fixture must not appear in PENDING filter: %#v", pending)
	}
}

type supportFixtureIdentityCounts struct {
	Actors       int64
	AccountActor int64
	Memberships  int64
	RoleGrants   int64
}

func countSupportFixtureIdentityRows(t *testing.T, database *gorm.DB) supportFixtureIdentityCounts {
	t.Helper()
	var counts supportFixtureIdentityCounts
	if err := database.Model(&authz.AuthzActor{}).Count(&counts.Actors).Error; err != nil {
		t.Fatalf("count authorization Actors: %v", err)
	}
	if err := database.Model(&authentication.AccountActor{}).Count(&counts.AccountActor).Error; err != nil {
		t.Fatalf("count Account/Actor bindings: %v", err)
	}
	if err := database.Model(&dbpkg.PersonTenantMembership{}).Count(&counts.Memberships).Error; err != nil {
		t.Fatalf("count Memberships: %v", err)
	}
	if err := database.Model(&authz.AuthzActorRoleGrant{}).Count(&counts.RoleGrants).Error; err != nil {
		t.Fatalf("count Role Grants: %v", err)
	}
	return counts
}
