package people

import (
	"context"
	"mining-app/backend/internal/db"
	"mining-app/backend/internal/shared/ids"
	"time"
)

type service struct{ repo Repository }

func NewService(repo Repository) Service { return &service{repo: repo} }
func (s *service) List(ctx context.Context) ([]PersonDTO, error) {
	rows, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]PersonDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, mapPerson(r))
	}
	return out, nil
}
func (s *service) Create(ctx context.Context, req CreatePersonRequest) (*PersonDTO, error) {
	now := time.Now().UTC()
	row := &db.Person{BaseModel: db.BaseModel{ID: ids.New(), CreatedAt: now, UpdatedAt: now}, Name: req.Name, Address: req.Address, Phone: req.Phone, Email: req.Email, CPF: req.CPF, BankData: req.BankData, PIXKey: req.PIXKey, StatusID: req.StatusID, Notes: req.Notes}
	if err := s.repo.Create(ctx, row); err != nil {
		return nil, err
	}
	dto := mapPerson(*row)
	return &dto, nil
}
func (s *service) GetByID(ctx context.Context, id string) (*PersonDTO, error) {
	row, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	dto := mapPerson(*row)
	return &dto, nil
}
func mapPerson(p db.Person) PersonDTO {
	return PersonDTO{ID: p.ID, Name: p.Name, Address: p.Address, Phone: p.Phone, Email: p.Email, CPF: p.CPF, BankData: p.BankData, PIXKey: p.PIXKey, StatusID: p.StatusID, Notes: p.Notes}
}
