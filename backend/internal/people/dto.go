package people

type PersonDTO struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Address  string  `json:"address,omitempty"`
	Phone    *string `json:"phone,omitempty"`
	Email    *string `json:"email,omitempty"`
	CPF      *string `json:"cpf,omitempty"`
	BankData string  `json:"bankData,omitempty"`
	PIXKey   *string `json:"pixKey,omitempty"`
	StatusID string  `json:"statusId"`
	Notes    string  `json:"notes,omitempty"`
}
type CreatePersonRequest struct {
	Name     string  `json:"name"`
	Address  string  `json:"address,omitempty"`
	Phone    *string `json:"phone,omitempty"`
	Email    *string `json:"email,omitempty"`
	CPF      *string `json:"cpf,omitempty"`
	BankData string  `json:"bankData,omitempty"`
	PIXKey   *string `json:"pixKey,omitempty"`
	StatusID string  `json:"statusId"`
	Notes    string  `json:"notes,omitempty"`
}
