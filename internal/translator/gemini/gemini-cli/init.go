package geminiCLI

import (
	. "github.com/Lorenzo-Holmes/cli_LH/v7/internal/constant"
	"github.com/Lorenzo-Holmes/cli_LH/v7/internal/interfaces"
	"github.com/Lorenzo-Holmes/cli_LH/v7/internal/translator/translator"
)

func init() {
	translator.Register(
		GeminiCLI,
		Gemini,
		ConvertGeminiCLIRequestToGemini,
		interfaces.TranslateResponse{
			Stream:     ConvertGeminiResponseToGeminiCLI,
			NonStream:  ConvertGeminiResponseToGeminiCLINonStream,
			TokenCount: GeminiCLITokenCount,
		},
	)
}
