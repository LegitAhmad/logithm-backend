package user

import (
	"context"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/legitahmad/logithm-backend/ent"
	"github.com/legitahmad/logithm-backend/ent/user"
)

type Service struct {
	client *ent.Client
}

func NewService(client *ent.Client) *Service {
	return &Service{client: client}
}

func (s *Service) Create(ctx context.Context, email, displayName, password string) (*ent.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	return s.client.User.Create().
		SetEmail(email).
		SetDisplayName(displayName).
		SetPasswordHash(string(hash)).
		SetCreatedAt(now).
		SetUpdatedAt(now).
		Save(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*ent.User, error) {
	return s.client.User.Get(ctx, id)
}

func (s *Service) GetByEmail(ctx context.Context, email string) (*ent.User, error) {
	return s.client.User.Query().Where(user.EmailEQ(email)).Only(ctx)
}

func (s *Service) Update(ctx context.Context, id int, displayName string) (*ent.User, error) {
	return s.client.User.UpdateOneID(id).
		SetDisplayName(displayName).
		SetUpdatedAt(time.Now()).
		Save(ctx)
}

func (s *Service) CheckPassword(ctx context.Context, email, password string) (*ent.User, error) {
	u, err := s.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return nil, err
	}
	return u, nil
}
