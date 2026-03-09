package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const clerkAPIBase = "https://api.clerk.com/v1"

func clerkSecretKey() (string, error) {
	secret := strings.TrimSpace(os.Getenv("CLERK_SECRET_KEY"))
	if secret == "" {
		return "", fmt.Errorf("missing CLERK_SECRET_KEY")
	}
	return secret, nil
}

func callClerk(method, path string, body []byte) (*http.Response, error) {
	secret, err := clerkSecretKey()
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s%s", clerkAPIBase, path)
	req, err := http.NewRequest(method, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+secret)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	return client.Do(req)
}

func getJSONMap(v any) map[string]any {
	if v == nil {
		return map[string]any{}
	}
	if m, ok := v.(map[string]any); ok {
		return m
	}
	return map[string]any{}
}

func extractClerkRole(user map[string]any) string {
	publicMetadata := getJSONMap(user["public_metadata"])
	roleRaw, _ := publicMetadata["role"].(string)
	role := strings.TrimSpace(roleRaw)
	switch role {
	case "viewer", "scouter", "scouting_lead", "drive_team":
		return role
	default:
		return "viewer"
	}
}

func isAdminRole(role string) bool {
	return role == "scouting_lead"
}

func ClerkUsersList() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resp, err := callClerk(http.MethodGet, "/users?limit=500", nil)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			writeJSON(w, resp.StatusCode, map[string]any{"error": "failed to fetch users from Clerk"})
			return
		}

		var parsed []map[string]any
		if err := json.Unmarshal(body, &parsed); err != nil {
			writeJSON(w, 500, map[string]string{"error": "invalid Clerk response"})
			return
		}

		type userOut struct {
			ID        string `json:"id"`
			Email     string `json:"email"`
			Name      string `json:"name"`
			Role      string `json:"role"`
			CreatedAt int64  `json:"created_at"`
		}
		out := make([]userOut, 0, len(parsed))
		for _, user := range parsed {
			id, _ := user["id"].(string)
			createdAtFloat, _ := user["created_at"].(float64)
			role := extractClerkRole(user)

			email := ""
			if emails, ok := user["email_addresses"].([]any); ok && len(emails) > 0 {
				if first, ok := emails[0].(map[string]any); ok {
					email, _ = first["email_address"].(string)
				}
			}

			firstName, _ := user["first_name"].(string)
			lastName, _ := user["last_name"].(string)
			name := strings.TrimSpace(strings.TrimSpace(firstName + " " + lastName))
			if name == "" && email != "" {
				name = email
			}

			out = append(out, userOut{
				ID:        id,
				Email:     email,
				Name:      name,
				Role:      role,
				CreatedAt: int64(createdAtFloat),
			})
		}

		writeJSON(w, 200, out)
	}
}

func ClerkUserRoleUpdate() http.HandlerFunc {
	type in struct {
		RequesterID  string `json:"requester_id"`
		TargetUserID string `json:"target_user_id"`
		TargetRole   string `json:"target_role"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		var payload in
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		payload.RequesterID = strings.TrimSpace(payload.RequesterID)
		payload.TargetUserID = strings.TrimSpace(payload.TargetUserID)
		payload.TargetRole = strings.TrimSpace(payload.TargetRole)

		if payload.RequesterID == "" || payload.TargetUserID == "" || payload.TargetRole == "" {
			writeJSON(w, 400, map[string]string{"error": "requester_id, target_user_id, and target_role are required"})
			return
		}
		switch payload.TargetRole {
		case "viewer", "scouter", "scouting_lead", "drive_team":
		default:
			writeJSON(w, 400, map[string]string{"error": "invalid target_role"})
			return
		}

		requesterResp, err := callClerk(http.MethodGet, "/users/"+payload.RequesterID, nil)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer requesterResp.Body.Close()
		requesterBody, _ := io.ReadAll(requesterResp.Body)
		if requesterResp.StatusCode < 200 || requesterResp.StatusCode >= 300 {
			writeJSON(w, requesterResp.StatusCode, map[string]string{"error": "unable to validate requester"})
			return
		}
		var requester map[string]any
		if err := json.Unmarshal(requesterBody, &requester); err != nil {
			writeJSON(w, 500, map[string]string{"error": "invalid requester response"})
			return
		}
		requesterRole := extractClerkRole(requester)
		if !isAdminRole(requesterRole) {
			writeJSON(w, 403, map[string]string{"error": "only scouting leads can change roles"})
			return
		}

		targetResp, err := callClerk(http.MethodGet, "/users/"+payload.TargetUserID, nil)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer targetResp.Body.Close()
		targetBody, _ := io.ReadAll(targetResp.Body)
		if targetResp.StatusCode < 200 || targetResp.StatusCode >= 300 {
			writeJSON(w, targetResp.StatusCode, map[string]string{"error": "unable to fetch target user"})
			return
		}
		var targetUser map[string]any
		if err := json.Unmarshal(targetBody, &targetUser); err != nil {
			writeJSON(w, 500, map[string]string{"error": "invalid target user response"})
			return
		}

		publicMetadata := getJSONMap(targetUser["public_metadata"])
		publicMetadata["role"] = payload.TargetRole
		updateBody, _ := json.Marshal(map[string]any{
			"public_metadata": publicMetadata,
		})
		updateResp, err := callClerk(http.MethodPatch, "/users/"+payload.TargetUserID, updateBody)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer updateResp.Body.Close()
		if updateResp.StatusCode < 200 || updateResp.StatusCode >= 300 {
			body, _ := io.ReadAll(updateResp.Body)
			writeJSON(w, updateResp.StatusCode, map[string]any{
				"error":  "failed to update user role",
				"detail": string(body),
			})
			return
		}

		writeJSON(w, 200, map[string]any{
			"ok":          true,
			"target_user": payload.TargetUserID,
			"target_role": payload.TargetRole,
		})
	}
}
