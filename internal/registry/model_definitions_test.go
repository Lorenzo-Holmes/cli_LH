package registry

import "testing"

func TestGPT55StaticContextLength(t *testing.T) {
	models := GetCodexProModels()

	for _, model := range models {
		if model == nil || model.ID != "gpt-5.5" {
			continue
		}
		if model.ContextLength != 1000000 {
			t.Fatalf("gpt-5.5 context length = %d, want 1000000", model.ContextLength)
		}
		return
	}

	t.Fatal("expected gpt-5.5 in Codex pro static models")
}

func TestWithXAIBuiltinsIncludesVideoPreviewModel(t *testing.T) {
	models := WithXAIBuiltins(nil)

	for _, model := range models {
		if model == nil {
			continue
		}
		if model.ID == xaiBuiltinVideo15PreviewModelID {
			return
		}
	}

	t.Fatalf("expected xAI builtin model %s", xaiBuiltinVideo15PreviewModelID)
}
