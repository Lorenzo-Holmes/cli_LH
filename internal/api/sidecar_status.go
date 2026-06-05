package api

import (
	"net/http"

	"github.com/Lorenzo-Holmes/cli_LH/v7/internal/buildinfo"
	"github.com/gin-gonic/gin"
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

type sidecarManagementSummary struct {
	Available               bool `json:"available"`
	LocalPasswordAvailable  bool `json:"localPasswordAvailable"`
	RemoteManagementAllowed bool `json:"remoteManagementAllowed"`
	ControlPanelEnabled     bool `json:"controlPanelEnabled"`
	AutoUpdatePanelEnabled  bool `json:"autoUpdatePanelEnabled"`
	UsageStatisticsEnabled  bool `json:"usageStatisticsEnabled"`
	RequestLogEnabled       bool `json:"requestLogEnabled"`
	LoggingToFileEnabled    bool `json:"loggingToFileEnabled"`
	WebsocketAuthEnabled    bool `json:"websocketAuthEnabled"`
	TLSEnabled              bool `json:"tlsEnabled"`
}

type sidecarStatusResponse struct {
	Status     string                   `json:"status"`
	Service    string                   `json:"service"`
	Build      sidecarBuildInfo         `json:"build"`
	Server     sidecarServerInfo        `json:"server"`
	Runtime    SidecarRuntimeInfo       `json:"runtime"`
	Providers  sidecarProviderSummary   `json:"providers"`
	Management sidecarManagementSummary `json:"management"`
}

func (s *Server) sidecarStatusHandler(c *gin.Context) {
	if c.Request.Method == http.MethodHead {
		c.Status(http.StatusOK)
		return
	}

	resp := sidecarStatusResponse{
		Status:  "ready",
		Service: "cli_LH",
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
		hasManagementSecret := s.cfg.RemoteManagement.SecretKey != "" || s.localPassword != ""
		resp.Management = sidecarManagementSummary{
			Available:               hasManagementSecret,
			LocalPasswordAvailable:  s.localPassword != "",
			RemoteManagementAllowed: s.cfg.RemoteManagement.AllowRemote,
			ControlPanelEnabled:     !s.cfg.RemoteManagement.DisableControlPanel,
			AutoUpdatePanelEnabled:  !s.cfg.RemoteManagement.DisableAutoUpdatePanel,
			UsageStatisticsEnabled:  s.cfg.UsageStatisticsEnabled,
			RequestLogEnabled:       s.cfg.RequestLog,
			LoggingToFileEnabled:    s.cfg.LoggingToFile,
			WebsocketAuthEnabled:    s.cfg.WebsocketAuth,
			TLSEnabled:              s.cfg.TLS.Enable,
		}
	}

	c.JSON(http.StatusOK, resp)
}
