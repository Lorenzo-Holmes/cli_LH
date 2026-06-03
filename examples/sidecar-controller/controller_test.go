package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestReadServerStatus(t *testing.T) {
	path := filepath.Join(t.TempDir(), "server.json")
	body := `{
  "status": "ready",
  "service": "CLIProxyAPI",
  "pid": 1234,
  "baseURL": "http://127.0.0.1:8317",
  "healthURL": "http://127.0.0.1:8317/healthz",
  "statusURL": "http://127.0.0.1:8317/statusz",
  "runtime": {"sidecar": true, "localModel": true}
}`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	status, err := readServerStatus(path)
	if err != nil {
		t.Fatalf("readServerStatus() error = %v", err)
	}
	if status.Service != "CLIProxyAPI" {
		t.Fatalf("service = %q, want CLIProxyAPI", status.Service)
	}
	if !status.Runtime.Sidecar || !status.Runtime.LocalModel {
		t.Fatalf("runtime = %+v", status.Runtime)
	}
}

func TestReadServerStatusRequiresHealthURL(t *testing.T) {
	path := filepath.Join(t.TempDir(), "server.json")
	if err := os.WriteFile(path, []byte(`{"service":"CLIProxyAPI"}`), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
	if _, err := readServerStatus(path); err == nil {
		t.Fatalf("readServerStatus() expected error")
	}
}

func TestControllerCheckHealth(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodHead {
			t.Fatalf("method = %s, want HEAD", r.Method)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	status := serverStatus{HealthURL: server.URL + "/healthz"}
	if err := newController(server.Client()).checkHealth(context.Background(), status); err != nil {
		t.Fatalf("checkHealth() error = %v", err)
	}
}
