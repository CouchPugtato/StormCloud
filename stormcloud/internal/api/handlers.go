package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

// --- helpers
func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

// --- TEAMS

func TeamsSearch(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := strings.TrimSpace(r.URL.Query().Get("search"))
		if q == "" {
			writeJSON(w, 200, []any{})
			return
		}
		// simple search by number or name
		rows, err := db.Query(`
			SELECT team_key, team_num, name, city, state, country, rookie_year
			FROM teams
			WHERE CAST(team_num AS TEXT) LIKE ? OR LOWER(name) LIKE LOWER(?)
			ORDER BY team_num ASC LIMIT 100
		`, q+"%", "%"+q+"%")
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		type team struct {
			TeamKey string `json:"team_key"`
			TeamNum int    `json:"team_num"`
			Name    string `json:"name"`
		}
		var out []team
		for rows.Next() {
			var t team
			_ = rows.Scan(&t.TeamKey, &t.TeamNum, &t.Name, new(string), new(string), new(string), new(int))
			out = append(out, t)
		}
		writeJSON(w, 200, out)
	}
}

func TeamGet(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := chi.URLParam(r, "team_key")
		row := db.QueryRow(`SELECT team_key, team_num, name, city, state, country, rookie_year FROM teams WHERE team_key=?`, key)
		var t struct {
			TeamKey string `json:"team_key"`
			TeamNum int    `json:"team_num"`
			Name    string `json:"name"`
			City    string `json:"city"`
			State   string `json:"state"`
			Country string `json:"country"`
			Rookie  int    `json:"rookie_year"`
		}
		if err := row.Scan(&t.TeamKey, &t.TeamNum, &t.Name, &t.City, &t.State, &t.Country, &t.Rookie); err != nil {
			writeJSON(w, 404, map[string]string{"error": "not found"})
			return
		}
		// TODO: join in Statbotics EPA from epa_team_year
		writeJSON(w, 200, t)
	}
}

func TeamSchedule(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := chi.URLParam(r, "team_key")     // "frc509"
		eventKey := r.URL.Query().Get("event") // "2025nhgrs"
		if eventKey == "" {
			writeJSON(w, 400, map[string]string{"error": "event required"})
			return
		}

		rows, err := db.Query(`
			SELECT match_key, time_real, time_pred, blue_teams, red_teams, blue_score, red_score
			FROM matches WHERE event_key=? ORDER BY comp_level, set_number, match_number
		`, eventKey)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		type item struct {
			MatchKey string `json:"match_key"`
			When     int64  `json:"when"`
			Pred     int64  `json:"predicted"`
			Side     string `json:"side"` // "blue" or "red" if contains team
		}
		var out []item
		for rows.Next() {
			var mk string
			var tr, tp sql.NullInt64
			var blue, red, bs, rs any
			_ = rows.Scan(&mk, &tr, &tp, &blue, &red, &bs, &rs)
			side := ""
			if strings.Contains(string(mustJSON(blue)), key) {
				side = "blue"
			}
			if strings.Contains(string(mustJSON(red)), key) {
				side = "red"
			}
			out = append(out, item{MatchKey: mk, When: tr.Int64, Pred: tp.Int64, Side: side})
		}
		writeJSON(w, 200, out)
	}
}

func mustJSON(v any) []byte { b, _ := json.Marshal(v); return b }

// --- EVENTS / MATCHES
func EventMatches(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		eventKey := chi.URLParam(r, "event_key")
		rows, err := db.Query(`SELECT match_key, blue_teams, red_teams, blue_score, red_score FROM matches WHERE event_key=? ORDER BY comp_level, set_number, match_number`, eventKey)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()
		type M struct {
			MatchKey  string `json:"match_key"`
			BlueTeams any    `json:"blue_teams"`
			RedTeams  any    `json:"red_teams"`
			BlueScore int    `json:"blue_score"`
			RedScore  int    `json:"red_score"`
		}
		var out []M
		for rows.Next() {
			var m M
			_ = rows.Scan(&m.MatchKey, &m.BlueTeams, &m.RedTeams, &m.BlueScore, &m.RedScore)
			out = append(out, m)
		}
		writeJSON(w, 200, out)
	}
}

// --- FORM (JSON-defined scouting form)
func FormJSON(_ *sql.DB) http.HandlerFunc {
	// In production, fetch from DB or versioned /form/{year}.json file.
	type field struct {
		Key, Label, Type string
		Options          []string `json:"options,omitempty"`
	}
	resp := map[string]any{
		"version": "2025.1",
		"fields": []field{
			{Key: "auto_coral_l4", Label: "Auto Coral L4", Type: "number"},
			{Key: "climb_level", Label: "Climb Level", Type: "select", Options: []string{"None", "Low", "Mid", "High", "Traversal"}},
			{Key: "driver_notes", Label: "Driver Notes", Type: "textarea"},
		},
	}
	return func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, resp) }
}

func ScoutSubmit(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "invalid json"})
			return
		}
		// TODO: validate against schema; store in a new table
		writeJSON(w, 200, map[string]any{"ok": true})
	}
}

// --- NOTES
func NotesList(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		match := r.URL.Query().Get("match_key")
		var rows *sql.Rows
		var err error
		if match != "" {
			rows, err = db.Query(`SELECT id, match_key, team_key, author, note, created_at FROM notes WHERE match_key=? ORDER BY id DESC`, match)
		} else {
			rows, err = db.Query(`SELECT id, match_key, team_key, author, note, created_at FROM notes ORDER BY id DESC LIMIT 100`)
		}
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()
		type N struct {
			ID                              int
			MatchKey, TeamKey, Author, Note string
			CreatedAt                       int64
		}
		var out []N
		for rows.Next() {
			var n N
			_ = rows.Scan(&n.ID, &n.MatchKey, &n.TeamKey, &n.Author, &n.Note, &n.CreatedAt)
			out = append(out, n)
		}
		writeJSON(w, 200, out)
	}
}

func NotesCreate(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct{ MatchKey, TeamKey, Author, Note string }
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}
		now := time.Now().Unix()
		res, err := db.Exec(`INSERT INTO notes(match_key, team_key, author, note, created_at) VALUES(?,?,?,?,?)`,
			in.MatchKey, in.TeamKey, in.Author, in.Note, now)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		id, _ := res.LastInsertId()
		writeJSON(w, 201, map[string]any{"id": id})
	}
}

// --- DEVICES (push token registration)
func DeviceRegister(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct{ UserID, Platform, Token string }
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}
		if in.UserID == "" || in.Token == "" {
			writeJSON(w, 400, map[string]string{"error": "user_id and token required"})
			return
		}
		_, err := db.Exec(`INSERT OR IGNORE INTO device_tokens(user_id, platform, token) VALUES(?,?,?)`, in.UserID, in.Platform, in.Token)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, 200, map[string]any{"ok": true})
	}
}
