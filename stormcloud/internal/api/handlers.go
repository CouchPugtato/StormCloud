package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/CouchPugtato/StormCloud/internal/ingest"
	"github.com/CouchPugtato/StormCloud/internal/jobs"
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
		limit := 100
		if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
			if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 1000 {
				limit = parsedLimit
			}
		}

		var rows *sql.Rows
		var err error

		if q == "" {
			rows, err = db.Query(`
				SELECT team_key, team_num, name, city, state, country, rookie_year
				FROM teams
				ORDER BY team_num ASC LIMIT ?
			`, limit)
		} else {
			// search by number or name
			rows, err = db.Query(`
				SELECT team_key, team_num, name, city, state, country, rookie_year
				FROM teams
				WHERE CAST(team_num AS TEXT) LIKE ? OR LOWER(name) LIKE LOWER(?)
				ORDER BY team_num ASC LIMIT ?
			`, q+"%", "%"+q+"%", limit)
		}

		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		type team struct {
			TeamKey    string `json:"team_key"`
			TeamNum    int    `json:"team_num"`
			Name       string `json:"name"`
			City       string `json:"city"`
			State      string `json:"state"`
			Country    string `json:"country"`
			RookieYear int    `json:"rookie_year"`
		}
		var out []team
		for rows.Next() {
			var t team
			_ = rows.Scan(&t.TeamKey, &t.TeamNum, &t.Name, &t.City, &t.State, &t.Country, &t.RookieYear)
			out = append(out, t)
		}
		writeJSON(w, 200, out)
	}
}

func TeamGet(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := chi.URLParam(r, "team_key")
		row := db.QueryRow(`SELECT team_key, team_num, name, city, state, country, rookie_year, COALESCE(pit_notes, '') as pit_notes, COALESCE(scouting_notes, '') as scouting_notes FROM teams WHERE team_key=?`, key)
		var t struct {
			TeamKey       string                 `json:"team_key"`
			TeamNum       int                    `json:"team_num"`
			Name          string                 `json:"name"`
			City          string                 `json:"city"`
			State         string                 `json:"state"`
			Country       string                 `json:"country"`
			Rookie        int                    `json:"rookie_year"`
			PitNotes      string                 `json:"pit_notes"`
			ScoutingNotes string                 `json:"scouting_notes"`
			EPA           map[string]interface{} `json:"epa,omitempty"`
		}
		if err := row.Scan(&t.TeamKey, &t.TeamNum, &t.Name, &t.City, &t.State, &t.Country, &t.Rookie, &t.PitNotes, &t.ScoutingNotes); err != nil {
			writeJSON(w, 404, map[string]string{"error": "not found"})
			return
		}

		epaYear := os.Getenv("CURRENT_YEAR")
		epaRow := db.QueryRow(`SELECT payload FROM epa_team_year WHERE team_num=? AND year=?`, t.TeamNum, epaYear)
		var epaJSON string
		if err := epaRow.Scan(&epaJSON); err == nil {
			var epaData map[string]interface{}
			if json.Unmarshal([]byte(epaJSON), &epaData) == nil {
				t.EPA = epaData
			}
		}

		writeJSON(w, 200, t)
	}
}

func TeamSchedule(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := chi.URLParam(r, "team_key")
		eventKey := r.URL.Query().Get("event")
		if eventKey == "" {
			writeJSON(w, 400, map[string]string{"error": "event required"})
			return
		}

		rows, err := db.Query(`
			SELECT match_key, time_real, time_pred, blue_teams, red_teams, blue_score, red_score
			FROM matches
			WHERE event_key=?
			ORDER BY
				CASE comp_level
					WHEN 'qm' THEN 1
					WHEN 'ef' THEN 2
					WHEN 'qf' THEN 3
					WHEN 'sf' THEN 4
					WHEN 'f' THEN 5
					ELSE 6
				END,
				set_number,
				match_number
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
func EventsList(db *sql.DB, syncService *ingest.SyncService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		year := strings.TrimSpace(r.URL.Query().Get("year"))

		configuredKeys := syncService.GetConfiguredTBAKeys()
		if len(configuredKeys) == 0 {
			writeJSON(w, 200, []interface{}{})
			return
		}

		placeholders := strings.Repeat("?,", len(configuredKeys)-1) + "?"
		query := fmt.Sprintf(`
			SELECT event_key, name, city, state, country, start_date, end_date
			FROM events
			WHERE event_key IN (%s)
		`, placeholders)
		args := make([]interface{}, 0, len(configuredKeys)+1)
		for _, key := range configuredKeys {
			args = append(args, key)
		}
		if year != "" {
			query += " AND year=?"
			args = append(args, year)
		}
		query += " ORDER BY start_date"

		rows, err := db.Query(query, args...)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		type Event struct {
			EventKey  string `json:"event_key"`
			Name      string `json:"name"`
			City      string `json:"city"`
			State     string `json:"state"`
			Country   string `json:"country"`
			StartDate string `json:"start_date"`
			EndDate   string `json:"end_date"`
		}
		out := make([]Event, 0)
		for rows.Next() {
			var e Event
			_ = rows.Scan(&e.EventKey, &e.Name, &e.City, &e.State, &e.Country, &e.StartDate, &e.EndDate)
			out = append(out, e)
		}
		writeJSON(w, 200, out)
	}
}

// --- PICK LIST

// PickListGet returns the pick list items for an optional event_key, ordered by rank
func PickListGet(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		eventKey := strings.TrimSpace(r.URL.Query().Get("event_key"))

		var rows *sql.Rows
		var err error
		if eventKey == "" {
			rows, err = db.Query(`
                SELECT pli.id, pli.event_key, pli.team_key, pli.team_num, pli.rank,
                       COALESCE(pli.notes,''), pli.struck_through,
                       t.name, t.city, t.state
                FROM pick_list_items pli
                LEFT JOIN teams t ON t.team_key = pli.team_key
                WHERE pli.event_key IS NULL
                ORDER BY pli.rank ASC
            `)
		} else {
			rows, err = db.Query(`
                SELECT pli.id, pli.event_key, pli.team_key, pli.team_num, pli.rank,
                       COALESCE(pli.notes,''), pli.struck_through,
                       t.name, t.city, t.state
                FROM pick_list_items pli
                LEFT JOIN teams t ON t.team_key = pli.team_key
                WHERE pli.event_key=?
                ORDER BY pli.rank ASC
            `, eventKey)
		}
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		type item struct {
			ID            int    `json:"id"`
			EventKey      string `json:"event_key,omitempty"`
			TeamKey       string `json:"team_key"`
			TeamNum       int    `json:"team_num"`
			Rank          int    `json:"rank"`
			Notes         string `json:"notes"`
			StruckThrough bool   `json:"struck_through"`
			Name          string `json:"name"`
			City          string `json:"city"`
			State         string `json:"state"`
		}
		// initialize to non-nil empty slice so JSON encodes as [] not null
		out := make([]item, 0)
		for rows.Next() {
			var it item
			var struckInt int
			var event sql.NullString
			if err := rows.Scan(&it.ID, &event, &it.TeamKey, &it.TeamNum, &it.Rank, &it.Notes, &struckInt, &it.Name, &it.City, &it.State); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			if event.Valid {
				it.EventKey = event.String
			}
			it.StruckThrough = struckInt == 1
			out = append(out, it)
		}
		writeJSON(w, 200, out)
	}
}

// PickListSave replaces the pick list for an event_key (or global when event_key is empty)
func PickListSave(db *sql.DB) http.HandlerFunc {
	type inItem struct {
		TeamKey       string `json:"team_key"`
		TeamNum       int    `json:"team_num"`
		Rank          int    `json:"rank"`
		Notes         string `json:"notes"`
		StruckThrough bool   `json:"struck_through"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			EventKey string   `json:"event_key"`
			Items    []inItem `json:"items"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}
		tx, err := db.Begin()
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer func() { _ = tx.Rollback() }()

		if in.EventKey == "" {
			if _, err := tx.Exec(`DELETE FROM pick_list_items WHERE event_key IS NULL`); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
		} else {
			if _, err := tx.Exec(`DELETE FROM pick_list_items WHERE event_key=?`, in.EventKey); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
		}

		stmt, err := tx.Prepare(`
            INSERT INTO pick_list_items(event_key, team_key, team_num, rank, notes, struck_through)
            VALUES(?,?,?,?,?,?)
        `)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer stmt.Close()

		for _, it := range in.Items {
			struck := 0
			if it.StruckThrough {
				struck = 1
			}
			var args []interface{}
			if in.EventKey == "" {
				args = []interface{}{nil, it.TeamKey, it.TeamNum, it.Rank, it.Notes, struck}
			} else {
				args = []interface{}{in.EventKey, it.TeamKey, it.TeamNum, it.Rank, it.Notes, struck}
			}
			if _, err := stmt.Exec(args...); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, 200, map[string]any{"ok": true, "count": len(in.Items)})
	}
}

func EventGet(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		eventKey := chi.URLParam(r, "event_key")
		row := db.QueryRow(`
			SELECT event_key, year, name, city, state, country, start_date, end_date 
			FROM events WHERE event_key=?
		`, eventKey)

		var e struct {
			EventKey  string `json:"event_key"`
			Year      int    `json:"year"`
			Name      string `json:"name"`
			City      string `json:"city"`
			State     string `json:"state"`
			Country   string `json:"country"`
			StartDate string `json:"start_date"`
			EndDate   string `json:"end_date"`
		}
		if err := row.Scan(&e.EventKey, &e.Year, &e.Name, &e.City, &e.State, &e.Country, &e.StartDate, &e.EndDate); err != nil {
			writeJSON(w, 404, map[string]string{"error": "event not found"})
			return
		}
		writeJSON(w, 200, e)
	}
}

func EventMatches(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		eventKey := chi.URLParam(r, "event_key")
		rows, err := db.Query(`
			SELECT match_key, comp_level, set_number, match_number, 
			       time_real, time_pred, blue_teams, red_teams, blue_score, red_score 
			FROM matches
			WHERE event_key=?
			ORDER BY
				CASE comp_level
					WHEN 'qm' THEN 1
					WHEN 'ef' THEN 2
					WHEN 'qf' THEN 3
					WHEN 'sf' THEN 4
					WHEN 'f' THEN 5
					ELSE 6
				END,
				set_number,
				match_number
		`, eventKey)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		type Match struct {
			MatchKey    string   `json:"match_key"`
			CompLevel   string   `json:"comp_level"`
			SetNumber   int      `json:"set_number"`
			MatchNumber int      `json:"match_number"`
			TimeReal    int64    `json:"time_real"`
			TimePred    int64    `json:"time_pred"`
			BlueTeams   []string `json:"blue_teams"`
			RedTeams    []string `json:"red_teams"`
			BlueScore   int      `json:"blue_score"`
			RedScore    int      `json:"red_score"`
		}
		var out []Match
		for rows.Next() {
			var m Match
			var blueJSON, redJSON string
			_ = rows.Scan(&m.MatchKey, &m.CompLevel, &m.SetNumber, &m.MatchNumber,
				&m.TimeReal, &m.TimePred, &blueJSON, &redJSON, &m.BlueScore, &m.RedScore)

			json.Unmarshal([]byte(blueJSON), &m.BlueTeams)
			json.Unmarshal([]byte(redJSON), &m.RedTeams)

			out = append(out, m)
		}
		writeJSON(w, 200, out)
	}
}

// --- FORM (JSON-defined scouting form)
func FormJSON(_ *sql.DB) http.HandlerFunc {
	type field struct {
		Key, Label, Type string
		Options          []string `json:"options,omitempty"`
	}
	resp := map[string]any{
		"version": "2025.1",
		"fields": []field{
			{Key: "auto_coral_l4", Label: "Auto Coral L4", Type: "number"},
			{Key: "climb_level", Label: "Climb Level", Type: "select", Options: []string{"None", "Traversal", "Low", "High"}},
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
		writeJSON(w, 200, map[string]any{"ok": true})
	}
}

// --- AUTHENTICATION
func AuthenticatePassword() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct{ Password string }
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		expectedPassword := os.Getenv("ACCESS_PASSWORD")
		if expectedPassword == "" {
			writeJSON(w, 500, map[string]string{"error": "server configuration error"})
			return
		}

		if in.Password == expectedPassword {
			writeJSON(w, 200, map[string]any{"authenticated": true})
		} else {
			writeJSON(w, 401, map[string]string{"error": "invalid password"})
		}
	}
}

// --- APP SETTINGS
func AppSettingsGet() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		settings := map[string]string{
			"twitch_channel_url": os.Getenv("TWITCH_CHANNEL_URL"),
		}
		writeJSON(w, 200, settings)
	}
}

// --- EVENT MODE
func EventModeGet(scheduler *jobs.Scheduler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		isEventMode := scheduler.IsEventMode()
		writeJSON(w, 200, map[string]any{
			"event_mode": isEventMode,
			"message": func() string {
				if isEventMode {
					return "Event Mode is enabled - server updates every 3 minutes"
				}
				return "Event Mode is disabled - server updates every 2 hours"
			}(),
		})
	}
}

func EventModeSet(scheduler *jobs.Scheduler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			EventMode bool `json:"event_mode"`
		}

		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "invalid json"})
			return
		}

		scheduler.SetEventMode(payload.EventMode)

		writeJSON(w, 200, map[string]any{
			"event_mode": payload.EventMode,
			"message": func() string {
				if payload.EventMode {
					return "Event Mode enabled - server will now update every 3 minutes"
				}
				return "Event Mode disabled - server will now update every 2 hours"
			}(),
		})
	}
}

// --- MATCH SCOUTING DATA
func MatchScoutingSubmit(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var data struct {
			MatchKey  string `json:"match_key"`
			TeamKey   string `json:"team_key"`
			ScoutName string `json:"scout_name"`

			AutoCoralL1        int  `json:"auto_coral_l1"`
			AutoCoralL2        int  `json:"auto_coral_l2"`
			AutoCoralL3        int  `json:"auto_coral_l3"`
			AutoCoralL4        int  `json:"auto_coral_l4"`
			AutoAlgaeNet       int  `json:"auto_algae_net"`
			AutoAlgaeProcessor int  `json:"auto_algae_processor"`
			AutoReef           int  `json:"auto_reef"`
			AutoMobility       bool `json:"auto_mobility"`

			TeleopCoralL1        int `json:"teleop_coral_l1"`
			TeleopCoralL2        int `json:"teleop_coral_l2"`
			TeleopCoralL3        int `json:"teleop_coral_l3"`
			TeleopCoralL4        int `json:"teleop_coral_l4"`
			TeleopAlgaeNet       int `json:"teleop_algae_net"`
			TeleopAlgaeProcessor int `json:"teleop_algae_processor"`
			TeleopReef           int `json:"teleop_reef"`

			ClimbLevel string `json:"climb_level"`
			ClimbTime  int    `json:"climb_time"`

			DefenseRating   int `json:"defense_rating"`
			SpeedRating     int `json:"speed_rating"`
			StabilityRating int `json:"stability_rating"`

			RobotBroke   bool   `json:"robot_broke"`
			GeneralNotes string `json:"general_notes"`
		}

		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			writeJSON(w, 400, map[string]string{"error": "invalid json"})
			return
		}

		if data.MatchKey == "" || data.TeamKey == "" {
			writeJSON(w, 400, map[string]string{"error": "match_key and team_key are required"})
			return
		}

		teamNumStr := strings.TrimPrefix(data.TeamKey, "frc")
		teamNum, err := strconv.Atoi(teamNumStr)
		if err != nil {
			writeJSON(w, 400, map[string]string{"error": "invalid team_key format"})
			return
		}

		_, err = db.Exec(`
			INSERT OR IGNORE INTO teams (team_key, team_num, name, last_synced)
			VALUES (?, ?, ?, ?)
		`, data.TeamKey, teamNum, fmt.Sprintf("Team %d", teamNum), time.Now().Unix())
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": "failed to create team: " + err.Error()})
			return
		}

		_, err = db.Exec(`
			INSERT OR IGNORE INTO matches (match_key, comp_level, match_number)
			VALUES (?, ?, ?)
		`, data.MatchKey, "qm", 1) // Default to qualification match
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": "failed to create match: " + err.Error()})
			return
		}

		_, err = db.Exec(`
			INSERT OR REPLACE INTO match_scouting_data (
				match_key, team_key, scout_name,
				auto_coral_l1, auto_coral_l2, auto_coral_l3, auto_coral_l4,
				auto_algae_net, auto_algae_processor, auto_reef, auto_mobility,
				teleop_coral_l1, teleop_coral_l2, teleop_coral_l3, teleop_coral_l4,
				teleop_algae_net, teleop_algae_processor, teleop_reef,
				climb_level, climb_time,
				defense_rating, speed_rating, stability_rating,
				robot_broke, general_notes
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, data.MatchKey, data.TeamKey, data.ScoutName,
			data.AutoCoralL1, data.AutoCoralL2, data.AutoCoralL3, data.AutoCoralL4,
			data.AutoAlgaeNet, data.AutoAlgaeProcessor, data.AutoReef, data.AutoMobility,
			data.TeleopCoralL1, data.TeleopCoralL2, data.TeleopCoralL3, data.TeleopCoralL4,
			data.TeleopAlgaeNet, data.TeleopAlgaeProcessor, data.TeleopReef,
			data.ClimbLevel, data.ClimbTime,
			data.DefenseRating, data.SpeedRating, data.StabilityRating,
			data.RobotBroke, data.GeneralNotes)

		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{"ok": true})
	}
}

func MatchScoutingGet(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		matchKey := chi.URLParam(r, "match_key")
		teamKey := chi.URLParam(r, "team_key")

		if matchKey == "" {
			writeJSON(w, 400, map[string]string{"error": "match_key is required"})
			return
		}

		var query string
		var args []interface{}

		if teamKey != "" {
			query = `SELECT * FROM match_scouting_data WHERE match_key=? AND team_key=?`
			args = []interface{}{matchKey, teamKey}
		} else {
			query = `SELECT * FROM match_scouting_data WHERE match_key=?`
			args = []interface{}{matchKey}
		}

		rows, err := db.Query(query, args...)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		type ScoutingData struct {
			ID        int    `json:"id"`
			MatchKey  string `json:"match_key"`
			TeamKey   string `json:"team_key"`
			ScoutName string `json:"scout_name"`

			AutoCoralL1        int  `json:"auto_coral_l1"`
			AutoCoralL2        int  `json:"auto_coral_l2"`
			AutoCoralL3        int  `json:"auto_coral_l3"`
			AutoCoralL4        int  `json:"auto_coral_l4"`
			AutoAlgaeNet       int  `json:"auto_algae_net"`
			AutoAlgaeProcessor int  `json:"auto_algae_processor"`
			AutoReef           int  `json:"auto_reef"`
			AutoMobility       bool `json:"auto_mobility"`

			TeleopCoralL1        int `json:"teleop_coral_l1"`
			TeleopCoralL2        int `json:"teleop_coral_l2"`
			TeleopCoralL3        int `json:"teleop_coral_l3"`
			TeleopCoralL4        int `json:"teleop_coral_l4"`
			TeleopAlgaeNet       int `json:"teleop_algae_net"`
			TeleopAlgaeProcessor int `json:"teleop_algae_processor"`
			TeleopReef           int `json:"teleop_reef"`

			ClimbLevel string `json:"climb_level"`
			ClimbTime  int    `json:"climb_time"`

			DefenseRating   int `json:"defense_rating"`
			SpeedRating     int `json:"speed_rating"`
			StabilityRating int `json:"stability_rating"`

			RobotBroke   bool   `json:"robot_broke"`
			GeneralNotes string `json:"general_notes"`

			CreatedAt int64 `json:"created_at"`
			UpdatedAt int64 `json:"updated_at"`
		}

		var results []ScoutingData
		for rows.Next() {
			var s ScoutingData
			err := rows.Scan(
				&s.ID, &s.MatchKey, &s.TeamKey, &s.ScoutName,
				&s.AutoCoralL1, &s.AutoCoralL2, &s.AutoCoralL3, &s.AutoCoralL4,
				&s.AutoAlgaeNet, &s.AutoAlgaeProcessor, &s.AutoReef, &s.AutoMobility,
				&s.TeleopCoralL1, &s.TeleopCoralL2, &s.TeleopCoralL3, &s.TeleopCoralL4,
				&s.TeleopAlgaeNet, &s.TeleopAlgaeProcessor, &s.TeleopReef,
				&s.ClimbLevel, &s.ClimbTime,
				&s.DefenseRating, &s.SpeedRating, &s.StabilityRating,
				&s.RobotBroke, &s.GeneralNotes,
				&s.CreatedAt, &s.UpdatedAt)
			if err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			results = append(results, s)
		}

		writeJSON(w, 200, results)
	}
}

func TeamMatchScoutingGet(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		teamKey := chi.URLParam(r, "team_key")

		if teamKey == "" {
			writeJSON(w, 400, map[string]string{"error": "team_key is required"})
			return
		}

		// Get all match scouting data for the team, ordered by most recent first
		query := `SELECT * FROM match_scouting_data WHERE team_key=? ORDER BY created_at DESC`
		rows, err := db.Query(query, teamKey)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		type ScoutingData struct {
			ID        int    `json:"id"`
			MatchKey  string `json:"match_key"`
			TeamKey   string `json:"team_key"`
			ScoutName string `json:"scout_name"`

			AutoCoralL1        int  `json:"auto_coral_l1"`
			AutoCoralL2        int  `json:"auto_coral_l2"`
			AutoCoralL3        int  `json:"auto_coral_l3"`
			AutoCoralL4        int  `json:"auto_coral_l4"`
			AutoAlgaeNet       int  `json:"auto_algae_net"`
			AutoAlgaeProcessor int  `json:"auto_algae_processor"`
			AutoReef           int  `json:"auto_reef"`
			AutoMobility       bool `json:"auto_mobility"`

			TeleopCoralL1        int `json:"teleop_coral_l1"`
			TeleopCoralL2        int `json:"teleop_coral_l2"`
			TeleopCoralL3        int `json:"teleop_coral_l3"`
			TeleopCoralL4        int `json:"teleop_coral_l4"`
			TeleopAlgaeNet       int `json:"teleop_algae_net"`
			TeleopAlgaeProcessor int `json:"teleop_algae_processor"`
			TeleopReef           int `json:"teleop_reef"`

			ClimbLevel string `json:"climb_level"`
			ClimbTime  int    `json:"climb_time"`

			DefenseRating   int `json:"defense_rating"`
			SpeedRating     int `json:"speed_rating"`
			StabilityRating int `json:"stability_rating"`

			RobotBroke   bool   `json:"robot_broke"`
			GeneralNotes string `json:"general_notes"`

			CreatedAt int64 `json:"created_at"`
			UpdatedAt int64 `json:"updated_at"`
		}

		var results []ScoutingData
		for rows.Next() {
			var s ScoutingData
			err := rows.Scan(
				&s.ID, &s.MatchKey, &s.TeamKey, &s.ScoutName,
				&s.AutoCoralL1, &s.AutoCoralL2, &s.AutoCoralL3, &s.AutoCoralL4,
				&s.AutoAlgaeNet, &s.AutoAlgaeProcessor, &s.AutoReef, &s.AutoMobility,
				&s.TeleopCoralL1, &s.TeleopCoralL2, &s.TeleopCoralL3, &s.TeleopCoralL4,
				&s.TeleopAlgaeNet, &s.TeleopAlgaeProcessor, &s.TeleopReef,
				&s.ClimbLevel, &s.ClimbTime,
				&s.DefenseRating, &s.SpeedRating, &s.StabilityRating,
				&s.RobotBroke, &s.GeneralNotes,
				&s.CreatedAt, &s.UpdatedAt)
			if err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			results = append(results, s)
		}

		writeJSON(w, 200, results)
	}
}

func PitScoutingSubmit(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var data struct {
			TeamKey   string `json:"team_key"`
			EventKey  string `json:"event_key"`
			ScoutName string `json:"scout_name"`

			RobotWeight     string `json:"robot_weight"`
			RobotDimensions string `json:"robot_dimensions"`
			DrivebaseType   string `json:"drivebase_type"`

			MaxCoralLevel     int    `json:"max_coral_level"`
			CanClimb          bool   `json:"can_climb"`
			MaxClimbLevel     string `json:"max_climb_level"`
			ClimbTimeEstimate int    `json:"climb_time_estimate"`

			AutoMobility          bool   `json:"auto_mobility"`
			AutoScoringCapability string `json:"auto_scoring_capability"`

			PreferredStartingPosition string `json:"preferred_starting_position"`
			StrategyNotes             string `json:"strategy_notes"`
			Strengths                 string `json:"strengths"`
			Weaknesses                string `json:"weaknesses"`
			GeneralNotes              string `json:"general_notes"`

			ProgrammingLanguage   string `json:"programming_language"`
			VisionSystem          bool   `json:"vision_system"`
			AutonomousReliability int    `json:"autonomous_reliability"`
		}

		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			writeJSON(w, 400, map[string]string{"error": "invalid json"})
			return
		}

		if data.TeamKey == "" {
			writeJSON(w, 400, map[string]string{"error": "team_key is required"})
			return
		}

		teamNumStr := strings.TrimPrefix(data.TeamKey, "frc")
		teamNum, err := strconv.Atoi(teamNumStr)
		if err != nil {
			writeJSON(w, 400, map[string]string{"error": "invalid team_key format"})
			return
		}

		_, err = db.Exec(`
			INSERT OR IGNORE INTO teams (team_key, team_num, name, last_synced)
			VALUES (?, ?, ?, ?)
		`, data.TeamKey, teamNum, fmt.Sprintf("Team %d", teamNum), time.Now().Unix())
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": "failed to create team: " + err.Error()})
			return
		}

		_, err = db.Exec(`
			INSERT OR REPLACE INTO pit_scouting_data (
				team_key, event_key, scout_name,
				robot_weight, robot_dimensions, drivebase_type,
				max_coral_level, can_climb, max_climb_level, climb_time_estimate,
				auto_mobility, auto_scoring_capability,
				preferred_starting_position, strategy_notes, strengths, weaknesses, general_notes,
				programming_language, vision_system, autonomous_reliability
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, data.TeamKey, data.EventKey, data.ScoutName,
			data.RobotWeight, data.RobotDimensions, data.DrivebaseType,
			data.MaxCoralLevel, data.CanClimb, data.MaxClimbLevel, data.ClimbTimeEstimate,
			data.AutoMobility, data.AutoScoringCapability,
			data.PreferredStartingPosition, data.StrategyNotes, data.Strengths, data.Weaknesses, data.GeneralNotes,
			data.ProgrammingLanguage, data.VisionSystem, data.AutonomousReliability)

		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{"ok": true})
	}
}

func PitScoutingGet(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		teamKey := chi.URLParam(r, "team_key")
		eventKey := chi.URLParam(r, "event_key")

		if teamKey == "" {
			writeJSON(w, 400, map[string]string{"error": "team_key is required"})
			return
		}

		var query string
		var args []interface{}

		if eventKey != "" {
			query = `SELECT * FROM pit_scouting_data WHERE team_key=? AND event_key=? ORDER BY created_at DESC LIMIT 1`
			args = []interface{}{teamKey, eventKey}
		} else {
			query = `SELECT * FROM pit_scouting_data WHERE team_key=? ORDER BY created_at DESC LIMIT 1`
			args = []interface{}{teamKey}
		}

		row := db.QueryRow(query, args...)

		type PitScoutingData struct {
			ID        int    `json:"id"`
			TeamKey   string `json:"team_key"`
			EventKey  string `json:"event_key"`
			ScoutName string `json:"scout_name"`

			RobotWeight     string `json:"robot_weight"`
			RobotDimensions string `json:"robot_dimensions"`
			DrivebaseType   string `json:"drivebase_type"`

			MaxCoralLevel     int    `json:"max_coral_level"`
			CanClimb          bool   `json:"can_climb"`
			MaxClimbLevel     string `json:"max_climb_level"`
			ClimbTimeEstimate int    `json:"climb_time_estimate"`

			AutoMobility          bool   `json:"auto_mobility"`
			AutoScoringCapability string `json:"auto_scoring_capability"`

			PreferredStartingPosition string `json:"preferred_starting_position"`
			StrategyNotes             string `json:"strategy_notes"`
			Strengths                 string `json:"strengths"`
			Weaknesses                string `json:"weaknesses"`
			GeneralNotes              string `json:"general_notes"`

			ProgrammingLanguage   string `json:"programming_language"`
			VisionSystem          bool   `json:"vision_system"`
			AutonomousReliability int    `json:"autonomous_reliability"`

			CreatedAt int64 `json:"created_at"`
			UpdatedAt int64 `json:"updated_at"`
		}

		var data PitScoutingData
		err := row.Scan(
			&data.ID, &data.TeamKey, &data.EventKey, &data.ScoutName,
			&data.RobotWeight, &data.RobotDimensions, &data.DrivebaseType,
			&data.MaxCoralLevel, &data.CanClimb, &data.MaxClimbLevel, &data.ClimbTimeEstimate,
			&data.AutoMobility, &data.AutoScoringCapability,
			&data.PreferredStartingPosition, &data.StrategyNotes, &data.Strengths, &data.Weaknesses, &data.GeneralNotes,
			&data.ProgrammingLanguage, &data.VisionSystem, &data.AutonomousReliability,
			&data.CreatedAt, &data.UpdatedAt)

		if err != nil {
			if err == sql.ErrNoRows {
				writeJSON(w, 404, map[string]string{"error": "no pit scouting data found"})
			} else {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
			}
			return
		}

		writeJSON(w, 200, data)
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

// --- TEAM NOTES
func TeamNotesGet(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := chi.URLParam(r, "team_key")
		row := db.QueryRow(`SELECT COALESCE(pit_notes, ''), COALESCE(scouting_notes, ''), COALESCE(robot_weight, ''), COALESCE(robot_dimensions, ''), COALESCE(drivebase_type, '') FROM teams WHERE team_key=?`, key)
		var pitNotes, scoutingNotes, robotWeight, robotDimensions, drivebaseType string
		if err := row.Scan(&pitNotes, &scoutingNotes, &robotWeight, &robotDimensions, &drivebaseType); err != nil {
			writeJSON(w, 404, map[string]string{"error": "team not found"})
			return
		}
		writeJSON(w, 200, map[string]string{
			"pit_notes":        pitNotes,
			"scouting_notes":   scoutingNotes,
			"robot_weight":     robotWeight,
			"robot_dimensions": robotDimensions,
			"drivebase_type":   drivebaseType,
		})
	}
}

func TeamNotesUpdate(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := chi.URLParam(r, "team_key")
		var in struct {
			PitNotes        string `json:"pit_notes"`
			ScoutingNotes   string `json:"scouting_notes"`
			RobotWeight     string `json:"robot_weight"`
			RobotDimensions string `json:"robot_dimensions"`
			DrivebaseType   string `json:"drivebase_type"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		_, err := db.Exec(`UPDATE teams SET pit_notes=?, scouting_notes=?, robot_weight=?, robot_dimensions=?, drivebase_type=? WHERE team_key=?`,
			in.PitNotes, in.ScoutingNotes, in.RobotWeight, in.RobotDimensions, in.DrivebaseType, key)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{"ok": true})
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
