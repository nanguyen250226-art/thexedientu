const screens = {
  access: document.getElementById("screen-access"),
  login: document.getElementById("screen-login"),
  dashboard: document.getElementById("screen-dashboard"),
  payment: document.getElementById("screen-payment"),
};

const loginForm = document.getElementById("login-form");
const studentIdInput = document.getElementById("student-id");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("login-error");
const passwordDialog = document.getElementById("password-dialog");
const passwordForm = document.getElementById("change-password-form");
const passwordError = document.getElementById("password-error");
const flowSteps = [...document.querySelectorAll(".flow-step")];

let currentStudent = null;
let mustChangePassword = false;
let transferTimers = [];
let toastTimer;

async function apiRequest(endpoint, { method = "GET", body } = {}) {
  const options = {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {},
  };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`/api/${endpoint}`, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "Yêu cầu chưa hoàn tất.");
    error.status = response.status;
    throw error;
  }
  return result;
}

function showScreen(name) {
  Object.entries(screens).forEach(([screenName, screen]) => {
    const active = screenName === name;
    screen.hidden = !active;
    screen.classList.toggle("is-active", active);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openLogin() {
  studentIdInput.value = "";
  passwordInput.value = "";
  loginError.hidden = true;
  showScreen("login");
  studentIdInput.focus({ preventScroll: true });
}

function formatMoney(amount) {
  return `${Number(amount).toLocaleString("vi-VN")} đ`;
}

function updateDashboard(data) {
  const { student, rideHistory } = data;
  currentStudent = student;
  document.getElementById("student-name").textContent = student.fullName;
  document.getElementById("dashboard-student-id").textContent = student.studentId;
  document.getElementById("balance-amount").innerHTML = `<span>${Number(student.balance).toLocaleString("vi-VN")}</span><small>đ</small>`;
  document.querySelector(".card-identity div strong").textContent = `UID: ${student.cardUid}`;
  document.getElementById("payment-reference").textContent = `${student.studentId} NAP THE XE`;
  document.getElementById("ride-count").textContent = `LƯỢT QUẸT: ${student.soLuotRaVao}`;

  const statusPill = document.querySelector(".status-pill");
  statusPill.replaceChildren(statusPill.querySelector("i"), document.createTextNode(` ${student.cardStatus}`));
  renderRideHistory(rideHistory);
}

function renderRideHistory(records) {
  const body = document.getElementById("ride-history-body");
  body.replaceChildren();
  records.forEach((record) => {
    const row = document.createElement("tr");
    const timeCell = document.createElement("td");
    const actionCell = document.createElement("td");
    const amountCell = document.createElement("td");
    const balanceCell = document.createElement("td");
    const actionLabel = document.createElement("strong");
    const actionDescription = document.createElement("small");

    timeCell.textContent = new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(record.timestamp));
    actionLabel.textContent = record.action;
    actionDescription.textContent = record.description;
    actionCell.append(actionLabel, actionDescription);
    amountCell.className = "history-amount";
    amountCell.textContent = formatMoney(record.amount);
    balanceCell.textContent = formatMoney(record.balanceAfter);
    row.append(timeCell, actionCell, amountCell, balanceCell);
    body.append(row);
  });
}

function showRideFeedback(message, isError = false) {
  const feedback = document.getElementById("ride-feedback");
  feedback.textContent = message;
  feedback.classList.toggle("is-error", isError);
  feedback.hidden = false;
}

function showToast() {
  const toast = document.getElementById("success-toast");
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4200);
}

async function restoreSession() {
  try {
    const data = await apiRequest("me");
    updateDashboard(data);
    showScreen("dashboard");
    if (data.student.mustChangePassword) promptForPasswordChange();
  } catch (error) {
    showScreen("access");
    if (error.status !== 401) {
      document.querySelector(".access-note").lastChild.textContent = ` ${error.message}`;
    }
  }
}

function promptForPasswordChange() {
  mustChangePassword = true;
  passwordError.hidden = true;
  passwordForm.reset();
  if (!passwordDialog.open) passwordDialog.showModal();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const studentId = studentIdInput.value.trim();
  const password = passwordInput.value;
  if (!studentId || !password) {
    loginError.textContent = "Vui lòng nhập MSSV và mật khẩu.";
    loginError.hidden = false;
    return;
  }

  const submitButton = loginForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  loginError.hidden = true;
  try {
    const result = await apiRequest("login", {
      method: "POST",
      body: { studentId, password, remember: document.getElementById("remember-login").checked },
    });
    passwordInput.value = "";
    const dashboard = await apiRequest("me");
    updateDashboard(dashboard);
    showScreen("dashboard");
    if (result.mustChangePassword) promptForPasswordChange();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  } finally {
    submitButton.disabled = false;
  }
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.getElementById("new-password").value;
  const confirmation = document.getElementById("confirm-password").value;
  if (password.length < 10) {
    passwordError.textContent = "Mật khẩu mới cần có ít nhất 10 ký tự.";
    passwordError.hidden = false;
    return;
  }
  if (password !== confirmation) {
    passwordError.textContent = "Hai mật khẩu chưa khớp. Vui lòng thử lại.";
    passwordError.hidden = false;
    return;
  }

  const submitButton = passwordForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  passwordError.hidden = true;
  try {
    await apiRequest("change-password", { method: "POST", body: { password } });
    mustChangePassword = false;
    passwordDialog.close();
    updateDashboard(await apiRequest("me"));
  } catch (error) {
    passwordError.textContent = error.message;
    passwordError.hidden = false;
  } finally {
    submitButton.disabled = false;
  }
});

passwordDialog.addEventListener("cancel", (event) => {
  if (mustChangePassword) event.preventDefault();
});
passwordDialog.addEventListener("click", (event) => {
  if (mustChangePassword && event.target === passwordDialog) event.preventDefault();
});

document.getElementById("logout-button").addEventListener("click", async () => {
  try {
    await apiRequest("logout", { method: "POST", body: {} });
  } finally {
    currentStudent = null;
    mustChangePassword = false;
    showScreen("access");
  }
});

document.getElementById("qr-access").addEventListener("click", openLogin);
document.getElementById("direct-access").addEventListener("click", openLogin);
document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.go));
});

document.getElementById("toggle-password").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const reveal = passwordInput.type === "password";
  passwordInput.type = reveal ? "text" : "password";
  button.textContent = reveal ? "Ẩn" : "Hiện";
  button.setAttribute("aria-label", reveal ? "Ẩn mật khẩu" : "Hiện mật khẩu");
});

async function simulateParkingAction(action) {
  try {
    await apiRequest("ride", { method: "POST", body: { action } });
    updateDashboard(await apiRequest("me"));
    showRideFeedback(`Đã quẹt thẻ ${action === "entry" ? "VÀO" : "RA"} bãi, trừ 500 đ.`);
  } catch (error) {
    if (error.status === 409) {
      const direction = action === "entry" ? "vào" : "ra";
      showRideFeedback(`Tài khoản không đủ số dư để ${direction} bãi!`, true);
      return;
    }
    showRideFeedback(error.message, true);
  }
}

document.getElementById("entry-button").addEventListener("click", () => simulateParkingAction("entry"));
document.getElementById("exit-button").addEventListener("click", () => simulateParkingAction("exit"));
document.getElementById("topup-button").addEventListener("click", () => showScreen("payment"));
document.getElementById("cancel-payment").addEventListener("click", () => showScreen("dashboard"));

// Giao dịch PayOS chưa được cấu hình; tuyệt đối không tự cộng tiền từ trình duyệt.
document.getElementById("simulate-payment").disabled = true;

restoreSession();