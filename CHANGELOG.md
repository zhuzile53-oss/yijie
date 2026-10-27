# Changelog

## 0.2.0 — 2026-10-27

First public shape of the open-source version. Forked from a single-site
classroom build and generalised.

**Core**

- Works on any `http(s)` page; sites with their own selection menus are excluded
  (Gmail, Notion, Feishu, Google Docs)
- Pure BYOK: no invite codes, no relay, no device identifiers, no telemetry
- Configurable endpoint, model and four prompts, stored in `chrome.storage.local`
- Custom endpoints request host permission for exactly the domain you type

**Reading**

- Streaming answers with incremental rendering (throttled to one render per frame)
- Surrounding paragraph passed as context (up to 600 characters, windowed around
  the selection)
- Brief / detailed modes, regenerate, copy, `Alt+E`, `Esc`
- Chinese selections produce English explanations, and the panel UI follows that
  language
- Per-site disable with instant re-enable

**Robustness**

- Stream parsing no longer trusts `content-type`; non-stream JSON is detected as
  a fallback
- `[DONE]`, mid-stream `error` events, and half-lines split across chunks handled
- `max_tokens` rejected → automatic retry with `max_completion_tokens`
- Typed errors for 401 / 403 / 404 / 429 / 5xx and network failures
- 10 s first-token hint, 20 s stall guard, request aborted when the panel closes

**Tooling**

- `test/background.test.mjs` — 17 assertions over the streaming parser using a
  stubbed `fetch`, no key or browser needed
- `test/lang.test.mjs` — Chinese/English detection cases
- Icons at 16 / 48 / 128

## 0.1.0 — private classroom build (not in this repo)

A single-site reading assistant for one textbook platform, with an invite-code
relay. It shares the selection/panel code with this project but is not part of
this repository.
