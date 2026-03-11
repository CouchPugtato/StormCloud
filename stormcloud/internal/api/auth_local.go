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

		writeJSON(w, 201, map[string]any{
			"token":      token,
			"expires_at": expiresAt,
			"user":       user,
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

		writeJSON(w, 200, map[string]any{
			"token":      token,
			"expires_at": expiresAt,
			"user":       user,
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
		writeJSON(w, 200, map[string]any{"user": user})
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
