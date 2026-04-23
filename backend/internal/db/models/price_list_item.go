package models

type PriceListItem struct {
	BaseModel
	Code        *string       `gorm:"type:text;uniqueIndex" json:"code,omitempty"`
	Name        string        `gorm:"type:text;not null;uniqueIndex" json:"name"`
	Description string        `gorm:"type:text" json:"description,omitempty"`
	CategoryID  string        `gorm:"type:text;not null;index:idx_price_list_category_active,priority:1" json:"categoryId"`
	PriceBRL    float64       `gorm:"column:price_brl;type:numeric;not null" json:"priceBRL"`
	Active      bool          `gorm:"not null;default:true;index:idx_price_list_category_active,priority:2" json:"active"`

	Category    ReferenceData `gorm:"foreignKey:CategoryID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"category,omitempty"`
}