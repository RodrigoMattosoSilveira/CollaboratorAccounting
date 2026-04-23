package models

import "time"

type ExpenseTransaction struct {
	BaseModel
	CollaboratorID         string               `gorm:"type:text;not null;index" json:"collaboratorId"`
	ExpenseDate            time.Time            `gorm:"type:date;not null;index" json:"expenseDate"`
	CurrencyCode           string               `gorm:"type:text;not null;index" json:"currencyCode"`
	TotalAmount            float64              `gorm:"type:numeric;not null" json:"totalAmount"`
	CategoryID             string               `gorm:"type:text;not null;index" json:"categoryId"`
	GoldPriceID            *string              `gorm:"type:text" json:"goldPriceId,omitempty"`
	CollaboratorAgreement  bool                 `gorm:"not null;default:false" json:"collaboratorAgreement"`
	Comments               string               `gorm:"type:text" json:"comments,omitempty"`
	PostedLedgerGroupID    *string              `gorm:"type:text" json:"postedLedgerGroupId,omitempty"`
	CreatedBy              string               `gorm:"type:text;not null" json:"createdBy"`

	Collaborator           CollaboratorJourney  `gorm:"foreignKey:CollaboratorID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"collaborator,omitempty"`
	Category               ReferenceData        `gorm:"foreignKey:CategoryID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"category,omitempty"`
	GoldPrice              *GoldPrice           `gorm:"foreignKey:GoldPriceID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"goldPrice,omitempty"`
	Creator                User                 `gorm:"foreignKey:CreatedBy;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"creator,omitempty"`
	Items                  []ExpenseItem        `gorm:"foreignKey:ExpenseID" json:"items,omitempty"`
}

type ExpenseItem struct {
	BaseModel
	ExpenseID          string         `gorm:"type:text;not null;index" json:"expenseId"`
	PriceListItemID    *string        `gorm:"type:text;index" json:"priceListItemId,omitempty"`
	ItemNameSnapshot   string         `gorm:"type:text;not null" json:"itemNameSnapshot"`
	Quantity           float64        `gorm:"type:numeric;not null" json:"quantity"`
	UnitPrice          float64        `gorm:"type:numeric;not null" json:"unitPrice"`
	TotalPrice         float64        `gorm:"type:numeric;not null" json:"totalPrice"`
	Comments           string         `gorm:"type:text" json:"comments,omitempty"`

	Expense            ExpenseTransaction `gorm:"foreignKey:ExpenseID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"expense,omitempty"`
	PriceListItem      *PriceListItem     `gorm:"foreignKey:PriceListItemID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"priceListItem,omitempty"`
}