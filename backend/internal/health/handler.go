package health

import (
	"github.com/gofiber/fiber/v3"
	"time"
)

type Handler struct{}

func NewHandler() *Handler { return &Handler{} }

type Response struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
}

func (h *Handler) Healthz(c fiber.Ctx) error {
	return c.JSON(Response{Status: "ok", Timestamp: time.Now().UTC().Format(time.RFC3339)})
}
