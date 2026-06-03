package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type sidecarRuntime struct {
	Sidecar    bool `json:"sidecar"`
	TUIMode    bool `json:"tuiMode"`
	Standalone bool `json:"standalone"`
	LocalModel bool `json:"localModel"`
}

type serverStatus struct {
	Status    string         `json:"status"`
	Service   string         `json:"service"`
	PID       int            `json:"pid"`
	BaseURL   string         `json:"baseURL"`
	HealthURL string         `json:"healthURL"`
	StatusURL string         `json:"statusURL"`
	Runtime   sidecarRuntime `json:"runtime"`
}

type controller struct {
	client *http.Client
}

func newController(client *http.Client) *controller {
	if client == nil {
		client = &http.Client{Timeout: 2 * time.Second}
	}
	return &controller{client: client}
}

func readServerStatus(path string) (serverStatus, error) {
	data, errRead := os.ReadFile(path)
	if errRead != nil {
		return serverStatus{}, fmt.Errorf("read sidecar status file: %w", errRead)
	}
	var status serverStatus
	if errDecode := json.Unmarshal(data, &status); errDecode != nil {
		return serverStatus{}, fmt.Errorf("decode sidecar status file: %w", errDecode)
	}
	if status.HealthURL == "" {
		return serverStatus{}, fmt.Errorf("sidecar status file missing healthURL")
	}
	return status, nil
}

func (c *controller) checkHealth(ctx context.Context, status serverStatus) error {
	req, errNewRequest := http.NewRequestWithContext(ctx, http.MethodHead, status.HealthURL, nil)
	if errNewRequest != nil {
		return fmt.Errorf("create health request: %w", errNewRequest)
	}
	resp, errDo := c.client.Do(req)
	if errDo != nil {
		return fmt.Errorf("call sidecar health endpoint: %w", errDo)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("sidecar health returned HTTP %d", resp.StatusCode)
	}
	return nil
}
