# JARVIS Phone — use it with no PC

This is a phone-first web app in this repository. It runs in your mobile browser and uses Cloudflare Pages Functions (JavaScript) to call an AI provider. **It does not connect to a computer, and it does not install or run the desktop Python app.** The repository's desktop `requirements.txt` is not needed for this app.

The current version supports AI text chat, optional phone-browser speech-to-text, and read-aloud using your phone's speech voices. Dictation support depends on the browser and installed language services; typing always works. It does not control desktop apps or listen for a wake word in the background.

## Set it up from your phone

You need a Cloudflare account and an API key for your AI provider. You said you have an xKiro key, so these steps use xKiro; **you do not need a separate Gemini API key**. Never paste your API key or app password into chat or commit them to GitHub.

1. In Cloudflare, create/connect a **Pages** project to this GitHub repository. Select branch `arena/01a0d077-legend-boy`; the phone app is on that branch. The Pages project name in `wrangler.toml` is `arena-01a0d077-legend-boy`.
2. Configure the Pages build:
   - **Root directory:** `phone`
   - **Framework preset:** None
   - **Build command:** leave blank
   - If Cloudflare requires a deploy command, use: `npx wrangler pages deploy public --project-name=arena-01a0d077-legend-boy`
3. In the Pages project's runtime **Settings → Variables and Secrets**, add:
   - `XKIRO_API_KEY` as a **secret** — your xKiro API key.
   - `APP_PASSWORD` as a **secret** — a new, unique, random password with at least 16 characters. This protects the public app URL; do not reuse your Google password.
   - Optional `XKIRO_MODEL` as a regular runtime variable — a full `vendor/model` ID available to your xKiro account. It defaults to `google/gemini-3.7-flash`.
   - Optional `AI_PROVIDER=xkiro` as a regular runtime variable if you previously saved the xKiro key under the old `GEMINI_API_KEY` secret name. Better: add the key under `XKIRO_API_KEY` and remove the incorrectly named secret.
4. Save and deploy the latest commit from the selected branch. Open the resulting HTTPS `*.pages.dev` URL on your phone, enter your app password, and choose **Add to Home Screen** from your browser menu.

The xKiro backend uses its OpenAI-compatible chat endpoint and expects a complete `vendor/model` ID. To use Google's Gemini API directly instead, set `AI_PROVIDER=gemini` and add `GEMINI_API_KEY` as a secret; `GEMINI_MODEL` is optional.

**Do not use `npx wrangler deploy`**—that is for a Worker, not this Pages project. The correct Pages command is `npx wrangler pages deploy public --project-name=arena-01a0d077-legend-boy`. Run it from the `phone/` project root so Wrangler can include the sibling `functions/` directory. Keep the Cloudflare root directory at `phone`; if it points to the repository root, Cloudflare detects and installs the desktop Python dependencies instead.

## Security and privacy

- Only the AI provider key and app password live in Cloudflare's runtime secrets. The browser gets a short-lived signed session token; provider keys are never sent to the phone.
- Conversations are saved in the phone browser's local storage so they survive a refresh. The Pages Functions do not save chat history, but each prompt and recent conversation context is sent to xKiro (and the selected model provider) or to Google if using the direct Gemini option. Use **Settings → Clear chat on this phone** to delete local history.
- Use a unique, strong app password. If you share the Pages URL, other people still cannot use the AI endpoint without the password, but they can try to sign in. Add Cloudflare rate-limiting rules if you make the app public or expect heavy traffic.
- A browser session lasts 7 days. Avoid “Remember this phone” on a shared device; signing out removes its saved token.
- HTTPS is required for microphone permission and PWA install. Voice recognition and available spoken voices vary by browser and language. The microphone is only activated after you tap the mic button; there is no background wake-word listener.
- AI-provider usage may have limits or charges. Review the provider's current terms and usage before sharing the app.

## What this does not do

This is a phone assistant, not a mobile port of the desktop automation. It cannot operate a computer that is not running, access private files on a PC, launch desktop software, or provide an always-on wake word. The phone must have internet access for AI replies; the cached app shell may open offline, but the AI itself cannot answer offline.

## Files

- `public/` — installable mobile app, styling, icon, and offline app shell.
- `functions/api/session.js` — password sign-in and short-lived signed sessions.
- `functions/api/chat.js` — validates requests and calls the configured AI provider server-side.
- `wrangler.toml` — Cloudflare Pages settings and output directory.
