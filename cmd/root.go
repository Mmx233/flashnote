package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "clipboard-flow",
	Short: "Clipboard Flow - share text and images across devices",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Clipboard Flow server starting...")
		// Server startup will be implemented in later tasks
	},
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
