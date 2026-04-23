package models

import "time"

type SystemSetting struct {
	ID          string    `gorm:"type:text;primaryKey" json:"id"`
	Key         string    `gorm:"type:text;not null;uniqueIndex" json:"key"`
	Value       string    `gorm:"type:text;not null" json:"value"`
	Description string    `gorm:"type:text" json:"description,omitempty"`
	UpdatedBy   string    `gorm:"type:text;not null" json:"updatedBy"`
	UpdatedAt   time.Time `gorm:"not null" json:"updatedAt"`

	Updater     User      `gorm:"foreignKey:UpdatedBy;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"updater,omitempty"`
}