package api

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func Router(db *sql.DB, hub HubIface) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.Logger, middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/teams", TeamsSearch(db))
		r.Get("/teams/{team_key}", TeamGet(db))
		r.Get("/teams/{team_key}/schedule", TeamSchedule(db))

		r.Get("/events/{event_key}/matches", EventMatches(db))

		r.Get("/form/{year}", FormJSON(db)) // returns the current JSON form spec
		r.Post("/scout/submit", ScoutSubmit(db))

		r.Get("/notes", NotesList(db))
		r.Post("/notes", NotesCreate(db))

		r.Post("/devices", DeviceRegister(db)) // register push tokens
	})

	// WebSocket for messaging
	r.Get("/ws", hub.ServeWS)

	return r
}
