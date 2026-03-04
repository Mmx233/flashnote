package router

import (
	"github.com/Mmx233/flashnote/internal/api/controllers"
	"github.com/Mmx233/flashnote/internal/ws"
	"github.com/gin-gonic/gin"
)

// Register sets up all API routes and the WebSocket endpoint on the given engine.
func Register(r *gin.Engine, clipCtrl *controllers.ClipController, hub *ws.Hub) {
	api := r.Group("/api")
	{
		clips := api.Group("/clips")
		{
			clips.POST("", clipCtrl.Create)
			clips.GET("", clipCtrl.List)
			clips.GET("/:id/file", clipCtrl.GetFile)
			clips.DELETE("/:id", clipCtrl.Delete)
		}
	}

	r.GET("/ws", hub.HandleWS)
}
