import { json } from "./functions/_auth.js";
import { onRequestPost as postChat } from "./functions/api/chat.js";
import {
  onRequestGet as getSession,
  onRequestPost as createSession,
} from "./functions/api/session.js";

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const context = { request, env, ctx, params: {} };

    if (pathname === "/api/session") {
      if (request.method === "GET") return getSession(context);
      if (request.method === "POST") return createSession(context);
      return json({ error: "Method not allowed." }, 405);
    }

    if (pathname === "/api/chat") {
      if (request.method === "POST") return postChat(context);
      return json({ error: "Method not allowed." }, 405);
    }

    if (pathname.startsWith("/api/")) {
      return json({ error: "Not found." }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
