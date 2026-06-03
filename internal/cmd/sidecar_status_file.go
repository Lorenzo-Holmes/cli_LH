package cmd

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/router-for-me/CLIProxyAPI/v7/internal/buildinfo"
	"github.com/router-for-me/CLIProxyAPI/v7/internal/config"
	"github.com/router-for-me/CLIProxyAPI/v7/sdk/cliproxy"
)

type sidecarStatusFile struct {
	Status     string                      `json:"status"`
	Service    string                      `json:"service"`
	PID        int                         `json:"pid"`
	BaseURL    string                      `json:"baseURL"`
	HealthURL  string                      `json:"healthURL"`
	StatusURL  string                      `json:"statusURL"`
	ConfigPath string                      `json:"configPath"`
	AuthDir    string                      `json:"authDir"`
	Runtime    cliproxy.SidecarRuntimeInfo `json:"runtime"`
	Build      sidecarStatusFileBuild      `json:"build"`
	WrittenAt  string                      `json:"writtenAt"`
}

type sidecarStatusFileBuild struct {
	Version   string `json:"version"`
	Commit    string `json:"commit"`
	BuildDate string `json:"buildDate"`
}

func writeSidecarStatusFile(path string, cfg *config.Config, configPath string, runtimeInfo cliproxy.SidecarRuntimeInfo) error {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil
	}
	if cfg == nil {
		return fmt.Errorf("sidecar status file: config is nil")
	}

	baseURL := sidecarBaseURL(cfg.Host, cfg.Port)
	payload := sidecarStatusFile{
		Status:     "ready",
		Service:    "CLIProxyAPI",
		PID:        os.Getpid(),
		BaseURL:    baseURL,
		HealthURL:  baseURL + "/healthz",
		StatusURL:  baseURL + "/statusz",
		ConfigPath: configPath,
		AuthDir:    cfg.AuthDir,
		Runtime:    runtimeInfo,
		Build: sidecarStatusFileBuild{
			Version:   buildinfo.Version,
			Commit:    buildinfo.Commit,
			BuildDate: buildinfo.BuildDate,
		},
		WrittenAt: time.Now().UTC().Format(time.RFC3339),
	}

	data, errMarshal := json.MarshalIndent(payload, "", "  ")
	if errMarshal != nil {
		return fmt.Errorf("sidecar status file: marshal: %w", errMarshal)
	}
	data = append(data, '\n')

	if errMkdir := os.MkdirAll(filepath.Dir(path), 0o755); errMkdir != nil {
		return fmt.Errorf("sidecar status file: create parent directory: %w", errMkdir)
	}
	tmp := path + ".tmp"
	if errWrite := os.WriteFile(tmp, data, 0o600); errWrite != nil {
		return fmt.Errorf("sidecar status file: write temp file: %w", errWrite)
	}
	if errRename := os.Rename(tmp, path); errRename != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("sidecar status file: replace file: %w", errRename)
	}
	return nil
}

func sidecarBaseURL(host string, port int) string {
	host = strings.TrimSpace(host)
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}
	return "http://" + net.JoinHostPort(host, fmt.Sprintf("%d", port))
}
