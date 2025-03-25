const socket = io();

let startTime = null;
let timerInterval = null;
let historyData = [];
let activeCalls = [];

const username =
  new URLSearchParams(window.location.search).get("user") ||
  localStorage.getItem("loggedInUser") ||
  "user1";

document.getElementById("username").innerText = username;
socket.emit("join", username);

// ?? Tema escuro
const themeToggle = document.getElementById("toggleThemeBtn");
if (themeToggle) {
  themeToggle.onclick = () => {
    document.body.classList.toggle("dark-theme");
    localStorage.setItem("theme", document.body.classList.contains("dark-theme") ? "dark" : "light");
  };
}
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark-theme");
}

// ?? Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("loggedInUser");
  window.location.href = "login.html";
});

// ?? Navegação entre seções
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".section").forEach(sec => sec.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(btn.dataset.section).classList.add("active");
    btn.classList.add("active");
  });
});

// ?? Iniciar chamada
document.getElementById("startBtn").addEventListener("click", () => {
  const client = document.getElementById("clientName").value || "Sem cliente";
  startTime = new Date();
  document.getElementById("statusDisplay").innerText = `Em chamada com ${client}`;
  document.getElementById("startBtn").disabled = true;
  document.getElementById("endBtn").disabled = false;

  socket.emit("startCall", { username, client, start: startTime });

  timerInterval = setInterval(() => {
    const now = new Date();
    const diff = Math.floor((now - startTime) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    document.getElementById("timerDisplay").innerText = `${mins}m ${secs}s`;
  }, 1000);
});

// ? Terminar chamada
document.getElementById("endBtn").addEventListener("click", () => {
  const end = new Date();
  const client = document.getElementById("clientName").value || "Sem cliente";
  socket.emit("endCall", { username, client, start: startTime, end });

  clearInterval(timerInterval);
  document.getElementById("timerDisplay").innerText = "";
  document.getElementById("statusDisplay").innerText = "Nenhuma chamada ativa";
  document.getElementById("startBtn").disabled = false;
  document.getElementById("endBtn").disabled = true;
});

// ?? Atualizar estado do utilizador
document.getElementById("userStatus").addEventListener("change", (e) => {
  const status = e.target.value;
  const btn = document.getElementById("statusIndicatorBtn");
  btn.innerText = statusIcon(status) + " " + status;
  socket.emit("updateStatus", { username, status });
});

function statusIcon(status) {
  if (status === "em chamada") return "??";
  if (status === "ocupado") return "?";
  if (status === "ausente") return "??";
  return "??";
}

// ?? Histórico
document.getElementById("exportBtn").addEventListener("click", () => {
  if (!historyData.length) return alert("Sem dados para exportar");

  let csv = "Utilizador,Cliente,Início,Fim\n";
  historyData.forEach(c => {
    const start = new Date(c.start).toLocaleString("pt-PT");
    const end = new Date(c.end).toLocaleString("pt-PT");
    csv += `${c.username},${c.client},${start},${end}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "historico_chamadas.csv";
  a.click();
});

document.getElementById("deleteHistory").addEventListener("click", async () => {
  if (confirm("Apagar histórico permanentemente?")) {
    await fetch("/api/delete-history", { method: "DELETE" });
    historyData = [];
    renderHistory([]);
  }
});

document.getElementById("recoverHistory").addEventListener("click", async () => {
  const res = await fetch("/api/load-history");
  const data = await res.json();
  historyData = data;
  renderHistory(data);
});

document.getElementById("clearVisualHistory").addEventListener("click", () =>
