package models

type EarningAccrualBatch struct {
	BaseModel
	WorkPeriodID   string               `gorm:"type:text;not null;uniqueIndex;index" json:"workPeriodId"`
	AccrualStatus  string               `gorm:"type:text;not null;index" json:"accrualStatus"`
	Comments       string               `gorm:"type:text" json:"comments,omitempty"`
	CreatedBy      string               `gorm:"type:text;not null" json:"createdBy"`

	WorkPeriod     WorkPeriod           `gorm:"foreignKey:WorkPeriodID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"workPeriod,omitempty"`
	Creator        User                 `gorm:"foreignKey:CreatedBy;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"creator,omitempty"`
	Items          []EarningAccrualItem `gorm:"foreignKey:AccrualBatchID" json:"items,omitempty"`
}

type EarningAccrualItem struct {
	BaseModel
	AccrualBatchID       string               `gorm:"type:text;not null;index" json:"accrualBatchId"`
	CollaboratorID       string               `gorm:"type:text;not null;index" json:"collaboratorId"`
	WorkPlanItemID       *string              `gorm:"type:text;index" json:"workPlanItemId,omitempty"`
	MethodID             string               `gorm:"type:text;not null" json:"methodId"`
	CurrencyCode         string               `gorm:"type:text;not null" json:"currencyCode"`
	CalculationBasisJSON string               `gorm:"type:text;not null" json:"calculationBasisJson"`
	GrossAmount          float64              `gorm:"type:numeric;not null" json:"grossAmount"`
	TransferAmount       float64              `gorm:"type:numeric;not null;default:0" json:"transferAmount"`
	NetAmount            float64              `gorm:"type:numeric;not null" json:"netAmount"`
	HoldReason           *string              `gorm:"type:text" json:"holdReason,omitempty"`
	LedgerEntryID        *string              `gorm:"type:text;index" json:"ledgerEntryId,omitempty"`
	Status               string               `gorm:"type:text;not null;index" json:"status"`
	Comments             string               `gorm:"type:text" json:"comments,omitempty"`

	AccrualBatch         EarningAccrualBatch  `gorm:"foreignKey:AccrualBatchID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"accrualBatch,omitempty"`
	Collaborator         CollaboratorJourney  `gorm:"foreignKey:CollaboratorID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"collaborator,omitempty"`
	WorkPlanItem         *WorkPlanItem        `gorm:"foreignKey:WorkPlanItemID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"workPlanItem,omitempty"`
	Method               ReferenceData        `gorm:"foreignKey:MethodID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"method,omitempty"`
}