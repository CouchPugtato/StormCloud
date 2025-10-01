package realtime

import (
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

type Hub struct {
	upgrader websocket.Upgrader
	mu       sync.Mutex
	conns    map[*websocket.Conn]struct{}
}

func NewHub() *Hub {
	return &Hub{
		upgrader: websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }},
		conns:    make(map[*websocket.Conn]struct{}),
	}
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	c, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	h.mu.Lock()
	h.conns[c] = struct{}{}
	h.mu.Unlock()
	go func() {
		defer func() { h.mu.Lock(); delete(h.conns, c); h.mu.Unlock(); c.Close() }()
		for {
			_, msg, err := c.ReadMessage()
			if err != nil {
				return
			}
			h.mu.Lock()
			for conn := range h.conns {
				_ = conn.WriteMessage(websocket.TextMessage, msg)
			}
			h.mu.Unlock()
		}
	}()
}

type HubIface interface {
	ServeWS(w http.ResponseWriter, r *http.Request)
}
