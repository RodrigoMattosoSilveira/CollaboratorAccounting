package models

type Person struct {
	BaseModel
	Name                  string                 `gorm:"type:text;not null;uniqueIndex" json:"name"`
	Address               string                 `gorm:"type:text" json:"address,omitempty"`
	Phone                 *string                `gorm:"type:text;uniqueIndex" json:"phone,omitempty"`
	Email                 *string                `gorm:"type:text;uniqueIndex" json:"email,omitempty"`
	CPF                   *string                `gorm:"column:cpf;type:text;uniqueIndex" json:"cpf,omitempty"`
	BankData              string                 `gorm:"type:text" json:"bankData,omitempty"`
	PIXKey                *string                `gorm:"column:pix_key;type:text;uniqueIndex" json:"pixKey,omitempty"`
	EmergencyContactName  string                 `gorm:"type:text" json:"emergencyContactName,omitempty"`
	EmergencyContactPhone string                 `gorm:"type:text" json:"emergencyContactPhone,omitempty"`
	EmergencyContactNotes string                 `gorm:"type:text" json:"emergencyContactNotes,omitempty"`
	StatusID              string                 `gorm:"type:text;not null;index" json:"statusId"`
	Notes                 string                 `gorm:"type:text" json:"notes,omitempty"`
	Status                ReferenceData          `gorm:"foreignKey:StatusID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"status,omitempty"`
	Journeys              []CollaboratorJourney  `gorm:"foreignKey:PersonID" json:"journeys,omitempty"`
}
