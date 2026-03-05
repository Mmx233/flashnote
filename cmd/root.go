package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/Mmx233/flashnote/internal/api/controllers"
	"github.com/Mmx233/flashnote/internal/api/router"
	"github.com/Mmx233/flashnote/internal/config"
	"github.com/Mmx233/flashnote/internal/service"
	"github.com/Mmx233/flashnote/internal/store"
	"github.com/Mmx233/flashnote/internal/ws"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var configPath string
var version = "dev"

var rootCmd = &cobra.Command{
	Use:     "flashnote",
	Short:   "Flash Note - Self-hosted ephemeral text & image sharing",
	Version: version,

	Run: func(cmd *cobra.Command, args []string) {
		if version != "dev" {
			gin.SetMode(gin.ReleaseMode)
		}

		// Load configuration
		cfg, err := config.Load(configPath)
		if err != nil {
			log.Fatalf("failed to load config: %v", err)
		}
		log.Infof("config loaded from %s", configPath)

		// Initialize ClipStore and load existing data
		clipStore := store.NewClipStore(cfg.StorePath)
		if err := clipStore.Load(); err != nil {
			log.Fatalf("failed to load clip store: %v", err)
		}

		// Create WebSocket Hub
		hub := ws.NewHub(cfg.Limits(), cfg.WSReadTimeout, cfg.WSSendBufferSize)
		hub.SetClipListProvider(func() interface{} {
			return clipStore.ListAll()
		})

		// Create ClipService and start expiry cleaner
		clipService := service.NewClipService(clipStore, hub, cfg)
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		clipService.StartCleaner(ctx)

		// Create controller and set up routes
		clipCtrl := controllers.NewClipController(clipService)
		r := gin.Default()
		router.Register(r, clipCtrl, hub)

		// Start server
		log.Infof("starting server on %s", cfg.Addr)
		if err := r.Run(cfg.Addr); err != nil {
			log.Fatalf("server error: %v", err)
		}
	},
}

func init() {
	rootCmd.Flags().StringVarP(&configPath, "config", "c", "config.yaml", "path to config file")
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
