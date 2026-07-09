package server

import (
	"github.com/legitahmad/logithm-backend/ent"
	"github.com/legitahmad/logithm-backend/internal/config"
	"github.com/legitahmad/logithm-backend/internal/modules/auth"
	"github.com/legitahmad/logithm-backend/internal/modules/user"
)

type Container struct {
	Config *config.Config
	Client *ent.Client

	UserService *user.Service
	AuthService *auth.Service
}

func NewContainer(cfg *config.Config, client *ent.Client) *Container {
	c := &Container{
		Config: cfg,
		Client: client,
	}
	c.UserService = user.NewService(client)
	c.AuthService = auth.NewService(client, cfg, c.UserService)
	return c
}
