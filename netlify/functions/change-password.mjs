import { isSameOrigin, jsonResponse, readJson, readStudentSession, supabaseRpc } from "../lib/server.mjs";

export default async function changePassword(request) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "POST" });
  if (!isSameOrigin(request)) return jsonResponse({ error: "Yêu cầu không hợp lệ." }, 403);
  const session = readStudentSession(request);
  if (!session) return jsonResponse({ error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." }, 401);

  const body = await readJson(request);
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 10 || password.length > 128) {
    return jsonResponse({ error: "Mật khẩu mới cần có từ 10 đến 128 ký tự." }, 400);
  }

  try {
    const updated = await supabaseRpc("change_student_password", {
      p_student_id: session.studentId,
      p_new_password: password,
    });
    if (!updated) return jsonResponse({ error: "Không thể cập nhật mật khẩu." }, 400);
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: "Không thể cập nhật mật khẩu lúc này." }, 503);
  }
}
