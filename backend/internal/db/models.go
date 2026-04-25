package db

import "time"

type BaseModel struct {
	ID        string    `gorm:"type:text;primaryKey" json:"id"`
	CreatedAt time.Time `gorm:"not null" json:"createdAt"`
	UpdatedAt time.Time `gorm:"not null" json:"updatedAt"`
}

type ReferenceData struct {
	BaseModel
	Type         string `gorm:"type:text;not null;uniqueIndex:ux_reference_type_code;index:idx_reference_type_active_sort,priority:1" json:"type"`
	Code         string `gorm:"type:text;not null;uniqueIndex:ux_reference_type_code" json:"code"`
	Label        string `gorm:"type:text;not null" json:"label"`
	Description  string `gorm:"type:text" json:"description,omitempty"`
	Active       bool   `gorm:"not null;default:true;index:idx_reference_type_active_sort,priority:2" json:"active"`
	SortOrder    int    `gorm:"not null;default:0;index:idx_reference_type_active_sort,priority:3" json:"sortOrder"`
	MetadataJSON string `gorm:"type:text" json:"metadataJson,omitempty"`
}

type Person struct {
	BaseModel
	Name                  string        `gorm:"type:text;not null;uniqueIndex" json:"name"`
	Address               string        `gorm:"type:text" json:"address,omitempty"`
	Phone                 *string       `gorm:"type:text;uniqueIndex" json:"phone,omitempty"`
	Email                 *string       `gorm:"type:text;uniqueIndex" json:"email,omitempty"`
	CPF                   *string       `gorm:"column:cpf;type:text;uniqueIndex" json:"cpf,omitempty"`
	BankData              string        `gorm:"type:text" json:"bankData,omitempty"`
	PIXKey                *string       `gorm:"column:pix_key;type:text;uniqueIndex" json:"pixKey,omitempty"`
	EmergencyContactName  string        `gorm:"type:text" json:"emergencyContactName,omitempty"`
	EmergencyContactPhone string        `gorm:"type:text" json:"emergencyContactPhone,omitempty"`
	EmergencyContactNotes string        `gorm:"type:text" json:"emergencyContactNotes,omitempty"`
	StatusID              string        `gorm:"type:text;not null;index" json:"statusId"`
	Notes                 string        `gorm:"type:text" json:"notes,omitempty"`
	Status                ReferenceData `gorm:"foreignKey:StatusID;constraint:OnUpdate:RESTRICT,OnDelete:RESTRICT;" json:"status,omitempty"`
}
