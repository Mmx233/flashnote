package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// ServerConfig holds all server configuration loaded from config.yaml.
type ServerConfig struct {
	Addr                  string        `yaml:"addr"`
	StorePath             string        `yaml:"storePath"`
	MaxTextSize           int64         `yaml:"maxTextSize"`
	MaxFileSize           int64         `yaml:"maxFileSize"`
	DefaultTTL            time.Duration `yaml:"-"`
	MinTTL                time.Duration `yaml:"-"`
	MaxTTL                time.Duration `yaml:"-"`
	TTLOptions            []string      `yaml:"ttlOptions"`
	CleanupInterval       time.Duration `yaml:"-"`
	BlurDisconnectTimeout time.Duration `yaml:"-"`
	WSReadTimeout         time.Duration `yaml:"-"`
	WSHeartbeatInterval   time.Duration `yaml:"-"`
	WSSendBufferSize      int           `yaml:"wsSendBufferSize"`
}

// rawConfig mirrors ServerConfig but uses strings for duration fields so yaml.v3 can parse them.
type rawConfig struct {
	Addr                  string   `yaml:"addr"`
	StorePath             string   `yaml:"storePath"`
	MaxTextSize           int64    `yaml:"maxTextSize"`
	MaxFileSize           int64    `yaml:"maxFileSize"`
	DefaultTTL            string   `yaml:"defaultTTL"`
	MinTTL                string   `yaml:"minTTL"`
	MaxTTL                string   `yaml:"maxTTL"`
	TTLOptions            []string `yaml:"ttlOptions"`
	CleanupInterval       string   `yaml:"cleanupInterval"`
	BlurDisconnectTimeout string   `yaml:"blurDisconnectTimeout"`
	WSReadTimeout         string   `yaml:"wsReadTimeout"`
	WSHeartbeatInterval   string   `yaml:"wsHeartbeatInterval"`
	WSSendBufferSize      int      `yaml:"wsSendBufferSize"`
}

// ServerLimits is the subset of config exposed to the frontend via WebSocket.
type ServerLimits struct {
	MaxTextSize           int64    `json:"maxTextSize"`
	MaxFileSize           int64    `json:"maxFileSize"`
	TTLOptions            []string `json:"ttlOptions"`
	DefaultTTL            string   `json:"defaultTTL"`
	BlurDisconnectTimeout int      `json:"blurDisconnectTimeout"` // seconds
	HeartbeatInterval     int      `json:"heartbeatInterval"`     // seconds
}

// Limits returns the ServerLimits derived from this config.
func (c *ServerConfig) Limits() ServerLimits {
	return ServerLimits{
		MaxTextSize:           c.MaxTextSize,
		MaxFileSize:           c.MaxFileSize,
		TTLOptions:            c.TTLOptions,
		DefaultTTL:            formatDuration(c.DefaultTTL),
		BlurDisconnectTimeout: int(c.BlurDisconnectTimeout.Seconds()),
		HeartbeatInterval:     int(c.WSHeartbeatInterval.Seconds()),
	}
}

// Load reads and parses a YAML config file, applying defaults for missing fields.
func Load(path string) (*ServerConfig, error) {
	cfg := &ServerConfig{
		Addr:                  ":8080",
		StorePath:             "./data",
		MaxTextSize:           65536,
		MaxFileSize:           10485760,
		DefaultTTL:            time.Hour,
		MinTTL:                5 * time.Minute,
		MaxTTL:                24 * time.Hour,
		TTLOptions:            []string{"5m", "30m", "1h", "6h", "24h"},
		CleanupInterval:       time.Minute,
		BlurDisconnectTimeout: 5 * time.Minute,
		WSReadTimeout:         60 * time.Second,
		WSHeartbeatInterval:   30 * time.Second,
		WSSendBufferSize:      256,
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var raw rawConfig
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return nil, err
	}

	if raw.Addr != "" {
		cfg.Addr = raw.Addr
	}
	if raw.StorePath != "" {
		cfg.StorePath = raw.StorePath
	}
	if raw.MaxTextSize != 0 {
		cfg.MaxTextSize = raw.MaxTextSize
	}
	if raw.MaxFileSize != 0 {
		cfg.MaxFileSize = raw.MaxFileSize
	}
	if len(raw.TTLOptions) > 0 {
		cfg.TTLOptions = raw.TTLOptions
	}

	// Parse duration fields, keeping defaults if empty
	if raw.DefaultTTL != "" {
		if d, err := time.ParseDuration(raw.DefaultTTL); err == nil {
			cfg.DefaultTTL = d
		} else {
			return nil, fmt.Errorf("invalid defaultTTL %q: %w", raw.DefaultTTL, err)
		}
	}
	if raw.MinTTL != "" {
		if d, err := time.ParseDuration(raw.MinTTL); err == nil {
			cfg.MinTTL = d
		} else {
			return nil, fmt.Errorf("invalid minTTL %q: %w", raw.MinTTL, err)
		}
	}
	if raw.MaxTTL != "" {
		if d, err := time.ParseDuration(raw.MaxTTL); err == nil {
			cfg.MaxTTL = d
		} else {
			return nil, fmt.Errorf("invalid maxTTL %q: %w", raw.MaxTTL, err)
		}
	}
	if raw.CleanupInterval != "" {
		if d, err := time.ParseDuration(raw.CleanupInterval); err == nil {
			cfg.CleanupInterval = d
		} else {
			return nil, fmt.Errorf("invalid cleanupInterval %q: %w", raw.CleanupInterval, err)
		}
	}
	if raw.BlurDisconnectTimeout != "" {
		if d, err := time.ParseDuration(raw.BlurDisconnectTimeout); err == nil {
			cfg.BlurDisconnectTimeout = d
		} else {
			return nil, fmt.Errorf("invalid blurDisconnectTimeout %q: %w", raw.BlurDisconnectTimeout, err)
		}
	}
	if raw.WSReadTimeout != "" {
		if d, err := time.ParseDuration(raw.WSReadTimeout); err == nil {
			cfg.WSReadTimeout = d
		} else {
			return nil, fmt.Errorf("invalid wsReadTimeout %q: %w", raw.WSReadTimeout, err)
		}
	}
	if raw.WSHeartbeatInterval != "" {
		if d, err := time.ParseDuration(raw.WSHeartbeatInterval); err == nil {
			cfg.WSHeartbeatInterval = d
		} else {
			return nil, fmt.Errorf("invalid wsHeartbeatInterval %q: %w", raw.WSHeartbeatInterval, err)
		}
	}
	if raw.WSSendBufferSize > 0 {
		cfg.WSSendBufferSize = raw.WSSendBufferSize
	}

	return cfg, nil
}

// formatDuration converts a time.Duration to a human-friendly string like "5m", "1h", "24h".
func formatDuration(d time.Duration) string {
	if h := d.Hours(); h >= 1 && d == time.Duration(h)*time.Hour {
		return fmt.Sprintf("%dh", int(h))
	}
	if m := d.Minutes(); m >= 1 && d == time.Duration(m)*time.Minute {
		return fmt.Sprintf("%dm", int(m))
	}
	return d.String()
}
