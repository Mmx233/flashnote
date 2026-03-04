package service

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Mmx233/flashnote/internal/api/callback"
	"github.com/Mmx233/flashnote/internal/config"
	"github.com/Mmx233/flashnote/internal/model"
	"github.com/Mmx233/flashnote/internal/store"
	"github.com/Mmx233/flashnote/internal/util"
	"github.com/Mmx233/flashnote/internal/ws"
	"github.com/google/uuid"
	log "github.com/sirupsen/logrus"
)

var (
	ErrEmptyContent    = callback.NewBizError(callback.CodeBadRequest, "content is empty")
	ErrTextTooLarge    = callback.NewBizError(callback.CodeFileTooLarge, "text content exceeds maximum size")
	ErrFileTooLarge    = callback.NewBizError(callback.CodeFileTooLarge, "file exceeds maximum size")
	ErrInvalidMIMEType = callback.NewBizError(callback.CodeBadRequest, "unsupported image type")
	ErrClipNotFound    = callback.NewBizError(callback.CodeNotFound, "clip not found")
	ErrNotImageClip    = callback.NewBizError(callback.CodeNotFound, "file not found")
)

// ClipService implements the core business logic for clip management.
type ClipService struct {
	store  *store.ClipStore
	hub    *ws.Hub
	config *config.ServerConfig
}

// NewClipService creates a new ClipService.
func NewClipService(store *store.ClipStore, hub *ws.Hub, cfg *config.ServerConfig) *ClipService {
	return &ClipService{store: store, hub: hub, config: cfg}
}

// ValidateTTL clamps the requested TTL within [MinTTL, MaxTTL].
func (s *ClipService) ValidateTTL(requested time.Duration) time.Duration {
	if requested < s.config.MinTTL {
		return s.config.MinTTL
	}
	if requested > s.config.MaxTTL {
		return s.config.MaxTTL
	}
	return requested
}

// CreateText creates a text clip after validating content constraints.
func (s *ClipService) CreateText(content string, ttl time.Duration) (*model.Clip, error) {
	if len(content) == 0 {
		return nil, ErrEmptyContent
	}
	if int64(len(content)) > s.config.MaxTextSize {
		return nil, ErrTextTooLarge
	}

	now := time.Now()
	clip := &model.Clip{
		ID:        uuid.New().String(),
		Type:      model.ClipTypeText,
		Content:   content,
		ExpiresAt: now.Add(s.ValidateTTL(ttl)),
		CreatedAt: now,
	}

	if err := s.store.Save(clip); err != nil {
		return nil, fmt.Errorf("save text clip: %w", err)
	}

	s.hub.Broadcast(&ws.Message{Type: ws.MsgClipCreate, Data: clip})
	return clip, nil
}

// CreateImage creates an image clip, saving the file to disk with rollback on failure.
func (s *ClipService) CreateImage(file *multipart.FileHeader, ttl time.Duration) (*model.Clip, error) {
	if file.Size > s.config.MaxFileSize {
		return nil, ErrFileTooLarge
	}

	// Detect real MIME type from file content
	mimeType, err := util.DetectFileMIME(file)
	if err != nil {
		return nil, fmt.Errorf("detect MIME type: %w", err)
	}
	if !strings.HasPrefix(mimeType, "image/") {
		return nil, ErrInvalidMIMEType
	}

	id := uuid.New().String()
	// Always derive extension from MIME type, never trust the client-supplied filename extension
	ext, err := util.MIMEToExt(mimeType)
	if err != nil {
		return nil, ErrInvalidMIMEType
	}

	diskName := id + ext
	now := time.Now()
	clip := &model.Clip{
		ID:        id,
		Type:      model.ClipTypeImage,
		FileName:  file.Filename,
		DiskName:  diskName,
		FileSize:  file.Size,
		MimeType:  mimeType,
		ExpiresAt: now.Add(s.ValidateTTL(ttl)),
		CreatedAt: now,
	}

	// Save metadata first to claim the ID, preventing a duplicate UUID from overwriting the image file
	if err := s.store.Save(clip); err != nil {
		return nil, fmt.Errorf("save image clip metadata: %w", err)
	}

	dst := filepath.Join(s.store.StorePath(), diskName)
	if err := saveUploadedFile(file, dst); err != nil {
		// Rollback: remove the metadata we just persisted
		s.store.Remove(id)
		return nil, fmt.Errorf("save image file: %w", err)
	}

	s.hub.Broadcast(&ws.Message{Type: ws.MsgClipCreate, Data: clip})
	return clip, nil
}

// GetFilePath returns the on-disk path for an image clip's file.
func (s *ClipService) GetFilePath(id string) (string, string, error) {
	clip, ok := s.store.Get(id)
	if !ok {
		return "", "", ErrClipNotFound
	}
	if clip.Type != model.ClipTypeImage {
		return "", "", ErrNotImageClip
	}
	return filepath.Join(s.store.StorePath(), clip.DiskName), clip.FileName, nil
}

// Delete removes a clip and broadcasts the expiry event.
func (s *ClipService) Delete(id string) error {
	if err := s.store.Remove(id); err != nil {
		return ErrClipNotFound
	}
	s.hub.Broadcast(&ws.Message{
		Type: ws.MsgClipExpire,
		Data: map[string]string{"id": id},
	})
	return nil
}

// CleanExpired removes all expired clips and broadcasts each removal.
func (s *ClipService) CleanExpired() {
	expired := s.store.ExpiredClips()
	for _, clip := range expired {
		if err := s.store.Remove(clip.ID); err != nil {
			log.Errorf("failed to remove expired clip %s: %v", clip.ID, err)
			continue
		}
		s.hub.Broadcast(&ws.Message{
			Type: ws.MsgClipExpire,
			Data: map[string]string{"id": clip.ID},
		})
		log.Infof("cleaned expired clip: %s", clip.ID)
	}
}

// StartCleaner launches a goroutine that periodically cleans expired clips.
func (s *ClipService) StartCleaner(ctx context.Context) {
	ticker := time.NewTicker(s.config.CleanupInterval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.CleanExpired()
			}
		}
	}()
}


// saveUploadedFile saves a multipart file to the given destination path.
func saveUploadedFile(file *multipart.FileHeader, dst string) error {
	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, src)
	return err
}
