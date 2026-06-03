package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/router-for-me/CLIProxyAPI/v7/internal/buildinfo"
)

// SidecarRuntimeInfo holds runtime metadata for the sidecar status endpoint.
type SidecarRuntimeInfo struct {
	TUIMode    bool `json:"tuiMode"`
	Standalone bool `json:"standalone"`
	LocalModel bool `json:"localModel"`
}

type sidecarBuildInfo struct {
	Version   string `json:"version"`
	Commit    string `json:"commit"`
	BuildDate string `json:"buildDate"`
}

type sidecarServerInfo struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	ConfigPath string `json:"configPath"`
	AuthDir    string `json:"authDir"`
}

type sidecarProviderSummary struct {
	GeminiAPIKeys              int  `json:"geminiApiKeys"`
	CodexAPIKeys               int  `json:"codexApiKeys"`
	ClaudeAPIKeys              int  `json:"claudeApiKeys"`
	OpenAICompatibilityEntries int  `json:"openaiCompatibilityEntries"`
	VertexAPIKeys              int  `json:"vertexApiKeys"`
	OAuthModelAliases          int  `json:"oauthModelAliases"`
	HomeEnabled                bool `json:"homeEnabled"`
}

type sidecarStatusResponse struct {
	Status    string                 `json:"status"`
	Service   string                 `json:"service"`
	Build     sidecarBuildInfo       `json:"build"`
	Server    sidecarServerInfo      `json:"server"`
	Runtime   SidecarRuntimeInfo     `json:"runtime"`
	Providers sidecarProviderSummary `json:"providers"`
}

func (s *Server) sidecarStatusHandler(c *gin.Context) {
	if c.Request.Method == http.MethodHead {
		c.Status(http.StatusOK)
		return
	}

	resp := sidecarStatusResponse{
		Status:  "ready",
		Service: "CLIProxyAPI",
		Build: sidecarBuildInfo{
			Version:   buildinfo.Version,
			Commit:    buildinfo.Commit,
			BuildDate: buildinfo.BuildDate,
		},
	}

	if s != nil && s.cfg != nil {
		resp.Runtime = s.sidecarRuntime
		resp.Server = sidecarServerInfo{
			Host:       s.cfg.Host,
			Port:       s.cfg.Port,
			ConfigPath: s.configFilePath,
			AuthDir:    s.cfg.AuthDir,
		}
		resp.Providers = sidecarProviderSummary{
			GeminiAPIKeys:              len(s.cfg.GeminiKey),
			CodexAPIKeys:               len(s.cfg.CodexKey),
			ClaudeAPIKeys:              len(s.cfg.ClaudeKey),
			OpenAICompatibilityEntries: len(s.cfg.OpenAICompatibility),
			VertexAPIKeys:              len(s.cfg.VertexCompatAPIKey),
			OAuthModelAliases:          len(s.cfg.OAuthModelAlias),
			HomeEnabled:                s.cfg.Home.Enabled,
		}
	}

	c.JSON(http.StatusOK, resp)
}
