package routes

import (
	"github.com/gofiber/fiber/v3"
	"mining-app/backend/internal/health"
)

func RegisterHealthRoutes(server *fiber.App) {
	h := health.NewHandler()
	server.Get("/healthz", h.Healthz)
}
