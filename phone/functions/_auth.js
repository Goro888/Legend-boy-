const SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
const textEncoder = new TextEncoder();

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readJson(request, maxBytes = 32_000) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > maxBytes) return { error: "too_large" };

  const raw = await request.text();
  if (textEncoder.encode(raw).byteLength > maxBytes) return { error: "too_large" };
  try {
    return { body: JSON.parse(raw) };
  } catch {
    return { error: "invalid_json" };
  }
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function constantTimeEqual(left, right) {
  const a = textEncoder.encode(left);
  const b = textEncoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
}

export async function issueSessionToken(secret) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;
  const payload = base64UrlEncode(textEncoder.encode(JSON.stringify({ v: 1, exp: expiresAt })));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), textEncoder.encode(payload));
  return { token: `${payload}.${base64UrlEncode(new Uint8Array(signature))}`, expiresAt };
}

export async function verifySessionToken(request, secret) {
  if (!secret || secret.length < 16) return false;
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer ([A-Za-z0-9_.-]+)$/);
  if (!match) return false;

  const [payload, signature, extra] = match[1].split(".");
  if (!payload || !signature || extra !== undefined) return false;

  try {
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      base64UrlDecode(signature),
      textEncoder.encode(payload),
    );
    if (!validSignature) return false;

    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    return claims.v === 1 && Number.isInteger(claims.exp) && claims.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
