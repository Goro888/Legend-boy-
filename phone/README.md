# JARVIS Phone — use it with no PC

This is a phone-first web app in this repository. It runs in your mobile browser and uses Cloudflare Pages Functions (JavaScript) to call your chosen AI API. **It does not connect to a computer, and it does not install or run the desktop Python app.** The repository's desktop `requirements.txt` is not needed for this app.

You can use any model exposed through an OpenAI-compatible Chat Completions endpoint, an Anthropic Messages endpoint, or Google's Gemini API. Set the provider endpoint, protocol, and model ID in Cloudflare runtime variables; keep the API key in a secret. You do not need to edit the frontend or send keys in chat.

The current version supports AI text chat, optional phone-browser speech-to-text, and read-aloud using your phone's speech voices. Dictation support depends on the browser and installed language services; typing always works. It does not control desktop apps or listen for a wake word in the background.

## Set it up from your phone

1. In Cloudflare, create/connect a **Pages** project to this GitHub repository. Select branch `arena/01a0d077-legend-boy`; the phone app is on that branch. The Pages project name in `wrangler.toml` is `arena-01a0d077-legend-boy`.
2. Configure the Pages build:
   - **Root directory:** `phone`
   - **Framework preset:** None
   - **Build command:** leave blank
   - If Cloudflare requires a deploy command, use: `npx wrangler pages deploy public --project-name=arena-01a0d077-legend-boy`
3. In the Pages project's runtime **Settings → Variables and Secrets**, add these non-secret variables for the API you want to use:
   - `AI_API_PROTOCOL` — `openai` (default), `anthropic`, or `gemini`.
   - `AI_BASE_URL` — the provider's public HTTPS API base URL. The default is xKiro: `https://api.xkiro.com/v1`. For a different provider, change this to its documented API base URL; do not include `/chat/completions` at the end.
   - `AI_MODEL` — the exact model ID supported by that provider. The default is `google/gemini-3.7-flash` for the xKiro setup.
   - Optional `AI_API_KEY_HEADER` and `AI_API_KEY_PREFIX` — only needed if your OpenAI-compatible API uses a non-standard API-key header. By default the app sends `Authorization: Bearer <key>`.
4. Add the matching credential under **Secrets** (not `[vars]`):
   - `AI_API_KEY` — preferred generic secret.
   - For existing setups, `XKIRO_API_KEY` and `GEMINI_API_KEY` are also accepted. Do not copy a key into multiple places.
   - `APP_PASSWORD` — a new, unique password of at least 16 characters to protect the public app URL.
5. Save and deploy the latest commit from the selected branch. Open the resulting HTTPS `*.pages.dev` URL on your phone, enter your app password, and choose **Add to Home Screen** from your browser menu.

### Provider examples

- **Any OpenAI-compatible API:** set `AI_API_PROTOCOL=openai`, `AI_BASE_URL` to the provider's base URL, `AI_MODEL` to its exact model ID, and store its key in `AI_API_KEY`.
- **xKiro:** `AI_API_PROTOCOL=openai`, `AI_BASE_URL=https://api.xkiro.com/v1`, and an xKiro `vendor/model` ID. The existing `XKIRO_API_KEY` secret continues to work.
- **Anthropic Messages API:** set `AI_API_PROTOCOL=anthropic`, `AI_BASE_URL=https://api.anthropic.com`, and the model ID from your Anthropic account.
- **Google Gemini directly:** set `AI_API_PROTOCOL=gemini`, use a Gemini model ID, and store the key in `AI_API_KEY` or the legacy `GEMINI_API_KEY` secret.

The provider must support the selected protocol. For OpenAI-compatible and Anthropic APIs, `AI_BASE_URL` must be a public HTTPS URL; private/local network endpoints are rejected. Direct Gemini uses Google's endpoint, so `AI_BASE_URL` is ignored. Some providers require an account plan or credits for a model.

**Do not use `npx wrangler deploy`**—that is for a Worker, not this Pages project. The correct Pages command is `npx wrangler pages deploy public --project-name=arena-01a0d077-legend-boy`. Run it from the `phone/` project root so Wrangler can include the sibling `functions/` directory. Keep the Cloudflare root directory at `phone`; if it points to the repository root, Cloudflare detects and installs the desktop Python dependencies instead.

## Security and privacy

- `AI_API_KEY`, `APP_PASSWORD`, and provider credentials belong in Cloudflare's runtime **Secrets**. Never place them in `wrangler.toml`, a `[vars]` section, GitHub, or chat. If a credential is exposed, revoke/rotate it immediately.
- The browser receives only a short-lived signed session token; provider keys are never sent to the phone.
- Conversations are saved in the phone browser's local storage so they survive a refresh. The Pages Functions do not save chat history, but each prompt and recent conversation context is sent to the selected AI provider to generate a reply. Use **Settings → Clear chat on this phone** to delete local history.
- Use a unique, strong app password. If you share the Pages URL, other people still cannot use the AI endpoint without the password, but they can try to sign in. Add Cloudflare rate-limiting rules if you make the app public or expect heavy traffic.
- A browser session lasts 7 days. Avoid “Remember this phone” on a shared device; signing out removes its saved token.
- HTTPS is required for microphone permission and PWA install. Voice recognition and available spoken voices vary by browser and language. The microphone is only activated after you tap the mic button; there is no background wake-word listener.

## What this does not do

This is a phone assistant, not a mobile port of the desktop automation. It cannot operate a computer that is not running, access private files on a PC, launch desktop software, or provide an always-on wake word. The phone must have internet access for AI replies; the cached app shell may open offline, but the AI itself cannot answer offline.

## Files

- `public/` — installable mobile app, styling, icon, and offline app shell.
- `functions/api/session.js` — password sign-in and short-lived signed sessions.
- `functions/api/chat.js` — validates requests and routes to the selected AI protocol.
- `wrangler.toml` — Cloudflare Pages settings and default non-secret provider variables.
