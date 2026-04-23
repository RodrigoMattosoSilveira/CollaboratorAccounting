package models

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