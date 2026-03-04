package model

import "time"

type ClipType string

const (
	ClipTypeText  ClipType = "text"
	ClipTypeImage ClipType = "image"
)

// Clip is persisted as a JSON file: {storePath}/{id}.json
type Clip struct {
	ID        string    `json:"id"`
	Type      ClipType  `json:"type"`
	Hash      string    `json:"hash"`
	Content   string    `json:"content,omitempty"`  // text only
	FileName  string    `json:"fileName,omitempty"` // original filename for download, image only
	DiskName  string    `json:"diskName,omitempty"` // on-disk filename ({id}.ext), image only
	FileSize  int64     `json:"fileSize,omitempty"` // image only
	MimeType  string    `json:"mimeType,omitempty"` // image only
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}
