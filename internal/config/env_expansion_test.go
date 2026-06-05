package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadConfigOptionalExpandsEnvironmentVariables(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.yaml")

	secret := "sk-env-expansion-test-secret"
	t.Setenv("DEEPSEEK_API_KEY", secret)

	content := `openai-compatibility:
  - name: "deepseek"
    base-url: "https://api.deepseek.com"
    api-key-entries:
      - api-key: "${DEEPSEEK_API_KEY}"
`
	if err := os.WriteFile(configPath, []byte(content), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	cfg, err := LoadConfigOptional(configPath, false)
	if err != nil {
		t.Fatalf("LoadConfigOptional() error = %v", err)
	}
	if len(cfg.OpenAICompatibility) != 1 || len(cfg.OpenAICompatibility[0].APIKeyEntries) != 1 {
		t.Fatalf("unexpected openai compatibility entries: %+v", cfg.OpenAICompatibility)
	}
	if got := cfg.OpenAICompatibility[0].APIKeyEntries[0].APIKey; got != secret {
		t.Fatalf("api key = %q, want expanded env secret", got)
	}

	after, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("read config after load: %v", err)
	}
	if !strings.Contains(string(after), "${DEEPSEEK_API_KEY}") {
		t.Fatalf("LoadConfigOptional should not persist expanded secrets, got: %s", string(after))
	}
}
