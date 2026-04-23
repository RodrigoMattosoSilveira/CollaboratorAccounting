package models

type AuditLog struct {
	BaseModel
	ActorUserID string `gorm:"type:text;not null;index" json:"actorUserId"`
	Action      string `gorm:"type:text;not null" json:"action"`
	EntityType  string `gorm:"type:text;not null;index:idx_audit_entity,priority:1" json:"entityType"`
	EntityID    string `gorm:"type:text;not null;index:idx_audit_entity,priority:2" json:"entityId"`
	BeforeJSON  string `gorm:"type:text" json:"beforeJson,omitempty"`
	AfterJSON   string `gorm:"type:text" json:"afterJson,omitempty"`

	Actor       User   `gorm:"foreignKey:ActorUserID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"actor,omitempty"`
}