package people

import (
	"errors"
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
	"mining-app/backend/internal/shared/httpx"
)

type Handler struct{ service Service }

func NewHandler(service Service) *Handler { return &Handler{service: service} }
func (h *Handler) List(c fiber.Ctx) error {
	rows, err := h.service.List(c.Context())
	if err != nil {
		return httpx.ServerError(c, err)
	}
	return httpx.OK(c, rows)
}
func (h *Handler) Create(c fiber.Ctx) error {
	var req CreatePersonRequest
	if err := c.Bind().Body(&req); err != nil {
		return httpx.BadRequest(c, "invalid_body", "Invalid request body")
	}
	row, err := h.service.Create(c.Context(), req)
	if err != nil {
		return httpx.ServerError(c, err)
	}
	return httpx.Created(c, row)
}
func (h *Handler) GetByID(c fiber.Ctx) error {
	row, err := h.service.GetByID(c.Context(), c.Params("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return httpx.NotFound(c, "Person not found")
		}
		return httpx.ServerError(c, err)
	}
	return httpx.OK(c, row)
}
