package models

type Team struct {
	TeamKey    string `json:"team_key"`
	TeamNum    int    `json:"team_num"`
	Name       string `json:"name"`
	City       string `json:"city"`
	State      string `json:"state"`
	Country    string `json:"country"`
	RookieYear int    `json:"rookie_year"`
}

type Note struct {
	ID       int    `json:"id"`
	MatchKey string `json:"match_key"`
	TeamKey  string `json:"team_key"`
	Author   string `json:"author"`
	Note     string `json:"note"`
	Created  int64  `json:"created_at"`
}
