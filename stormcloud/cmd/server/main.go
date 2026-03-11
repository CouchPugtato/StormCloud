package main

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"

	"github.com/CouchPugtato/StormCloud/internal/api"
	"github.com/CouchPugtato/StormCloud/internal/db"
	"github.com/CouchPugtato/StormCloud/internal/ingest"
	"github.com/CouchPugtato/StormCloud/internal/jobs"
	"github.com/CouchPugtato/StormCloud/internal/realtime"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	appEnv := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if appEnv == "" {
		appEnv = "development"
	}

	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "./app.db"
	}

	database, err := db.Open(dbPath)
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}
	defer database.Close()

	if err := db.Migrate(database); err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	tbaKey := os.Getenv("TBA_KEY")
	statboticsKey := os.Getenv("TBA_KEY")
	currentYear := 2026
	if yearStr := os.Getenv("CURRENT_YEAR"); yearStr != "" {
		if year, err := strconv.Atoi(yearStr); err == nil {
			currentYear = year
		}
	}
	var storedSeasonYear string
	if err := database.QueryRow(`SELECT value FROM app_settings WHERE key=?`, "season_year").Scan(&storedSeasonYear); err == nil {
		if year, convErr := strconv.Atoi(strings.TrimSpace(storedSeasonYear)); convErr == nil && year > 0 {
			currentYear = year
		}
	}

	syncService := ingest.NewSyncService(database)
	syncService.SetAPIKeys(tbaKey, statboticsKey)
	syncService.SetCurrentYear(currentYear)

	log.Println("Running initial sync on startup...")
	if err := syncService.FullSync(); err != nil {
		log.Printf("Initial sync failed: %v", err)
	} else {
		log.Println("Initial sync completed successfully")
	}

	normalCronSpec := os.Getenv("SYNC_CRON")
	if normalCronSpec == "" {
		normalCronSpec = "0 */2 * * *"
	}

	eventCronSpec := os.Getenv("EVENT_SYNC_CRON")
	if eventCronSpec == "" {
		eventCronSpec = "*/3 * * * *"
	}

	scheduler := jobs.NewScheduler(normalCronSpec, eventCronSpec, func() error {
		log.Println("Starting sync job...")
		if err := syncService.FullSync(); err != nil {
			log.Printf("Sync job failed: %v", err)
			return err
		}
		log.Println("Sync job completed successfully")
		return nil
	})
	scheduler.Start()
	defer scheduler.Stop()

	hub := realtime.NewHub()

	router := api.Router(database, hub, syncService, scheduler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Allow binding to a specific address (e.g., 127.0.0.1:8090) via env var.
	// If BIND_ADDR is not set, use localhost in development and all interfaces in production.
	bindAddr := strings.TrimSpace(os.Getenv("BIND_ADDR"))
	if bindAddr == "" {
		if appEnv == "production" {
			bindAddr = ":" + port
		} else {
			bindAddr = "127.0.0.1:" + port
		}
	}

	log.Printf("APP_ENV=%s, server starting on %s", appEnv, bindAddr)
	log.Fatal(http.ListenAndServe(bindAddr, router))
}
