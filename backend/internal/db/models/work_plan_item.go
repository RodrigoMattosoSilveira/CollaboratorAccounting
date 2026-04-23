package models

type WorkPlanItem struct {
	BaseModel
	WorkPeriodID                 string        `gorm:"type:text;not null;uniqueIndex:ux_work_period_collaborator;index" json:"workPeriodId"`
	CollaboratorID               string        `gorm:"type:text;not null;uniqueIndex:ux_work_period_collaborator;index" json:"collaboratorId"`
	IncludeFlag                  bool          `gorm:"not null;default:true" json:"includeFlag"`
	SectorID                     string        `gorm:"type:text;not null" json:"sectorId"`
	LocationID                   string        `gorm:"type:text;not null;index" json:"locationId"`
	TaskID                       string        `gorm:"type:text;not null" json:"taskId"`
	MethodID                     string        `gorm:"type:text;not null" json:"methodId"`
	PaymentValueSnapshot         float64       `gorm:"type:numeric;not null" json:"paymentValueSnapshot"`
	AssignmentStatus             string        `gorm:"type:text;not null" json:"assignmentStatus"`
	SubstitutedForCollaboratorID *string       `gorm:"type:text;index" json:"substitutedForCollaboratorId,omitempty"`
	ExceptionType                *string       `gorm:"type:text" json:"exceptionType,omitempty"`
	Comments                     string        `gorm:"type:text" json:"comments,omitempty"`

	WorkPeriod                   WorkPeriod          `gorm:"foreignKey:WorkPeriodID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"workPeriod,omitempty"`
	Collaborator                 CollaboratorJourney `gorm:"foreignKey:CollaboratorID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"collaborator,omitempty"`
	Sector                       ReferenceData       `gorm:"foreignKey:SectorID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"sector,omitempty"`
	Location                     ReferenceData       `gorm:"foreignKey:LocationID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"location,omitempty"`
	Task                         ReferenceData       `gorm:"foreignKey:TaskID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"task,omitempty"`
	Method                       ReferenceData       `gorm:"foreignKey:MethodID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"method,omitempty"`
	SubstitutedForCollaborator   *CollaboratorJourney `gorm:"foreignKey:SubstitutedForCollaboratorID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"substitutedForCollaborator,omitempty"`
}