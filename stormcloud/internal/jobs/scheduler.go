package jobs

import (
	"log"
	"sync"

	"github.com/robfig/cron/v3"
)

type SyncJob func() error

type Scheduler struct {
	cron         *cron.Cron
	job          SyncJob
	currentSpec  string
	normalSpec   string
	eventSpec    string
	isEventMode  bool
	mu           sync.RWMutex
}

func NewScheduler(normalSpec, eventSpec string, job SyncJob) *Scheduler {
	return &Scheduler{
		cron:        cron.New(),
		job:         job,
		normalSpec:  normalSpec,
		eventSpec:   eventSpec,
		currentSpec: normalSpec,
		isEventMode: false,
	}
}

func (s *Scheduler) Start() {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	s.addJob()
	s.cron.Start()
}

func (s *Scheduler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	s.cron.Stop()
}

func (s *Scheduler) SetEventMode(enabled bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if s.isEventMode == enabled {
		return // No change needed
	}
	
	s.isEventMode = enabled
	newSpec := s.normalSpec
	if enabled {
		newSpec = s.eventSpec
	}
	
	if newSpec != s.currentSpec {
		log.Printf("Switching sync schedule from %s to %s (Event Mode: %v)", s.currentSpec, newSpec, enabled)
		s.currentSpec = newSpec
		
		s.cron.Stop()
		s.cron = cron.New()
		s.addJob()
		s.cron.Start()
	}
}

func (s *Scheduler) IsEventMode() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.isEventMode
}

func (s *Scheduler) addJob() {
	_, err := s.cron.AddFunc(s.currentSpec, func() {
		defer func() {
			if r := recover(); r != nil {
				log.Println("sync panic:", r)
			}
		}()
		if err := s.job(); err != nil {
			log.Printf("sync job error: %v", err)
		}
	})
	if err != nil {
		log.Printf("cron add error: %v", err)
	}
}

func Start(spec string, j SyncJob) func() {
	scheduler := NewScheduler(spec, spec, j)
	scheduler.Start()
	return scheduler.Stop
}
