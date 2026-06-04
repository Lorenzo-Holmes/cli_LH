package main

import (
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseModeAcceptsAliases(t *testing.T) {
	tests := map[string]selectedMode{
		"":         modeAuto,
		"auto":     modeAuto,
		"normal":   modeNormal,
		"config":   modeNormal,
		"deepseek": modeDeepSeek,
		"ds":       modeDeepSeek,
	}

	for input, expected := range tests {
		actual, err := parseMode(input)
		if err != nil {
			t.Fatalf("parseMode(%q) returned unexpected error: %v", input, err)
		}
		if actual != expected {
			t.Fatalf("parseMode(%q) = %q, want %q", input, actual, expected)
		}
	}
}

func TestParseModeRejectsUnknownMode(t *testing.T) {
	if _, err := parseMode("unknown"); err == nil {
		t.Fatal("parseMode should reject unknown modes")
	}
}

func TestChooseModePrefersNormalWhenCodexAuthExists(t *testing.T) {
	mode := chooseMode(statusInfo{
		NormalConfigExists: true,
		CodexAuthCount:     1,
	})
	if mode != modeNormal {
		t.Fatalf("chooseMode() = %q, want %q", mode, modeNormal)
	}
}

func TestChooseModeFallsBackToDeepSeekWithoutCodexAuth(t *testing.T) {
	mode := chooseMode(statusInfo{
		NormalConfigExists: true,
		CodexAuthCount:     0,
	})
	if mode != modeDeepSeek {
		t.Fatalf("chooseMode() = %q, want %q", mode, modeDeepSeek)
	}
}

func TestChooseModeKeepsExistingService(t *testing.T) {
	mode := chooseMode(statusInfo{
		PortOpen: true,
	})
	if mode != modeAuto {
		t.Fatalf("chooseMode() = %q, want %q", mode, modeAuto)
	}
}

func TestCountMatchesCountsOnlyFiles(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "codex-a.json"), []byte("{}"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(dir, "codex-dir.json"), 0o700); err != nil {
		t.Fatal(err)
	}

	pattern := filepath.Join(dir, "codex-*.json")
	if got := countMatches(pattern); got != 1 {
		t.Fatalf("countMatches() = %d, want 1", got)
	}
}

func TestIsPortOpen(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()

	host, port, err := net.SplitHostPort(listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}

	if !isPortOpen(host, port) {
		t.Fatal("isPortOpen should return true for a listening port")
	}
}

func TestPrepareDeepSeekConfigRendersEnvKeyToRuntimeFile(t *testing.T) {
	t.Setenv("DEEPSEEK_API_KEY", "sk-test-deepseek")
	dir := t.TempDir()
	templatePath := filepath.Join(dir, "config.deepseek.yaml")
	runtimePath := filepath.Join(dir, ".runtime", "config.deepseek.yaml")
	if err := os.WriteFile(templatePath, []byte("api-key: \"${DEEPSEEK_API_KEY}\"\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	actual, err := prepareDeepSeekConfig(templatePath, runtimePath)
	if err != nil {
		t.Fatalf("prepareDeepSeekConfig returned unexpected error: %v", err)
	}
	if actual != runtimePath {
		t.Fatalf("prepareDeepSeekConfig path = %q, want %q", actual, runtimePath)
	}
	content, err := os.ReadFile(runtimePath)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "sk-test-deepseek") {
		t.Fatalf("runtime config should contain rendered key, got %q", string(content))
	}
}

func TestPrepareDeepSeekConfigRequiresEnvKey(t *testing.T) {
	t.Setenv("DEEPSEEK_API_KEY", "")
	dir := t.TempDir()
	templatePath := filepath.Join(dir, "config.deepseek.yaml")
	runtimePath := filepath.Join(dir, ".runtime", "config.deepseek.yaml")
	if err := os.WriteFile(templatePath, []byte("api-key: \"${DEEPSEEK_API_KEY}\"\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	_, err := prepareDeepSeekConfig(templatePath, runtimePath)
	if err == nil {
		t.Fatal("prepareDeepSeekConfig should require DEEPSEEK_API_KEY")
	}
}
