package user

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/legitahmad/logithm-backend/ent"
)

type Router struct {
	svc *Service
}

func NewRouter(svc *Service, rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	h := &Router{svc: svc}

	rg.GET("/users/me", authMW, h.Me)
	rg.PATCH("/users/me", authMW, h.Update)
	rg.GET("/users/:id", h.Get)
}

func (h *Router) Me(ctx *gin.Context) {
	userID, _ := ctx.Get("user_id")
	id, ok := userID.(int)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user identity"})
		return
	}

	u, err := h.svc.GetByID(ctx.Request.Context(), id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	ctx.JSON(http.StatusOK, UserResponse{
		ID:          u.ID,
		Email:       u.Email,
		DisplayName: u.DisplayName,
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	})
}

func (h *Router) Get(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	u, err := h.svc.GetByID(ctx.Request.Context(), id)
	if ent.IsNotFound(err) {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	ctx.JSON(http.StatusOK, UserResponse{
		ID:          u.ID,
		Email:       u.Email,
		DisplayName: u.DisplayName,
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	})
}

func (h *Router) Update(ctx *gin.Context) {
	userID, _ := ctx.Get("user_id")
	id, ok := userID.(int)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user identity"})
		return
	}

	var req UpdateUserRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	u, err := h.svc.Update(ctx.Request.Context(), id, req.DisplayName)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}

	ctx.JSON(http.StatusOK, UserResponse{
		ID:          u.ID,
		Email:       u.Email,
		DisplayName: u.DisplayName,
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	})
}
