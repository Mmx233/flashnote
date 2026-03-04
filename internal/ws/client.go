package ws

import (
	"time"

	"github.com/gorilla/websocket"
	log "github.com/sirupsen/logrus"
)

// Client represents a single WebSocket connection managed by the Hub.
type Client struct {
	hub         *Hub
	conn        *websocket.Conn
	send        chan []byte
	readTimeout time.Duration
}

// ReadPump reads messages from the WebSocket connection.
// On each received message it resets the read deadline.
// When the connection closes or the read deadline expires, it unregisters from the Hub.
func (c *Client) ReadPump() {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close()
	}()

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Warnf("websocket read error: %v", err)
			}
			return
		}

		// Reset read deadline on every received message (including ping)
		c.conn.SetReadDeadline(time.Now().Add(c.readTimeout))
	}
}

// WritePump writes messages from the send channel to the WebSocket connection.
func (c *Client) WritePump() {
	defer c.conn.Close()

	for msg := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Warnf("websocket write error: %v", err)
			return
		}
	}
}
