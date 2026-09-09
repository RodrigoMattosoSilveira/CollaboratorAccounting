package authz

import (
	"context"
	"fmt"
	"strings"
	"time"

	"enterpriseremotesystems/backend/internal/shared/ids"
)

const (
	AuditDecisionAuthorized = "AUTHORIZED"
	AuditDecisionDenied     = "DENIED"
)

type AuditLogStore interface {
	RecordAuthorizationAudit(ctx context.Context, entry AuthorizationAuditEntry) error
}

type AuthorizationAuditEntry struct {
	Actor                 *Actor
	FallbackActorID       string
	AccountID             string
	ActorScope            ActorScope
	PersonID              string
	MembershipID          string
	TenantID              string
	SessionID             string
	CorrelationID         string
	Permission            Permission
	AuthorizationSource   AuthorizationSourceKind
	AuthorizationSourceID string
	AuthorizationRoleCode string
	SupportLeaseID        string
	Operation             string
	TargetType            string
	TargetID              string
	Decision              string
	Reason                string
	MetadataJSON          string
	RequestMethod         string
	RequestPath           string
}

func (s *GORMStore) RecordAuthorizationAudit(ctx context.Context, entry AuthorizationAuditEntry) error {
	if s == nil || s.database == nil {
		return nil
	}
	operation := strings.TrimSpace(entry.Operation)
	if operation == "" {
		operation = "unknown"
	}
	decision := strings.TrimSpace(entry.Decision)
	if decision == "" {
		decision = AuditDecisionAuthorized
	}

	actorID := strings.TrimSpace(entry.FallbackActorID)
	actorRecordID := ""
	accountID := strings.TrimSpace(entry.AccountID)
	actorScope := strings.TrimSpace(string(entry.ActorScope))
	personID := strings.TrimSpace(entry.PersonID)
	membershipID := strings.TrimSpace(entry.MembershipID)
	actorTenantID := ""
	sessionID := strings.TrimSpace(entry.SessionID)
	if entry.Actor != nil {
		if strings.TrimSpace(entry.Actor.ID) != "" {
			actorID = strings.TrimSpace(entry.Actor.ID)
		}
		actorRecordID = strings.TrimSpace(entry.Actor.RecordID)
		if accountID == "" {
			accountID = strings.TrimSpace(entry.Actor.AccountID)
		}
		if actorScope == "" {
			actorScope = strings.TrimSpace(string(entry.Actor.Scope))
		}
		if personID == "" {
			personID = strings.TrimSpace(entry.Actor.GlobalPersonID)
			if personID == "" {
				personID = strings.TrimSpace(entry.Actor.PersonID)
			}
		}
		if membershipID == "" {
			membershipID = strings.TrimSpace(entry.Actor.MembershipID)
		}
		actorTenantID = strings.TrimSpace(entry.Actor.TenantID)
		if sessionID == "" {
			sessionID = strings.TrimSpace(entry.Actor.SessionID)
		}
	}
	tenantID := strings.TrimSpace(entry.TenantID)
	if tenantID == "" {
		tenantID = actorTenantID
	}
	supportLeaseID := strings.TrimSpace(entry.SupportLeaseID)
	if supportLeaseID == "" && entry.Actor != nil {
		supportLeaseID = strings.TrimSpace(entry.Actor.SupportLeaseID)
	}

	authorizationSource := entry.AuthorizationSource
	authorizationSourceID := strings.TrimSpace(entry.AuthorizationSourceID)
	authorizationRoleCode := strings.TrimSpace(entry.AuthorizationRoleCode)
	if authorizationSource == "" {
		authorizationSource, authorizationSourceID, authorizationRoleCode = authorizationSourceForEntry(entry, supportLeaseID)
	}
	if authorizationSource == "" {
		authorizationSource = AuthorizationSourceNone
	}

	correlationID := strings.TrimSpace(entry.CorrelationID)
	if correlationID == "" {
		correlationID = ids.New()
	}

	now := time.Now().UTC()
	row := AuthzAuditLog{
		ID:                    ids.New(),
		OccurredAt:            now,
		AccountID:             accountID,
		ActorID:               actorID,
		ActorRecordID:         actorRecordID,
		ActorScope:            actorScope,
		PersonID:              personID,
		MembershipID:          membershipID,
		TenantID:              tenantID,
		SessionID:             sessionID,
		CorrelationID:         correlationID,
		PermissionCode:        string(entry.Permission),
		AuthorizationSource:   string(authorizationSource),
		AuthorizationSourceID: authorizationSourceID,
		AuthorizationRoleCode: authorizationRoleCode,
		SupportLeaseID:        supportLeaseID,
		Operation:             operation,
		TargetType:            strings.TrimSpace(entry.TargetType),
		TargetID:              strings.TrimSpace(entry.TargetID),
		Decision:              decision,
		Reason:                strings.TrimSpace(entry.Reason),
		MetadataJSON:          strings.TrimSpace(entry.MetadataJSON),
		RequestMethod:         strings.TrimSpace(entry.RequestMethod),
		RequestPath:           strings.TrimSpace(entry.RequestPath),
		CreatedAt:             now,
	}
	if err := s.database.WithContext(ctx).Create(&row).Error; err != nil {
		return fmt.Errorf("record authorization audit log: %w", err)
	}
	return nil
}

func authorizationSourceForEntry(entry AuthorizationAuditEntry, supportLeaseID string) (AuthorizationSourceKind, string, string) {
	if entry.Actor == nil {
		return AuthorizationSourceNone, "", ""
	}
	actor := entry.Actor
	if source, ok := actor.AuthorizationSources[entry.Permission]; ok {
		return source.Kind, strings.TrimSpace(source.ID), strings.TrimSpace(source.RoleCode)
	}
	if entry.Permission != "" {
		if _, ok := actor.SupportLeasePermissions[entry.Permission]; ok && strings.TrimSpace(supportLeaseID) != "" {
			return AuthorizationSourceSupportLease, strings.TrimSpace(supportLeaseID), ""
		}
		if _, ok := actor.IntrinsicPermissions[entry.Permission]; ok {
			return AuthorizationSourceIntrinsic, strings.TrimSpace(actor.MembershipID), ""
		}
		if _, ok := actor.DelegatedPermissions[entry.Permission]; ok {
			if actor.Scope == ActorScopeApplication {
				return AuthorizationSourceGlobalControlPlane, "", firstRoleCode(actor.RoleCodes)
			}
			return AuthorizationSourceRoleGrant, "", firstRoleCode(actor.RoleCodes)
		}
	}
	return AuthorizationSourceNone, "", ""
}

func firstRoleCode(roleCodes []string) string {
	if len(roleCodes) == 0 {
		return ""
	}
	return strings.TrimSpace(roleCodes[0])
}
