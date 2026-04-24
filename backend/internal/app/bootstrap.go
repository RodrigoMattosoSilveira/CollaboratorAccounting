package app

import (
	"log"

	"github.com/gofiber/fiber/v3"
	"mining-app/backend/internal/db"
	httpserver "mining-app/backend/internal/http"
	"mining-app/backend/internal/http/routes"
	"mining-app/backend/internal/people"
	"mining-app/backend/internal/referencedata"
)

func Bootstrap(cfg Config) (*fiber.App, func(), error) {
	database, err := db.Open(cfg.DBPath)
	if err != nil {
		return nil, nil, err
	}
	if err := db.AutoMigrate(database); err != nil {
		return nil, nil, err
	}

	refRepo := referencedata.NewGormRepository(database)
	refSvc := referencedata.NewService(refRepo)
	refHandler := referencedata.NewHandler(refSvc)

	peopleRepo := people.NewGormRepository(database)
	peopleSvc := people.NewService(peopleRepo)
	peopleHandler := people.NewHandler(peopleSvc)

	deps := routes.Dependencies{
		DB:                   database,
		PeopleHandler:        peopleHandler,
		ReferenceDataHandler: refHandler,
	}

	server := httpserver.NewServer(deps)
	cleanup := func() {
		sqlDB, err := database.DB()
		if err != nil {
			log.Printf("failed to access database handle during cleanup: %v", err)
			return
		}
		if err := sqlDB.Close(); err != nil {
			log.Printf("failed to close database: %v", err)
		}
	}
	return server, cleanup, nil
}
