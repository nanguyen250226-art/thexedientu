import { clearSessionCookie, jsonResponse, readStudentSession, supabaseRpc } from "../lib/server.mjs";

export default async function me(request) {
  if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET" });
  const session = readStudentSession(request);
  if (!session) return jsonResponse({ error: "Vui lòng đăng nhập." }, 401, { "Set-Cookie": clearSessionCookie() });

  try {
    const dashboard = await supabaseRpc("dashboard_for_student", { p_student_id: session.studentId });
    if (!dashboard?.student) return jsonResponse({ error: "Không tìm thấy tài khoản." }, 401, { "Set-Cookie": clearSessionCookie() });
    return jsonResponse(dashboard);
  } catch {
    return jsonResponse({ error: "Không thể tải thông tin tài khoản." }, 503);
  }
}
