package ingest

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

const tbaBase = "https://www.thebluealliance.com/api/v3" // X-TBA-Auth-Key required

func TBAGet(path string, etag string) (status int, body []byte, newEtag string, err error) {
	req, _ := http.NewRequest("GET", tbaBase+path, nil)
	req.Header.Set("X-TBA-Auth-Key", os.Getenv("TBA_KEY"))        // per docs
	req.Header.Set("User-Agent", "frc-hub/0.1 (+github.com/you)") // some clients need UA
	if etag != "" {
		req.Header.Set("If-None-Match", etag)
	} // use ETag for caching (304)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, nil, "", err
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return res.StatusCode, b, res.Header.Get("ETag"), nil
}

func ExampleGetEventMatches(eventKey string) ([]map[string]any, error) {
	code, b, _, err := TBAGet("/event/"+eventKey+"/matches", "")
	if err != nil || code != 200 {
		return nil, fmt.Errorf("tba %d %v", code, err)
	}
	var out []map[string]any
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	return out, nil
}
