# Legendboy Phone — use it with no PC

This is a phone-first web app in this repository. It runs in your mobile browser and uses Cloudflare Pages Functions (JavaScript) to call an AI provider. **It does not connect to a computer, and it does not install or run the desktop Python app.** The repository's desktop `requirements.txt` is not needed for this app.

The chat composer has working **Camera** and **Photos & files** controls. You can capture a new photo, choose photos from your library, or attach readable text files (TXT, MD, CSV, JSON, logs, common source/config files). Up to four attachments can be sent with a prompt; images are resized in the browser before upload. Photos and file contents go to the configured AI provider for analysis and are not saved in local chat history. The chosen model must support vision to analyze images. PDF and office documents are not currently supported as uploads.

The app also supports optional phone-browser speech-to-text and read-aloud using your phone's speech voices. Dictation support depends on the browser and installed language services; typing always works. It does not control desktop apps or listen for a wake word in the background.

## Set it up from your phone

You need a Cloudflare account and an API key for your AI provider. You said you have an xKiro key, so these steps use xKiro; **you do not need a separate Gemini API key**. Never paste your API key or app password into chat or commit them to GitHub.

1. In Cloudflare, use a **Pages** project (not a Worker or Workers Builds deployment) connected to this GitHub repository. Select branch `arena/01a0d077-legend-boy`; the phone app is on that branch. The existing Pages deploy target is `arena-01a0d077-legend-boy`.
2. Configure the Pages build:
   - **Root directory:** `phone`
   - **Framework preset:** None
   - **Build command:** leave blank
   - **Build output directory:** `public`
   - If you deploy manually from the `phone/` directory, use `npx wrangler pages deploy public --project-name=arena-01a0d077-legend-boy`.
3. In the Pages project's runtime **Settings → Variables and Secrets**, add:
   - `XKIRO_API_KEY` as a **secret** — your xKiro API key.
   - `APP_PASSWORD` as a **secret** — a new, unique, random password with at least 16 characters. This protects the public app URL; do not reuse your Google password.
   - Optional `XKIRO_MODEL` as a regular runtime variable — a full `vendor/model` ID available to your xKiro account. It defaults to `google/gemini-3.7-flash`.
   - Optional `AI_PROVIDER=xkiro` as a regular runtime variable if you previously saved the xKiro key under the old `GEMINI_API_KEY` secret name. Better: add the key under `XKIRO_API_KEY` and remove the incorrectly named secret.
4. Save and deploy the latest commit from the selected branch. Open the resulting HTTPS `*.pages.dev` URL on your phone, enter your app password, and choose **Add to Home Screen** from your browser menu.

The xKiro backend uses its OpenAI-compatible chat endpoint and expects a complete `vendor/model` ID. To use Google's Gemini API directly instead, set `AI_PROVIDER=gemini` and add `GEMINI_API_KEY` as a secret; `GEMINI_MODEL` is optional.

**Deployment troubleshooting:** Do not use `npx wrangler deploy`—that deploys a Worker. This app is a Cloudflare Pages project using `pages_build_output_dir` and Pages Functions, so it intentionally has no Worker `main` or `[assets]` entry. If the build log says “Missing entry-point to Worker script or to assets directory” or recommends `wrangler pages deploy`, Cloudflare is running a Worker deployment/build: switch to the Pages project/Git integration, or deploy manually with `npx wrangler pages deploy public --project-name=arena-01a0d077-legend-boy` from the `phone/` directory. Do not add a Worker entry point to silence that error. Keep the Pages root directory at `phone`; if it points to the repository root, Cloudflare detects and installs the desktop Python dependencies instead.

## Security and privacy

- Only the AI provider key and app password live in Cloudflare's runtime secrets. The browser gets a short-lived signed session token; provider keys are never sent to the phone.
- Conversations are saved in the phone browser's local storage so they survive a refresh. The Pages Functions do not save chat history, but each prompt and recent conversation context is sent to xKiro (and the selected model provider) or to Google if using the direct Gemini option. Use **Settings → Clear chat on this phone** to delete local history.
- Use a unique, strong app password. If you share the Pages URL, other people still cannot use the AI endpoint without the password, but they can try to sign in. Add Cloudflare rate-limiting rules if you make the app public or expect heavy traffic.
- A browser session lasts 7 days. Avoid “Remember this phone” on a shared device; signing out removes its saved token.
- HTTPS is required for camera/microphone access and PWA install. The camera and microphone are activated only after you tap their buttons; the app does not access them in the background. Voice recognition and available spoken voices vary by browser and language.
- AI-provider usage may have limits or charges. Review the provider's current terms and usage before sharing the app.

## What this does not do

This is a phone assistant, not a mobile port of the desktop automation. It cannot operate a computer that is not running, access private files on a PC, launch desktop software, or provide an always-on wake word. The phone must have internet access for AI replies; the cached app shell may open offline, but the AI itself cannot answer offline.

## Files

- `public/` — installable mobile app, styling, icon, and offline app shell.
- `functions/api/session.js` — password sign-in and short-lived signed sessions.
- `functions/api/chat.js` — validates requests and calls the configured AI provider server-side.
- `wrangler.toml` — Cloudflare Pages settings and output directory.
