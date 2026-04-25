package routes

import (
	"gorm.io/gorm"
	"mining-app/backend/internal/people"
	"mining-app/backend/internal/referencedata"
)

type Dependencies struct {
	DB                   *gorm.DB
	PeopleHandler        *people.Handler
	ReferenceDataHandler *referencedata.Handler
}
