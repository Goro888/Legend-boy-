import { json, readJson, sameOrigin, verifySessionToken } from "../_auth.js";

const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 6_000;
const MAX_TOTAL_CHARS = 30_000;
const SYSTEM_INSTRUCTION = [
  "You are JARVIS, a helpful personal assistant used from a mobile phone.",
  "Be clear, warm, practical, and concise. Reply in the same language as the user's latest message unless they ask for another language.",
  "Be honest about uncertainty and your limitations. Do not claim that you can control the user's phone, access private files, run in the background, or perform an action unless a connected tool actually did it.",
].join(" ");

function mergeAdjacentRoles(messages) {
  const merged = [];
  for (const message of messages) {
    const previous = merged[merged.length - 1];
    if (previous && previous.role === message.role) {
      previous.text += `\n${message.text}`;
    } else {
      merged.push({ ...message });
    }
  }
  while (merged.length && merged[0].role !== "user") merged.shift();
  return merged;
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Request not allowed." }, 403);
  if (!env.APP_PASSWORD || env.APP_PASSWORD.length < 16) {
    return json({ error: "Cloud app is not configured yet." }, 503);
  }
  if (!(await verifySessionToken(request, env.APP_PASSWORD))) {
    return json({ error: "Your session expired. Sign in again." }, 401);
  }
  if (!env.GEMINI_API_KEY) {
    return json({ error: "The assistant's Gemini API key has not been added to the cloud app yet." }, 503);
  }
  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    return json({ error: "Send a JSON request." }, 415);
  }

  const parsed = await readJson(request, 40_000);
  if (parsed.error) {
    return json({ error: parsed.error === "too_large" ? "This message is too large." : "Invalid request." }, 400);
  }

  const input = parsed.body?.messages;
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_MESSAGES) {
    return json({ error: "The conversation is invalid. Start a new chat and try again." }, 400);
  }

  let totalChars = 0;
  const messages = [];
  for (const item of input) {
    if (!item || !["user", "model"].includes(item.role) || typeof item.text !== "string") {
      return json({ error: "The conversation contains an invalid message." }, 400);
    }
    const text = item.text.trim();
    if (!text || text.length > MAX_MESSAGE_CHARS) {
      return json({ error: "Messages must contain text and be under 6,000 characters." }, 400);
    }
    totalChars += text.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return json({ error: "That conversation is too long. Clear the chat and try again." }, 400);
    }
    messages.push({ role: item.role, text });
  }

  const contents = mergeAdjacentRoles(messages).map(({ role, text }) => ({
    role,
    parts: [{ text }],
  }));
  if (!contents.length || contents[contents.length - 1].role !== "user") {
    return json({ error: "Send a new message to continue." }, 400);
  }

  const model = typeof env.GEMINI_MODEL === "string" && /^[A-Za-z0-9._-]{1,100}$/.test(env.GEMINI_MODEL)
    ? env.GEMINI_MODEL
    : "gemini-3.8-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  let upstream;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents,
        generationConfig: { temperature: 0.65, maxOutputTokens: 1_200 },
      }),
      signal: AbortSignal.timeout(50_000),
    });
  } catch {
    return json({ error: "I couldn't reach the AI service. Check your connection and try again." }, 502);
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: "The AI service returned an unreadable response. Please try again." }, 502);
  }

  if (!upstream.ok) {
    if (upstream.status === 401 || upstream.status === 403) {
      return json({ error: "The Gemini API key was rejected. Check the key in your cloud-host settings." }, 502);
    }
    if (upstream.status === 429) {
      return json({ error: "The Gemini request limit was reached. Wait a little and try again." }, 429);
    }
    if (upstream.status === 404) {
      return json({ error: "The selected Gemini model is unavailable. Check the GEMINI_MODEL setting." }, 502);
    }
    return json({ error: "The AI service is temporarily unavailable. Please try again shortly." }, 502);
  }

  const reply = (data?.candidates?.[0]?.content?.parts || [])
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!reply) {
    return json({ error: "The AI couldn't provide a text reply to that message. Please rephrase it." }, 502);
  }
  return json({ reply, model });
}
