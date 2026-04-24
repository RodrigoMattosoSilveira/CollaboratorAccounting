package referencedata

import (
	"context"
	"mining-app/backend/internal/db"
)

type Repository interface {
	ListByType(ctx context.Context, typ string) ([]db.ReferenceData, error)
	Create(ctx context.Context, item *db.ReferenceData) error
}
