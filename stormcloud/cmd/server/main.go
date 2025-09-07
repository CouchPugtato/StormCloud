package main

import (
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"

	"github.com/CouchPugtato/StormCloud/internal/api"
	"github.com/CouchPugtato/StormCloud/internal/jobs"
	"github.com/CouchPugtato/StormCloud/internal/realtime"
)

func main() {
	_ = godotenv.Load() // load .env if present

	databasePath := os.Getenv("database_PATH")
	if databasePath == "" {
		databasePath = "./app.database"
	}

	sqldatabase, err := database.Open(databasePath)
	if err != nil {
		log.Fatal("open database:", err)
	}
	if err := database.Migrate(sqldatabase); err != nil {
		log.Fatal("migrate:", err)
	}

	// start a periodic sync job (stub)
	spec := os.Getenv("SYNC_CRON")
	if spec == "" {
		spec = "*/10 * * * *"
	} // every 10 min
	stopCron := jobs.Start(spec, func() {
		log.Println("sync tick ... (call TBA/Statbotics here)")
	})
	defer stopCron()

	hub := realtime.NewHub()
	r := api.Router(sqldatabase, hub)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Println("listening on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
