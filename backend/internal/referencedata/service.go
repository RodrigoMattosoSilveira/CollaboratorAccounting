package referencedata

import "context"

type Service interface {
	ListByType(ctx context.Context, typ string) ([]ReferenceDataDTO, error)
	Create(ctx context.Context, typ string, req CreateReferenceDataRequest) (*ReferenceDataDTO, error)
}
