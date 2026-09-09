package authz

import (
	"context"
	"strings"
)

type authorizationAuditContextKey struct{}

type AuthorizationAuditContext struct {
	Actor         *Actor
	CorrelationID string
}

// WithAuthorizationAuditContext carries the already-resolved effective Actor
// and server-generated request correlation identity into service-layer audit
// writers. It does not participate in authorization decisions; request
// authorization remains authoritative in the HTTP middleware/handler layer.
func WithAuthorizationAuditContext(ctx context.Context, actor *Actor, correlationID string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, authorizationAuditContextKey{}, AuthorizationAuditContext{
		Actor:         actor,
		CorrelationID: strings.TrimSpace(correlationID),
	})
}

func AuthorizationAuditContextFrom(ctx context.Context) AuthorizationAuditContext {
	if ctx == nil {
		return AuthorizationAuditContext{}
	}
	value, _ := ctx.Value(authorizationAuditContextKey{}).(AuthorizationAuditContext)
	return value
}
