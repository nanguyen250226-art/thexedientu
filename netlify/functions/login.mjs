import { createSessionCookie, isSameOrigin, jsonResponse, readJson, supabaseRpc } from "../lib/server.mjs";

export default async function login(request) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "POST" });
  if (!isSameOrigin(request)) return jsonResponse({ error: "Yêu cầu không hợp lệ." }, 403);

  const body = await readJson(request);
  const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!/^\d{5,10}$/.test(studentId) || password.length < 1 || password.length > 128) {
    return jsonResponse({ error: "MSSV hoặc mật khẩu chưa chính xác." }, 401);
  }

  try {
    const result = await supabaseRpc("login_student", {
      p_student_id: studentId,
      p_password: password,
    });
    if (!result?.ok) {
      const message = result?.locked
        ? "Tài khoản tạm khóa sau nhiều lần đăng nhập sai. Thử lại sau 15 phút."
        : "MSSV hoặc mật khẩu chưa chính xác.";
      return jsonResponse({ error: message }, 401);
    }

    return jsonResponse(
      { ok: true, mustChangePassword: result.mustChangePassword },
      200,
      { "Set-Cookie": createSessionCookie(studentId, body.remember === true) },
    );
  } catch {
    return jsonResponse({ error: "Dịch vụ đăng nhập đang tạm thời không khả dụng." }, 503);
  }
}
