package api

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type webPushSubscribeIn struct {
	UserID   string `json:"user_id"`
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256DH string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
	Platform string `json:"platform"`
}

type webPushUnsubscribeIn struct {
	UserID   string `json:"user_id"`
	Endpoint string `json:"endpoint"`
}

type pushTestIn struct {
	UserID string `json:"user_id"`
	Title  string `json:"title"`
	Body   string `json:"body"`
	URL    string `json:"url"`
}

func PushPublicKey() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		publicKey := strings.TrimSpace(os.Getenv("VAPID_PUBLIC_KEY"))
		if publicKey == "" {
			writeJSON(w, 500, map[string]string{"error": "VAPID_PUBLIC_KEY not configured"})
			return
		}
		writeJSON(w, 200, map[string]string{"public_key": publicKey})
	}
}

func WebPushSubscribe(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in webPushSubscribeIn
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		in.UserID = strings.TrimSpace(in.UserID)
		in.Endpoint = strings.TrimSpace(in.Endpoint)
		in.Platform = strings.TrimSpace(in.Platform)
		if in.UserID == "" {
			in.UserID = "anonymous"
		}
		if in.Platform == "" {
			in.Platform = "web"
		}
		if in.Endpoint == "" {
			writeJSON(w, 400, map[string]string{"error": "endpoint required"})
			return
		}
		if !strings.HasPrefix(in.Endpoint, "https://") {
			writeJSON(w, 400, map[string]string{"error": "endpoint must be https"})
			return
		}

		_, err := db.Exec(`
			INSERT INTO web_push_subscriptions(user_id, endpoint, p256dh, auth, platform, created_at)
			VALUES(?,?,?,?,?,?)
			ON CONFLICT(endpoint) DO UPDATE SET
				user_id=excluded.user_id,
				p256dh=excluded.p256dh,
				auth=excluded.auth,
				platform=excluded.platform,
				created_at=excluded.created_at
		`, in.UserID, in.Endpoint, in.Keys.P256DH, in.Keys.Auth, in.Platform, time.Now().Unix())
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, 200, map[string]any{"ok": true})
	}
}

func WebPushUnsubscribe(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in webPushUnsubscribeIn
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		in.Endpoint = strings.TrimSpace(in.Endpoint)
		if in.Endpoint == "" {
			writeJSON(w, 400, map[string]string{"error": "endpoint required"})
			return
		}

		if strings.TrimSpace(in.UserID) == "" {
			if _, err := db.Exec(`DELETE FROM web_push_subscriptions WHERE endpoint=?`, in.Endpoint); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
		} else {
			if _, err := db.Exec(`DELETE FROM web_push_subscriptions WHERE endpoint=? AND user_id=?`, in.Endpoint, strings.TrimSpace(in.UserID)); err != nil {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
				return
			}
		}

		writeJSON(w, 200, map[string]any{"ok": true})
	}
}

func PushTest(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in pushTestIn
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, 400, map[string]string{"error": "bad json"})
			return
		}

		userID := strings.TrimSpace(in.UserID)
		if userID == "" {
			userID = "anonymous"
		}
		title := strings.TrimSpace(in.Title)
		body := strings.TrimSpace(in.Body)
		if title == "" {
			title = "StormCloud"
		}
		if body == "" {
			body = "Test notification from StormCloud"
		}
		targetURL := strings.TrimSpace(in.URL)

		webCount, webErr := sendWebPushToUser(db, userID)
		expoCount, expoErr := sendExpoPushToUser(db, userID, title, body, targetURL)

		writeJSON(w, 200, map[string]any{
			"ok":           webErr == nil && expoErr == nil,
			"user_id":      userID,
			"web_sent":     webCount,
			"expo_sent":    expoCount,
			"web_error":    errText(webErr),
			"expo_error":   errText(expoErr),
			"title":        title,
			"body":         body,
			"target_url":   targetURL,
			"sent_at_unix": time.Now().Unix(),
		})
	}
}

func errText(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func sendWebPushToUser(db *sql.DB, userID string) (int, error) {
	publicKey := strings.TrimSpace(os.Getenv("VAPID_PUBLIC_KEY"))
	privateKey := strings.TrimSpace(os.Getenv("VAPID_PRIVATE_KEY"))
	subject := strings.TrimSpace(os.Getenv("VAPID_SUBJECT"))
	if subject == "" {
		subject = "mailto:stormcloud@example.com"
	}

	if publicKey == "" || privateKey == "" {
		return 0, errors.New("VAPID keys are not configured")
	}

	rows, err := db.Query(`SELECT endpoint FROM web_push_subscriptions WHERE user_id=?`, userID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var endpoints []string
	for rows.Next() {
		var endpoint string
		if err := rows.Scan(&endpoint); err != nil {
			return 0, err
		}
		endpoints = append(endpoints, endpoint)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	sent := 0

	for _, endpoint := range endpoints {
		aud, err := endpointAudience(endpoint)
		if err != nil {
			continue
		}
		jwt, err := buildVAPIDJWT(privateKey, aud, subject)
		if err != nil {
			return sent, err
		}

		req, err := http.NewRequest(http.MethodPost, endpoint, http.NoBody)
		if err != nil {
			continue
		}
		req.Header.Set("TTL", "60")
		req.Header.Set("Urgency", "normal")
		req.Header.Set("Authorization", fmt.Sprintf("vapid t=%s, k=%s", jwt, publicKey))

		resp, err := client.Do(req)
		if err != nil {
			continue
		}
		_ = resp.Body.Close()

		if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone {
			_, _ = db.Exec(`DELETE FROM web_push_subscriptions WHERE endpoint=?`, endpoint)
			continue
		}
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			sent++
		}
	}

	return sent, nil
}

func endpointAudience(endpoint string) (string, error) {
	u, err := url.Parse(endpoint)
	if err != nil {
		return "", err
	}
	return u.Scheme + "://" + u.Host, nil
}

func buildVAPIDJWT(privateKeyB64, aud, sub string) (string, error) {
	header := map[string]any{
		"typ": "JWT",
		"alg": "ES256",
	}
	claims := map[string]any{
		"aud": aud,
		"exp": time.Now().Add(12 * time.Hour).Unix(),
		"sub": sub,
	}

	headerJSON, _ := json.Marshal(header)
	claimsJSON, _ := json.Marshal(claims)
	headerPart := base64.RawURLEncoding.EncodeToString(headerJSON)
	claimsPart := base64.RawURLEncoding.EncodeToString(claimsJSON)
	signingInput := headerPart + "." + claimsPart

	privateKey, err := parseVAPIDPrivateKey(privateKeyB64)
	if err != nil {
		return "", err
	}

	hash := sha256.Sum256([]byte(signingInput))
	r, s, err := ecdsa.Sign(rand.Reader, privateKey, hash[:])
	if err != nil {
		return "", err
	}

	sig := make([]byte, 64)
	r.FillBytes(sig[:32])
	s.FillBytes(sig[32:])
	sigPart := base64.RawURLEncoding.EncodeToString(sig)
	return signingInput + "." + sigPart, nil
}

func parseVAPIDPrivateKey(v string) (*ecdsa.PrivateKey, error) {
	raw, err := base64.RawURLEncoding.DecodeString(v)
	if err != nil {
		return nil, err
	}
	if len(raw) != 32 {
		return nil, fmt.Errorf("invalid private key length: %d", len(raw))
	}

	curve := elliptic.P256()
	d := new(big.Int).SetBytes(raw)
	x, y := curve.ScalarBaseMult(raw)
	if x == nil || y == nil {
		return nil, errors.New("failed to derive public key from private key")
	}

	return &ecdsa.PrivateKey{
		PublicKey: ecdsa.PublicKey{Curve: curve, X: x, Y: y},
		D:         d,
	}, nil
}

func sendExpoPushToUser(db *sql.DB, userID, title, body, targetURL string) (int, error) {
	rows, err := db.Query(`SELECT token FROM device_tokens WHERE user_id=? AND platform IN ('ios','android')`, userID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type msg struct {
		To    string `json:"to"`
		Title string `json:"title"`
		Body  string `json:"body"`
		Data  any    `json:"data,omitempty"`
		Sound string `json:"sound,omitempty"`
	}

	var messages []msg
	for rows.Next() {
		var token string
		if err := rows.Scan(&token); err != nil {
			return 0, err
		}
		token = strings.TrimSpace(token)
		if !strings.HasPrefix(token, "ExponentPushToken[") && !strings.HasPrefix(token, "ExpoPushToken[") {
			continue
		}
		messages = append(messages, msg{
			To:    token,
			Title: title,
			Body:  body,
			Data: map[string]string{
				"url": targetURL,
			},
			Sound: "default",
		})
	}

	if len(messages) == 0 {
		return 0, nil
	}

	payload, _ := json.Marshal(messages)
	req, err := http.NewRequest(http.MethodPost, "https://exp.host/--/api/v2/push/send", bytes.NewReader(payload))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return 0, fmt.Errorf("expo push send failed with status %d", resp.StatusCode)
	}
	return len(messages), nil
}
