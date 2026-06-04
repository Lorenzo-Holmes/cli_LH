package claude

import (
	. "github.com/Lorenzo-Holmes/cli_LH/v7/internal/constant"
	"github.com/Lorenzo-Holmes/cli_LH/v7/internal/interfaces"
	"github.com/Lorenzo-Holmes/cli_LH/v7/internal/translator/translator"
)

func init() {
	translator.Register(
		Claude,
		Antigravity,
		ConvertClaudeRequestToAntigravity,
		interfaces.TranslateResponse{
			Stream:     ConvertAntigravityResponseToClaude,
			NonStream:  ConvertAntigravityResponseToClaudeNonStream,
			TokenCount: ClaudeTokenCount,
		},
	)
}
