import { isSameOrigin, jsonResponse, readJson, readStudentSession, supabaseRpc } from "../lib/server.mjs";

export default async function ride(request) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "POST" });
  if (!isSameOrigin(request)) return jsonResponse({ error: "Yêu cầu không hợp lệ." }, 403);
  const session = readStudentSession(request);
  if (!session) return jsonResponse({ error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." }, 401);

  const body = await readJson(request);
  if (!['entry', 'exit'].includes(body?.action)) return jsonResponse({ error: "Hành động không hợp lệ." }, 400);

  try {
    const result = await supabaseRpc("charge_parking", {
      p_student_id: session.studentId,
      p_action: body.action,
    });
    if (!result?.ok) return jsonResponse({ error: "Tài khoản không đủ số dư để quẹt thẻ." }, 409);
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: "Không thể ghi nhận lượt quẹt lúc này." }, 503);
  }
}
