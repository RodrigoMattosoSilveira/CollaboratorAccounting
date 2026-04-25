package people

import (
	"context"
	"gorm.io/gorm"
	"mining-app/backend/internal/db"
)

type gormRepository struct{ database *gorm.DB }

func NewGormRepository(database *gorm.DB) Repository { return &gormRepository{database: database} }
func (r *gormRepository) List(ctx context.Context) ([]db.Person, error) {
	var rows []db.Person
	err := r.database.WithContext(ctx).Order("name asc").Find(&rows).Error
	return rows, err
}
func (r *gormRepository) Create(ctx context.Context, person *db.Person) error {
	return r.database.WithContext(ctx).Create(person).Error
}
func (r *gormRepository) FindByID(ctx context.Context, id string) (*db.Person, error) {
	var row db.Person
	err := r.database.WithContext(ctx).First(&row, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}
