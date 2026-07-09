package user

import "time"

type UserResponse struct {
	ID          int       `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type UpdateUserRequest struct {
	DisplayName string `json:"display_name" binding:"required"`
}
