package jobs

import (
	"log"

	"github.com/robfig/cron/v3"
)

type SyncJob func()

func Start(spec string, j SyncJob) func() {
	c := cron.New()
	_, err := c.AddFunc(spec, func() {
		defer func() {
			if r := recover(); r != nil {
				log.Println("sync panic:", r)
			}
		}()
		j()
	})
	if err != nil {
		log.Println("cron add:", err)
	}
	c.Start()
	return func() { c.Stop() }
}
