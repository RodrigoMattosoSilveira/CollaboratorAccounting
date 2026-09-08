package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"enterpriseremotesystems/backend/internal/authz"
	"gorm.io/gorm"
)

const (
	e2eExpiredPendingSupportLeaseID      = "e2e-support-lease-expired-pending"
	e2eExpiredPendingSupportLeaseEventID = "e2e-support-lease-expired-pending-requested"
)

// ensureE2ESupportAccessLeaseFixtures adds only state that cannot be created
// deterministically through the public API. Normal request/approve/terminate
// E2E coverage continues to use the HTTP lifecycle itself.
func ensureE2ESupportAccessLeaseFixtures(ctx context.Context, database *gorm.DB, applicationActorID string) error {
	if database == nil {
		return fmt.Errorf("provision E2E Tenant Support Access Lease fixtures: database is required")
	}
	applicationActorID = strings.TrimSpace(applicationActorID)
	if applicationActorID == "" {
		return fmt.Errorf("provision E2E Tenant Support Access Lease fixtures: Application Administrator Actor is required")
	}

	return database.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var tenantCount int64
		if err := tx.Table("tenants").Where("id = ? AND active = ?", e2eSupportLeaseExpiredTenantID, true).Count(&tenantCount).Error; err != nil {
			return fmt.Errorf("find expired-support E2E Tenant: %w", err)
		}
		if tenantCount != 1 {
			return fmt.Errorf("expired-support E2E Tenant %s is unavailable", e2eSupportLeaseExpiredTenantID)
		}

		requestedAt := time.Date(2000, time.January, 1, 0, 0, 0, 0, time.UTC)
		expiresAt := requestedAt.Add(time.Hour)
		lease := authz.TenantSupportAccessLease{
			ID:                 e2eExpiredPendingSupportLeaseID,
			TenantID:           e2eSupportLeaseExpiredTenantID,
			ApplicationActorID: applicationActorID,
			RequestedByActorID: applicationActorID,
			RequestedAt:        requestedAt,
			ExpiresAt:          expiresAt,
			Reason:             "Deterministic expired PENDING lease for Playwright effective-status coverage",
			Status:             authz.SupportAccessLeaseStatusPending,
			CreatedAt:          requestedAt,
			UpdatedAt:          requestedAt,
		}

		var existing authz.TenantSupportAccessLease
		result := tx.Where("id = ?", lease.ID).Limit(1).Find(&existing)
		if result.Error != nil {
			return fmt.Errorf("find expired PENDING E2E support lease: %w", result.Error)
		}
		if result.RowsAffected == 0 {
			if err := tx.Create(&lease).Error; err != nil {
				return fmt.Errorf("create expired PENDING E2E support lease: %w", err)
			}
		} else if existing.TenantID != lease.TenantID || existing.ApplicationActorID != applicationActorID || existing.RequestedByActorID != applicationActorID || existing.Status != authz.SupportAccessLeaseStatusPending || !existing.ExpiresAt.Equal(expiresAt) {
			return fmt.Errorf("expired PENDING E2E support lease %s does not match the deterministic fixture", lease.ID)
		}

		permission := authz.TenantSupportAccessLeasePermission{
			LeaseID:        lease.ID,
			PermissionCode: string(authz.PermissionPeopleRead),
			CreatedAt:      requestedAt,
		}
		if err := tx.Where("lease_id = ? AND permission_code = ?", permission.LeaseID, permission.PermissionCode).FirstOrCreate(&permission).Error; err != nil {
			return fmt.Errorf("ensure expired PENDING E2E support lease permission: %w", err)
		}

		event := authz.TenantSupportAccessLeaseEvent{
			ID:           e2eExpiredPendingSupportLeaseEventID,
			LeaseID:      lease.ID,
			EventType:    authz.SupportAccessLeaseEventRequested,
			ActorID:      applicationActorID,
			OccurredAt:   requestedAt,
			MetadataJSON: `{"permissions":["people.read"],"expiresAt":"2000-01-01T01:00:00Z"}`,
			CreatedAt:    requestedAt,
		}
		if err := tx.Where("id = ?", event.ID).FirstOrCreate(&event).Error; err != nil {
			return fmt.Errorf("ensure expired PENDING E2E support lease request event: %w", err)
		}
		return nil
	})
}
