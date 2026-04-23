package models

import "time"

type CurrentAccountEntry struct {
	BaseModel
	RevertedEntryID  *string               `gorm:"type:text;index" json:"revertedEntryId,omitempty"`
	CollaboratorID   string                `gorm:"type:text;not null;index:idx_ledger_collaborator_entry_date,priority:1" json:"collaboratorId"`
	EntryDate        time.Time             `gorm:"type:date;not null;index:idx_ledger_collaborator_entry_date,priority:2" json:"entryDate"`
	SourceType       string                `gorm:"type:text;not null;index:idx_ledger_source,priority:1" json:"sourceType"`
	SourceID         *string               `gorm:"type:text;index:idx_ledger_source,priority:2" json:"sourceId,omitempty"`
	LedgerGroupID    *string               `gorm:"type:text;index" json:"ledgerGroupId,omitempty"`
	MethodID         *string               `gorm:"type:text" json:"methodId,omitempty"`
	CurrencyCode     string                `gorm:"type:text;not null;index:idx_ledger_currency_cd,priority:1" json:"currencyCode"`
	CDFlag           string                `gorm:"column:cd_flag;type:text;not null;index:idx_ledger_currency_cd,priority:2" json:"cdFlag"`
	ItemDescription  string                `gorm:"type:text;not null" json:"itemDescription"`
	Quantity         float64               `gorm:"type:numeric;not null;default:1" json:"quantity"`
	UnitPrice        float64               `gorm:"type:numeric;not null" json:"unitPrice"`
	TotalPrice       float64               `gorm:"type:numeric;not null" json:"totalPrice"`
	Comments         string                `gorm:"type:text" json:"comments,omitempty"`
	Status           string                `gorm:"type:text;not null;default:active" json:"status"`
	CreatedBy        string                `gorm:"type:text;not null" json:"createdBy"`

	RevertedEntry    *CurrentAccountEntry  `gorm:"foreignKey:RevertedEntryID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"revertedEntry,omitempty"`
	Collaborator     CollaboratorJourney   `gorm:"foreignKey:CollaboratorID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"collaborator,omitempty"`
	Method           *ReferenceData        `gorm:"foreignKey:MethodID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"method,omitempty"`
	Creator          User                  `gorm:"foreignKey:CreatedBy;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"creator,omitempty"`
}