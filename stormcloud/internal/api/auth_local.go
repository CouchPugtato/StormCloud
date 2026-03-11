package api

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const localSessionDuration = 60 * 60 * 24 * 14 // 14 days

type authUser struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Role      string `json:"role"`
	CreatedAt int64  `json:"created_at"`
}

type userStats struct {
	TotalMatches  int         `json:"allTimeMatches"`
	SeasonMatches int         `json:"seasonMatches"`
	EventMatches  map[string]int `json:"eventMatches"`
}

type authUserResponse struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Role      string    `json:"role"`
	CreatedAt int64     `json:"created_at"`
	Stats     userStats `json:"stats"`
}

func currentSeasonYear(db *sql.DB) int {
	var raw string
	if err := db.QueryRow(`SELECT COALESCE(value, '') FROM app_settings WHERE key='season_year'`).Scan(&raw); err == nil {
		if year, convErr := strconv.Atoi(strings.TrimSpace(raw)); convErr == nil && year > 0 {
			return year
		}
	}
	if envYear, err := strconv.Atoi(strings.TrimSpace(os.Getenv("CURRENT_YEAR"))); err == nil && envYear > 0 {
		return envYear
	}
	return time.Now().Year()
}

func refreshScoutingOwnership(db *sql.DB) error {
	queries := []string{
		`UPDATE match_scouting_data
		 SET scout_user_id = (
			SELECT u.id
			FROM users u
			WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(match_scouting_data.scout_name))
			   OR LOWER(TRIM(u.first_name || ' ' || u.last_name)) = LOWER(TRIM(match_scouting_data.scout_name))
			LIMIT 1
		 )
		 WHERE scout_user_id IS NULL AND TRIM(COALESCE(scout_name, '')) <> ''`,
		`UPDATE pit_scouting_data
		 SET scout_user_id = (
			SELECT u.id
			FROM users u
			WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(pit_scouting_data.scout_name))
			   OR LOWER(TRIM(u.first_name || ' ' || u.last_name)) = LOWER(TRIM(pit_scouting_data.scout_name))
			LIMIT 1
		 )
		 WHERE scout_user_id IS NULL AND TRIM(COALESCE(scout_name, '')) <> ''`,
		`UPDATE alliance_scouting_data
		 SET scout_user_id = (
			SELECT u.id
			FROM users u
			WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(alliance_scouting_data.scout_name))
			   OR LOWER(TRIM(u.first_name || ' ' || u.last_name)) = LOWER(TRIM(alliance_scouting_data.scout_name))
			LIMIT 1
		 )
		 WHERE scout_user_id IS NULL AND TRIM(COALESCE(scout_name, '')) <> ''`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			return err
		}
	}
	return nil
}

func recomputeUserMatchStats(db *sql.DB, userID string) (userStats, error) {
	stats := userStats{EventMatches: map[string]int{}}
	if strings.TrimSpace(userID) == "" {
		return stats, nil
	}

	if err := refreshScoutingOwnership(db); err != nil {
		return stats, err
	}

	rows, err := db.Query(`
		SELECT COALESCE(m.event_key, ''), COUNT(1)
		FROM match_scouting_data ms
		LEFT JOIN matches m ON m.match_key = ms.match_key
		WHERE ms.scout_user_id=?
		GROUP BY COALESCE(m.event_key, '')
	`, userID)
	if err != nil {
		return stats, err
	}
	defer rows.Close()

	total := 0
	for rows.Next() {
		var eventKey string
		var count int
		if err := rows.Scan(&eventKey, &count); err != nil {
			return stats, err
		}
		total += count
		if strings.TrimSpace(eventKey) != "" {
			stats.EventMatches[eventKey] = count
		}
	}
	stats.TotalMatches = total

	seasonYear := currentSeasonYear(db)
	if err := db.QueryRow(`
		SELECT COUNT(1)
		FROM match_scouting_data ms
		JOIN matches m ON m.match_key = ms.match_key
		LEFT JOIN events e ON e.event_key = m.event_key
		WHERE ms.scout_user_id=? AND COALESCE(e.year, 0)=?
	`, userID, seasonYear).Scan(&stats.SeasonMatches); err != nil {
		return stats, err
	}

	tx, err := db.Begin()
	if err != nil {
		return stats, err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec(`DELETE FROM user_event_stats WHERE user_id=?`, userID); err != nil {
		return stats, err
	}
	for eventKey, count := range stats.EventMatches {
		if _, err := tx.Exec(`
			INSERT INTO user_event_stats(user_id, event_key, match_reports)
			VALUES(?,?,?)
		`, userID, eventKey, count); err != nil {
			return stats, err
		}
	}
	if _, err := tx.Exec(`
		UPDATE users
		SET total_match_reports=?, season_match_reports=?, updated_at=?
		WHERE id=?
	`, stats.TotalMatches, stats.SeasonMatches, time.Now().Unix(), userID); err != nil {
		return stats, err
	}
	if err := tx.Commit(); err != nil {
		return stats, err
	}

	return stats, nil
}

func recomputeAllUserMatchStats(db *sql.DB) error {
	rows, err := db.Query(`SELECT id FROM users`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return err
		}
		if _, err := recomputeUserMatchStats(db, userID); err != nil {
			return err
		}
	}
	return nil
}

func buildAuthUserResponse(db *sql.DB, user authUser) (authUserResponse, error) {
	stats, err := recomputeUserMatchStats(db, user.ID)
	if err != nil {
		return authUserResponse{}, err
	}
	return authUserResponse{
		ID:        user.ID,
		Email:     user.Email,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
		Stats:     stats,
	}, nil
}

func hashSessionToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func createSessionToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func extractBearerToken(r *http.Request) string {
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if auth == "" {
		return ""
	}
	const prefix = "Bearer "
	if !strings.HasPrefix(auth, prefix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(auth, prefix))
}

func getRequestIP(r *http.Request) string {
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}

func getAuthenticatedUser(db *sql.DB, r *http.Request) (*authUser, string, error) {
	rawToken := extractBearerToken(r)
	if rawToken == "" {
		return nil, "", errors.New("missing auth token")
	}
	tokenHash := hashSessionToken(rawToken)

	now := time.Now().Unix()
	row := db.QueryRow(`
		SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.created_at
		FROM user_sessions s
		JOIN users u ON u.id = s.user_id
		WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at > ?
	`, tokenHash, now)

	var user authUser
	if err := row.Scan(&user.ID, &user.Email, &user.FirstName, &user.LastName, &user.Role, &user.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, "", errors.New("invalid auth token")
		}
		return nil, "", err
	}
	return &user, tokenHash, nil
}

func issueSession(db *sql.DB, userID string, r *http.Request) (string, int64, error) {
	token, err := createSessionToken()
	if err != nil {
		return "", 0, err
	}
	tokenHash := hashSessionToken(token)
	now := time.Now().Unix()
	expiresAt := now + localSessionDuration
	_, err = db.Exec(`
		INSERT INTO user_sessions(token_hash, user_id, created_at, expires_at, user_agent, ip_address)
		VALUES(?,?,?,?,?,?)
	`, tokenHash, userID, now, expiresAt, strings.TrimSpace(r.UserAgent()), getRequestIP(r))
	if err != nil {
		return "", 0, err
	}
	return token, expiresAt, nil
}

func isValidRole(role string) bool {
	switch role {
	case "viewer", "scouter", "drive_team", "scouting_lead":
		return true
	default:
		return false
	}
}

func LocalAuthRegister(db *sql.DB) http.HandlerFunc {
	type in struct {
		Email     string `json:"email"`
		Password  string `json:"password"`
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		email := strings.ToLower(strings.TrimSpace(payload.Email))
		password := strings.TrimSpace(payload.Password)
		firstName := strings.TrimSpace(payload.FirstName)
		lastName := strings.TrimSpace(payload.LastName)
		if email == "" || password == "" || firstName == "" || lastName == "" {
			writeJSON(w, 400, map[string]string{"error": "email, password, first_name, and last_name are required"})
			return
		}
		if len(password) < 8 {
			writeJSON(w, 400, map[string]string{"error": "password must be at least 8 characters"})
			return
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": "failed to hash password"})
			return
		}

		now := time.Now().Unix()
		user := authUser{
			ID:        uuid.NewString(),
			Email:     email,
			FirstName: firstName,
			LastName:  lastName,
			Role:      "viewer",
			CreatedAt: now,
		}

		_, err = db.Exec(`
			INSERT INTO users(id, email, password_hash, first_name, last_name, role, created_at, updated_at)
			VALUES(?,?,?,?,?,?,?,?)
		`, user.ID, user.Email, string(hash), user.FirstName, user.LastName, user.Role, now, now)
		if err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "unique") {
				writeJSON(w, 409, map[string]string{"error": "email is already registered"})
				return
			}
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		token, expiresAt, err := issueSession(db, user.ID, r)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": "failed to create session"})
			return
		}

		userResponse, err := buildAuthUserResponse(db, user)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 201, map[string]any{
			"token":      token,
			"expires_at": expiresAt,
			"user":       userResponse,
		})
	}
}

func LocalAuthLogin(db *sql.DB) http.HandlerFunc {
	type in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		email := strings.ToLower(strings.TrimSpace(payload.Email))
		password := strings.TrimSpace(payload.Password)
		if email == "" || password == "" {
			writeJSON(w, 400, map[string]string{"error": "email and password are required"})
			return
		}

		var user authUser
		var passwordHash string
		row := db.QueryRow(`
			SELECT id, email, password_hash, first_name, last_name, role, created_at
			FROM users WHERE email=?
		`, email)
		if err := row.Scan(&user.ID, &user.Email, &passwordHash, &user.FirstName, &user.LastName, &user.Role, &user.CreatedAt); err != nil {
			writeJSON(w, 401, map[string]string{"error": "invalid email or password"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
			writeJSON(w, 401, map[string]string{"error": "invalid email or password"})
			return
		}

		token, expiresAt, err := issueSession(db, user.ID, r)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": "failed to create session"})
			return
		}

		userResponse, err := buildAuthUserResponse(db, user)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{
			"token":      token,
			"expires_at": expiresAt,
			"user":       userResponse,
		})
	}
}

func LocalAuthMe(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		userResponse, err := buildAuthUserResponse(db, *user)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, 200, map[string]any{"user": userResponse})
	}
}

func LocalAuthLogout(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, tokenHash, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}

		_, err = db.Exec(`UPDATE user_sessions SET revoked_at=? WHERE token_hash=?`, time.Now().Unix(), tokenHash)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, 200, map[string]any{"ok": true})
	}
}

func LocalUsersList(db *sql.DB) http.HandlerFunc {
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
			SELECT id, email, first_name, last_name, role, created_at
			FROM users
			ORDER BY created_at DESC
		`)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		out := make([]authUser, 0)
		for rows.Next() {
			var u authUser
			if err := rows.Scan(&u.ID, &u.Email, &u.FirstName, &u.LastName, &u.Role, &u.CreatedAt); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			out = append(out, u)
		}
		writeJSON(w, 200, out)
	}
}

func LocalLeaderboard(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := recomputeAllUserMatchStats(db); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		leaderboardType := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("type")))
		if leaderboardType == "" {
			leaderboardType = "alltime"
		}
		eventKey := strings.TrimSpace(r.URL.Query().Get("event_key"))

		type leaderboardEntry struct {
			ID         string `json:"id"`
			Name       string `json:"name"`
			Email      string `json:"email"`
			Role       string `json:"role"`
			MatchCount int    `json:"matchCount"`
		}

		query := ""
		args := []interface{}{}
		switch leaderboardType {
		case "event":
			if eventKey == "" {
				writeJSON(w, 400, map[string]string{"error": "event_key is required"})
				return
			}
			query = `
				SELECT u.id, TRIM(u.first_name || ' ' || u.last_name), u.email, u.role, ues.match_reports
				FROM user_event_stats ues
				JOIN users u ON u.id = ues.user_id
				WHERE ues.event_key=? AND ues.match_reports > 0
				ORDER BY ues.match_reports DESC, u.created_at ASC
			`
			args = append(args, eventKey)
		case "season":
			query = `
				SELECT u.id, TRIM(u.first_name || ' ' || u.last_name), u.email, u.role, u.season_match_reports
				FROM users u
				WHERE u.season_match_reports > 0
				ORDER BY u.season_match_reports DESC, u.created_at ASC
			`
		default:
			query = `
				SELECT u.id, TRIM(u.first_name || ' ' || u.last_name), u.email, u.role, u.total_match_reports
				FROM users u
				WHERE u.total_match_reports > 0
				ORDER BY u.total_match_reports DESC, u.created_at ASC
			`
		}

		rows, err := db.Query(query, args...)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		out := make([]leaderboardEntry, 0)
		for rows.Next() {
			var item leaderboardEntry
			if err := rows.Scan(&item.ID, &item.Name, &item.Email, &item.Role, &item.MatchCount); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
			if strings.TrimSpace(item.Name) == "" {
				item.Name = item.Email
			}
			out = append(out, item)
		}
		writeJSON(w, 200, out)
	}
}

func LocalAuthProfileUpdate(db *sql.DB) http.HandlerFunc {
	type in struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}

		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		firstName := strings.TrimSpace(payload.FirstName)
		lastName := strings.TrimSpace(payload.LastName)
		if firstName == "" || lastName == "" {
			writeJSON(w, 400, map[string]string{"error": "first_name and last_name are required"})
			return
		}

		oldName := scoutingReportName(user)
		if _, err := db.Exec(`
			UPDATE users SET first_name=?, last_name=?, updated_at=? WHERE id=?
		`, firstName, lastName, time.Now().Unix(), user.ID); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		updatedUser := *user
		updatedUser.FirstName = firstName
		updatedUser.LastName = lastName
		newName := scoutingReportName(&updatedUser)

		queries := []string{
			`UPDATE match_scouting_data SET scout_name=?, scout_user_id=? WHERE scout_user_id=? OR scout_name=?`,
			`UPDATE pit_scouting_data SET scout_name=?, scout_user_id=? WHERE scout_user_id=? OR scout_name=?`,
			`UPDATE alliance_scouting_data SET scout_name=?, scout_user_id=? WHERE scout_user_id=? OR scout_name=?`,
			`UPDATE notes SET author=? WHERE author=?`,
		}
		for index, query := range queries {
			if index < 3 {
				if _, err := db.Exec(query, newName, user.ID, user.ID, oldName); err != nil {
					writeJSON(w, 500, map[string]string{"error": err.Error()})
					return
				}
				continue
			}
			if _, err := db.Exec(query, newName, oldName); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
		}

		userResponse, err := buildAuthUserResponse(db, updatedUser)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, 200, map[string]any{"ok": true, "user": userResponse})
	}
}

func LocalAuthPasswordUpdate(db *sql.DB) http.HandlerFunc {
	type in struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(db, r)
		if err != nil {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}

		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		currentPassword := strings.TrimSpace(payload.CurrentPassword)
		newPassword := strings.TrimSpace(payload.NewPassword)
		if currentPassword == "" || newPassword == "" {
			writeJSON(w, 400, map[string]string{"error": "current_password and new_password are required"})
			return
		}
		if len(newPassword) < 8 {
			writeJSON(w, 400, map[string]string{"error": "new password must be at least 8 characters"})
			return
		}

		var passwordHash string
		if err := db.QueryRow(`SELECT password_hash FROM users WHERE id=?`, user.ID).Scan(&passwordHash); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(currentPassword)); err != nil {
			writeJSON(w, 401, map[string]string{"error": "current password is incorrect"})
			return
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": "failed to hash password"})
			return
		}

		if _, err := db.Exec(`UPDATE users SET password_hash=?, updated_at=? WHERE id=?`, string(hash), time.Now().Unix(), user.ID); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{"ok": true})
	}
}

func LocalUserRoleUpdate(db *sql.DB) http.HandlerFunc {
	type in struct {
		TargetUserID string `json:"target_user_id"`
		TargetRole   string `json:"target_role"`
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
		targetUserID := strings.TrimSpace(payload.TargetUserID)
		targetRole := strings.TrimSpace(payload.TargetRole)
		if targetUserID == "" || !isValidRole(targetRole) {
			writeJSON(w, 400, map[string]string{"error": "invalid role update payload"})
			return
		}
		if targetUserID == user.ID {
			writeJSON(w, 403, map[string]string{"error": "you cannot change your own account role"})
			return
		}

		res, err := db.Exec(`UPDATE users SET role=?, updated_at=? WHERE id=?`, targetRole, time.Now().Unix(), targetUserID)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			writeJSON(w, 404, map[string]string{"error": "user not found"})
			return
		}

		writeJSON(w, 200, map[string]any{"ok": true, "target_user_id": targetUserID, "target_role": targetRole})
	}
}
