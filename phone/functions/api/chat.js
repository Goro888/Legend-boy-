import { json, readJson, sameOrigin, verifySessionToken } from "../_auth.js";

const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 6_000;
const MAX_TOTAL_CHARS = 30_000;
const XKIRO_BASE_URL = "https://api.xkiro.com/v1";
const XKIRO_DEFAULT_MODEL = "google/gemini-3.7-flash";
const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";
const SYSTEM_INSTRUCTION = [
  "You are JARVIS, a helpful personal assistant used from a mobile phone.",
  "Be clear, warm, practical, and concise. Reply in the same language as the user's latest message unless they ask for another language.",
  "Be honest about uncertainty and your limitations. Do not claim that you can control the user's phone, access private files, run in the background, or perform an action unless a connected tool actually did it.",
].join(" ");

function mergeAdjacentRoles(messages) {
  const merged = [];
  for (const message of messages) {
    const previous = merged[merged.length - 1];
    if (previous && previous.role === message.role) previous.text += `\n${message.text}`;
    else merged.push({ ...message });
  }
  while (merged.length && merged[0].role !== "user") merged.shift();
  return merged;
}

function isXkiroKey(value) {
  return typeof value === "string" && value.startsWith("sk-xt-");
}

function privateOrLocalHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.includes(":")) return true; // Disallow IPv6 literals for custom upstream URLs.
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168);
}

function normalizeBaseUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || privateOrLocalHost(url.hostname)) return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function resolveProvider(env) {
  const configuredProtocol = typeof env.AI_API_PROTOCOL === "string" ? env.AI_API_PROTOCOL.trim().toLowerCase() : "";
  const legacyProvider = typeof env.AI_PROVIDER === "string" ? env.AI_PROVIDER.trim().toLowerCase() : "";
  const protocol = configuredProtocol || (legacyProvider === "gemini" ? "gemini" : "openai");
  if (!["openai", "anthropic", "gemini"].includes(protocol)) {
    return { error: "AI_API_PROTOCOL must be openai, anthropic, or gemini." };
  }

  const legacyXkiro = legacyProvider === "xkiro" || Boolean(env.XKIRO_API_KEY) || isXkiroKey(env.GEMINI_API_KEY);
  let apiKey;
  if (env.AI_API_KEY) apiKey = env.AI_API_KEY;
  else if (protocol === "gemini") apiKey = env.GEMINI_API_KEY;
  else apiKey = env.XKIRO_API_KEY || (legacyXkiro ? env.GEMINI_API_KEY : "");
  if (!apiKey) {
    return { error: protocol === "gemini"
      ? "Add GEMINI_API_KEY as a Cloudflare Pages secret, or use AI_API_KEY for a compatible endpoint."
      : "Add AI_API_KEY as a Cloudflare Pages secret." };
  }

  let model = env.AI_MODEL || env.XKIRO_MODEL || env.GEMINI_MODEL || "";
  if (!model && legacyXkiro && protocol === "openai") model = XKIRO_DEFAULT_MODEL;
  if (!model && protocol === "gemini") model = GEMINI_DEFAULT_MODEL;
  if (!model || !/^[A-Za-z0-9._:/+-]{1,200}$/.test(model)) {
    return { error: "Set AI_MODEL to a valid model ID for your provider." };
  }

  let baseUrl = "";
  if (protocol === "openai") {
    const defaultBase = legacyXkiro ? XKIRO_BASE_URL : "https://api.openai.com/v1";
    baseUrl = normalizeBaseUrl(env.AI_BASE_URL || defaultBase);
  } else if (protocol === "anthropic") {
    baseUrl = normalizeBaseUrl(env.AI_BASE_URL || "https://api.anthropic.com");
  }
  if (protocol !== "gemini" && !baseUrl) {
    return { error: "AI_BASE_URL must be a valid public HTTPS API base URL." };
  }

  return { protocol, apiKey, model, baseUrl, legacyXkiro };
}

function conversationMessages(messages) {
  return [
    { role: "system", content: SYSTEM_INSTRUCTION },
    ...messages.map(({ role, text }) => ({ role: role === "model" ? "assistant" : "user", content: text })),
  ];
}

function chatCompletionsEndpoint(baseUrl) {
  return `${baseUrl}/chat/completions`;
}

function anthropicMessagesEndpoint(baseUrl) {
  return baseUrl.endsWith("/v1") ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`;
}

function openAiHeaders(apiKey, env) {
  const header = (env.AI_API_KEY_HEADER || "Authorization").trim();
  if (!/^[A-Za-z0-9-]{1,64}$/.test(header)) return null;
  const prefix = env.AI_API_KEY_PREFIX !== undefined
    ? env.AI_API_KEY_PREFIX
    : (header.toLowerCase() === "authorization" ? "Bearer" : "");
  if (typeof prefix !== "string" || prefix.length > 40 || /[\r\n]/.test(prefix)) return null;
  return {
    "Content-Type": "application/json",
    [header]: prefix ? `${prefix} ${apiKey}` : apiKey,
  };
}

function textFromContent(content) {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map((part) => typeof part?.text === "string" ? part.text : "").filter(Boolean).join("\n").trim();
  }
  return "";
}

function extractReply(data, protocol) {
  if (protocol === "openai") return textFromContent(data?.choices?.[0]?.message?.content);
  if (protocol === "anthropic") return textFromContent(data?.content);
  return (data?.candidates?.[0]?.content?.parts || [])
    .map((part) => typeof part.text === "string" ? part.text : "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function upstreamError(status, protocol) {
  if (status === 401 || status === 403) {
    return protocol === "gemini"
      ? "The Gemini API key was rejected. Check the key in Cloudflare Pages secrets."
      : "The AI provider rejected the key or model access. Check AI_API_KEY and your provider account.";
  }
  if (status === 402) return "The selected model requires credits or access on your provider account.";
  if (status === 429) return "The AI request limit was reached. Wait a little and try again.";
  if (status === 404) return "The provider could not find that model or endpoint. Check AI_MODEL and AI_BASE_URL.";
  return "The AI service is temporarily unavailable. Please try again shortly.";
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Request not allowed." }, 403);
  if (!env.APP_PASSWORD || env.APP_PASSWORD.length < 16) {
    return json({ error: "Cloud app is not configured yet." }, 503);
  }
  if (!(await verifySessionToken(request, env.APP_PASSWORD))) {
    return json({ error: "Your session expired. Sign in again." }, 401);
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
  const validated = [];
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
    validated.push({ role: item.role, text });
  }

  const messages = mergeAdjacentRoles(validated);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return json({ error: "Send a new message to continue." }, 400);
  }

  const config = resolveProvider(env);
  if (config.error) return json({ error: config.error }, 503);

  let endpoint;
  let headers;
  let body;
  if (config.protocol === "openai") {
    headers = openAiHeaders(config.apiKey, env);
    if (!headers) return json({ error: "AI_API_KEY_HEADER or AI_API_KEY_PREFIX is invalid." }, 503);
    endpoint = chatCompletionsEndpoint(config.baseUrl);
    body = {
      model: config.model,
      messages: conversationMessages(messages),
      temperature: 0.65,
      max_tokens: 1_200,
    };
  } else if (config.protocol === "anthropic") {
    endpoint = anthropicMessagesEndpoint(config.baseUrl);
    headers = {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": env.ANTHROPIC_VERSION || "2023-06-01",
    };
    body = {
      model: config.model,
      system: SYSTEM_INSTRUCTION,
      max_tokens: 1_200,
      messages: messages.map(({ role, text }) => ({ role: role === "model" ? "assistant" : "user", content: text })),
    };
  } else {
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;
    headers = { "Content-Type": "application/json", "x-goog-api-key": config.apiKey };
    body = {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: messages.map(({ role, text }) => ({ role, parts: [{ text }] })),
      generationConfig: { temperature: 0.65, maxOutputTokens: 1_200 },
    };
  }

  let upstream;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
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
  if (!upstream.ok) return json({ error: upstreamError(upstream.status, config.protocol) }, upstream.status === 429 || upstream.status === 402 ? upstream.status : 502);

  const reply = extractReply(data, config.protocol);
  if (!reply) return json({ error: "The AI couldn't provide a text reply to that message. Please rephrase it." }, 502);
  return json({ reply, model: config.model, provider: config.protocol });
}
