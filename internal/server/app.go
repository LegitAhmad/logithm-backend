package server

import (
	"github.com/gin-gonic/gin"
	"github.com/legitahmad/logithm-backend/internal/modules/auth"
	"github.com/legitahmad/logithm-backend/internal/modules/user"
)

func NewApp(c *Container) *gin.Engine {
	r := gin.Default()

	api := r.Group("/api/v1")

	authMW := auth.Middleware(c.Config.JWTAccessSecret)

	user.NewRouter(c.UserService, api, authMW)
	auth.NewRouter(c.AuthService, api)

	r.GET("/", func(ctx *gin.Context) {
		ctx.JSON(200, gin.H{"status": "ok"})
	})

	return r
}
