package routes

import "github.com/gofiber/fiber/v3"

func RegisterPeopleRoutes(v1 fiber.Router, deps Dependencies) {
	r := v1.Group("/people")
	r.Get("/", deps.PeopleHandler.List)
	r.Post("/", deps.PeopleHandler.Create)
	r.Get("/:id", deps.PeopleHandler.GetByID)
	r.Put("/:id", deps.PeopleHandler.Update)
}
