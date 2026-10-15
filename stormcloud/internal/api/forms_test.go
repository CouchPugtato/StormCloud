package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	stormdb "github.com/CouchPugtato/StormCloud/internal/db"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type formTestAPI struct {
	db     *sql.DB
	router http.Handler
	tokens map[string]string
}

func newFormTestAPI(t *testing.T) *formTestAPI {
	t.Helper()
	db, err := stormdb.Open(filepath.Join(t.TempDir(), "forms.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := stormdb.Migrate(db); err != nil {
		t.Fatal(err)
	}
	a := &formTestAPI{db: db, tokens: map[string]string{}}
	for _, role := range []string{"scouting_lead", "scouter", "viewer", "drive_team", "other_scouter"} {
		storedRole := role
		if role == "other_scouter" {
			storedRole = "scouter"
		}
		_, err := db.Exec(`INSERT INTO users(id,email,password_hash,first_name,last_name,role,created_at,updated_at) VALUES(?,?,'unused','Test','Scout',?,0,0)`, role, role+"@example.com", storedRole)
		if err != nil {
			t.Fatal(err)
		}
		token, _, err := issueSession(db, role, httptest.NewRequest("POST", "/", nil))
		if err != nil {
			t.Fatal(err)
		}
		a.tokens[role] = token
	}
	for _, statement := range []string{
		`INSERT INTO events(event_key,year) VALUES('2026test',2026),('2026other',2026),('2025test',2025)`,
		`INSERT INTO teams(team_key,team_num) VALUES('frc509',509)`,
		`INSERT INTO matches(match_key,event_key) VALUES('2026test_qm1','2026test'),('2026other_qm1','2026other')`,
	} {
		if _, err := db.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	r := chi.NewRouter()
	r.Route("/api", func(r chi.Router) { registerFormRoutes(r, db) })
	a.router = r
	return a
}

func (a *formTestAPI) request(t *testing.T, role, method, path string, body any, status int) []byte {
	t.Helper()
	var raw string
	if value, ok := body.(string); ok {
		raw = value
	} else if body != nil {
		raw = mustFormJSON(body)
	}
	r := httptest.NewRequest(method, "/api"+path, strings.NewReader(raw))
	if role != "" {
		r.Header.Set("Authorization", "Bearer "+a.tokens[role])
	}
	w := httptest.NewRecorder()
	a.router.ServeHTTP(w, r)
	if w.Code != status {
		t.Fatalf("%s %s as %s: got %d, want %d: %s", method, path, role, w.Code, status, w.Body.String())
	}
	return w.Body.Bytes()
}

func testDefinition() FormDefinition {
	minimum, maximum, maxLength := float64(0), float64(100), 12
	return FormDefinition{SchemaVersion: 1, Sections: []FormSection{{ID: "performance", Title: "Performance", Fields: []FormField{
		{ID: "cycles", Label: "Cycles", Type: "integer", Widget: "counter", Required: true, Minimum: &minimum, Maximum: &maximum},
		{ID: "disabled", Label: "Disabled", Type: "boolean", Required: true},
		{ID: "notes", Label: "Notes", Type: "text", Widget: "textarea", MaxLength: &maxLength},
		{ID: "climb", Label: "Climb", Type: "single_choice", Options: []string{"none", "high"}},
		{ID: "paths", Label: "Paths", Type: "multiple_choice", Options: []string{"trench", "bump"}},
	}}}}
}

func (a *formTestAPI) create(t *testing.T, kind string) (storedForm, storedFormVersion) {
	t.Helper()
	body := map[string]any{"name": "2026 Scouting", "season": 2026, "kind": kind, "definition": testDefinition()}
	raw := a.request(t, "scouting_lead", "POST", "/forms", body, 201)
	var result struct {
		Form    storedForm        `json:"form"`
		Version storedFormVersion `json:"version"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		t.Fatal(err)
	}
	return result.Form, result.Version
}

func versionPath(f storedForm, v storedFormVersion) string {
	return "/forms/" + f.ID + "/versions/" + v.ID
}

func TestFormLifecycleAndPermissions(t *testing.T) {
	a := newFormTestAPI(t)
	a.request(t, "", "GET", "/forms", nil, 401)
	a.request(t, "viewer", "POST", "/forms", `{}`, 403)
	f, v := a.create(t, "match")
	path := versionPath(f, v)
	a.request(t, "scouter", "GET", path, nil, 404)
	a.request(t, "scouter", "GET", "/forms/"+f.ID, nil, 404)
	if raw := a.request(t, "scouter", "GET", "/forms", nil, 200); string(raw) != "[]\n" {
		t.Fatal(string(raw))
	}
	a.request(t, "scouter", "PUT", path, `{}`, 403)
	update := map[string]any{"revision": 1, "definition": testDefinition()}
	a.request(t, "scouting_lead", "PUT", path, update, 200)
	a.request(t, "scouting_lead", "PUT", path, update, 409)
	a.request(t, "scouting_lead", "POST", path+"/publish", `{"revision":1}`, 409)
	a.request(t, "scouting_lead", "POST", path+"/publish", `{"revision":2}`, 200)
	a.request(t, "viewer", "GET", path, nil, 200)
	a.request(t, "scouter", "GET", "/forms/"+f.ID, nil, 200)
	a.request(t, "scouting_lead", "PUT", path, map[string]any{"revision": 3, "definition": testDefinition()}, 409)
	a.request(t, "scouting_lead", "POST", path+"/publish", `{"revision":3}`, 409)
	if _, err := a.db.Exec(`UPDATE scouting_form_versions SET definition='{}' WHERE id=?`, v.ID); err == nil {
		t.Fatal("database allowed published definition update")
	}
	if _, err := a.db.Exec(`DELETE FROM scouting_form_versions WHERE id=?`, v.ID); err == nil {
		t.Fatal("database allowed published version deletion")
	}
	raw := a.request(t, "scouting_lead", "POST", "/forms/"+f.ID+"/versions", map[string]any{"definition": testDefinition()}, 201)
	var next storedFormVersion
	if err := json.Unmarshal(raw, &next); err != nil {
		t.Fatal(err)
	}
	if next.Version != 2 || next.Status != "draft" {
		t.Fatalf("unexpected next version: %+v", next)
	}
	raw = a.request(t, "scouter", "GET", "/forms/"+f.ID+"/versions", nil, 200)
	var versions []storedFormVersion
	if err := json.Unmarshal(raw, &versions); err != nil {
		t.Fatal(err)
	}
	if len(versions) != 1 || versions[0].ID != v.ID {
		t.Fatalf("draft leaked: %s", raw)
	}
	a.request(t, "scouting_lead", "GET", "/forms/"+uuid.NewString()+"/versions/"+v.ID, nil, 404)
	a.request(t, "scouter", "GET", "/forms?season=nope", nil, 400)
	a.request(t, "scouter", "GET", "/forms?limit=101", nil, 400)
	if raw := a.request(t, "scouter", "GET", "/forms?season=2025", nil, 200); string(raw) != "[]\n" {
		t.Fatal(string(raw))
	}
}

func TestFormSubmissions(t *testing.T) {
	a := newFormTestAPI(t)
	f, v := a.create(t, "match")
	body := map[string]any{"id": uuid.NewString(), "version_id": v.ID, "event_key": "2026test", "team_key": "frc509", "match_key": "2026test_qm1", "answers": map[string]any{"cycles": 0, "disabled": false}}
	a.request(t, "scouter", "POST", "/form-submissions", body, 404)
	a.request(t, "scouting_lead", "POST", versionPath(f, v)+"/publish", `{"revision":1}`, 200)
	a.request(t, "viewer", "POST", "/form-submissions", body, 403)
	a.request(t, "scouter", "POST", "/form-submissions", body, 201)
	a.request(t, "scouter", "POST", "/form-submissions", body, 200)
	a.request(t, "other_scouter", "POST", "/form-submissions", body, 409)
	body["answers"] = map[string]any{"cycles": 1, "disabled": false}
	a.request(t, "scouter", "POST", "/form-submissions", body, 409)
	var count int
	if err := a.db.QueryRow(`SELECT COUNT(*) FROM scouting_form_submissions`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("retry created duplicates: %d, %v", count, err)
	}
	body["id"] = uuid.NewString()
	body["event_key"] = "2025test"
	a.request(t, "scouter", "POST", "/form-submissions", body, 400)
	body["event_key"] = "2026test"
	body["match_key"] = "2026other_qm1"
	a.request(t, "scouter", "POST", "/form-submissions", body, 400)
	body["match_key"] = "2026test_qm1"
	body["team_key"] = "frc999"
	a.request(t, "scouter", "POST", "/form-submissions", body, 400)
	body["team_key"] = "frc509"
	body["scout_user_id"] = "scouting_lead"
	a.request(t, "scouter", "POST", "/form-submissions", body, 400)
	delete(body, "scout_user_id")
	body["answers"] = map[string]any{"cycles": -1, "disabled": false}
	a.request(t, "scouter", "POST", "/form-submissions", body, 400)
	for _, role := range []string{"scouter", "scouting_lead", "drive_team"} {
		raw := a.request(t, role, "GET", "/form-submissions?event_key=2026test", nil, 200)
		var entries []storedFormSubmission
		if err := json.Unmarshal(raw, &entries); err != nil || len(entries) != 1 {
			t.Fatalf("%s: %s (%v)", role, raw, err)
		}
		if entries[0].ScoutUserID != "scouter" || entries[0].VersionID != v.ID {
			t.Fatal("lost ownership/version")
		}
	}
	for _, role := range []string{"other_scouter", "viewer"} {
		if raw := a.request(t, role, "GET", "/form-submissions", nil, 200); string(raw) != "[]\n" {
			t.Fatalf("ownership leak: %s", raw)
		}
	}
	if raw := a.request(t, "scouting_lead", "GET", "/form-submissions?event_key=2026other", nil, 200); string(raw) != "[]\n" {
		t.Fatal(string(raw))
	}
}

func TestPitAndAllianceSubmissionContexts(t *testing.T) {
	a := newFormTestAPI(t)
	for _, kind := range []string{"pit", "alliance"} {
		f, v := a.create(t, kind)
		a.request(t, "scouting_lead", "POST", versionPath(f, v)+"/publish", `{"revision":1}`, 200)
		body := map[string]any{"id": uuid.NewString(), "version_id": v.ID, "event_key": "2026test", "answers": map[string]any{"cycles": 2, "disabled": true}}
		a.request(t, "scouter", "POST", "/form-submissions", body, 400)
		if kind == "pit" {
			body["team_key"] = "frc509"
		} else {
			body["match_key"] = "2026test_qm1"
			body["alliance_color"] = "red"
		}
		a.request(t, "scouter", "POST", "/form-submissions", body, 201)
	}
}

func TestFormDefinitionAndAnswerValidation(t *testing.T) {
	for _, tc := range []struct {
		name, answers string
		valid         bool
	}{
		{"zero and false", `{"cycles":0,"disabled":false}`, true},
		{"choices", `{"cycles":1,"disabled":true,"climb":"high","paths":["trench","bump"]}`, true},
		{"missing", `{"disabled":false}`, false},
		{"null", `{"cycles":null,"disabled":false}`, false},
		{"negative", `{"cycles":-1,"disabled":false}`, false},
		{"too large", `{"cycles":101,"disabled":false}`, false},
		{"decimal", `{"cycles":1.5,"disabled":false}`, false},
		{"numeric string", `{"cycles":"2","disabled":false}`, false},
		{"boolean integer", `{"cycles":1,"disabled":0}`, false},
		{"unknown field", `{"cycles":1,"disabled":false,"extra":1}`, false},
		{"bad choice", `{"cycles":1,"disabled":false,"climb":"low"}`, false},
		{"duplicate choices", `{"cycles":1,"disabled":false,"paths":["bump","bump"]}`, false},
		{"long text", `{"cycles":1,"disabled":false,"notes":"more than twelve characters"}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var answers map[string]json.RawMessage
			if err := json.Unmarshal([]byte(tc.answers), &answers); err != nil {
				t.Fatal(err)
			}
			if err := validateAnswers(testDefinition(), answers); (err == nil) != tc.valid {
				t.Fatalf("valid=%v, error=%v", tc.valid, err)
			}
		})
	}
	d := testDefinition()
	d.Sections[0].Fields[1].ID = "cycles"
	if validateDefinition(d) == nil {
		t.Fatal("duplicate field IDs accepted")
	}
	d = testDefinition()
	d.SchemaVersion = 2
	if validateDefinition(d) == nil {
		t.Fatal("unsupported schema accepted")
	}
	d = testDefinition()
	d.Sections[0].Fields[0].Widget = "textarea"
	if validateDefinition(d) == nil {
		t.Fatal("incompatible widget accepted")
	}
	a := newFormTestAPI(t)
	a.request(t, "scouting_lead", "POST", "/forms", `{"unexpected":true}`, 400)
	a.request(t, "scouting_lead", "POST", "/forms", `{} {}`, 400)
	a.request(t, "scouting_lead", "POST", "/forms", `null`, 400)
	a.request(t, "scouting_lead", "POST", "/forms", `{"name":"`+strings.Repeat("x", (1<<20))+`"}`, 413)
}

func TestFormMigrationPreservesExistingData(t *testing.T) {
	a := newFormTestAPI(t)
	// restore migration 018 state before testing the upgrade
	for _, statement := range []string{
		`DROP TABLE scouting_form_submissions`,
		`DROP TABLE scouting_form_versions`,
		`DROP TABLE scouting_forms`,
		`DELETE FROM schema_migrations WHERE name='019_versioned_forms.sql'`,
	} {
		if _, err := a.db.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := a.db.Exec(`INSERT INTO match_scouting_data(match_key,team_key,scout_name,cycles,created_at,updated_at) VALUES('2026test_qm1','frc509','Legacy Scout',7,?,?)`, time.Now().Unix(), time.Now().Unix()); err != nil {
		t.Fatal(err)
	}
	if err := stormdb.Migrate(a.db); err != nil {
		t.Fatal(err)
	}
	var cycles int
	if err := a.db.QueryRow(`SELECT cycles FROM match_scouting_data WHERE scout_name='Legacy Scout'`).Scan(&cycles); err != nil || cycles != 7 {
		t.Fatalf("legacy data changed: %d, %v", cycles, err)
	}
}
