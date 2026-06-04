package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const (
	defaultHost       = "127.0.0.1"
	defaultPort       = "8317"
	defaultAPIKey     = "sk-your-secret-key-change-me"
	serverBinary      = "bin/server.exe"
	normalConfig      = "config.yaml"
	deepSeekConfig    = "config.deepseek.yaml"
	deepSeekRuntime   = ".cliproxy-switch/config.deepseek.runtime.yaml"
	deepSeekKeyEnv    = "DEEPSEEK_API_KEY"
	codexAuthGlob     = "auths/codex-*.json"
	defaultHTTPClient = 3 * time.Second
)

type selectedMode string

const (
	modeAuto     selectedMode = "auto"
	modeNormal   selectedMode = "normal"
	modeDeepSeek selectedMode = "deepseek"
)

type statusInfo struct {
	ServerBinaryExists   bool
	NormalConfigExists   bool
	DeepSeekConfigExists bool
	CodexAuthCount       int
	PortOpen             bool
	ModelsReachable      bool
	Models               []string
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "[!] %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		printUsage()
		return nil
	}

	switch args[0] {
	case "status":
		return runStatus()
	case "start":
		return runStart(args[1:])
	case "use":
		return runUse(args[1:])
	case "help", "-h", "--help":
		printUsage()
		return nil
	default:
		printUsage()
		return fmt.Errorf("unknown command %q", args[0])
	}
}

func printUsage() {
	fmt.Println("CLIProxy Switch")
	fmt.Println("")
	fmt.Println("Usage:")
	fmt.Println("  cliproxy-switch status")
	fmt.Println("  cliproxy-switch start [--auto|--mode normal|--mode deepseek]")
	fmt.Println("  cliproxy-switch use auto|normal|deepseek")
}

func runStatus() error {
	info := collectStatus()
	printStatus(info)
	return nil
}

func runStart(args []string) error {
	fs := flag.NewFlagSet("start", flag.ContinueOnError)
	fs.SetOutput(os.Stdout)
	auto := fs.Bool("auto", false, "automatically choose normal or deepseek mode")
	modeText := fs.String("mode", "auto", "startup mode: auto, normal, or deepseek")
	if err := fs.Parse(args); err != nil {
		return err
	}

	mode, err := parseMode(*modeText)
	if err != nil {
		return err
	}
	if *auto {
		mode = modeAuto
	}
	if mode == modeAuto {
		mode = chooseMode(collectStatus())
	}
	return startSelectedMode(mode)
}

func runUse(args []string) error {
	if len(args) != 1 {
		return errors.New("usage: cliproxy-switch use auto|normal|deepseek")
	}
	mode, err := parseMode(args[0])
	if err != nil {
		return err
	}
	if mode == modeAuto {
		mode = chooseMode(collectStatus())
	}
	return startSelectedMode(mode)
}

func parseMode(value string) (selectedMode, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "auto", "":
		return modeAuto, nil
	case "normal", "config":
		return modeNormal, nil
	case "deepseek", "ds":
		return modeDeepSeek, nil
	default:
		return "", fmt.Errorf("unknown mode %q", value)
	}
}

func chooseMode(info statusInfo) selectedMode {
	if info.PortOpen || info.ModelsReachable {
		fmt.Println("[+] existing cli_LH service detected; keeping current service")
		return modeAuto
	}
	if info.CodexAuthCount > 0 && info.NormalConfigExists {
		fmt.Println("[+] Codex/OAI auth found; selecting normal mode")
		return modeNormal
	}
	fmt.Println("[!] Codex/OAI auth unavailable; selecting DeepSeek direct mode")
	return modeDeepSeek
}

func startSelectedMode(mode selectedMode) error {
	info := collectStatus()
	if info.ModelsReachable || info.PortOpen {
		printStatus(info)
		fmt.Println("[+] service is already running; no duplicate process started")
		return nil
	}

	configPath := normalConfig
	if mode == modeDeepSeek {
		preparedPath, errPrepare := prepareDeepSeekConfig(deepSeekConfig, deepSeekRuntime)
		if errPrepare != nil {
			return errPrepare
		}
		configPath = preparedPath
	}
	if mode == modeAuto {
		return errors.New("auto mode did not resolve to a concrete mode")
	}
	if !fileExists(serverBinary) {
		return fmt.Errorf("server binary missing: %s", serverBinary)
	}
	if !fileExists(configPath) {
		return fmt.Errorf("selected config missing: %s", configPath)
	}

	fmt.Printf("[+] selected mode: %s\n", mode)
	fmt.Printf("[+] selected config: %s\n", configPath)
	fmt.Printf("[+] local API: http://%s\n", net.JoinHostPort(defaultHost, defaultPort))
	return startServer(configPath)
}

func prepareDeepSeekConfig(templatePath string, runtimePath string) (string, error) {
	content, err := os.ReadFile(templatePath)
	if err != nil {
		return "", fmt.Errorf("read deepseek config template: %w", err)
	}
	key := strings.TrimSpace(os.Getenv(deepSeekKeyEnv))
	if key == "" {
		return "", fmt.Errorf("%s is required for DeepSeek direct mode", deepSeekKeyEnv)
	}
	rendered := strings.ReplaceAll(string(content), "${"+deepSeekKeyEnv+"}", key)
	if errMkdir := os.MkdirAll(filepath.Dir(runtimePath), 0o700); errMkdir != nil {
		return "", fmt.Errorf("create runtime config directory: %w", errMkdir)
	}
	if errWrite := os.WriteFile(runtimePath, []byte(rendered), 0o600); errWrite != nil {
		return "", fmt.Errorf("write runtime deepseek config: %w", errWrite)
	}
	return runtimePath, nil
}

func startServer(configPath string) error {
	cmd := exec.Command(serverBinary, "--config", configPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	cmd.Dir = "."
	fmt.Println("[+] starting cli_LH; press Ctrl+C to stop")
	return cmd.Run()
}

func collectStatus() statusInfo {
	models, modelsReachable := probeModels(defaultHost, defaultPort, defaultAPIKey)
	return statusInfo{
		ServerBinaryExists:   fileExists(serverBinary),
		NormalConfigExists:   fileExists(normalConfig),
		DeepSeekConfigExists: fileExists(deepSeekConfig),
		CodexAuthCount:       countMatches(codexAuthGlob),
		PortOpen:             isPortOpen(defaultHost, defaultPort),
		ModelsReachable:      modelsReachable,
		Models:               models,
	}
}

func printStatus(info statusInfo) {
	fmt.Println("CLIProxy Switch Status")
	fmt.Println("======================")
	printBool("server binary", info.ServerBinaryExists, serverBinary)
	printBool("normal config", info.NormalConfigExists, normalConfig)
	printBool("deepseek config", info.DeepSeekConfigExists, deepSeekConfig)
	fmt.Printf("codex auth files: %d\n", info.CodexAuthCount)
	printBool("port 8317 open", info.PortOpen, "127.0.0.1:8317")
	printBool("models endpoint", info.ModelsReachable, "/v1/models")
	if len(info.Models) > 0 {
		fmt.Printf("models: %s\n", strings.Join(info.Models, ", "))
	}
}

func printBool(label string, ok bool, detail string) {
	mark := "-"
	if ok {
		mark = "+"
	}
	fmt.Printf("[%s] %s: %s\n", mark, label, detail)
}

func fileExists(path string) bool {
	stat, err := os.Stat(path)
	return err == nil && !stat.IsDir()
}

func countMatches(pattern string) int {
	matches, err := filepath.Glob(pattern)
	if err != nil {
		return 0
	}
	count := 0
	for _, match := range matches {
		if fileExists(match) {
			count++
		}
	}
	return count
}

func isPortOpen(host string, port string) bool {
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, port), defaultHTTPClient)
	if err != nil {
		return false
	}
	defer func() {
		_ = conn.Close()
	}()
	return true
}

func probeModels(host string, port string, apiKey string) ([]string, bool) {
	client := &http.Client{Timeout: defaultHTTPClient}
	url := fmt.Sprintf("http://%s/v1/models", net.JoinHostPort(host, port))
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, false
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return nil, false
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, false
	}

	var payload struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, false
	}

	models := make([]string, 0, len(payload.Data))
	for _, model := range payload.Data {
		if strings.TrimSpace(model.ID) != "" {
			models = append(models, model.ID)
		}
	}
	return models, true
}
