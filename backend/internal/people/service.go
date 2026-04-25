package people

import "context"

type Service interface {
	List(ctx context.Context) ([]PersonDTO, error)
	Create(ctx context.Context, req CreatePersonRequest) (*PersonDTO, error)
	GetByID(ctx context.Context, id string) (*PersonDTO, error)
}
