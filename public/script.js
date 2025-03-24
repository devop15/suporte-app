const socket = io();
let startTime = null;
let timerInterval = null;
let historyData = [];

const username = new URLSearchParams(window.location.search).get("user") || localStorage.getItem("loggedInUser") || "user1";
document.getElementById("username").innerText = username;

// Notificações
function notify(msg) {
  const box = document.getElementById("notifications");
  const el = document.createElement("div");
  el.className = "notification";
  el.innerText = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// Timer
function updateTimer() {
  const now = new Date();
  const elapsed = new Date(now - startTime);
  const min = elapsed.getUTCMinutes().toString().padStart(2, "0");
  const sec = elapsed.getUTCSeconds().toString().padStart(2, "0");
  document.getElementById("timerDisplay").innerText = `Tempo: ${min}:${sec}`;
}

// Iniciar chamada
document.getElementById("startBtn").addEventListener("click", () => {
  const client = document.getElementById("clientName").value.trim() || "Sem cliente";
  startTime = new Date();
  timerInterval = setInterval(updateTimer, 1000);
  document.getElementById("startBtn").disabled = true;
  document.getElementById("endBtn").disabled = false;
  document.getElementById("statusDisplay").innerText = "Chamada em andamento...";
  socket.emit("startCall", { username, client, start: startTime });
  notify(`Chamada iniciada com ${client}`);
});

// Terminar chamada
document.getElementById("endBtn").addEventListener("click", () => {
  clearInterval(timerInterval);
  const endTime = new Date();
  const client = document.getElementById("clientName").value.trim() || "Sem cliente";
  document.getElementById("startBtn").disabled = false;
  document.getElementById("endBtn").disabled = true;
  document.getElementById("statusDisplay").innerText = "Nenhuma chamada ativa";
  document.getElementById("timerDisplay").innerText = "";
  socket.emit("endCall", { username, client, end: endTime });
  notify(`Chamada terminada com ${client}`);
});

// Online users
socket.on("updateOnlineUsers", (users) => {
  const list = document.getElementById("onlineList");
  list.innerHTML = "";
  users.forEach((u) => {
    const li = document.createElement("li");
    li.innerText = u;
    list.appendChild(li);
  });
});

// Histórico recebido
socket.on("updateHistory", (history) => {
  historyData = history;
  renderHistory();
  updateUserFilterOptions();
});

// Limpar histórico visual
document.getElementById("clearVisualHistory").addEventListener("click", () => {
  document.getElementById("historyList").innerHTML = "";
});

// Exportar CSV
document.getElementById("exportBtn").addEventListener("click", () => {
  let csv = "Utilizador,Cliente,Início,Fim\n";
  historyData.forEach(item => {
    const start = item.start ? new Date(item.start).toLocaleString() : "--";
    const end = item.end ? new Date(item.end).toLocaleString() : "--";
    const client = item.client || "Sem cliente";
    csv += `${item.username},${client},${start},${end}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "historico_chamadas.csv";
  a.click();
  URL.revokeObjectURL(url);
});

// Filtro por utilizador
document.getElementById("filterUser").addEventListener("change", renderHistory);

function renderHistory() {
  const userFilter = document.getElementById("filterUser").value;
  const list = document.getElementById("historyList");
  list.innerHTML = "";

  historyData
    .filter(item => !userFilter || item.username === userFilter)
    .forEach(item => {
      const start = item.start ? new Date(item.start).toLocaleTimeString() : "--";
      const end = item.end ? new Date(item.end).toLocaleTimeString() : "--";
      const client = item.client || "Sem cliente";
      const li = document.createElement("li");
      li.innerText = `${item.username} com ${client} - ${start} → ${end}`;
      list.appendChild(li);
    });
}

function updateUserFilterOptions() {
  const select = document.getElementById("filterUser");
  const uniqueUsers = [...new Set(historyData.map(h => h.username))];
  select.innerHTML = '<option value="">Todos</option>';
  uniqueUsers.forEach(user => {
    const opt = document.createElement("option");
    opt.value = user;
    opt.text = user;
    select.appendChild(opt);
  });
}

// Estado
document.getElementById("userStatus").addEventListener("change", (e) => {
  const status = e.target.value;
  const tag = document.getElementById("status-indicator");
  tag.innerText = status === "ocupado" ? "🔴 ocupado" : "🟢 disponível";
  socket.emit("updateStatus", { username, status });
});

// Tema escuro
const toggleThemeBtn = document.getElementById("toggleThemeBtn");
toggleThemeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-theme");
  const isDark = document.body.classList.contains("dark-theme");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  toggleThemeBtn.textContent = isDark ? "☀️" : "🌙";
});
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark-theme");
  toggleThemeBtn.textContent = "☀️";
}

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("loggedInUser");
  window.location.href = "login.html";
});

// Botão apagar histórico (Mongo)
document.getElementById("deleteHistory").addEventListener("click", () => {
  if (confirm("Tens a certeza que queres eliminar o histórico de chamadas?")) {
    fetch("/api/delete-history", { method: "DELETE" })
      .then(res => {
        if (res.ok) {
          historyData = [];
          renderHistory();
          notify("Histórico eliminado com sucesso.");
        }
      });
  }
});

// Botão recuperar histórico
document.getElementById("recoverHistory").addEventListener("click", () => {
  fetch("/api/load-history")
    .then(res => res.json())
    .then(data => {
      historyData = data;
      renderHistory();
      updateUserFilterOptions();
      notify("Histórico recuperado com sucesso.");
    });
});

// Iniciar app
socket.emit("join", username);