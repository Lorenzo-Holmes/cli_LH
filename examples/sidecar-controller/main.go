// Package main demonstrates how an external desktop shell can launch and probe
// cli_LH as a local sidecar without embedding Go SDK internals.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"
)

type statusResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
	Server  struct {
		Host       string `json:"host"`
		Port       int    `json:"port"`
		ConfigPath string `json:"configPath"`
		AuthDir    string `json:"authDir"`
	} `json:"server"`
	Runtime struct {
		TUIMode    bool `json:"tuiMode"`
		Standalone bool `json:"standalone"`
		LocalModel bool `json:"localModel"`
	} `json:"runtime"`
}

func main() {
	binaryPath := flag.String("binary", "", "Path to the cli_LH binary to launch")
	configPath := flag.String("config", "", "Path to the cli_LH config.yaml file")
	baseURL := flag.String("base-url", "http://127.0.0.1:8317", "Base URL used for /healthz and /statusz probes")
	startupTimeout := flag.Duration("startup-timeout", 30*time.Second, "Maximum time to wait for sidecar readiness")
	localModel := flag.Bool("local-model", false, "Pass --local-model to the sidecar")
	flag.Parse()

	if strings.TrimSpace(*binaryPath) == "" {
		fatalf("--binary is required")
	}
	if strings.TrimSpace(*configPath) == "" {
		fatalf("--config is required")
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	args := []string{"--config", *configPath}
	if *localModel {
		args = append(args, "--local-model")
	}

	cmd := exec.CommandContext(ctx, *binaryPath, args...)
	cmd.Stdout = prefixedWriter{prefix: "sidecar stdout", writer: os.Stdout}
	cmd.Stderr = prefixedWriter{prefix: "sidecar stderr", writer: os.Stderr}

	if err := cmd.Start(); err != nil {
		fatalf("failed to start sidecar: %v", err)
	}
	fmt.Printf("started sidecar pid=%d\n", cmd.Process.Pid)

	exitCh := make(chan error, 1)
	go func() {
		exitCh <- cmd.Wait()
	}()

	status, err := waitForReady(ctx, *baseURL, *startupTimeout, exitCh)
	if err != nil {
		_ = stopProcess(cmd)
		fatalf("sidecar did not become ready: %v", err)
	}

	encoded, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		_ = stopProcess(cmd)
		fatalf("failed to format status: %v", err)
	}
	fmt.Printf("sidecar ready:\n%s\n", encoded)

	fmt.Println("press Ctrl+C to stop this controller and terminate the sidecar")
	<-ctx.Done()
	_ = stopProcess(cmd)
}

func waitForReady(ctx context.Context, baseURL string, timeout time.Duration, exitCh <-chan error) (*statusResponse, error) {
	deadline := time.NewTimer(timeout)
	defer deadline.Stop()
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	client := &http.Client{Timeout: 2 * time.Second}
	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case err := <-exitCh:
			if err == nil {
				return nil, errors.New("sidecar exited before readiness")
			}
			return nil, fmt.Errorf("sidecar exited before readiness: %w", err)
		case <-deadline.C:
			return nil, fmt.Errorf("timed out after %s", timeout)
		case <-ticker.C:
			if err := probeHealth(client, baseURL); err != nil {
				continue
			}
			status, err := probeStatus(client, baseURL)
			if err != nil {
				continue
			}
			if status.Status == "ready" {
				return status, nil
			}
		}
	}
}

func probeHealth(client *http.Client, baseURL string) error {
	resp, err := client.Get(strings.TrimRight(baseURL, "/") + "/healthz")
	if err != nil {
		return err
	}
	defer closeBody(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("healthz status = %d", resp.StatusCode)
	}
	return nil
}

func probeStatus(client *http.Client, baseURL string) (*statusResponse, error) {
	resp, err := client.Get(strings.TrimRight(baseURL, "/") + "/statusz")
	if err != nil {
		return nil, err
	}
	defer closeBody(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("statusz status = %d", resp.StatusCode)
	}
	var status statusResponse
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, err
	}
	return &status, nil
}

func stopProcess(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	if runtime.GOOS == "windows" {
		return cmd.Process.Kill()
	}
	return cmd.Process.Signal(os.Interrupt)
}

func closeBody(body io.Closer) {
	if err := body.Close(); err != nil {
		fmt.Fprintf(os.Stderr, "failed to close response body: %v\n", err)
	}
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}

type prefixedWriter struct {
	prefix string
	writer io.Writer
}

func (w prefixedWriter) Write(p []byte) (int, error) {
	trimmed := strings.TrimRight(string(p), "\r\n")
	if trimmed != "" {
		_, err := fmt.Fprintf(w.writer, "[%s] %s\n", w.prefix, trimmed)
		if err != nil {
			return 0, err
		}
	}
	return len(p), nil
}
