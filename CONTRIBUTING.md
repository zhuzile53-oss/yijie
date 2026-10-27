# Contributing

Thanks for taking a look. This project is small on purpose: plain JS, no
build step, no dependencies.

## Getting started

1. Clone the repo.
2. Load the folder in `chrome://extensions` → **Load unpacked**.
3. Edit files, then click the reload icon on the extension card and refresh any
   open tab. **Old tabs keep running the previous content script**, so a
   "nothing happens" moment is usually a missing refresh.

There is no `npm install`. Tests run on Node 18+:

```bash
node test/background.test.mjs
node test/lang.test.mjs
```

## Ground rules that exist because of real bugs

These are not style preferences — each one broke the extension at some point.

- **Never render model output with `innerHTML`.** Build text nodes and only
  highlight `**bold**` locally. Full-string HTML rendering truncates long
  answers on some pages.
- **Never uppercase or otherwise transform an API key.** Keys are
  case-sensitive.
- **Keep the panel height fixed** (`height: 62vh`, body `flex: 1 1 0;
  min-height: 0; overflow-y: auto`). An auto-height panel collapses to one line.
- **Do not branch on `content-type` to decide whether a response is streamed.**
  Plenty of OpenAI-compatible servers mislabel SSE as `text/plain`. Parse
  everything as a stream and fall back to whole-body JSON only when no `data:`
  line was seen.
- **One request per port, aborted on disconnect.** Closing the panel must stop
  the request, otherwise it keeps burning tokens.
- **Read the selection with `window.getSelection()`**, never via the clipboard —
  many reader sites block copying.
- **`all_frames: true`** is required; textbook-style readers put the text in a
  cross-origin iframe.

## Adding a provider

Any endpoint that implements `POST {base}/chat/completions` with `stream: true`
and OpenAI's SSE format works with no code change. If a provider needs a
different payload, add it to `src/background.js` next to the `max_tokens`
fallback and cover it in `test/background.test.mjs`.

## Tests

`test/background.test.mjs` stubs `fetch` and the port, so it runs offline and
never spends tokens. Add a case whenever you touch:

- SSE chunk boundaries (half lines split across chunks)
- `[DONE]` handling
- non-stream JSON fallback
- HTTP status mapping
- abort/stall behaviour

`test/lang.test.mjs` covers the Chinese/English heuristic. If you change the
threshold, add the cases that motivated it.

## Commits

`feat:`, `fix:`, `docs:`, `chore:` — Chinese or English is fine. Keep the body
focused on *why*.

## Never commit

- Real API keys, tokens, `.env`, `config.json`, `*.key`
- A private relay domain or personal proxy URL
- `node_modules/`

`.gitignore` covers most of it. If you suspect a key leaked, rotate it first,
then clean history.

## Pull requests

- `node test/background.test.mjs && node test/lang.test.mjs` pass
- Extension loads without manifest errors (`chrome://extensions` shows no red
  "Errors" button)
- Manual check: select English → Chinese answer; select Chinese → English
  answer; `Esc` closes; the panel still streams character by character
- If you changed a default prompt, update both `src/defaults.js` and the
  relevant README section
