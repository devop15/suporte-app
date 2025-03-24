const socket = io();
let startTime = null;
let timerInterval = null;
let historyData = [];

const username = new URLSearchParams(window.location.search).get("user") || localStorage.getItem("loggedInUser") || "user1";
document.getElementById("username").innerText = username;

// ⚡ Notificações visuais
function notify(msg) {
  const box = document.getElementById("notifications");
  const el = document.createElement("div");
  el.className = "notification";
  el.innerText = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ⏱️ Atualização do timer
function updateTimer() {
  const now = new Date();
  const elapsed = new Date(now - startTime);
  const min = elapsed.getUTCMinutes().toString().padStart(2, "0");
  const sec = elapsed.getUTCSeconds().toString().padStart(2, "0");
  document.getElementById("timerDisplay").innerText = `Tempo: ${min}:${sec}`;
}

// ▶️ Início da chamada
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

// ⏹️ Fim da chamada
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

// 👥 Utilizadores online
socket.on("updateOnlineUsers", (users) => {
  const list = document.getElementById("onlineList");
  list.innerHTML = "";
  users.forEach((u) => {
    const li = document.createElement("li");
    li.innerText = u;
    list.appendChild(li);
  });
});

// 📜 Histórico
socket.on("updateHistory", (history) => {
  historyData = history;
  renderHistory();
  updateChart();
  updateUserFilterOptions();
});

// 🧹 Limpar histórico da tela
document.getElementById("clearVisualHistory").addEventListener("click", () => {
  document.getElementById("historyList").innerHTML = "";
});

// 🧾 Exportar CSV
document.getElementById("exportBtn").addEventListener("click", () => {
  let csv = "Utilizador,Cliente,Início,Fim\\n";
  historyData.forEach(item => {
    const start = item.start ? new Date(item.start).toLocaleString() : "Sem início";
    const end = item.end ? new Date(item.end).toLocaleString() : "Sem fim";
    const client = item.client || "Sem cliente";
    csv += `${item.username},${client},${start},${end}\\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "historico_chamadas.csv";
  a.click();
  URL.revokeObjectURL(url);
});

// 🔎 Filtro por utilizador
document.getElementById("filterUser").addEventListener("change", renderHistory);

function renderHistory() {
  const userFilter = document.getElementById("filterUser").value;
  const list = document.getElementById("historyList");
  list.innerHTML = "";

  historyData
    .filter(item => !userFilter || item.username === userFilter)
    .forEach(item => {
      const start = item.start ? new Date(item.start).toLocaleTimeString() : "Sem início";
      const end = item.end ? new Date(item.end).toLocaleTimeString() : "Sem fim";
      const client = item.client || "Sem cliente";
      const li = document.createElement("li");
      li.innerText = `${item.username} com ${client} - ${start} → ${end}`;
      list.appendChild(li);
    });
}

// 📋 Atualizar utilizadores no filtro
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

// 🎚️ Status de utilizador
document.getElementById("userStatus").addEventListener("change", (e) => {
  const status = e.target.value;
  const tag = document.getElementById("status-indicator");
  tag.innerText = status === "ocupado" ? "🔴 ocupado" : "🟢 disponível";
  socket.emit("updateStatus", { username, status });
});

// 🌙 Tema escuro
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

// 📊 Gráfico com Chart.js
let chart;
function updateChart() {
  const ctx = document.getElementById("chartCanvas").getContext("2d");
  const dataMap = {};
  historyData.forEach(item => {
    const date = new Date(item.start).toLocaleDateString();
    dataMap[date] = (dataMap[date] || 0) + 1;
  });

  const labels = Object.keys(dataMap);
  const values = Object.values(dataMap);

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Chamadas por dia",
        data: values,
        backgroundColor: "#4f46e5"
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}

// 🚪 Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("loggedInUser");
  window.location.href = "login.html";
});

// 🚀 Inicializar
socket.emit("join", username);
