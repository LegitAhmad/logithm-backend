package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/legitahmad/logithm-backend/ent"
	"github.com/legitahmad/logithm-backend/ent/refreshsession"
	"github.com/legitahmad/logithm-backend/internal/config"
	"github.com/legitahmad/logithm-backend/internal/modules/user"
)

type Service struct {
	client  *ent.Client
	cfg     *config.Config
	userSvc *user.Service
}

func NewService(client *ent.Client, cfg *config.Config, userSvc *user.Service) *Service {
	return &Service{
		client:  client,
		cfg:     cfg,
		userSvc: userSvc,
	}
}

type Claims struct {
	UserID int    `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

func (s *Service) Register(ctx context.Context, email, displayName, password string) (*AuthResponse, error) {
	u, err := s.userSvc.Create(ctx, email, displayName, password)
	if err != nil {
		return nil, err
	}
	return s.generateTokens(ctx, u)
}

func (s *Service) Login(ctx context.Context, email, password string) (*AuthResponse, error) {
	u, err := s.userSvc.CheckPassword(ctx, email, password)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}
	return s.generateTokens(ctx, u)
}

func (s *Service) Refresh(ctx context.Context, token string) (*AuthResponse, error) {
	tokenHash := hashToken(token)

	session, err := s.client.RefreshSession.Query().
		Where(refreshsession.TokenHash(tokenHash)).
		Only(ctx)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token")
	}

	if session.RevokedAt != nil {
		s.revokeFamily(ctx, session.FamilyID)
		return nil, fmt.Errorf("token reuse detected")
	}

	if time.Now().After(session.ExpiresAt) {
		return nil, fmt.Errorf("token expired")
	}

	u, err := s.userSvc.GetByID(ctx, session.UserID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	s.client.RefreshSession.UpdateOne(session).
		SetNillableRevokedAt(&now).
		Save(ctx)

	return s.generateTokens(ctx, u)
}

func (s *Service) revokeFamily(ctx context.Context, familyID string) {
	now := time.Now()
	s.client.RefreshSession.Update().
		Where(refreshsession.FamilyID(familyID)).
		SetNillableRevokedAt(&now).
		Save(ctx)
}

func (s *Service) generateTokens(ctx context.Context, u *ent.User) (*AuthResponse, error) {
	now := time.Now()

	accessClaims := Claims{
		UserID: u.ID,
		Email:  u.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.AccessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   strconv.Itoa(u.ID),
		},
	}

	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims).
		SignedString([]byte(s.cfg.JWTAccessSecret))
	if err != nil {
		return nil, err
	}

	sessionID := generateID()
	familyID := generateID()

	refreshClaims := Claims{
		UserID: u.ID,
		Email:  u.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        sessionID,
			ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.RefreshTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   strconv.Itoa(u.ID),
		},
	}

	refreshToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims).
		SignedString([]byte(s.cfg.JWTRefreshSecret))
	if err != nil {
		return nil, err
	}

	_, err = s.client.RefreshSession.Create().
		SetSessionID(sessionID).
		SetFamilyID(familyID).
		SetTokenHash(hashToken(refreshToken)).
		SetUserID(u.ID).
		SetExpiresAt(now.Add(s.cfg.RefreshTokenTTL)).
		SetCreatedAt(now).
		Save(ctx)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User: user.UserResponse{
			ID:          u.ID,
			Email:       u.Email,
			DisplayName: u.DisplayName,
		},
	}, nil
}

func generateID() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
