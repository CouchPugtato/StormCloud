package api

import (
	"database/sql"
	"net/http"
	"os"
	"strings"

	"github.com/CouchPugtato/StormCloud/internal/ingest"
	"github.com/CouchPugtato/StormCloud/internal/jobs"
	"github.com/CouchPugtato/StormCloud/internal/realtime"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func Router(db *sql.DB, hub realtime.HubIface, syncService *ingest.SyncService, scheduler *jobs.Scheduler) http.Handler {
	r := chi.NewRouter()

	// Configure CORS from environment, with APP_ENV-aware defaults.
	allowedOriginsEnv := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if allowedOriginsEnv == "" {
		allowedOriginsEnv = strings.TrimSpace(os.Getenv("ALLOWED_ORIGINS"))
	}
	var allowedOrigins []string
	if allowedOriginsEnv != "" {
		parts := strings.Split(allowedOriginsEnv, ",")
		for _, p := range parts {
			t := strings.TrimSpace(p)
			if t != "" {
				allowedOrigins = append(allowedOrigins, t)
			}
		}
	}

	appEnv := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if appEnv == "" {
		appEnv = "development"
	}
	if len(allowedOrigins) == 0 {
		if appEnv == "production" {
			allowedOrigins = []string{"https://redstormcloud.com"}
		} else {
			allowedOrigins = []string{"http://localhost:*", "http://127.0.0.1:*"}
		}
	} else if appEnv != "production" {
		allowedOrigins = append(allowedOrigins, "http://localhost:*", "http://127.0.0.1:*")
	}

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Use(middleware.RequestID, middleware.Logger, middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	// JSON health endpoint at root for proxies that strip the /api prefix
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, map[string]string{"status": "ok"}) })

	// Allow configuring API base path via environment (default: /api)
	apiBasePath := strings.TrimSpace(os.Getenv("API_BASE_PATH"))
	if apiBasePath == "" {
		apiBasePath = "/api"
	}

	r.Route(apiBasePath, func(r chi.Router) {
		// JSON health endpoint under the API base path (e.g., /api/health)
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, map[string]string{"status": "ok"}) })
		r.Get("/teams", TeamsSearch(db))
		r.Get("/teams/{team_key}", TeamGet(db))
		r.Get("/teams/{team_key}/schedule", TeamSchedule(db))
		r.Get("/teams/{team_key}/notes", TeamNotesGet(db))
		r.Put("/teams/{team_key}/notes", TeamNotesUpdate(db))

		r.Get("/events", EventsList(db, syncService))
		r.Get("/events/{event_key}", EventGet(db))
		r.Get("/events/{event_key}/matches", EventMatches(db))

		r.Get("/form/{year}", FormJSON(db))
		r.Post("/scout/submit", ScoutSubmit(db))

		r.Post("/match-scouting", MatchScoutingSubmit(db))
		r.Get("/match-scouting/{match_key}/{team_key}", MatchScoutingGet(db))
		r.Get("/teams/{team_key}/match-scouting", TeamMatchScoutingGet(db))

		r.Post("/pit-scouting", PitScoutingSubmit(db))
		r.Get("/pit-scouting/{team_key}/{event_key}", PitScoutingGet(db))

		r.Get("/notes", NotesList(db))
		r.Post("/notes", NotesCreate(db))

		r.Post("/devices", DeviceRegister(db))
		r.Post("/devices/unregister", DeviceUnregister(db))
		r.Get("/push/public-key", PushPublicKey())
		r.Post("/push/subscribe-web", WebPushSubscribe(db))
		r.Post("/push/unsubscribe-web", WebPushUnsubscribe(db))
		r.Post("/push/test", PushTest(db))

		r.Post("/auth", AuthenticatePassword())
		r.Get("/app-settings", AppSettingsGet())
		r.Get("/clerk/users", ClerkUsersList())
		r.Post("/clerk/users/role", ClerkUserRoleUpdate())

		r.Get("/event-mode", EventModeGet(scheduler))
		r.Post("/event-mode", EventModeSet(scheduler))

		r.Get("/pick-list", PickListGet(db))
		r.Post("/pick-list", PickListSave(db))
	})

	r.Get("/ws", hub.ServeWS)

	return r
}
