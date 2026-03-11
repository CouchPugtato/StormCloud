package api

import (
	"database/sql"
	"encoding/json"
	"errors"
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
				SELECT team_key, team_num, name, city, state, country, rookie_year, COALESCE(robot_photo, '')
				FROM teams
				ORDER BY team_num ASC LIMIT ?
			`, limit)
		} else {
			// search by number or name
			rows, err = db.Query(`
				SELECT team_key, team_num, name, city, state, country, rookie_year, COALESCE(robot_photo, '')
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
			RobotPhoto string `json:"robot_photo"`
		}
		var out []team
		for rows.Next() {
			var t team
			_ = rows.Scan(&t.TeamKey, &t.TeamNum, &t.Name, &t.City, &t.State, &t.Country, &t.RookieYear, &t.RobotPhoto)
			out = append(out, t)
		}
		writeJSON(w, 200, out)
	}
}

func TeamGet(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := chi.URLParam(r, "team_key")
		row := db.QueryRow(`
			SELECT
				team_key,
				team_num,
				COALESCE(name, ''),
				COALESCE(city, ''),
				COALESCE(state, ''),
				COALESCE(country, ''),
				COALESCE(rookie_year, 0),
				COALESCE(pit_notes, ''),
				COALESCE(scouting_notes, ''),
				COALESCE(robot_photo, '')
			FROM teams
			WHERE team_key=?
		`, key)
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
			RobotPhoto    string                 `json:"robot_photo"`
			EPA           map[string]interface{} `json:"epa,omitempty"`
		}
		if err := row.Scan(&t.TeamKey, &t.TeamNum, &t.Name, &t.City, &t.State, &t.Country, &t.Rookie, &t.PitNotes, &t.ScoutingNotes, &t.RobotPhoto); err != nil {
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

func TeamPhotoUpdate(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role == "viewer" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		key := chi.URLParam(r, "team_key")
		var in struct {
			RobotPhoto string `json:"robot_photo"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		in.RobotPhoto = strings.TrimSpace(in.RobotPhoto)
		if in.RobotPhoto != "" {
			if !strings.HasPrefix(in.RobotPhoto, "data:image/") {
				writeJSON(w, 400, map[string]string{"error": "robot_photo must be an image data URL"})
				return
			}
			if len(in.RobotPhoto) > 4_000_000 {
				writeJSON(w, 400, map[string]string{"error": "robot_photo is too large"})
				return
			}
		}

		res, err := db.Exec(`UPDATE teams SET robot_photo=? WHERE team_key=?`, in.RobotPhoto, key)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			writeJSON(w, 404, map[string]string{"error": "team not found"})
			return
		}

		writeJSON(w, 200, map[string]any{
			"ok":          true,
			"team_key":    key,
			"robot_photo": in.RobotPhoto,
		})
	}
}

func TeamAddFromTBA(db *sql.DB, syncService *ingest.SyncService) http.HandlerFunc {
	type in struct {
		TeamNum int `json:"team_num"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "scouting_lead" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}
		if payload.TeamNum <= 0 {
			writeJSON(w, 400, map[string]string{"error": "valid team_num is required"})
			return
		}

		team, err := syncService.SyncSingleTeam(payload.TeamNum)
		if err != nil {
			writeJSON(w, 400, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{
			"ok":   true,
			"team": team,
		})
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
func EventsList(db *sql.DB, _ *ingest.SyncService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		year := strings.TrimSpace(r.URL.Query().Get("year"))

		managedKeys := make([]string, 0)
		managedRows, managedErr := db.Query(`SELECT event_key FROM managed_events ORDER BY created_at ASC`)
		if managedErr == nil {
			defer managedRows.Close()
			for managedRows.Next() {
				var eventKey string
				if err := managedRows.Scan(&eventKey); err == nil && strings.TrimSpace(eventKey) != "" {
					managedKeys = append(managedKeys, strings.TrimSpace(eventKey))
				}
			}
		}

		configuredKeys := managedKeys
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

func ManagedEventsList(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "scouting_lead" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		rows, err := db.Query(`
			SELECT e.event_key, COALESCE(e.year, 0), COALESCE(e.name, ''), COALESCE(e.city, ''), COALESCE(e.state, ''), COALESCE(e.country, ''), COALESCE(e.start_date, ''), COALESCE(e.end_date, ''), me.source
			FROM managed_events me
			LEFT JOIN events e ON e.event_key = me.event_key
			ORDER BY COALESCE(e.start_date, ''), me.created_at
		`)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		type managedEvent struct {
			EventKey  string `json:"event_key"`
			Year      int    `json:"year"`
			Name      string `json:"name"`
			City      string `json:"city"`
			State     string `json:"state"`
			Country   string `json:"country"`
			StartDate string `json:"start_date"`
			EndDate   string `json:"end_date"`
			Source    string `json:"source"`
		}

		out := make([]managedEvent, 0)
		for rows.Next() {
			var item managedEvent
			if err := rows.Scan(&item.EventKey, &item.Year, &item.Name, &item.City, &item.State, &item.Country, &item.StartDate, &item.EndDate, &item.Source); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			out = append(out, item)
		}
		writeJSON(w, 200, out)
	}
}

func ManagedEventAddFromTBA(db *sql.DB, syncService *ingest.SyncService) http.HandlerFunc {
	type in struct {
		EventKey string `json:"event_key"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "scouting_lead" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}
		eventKey := strings.TrimSpace(payload.EventKey)
		if eventKey == "" {
			writeJSON(w, 400, map[string]string{"error": "event_key is required"})
			return
		}

		if err := syncService.SyncEvent(eventKey); err != nil {
			writeJSON(w, 400, map[string]string{"error": err.Error()})
			return
		}

		_, err = db.Exec(`
			INSERT INTO managed_events(event_key, source, created_at)
			VALUES(?, 'tba', ?)
			ON CONFLICT(event_key) DO UPDATE SET source='tba'
		`, eventKey, time.Now().Unix())
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{"ok": true, "event_key": eventKey})
	}
}

func ManagedEventAddManual(db *sql.DB) http.HandlerFunc {
	type in struct {
		EventKey  string `json:"event_key"`
		Year      int    `json:"year"`
		Name      string `json:"name"`
		City      string `json:"city"`
		State     string `json:"state"`
		Country   string `json:"country"`
		StartDate string `json:"start_date"`
		EndDate   string `json:"end_date"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "scouting_lead" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		payload.EventKey = strings.TrimSpace(payload.EventKey)
		payload.Name = strings.TrimSpace(payload.Name)
		payload.City = strings.TrimSpace(payload.City)
		payload.State = strings.TrimSpace(payload.State)
		payload.Country = strings.TrimSpace(payload.Country)
		payload.StartDate = strings.TrimSpace(payload.StartDate)
		payload.EndDate = strings.TrimSpace(payload.EndDate)
		if payload.EventKey == "" || payload.Name == "" {
			writeJSON(w, 400, map[string]string{"error": "event_key and name are required"})
			return
		}

		_, err = db.Exec(`
			INSERT OR REPLACE INTO events(event_key, year, name, city, state, country, start_date, end_date)
			VALUES(?,?,?,?,?,?,?,?)
		`, payload.EventKey, payload.Year, payload.Name, payload.City, payload.State, payload.Country, payload.StartDate, payload.EndDate)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		_, err = db.Exec(`
			INSERT INTO managed_events(event_key, source, created_at)
			VALUES(?, 'manual', ?)
			ON CONFLICT(event_key) DO UPDATE SET source='manual'
		`, payload.EventKey, time.Now().Unix())
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{"ok": true, "event_key": payload.EventKey})
	}
}

func ManagedEventSyncMatches(db *sql.DB, syncService *ingest.SyncService) http.HandlerFunc {
	type in struct {
		EventKey string `json:"event_key"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "scouting_lead" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}
		eventKey := strings.TrimSpace(payload.EventKey)
		if eventKey == "" {
			writeJSON(w, 400, map[string]string{"error": "event_key is required"})
			return
		}

		if err := syncService.SyncEvent(eventKey); err != nil {
			writeJSON(w, 400, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{"ok": true, "event_key": eventKey})
	}
}

func ManagedEventDelete(db *sql.DB) http.HandlerFunc {
	type in struct {
		EventKey string `json:"event_key"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "scouting_lead" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}
		eventKey := strings.TrimSpace(payload.EventKey)
		if eventKey == "" {
			writeJSON(w, 400, map[string]string{"error": "event_key is required"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer func() { _ = tx.Rollback() }()

		if _, err := tx.Exec(`DELETE FROM managed_events WHERE event_key=?`, eventKey); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM matches WHERE event_key=?`, eventKey); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM events WHERE event_key=?`, eventKey); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{"ok": true, "event_key": eventKey})
	}
}

func ManagedEventAddManualMatch(db *sql.DB) http.HandlerFunc {
	type in struct {
		EventKey    string `json:"event_key"`
		MatchKey    string `json:"match_key"`
		CompLevel   string `json:"comp_level"`
		SetNumber   int    `json:"set_number"`
		MatchNumber int    `json:"match_number"`
		TimeReal    *int64 `json:"time_real"`
		TimePred    *int64 `json:"time_pred"`
		BlueTeams   []int  `json:"blue_teams"`
		RedTeams    []int  `json:"red_teams"`
		BlueScore   *int   `json:"blue_score"`
		RedScore    *int   `json:"red_score"`
	}

	validCompLevels := map[string]bool{
		"qm": true,
		"ef": true,
		"qf": true,
		"sf": true,
		"f":  true,
	}

	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "scouting_lead" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		payload.EventKey = strings.TrimSpace(payload.EventKey)
		payload.MatchKey = strings.TrimSpace(payload.MatchKey)
		payload.CompLevel = strings.ToLower(strings.TrimSpace(payload.CompLevel))
		if payload.EventKey == "" {
			writeJSON(w, 400, map[string]string{"error": "event_key is required"})
			return
		}
		if !validCompLevels[payload.CompLevel] {
			writeJSON(w, 400, map[string]string{"error": "comp_level must be qm, ef, qf, sf, or f"})
			return
		}
		if payload.MatchNumber <= 0 {
			writeJSON(w, 400, map[string]string{"error": "match_number must be greater than 0"})
			return
		}
		if len(payload.RedTeams) != 3 || len(payload.BlueTeams) != 3 {
			writeJSON(w, 400, map[string]string{"error": "three red teams and three blue teams are required"})
			return
		}

		for _, teamNum := range append(append([]int{}, payload.RedTeams...), payload.BlueTeams...) {
			if teamNum <= 0 {
				writeJSON(w, 400, map[string]string{"error": "team numbers must be greater than 0"})
				return
			}
		}

		var managedCount int
		if err := db.QueryRow(`SELECT COUNT(1) FROM managed_events WHERE event_key=?`, payload.EventKey).Scan(&managedCount); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		if managedCount == 0 {
			writeJSON(w, 400, map[string]string{"error": "event is not managed"})
			return
		}

		if payload.MatchKey == "" {
			if payload.CompLevel == "qm" {
				payload.MatchKey = fmt.Sprintf("%s_qm%d", payload.EventKey, payload.MatchNumber)
			} else {
				payload.MatchKey = fmt.Sprintf("%s_%s%dm%d", payload.EventKey, payload.CompLevel, payload.SetNumber, payload.MatchNumber)
			}
		}

		blueTeams := make([]string, 0, len(payload.BlueTeams))
		redTeams := make([]string, 0, len(payload.RedTeams))
		for _, teamNum := range payload.BlueTeams {
			blueTeams = append(blueTeams, fmt.Sprintf("frc%d", teamNum))
		}
		for _, teamNum := range payload.RedTeams {
			redTeams = append(redTeams, fmt.Sprintf("frc%d", teamNum))
		}

		blueTeamsJSON, _ := json.Marshal(blueTeams)
		redTeamsJSON, _ := json.Marshal(redTeams)

		tx, err := db.Begin()
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer func() { _ = tx.Rollback() }()

		for _, teamNum := range append(append([]int{}, payload.RedTeams...), payload.BlueTeams...) {
			var exists int
			if err := tx.QueryRow(`SELECT COUNT(1) FROM teams WHERE team_num=?`, teamNum).Scan(&exists); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			if exists == 0 {
				writeJSON(w, 400, map[string]string{"error": fmt.Sprintf("team %d is not in the local database", teamNum)})
				return
			}
		}

		var timeReal any
		if payload.TimeReal != nil && *payload.TimeReal > 0 {
			timeReal = *payload.TimeReal
		}
		var timePred any
		if payload.TimePred != nil && *payload.TimePred > 0 {
			timePred = *payload.TimePred
		}
		var blueScore any
		if payload.BlueScore != nil {
			blueScore = *payload.BlueScore
		}
		var redScore any
		if payload.RedScore != nil {
			redScore = *payload.RedScore
		}

		if _, err := tx.Exec(`
			INSERT OR REPLACE INTO matches(
				match_key, event_key, comp_level, set_number, match_number,
				time_real, time_pred, blue_teams, red_teams, blue_score, red_score
			)
			VALUES(?,?,?,?,?,?,?,?,?,?,?)
		`, payload.MatchKey, payload.EventKey, payload.CompLevel, payload.SetNumber, payload.MatchNumber, timeReal, timePred, string(blueTeamsJSON), string(redTeamsJSON), blueScore, redScore); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{
			"ok":        true,
			"event_key": payload.EventKey,
			"match_key": payload.MatchKey,
		})
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
			BlueScore   *int     `json:"blue_score"`
			RedScore    *int     `json:"red_score"`
		}
		out := make([]Match, 0)
		for rows.Next() {
			var m Match
			var blueJSON, redJSON string
			var timeReal, timePred sql.NullInt64
			var blueScore, redScore sql.NullInt64
			if err := rows.Scan(&m.MatchKey, &m.CompLevel, &m.SetNumber, &m.MatchNumber,
				&timeReal, &timePred, &blueJSON, &redJSON, &blueScore, &redScore); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}

			if timeReal.Valid {
				m.TimeReal = timeReal.Int64
			}
			if timePred.Valid {
				m.TimePred = timePred.Int64
			}
			if err := json.Unmarshal([]byte(blueJSON), &m.BlueTeams); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			if err := json.Unmarshal([]byte(redJSON), &m.RedTeams); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			if blueScore.Valid && blueScore.Int64 >= 0 {
				v := int(blueScore.Int64)
				m.BlueScore = &v
			}
			if redScore.Valid && redScore.Int64 >= 0 {
				v := int(redScore.Int64)
				m.RedScore = &v
			}

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
	return AppSettingsGetWithDB(nil)
}

func AppSettingsGetWithDB(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		twitchURL := strings.TrimSpace(os.Getenv("TWITCH_CHANNEL_URL"))
		if db != nil {
			var storedURL string
			err := db.QueryRow(`SELECT value FROM app_settings WHERE key=?`, "twitch_channel_url").Scan(&storedURL)
			if err == nil {
				twitchURL = storedURL
			} else if err != nil && err != sql.ErrNoRows {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
		}

		settings := map[string]string{
			"twitch_channel_url": twitchURL,
		}
		writeJSON(w, 200, settings)
	}
}

func AppSettingsSet(db *sql.DB) http.HandlerFunc {
	type in struct {
		TwitchChannelURL string `json:"twitch_channel_url"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "scouting_lead" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		twitchURL := strings.TrimSpace(payload.TwitchChannelURL)
		_, err = db.Exec(`
			INSERT INTO app_settings(key, value, updated_at)
			VALUES(?, ?, ?)
			ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
		`, "twitch_channel_url", twitchURL, time.Now().Unix())
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{
			"ok":                 true,
			"twitch_channel_url": twitchURL,
		})
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

func AllianceScoutingSubmit(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var data struct {
			MatchKey      string `json:"match_key"`
			AllianceColor string `json:"alliance_color"`
			ScoutName     string `json:"scout_name"`
			GeneralInfo   string `json:"general_info"`
			Notes         string `json:"notes"`
		}

		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			writeJSON(w, 400, map[string]string{"error": "invalid json"})
			return
		}

		data.MatchKey = strings.TrimSpace(data.MatchKey)
		data.AllianceColor = strings.ToLower(strings.TrimSpace(data.AllianceColor))
		data.ScoutName = strings.TrimSpace(data.ScoutName)
		data.GeneralInfo = strings.TrimSpace(data.GeneralInfo)
		data.Notes = strings.TrimSpace(data.Notes)

		if data.MatchKey == "" {
			writeJSON(w, 400, map[string]string{"error": "match_key is required"})
			return
		}
		if data.AllianceColor != "red" && data.AllianceColor != "blue" {
			writeJSON(w, 400, map[string]string{"error": "alliance_color must be red or blue"})
			return
		}

		var exists int
		if err := db.QueryRow(`SELECT COUNT(1) FROM matches WHERE match_key=?`, data.MatchKey).Scan(&exists); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		if exists == 0 {
			writeJSON(w, 404, map[string]string{"error": "match not found"})
			return
		}

		_, err := db.Exec(`
			INSERT OR REPLACE INTO alliance_scouting_data (
				match_key, alliance_color, scout_name, general_info, notes
			) VALUES (?, ?, ?, ?, ?)
		`, data.MatchKey, data.AllianceColor, data.ScoutName, data.GeneralInfo, data.Notes)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{"ok": true})
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

func DeviceUnregister(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct{ UserID, Platform, Token string }
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}
		if strings.TrimSpace(in.UserID) == "" {
			writeJSON(w, 400, map[string]string{"error": "user_id required"})
			return
		}
		if strings.TrimSpace(in.Token) != "" {
			_, err := db.Exec(`DELETE FROM device_tokens WHERE user_id=? AND token=?`, strings.TrimSpace(in.UserID), strings.TrimSpace(in.Token))
			if err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
		} else if strings.TrimSpace(in.Platform) != "" {
			_, err := db.Exec(`DELETE FROM device_tokens WHERE user_id=? AND platform=?`, strings.TrimSpace(in.UserID), strings.TrimSpace(in.Platform))
			if err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
		} else {
			_, err := db.Exec(`DELETE FROM device_tokens WHERE user_id=?`, strings.TrimSpace(in.UserID))
			if err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
		}

		writeJSON(w, 200, map[string]any{"ok": true})
	}
}

func BatteryTrackerList(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "drive_team" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		rows, err := db.Query(`
			SELECT id, battery_name, COALESCE(note, ''), created_at, COALESCE(created_by_user_id, ''), unplugged_at, safe_to_plug_at
			FROM battery_tracker_entries
			ORDER BY created_at DESC
		`)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		type entry struct {
			ID              string `json:"id"`
			BatteryName     string `json:"battery_name"`
			Note            string `json:"note"`
			CreatedAt       int64  `json:"created_at"`
			CreatedByUserID string `json:"created_by_user_id"`
			UnpluggedAt     *int64 `json:"unplugged_at"`
			SafeToPlugAt    *int64 `json:"safe_to_plug_at"`
		}

		out := make([]entry, 0)
		for rows.Next() {
			var item entry
			var unpluggedAt, safeToPlugAt sql.NullInt64
			if err := rows.Scan(&item.ID, &item.BatteryName, &item.Note, &item.CreatedAt, &item.CreatedByUserID, &unpluggedAt, &safeToPlugAt); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			if unpluggedAt.Valid {
				v := unpluggedAt.Int64
				item.UnpluggedAt = &v
			}
			if safeToPlugAt.Valid {
				v := safeToPlugAt.Int64
				item.SafeToPlugAt = &v
			}
			out = append(out, item)
		}

		writeJSON(w, 200, out)
	}
}

func BatteryTrackerCreate(db *sql.DB) http.HandlerFunc {
	type in struct {
		BatteryName string `json:"battery_name"`
		Note        string `json:"note"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "drive_team" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		payload.BatteryName = strings.TrimSpace(payload.BatteryName)
		payload.Note = strings.TrimSpace(payload.Note)
		if payload.BatteryName == "" {
			writeJSON(w, 400, map[string]string{"error": "battery_name is required"})
			return
		}

		id := fmt.Sprintf("%d_%s", time.Now().UnixNano(), strings.ReplaceAll(user.ID, "-", ""))
		now := time.Now().UnixMilli()
		_, err = db.Exec(`
			INSERT INTO battery_tracker_entries(id, battery_name, note, created_at, created_by_user_id)
			VALUES(?,?,?,?,?)
		`, id, payload.BatteryName, payload.Note, now, user.ID)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 201, map[string]any{
			"id":                 id,
			"battery_name":       payload.BatteryName,
			"note":               payload.Note,
			"created_at":         now,
			"created_by_user_id": user.ID,
			"unplugged_at":       nil,
			"safe_to_plug_at":    nil,
		})
	}
}

func BatteryTrackerStartTimer(db *sql.DB) http.HandlerFunc {
	type in struct {
		ID string `json:"id"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "drive_team" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}
		payload.ID = strings.TrimSpace(payload.ID)
		if payload.ID == "" {
			writeJSON(w, 400, map[string]string{"error": "id is required"})
			return
		}

		unpluggedAt := time.Now().UnixMilli()
		safeToPlugAt := unpluggedAt + (30 * 60 * 1000)
		res, err := db.Exec(`
			UPDATE battery_tracker_entries
			SET unplugged_at=?, safe_to_plug_at=?
			WHERE id=?
		`, unpluggedAt, safeToPlugAt, payload.ID)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		rowsAffected, _ := res.RowsAffected()
		if rowsAffected == 0 {
			writeJSON(w, 404, map[string]string{"error": "battery entry not found"})
			return
		}

		writeJSON(w, 200, map[string]any{
			"ok":             true,
			"id":             payload.ID,
			"unplugged_at":   unpluggedAt,
			"safe_to_plug_at": safeToPlugAt,
		})
	}
}

func BatteryTrackerDelete(db *sql.DB) http.HandlerFunc {
	type in struct {
		ID string `json:"id"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "drive_team" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}
		payload.ID = strings.TrimSpace(payload.ID)
		if payload.ID == "" {
			writeJSON(w, 400, map[string]string{"error": "id is required"})
			return
		}

		res, err := db.Exec(`DELETE FROM battery_tracker_entries WHERE id=?`, payload.ID)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		rowsAffected, _ := res.RowsAffected()
		if rowsAffected == 0 {
			writeJSON(w, 404, map[string]string{"error": "battery entry not found"})
			return
		}

		writeJSON(w, 200, map[string]any{"ok": true})
	}
}

func BatteryTrackerClear(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "drive_team" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		if _, err := db.Exec(`DELETE FROM battery_tracker_entries`); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{"ok": true})
	}
}

func BatteryInventoryList(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "drive_team" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		rows, err := db.Query(`
			SELECT id, name, rank, created_at
			FROM battery_inventory
			ORDER BY rank ASC, created_at ASC
		`)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		type item struct {
			ID        string `json:"id"`
			Name      string `json:"name"`
			Rank      int    `json:"rank"`
			CreatedAt int64  `json:"created_at"`
		}

		out := make([]item, 0)
		for rows.Next() {
			var it item
			if err := rows.Scan(&it.ID, &it.Name, &it.Rank, &it.CreatedAt); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			out = append(out, it)
		}

		writeJSON(w, 200, out)
	}
}

func BatteryInventorySave(db *sql.DB) http.HandlerFunc {
	type inItem struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Rank int    `json:"rank"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "drive_team" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		var payload struct {
			Items []inItem `json:"items"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer func() { _ = tx.Rollback() }()

		if _, err := tx.Exec(`DELETE FROM battery_inventory`); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		stmt, err := tx.Prepare(`
			INSERT INTO battery_inventory(id, name, rank, created_at)
			VALUES(?,?,?,?)
		`)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer stmt.Close()

		now := time.Now().UnixMilli()
		for index, item := range payload.Items {
			item.ID = strings.TrimSpace(item.ID)
			item.Name = strings.TrimSpace(item.Name)
			if item.ID == "" {
				item.ID = fmt.Sprintf("battery_%d_%d", now, index+1)
			}
			if item.Name == "" {
				writeJSON(w, 400, map[string]string{"error": "battery name is required"})
				return
			}
			rank := item.Rank
			if rank <= 0 {
				rank = index + 1
			}
			if _, err := stmt.Exec(item.ID, item.Name, rank, now); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{"ok": true, "count": len(payload.Items)})
	}
}

func ScoutingScheduleList(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "scouting_lead" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		eventKey := strings.TrimSpace(r.URL.Query().Get("event_key"))
		if eventKey == "" {
			writeJSON(w, 400, map[string]string{"error": "event_key is required"})
			return
		}

		rows, err := db.Query(`
			SELECT event_key, match_key, slot_key, COALESCE(user_id, ''), assigned_by_user_id, assigned_at
			FROM scouting_schedule_assignments
			WHERE event_key=?
			ORDER BY match_key, slot_key
		`, eventKey)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		type assignment struct {
			EventKey         string  `json:"event_key"`
			MatchKey         string  `json:"match_key"`
			SlotKey          string  `json:"slot_key"`
			UserID           *string `json:"user_id"`
			AssignedByUserID string  `json:"assigned_by_user_id"`
			AssignedAt       int64   `json:"assigned_at"`
		}

		out := make([]assignment, 0)
		for rows.Next() {
			var item assignment
			var userID string
			if err := rows.Scan(&item.EventKey, &item.MatchKey, &item.SlotKey, &userID, &item.AssignedByUserID, &item.AssignedAt); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			if strings.TrimSpace(userID) != "" {
				item.UserID = &userID
			}
			out = append(out, item)
		}

		writeJSON(w, 200, out)
	}
}

func ScoutingScheduleMe(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}

		rows, err := db.Query(`
			SELECT
				sa.event_key,
				sa.match_key,
				sa.slot_key,
				m.comp_level,
				m.set_number,
				m.match_number,
				COALESCE(m.time_real, 0),
				COALESCE(m.time_pred, 0),
				COALESCE(m.red_teams, '[]'),
				COALESCE(m.blue_teams, '[]'),
				COALESCE(e.name, '')
			FROM scouting_schedule_assignments sa
			JOIN matches m ON m.match_key = sa.match_key
			LEFT JOIN events e ON e.event_key = sa.event_key
			WHERE sa.user_id=?
			ORDER BY COALESCE(NULLIF(m.time_real, 0), NULLIF(m.time_pred, 0), 9223372036854775807), sa.event_key, m.match_number
		`, user.ID)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		type scheduledMatch struct {
			EventKey    string   `json:"event_key"`
			EventName   string   `json:"event_name"`
			MatchKey    string   `json:"match_key"`
			SlotKey     string   `json:"slot_key"`
			CompLevel   string   `json:"comp_level"`
			SetNumber   int      `json:"set_number"`
			MatchNumber int      `json:"match_number"`
			TimeReal    int64    `json:"time_real"`
			TimePred    int64    `json:"time_pred"`
			RedTeams    []string `json:"red_teams"`
			BlueTeams   []string `json:"blue_teams"`
		}

		out := make([]scheduledMatch, 0)
		for rows.Next() {
			var item scheduledMatch
			var redTeamsJSON, blueTeamsJSON string
			if err := rows.Scan(
				&item.EventKey,
				&item.MatchKey,
				&item.SlotKey,
				&item.CompLevel,
				&item.SetNumber,
				&item.MatchNumber,
				&item.TimeReal,
				&item.TimePred,
				&redTeamsJSON,
				&blueTeamsJSON,
				&item.EventName,
			); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			if err := json.Unmarshal([]byte(redTeamsJSON), &item.RedTeams); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			if err := json.Unmarshal([]byte(blueTeamsJSON), &item.BlueTeams); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			out = append(out, item)
		}

		writeJSON(w, 200, out)
	}
}

func ScoutingScheduleSave(db *sql.DB) http.HandlerFunc {
	type in struct {
		EventKey string `json:"event_key"`
		MatchKey string `json:"match_key"`
		SlotKey  string `json:"slot_key"`
		UserID   string `json:"user_id"`
	}

	validSlots := map[string]bool{
		"red_1":         true,
		"red_2":         true,
		"red_3":         true,
		"blue_1":        true,
		"blue_2":        true,
		"blue_3":        true,
		"red_alliance":  true,
		"blue_alliance": true,
	}

	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if user.Role != "scouting_lead" {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		payload.EventKey = strings.TrimSpace(payload.EventKey)
		payload.MatchKey = strings.TrimSpace(payload.MatchKey)
		payload.SlotKey = strings.TrimSpace(payload.SlotKey)
		payload.UserID = strings.TrimSpace(payload.UserID)

		if payload.EventKey == "" || payload.MatchKey == "" || !validSlots[payload.SlotKey] {
			writeJSON(w, 400, map[string]string{"error": "invalid schedule payload"})
			return
		}

		var matchCount int
		if err := db.QueryRow(`
			SELECT COUNT(1)
			FROM matches
			WHERE event_key=? AND match_key=? AND LOWER(COALESCE(comp_level, ''))='qm'
		`, payload.EventKey, payload.MatchKey).Scan(&matchCount); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		if matchCount == 0 {
			writeJSON(w, 400, map[string]string{"error": "match must be a qualification match in the selected event"})
			return
		}

		if payload.UserID != "" {
			var role string
			if err := db.QueryRow(`SELECT role FROM users WHERE id=?`, payload.UserID).Scan(&role); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, 404, map[string]string{"error": "user not found"})
					return
				}
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			if role != "scouter" && role != "scouting_lead" {
				writeJSON(w, 400, map[string]string{"error": "only scouter and scouting lead accounts can be scheduled"})
				return
			}
		}

		now := time.Now().Unix()
		if payload.UserID == "" {
			if _, err := db.Exec(`DELETE FROM scouting_schedule_assignments WHERE match_key=? AND slot_key=?`, payload.MatchKey, payload.SlotKey); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, 200, map[string]any{
				"ok":        true,
				"event_key": payload.EventKey,
				"match_key": payload.MatchKey,
				"slot_key":  payload.SlotKey,
				"user_id":   nil,
			})
			return
		}

		_, err = db.Exec(`
			INSERT INTO scouting_schedule_assignments(event_key, match_key, slot_key, user_id, assigned_by_user_id, assigned_at)
			VALUES(?,?,?,?,?,?)
			ON CONFLICT(match_key, slot_key) DO UPDATE SET
				event_key=excluded.event_key,
				user_id=excluded.user_id,
				assigned_by_user_id=excluded.assigned_by_user_id,
				assigned_at=excluded.assigned_at
		`, payload.EventKey, payload.MatchKey, payload.SlotKey, payload.UserID, user.ID, now)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{
			"ok":        true,
			"event_key": payload.EventKey,
			"match_key": payload.MatchKey,
			"slot_key":  payload.SlotKey,
			"user_id":   payload.UserID,
		})
	}
}
