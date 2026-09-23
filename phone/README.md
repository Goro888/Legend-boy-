# JARVIS Phone — use it with no PC

This is a separate, phone-first web app in this repository. It runs in your mobile browser and calls Gemini through a small Cloudflare Pages Function. **Your phone does not connect to a computer, and you do not need to install Python or run the desktop app.**

The current version supports AI text chat, optional phone-browser speech-to-text, and read-aloud using your phone's speech voices. Dictation support depends on the browser and installed language services; typing always works. It does not control desktop apps or listen for a wake word in the background.

## Set it up from your phone

You need a Google Gemini API key and a Cloudflare account. You can do these steps in your phone browser; do not send the API key or app password in chat, and never put either one in GitHub.

1. **Create a Gemini API key** in Google AI Studio: <https://aistudio.google.com/app/apikey>. Check the current limits and billing terms for your Google account.
2. **Create a Cloudflare Pages site** at <https://dash.cloudflare.com/>. Choose **Workers & Pages → Create → Pages → Connect to Git** and authorize the GitHub repository that contains this project.
3. Set the Pages project options:
   - **Root directory:** `phone`
   - **Framework preset:** None
   - **Build command:** leave blank
   - **Build output directory:** `public`
4. In the Pages project's **Settings → Variables and Secrets**, add these runtime values:
   - `GEMINI_API_KEY` — add as a **secret**, using the key from Google AI Studio.
   - `APP_PASSWORD` — add as a **secret**; make it unique, random, and at least 16 characters. This protects your public app URL; do not reuse your Google password.
   - Optional `GEMINI_MODEL` — add as a regular runtime variable if you want a different supported Gemini model ID. It defaults to `gemini-3.8-flash` in the server function.
5. Save the settings and redeploy the Pages site. If using a Git preview branch, add the same secrets to its **Preview** environment as well (or set that branch as the production branch). Open its `*.pages.dev` HTTPS URL on your phone, enter the app password, and use **Add to Home Screen** from your browser menu.

Cloudflare deploys the static page and the `functions/` API together. Keep the same-origin `/api` routes enabled; do not expose the Gemini key in a front-end setting. GitHub Pages alone is not enough because it cannot safely keep this API key secret or run the backend function.

## Security and privacy

- Only the Gemini API key and app password live in Cloudflare's secret settings. The app sends a short-lived signed session token to the API; the key is never sent to the browser.
- Conversations are saved in the phone browser's local storage so they survive a refresh. The Pages Function does not save chat history, but each prompt and recent conversation context is sent to Google's Gemini API to generate a reply. Use **Settings → Clear chat on this phone** to delete local history.
- Use a unique, strong app password. If you share the Pages URL, other people still cannot use the AI endpoint without the password, but they can try to sign in. Add Cloudflare rate-limiting rules if you make the app public or expect heavy traffic.
- A browser session lasts 7 days. Avoid “Remember this phone” on a shared device; signing out removes its saved token.
- HTTPS is required for microphone permission and PWA install. Voice recognition and available spoken voices vary by browser and language. The microphone is only activated after you tap the mic button; there is no background wake-word listener.
- Gemini usage may have limits or charges. Review Google's current terms and usage before sharing the app.

## What this does not do

This is a phone assistant, not a mobile port of the desktop automation. It cannot operate a computer that is not running, access private files on a PC, launch desktop software, or provide an always-on wake word. The phone must have internet access for AI replies; the cached app shell may open offline, but the AI itself cannot answer offline.

## Files

- `public/` — installable mobile app, styling, icon, and offline app shell.
- `functions/api/session.js` — password sign-in and short-lived signed sessions.
- `functions/api/chat.js` — validates requests and calls Gemini server-side.
- `wrangler.toml` — Cloudflare Pages settings.
