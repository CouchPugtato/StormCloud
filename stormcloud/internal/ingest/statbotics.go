package ingest

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const sbBase = "https://api.statbotics.io/v3"

func SBGet(path string) (int, []byte, error) {
	res, err := http.Get(sbBase + path)
	if err != nil {
		return 0, nil, err
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return res.StatusCode, b, nil
}

func ExampleTeamYearEPA(team int, year int) (map[string]any, error) {
	code, b, err := SBGet(fmt.Sprintf("/team_year/%d/%d", team, year))
	if err != nil || code != 200 {
		return nil, fmt.Errorf("statbotics %d %v", code, err)
	}
	var out map[string]any
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	return out, nil
}
