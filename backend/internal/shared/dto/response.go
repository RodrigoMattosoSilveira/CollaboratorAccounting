package dto

type APIResponse[T any] struct {
	Data  T         `json:"data,omitempty"`
	Error *APIError `json:"error,omitempty"`
	Meta  *Meta     `json:"meta,omitempty"`
}
type APIError struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}
type Meta struct {
	Page       int   `json:"page,omitempty"`
	PageSize   int   `json:"pageSize,omitempty"`
	TotalRows  int64 `json:"totalRows,omitempty"`
	TotalPages int   `json:"totalPages,omitempty"`
}
