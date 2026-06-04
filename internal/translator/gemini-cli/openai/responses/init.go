package responses

import (
	. "github.com/Lorenzo-Holmes/cli_LH/v7/internal/constant"
	"github.com/Lorenzo-Holmes/cli_LH/v7/internal/interfaces"
	"github.com/Lorenzo-Holmes/cli_LH/v7/internal/translator/translator"
)

func init() {
	translator.Register(
		OpenaiResponse,
		GeminiCLI,
		ConvertOpenAIResponsesRequestToGeminiCLI,
		interfaces.TranslateResponse{
			Stream:    ConvertGeminiCLIResponseToOpenAIResponses,
			NonStream: ConvertGeminiCLIResponseToOpenAIResponsesNonStream,
		},
	)
}
