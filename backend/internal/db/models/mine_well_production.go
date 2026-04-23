package models

import "time"

type MineWellProduction struct {
	BaseModel
	WorkPeriodID   string     `gorm:"type:text;not null;index" json:"workPeriodId"`
	WorkDate       time.Time  `gorm:"type:date;not null;uniqueIndex:ux_production_date_period_location" json:"workDate"`
	PeriodCode     string     `gorm:"type:text;not null;uniqueIndex:ux_production_date_period_location" json:"periodCode"`
	LocationID     string     `gorm:"type:text;not null;uniqueIndex:ux_production_date_period_location;index" json:"locationId"`
	GramsProduced  float64    `gorm:"type:numeric;not null" json:"gramsProduced"`
	Comments       string     `gorm:"type:text" json:"comments,omitempty"`
	CreatedBy      string     `gorm:"type:text;not null" json:"createdBy"`

	WorkPeriod     WorkPeriod    `gorm:"foreignKey:WorkPeriodID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"workPeriod,omitempty"`
	Location       ReferenceData `gorm:"foreignKey:LocationID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"location,omitempty"`
	Creator        User          `gorm:"foreignKey:CreatedBy;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"creator,omitempty"`
}