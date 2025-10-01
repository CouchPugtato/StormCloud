package models

import "time"

type Team struct {
	TeamKey     string    `json:"team_key"`
	TeamNum     int       `json:"team_num"`
	Name        string    `json:"name"`
	City        string    `json:"city"`
	State       string    `json:"state"`
	Country     string    `json:"country"`
	RookieYear  int       `json:"rookie_year"`
	LastSynced  time.Time `json:"last_synced"`
}

type Event struct {
	EventKey  string `json:"event_key"`
	Year      int    `json:"year"`
	Name      string `json:"name"`
	City      string `json:"city"`
	State     string `json:"state"`
	Country   string `json:"country"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
}

type Match struct {
	MatchKey    string    `json:"match_key"`
	EventKey    string    `json:"event_key"`
	CompLevel   string    `json:"comp_level"`
	SetNumber   int       `json:"set_number"`
	MatchNumber int       `json:"match_number"`
	TimeReal    time.Time `json:"time_real"`
	TimePred    time.Time `json:"time_pred"`
	BlueTeams   []string  `json:"blue_teams"`
	RedTeams    []string  `json:"red_teams"`
	BlueScore   int       `json:"blue_score"`
	RedScore    int       `json:"red_score"`
}

type TeamYearEPA struct {
	TeamNum int                    `json:"team_num"`
	Year    int                    `json:"year"`
	EPA     float64                `json:"epa"`
	AutoEPA float64                `json:"auto_epa"`
	TeleEPA float64                `json:"tele_epa"`
	EndEPA  float64                `json:"end_epa"`
	RPEPA   float64                `json:"rp_epa"`
	Payload map[string]interface{} `json:"payload"`
}

type Note struct {
	ID       int       `json:"id"`
	MatchKey string    `json:"match_key"`
	TeamKey  string    `json:"team_key"`
	Author   string    `json:"author"`
	Note     string    `json:"note"`
	Created  time.Time `json:"created_at"`
}

type TBATeam struct {
	Key        string `json:"key"`
	TeamNumber int    `json:"team_number"`
	Nickname   string `json:"nickname"`
	Name       string `json:"name"`
	City       string `json:"city"`
	StateProv  string `json:"state_prov"`
	Country    string `json:"country"`
	RookieYear int    `json:"rookie_year"`
}

type TBAMatch struct {
	Key       string `json:"key"`
	CompLevel string `json:"comp_level"`
	SetNumber int    `json:"set_number"`
	MatchNumber int  `json:"match_number"`
	Alliances struct {
		Blue struct {
			TeamKeys []string `json:"team_keys"`
			Score    int      `json:"score"`
		} `json:"blue"`
		Red struct {
			TeamKeys []string `json:"team_keys"`
			Score    int      `json:"score"`
		} `json:"red"`
	} `json:"alliances"`
	Time         int64  `json:"time"`
	PredictedTime int64 `json:"predicted_time"`
	EventKey     string `json:"event_key"`
}

type TBAEvent struct {
	Key       string `json:"key"`
	Name      string `json:"name"`
	EventCode string `json:"event_code"`
	EventType int    `json:"event_type"`
	Year      int    `json:"year"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
	City      string `json:"city"`
	StateProv string `json:"state_prov"`
	Country   string `json:"country"`
}

type SBTeamYear struct {
	Team     int     `json:"team"`
	Year     int     `json:"year"`
	EPA      struct {
		TotalPoints struct {
			Mean float64 `json:"mean"`
		} `json:"total_points"`
		Breakdown struct {
			AutoPoints    float64 `json:"auto_points"`
			TeleopPoints  float64 `json:"teleop_points"`
			EndgamePoints float64 `json:"endgame_points"`
			MelodyRP      float64 `json:"melody_rp"`
			EnsembleRP    float64 `json:"ensemble_rp"`
		} `json:"breakdown"`
	} `json:"epa"`
	Record   struct {
		Wins    int     `json:"wins"`
		Losses  int     `json:"losses"`
		Ties    int     `json:"ties"`
		Winrate float64 `json:"winrate"`
	} `json:"record"`
}
