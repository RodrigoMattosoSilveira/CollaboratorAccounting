package models

import "time"

type CollaboratorJourney struct {
	BaseModel
	PersonID          string        `gorm:"type:text;not null;index" json:"personId"`
	JourneyStartDate  time.Time     `gorm:"type:date;not null" json:"journeyStartDate"`
	DefaultEndDate    time.Time     `gorm:"type:date;not null" json:"defaultEndDate"`
	ExtensionDays     int           `gorm:"not null;default:0" json:"extensionDays"`
	ProjectedEndDate  time.Time     `gorm:"type:date;not null;index" json:"projectedEndDate"`
	PaymentMethodID   string        `gorm:"type:text;not null;index" json:"paymentMethodId"`
	PaymentValue      float64       `gorm:"type:numeric;not null" json:"paymentValue"`
	SectorID          string        `gorm:"type:text;not null" json:"sectorId"`
	LocationID        string        `gorm:"type:text;not null;index" json:"locationId"`
	TaskID            string        `gorm:"type:text;not null" json:"taskId"`
	StatusID          string        `gorm:"type:text;not null;index" json:"statusId"`
	Notes             string        `gorm:"type:text" json:"notes,omitempty"`
	ClosedAt          *time.Time    `gorm:"type:datetime" json:"closedAt,omitempty"`

	Person            Person        `gorm:"foreignKey:PersonID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"person,omitempty"`
	PaymentMethod     ReferenceData `gorm:"foreignKey:PaymentMethodID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"paymentMethod,omitempty"`
	Sector            ReferenceData `gorm:"foreignKey:SectorID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"sector,omitempty"`
	Location          ReferenceData `gorm:"foreignKey:LocationID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"location,omitempty"`
	Task              ReferenceData `gorm:"foreignKey:TaskID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"task,omitempty"`
	Status            ReferenceData `gorm:"foreignKey:StatusID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"status,omitempty"`
}
