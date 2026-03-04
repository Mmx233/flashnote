package controllers

import (
	"strconv"
	"time"

	"github.com/Mmx233/flashnote/internal/api/callback"
	"github.com/Mmx233/flashnote/internal/service"
	"github.com/gin-gonic/gin"
)

// ClipController handles HTTP requests for clip operations.
type ClipController struct {
	service *service.ClipService
}

// NewClipController creates a new ClipController.
func NewClipController(svc *service.ClipService) *ClipController {
	return &ClipController{service: svc}
}

type createReq struct {
	Type    string `json:"type" form:"type" binding:"required,oneof=text image"`
	Content string `json:"content" form:"content"`
	TTL     string `json:"ttl" form:"ttl" binding:"required"`
}

// Create handles clip creation for both text (JSON) and image (multipart) types.
// POST /api/clips
func (c *ClipController) Create(ctx *gin.Context) {
	var req createReq
	if err := ctx.ShouldBind(&req); err != nil {
		callback.Error(ctx, callback.CodeBadRequest, "invalid request: type and ttl are required, type must be 'text' or 'image'")
		return
	}

	ttl, err := time.ParseDuration(req.TTL)
	if err != nil {
		callback.Error(ctx, callback.CodeBadRequest, "invalid TTL value")
		return
	}

	switch req.Type {
	case "text":
		clip, err := c.service.CreateText(req.Content, ttl)
		if err != nil {
			callback.HandleError(ctx, err)
			return
		}
		callback.Success(ctx, clip)

	case "image":
		file, err := ctx.FormFile("file")
		if err != nil {
			callback.Error(ctx, callback.CodeBadRequest, "missing file")
			return
		}
		clip, err := c.service.CreateImage(file, ttl)
		if err != nil {
			callback.HandleError(ctx, err)
			return
		}
		callback.Success(ctx, clip)
	}
}

// List returns a paginated list of clips.
// GET /api/clips?page=1&size=20
func (c *ClipController) List(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(ctx.DefaultQuery("size", "20"))
	if page < 1 {
		page = 1
	}
	if size < 1 {
		size = 20
	}

	clips, total := c.service.List(page, size)
	callback.Success(ctx, gin.H{
		"clips": clips,
		"total": total,
		"page":  page,
		"size":  size,
	})
}

// GetFile serves an image clip's file inline or as a download.
// GET /api/clips/:id/file[?download=1]
func (c *ClipController) GetFile(ctx *gin.Context) {
	id := ctx.Param("id")
	filePath, fileName, err := c.service.GetFilePath(id)
	if err != nil {
		callback.HandleError(ctx, err)
		return
	}

	if ctx.Query("download") == "1" {
		ctx.FileAttachment(filePath, fileName)
	} else {
		ctx.File(filePath)
	}
}

// Delete removes a clip by ID.
// DELETE /api/clips/:id
func (c *ClipController) Delete(ctx *gin.Context) {
	id := ctx.Param("id")
	if err := c.service.Delete(id); err != nil {
		callback.HandleError(ctx, err)
		return
	}
	callback.Success(ctx, nil)
}
