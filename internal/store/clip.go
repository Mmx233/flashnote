package store

import (
	"container/list"
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

// clipEntry holds a clip pointer and its positions in both sorted lists.
type clipEntry struct {
	clip     *model.Clip
	sortedEl *list.Element // position in byCreated (CreatedAt desc)
	expiryEl *list.Element // position in byExpiry (ExpiresAt asc)
}

// ClipStore manages clip persistence on disk and an in-memory index for fast queries.
type ClipStore struct {
	mu          sync.RWMutex
	clips       map[string]*clipEntry // keyed by ID
	byCreated   *list.List            // CreatedAt desc, values are *model.Clip
	byExpiry    *list.List            // ExpiresAt asc, values are *model.Clip
	expiryTimer *time.Timer           // fires when the earliest clip expires; nil if no clips
	expiryKick  chan struct{}         // closed by Save when a new clip becomes the earliest
	storePath   string
}

// NewClipStore creates a ClipStore rooted at the given directory.
func NewClipStore(storePath string) *ClipStore {
	return &ClipStore{
		clips:      make(map[string]*clipEntry),
		byCreated:  list.New(),
		byExpiry:   list.New(),
		expiryKick: make(chan struct{}),
		storePath:  storePath,
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

	// Collect valid clips first, then sort and insert into list
	var valid []*model.Clip

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

		s.clips[clip.ID] = &clipEntry{clip: &clip}
		valid = append(valid, &clip)
	}

	// Build byExpiry list (ExpiresAt ascending)
	sort.Slice(valid, func(i, j int) bool {
		return valid[i].ExpiresAt.Before(valid[j].ExpiresAt)
	})
	for _, clip := range valid {
		s.clips[clip.ID].expiryEl = s.byExpiry.PushBack(clip)
	}

	// Sort by CreatedAt descending (newest first)
	sort.Slice(valid, func(i, j int) bool {
		return valid[i].CreatedAt.After(valid[j].CreatedAt)
	})

	for _, clip := range valid {
		s.clips[clip.ID].sortedEl = s.byCreated.PushBack(clip)
	}

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

	// Insert into byCreated list maintaining descending CreatedAt order
	var elem *list.Element
	for e := s.byCreated.Front(); e != nil; e = e.Next() {
		if e.Value.(*model.Clip).CreatedAt.Before(clip.CreatedAt) {
			elem = s.byCreated.InsertBefore(clip, e)
			break
		}
	}
	if elem == nil {
		elem = s.byCreated.PushBack(clip)
	}

	// Insert into byExpiry list maintaining ascending ExpiresAt order
	var expiryEl *list.Element
	for e := s.byExpiry.Back(); e != nil; e = e.Prev() {
		if !e.Value.(*model.Clip).ExpiresAt.After(clip.ExpiresAt) {
			expiryEl = s.byExpiry.InsertAfter(clip, e)
			break
		}
	}
	if expiryEl == nil {
		expiryEl = s.byExpiry.PushFront(clip)
	}

	s.clips[clip.ID] = &clipEntry{clip: clip, sortedEl: elem, expiryEl: expiryEl}

	// If this clip is now the earliest to expire, kick the cleaner to reschedule.
	if s.byExpiry.Front() == expiryEl {
		close(s.expiryKick)
		s.expiryKick = make(chan struct{})
	}

	return nil
}

// Get returns a clip by ID from the in-memory index.
func (s *ClipStore) Get(id string) (*model.Clip, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entry, ok := s.clips[id]
	if !ok {
		return nil, false
	}
	return entry.clip, true
}

// ListAll returns all clips from the in-memory byCreated list.
func (s *ClipStore) ListAll() []*model.Clip {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*model.Clip, 0, s.byCreated.Len())
	for e := s.byCreated.Front(); e != nil; e = e.Next() {
		result = append(result, e.Value.(*model.Clip))
	}
	return result
}

// Remove deletes the {id}.json metadata file and the image file (if ImageClip),
// then removes the clip from the in-memory index.
func (s *ClipStore) Remove(id string) error {
	s.mu.Lock()
	entry, ok := s.clips[id]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("clip %s not found", id)
	}

	// Remove from map and both lists (O(1))
	delete(s.clips, id)
	s.byCreated.Remove(entry.sortedEl)
	s.byExpiry.Remove(entry.expiryEl)
	s.mu.Unlock()

	// Delete files outside lock
	s.removeClipFiles(entry.clip)
	return nil
}

// ExpiredClips returns all clips whose ExpiresAt is before the current time.
// It resets the internal timer to fire when the next clip expires.
// Returns: expired clips, timer channel (nil if no clips remain), kick channel
// that is closed when a new clip becomes the earliest to expire.
func (s *ClipStore) ExpiredClips() (expired []*model.Clip, timerCh <-chan time.Time, kick <-chan struct{}) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Stop previous timer
	if s.expiryTimer != nil {
		s.expiryTimer.Stop()
		s.expiryTimer = nil
	}

	now := time.Now()
	for e := s.byExpiry.Front(); e != nil; e = e.Next() {
		clip := e.Value.(*model.Clip)
		if !clip.ExpiresAt.Before(now) {
			break
		}
		expired = append(expired, clip)
	}

	// Find the next non-expired clip (skip over the ones we just collected)
	e := s.byExpiry.Front()
	for i := 0; i < len(expired) && e != nil; i++ {
		e = e.Next()
	}
	if e != nil {
		next := e.Value.(*model.Clip)
		d := time.Until(next.ExpiresAt)
		if d < 0 {
			d = 0
		}
		s.expiryTimer = time.NewTimer(d)
		timerCh = s.expiryTimer.C
	}

	kick = s.expiryKick
	return
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
