package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"
)

func main() {
	statusFile := flag.String("status-file", "server.json", "Path to the sidecar server.json file")
	flag.Parse()

	status, err := readServerStatus(*statusFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "controller error: %v\n", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := newController(nil).checkHealth(ctx, status); err != nil {
		fmt.Fprintf(os.Stderr, "controller error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Sidecar %s is ready at %s (pid=%d)\n", status.Service, status.BaseURL, status.PID)
}
