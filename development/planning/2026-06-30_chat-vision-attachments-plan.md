# Chat Vision Attachments Plan

## Why this slice exists

Chat attachments already support private upload, turn claiming, chips, replay,
and signed downloads. Image files are still not useful as model input: the
upload contract rejects common image extensions, and the chat route only injects
extracted text. That creates the Open WebUI-style failure mode Juan called out:
once an image exists in the turn, non-vision models can get stuck or fail
instead of simply answering from the text they can process.

Root cause: attachment resolution had one text-context output and no separate
vision payload or vision budget. This slice fixes the root in safe scope by
keeping image attachments in the existing private attachment flow while adding a
model-capable vision projection only for models whose config has
`supports_vision`, plus image byte validation and image-aware preflight before
the model call.

## Scope

- Ownership lane: chat portal attachments
- Slice phase: Vertical slice

1. Accept common image files in the existing `/api/chat/attachments` upload
   route without trying to run text extraction on them.
2. Validate uploaded image bytes against the declared extension, derive real
   image MIME for octet-stream uploads, and reject oversized image payloads.
3. Resolve image attachment storage metadata alongside existing attachment DTOs.
4. Add image URL parts to the latest user message only when the selected model
   has `supports_vision`.
5. Keep non-vision models usable: image attachments are ignored for model input,
   while text/document/code attachments still inject text as they do today.
6. Count vision payloads in the context-length guard and reject image payloads
   that exceed per-image or per-turn byte budgets before download/model work.
7. Add route/adapter tests for vision inclusion, non-vision ignore behavior,
   Anthropic base64 image blocks, RunPod pass-through, and the unified client's
   image-only Anthropic path.

### Files touched

- `lib/chat/attachments.ts`
- `lib/chat/attachment-limits.ts`
- `lib/llm/openai.ts`
- `lib/llm/adapters/openai-adapter.ts`
- `lib/llm/adapters/anthropic-adapter.ts`
- `lib/llm/adapters/ollama-adapter.ts`
- `lib/llm/adapters/base-adapter.ts`
- `lib/llm/adapters/runpod-adapter.ts`
- `lib/llm/anthropic.ts`
- `lib/llm/unified-client.ts`
- `lib/llm/adapters/__tests__/openai-adapter.test.ts`
- `lib/llm/adapters/__tests__/ollama-adapter.test.ts`
- `lib/llm/adapters/__tests__/anthropic-adapter.test.ts`
- `lib/llm/adapters/__tests__/runpod-adapter.test.ts`
- `lib/llm/__tests__/unified-client.test.ts`
- `app/api/chat/route.ts`
- `app/api/chat/__tests__/route-tool-use-smoke.test.ts`
- `app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts`
- `app/api/chat/__tests__/route-mcp-live-stdio-sse.test.ts`
- `app/api/chat/attachments/__tests__/route.test.ts`
- `.github/ai-coordination/API_COORDINATION.md`
- `.github/ai-coordination/TYPES_COORDINATION.md`
- `development/planning/2026-06-30_chat-vision-attachments-plan.md`

## Mechanism

Image uploads are stored exactly like other private chat attachments, but their
`kind` is `image` and their extracted text is empty. Upload handling inspects
PNG/JPEG/WebP/GIF magic bytes before accepting the file and stores the detected
image MIME even when the browser submits `application/octet-stream`.

Attachment resolution returns text context plus image metadata. Before the model
call, the route checks the loaded model config. If `supports_vision` is true, it
enforces a 4 MB per-image budget, a 12 MB per-turn image budget, and an image
token estimate (`max(512, ceil(bytes / 1024))`) alongside the existing text
estimate. If the request fits, the route creates private server-side data URLs
from the stored image bytes and converts the latest user message into multimodal
content parts. OpenAI-compatible adapters preserve those parts, Anthropic
converts data URLs into base64 image blocks, RunPod preserves the array content
for its OpenAI-compatible payload, and Ollama maps data URLs to its native
`images` array. If a stored image cannot be downloaded or no longer validates,
the route skips that image and still sends the text turn. If `supports_vision`
is false or unknown, image parts are not added; the model receives the normal
text prompt and any non-image attachment context.

## Intentional

- Non-vision models do not error when image attachments are present. They ignore
  the image payload and continue with text.
- This slice does not route uploaded images into the `generate_image` ComfyUI
  tool. Uploaded images are user-provided input; `generate_image` remains the
  model-requested output tool path.
- No OCR fallback for non-vision models in this slice.
- No image gallery or annotation UI.
- No retry or hard failure for transient image-download failures; the text turn
  is more valuable than failing the entire request after the preflight passed.
- Data URLs are generated only server-side for model input. The public
  persisted chip/download flow still uses short-lived signed URLs and does not
  store image data URLs in message metadata.

## Deferred

- OCR or caption extraction fallback for non-vision models.
- Image-content guardrails/moderation for image-only prompts. The current
  guardrail service is text-only; this slice makes image-only turns preserved
  and budgeted instead of dropped, but it does not add visual safety analysis.
- Provider-specific refinements beyond OpenAI-compatible, Anthropic, and Ollama
  image part mapping.
- Rich image preview/gallery and artifact panel integration.

## Verification

- `npm run type-check` — passed.
- `npm run test:vitest -- app/api/chat/attachments/__tests__/route.test.ts app/api/chat/__tests__/route-tool-use-smoke.test.ts lib/llm/adapters/__tests__/openai-adapter.test.ts lib/llm/adapters/__tests__/ollama-adapter.test.ts lib/llm/adapters/__tests__/anthropic-adapter.test.ts lib/llm/adapters/__tests__/runpod-adapter.test.ts lib/llm/__tests__/unified-client.test.ts --run` — 70 tests passed.
- `npm run test:vitest -- app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts app/api/chat/__tests__/route-mcp-live-stdio-sse.test.ts --run` — 4 tests passed.
- `npm test` — 96 files / 846 tests passed.
- `npm run lint` — passed with existing warning debt.
- `git diff --check` — passed.
- `npm run build` — passed.

## Estimated diff size

- Current: 23 files, about +1472/-75 LOC relative to `origin/main`.
- This is over the preferred slice size because the root fix changes the shared
  chat message content contract and every provider adapter that formats
  messages must either preserve multimodal parts or safely extract text.
