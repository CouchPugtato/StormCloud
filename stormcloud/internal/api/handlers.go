package api

import (
	"bytes"
	"database/sql"
	"encoding/csv"
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

func canExportScoutingData(role string) bool {
	return role == "drive_team" || role == "scouting_lead"
}

func canAccessMatchNotes(role string) bool {
	return role == "drive_team" || role == "scouting_lead"
}

func writeCSVResponse(w http.ResponseWriter, filename string, records [][]string) {
	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	_ = writer.WriteAll(records)
	writer.Flush()

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(buffer.Bytes())
}

func scoutingReportName(user *authUser) string {
	name := strings.TrimSpace(strings.Join([]string{strings.TrimSpace(user.FirstName), strings.TrimSpace(user.LastName)}, " "))
	if name != "" {
		return name
	}
	return strings.TrimSpace(user.Email)
}

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
		"version": "2026.1",
		"fields": []field{
			{Key: "estimated_bps", Label: "Estimated BPS", Type: "number"},
			{Key: "shooter_archetype", Label: "Shooter Archetype", Type: "select", Options: []string{"turret", "double turret", "barrel", "single fixed", "double fixed", "other"}},
			{Key: "notes", Label: "Notes", Type: "textarea"},
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
		seasonYear := 2026
		if yearStr := strings.TrimSpace(os.Getenv("CURRENT_YEAR")); yearStr != "" {
			if parsed, err := strconv.Atoi(yearStr); err == nil && parsed > 0 {
				seasonYear = parsed
			}
		}
		if db != nil {
			var storedURL string
			err := db.QueryRow(`SELECT value FROM app_settings WHERE key=?`, "twitch_channel_url").Scan(&storedURL)
			if err == nil {
				twitchURL = storedURL
			} else if err != nil && err != sql.ErrNoRows {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}

			var storedYear string
			err = db.QueryRow(`SELECT value FROM app_settings WHERE key=?`, "season_year").Scan(&storedYear)
			if err == nil {
				if parsed, convErr := strconv.Atoi(strings.TrimSpace(storedYear)); convErr == nil && parsed > 0 {
					seasonYear = parsed
				}
			} else if err != nil && err != sql.ErrNoRows {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
		}

		settings := map[string]any{
			"twitch_channel_url": twitchURL,
			"season_year":        seasonYear,
		}
		writeJSON(w, 200, settings)
	}
}

func AppSettingsSet(db *sql.DB, syncService *ingest.SyncService) http.HandlerFunc {
	type in struct {
		TwitchChannelURL string `json:"twitch_channel_url"`
		SeasonYear       int    `json:"season_year"`
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

		seasonYear := payload.SeasonYear
		if seasonYear <= 0 {
			seasonYear = 2026
		}
		_, err = db.Exec(`
			INSERT INTO app_settings(key, value, updated_at)
			VALUES(?, ?, ?)
			ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
		`, "season_year", strconv.Itoa(seasonYear), time.Now().Unix())
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		if syncService != nil {
			syncService.SetCurrentYear(seasonYear)
		}

		writeJSON(w, 200, map[string]any{
			"ok":                 true,
			"twitch_channel_url": twitchURL,
			"season_year":        seasonYear,
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
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}

		var data struct {
			MatchKey  string `json:"match_key"`
			TeamKey   string `json:"team_key"`

			WasAuto                    bool   `json:"was_auto"`
			ConflictedOwnAlliance      bool   `json:"conflicted_own_alliance"`
			ConflictedOpposingAlliance bool   `json:"conflicted_opposing_alliance"`
			UsedOutpost                bool   `json:"used_outpost"`
			UsedDepot                  bool   `json:"used_depot"`
			Cycles                     int    `json:"cycles"`
			PercentContributed         int    `json:"percent_contributed"`
			AutoPointsContributed      int    `json:"auto_points_contributed"`
			GotDisabled                bool   `json:"got_disabled"`
			BPSRating                  int    `json:"bps_rating"`
			ObviousPenalties           string `json:"obvious_penalties"`
			PrimaryPath                string `json:"primary_path"`
			IndexViaIntake             bool   `json:"index_via_intake"`
			IntakeSpeed                int    `json:"intake_speed"`
			Notes                      string `json:"notes"`
			ShooterRangeClose          bool   `json:"shooter_range_close"`
			ShooterRangeMid            bool   `json:"shooter_range_mid"`
			ShooterRangeFar            bool   `json:"shooter_range_far"`
			Climb                      bool   `json:"climb"`
			ClimbLevel                 string `json:"climb_level"`
			ClimbLocation              string `json:"climb_location"`
			AccuracySuccessful         bool   `json:"accuracy_successful"`
			AccuracyAttempted          bool   `json:"accuracy_attempted"`
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
				was_auto, conflicted_own_alliance, conflicted_opposing_alliance,
				used_outpost, used_depot, cycles, percent_contributed, auto_points_contributed,
				got_disabled, bps_rating, obvious_penalties, primary_path, index_via_intake,
				intake_speed, notes, shooter_range_close, shooter_range_mid, shooter_range_far,
				climb, climb_level, climb_location, accuracy_successful, accuracy_attempted
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, data.MatchKey, data.TeamKey, scoutingReportName(user),
			data.WasAuto, data.ConflictedOwnAlliance, data.ConflictedOpposingAlliance,
			data.UsedOutpost, data.UsedDepot, data.Cycles, data.PercentContributed, data.AutoPointsContributed,
			data.GotDisabled, data.BPSRating, data.ObviousPenalties, data.PrimaryPath, data.IndexViaIntake,
			data.IntakeSpeed, data.Notes, data.ShooterRangeClose, data.ShooterRangeMid, data.ShooterRangeFar,
			data.Climb, data.ClimbLevel, data.ClimbLocation, data.AccuracySuccessful, data.AccuracyAttempted)

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

			WasAuto                    bool   `json:"was_auto"`
			ConflictedOwnAlliance      bool   `json:"conflicted_own_alliance"`
			ConflictedOpposingAlliance bool   `json:"conflicted_opposing_alliance"`
			UsedOutpost                bool   `json:"used_outpost"`
			UsedDepot                  bool   `json:"used_depot"`
			Cycles                     int    `json:"cycles"`
			PercentContributed         int    `json:"percent_contributed"`
			AutoPointsContributed      int    `json:"auto_points_contributed"`
			GotDisabled                bool   `json:"got_disabled"`
			BPSRating                  int    `json:"bps_rating"`
			ObviousPenalties           string `json:"obvious_penalties"`
			PrimaryPath                string `json:"primary_path"`
			IndexViaIntake             bool   `json:"index_via_intake"`
			IntakeSpeed                int    `json:"intake_speed"`
			Notes                      string `json:"notes"`
			ShooterRangeClose          bool   `json:"shooter_range_close"`
			ShooterRangeMid            bool   `json:"shooter_range_mid"`
			ShooterRangeFar            bool   `json:"shooter_range_far"`
			Climb                      bool   `json:"climb"`
			ClimbLevel                 string `json:"climb_level"`
			ClimbLocation              string `json:"climb_location"`
			AccuracySuccessful         bool   `json:"accuracy_successful"`
			AccuracyAttempted          bool   `json:"accuracy_attempted"`

			CreatedAt int64 `json:"created_at"`
			UpdatedAt int64 `json:"updated_at"`
		}

		var results []ScoutingData
		for rows.Next() {
			var s ScoutingData
			err := rows.Scan(
				&s.ID, &s.MatchKey, &s.TeamKey, &s.ScoutName,
				&s.WasAuto, &s.ConflictedOwnAlliance, &s.ConflictedOpposingAlliance,
				&s.UsedOutpost, &s.UsedDepot, &s.Cycles, &s.PercentContributed, &s.AutoPointsContributed,
				&s.GotDisabled, &s.BPSRating, &s.ObviousPenalties, &s.PrimaryPath, &s.IndexViaIntake,
				&s.IntakeSpeed, &s.Notes, &s.ShooterRangeClose, &s.ShooterRangeMid, &s.ShooterRangeFar,
				&s.Climb, &s.ClimbLevel, &s.ClimbLocation, &s.AccuracySuccessful, &s.AccuracyAttempted,
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
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}

		var data struct {
			MatchKey      string `json:"match_key"`
			AllianceColor string `json:"alliance_color"`
			DefensePlayed bool     `json:"defense_played"`
			DefenseQuality string  `json:"defense_quality"`
			GeneralStrategy []string `json:"general_strategy"`
			Notes         string `json:"notes"`
			FeedingDistance string `json:"feeding_distance"`
			AutoPointsScored int `json:"auto_points_scored"`
			AutoResult string `json:"auto_result"`
		}

		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			writeJSON(w, 400, map[string]string{"error": "invalid json"})
			return
		}

		data.MatchKey = strings.TrimSpace(data.MatchKey)
		data.AllianceColor = strings.ToLower(strings.TrimSpace(data.AllianceColor))
		data.DefenseQuality = strings.TrimSpace(data.DefenseQuality)
		data.Notes = strings.TrimSpace(data.Notes)
		data.FeedingDistance = strings.TrimSpace(data.FeedingDistance)
		data.AutoResult = strings.TrimSpace(data.AutoResult)

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

		strategyJSON, err := json.Marshal(data.GeneralStrategy)
		if err != nil {
			writeJSON(w, 400, map[string]string{"error": "invalid general_strategy"})
			return
		}

		_, err = db.Exec(`
			INSERT OR REPLACE INTO alliance_scouting_data (
				match_key, alliance_color, scout_name, defense_played, defense_quality,
				general_strategy, notes, feeding_distance, auto_points_scored, auto_result
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, data.MatchKey, data.AllianceColor, scoutingReportName(user), data.DefensePlayed, data.DefenseQuality,
			string(strategyJSON), data.Notes, data.FeedingDistance, data.AutoPointsScored, data.AutoResult)
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

			WasAuto                    bool   `json:"was_auto"`
			ConflictedOwnAlliance      bool   `json:"conflicted_own_alliance"`
			ConflictedOpposingAlliance bool   `json:"conflicted_opposing_alliance"`
			UsedOutpost                bool   `json:"used_outpost"`
			UsedDepot                  bool   `json:"used_depot"`
			Cycles                     int    `json:"cycles"`
			PercentContributed         int    `json:"percent_contributed"`
			AutoPointsContributed      int    `json:"auto_points_contributed"`
			GotDisabled                bool   `json:"got_disabled"`
			BPSRating                  int    `json:"bps_rating"`
			ObviousPenalties           string `json:"obvious_penalties"`
			PrimaryPath                string `json:"primary_path"`
			IndexViaIntake             bool   `json:"index_via_intake"`
			IntakeSpeed                int    `json:"intake_speed"`
			Notes                      string `json:"notes"`
			ShooterRangeClose          bool   `json:"shooter_range_close"`
			ShooterRangeMid            bool   `json:"shooter_range_mid"`
			ShooterRangeFar            bool   `json:"shooter_range_far"`
			Climb                      bool   `json:"climb"`
			ClimbLevel                 string `json:"climb_level"`
			ClimbLocation              string `json:"climb_location"`
			AccuracySuccessful         bool   `json:"accuracy_successful"`
			AccuracyAttempted          bool   `json:"accuracy_attempted"`

			CreatedAt int64 `json:"created_at"`
			UpdatedAt int64 `json:"updated_at"`
		}

		var results []ScoutingData
		for rows.Next() {
			var s ScoutingData
			err := rows.Scan(
				&s.ID, &s.MatchKey, &s.TeamKey, &s.ScoutName,
				&s.WasAuto, &s.ConflictedOwnAlliance, &s.ConflictedOpposingAlliance,
				&s.UsedOutpost, &s.UsedDepot, &s.Cycles, &s.PercentContributed, &s.AutoPointsContributed,
				&s.GotDisabled, &s.BPSRating, &s.ObviousPenalties, &s.PrimaryPath, &s.IndexViaIntake,
				&s.IntakeSpeed, &s.Notes, &s.ShooterRangeClose, &s.ShooterRangeMid, &s.ShooterRangeFar,
				&s.Climb, &s.ClimbLevel, &s.ClimbLocation, &s.AccuracySuccessful, &s.AccuracyAttempted,
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
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}

		var data struct {
			TeamKey   string `json:"team_key"`
			EventKey  string `json:"event_key"`
			EstimatedBPS                 string `json:"estimated_bps"`
			ShooterArchetype             string `json:"shooter_archetype"`
			CanTrench                    bool   `json:"can_trench"`
			CanBump                      bool   `json:"can_bump"`
			ClimbLevel                   string `json:"climb_level"`
			AutoClimb                    bool   `json:"auto_climb"`
			ClimbLocation                string `json:"climb_location"`
			Weight                       string `json:"weight"`
			Height                       string `json:"height"`
			VisionCapabilities           string `json:"vision_capabilities"`
			Dimensions                   string `json:"dimensions"`
			AutoPicture                  string `json:"auto_picture"`
			BatteryCount                 int    `json:"battery_count"`
			AutoCount                    int    `json:"auto_count"`
			IndexViaIntake               bool   `json:"index_via_intake"`
			IntakeAlwaysOut              bool   `json:"intake_always_out"`
			Feeding                      string `json:"feeding"`
			FullField                    bool   `json:"full_field"`
			HalfField                    bool   `json:"half_field"`
			PushFuel                     bool   `json:"push_fuel"`
			Drivetrain                   string `json:"drivetrain"`
			SwerveLevel                  string `json:"swerve_level"`
			ProgrammingLanguage          string `json:"programming_language"`
			YearsUsedProgrammingLanguage string `json:"years_used_programming_language"`
			IndexerType                  string `json:"indexer_type"`
			HasSpindexer                 bool   `json:"has_spindexer"`
			HasRollers                   bool   `json:"has_rollers"`
			HasBelts                     bool   `json:"has_belts"`
			IndexerOther                 string `json:"indexer_other"`
			Notes                        string `json:"notes"`
			MustPointAtHub               bool   `json:"must_point_at_hub"`
			MotorsBesidesDrivetrain      int    `json:"motors_besides_drivetrain"`
			DrivetrainMotors             int    `json:"drivetrain_motors"`
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
				estimated_bps, shooter_archetype, can_trench, can_bump, climb_level, auto_climb,
				climb_location, weight, height, vision_capabilities, dimensions, auto_picture,
				battery_count, auto_count, index_via_intake, intake_always_out, feeding, full_field,
				half_field, push_fuel, drivetrain, swerve_level, programming_language,
				years_used_programming_language, indexer_type, has_spindexer, has_rollers,
				has_belts, indexer_other, notes, must_point_at_hub, motors_besides_drivetrain,
				drivetrain_motors
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, data.TeamKey, data.EventKey, scoutingReportName(user),
			data.EstimatedBPS, data.ShooterArchetype, data.CanTrench, data.CanBump, data.ClimbLevel, data.AutoClimb,
			data.ClimbLocation, data.Weight, data.Height, data.VisionCapabilities, data.Dimensions, data.AutoPicture,
			data.BatteryCount, data.AutoCount, data.IndexViaIntake, data.IntakeAlwaysOut, data.Feeding, data.FullField,
			data.HalfField, data.PushFuel, data.Drivetrain, data.SwerveLevel, data.ProgrammingLanguage,
			data.YearsUsedProgrammingLanguage, data.IndexerType, data.HasSpindexer, data.HasRollers,
			data.HasBelts, data.IndexerOther, data.Notes, data.MustPointAtHub, data.MotorsBesidesDrivetrain,
			data.DrivetrainMotors)

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

			EstimatedBPS                 string `json:"estimated_bps"`
			ShooterArchetype             string `json:"shooter_archetype"`
			CanTrench                    bool   `json:"can_trench"`
			CanBump                      bool   `json:"can_bump"`
			ClimbLevel                   string `json:"climb_level"`
			AutoClimb                    bool   `json:"auto_climb"`
			ClimbLocation                string `json:"climb_location"`
			Weight                       string `json:"weight"`
			Height                       string `json:"height"`
			VisionCapabilities           string `json:"vision_capabilities"`
			Dimensions                   string `json:"dimensions"`
			AutoPicture                  string `json:"auto_picture"`
			BatteryCount                 int    `json:"battery_count"`
			AutoCount                    int    `json:"auto_count"`
			IndexViaIntake               bool   `json:"index_via_intake"`
			IntakeAlwaysOut              bool   `json:"intake_always_out"`
			Feeding                      string `json:"feeding"`
			FullField                    bool   `json:"full_field"`
			HalfField                    bool   `json:"half_field"`
			PushFuel                     bool   `json:"push_fuel"`
			Drivetrain                   string `json:"drivetrain"`
			SwerveLevel                  string `json:"swerve_level"`
			ProgrammingLanguage          string `json:"programming_language"`
			YearsUsedProgrammingLanguage string `json:"years_used_programming_language"`
			IndexerType                  string `json:"indexer_type"`
			HasSpindexer                 bool   `json:"has_spindexer"`
			HasRollers                   bool   `json:"has_rollers"`
			HasBelts                     bool   `json:"has_belts"`
			IndexerOther                 string `json:"indexer_other"`
			Notes                        string `json:"notes"`
			MustPointAtHub               bool   `json:"must_point_at_hub"`
			MotorsBesidesDrivetrain      int    `json:"motors_besides_drivetrain"`
			DrivetrainMotors             int    `json:"drivetrain_motors"`

			CreatedAt int64 `json:"created_at"`
			UpdatedAt int64 `json:"updated_at"`
		}

		var data PitScoutingData
		err := row.Scan(
			&data.ID, &data.TeamKey, &data.EventKey, &data.ScoutName,
			&data.EstimatedBPS, &data.ShooterArchetype, &data.CanTrench, &data.CanBump, &data.ClimbLevel, &data.AutoClimb,
			&data.ClimbLocation, &data.Weight, &data.Height, &data.VisionCapabilities, &data.Dimensions, &data.AutoPicture,
			&data.BatteryCount, &data.AutoCount, &data.IndexViaIntake, &data.IntakeAlwaysOut, &data.Feeding, &data.FullField,
			&data.HalfField, &data.PushFuel, &data.Drivetrain, &data.SwerveLevel, &data.ProgrammingLanguage,
			&data.YearsUsedProgrammingLanguage, &data.IndexerType, &data.HasSpindexer, &data.HasRollers,
			&data.HasBelts, &data.IndexerOther, &data.Notes, &data.MustPointAtHub, &data.MotorsBesidesDrivetrain,
			&data.DrivetrainMotors,
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

func PitScoutingExportCSV(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if !canExportScoutingData(user.Role) {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		rows, err := db.Query(`
			SELECT
				p.team_key,
				COALESCE(t.team_num, 0),
				COALESCE(p.event_key, ''),
				COALESCE(p.scout_name, ''),
				COALESCE(p.estimated_bps, ''),
				COALESCE(p.shooter_archetype, ''),
				p.can_trench,
				p.can_bump,
				COALESCE(p.climb_level, ''),
				p.auto_climb,
				COALESCE(p.climb_location, ''),
				COALESCE(p.weight, ''),
				COALESCE(p.height, ''),
				COALESCE(p.vision_capabilities, ''),
				COALESCE(p.dimensions, ''),
				COALESCE(p.auto_picture, ''),
				COALESCE(p.battery_count, 0),
				COALESCE(p.auto_count, 0),
				p.index_via_intake,
				p.intake_always_out,
				COALESCE(p.feeding, ''),
				p.full_field,
				p.half_field,
				p.push_fuel,
				COALESCE(p.drivetrain, ''),
				COALESCE(p.swerve_level, ''),
				COALESCE(p.programming_language, ''),
				COALESCE(p.years_used_programming_language, ''),
				COALESCE(p.indexer_type, ''),
				p.has_spindexer,
				p.has_rollers,
				p.has_belts,
				COALESCE(p.indexer_other, ''),
				COALESCE(p.notes, ''),
				p.must_point_at_hub,
				COALESCE(p.motors_besides_drivetrain, 0),
				COALESCE(p.drivetrain_motors, 0),
				p.created_at,
				p.updated_at
			FROM pit_scouting_data p
			LEFT JOIN teams t ON t.team_key = p.team_key
			ORDER BY t.team_num ASC, p.created_at DESC
		`)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		records := [][]string{{
			"team_key", "team_num", "event_key", "scout_name", "estimated_bps", "shooter_archetype",
			"can_trench", "can_bump", "climb_level", "auto_climb", "climb_location", "weight", "height",
			"vision_capabilities", "dimensions", "auto_picture", "battery_count", "auto_count",
			"index_via_intake", "intake_always_out", "feeding", "full_field", "half_field", "push_fuel",
			"drivetrain", "swerve_level", "programming_language", "years_used_programming_language",
			"indexer_type", "has_spindexer", "has_rollers", "has_belts", "indexer_other", "notes",
			"must_point_at_hub", "motors_besides_drivetrain", "drivetrain_motors", "created_at", "updated_at",
		}}

		for rows.Next() {
			var teamKey, eventKey, scoutName, estimatedBPS, shooterArchetype, climbLevel, climbLocation string
			var weight, height, visionCapabilities, dimensions, autoPicture, feeding, drivetrain string
			var swerveLevel, programmingLanguage, yearsUsedProgrammingLanguage, indexerType, indexerOther, notes string
			var teamNum, batteryCount, autoCount, motorsBesidesDrivetrain, drivetrainMotors int
			var canTrench, canBump, autoClimb, indexViaIntake, intakeAlwaysOut, fullField, halfField, pushFuel bool
			var hasSpindexer, hasRollers, hasBelts, mustPointAtHub bool
			var createdAt, updatedAt int64

			if err := rows.Scan(
				&teamKey, &teamNum, &eventKey, &scoutName, &estimatedBPS, &shooterArchetype,
				&canTrench, &canBump, &climbLevel, &autoClimb, &climbLocation, &weight, &height,
				&visionCapabilities, &dimensions, &autoPicture, &batteryCount, &autoCount,
				&indexViaIntake, &intakeAlwaysOut, &feeding, &fullField, &halfField, &pushFuel,
				&drivetrain, &swerveLevel, &programmingLanguage, &yearsUsedProgrammingLanguage,
				&indexerType, &hasSpindexer, &hasRollers, &hasBelts, &indexerOther, &notes,
				&mustPointAtHub, &motorsBesidesDrivetrain, &drivetrainMotors, &createdAt, &updatedAt,
			); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}

			records = append(records, []string{
				teamKey, strconv.Itoa(teamNum), eventKey, scoutName, estimatedBPS, shooterArchetype,
				strconv.FormatBool(canTrench), strconv.FormatBool(canBump), climbLevel, strconv.FormatBool(autoClimb),
				climbLocation, weight, height, visionCapabilities, dimensions, autoPicture,
				strconv.Itoa(batteryCount), strconv.Itoa(autoCount), strconv.FormatBool(indexViaIntake),
				strconv.FormatBool(intakeAlwaysOut), feeding, strconv.FormatBool(fullField),
				strconv.FormatBool(halfField), strconv.FormatBool(pushFuel), drivetrain, swerveLevel,
				programmingLanguage, yearsUsedProgrammingLanguage, indexerType, strconv.FormatBool(hasSpindexer),
				strconv.FormatBool(hasRollers), strconv.FormatBool(hasBelts), indexerOther, notes,
				strconv.FormatBool(mustPointAtHub), strconv.Itoa(motorsBesidesDrivetrain),
				strconv.Itoa(drivetrainMotors), strconv.FormatInt(createdAt, 10), strconv.FormatInt(updatedAt, 10),
			})
		}

		writeCSVResponse(w, "pit_scouting_export.csv", records)
	}
}

func MatchScoutingExportCSV(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if !canExportScoutingData(user.Role) {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		eventKey := strings.TrimSpace(chi.URLParam(r, "event_key"))
		if eventKey == "" {
			writeJSON(w, 400, map[string]string{"error": "event_key is required"})
			return
		}

		rows, err := db.Query(`
			SELECT
				m.event_key,
				ms.match_key,
				COALESCE(m.match_number, 0),
				ms.team_key,
				COALESCE(t.team_num, 0),
				COALESCE(ms.scout_name, ''),
				ms.was_auto,
				ms.conflicted_own_alliance,
				ms.conflicted_opposing_alliance,
				ms.used_outpost,
				ms.used_depot,
				COALESCE(ms.cycles, 0),
				COALESCE(ms.percent_contributed, 0),
				COALESCE(ms.auto_points_contributed, 0),
				ms.got_disabled,
				COALESCE(ms.bps_rating, 0),
				COALESCE(ms.obvious_penalties, ''),
				COALESCE(ms.primary_path, ''),
				ms.index_via_intake,
				COALESCE(ms.intake_speed, 0),
				COALESCE(ms.notes, ''),
				ms.shooter_range_close,
				ms.shooter_range_mid,
				ms.shooter_range_far,
				ms.climb,
				COALESCE(ms.climb_level, ''),
				COALESCE(ms.climb_location, ''),
				COALESCE(ms.accuracy_successful, 0),
				COALESCE(ms.accuracy_attempted, 0),
				ms.created_at,
				ms.updated_at
			FROM match_scouting_data ms
			JOIN matches m ON m.match_key = ms.match_key
			LEFT JOIN teams t ON t.team_key = ms.team_key
			WHERE m.event_key = ?
			ORDER BY m.match_number ASC, t.team_num ASC, ms.created_at ASC
		`, eventKey)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		records := [][]string{{
			"event_key", "match_key", "match_number", "team_key", "team_num", "scout_name",
			"was_auto", "conflicted_own_alliance", "conflicted_opposing_alliance", "used_outpost",
			"used_depot", "cycles", "percent_contributed", "auto_points_contributed", "got_disabled",
			"bps_rating", "obvious_penalties", "primary_path", "index_via_intake", "intake_speed",
			"notes", "shooter_range_close", "shooter_range_mid", "shooter_range_far", "climb",
			"climb_level", "climb_location", "accuracy_successful", "accuracy_attempted", "created_at", "updated_at",
		}}

		for rows.Next() {
			var rowEventKey, matchKey, teamKey, scoutName, obviousPenalties, primaryPath, notes, climbLevel, climbLocation string
			var matchNumber, teamNum, cycles, percentContributed, autoPointsContributed, bpsRating, intakeSpeed int
			var wasAuto, conflictedOwnAlliance, conflictedOpposingAlliance, usedOutpost, usedDepot, gotDisabled bool
			var indexViaIntake, shooterRangeClose, shooterRangeMid, shooterRangeFar, climb, accuracySuccessful, accuracyAttempted bool
			var createdAt, updatedAt int64

			if err := rows.Scan(
				&rowEventKey, &matchKey, &matchNumber, &teamKey, &teamNum, &scoutName,
				&wasAuto, &conflictedOwnAlliance, &conflictedOpposingAlliance, &usedOutpost,
				&usedDepot, &cycles, &percentContributed, &autoPointsContributed, &gotDisabled,
				&bpsRating, &obviousPenalties, &primaryPath, &indexViaIntake, &intakeSpeed,
				&notes, &shooterRangeClose, &shooterRangeMid, &shooterRangeFar, &climb,
				&climbLevel, &climbLocation, &accuracySuccessful, &accuracyAttempted, &createdAt, &updatedAt,
			); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}

			records = append(records, []string{
				rowEventKey, matchKey, strconv.Itoa(matchNumber), teamKey, strconv.Itoa(teamNum), scoutName,
				strconv.FormatBool(wasAuto), strconv.FormatBool(conflictedOwnAlliance), strconv.FormatBool(conflictedOpposingAlliance),
				strconv.FormatBool(usedOutpost), strconv.FormatBool(usedDepot), strconv.Itoa(cycles),
				strconv.Itoa(percentContributed), strconv.Itoa(autoPointsContributed), strconv.FormatBool(gotDisabled),
				strconv.Itoa(bpsRating), obviousPenalties, primaryPath, strconv.FormatBool(indexViaIntake),
				strconv.Itoa(intakeSpeed), notes, strconv.FormatBool(shooterRangeClose),
				strconv.FormatBool(shooterRangeMid), strconv.FormatBool(shooterRangeFar), strconv.FormatBool(climb),
				climbLevel, climbLocation, strconv.FormatBool(accuracySuccessful), strconv.FormatBool(accuracyAttempted),
				strconv.FormatInt(createdAt, 10), strconv.FormatInt(updatedAt, 10),
			})
		}

		filename := fmt.Sprintf("match_scouting_%s.csv", eventKey)
		writeCSVResponse(w, filename, records)
	}
}

func MatchScoutingDummyExportCSV(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if !canExportScoutingData(user.Role) {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		records := [][]string{{
			"event_key", "match_key", "match_number", "team_key", "team_num", "scout_name",
			"was_auto", "conflicted_own_alliance", "conflicted_opposing_alliance", "used_outpost",
			"used_depot", "cycles", "percent_contributed", "auto_points_contributed", "got_disabled",
			"bps_rating", "obvious_penalties", "primary_path", "index_via_intake", "intake_speed",
			"notes", "shooter_range_close", "shooter_range_mid", "shooter_range_far", "climb",
			"climb_level", "climb_location", "accuracy_successful", "accuracy_attempted", "created_at", "updated_at",
		}}

		now := time.Now().Unix()
		scouters := []string{"Alex Scout", "Jordan Scout", "Taylor Scout", "Morgan Scout", "Casey Scout", "Riley Scout"}
		ranges := []string{"close", "mid", "far"}
		paths := []string{"trench", "bump", "both"}
		climbLevels := []string{"None", "Low", "Mid", "High"}

		for matchNumber := 1; matchNumber <= 50; matchNumber++ {
			matchKey := fmt.Sprintf("dummy2026_qm%d", matchNumber)
			baseTeamNum := 1000 + ((matchNumber - 1) * 6)

			for slot := 0; slot < 6; slot++ {
				teamNum := baseTeamNum + slot + 1
				teamKey := fmt.Sprintf("frc%d", teamNum)
				scoutName := scouters[(matchNumber+slot)%len(scouters)]
				selectedRange := ranges[(matchNumber+slot)%len(ranges)]
				selectedPath := paths[(matchNumber+slot)%len(paths)]
				climbLevel := climbLevels[(matchNumber+slot)%len(climbLevels)]
				createdAt := now - int64((50-matchNumber)*300) - int64(slot*7)
				updatedAt := createdAt + 60
				wasAuto := (matchNumber+slot)%2 == 0
				accuracyAttempted := (matchNumber+slot)%3 != 0
				accuracySuccessful := accuracyAttempted && (matchNumber+slot)%4 != 0

				records = append(records, []string{
					"dummy2026",
					matchKey,
					strconv.Itoa(matchNumber),
					teamKey,
					strconv.Itoa(teamNum),
					scoutName,
					strconv.FormatBool(wasAuto),
					strconv.FormatBool((matchNumber+slot)%11 == 0),
					strconv.FormatBool((matchNumber+slot)%17 == 0),
					strconv.FormatBool(slot%2 == 0),
					strconv.FormatBool(slot%3 == 0),
					strconv.Itoa(2 + ((matchNumber + slot) % 8)),
					strconv.Itoa(20 + ((matchNumber * 7) + slot) % 81),
					"0",
					strconv.FormatBool((matchNumber+slot)%19 == 0),
					strconv.Itoa(1 + ((matchNumber + slot) % 5)),
					func() string {
						if (matchNumber+slot)%9 == 0 {
							return "G204 contact"
						}
						return ""
					}(),
					selectedPath,
					strconv.FormatBool((matchNumber+slot)%2 == 1),
					strconv.Itoa(1 + ((matchNumber + slot) % 5)),
					fmt.Sprintf("Dummy scouting notes for qual %d team %d", matchNumber, teamNum),
					strconv.FormatBool(selectedRange == "close"),
					strconv.FormatBool(selectedRange == "mid"),
					strconv.FormatBool(selectedRange == "far"),
					strconv.FormatBool(climbLevel != "None"),
					climbLevel,
					func() string {
						if climbLevel == "None" {
							return ""
						}
						if slot < 3 {
							return "Center"
						}
						return "Side"
					}(),
					strconv.FormatBool(accuracySuccessful),
					strconv.FormatBool(accuracyAttempted),
					strconv.FormatInt(createdAt, 10),
					strconv.FormatInt(updatedAt, 10),
				})
			}
		}

		writeCSVResponse(w, "match_scouting_dummy_50_quals.csv", records)
	}
}

// --- NOTES
func NotesList(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if !canAccessMatchNotes(user.Role) {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		match := r.URL.Query().Get("match_key")
		var rows *sql.Rows
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
			if err := rows.Scan(&n.ID, &n.MatchKey, &n.TeamKey, &n.Author, &n.Note, &n.CreatedAt); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			out = append(out, n)
		}
		writeJSON(w, 200, out)
	}
}

func NotesCreate(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		if !canAccessMatchNotes(user.Role) {
			writeJSON(w, 403, map[string]string{"error": "forbidden"})
			return
		}

		var in struct{ MatchKey, TeamKey, Author, Note string }
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}
		in.MatchKey = strings.TrimSpace(in.MatchKey)
		in.TeamKey = strings.TrimSpace(in.TeamKey)
		in.Note = strings.TrimSpace(in.Note)
		if in.MatchKey == "" {
			writeJSON(w, 400, map[string]string{"error": "match_key is required"})
			return
		}
		if in.Note == "" {
			writeJSON(w, 400, map[string]string{"error": "note is required"})
			return
		}
		if strings.TrimSpace(in.Author) == "" {
			in.Author = scoutingReportName(user)
		}
		now := time.Now().Unix()
		res, err := db.Exec(`INSERT INTO notes(match_key, team_key, author, note, created_at) VALUES(?,?,?,?,?)`,
			in.MatchKey, in.TeamKey, in.Author, in.Note, now)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		id, _ := res.LastInsertId()
		writeJSON(w, 201, map[string]any{
			"id":         id,
			"match_key":  in.MatchKey,
			"team_key":   in.TeamKey,
			"author":     in.Author,
			"note":       in.Note,
			"created_at": now,
		})
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
