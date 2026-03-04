package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Mmx233/flashnote/internal/model"
	log "github.com/sirupsen/logrus"
)

// ClipStore manages clip persistence on disk and an in-memory index for fast queries.
type ClipStore struct {
	mu        sync.RWMutex
	clips     map[string]*model.Clip // keyed by ID
	sorted    []*model.Clip          // sorted by CreatedAt desc
	storePath string
}

// NewClipStore creates a ClipStore rooted at the given directory.
func NewClipStore(storePath string) *ClipStore {
	return &ClipStore{
		clips:     make(map[string]*model.Clip),
		storePath: storePath,
	}
}

// StorePath returns the base storage directory.
func (s *ClipStore) StorePath() string {
	return s.storePath
}

// Load scans storePath for *.json metadata files and populates the in-memory index.
// Invalid files are cleaned up with a warning log. Expired clips are removed on startup.
func (s *ClipStore) Load() error {
	if err := os.MkdirAll(s.storePath, 0o755); err != nil {
		return fmt.Errorf("create store path: %w", err)
	}

	entries, err := os.ReadDir(s.storePath)
	if err != nil {
		return fmt.Errorf("read store path: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	var expiredCount int

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		filePath := filepath.Join(s.storePath, entry.Name())

		data, err := os.ReadFile(filePath)
		if err != nil {
			log.Errorf("skip unreadable file %s: %v", entry.Name(), err)
			continue
		}

		var clip model.Clip
		if err := json.Unmarshal(data, &clip); err != nil {
			log.Errorf("skip invalid json %s: %v", entry.Name(), err)
			continue
		}

		// Clean up expired clips at startup
		if clip.ExpiresAt.Before(now) {
			log.Infof("removing expired clip %s (expired at %s)", clip.ID, clip.ExpiresAt.Format(time.RFC3339))
			s.removeClipFiles(&clip)
			expiredCount++
			continue
		}

		// Clean up image clips whose image file is missing
		if clip.Type == model.ClipTypeImage && clip.DiskName != "" {
			imgPath := filepath.Join(s.storePath, clip.DiskName)
			if _, err := os.Stat(imgPath); os.IsNotExist(err) {
				log.Warnf("removing orphan clip %s: image file %s not found", clip.ID, imgPath)
				s.removeClipFiles(&clip)
				continue
			}
		}

		s.clips[clip.ID] = &clip
		s.sorted = append(s.sorted, &clip)
	}

	// Sort by CreatedAt descending (newest first)
	sort.Slice(s.sorted, func(i, j int) bool {
		return s.sorted[i].CreatedAt.After(s.sorted[j].CreatedAt)
	})

	if expiredCount > 0 {
		log.Infof("cleaned up %d expired clips on startup", expiredCount)
	}
	log.Infof("loaded %d clips from %s", len(s.clips), s.storePath)
	return nil
}

// Save persists clip metadata as {id}.json and inserts it into the in-memory index
// maintaining descending CreatedAt order.
func (s *ClipStore) Save(clip *model.Clip) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.clips[clip.ID]; exists {
		return fmt.Errorf("clip %s already exists", clip.ID)
	}

	data, err := json.MarshalIndent(clip, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal clip: %w", err)
	}

	path := filepath.Join(s.storePath, clip.ID+".json")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write clip file: %w", err)
	}

	s.clips[clip.ID] = clip

	// Insert into sorted slice maintaining descending CreatedAt order
	idx := sort.Search(len(s.sorted), func(i int) bool {
		return s.sorted[i].CreatedAt.Before(clip.CreatedAt)
	})
	s.sorted = append(s.sorted, nil)
	copy(s.sorted[idx+1:], s.sorted[idx:])
	s.sorted[idx] = clip

	return nil
}

// Get returns a clip by ID from the in-memory index.
func (s *ClipStore) Get(id string) (*model.Clip, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	clip, ok := s.clips[id]
	return clip, ok
}

// List returns a page of clips from the in-memory sorted slice along with the total count.
// page is 1-based; size is the number of items per page.
func (s *ClipStore) List(page, size int) ([]*model.Clip, int64) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	total := int64(len(s.sorted))
	start := (page - 1) * size
	if start >= len(s.sorted) {
		return nil, total
	}
	end := start + size
	if end > len(s.sorted) {
		end = len(s.sorted)
	}

	// Return a copy of the slice to avoid data races after releasing the lock
	result := make([]*model.Clip, end-start)
	copy(result, s.sorted[start:end])
	return result, total
}

// Remove deletes the {id}.json metadata file and the image file (if ImageClip),
// then removes the clip from the in-memory index.
func (s *ClipStore) Remove(id string) error {
	s.mu.Lock()
	clip, ok := s.clips[id]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("clip %s not found", id)
	}

	// Remove from map
	delete(s.clips, id)

	// Remove from sorted slice
	for i, c := range s.sorted {
		if c.ID == id {
			s.sorted = append(s.sorted[:i], s.sorted[i+1:]...)
			break
		}
	}
	s.mu.Unlock()

	// Delete metadata file
	jsonPath := filepath.Join(s.storePath, id+".json")
	if err := os.Remove(jsonPath); err != nil && !os.IsNotExist(err) {
		log.Warnf("failed to remove metadata file %s: %v", jsonPath, err)
	}

	// Delete image file if applicable
	if clip.Type == model.ClipTypeImage && clip.DiskName != "" {
		imgPath := filepath.Join(s.storePath, clip.DiskName)
		if err := os.Remove(imgPath); err != nil && !os.IsNotExist(err) {
			log.Warnf("failed to remove image file %s: %v", imgPath, err)
		}
	}

	return nil
}

// ExpiredClips returns all clips whose ExpiresAt is before the current time.
func (s *ClipStore) ExpiredClips() []*model.Clip {
	s.mu.RLock()
	defer s.mu.RUnlock()

	now := time.Now()
	var expired []*model.Clip
	for _, clip := range s.clips {
		if clip.ExpiresAt.Before(now) {
			expired = append(expired, clip)
		}
	}
	return expired
}

// removeClipFiles removes all disk files associated with a valid clip (metadata + image).
func (s *ClipStore) removeClipFiles(clip *model.Clip) {
	jsonPath := filepath.Join(s.storePath, clip.ID+".json")
	if err := os.Remove(jsonPath); err != nil && !os.IsNotExist(err) {
		log.Warnf("failed to remove metadata file %s: %v", jsonPath, err)
	}
	if clip.Type == model.ClipTypeImage && clip.DiskName != "" {
		imgPath := filepath.Join(s.storePath, clip.DiskName)
		if err := os.Remove(imgPath); err != nil && !os.IsNotExist(err) {
			log.Warnf("failed to remove image file %s: %v", imgPath, err)
		}
	}
}
