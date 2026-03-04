package ws

import (
	"container/list"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/Mmx233/flashnote/internal/config"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	log "github.com/sirupsen/logrus"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Message type constants.
const (
	MsgConfig     = "config"
	MsgClipCreate = "clip:created"
	MsgClipExpire = "clip:expired"
	MsgPing       = "ping"
)

// Message is the envelope for all WebSocket messages.
type Message struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// Hub manages all active WebSocket clients and broadcasts messages to them.
type Hub struct {
	mu             sync.RWMutex
	clients        map[*Client]struct{}
	limits         config.ServerLimits
	readTimeout    time.Duration
	sendBufferSize int
}

// NewHub creates a Hub with the given server limits, read timeout, and send buffer size.
func NewHub(limits config.ServerLimits, readTimeout time.Duration, sendBufferSize int) *Hub {
	return &Hub{
		clients:        make(map[*Client]struct{}),
		limits:         limits,
		readTimeout:    readTimeout,
		sendBufferSize: sendBufferSize,
	}
}

// Register adds a client to the hub.
func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	h.clients[client] = struct{}{}
	h.mu.Unlock()
}

// Unregister removes a client from the hub and closes its send channel.
func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		close(client.send)
	}
	h.mu.Unlock()
}

// Broadcast sends a message to all registered clients using non-blocking sends.
// Slow clients that can't keep up are skipped (their channel is not blocked).
func (h *Hub) Broadcast(msg *Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Errorf("failed to marshal broadcast message: %v", err)
		return
	}

	slow := list.New()
	func() {
		h.mu.RLock()
		defer h.mu.RUnlock()
		for client := range h.clients {
			select {
			case client.send <- data:
			default:
				slow.PushBack(client)
			}
		}
	}()

	if slow.Len() > 0 {
		h.mu.Lock()
		defer h.mu.Unlock()
		for e := slow.Front(); e != nil; e = e.Next() {
			client := e.Value.(*Client)
			if _, ok := h.clients[client]; ok {
				log.Warnf("kicking slow websocket client %s: send buffer full", client.conn.RemoteAddr())
				delete(h.clients, client)
				close(client.send)
			}
		}
	}
}

// HandleWS is the Gin handler that upgrades HTTP to WebSocket.
// It sends a "config" message as the first message containing ServerLimits,
// sets the read deadline, and starts the client read/write pumps.
func (h *Hub) HandleWS(ctx *gin.Context) {
	conn, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		log.Errorf("websocket upgrade failed: %v", err)
		return
	}

	client := &Client{
		hub:         h,
		conn:        conn,
		send:        make(chan []byte, h.sendBufferSize),
		readTimeout: h.readTimeout,
	}

	h.Register(client)

	// Send config as the first message
	configMsg := &Message{Type: MsgConfig, Data: h.limits}
	configData, err := json.Marshal(configMsg)
	if err != nil {
		log.Errorf("failed to marshal config message: %v", err)
	} else {
		client.send <- configData
	}

	// Set initial read deadline
	conn.SetReadDeadline(time.Now().Add(h.readTimeout))

	go client.WritePump()
	go client.ReadPump()
}
