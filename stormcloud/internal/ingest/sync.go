package ingest

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"time"

	"github.com/CouchPugtato/StormCloud/internal/models"
)

type SyncSettings struct {
	SyncAllTeams       bool `json:"sync_all_teams"`
	SyncEventTeamsOnly bool `json:"sync_event_teams_only"`
	EnableEPASync      bool `json:"enable_epa_sync"`
	CurrentYear        int  `json:"current_year"`
}

type EventsConfig struct {
	SyncSettings   SyncSettings `json:"sync_settings"`
	TBAKeys        []string     `json:"tba_keys"`
	StatboticsKeys []string     `json:"statbotics_keys"`
}

type SyncService struct {
	db           *sql.DB
	tbaLimiter   *RateLimiter
	sbLimiter    *RateLimiter
	tbaAPIKey    string
	sbAPIKey     string
	currentYear  int
	eventsConfig *EventsConfig
}

type RateLimiter struct {
	lastRequest time.Time
	minInterval time.Duration
}

func NewRateLimiter(requestsPerSecond float64) *RateLimiter {
	return &RateLimiter{
		minInterval: time.Duration(float64(time.Second) / requestsPerSecond),
	}
}

func (rl *RateLimiter) Wait() {
	now := time.Now()
	if elapsed := now.Sub(rl.lastRequest); elapsed < rl.minInterval {
		time.Sleep(rl.minInterval - elapsed)
	}
	rl.lastRequest = time.Now()
}

func (s *SyncService) LoadEventsConfig(configPath string) error {
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		log.Printf("Events config file not found at %s, using default sync behavior", configPath)
		return nil
	}

	data, err := ioutil.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read events config: %w", err)
	}

	var config EventsConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("failed to parse events config: %w", err)
	}

	s.eventsConfig = &config
	log.Printf("Loaded events config with %d TBA keys and %d Statbotics keys", len(config.TBAKeys), len(config.StatboticsKeys))
	return nil
}

func NewSyncService(db *sql.DB) *SyncService {
	return &SyncService{
		db:          db,
		tbaLimiter:  NewRateLimiter(2.0), // TBA allows ~2 requests per second
		sbLimiter:   NewRateLimiter(5.0), // Statbotics is more generous
		currentYear: 2025,
	}
}

func (s *SyncService) SetAPIKeys(tbaKey, sbKey string) {
	s.tbaAPIKey = tbaKey
	s.sbAPIKey = sbKey
}

func (s *SyncService) SetCurrentYear(year int) {
	s.currentYear = year
}

func (s *SyncService) SyncTeams(year int) error {
	if s.eventsConfig != nil && s.eventsConfig.SyncSettings.SyncEventTeamsOnly {
		return s.SyncTeamsFromEvents()
	}

	log.Printf("Starting team sync for year %d", year)

	page := 0
	for {
		log.Printf("[TBA] Fetching teams page %d", page)
		s.tbaLimiter.Wait()
		code, body, _, err := TBAGet(fmt.Sprintf("/teams/%d", page), s.tbaAPIKey)
		if err != nil {
			return fmt.Errorf("[TBA] Teams request failed: %w", err)
		}
		if code != 200 {
			return fmt.Errorf("[TBA] Teams request returned %d", code)
		}

		var tbaTeams []models.TBATeam
		if err := json.Unmarshal(body, &tbaTeams); err != nil {
			return fmt.Errorf("failed to parse TBA teams: %w", err)
		}

		if len(tbaTeams) == 0 {
			break
		}

		for _, tbaTeam := range tbaTeams {
			team := models.Team{
				TeamKey:    tbaTeam.Key,
				TeamNum:    tbaTeam.TeamNumber,
				Name:       tbaTeam.Nickname,
				City:       tbaTeam.City,
				State:      tbaTeam.StateProv,
				Country:    tbaTeam.Country,
				RookieYear: tbaTeam.RookieYear,
				LastSynced: time.Now(),
			}

			if err := s.storeTeam(team); err != nil {
				log.Printf("Failed to store team %s: %v", team.TeamKey, err)
				continue
			}
		}

		page++
	}

	log.Printf("[TBA] Team sync completed for year %d", year)
	return nil
}

func (s *SyncService) SyncTeamsFromEvents() error {
	if s.eventsConfig == nil {
		return fmt.Errorf("no events configuration loaded")
	}

	log.Printf("Starting event-based team sync for %d events", len(s.eventsConfig.TBAKeys))

	teamsSeen := make(map[string]bool)

	for _, tbaKey := range s.eventsConfig.TBAKeys {
		log.Printf("Syncing teams from event: %s", tbaKey)

		log.Printf("[TBA] Fetching teams for event %s", tbaKey)
		s.tbaLimiter.Wait()
		code, body, _, err := TBAGet(fmt.Sprintf("/event/%s/teams/simple", tbaKey), s.tbaAPIKey)
		if err != nil {
			log.Printf("[TBA] Failed to get teams for event %s: %v", tbaKey, err)
			continue
		}
		if code != 200 {
			log.Printf("[TBA] Request for event %s teams returned %d", tbaKey, code)
			continue
		}

		var tbaTeams []models.TBATeam
		if err := json.Unmarshal(body, &tbaTeams); err != nil {
			log.Printf("Failed to parse teams for event %s: %v", tbaKey, err)
			continue
		}

		log.Printf("Found %d teams for event %s", len(tbaTeams), tbaKey)

		for _, tbaTeam := range tbaTeams {
			if teamsSeen[tbaTeam.Key] {
				continue
			}
			teamsSeen[tbaTeam.Key] = true

			team := models.Team{
				TeamKey:    tbaTeam.Key,
				TeamNum:    tbaTeam.TeamNumber,
				Name:       tbaTeam.Nickname,
				City:       tbaTeam.City,
				State:      tbaTeam.StateProv,
				Country:    tbaTeam.Country,
				RookieYear: tbaTeam.RookieYear,
				LastSynced: time.Now(),
			}

			if err := s.storeTeam(team); err != nil {
				log.Printf("Failed to store team %s: %v", team.TeamKey, err)
				continue
			}
		}
	}

	log.Printf("Event-based team sync completed. Processed %d unique teams", len(teamsSeen))
	return nil
}

func (s *SyncService) SyncEPAForExistingTeams(year int) error {
	log.Printf("Starting EPA sync for existing teams (year %d)", year)

	if s.eventsConfig == nil {
		return fmt.Errorf("no events configuration loaded")
	}

	eventTeams := make(map[int]bool)

	for _, tbaKey := range s.eventsConfig.TBAKeys {
		log.Printf("[TBA] Fetching teams for event %s to build EPA sync list", tbaKey)
		s.tbaLimiter.Wait()
		code, body, _, err := TBAGet(fmt.Sprintf("/event/%s/teams/simple", tbaKey), s.tbaAPIKey)
		if err != nil {
			log.Printf("[TBA] Failed to get teams for event %s: %v", tbaKey, err)
			continue
		}
		if code != 200 {
			log.Printf("[TBA] Request for event %s teams returned %d", tbaKey, code)
			continue
		}

		var tbaTeams []models.TBATeam
		if err := json.Unmarshal(body, &tbaTeams); err != nil {
			log.Printf("Failed to parse teams for event %s: %v", tbaKey, err)
			continue
		}

		for _, tbaTeam := range tbaTeams {
			eventTeams[tbaTeam.TeamNumber] = true
		}
	}

	rows, err := s.db.Query(`SELECT team_num FROM teams ORDER BY team_num`)
	if err != nil {
		return fmt.Errorf("failed to query teams: %w", err)
	}
	defer rows.Close()

	var teamNums []int
	for rows.Next() {
		var teamNum int
		if err := rows.Scan(&teamNum); err != nil {
			log.Printf("Failed to scan team number: %v", err)
			continue
		}
		if eventTeams[teamNum] {
			teamNums = append(teamNums, teamNum)
		}
	}

	log.Printf("Found %d teams from configured events in database, syncing EPA data", len(teamNums))

	successCount := 0
	for _, teamNum := range teamNums {
		if err := s.syncTeamEPA(teamNum, year); err != nil {
			log.Printf("Failed to sync EPA for team %d: %v", teamNum, err)
		} else {
			successCount++
			log.Printf("[Statbotics] Successfully synced EPA for team %d", teamNum)
		}
	}

	log.Printf("EPA sync completed. Successfully synced %d/%d teams", successCount, len(teamNums))
	return nil
}

func (s *SyncService) syncTeamEPA(teamNum, year int) error {
	log.Printf("[Statbotics] Fetching EPA data for team %d (year %d)", teamNum, year)
	s.sbLimiter.Wait()
	code, body, err := SBGet(fmt.Sprintf("/team_year/%d/%d", teamNum, year))
	if err != nil {
		return fmt.Errorf("[Statbotics] Request failed: %w", err)
	}
	if code == 404 {
		return nil
	}
	if code != 200 {
		return fmt.Errorf("[Statbotics] Request returned %d", code)
	}

	var sbTeam models.SBTeamYear
	if err := json.Unmarshal(body, &sbTeam); err != nil {
		return fmt.Errorf("failed to parse Statbotics data: %w", err)
	}

	epa := models.TeamYearEPA{
		TeamNum: teamNum,
		Year:    year,
		EPA:     sbTeam.EPA.TotalPoints.Mean,
		AutoEPA: sbTeam.EPA.Breakdown.AutoPoints,
		TeleEPA: sbTeam.EPA.Breakdown.TeleopPoints,
		EndEPA:  sbTeam.EPA.Breakdown.EndgamePoints,
		RPEPA:   (sbTeam.EPA.Breakdown.MelodyRP + sbTeam.EPA.Breakdown.EnsembleRP) / 2,
	}

	payload := map[string]interface{}{
		"team":        sbTeam.Team,
		"year":        sbTeam.Year,
		"epa_end":     sbTeam.EPA.TotalPoints.Mean,
		"epa_auto":    sbTeam.EPA.Breakdown.AutoPoints,
		"epa_teleop":  sbTeam.EPA.Breakdown.TeleopPoints,
		"epa_endgame": sbTeam.EPA.Breakdown.EndgamePoints,
		"epa_rp":      (sbTeam.EPA.Breakdown.MelodyRP + sbTeam.EPA.Breakdown.EnsembleRP) / 2,
		"wins":        sbTeam.Record.Wins,
		"losses":      sbTeam.Record.Losses,
		"ties":        sbTeam.Record.Ties,
		"winrate":     sbTeam.Record.Winrate,
	}
	epa.Payload = payload

	return s.storeTeamEPA(epa)
}

func (s *SyncService) SyncEvent(eventKey string) error {
	log.Printf("Starting event sync for %s", eventKey)

	log.Printf("[TBA] Fetching event details for %s", eventKey)
	s.tbaLimiter.Wait()
	code, body, _, err := TBAGet("/event/"+eventKey, s.tbaAPIKey)
	if err != nil {
		return fmt.Errorf("[TBA] Event request failed: %w", err)
	}
	if code != 200 {
		return fmt.Errorf("[TBA] Event request returned %d", code)
	}

	var tbaEvent models.TBAEvent
	if err := json.Unmarshal(body, &tbaEvent); err != nil {
		return fmt.Errorf("failed to parse TBA event: %w", err)
	}

	event := models.Event{
		EventKey:  tbaEvent.Key,
		Year:      tbaEvent.Year,
		Name:      tbaEvent.Name,
		City:      tbaEvent.City,
		State:     tbaEvent.StateProv,
		Country:   tbaEvent.Country,
		StartDate: tbaEvent.StartDate,
		EndDate:   tbaEvent.EndDate,
	}

	if err := s.storeEvent(event); err != nil {
		return fmt.Errorf("failed to store event: %w", err)
	}

	return s.syncEventMatches(eventKey)
}

func (s *SyncService) syncEventMatches(eventKey string) error {
	log.Printf("[TBA] Fetching matches for event %s", eventKey)
	s.tbaLimiter.Wait()
	code, body, _, err := TBAGet("/event/"+eventKey+"/matches", s.tbaAPIKey)
	if err != nil {
		return fmt.Errorf("[TBA] Matches request failed: %w", err)
	}
	if code != 200 {
		return fmt.Errorf("[TBA] Matches request returned %d", code)
	}

	var tbaMatches []models.TBAMatch
	if err := json.Unmarshal(body, &tbaMatches); err != nil {
		return fmt.Errorf("failed to parse TBA matches: %w", err)
	}

	for _, tbaMatch := range tbaMatches {
		match := models.Match{
			MatchKey:    tbaMatch.Key,
			EventKey:    tbaMatch.EventKey,
			CompLevel:   tbaMatch.CompLevel,
			SetNumber:   tbaMatch.SetNumber,
			MatchNumber: tbaMatch.MatchNumber,
			BlueTeams:   tbaMatch.Alliances.Blue.TeamKeys,
			RedTeams:    tbaMatch.Alliances.Red.TeamKeys,
			BlueScore:   tbaMatch.Alliances.Blue.Score,
			RedScore:    tbaMatch.Alliances.Red.Score,
		}

		if tbaMatch.Time > 0 {
			match.TimeReal = time.Unix(tbaMatch.Time, 0)
		}
		if tbaMatch.PredictedTime > 0 {
			match.TimePred = time.Unix(tbaMatch.PredictedTime, 0)
		}

		if err := s.storeMatch(match); err != nil {
			log.Printf("Failed to store match %s: %v", match.MatchKey, err)
		}
	}

	log.Printf("[TBA] Synced %d matches for event %s", len(tbaMatches), eventKey)
	return nil
}

func (s *SyncService) storeTeam(team models.Team) error {
	_, err := s.db.Exec(`
		INSERT OR REPLACE INTO teams 
		(team_key, team_num, name, city, state, country, rookie_year, last_synced)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, team.TeamKey, team.TeamNum, team.Name, team.City, team.State,
		team.Country, team.RookieYear, team.LastSynced.Unix())
	return err
}

func (s *SyncService) storeEvent(event models.Event) error {
	_, err := s.db.Exec(`
		INSERT OR REPLACE INTO events 
		(event_key, year, name, city, state, country, start_date, end_date)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, event.EventKey, event.Year, event.Name, event.City, event.State,
		event.Country, event.StartDate, event.EndDate)
	return err
}

func (s *SyncService) storeMatch(match models.Match) error {
	blueTeamsJSON, _ := json.Marshal(match.BlueTeams)
	redTeamsJSON, _ := json.Marshal(match.RedTeams)

	_, err := s.db.Exec(`
		INSERT OR REPLACE INTO matches 
		(match_key, event_key, comp_level, set_number, match_number, 
		 time_real, time_pred, blue_teams, red_teams, blue_score, red_score)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, match.MatchKey, match.EventKey, match.CompLevel, match.SetNumber,
		match.MatchNumber, match.TimeReal.Unix(), match.TimePred.Unix(),
		string(blueTeamsJSON), string(redTeamsJSON), match.BlueScore, match.RedScore)
	return err
}

func (s *SyncService) storeTeamEPA(epa models.TeamYearEPA) error {
	payloadJSON, _ := json.Marshal(epa.Payload)

	_, err := s.db.Exec(`
		INSERT OR REPLACE INTO epa_team_year 
		(team_num, year, payload)
		VALUES (?, ?, ?)
	`, epa.TeamNum, epa.Year, string(payloadJSON))
	return err
}

func (s *SyncService) GetCurrentEvents() ([]string, error) {
	currentYear := time.Now().Year()
	s.tbaLimiter.Wait()
	code, body, _, err := TBAGet(fmt.Sprintf("/events/%d/simple", currentYear), s.tbaAPIKey)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("TBA events request returned %d", code)
	}

	var events []models.TBAEvent
	if err := json.Unmarshal(body, &events); err != nil {
		return nil, err
	}

	var eventKeys []string
	now := time.Now()
	for _, event := range events {
		startDate, err := time.Parse("2006-01-02", event.StartDate)
		if err != nil {
			continue
		}
		endDate, err := time.Parse("2006-01-02", event.EndDate)
		if err != nil {
			continue
		}

		if startDate.Before(now.AddDate(0, 0, 30)) && endDate.After(now.AddDate(0, 0, -7)) {
			eventKeys = append(eventKeys, event.Key)
		}
	}

	return eventKeys, nil
}

func (s *SyncService) GetConfiguredTBAKeys() []string {
	if s.eventsConfig == nil {
		return []string{}
	}
	return s.eventsConfig.TBAKeys
}

func (s *SyncService) FullSync() error {
	if err := s.SyncTeams(s.currentYear); err != nil {
		log.Printf("Failed to sync teams: %v", err)
	}

	if s.eventsConfig != nil && s.eventsConfig.SyncSettings.EnableEPASync {
		log.Printf("Starting EPA sync for existing teams...")
		if err := s.SyncEPAForExistingTeams(2024); err != nil {
			log.Printf("Failed to sync EPA data: %v", err)
		} else {
			log.Printf("EPA sync completed successfully")
		}
	}

	var eventKeys []string
	if s.eventsConfig != nil {
		eventKeys = s.eventsConfig.TBAKeys
		log.Printf("Syncing %d configured events", len(eventKeys))
	} else {
		log.Printf("No events configuration loaded, skipping event sync")
		return nil
	}

	for _, eventKey := range eventKeys {
		if err := s.SyncEvent(eventKey); err != nil {
			log.Printf("Failed to sync event %s: %v", eventKey, err)
		}
		time.Sleep(1 * time.Second)
	}

	log.Printf("Full sync completed for %d configured events", len(eventKeys))
	return nil
}
