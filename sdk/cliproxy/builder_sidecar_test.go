package cliproxy

import (
	"path/filepath"
	"testing"

	"github.com/router-for-me/CLIProxyAPI/v7/sdk/config"
)

func TestBuilderWithSidecarRuntimeInfoUsesPublicSDKType(t *testing.T) {
	tmp := t.TempDir()
	cfg := &config.Config{
		Host:    "127.0.0.1",
		Port:    8317,
		AuthDir: filepath.Join(tmp, "auths"),
	}

	svc, err := NewBuilder().
		WithConfig(cfg).
		WithConfigPath(filepath.Join(tmp, "config.yaml")).
		WithSidecarRuntimeInfo(SidecarRuntimeInfo{
			Sidecar:    true,
			TUIMode:    false,
			Standalone: true,
			LocalModel: true,
		}).
		Build()
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}
	if svc == nil {
		t.Fatalf("Build() returned nil service")
	}
	if len(svc.serverOptions) == 0 {
		t.Fatalf("expected sidecar runtime server option to be registered")
	}
}
