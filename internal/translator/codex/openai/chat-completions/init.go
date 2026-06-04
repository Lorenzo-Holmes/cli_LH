package chat_completions

import (
	. "github.com/Lorenzo-Holmes/cli_LH/v7/internal/constant"
	"github.com/Lorenzo-Holmes/cli_LH/v7/internal/interfaces"
	"github.com/Lorenzo-Holmes/cli_LH/v7/internal/translator/translator"
)

func init() {
	translator.Register(
		OpenAI,
		Codex,
		ConvertOpenAIRequestToCodex,
		interfaces.TranslateResponse{
			Stream:    ConvertCodexResponseToOpenAI,
			NonStream: ConvertCodexResponseToOpenAINonStream,
		},
	)
}
