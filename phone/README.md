# JARVIS Phone — use it with no PC

This is a separate, phone-first web app in this repository. It runs in your mobile browser and uses a small Cloudflare Worker to call Gemini. **It does not connect to a computer, and it does not install or run the desktop Python app.** The Worker serves the web app files from `public/` and handles the `/api/` requests; the deployed project uses JavaScript only, not the repository's desktop `requirements.txt`.

The current version supports AI text chat, optional phone-browser speech-to-text, and read-aloud using your phone's speech voices. Dictation support depends on the browser and installed language services; typing always works. It does not control desktop apps or listen for a wake word in the background.

## Set it up from your phone

You need a Google Gemini API key and a Cloudflare account. You can do these steps in your phone browser; do not send the API key or app password in chat, and never put either one in GitHub.

1. **Create a Gemini API key** in Google AI Studio: <https://aistudio.google.com/app/apikey>. Check the current limits and billing terms for your Google account.
2. **Create/connect a Cloudflare Worker** using the GitHub repository. Use the branch `arena/01a0d077-legend-boy` (the phone app is on that branch; choose `main` only after this change is merged there). The Worker name in `wrangler.toml` is `arena-01a0d077-legend-boy`.
3. In the Worker build settings set:
   - **Root directory:** `phone`
   - **Build command:** leave blank (there is no compile/build step)
   - **Deploy command:** `npx wrangler deploy`
4. In the Worker project's **Settings → Variables and Secrets**, add:
   - `GEMINI_API_KEY` as a **secret** — the key from Google AI Studio.
   - `APP_PASSWORD` as a **secret** — a new, unique, random password with at least 16 characters. This protects the public Worker URL; do not reuse your Google password.
   - Optional `GEMINI_MODEL` as a regular runtime variable if you want another supported Gemini model ID. The Worker defaults to `gemini-3.8-flash`.
5. Save and deploy. Open the Worker URL ending in `workers.dev` on your phone, enter your app password, and choose **Add to Home Screen** from your browser menu.

Do **not** use a Python build command or `npx wrangler pages deploy` for this Worker. The `phone/` folder has its own `wrangler.toml`, `worker.js`, static assets, and JavaScript API. The repository's Python `requirements.txt` is outside this Worker project; make sure the root directory really is `phone` so Cloudflare does not build the desktop assistant.

## Security and privacy

- Only the Gemini API key and app password live in Cloudflare's runtime secrets. The browser gets a short-lived signed session token; the Gemini key is never sent to the phone.
- Conversations are saved in the phone browser's local storage so they survive a refresh. The Worker does not save chat history, but each prompt and recent conversation context is sent to Google's Gemini API to generate a reply. Use **Settings → Clear chat on this phone** to delete local history.
- Use a unique, strong app password. If you share the Worker URL, other people still cannot use the AI endpoint without the password, but they can try to sign in. Add Cloudflare rate-limiting rules if you make the app public or expect heavy traffic.
- A browser session lasts 7 days. Avoid “Remember this phone” on a shared device; signing out removes its saved token.
- HTTPS is required for microphone permission and PWA install. Voice recognition and available spoken voices vary by browser and language. The microphone is only activated after you tap the mic button; there is no background wake-word listener.
- Gemini usage may have limits or charges. Review Google's current terms and usage before sharing the app.

## What this does not do

This is a phone assistant, not a mobile port of the desktop automation. It cannot operate a computer that is not running, access private files on a PC, launch desktop software, or provide an always-on wake word. The phone must have internet access for AI replies; the cached app shell may open offline, but the AI itself cannot answer offline.

## Files

- `public/` — installable mobile app, styling, icon, and offline app shell.
- `worker.js` — Cloudflare Worker routes static assets and the protected API.
- `functions/api/session.js` — password sign-in and short-lived signed sessions.
- `functions/api/chat.js` — validates requests and calls Gemini server-side.
- `wrangler.toml` — Worker and static assets configuration for `npx wrangler deploy`.
