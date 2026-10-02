import { clearSessionCookie, isSameOrigin, jsonResponse } from "../lib/server.mjs";

export default async function logout(request) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "POST" });
  if (!isSameOrigin(request)) return jsonResponse({ error: "Yêu cầu không hợp lệ." }, 403);
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}
