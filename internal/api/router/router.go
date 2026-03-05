package router

import (
	"log"

	webServe "github.com/Mmx233/GinWebServe"
	"github.com/Mmx233/flashnote/internal/api/controllers"
	"github.com/Mmx233/flashnote/internal/ws"
	"github.com/Mmx233/flashnote/web"
	"github.com/gin-gonic/gin"
)

// Register sets up all API routes, the WebSocket endpoint, and the frontend
// static file handler on the given engine.
func Register(r *gin.Engine, clipCtrl *controllers.ClipController, hub *ws.Hub) {
	api := r.Group("/api")
	{
		clips := api.Group("/clips")
		{
			clips.POST("", clipCtrl.Create)
			clips.GET("/:id/file", clipCtrl.GetFile)
			clips.DELETE("/:id", clipCtrl.Delete)
		}
	}

	r.GET("/ws", hub.HandleWS)

	// Serve embedded frontend SPA — must be placed after all other routes.
	// Unmatched paths fall through to index.html for client-side routing.
	fs, err := web.Fs()
	if err != nil {
		log.Fatalf("failed to load embedded frontend: %v", err)
	}
	handler, err := webServe.New(fs)
	if err != nil {
		log.Fatalf("failed to create frontend handler: %v", err)
	}
	r.Use(handler)
}
