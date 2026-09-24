import { constantTimeEqual, issueSessionToken, json, readJson, sameOrigin, verifySessionToken } from "../_auth.js";

const PASSWORD_MIN_LENGTH = 16;

export async function onRequestGet({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Request not allowed." }, 403);
  if (!env.APP_PASSWORD || env.APP_PASSWORD.length < PASSWORD_MIN_LENGTH) {
    return json({ error: "Cloud app is not configured yet." }, 503);
  }
  if (!(await verifySessionToken(request, env.APP_PASSWORD))) {
    return json({ error: "Your session expired. Sign in again." }, 401);
  }
  return json({ ok: true });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Request not allowed." }, 403);
  if (!env.APP_PASSWORD || env.APP_PASSWORD.length < PASSWORD_MIN_LENGTH) {
    return json({ error: "Cloud app is not configured yet. Add a strong APP_PASSWORD secret." }, 503);
  }
  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    return json({ error: "Send a JSON request." }, 415);
  }

  const parsed = await readJson(request, 4_096);
  if (parsed.error) {
    return json({ error: parsed.error === "too_large" ? "Request is too large." : "Invalid request." }, 400);
  }

  const password = typeof parsed.body?.password === "string" ? parsed.body.password : "";
  if (!constantTimeEqual(password, env.APP_PASSWORD)) {
    return json({ error: "That app password is not correct." }, 401);
  }

  const session = await issueSessionToken(env.APP_PASSWORD);
  return json({ ok: true, ...session });
}
