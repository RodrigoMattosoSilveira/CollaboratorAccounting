package models
import "time"

type GoldPrice struct {
	BaseModel
	QuoteDate         time.Time `gorm:"type:date;not null;uniqueIndex" json:"quoteDate"`
	QuotedAtTime      string    `gorm:"type:text" json:"quotedAtTime,omitempty"`
	PriceBRLPerGram   float64   `gorm:"column:price_brl_per_gram;type:numeric;not null" json:"priceBRLPerGram"`
	SourceName        string    `gorm:"type:text" json:"sourceName,omitempty"`
	Comments          string    `gorm:"type:text" json:"comments,omitempty"`
	CreatedBy         string    `gorm:"type:text;not null" json:"createdBy"`

	Creator           User      `gorm:"foreignKey:CreatedBy;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"creator,omitempty"`
}