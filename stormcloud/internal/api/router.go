package api

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/CouchPugtato/StormCloud/internal/realtime"
	"github.com/CouchPugtato/StormCloud/internal/ingest"
	"github.com/CouchPugtato/StormCloud/internal/jobs"
)

func Router(db *sql.DB, hub realtime.HubIface, syncService *ingest.SyncService, scheduler *jobs.Scheduler) http.Handler {
	r := chi.NewRouter()
	
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:8082", "http://localhost:3000", "*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	
	r.Use(middleware.RequestID, middleware.Logger, middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/teams", TeamsSearch(db))
		r.Get("/teams/{team_key}", TeamGet(db))
		r.Get("/teams/{team_key}/schedule", TeamSchedule(db))
		r.Get("/teams/{team_key}/notes", TeamNotesGet(db))
		r.Put("/teams/{team_key}/notes", TeamNotesUpdate(db))

		r.Get("/events", EventsList(db, syncService))
		r.Get("/events/{event_key}", EventGet(db))
		r.Get("/events/{event_key}/matches", EventMatches(db))

		r.Get("/form/{year}", FormJSON(db)) // returns the current JSON form spec
		r.Post("/scout/submit", ScoutSubmit(db))
		
		r.Post("/match-scouting", MatchScoutingSubmit(db))
		r.Get("/match-scouting/{match_key}/{team_key}", MatchScoutingGet(db))
		r.Get("/teams/{team_key}/match-scouting", TeamMatchScoutingGet(db))
		
		r.Post("/pit-scouting", PitScoutingSubmit(db))
		r.Get("/pit-scouting/{team_key}/{event_key}", PitScoutingGet(db))

		r.Get("/notes", NotesList(db))
		r.Post("/notes", NotesCreate(db))

		r.Post("/devices", DeviceRegister(db)) // register push tokens
		
		r.Get("/event-mode", EventModeGet(scheduler))
		r.Post("/event-mode", EventModeSet(scheduler))
	})

	r.Get("/ws", hub.ServeWS)

	return r
}
