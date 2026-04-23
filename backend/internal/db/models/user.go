package models

import "time"

type User struct {
	BaseModel
	Username     string     `gorm:"type:text;not null;uniqueIndex" json:"username"`
	Email        string     `gorm:"type:text;not null;uniqueIndex" json:"email"`
	PasswordHash string     `gorm:"type:text;not null" json:"-"`
	DisplayName  string     `gorm:"type:text;not null" json:"displayName"`
	Active       bool       `gorm:"not null;default:true" json:"active"`
	LastLoginAt  *time.Time `gorm:"type:datetime" json:"lastLoginAt,omitempty"`
	Roles        []Role     `gorm:"many2many:user_roles;" json:"roles,omitempty"`
}

type Role struct {
	BaseModel
	Code  string `gorm:"type:text;not null;uniqueIndex" json:"code"`
	Label string `gorm:"type:text;not null" json:"label"`
}

type UserRole struct {
	ID        string    `gorm:"type:text;primaryKey" json:"id"`
	UserID    string    `gorm:"type:text;not null;uniqueIndex:ux_user_role" json:"userId"`
	RoleID    string    `gorm:"type:text;not null;uniqueIndex:ux_user_role" json:"roleId"`
	CreatedAt time.Time `gorm:"not null" json:"createdAt"`

	User User `gorm:"foreignKey:UserID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"-"`
	Role Role `gorm:"foreignKey:RoleID;constraint:OnUpdate:Restrict,OnDelete:Restrict;" json:"-"`
}
