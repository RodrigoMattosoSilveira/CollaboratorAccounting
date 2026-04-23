package models

import "time"

type WorkPeriod struct {
	BaseModel
	WorkDate               time.Time  `gorm:"type:date;not null;uniqueIndex:ux_work_period_date_code" json:"workDate"`
	PeriodCode             string     `gorm:"type:text;not null;uniqueIndex:ux_work_period_date_code;index" json:"periodCode"`
	StartsAt               *time.Time `gorm:"type:datetime" json:"startsAt,omitempty"`
	EndsAt                 *time.Time `gorm:"type:datetime" json:"endsAt,omitempty"`
	Status                 string     `gorm:"type:text;not null;index" json:"status"`
	SeededFromWorkPeriodID *string    `gorm:"type:text" json:"seededFromWorkPeriodId,omitempty"`
	SeededFromWorkPeriod   *WorkPeriod `gorm:"foreignKey:SeededFromWorkPeriodID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"seededFromWorkPeriod,omitempty"`
	PlanItems              []WorkPlanItem `gorm:"foreignKey:WorkPeriodID" json:"planItems,omitempty"`
}