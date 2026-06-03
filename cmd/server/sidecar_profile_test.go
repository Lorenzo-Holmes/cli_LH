package main

import (
	"testing"

	"github.com/router-for-me/CLIProxyAPI/v7/internal/config"
)

func TestApplySidecarProfileDefaults(t *testing.T) {
	cfg := &config.Config{Host: "", Port: 8317}
	flags := runtimeFlagState{Sidecar: true}

	applySidecarProfileDefaults(cfg, &flags)

	if cfg.Host != "127.0.0.1" {
		t.Fatalf("host = %q, want 127.0.0.1", cfg.Host)
	}
	if !flags.LocalModel {
		t.Fatalf("local model should be enabled in sidecar mode")
	}
	if !flags.NoBrowser {
		t.Fatalf("no-browser should be enabled in sidecar mode")
	}
}

func TestApplySidecarProfilePreservesExplicitHost(t *testing.T) {
	cfg := &config.Config{Host: "localhost", Port: 8317}
	flags := runtimeFlagState{Sidecar: true}

	applySidecarProfileDefaults(cfg, &flags)

	if cfg.Host != "localhost" {
		t.Fatalf("host = %q, want localhost", cfg.Host)
	}
}

func TestApplySidecarProfileNoopWhenDisabled(t *testing.T) {
	cfg := &config.Config{Host: "", Port: 8317}
	flags := runtimeFlagState{}

	applySidecarProfileDefaults(cfg, &flags)

	if cfg.Host != "" {
		t.Fatalf("host = %q, want empty", cfg.Host)
	}
	if flags.LocalModel || flags.NoBrowser {
		t.Fatalf("flags changed when sidecar disabled: %+v", flags)
	}
}
