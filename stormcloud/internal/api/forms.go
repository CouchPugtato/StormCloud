package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type storedForm struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Season    int    `json:"season"`
	Kind      string `json:"kind"`
	CreatedBy string `json:"created_by"`
	CreatedAt int64  `json:"created_at"`
}

type storedFormVersion struct {
	ID          string          `json:"id"`
	FormID      string          `json:"form_id"`
	Version     int             `json:"version"`
	Status      string          `json:"status"`
	Revision    int             `json:"revision"`
	Definition  json.RawMessage `json:"definition"`
	CreatedBy   string          `json:"created_by"`
	CreatedAt   int64           `json:"created_at"`
	UpdatedAt   int64           `json:"updated_at"`
	PublishedAt *int64          `json:"published_at"`
}

type storedFormSubmission struct {
	ID            string          `json:"id"`
	VersionID     string          `json:"version_id"`
	ScoutUserID   string          `json:"scout_user_id"`
	EventKey      string          `json:"event_key"`
	TeamKey       string          `json:"team_key,omitempty"`
	MatchKey      string          `json:"match_key,omitempty"`
	AllianceColor string          `json:"alliance_color,omitempty"`
	Answers       json.RawMessage `json:"answers"`
	CreatedAt     int64           `json:"created_at"`
}

type formsAPI struct{ db *sql.DB }
type formHandler func(http.ResponseWriter, *http.Request, *authUser)

func registerFormRoutes(r chi.Router, db *sql.DB) {
	a := formsAPI{db: db}
	r.Get("/forms", a.authorize(false, a.listForms))
	r.Post("/forms", a.authorize(true, a.createForm))
	r.Get("/forms/{form_id}", a.authorize(false, a.getForm))
	r.Get("/forms/{form_id}/versions", a.authorize(false, a.listVersions))
	r.Post("/forms/{form_id}/versions", a.authorize(true, a.createVersion))
	r.Get("/forms/{form_id}/versions/{version_id}", a.authorize(false, a.getVersion))
	r.Put("/forms/{form_id}/versions/{version_id}", a.authorize(true, a.updateVersion))
	r.Post("/forms/{form_id}/versions/{version_id}/publish", a.authorize(true, a.publishVersion))
	r.Post("/form-submissions", a.authorize(false, a.submit))
	r.Get("/form-submissions", a.authorize(false, a.listSubmissions))
}

func (a formsAPI) authorize(leadOnly bool, next formHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _, err := getAuthenticatedUser(a.db, r)
		if err != nil {
			formError(w, 401, "unauthorized")
			return
		}
		if leadOnly && user.Role != "scouting_lead" {
			formError(w, 403, "scouting lead access required")
			return
		}
		next(w, r, user)
	}
}

func formError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// limit request size and reject unknown properties
func decodeFormRequest(w http.ResponseWriter, r *http.Request, value any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	err := decoder.Decode(value)
	if err == nil {
		var extra any
		if decoder.Decode(&extra) != io.EOF {
			err = errors.New("expected one JSON object")
		}
	}
	if err != nil {
		var sizeError *http.MaxBytesError
		if errors.As(err, &sizeError) {
			formError(w, 413, "request exceeds 1 MiB")
			return false
		}
		formError(w, 400, "invalid request: "+err.Error())
		return false
	}
	return true
}

func (a formsAPI) loadForm(w http.ResponseWriter, r *http.Request) (storedForm, bool) {
	var f storedForm
	err := a.db.QueryRow(`SELECT id, name, season, kind, created_by, created_at FROM scouting_forms WHERE id=?`, chi.URLParam(r, "form_id")).Scan(&f.ID, &f.Name, &f.Season, &f.Kind, &f.CreatedBy, &f.CreatedAt)
	if err == sql.ErrNoRows {
		formError(w, 404, "form not found")
		return f, false
	}
	if err != nil {
		formError(w, 500, "unable to load form")
		return f, false
	}
	return f, true
}

func (a formsAPI) getForm(w http.ResponseWriter, r *http.Request, user *authUser) {
	f, ok := a.loadForm(w, r)
	if !ok {
		return
	}
	if user.Role != "scouting_lead" {
		var exists int
		err := a.db.QueryRow(`SELECT 1 FROM scouting_form_versions WHERE form_id=? AND status='published' LIMIT 1`, f.ID).Scan(&exists)
		if err == sql.ErrNoRows {
			formError(w, 404, "form not found")
			return
		}
		if err != nil {
			formError(w, 500, "unable to load form")
			return
		}
	}
	writeJSON(w, 200, f)
}

func formPage(w http.ResponseWriter, r *http.Request) (int, int, bool) {
	limit, offset := 100, 0
	var err error
	if raw := r.URL.Query().Get("limit"); raw != "" {
		limit, err = strconv.Atoi(raw)
	}
	if err != nil || limit < 1 || limit > 100 {
		formError(w, 400, "limit must be 1 to 100")
		return 0, 0, false
	}
	if raw := r.URL.Query().Get("offset"); raw != "" {
		offset, err = strconv.Atoi(raw)
	}
	if err != nil || offset < 0 {
		formError(w, 400, "offset must be nonnegative")
		return 0, 0, false
	}
	return limit, offset, true
}

func (a formsAPI) listForms(w http.ResponseWriter, r *http.Request, user *authUser) {
	limit, offset, ok := formPage(w, r)
	if !ok {
		return
	}
	query := `SELECT f.id, f.name, f.season, f.kind, f.created_by, f.created_at FROM scouting_forms f WHERE 1=1`
	args := []any{}
	if user.Role != "scouting_lead" {
		query += ` AND EXISTS (SELECT 1 FROM scouting_form_versions v WHERE v.form_id=f.id AND v.status='published')`
	}
	if season := r.URL.Query().Get("season"); season != "" {
		year, err := strconv.Atoi(season)
		if err != nil || year < 1992 || year > 9999 {
			formError(w, 400, "invalid season")
			return
		}
		query += ` AND f.season=?`
		args = append(args, year)
	}
	if kind := r.URL.Query().Get("kind"); kind != "" {
		if !validFormKind(kind) {
			formError(w, 400, "invalid kind")
			return
		}
		query += ` AND f.kind=?`
		args = append(args, kind)
	}
	query += ` ORDER BY f.created_at DESC, f.id LIMIT ? OFFSET ?`
	args = append(args, limit, offset)
	rows, err := a.db.Query(query, args...)
	if err != nil {
		formError(w, 500, "unable to list forms")
		return
	}
	defer rows.Close()
	result := []storedForm{}
	for rows.Next() {
		var f storedForm
		if err := rows.Scan(&f.ID, &f.Name, &f.Season, &f.Kind, &f.CreatedBy, &f.CreatedAt); err != nil {
			formError(w, 500, "unable to read forms")
			return
		}
		result = append(result, f)
	}
	if rows.Err() != nil {
		formError(w, 500, "unable to read forms")
		return
	}
	writeJSON(w, 200, result)
}

func validFormKind(kind string) bool { return kind == "match" || kind == "pit" || kind == "alliance" }

func (a formsAPI) createForm(w http.ResponseWriter, r *http.Request, user *authUser) {
	var in struct {
		Name       string         `json:"name"`
		Season     int            `json:"season"`
		Kind       string         `json:"kind"`
		Definition FormDefinition `json:"definition"`
	}
	if !decodeFormRequest(w, r, &in) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" || len(in.Name) > 200 || in.Season < 1992 || in.Season > 9999 || !validFormKind(in.Kind) {
		formError(w, 400, "name (1 to 200 bytes), season (1992 to 9999), and kind (match, pit, alliance) are required")
		return
	}
	if err := validateDefinition(in.Definition); err != nil {
		formError(w, 400, err.Error())
		return
	}
	now := time.Now().Unix()
	f := storedForm{ID: uuid.NewString(), Name: in.Name, Season: in.Season, Kind: in.Kind, CreatedBy: user.ID, CreatedAt: now}
	definition, _ := json.Marshal(in.Definition)
	v := storedFormVersion{ID: uuid.NewString(), FormID: f.ID, Version: 1, Status: "draft", Revision: 1, Definition: definition, CreatedBy: user.ID, CreatedAt: now, UpdatedAt: now}
	tx, err := a.db.Begin()
	if err != nil {
		formError(w, 500, "unable to create form")
		return
	}
	defer tx.Rollback()
	_, err = tx.Exec(`INSERT INTO scouting_forms(id,name,season,kind,created_by,created_at) VALUES(?,?,?,?,?,?)`, f.ID, f.Name, f.Season, f.Kind, user.ID, now)
	if err == nil {
		_, err = tx.Exec(`INSERT INTO scouting_form_versions(id,form_id,version,definition,created_by,created_at,updated_at) VALUES(?,?,1,?,?,?,?)`, v.ID, f.ID, string(definition), user.ID, now, now)
	}
	if err != nil {
		formError(w, 500, "unable to create form")
		return
	}
	if tx.Commit() != nil {
		formError(w, 500, "unable to create form")
		return
	}
	writeJSON(w, 201, map[string]any{"form": f, "version": v})
}

const formVersionColumns = `id,form_id,version,status,revision,definition,created_by,created_at,updated_at,published_at`

type formScanner interface{ Scan(...any) error }

func scanFormVersion(row formScanner) (storedFormVersion, error) {
	var v storedFormVersion
	var definition string
	err := row.Scan(&v.ID, &v.FormID, &v.Version, &v.Status, &v.Revision, &definition, &v.CreatedBy, &v.CreatedAt, &v.UpdatedAt, &v.PublishedAt)
	v.Definition = json.RawMessage(definition)
	return v, err
}

func (a formsAPI) loadVersion(w http.ResponseWriter, r *http.Request, user *authUser) (storedFormVersion, bool) {
	v, err := scanFormVersion(a.db.QueryRow(`SELECT `+formVersionColumns+` FROM scouting_form_versions WHERE id=? AND form_id=?`, chi.URLParam(r, "version_id"), chi.URLParam(r, "form_id")))
	if err == sql.ErrNoRows || (err == nil && v.Status == "draft" && user.Role != "scouting_lead") {
		formError(w, 404, "form version not found")
		return v, false
	}
	if err != nil {
		formError(w, 500, "unable to load form version")
		return v, false
	}
	return v, true
}

func (a formsAPI) getVersion(w http.ResponseWriter, r *http.Request, user *authUser) {
	if v, ok := a.loadVersion(w, r, user); ok {
		writeJSON(w, 200, v)
	}
}

func (a formsAPI) listVersions(w http.ResponseWriter, r *http.Request, user *authUser) {
	if _, ok := a.loadForm(w, r); !ok {
		return
	}
	limit, offset, ok := formPage(w, r)
	if !ok {
		return
	}
	query := `SELECT ` + formVersionColumns + ` FROM scouting_form_versions WHERE form_id=?`
	if user.Role != "scouting_lead" {
		query += ` AND status='published'`
	}
	rows, err := a.db.Query(query+` ORDER BY version DESC LIMIT ? OFFSET ?`, chi.URLParam(r, "form_id"), limit, offset)
	if err != nil {
		formError(w, 500, "unable to list versions")
		return
	}
	defer rows.Close()
	result := []storedFormVersion{}
	for rows.Next() {
		v, err := scanFormVersion(rows)
		if err != nil {
			formError(w, 500, "unable to read versions")
			return
		}
		result = append(result, v)
	}
	if rows.Err() != nil {
		formError(w, 500, "unable to read versions")
		return
	}
	writeJSON(w, 200, result)
}

func (a formsAPI) createVersion(w http.ResponseWriter, r *http.Request, user *authUser) {
	f, ok := a.loadForm(w, r)
	if !ok {
		return
	}
	var in struct {
		Definition FormDefinition `json:"definition"`
	}
	if !decodeFormRequest(w, r, &in) {
		return
	}
	if err := validateDefinition(in.Definition); err != nil {
		formError(w, 400, err.Error())
		return
	}
	definition, _ := json.Marshal(in.Definition)
	now, id := time.Now().Unix(), uuid.NewString()
	// assign version numbers atomically
	v, err := scanFormVersion(a.db.QueryRow(`INSERT INTO scouting_form_versions(id,form_id,version,definition,created_by,created_at,updated_at)
		SELECT ?,?,COALESCE(MAX(version),0)+1,?,?,?,? FROM scouting_form_versions WHERE form_id=? RETURNING `+formVersionColumns,
		id, f.ID, string(definition), user.ID, now, now, f.ID))
	if err != nil {
		formError(w, 500, "unable to create version")
		return
	}
	writeJSON(w, 201, v)
}

func (a formsAPI) updateVersion(w http.ResponseWriter, r *http.Request, user *authUser) {
	if _, ok := a.loadVersion(w, r, user); !ok {
		return
	}
	var in struct {
		Revision   int            `json:"revision"`
		Definition FormDefinition `json:"definition"`
	}
	if !decodeFormRequest(w, r, &in) {
		return
	}
	if in.Revision < 1 {
		formError(w, 400, "revision is required")
		return
	}
	if err := validateDefinition(in.Definition); err != nil {
		formError(w, 400, err.Error())
		return
	}
	definition, _ := json.Marshal(in.Definition)
	result, err := a.db.Exec(`UPDATE scouting_form_versions SET definition=?,revision=revision+1,updated_at=? WHERE id=? AND form_id=? AND status='draft' AND revision=?`, string(definition), time.Now().Unix(), chi.URLParam(r, "version_id"), chi.URLParam(r, "form_id"), in.Revision)
	if !formVersionWrite(w, result, err) {
		return
	}
	a.getVersion(w, r, user)
}

func (a formsAPI) publishVersion(w http.ResponseWriter, r *http.Request, user *authUser) {
	if _, ok := a.loadVersion(w, r, user); !ok {
		return
	}
	var in struct {
		Revision int `json:"revision"`
	}
	if !decodeFormRequest(w, r, &in) {
		return
	}
	if in.Revision < 1 {
		formError(w, 400, "revision is required")
		return
	}
	now := time.Now().Unix()
	result, err := a.db.Exec(`UPDATE scouting_form_versions SET status='published',published_at=?,updated_at=?,revision=revision+1 WHERE id=? AND form_id=? AND status='draft' AND revision=?`, now, now, chi.URLParam(r, "version_id"), chi.URLParam(r, "form_id"), in.Revision)
	if !formVersionWrite(w, result, err) {
		return
	}
	a.getVersion(w, r, user)
}

func formVersionWrite(w http.ResponseWriter, result sql.Result, err error) bool {
	if err != nil {
		formError(w, 500, "unable to save version")
		return false
	}
	count, err := result.RowsAffected()
	if err != nil {
		formError(w, 500, "unable to save version")
		return false
	}
	if count != 1 {
		formError(w, 409, "version is published or revision is stale; reload before editing")
		return false
	}
	return true
}

const formSubmissionColumns = `id,version_id,scout_user_id,event_key,COALESCE(team_key,''),COALESCE(match_key,''),COALESCE(alliance_color,''),answers,created_at`

func scanFormSubmission(row formScanner) (storedFormSubmission, error) {
	var s storedFormSubmission
	var answers string
	err := row.Scan(&s.ID, &s.VersionID, &s.ScoutUserID, &s.EventKey, &s.TeamKey, &s.MatchKey, &s.AllianceColor, &answers, &s.CreatedAt)
	s.Answers = json.RawMessage(answers)
	return s, err
}

func (a formsAPI) submit(w http.ResponseWriter, r *http.Request, user *authUser) {
	if user.Role != "scouter" && user.Role != "scouting_lead" {
		formError(w, 403, "scouter or scouting lead access required")
		return
	}
	var in struct {
		ID            string                     `json:"id"`
		VersionID     string                     `json:"version_id"`
		EventKey      string                     `json:"event_key"`
		TeamKey       string                     `json:"team_key"`
		MatchKey      string                     `json:"match_key"`
		AllianceColor string                     `json:"alliance_color"`
		Answers       map[string]json.RawMessage `json:"answers"`
	}
	if !decodeFormRequest(w, r, &in) {
		return
	}
	if _, err := uuid.Parse(in.ID); err != nil {
		formError(w, 400, "id must be a client-generated UUID (reuse it when retrying)")
		return
	}
	var definition, kind string
	err := a.db.QueryRow(`SELECT v.definition,f.kind FROM scouting_form_versions v JOIN scouting_forms f ON f.id=v.form_id WHERE v.id=? AND v.status='published'`, in.VersionID).Scan(&definition, &kind)
	if err == sql.ErrNoRows {
		formError(w, 404, "published form version not found")
		return
	}
	if err != nil {
		formError(w, 500, "unable to load form version")
		return
	}
	var d FormDefinition
	if json.Unmarshal([]byte(definition), &d) != nil {
		formError(w, 500, "unable to read definition")
		return
	}
	if err := validateAnswers(d, in.Answers); err != nil {
		formError(w, 400, err.Error())
		return
	}
	if in.EventKey == "" || (kind != "alliance" && in.TeamKey == "") || (kind != "pit" && in.MatchKey == "") ||
		(kind == "alliance" && (in.AllianceColor != "red" && in.AllianceColor != "blue")) ||
		(kind != "alliance" && in.AllianceColor != "") || (kind == "alliance" && in.TeamKey != "") || (kind == "pit" && in.MatchKey != "") {
		formError(w, 400, "invalid context: all forms require event_key; match requires team_key and match_key; pit requires team_key; alliance requires match_key and alliance_color")
		return
	}
	var exists int
	err = a.db.QueryRow(`SELECT 1 FROM events e JOIN scouting_form_versions v ON v.id=? JOIN scouting_forms f ON f.id=v.form_id WHERE e.event_key=? AND e.year=f.season`, in.VersionID, in.EventKey).Scan(&exists)
	if err != nil {
		formLookupError(w, err, "event must exist and match the form season")
		return
	}
	if in.TeamKey != "" {
		err = a.db.QueryRow(`SELECT 1 FROM teams WHERE team_key=?`, in.TeamKey).Scan(&exists)
		if err != nil {
			formLookupError(w, err, "team not found")
			return
		}
	}
	if in.MatchKey != "" {
		err = a.db.QueryRow(`SELECT 1 FROM matches WHERE match_key=? AND event_key=?`, in.MatchKey, in.EventKey).Scan(&exists)
		if err != nil {
			formLookupError(w, err, "match must belong to the event")
			return
		}
	}
	// normalize answers for retry comparison
	var values map[string]any
	decoder := json.NewDecoder(strings.NewReader(mustFormJSON(in.Answers)))
	decoder.UseNumber()
	if decoder.Decode(&values) != nil {
		formError(w, 400, "invalid answers")
		return
	}
	answers, _ := json.Marshal(values)
	result, err := a.db.Exec(`INSERT INTO scouting_form_submissions(id,version_id,scout_user_id,event_key,team_key,match_key,alliance_color,answers,created_at) VALUES(?,?,?,?,NULLIF(?,''),NULLIF(?,''),NULLIF(?,''),?,?) ON CONFLICT(id) DO NOTHING`, in.ID, in.VersionID, user.ID, in.EventKey, in.TeamKey, in.MatchKey, in.AllianceColor, string(answers), time.Now().Unix())
	if err != nil {
		formError(w, 500, "unable to save submission")
		return
	}
	s, err := scanFormSubmission(a.db.QueryRow(`SELECT `+formSubmissionColumns+` FROM scouting_form_submissions WHERE id=?`, in.ID))
	if err != nil {
		formError(w, 500, "unable to load submission")
		return
	}
	if s.ScoutUserID != user.ID || s.VersionID != in.VersionID || s.EventKey != in.EventKey || s.TeamKey != in.TeamKey || s.MatchKey != in.MatchKey || s.AllianceColor != in.AllianceColor || string(s.Answers) != string(answers) {
		formError(w, 409, "submission id was already used for different data")
		return
	}
	count, err := result.RowsAffected()
	if err != nil {
		formError(w, 500, "unable to confirm submission")
		return
	}
	status := 201
	if count == 0 {
		status = 200
	}
	writeJSON(w, status, s)
}

func mustFormJSON(value any) string { data, _ := json.Marshal(value); return string(data) }

func formLookupError(w http.ResponseWriter, err error, message string) {
	if err == sql.ErrNoRows {
		formError(w, 400, message)
	} else {
		formError(w, 500, "unable to validate submission context")
	}
}

func (a formsAPI) listSubmissions(w http.ResponseWriter, r *http.Request, user *authUser) {
	limit, offset, ok := formPage(w, r)
	if !ok {
		return
	}
	query := `SELECT ` + formSubmissionColumns + ` FROM scouting_form_submissions WHERE 1=1`
	args := []any{}
	if !canExportScoutingData(user.Role) {
		query += ` AND scout_user_id=?`
		args = append(args, user.ID)
	}
	for _, filter := range []string{"version_id", "event_key", "team_key", "match_key"} {
		if value := r.URL.Query().Get(filter); value != "" {
			query += ` AND ` + filter + `=?`
			args = append(args, value)
		}
	}
	query += ` ORDER BY created_at DESC,id LIMIT ? OFFSET ?`
	args = append(args, limit, offset)
	rows, err := a.db.Query(query, args...)
	if err != nil {
		formError(w, 500, "unable to list submissions")
		return
	}
	defer rows.Close()
	result := []storedFormSubmission{}
	for rows.Next() {
		s, err := scanFormSubmission(rows)
		if err != nil {
			formError(w, 500, "unable to read submissions")
			return
		}
		result = append(result, s)
	}
	if rows.Err() != nil {
		formError(w, 500, "unable to read submissions")
		return
	}
	writeJSON(w, 200, result)
}
