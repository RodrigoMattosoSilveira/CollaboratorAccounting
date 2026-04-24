package people

import (
	"context"
	"mining-app/backend/internal/db"
)

type Repository interface {
	List(ctx context.Context) ([]db.Person, error)
	Create(ctx context.Context, person *db.Person) error
	FindByID(ctx context.Context, id string) (*db.Person, error)
}
