package cmd

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/router-for-me/CLIProxyAPI/v7/internal/config"
	"github.com/router-for-me/CLIProxyAPI/v7/sdk/cliproxy"
)

func TestWriteSidecarStatusFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "server.json")
	cfg := &config.Config{Host: "127.0.0.1", Port: 8317, AuthDir: filepath.Join(dir, "auths")}

	err := writeSidecarStatusFile(path, cfg, filepath.Join(dir, "config.yaml"), cliproxy.SidecarRuntimeInfo{
		Sidecar:    true,
		LocalModel: true,
	})
	if err != nil {
		t.Fatalf("writeSidecarStatusFile() error = %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}
	var resp sidecarStatusFile
	if err := json.Unmarshal(data, &resp); err != nil {
		t.Fatalf("json decode error = %v; body=%s", err, data)
	}
	if resp.Service != "CLIProxyAPI" {
		t.Fatalf("service = %q, want CLIProxyAPI", resp.Service)
	}
	if resp.BaseURL != "http://127.0.0.1:8317" {
		t.Fatalf("baseURL = %q, want http://127.0.0.1:8317", resp.BaseURL)
	}
	if resp.HealthURL != "http://127.0.0.1:8317/healthz" {
		t.Fatalf("healthURL = %q", resp.HealthURL)
	}
	if resp.StatusURL != "http://127.0.0.1:8317/statusz" {
		t.Fatalf("statusURL = %q", resp.StatusURL)
	}
	if !resp.Runtime.Sidecar || !resp.Runtime.LocalModel {
		t.Fatalf("runtime not written: %+v", resp.Runtime)
	}
}

func TestWriteSidecarStatusFileOmitsSecrets(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "server.json")
	cfg := &config.Config{Host: "127.0.0.1", Port: 8317, AuthDir: filepath.Join(dir, "auths")}
	cfg.RemoteManagement.SecretKey = "management-secret-value"
	cfg.APIKeys = []string{"api-secret-value"}

	err := writeSidecarStatusFile(path, cfg, filepath.Join(dir, "config.yaml"), cliproxy.SidecarRuntimeInfo{Sidecar: true})
	if err != nil {
		t.Fatalf("writeSidecarStatusFile() error = %v", err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}
	body := string(data)
	for _, secret := range []string{"management-secret-value", "api-secret-value"} {
		if strings.Contains(body, secret) {
			t.Fatalf("status file leaked secret %q: %s", secret, body)
		}
	}
}
