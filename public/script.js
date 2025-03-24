const socket = io();
let startTime = null;
let timerInterval = null;
let historyData = [];

const username = new URLSearchParams(window.location.search).get("user") || localStorage.getItem("loggedInUser") || "user1";
document.getElementById("username").innerText = username;
document.getElementById("filterUser").value = "";

// Notificações flutuantes
function notify(msg) {
  const box = document.getElementById("notifications");
  const el = document.createElement("div");
  el.className = "notification";
  el.innerText = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// Atualiza timer em tempo real
function updateTimer() {
  const now = new Date();
  const elapsed = new Date(now - startTime);
  const min = elapsed.getUTCMinutes().toString().padStart(2, "0");
  const sec = elapsed.getUTCSeconds().toString().padStart(2, "0");
  document.getElementById("timerDisplay").innerText = `Tempo: ${min}:${sec}`;
}

// Início da chamada
document.getElementById("startBtn").addEventListener("click", () => {
  startTime = new Date();
  timerInterval = setInterval(updateTimer, 1000);
  document.getElementById("startBtn").disabled = true;
  document.getElementById("endBtn").disabled = false;
  document.getElementById("statusDisplay").innerText = "Chamada em andamento...";
  socket.emit("startCall", { username, start: startTime });
  notify("Chamada iniciada por " + username);
});

// Fim da chamada
document.getElementById("endBtn").addEventListener("click", () => {
  clearInterval(timerInterval);
  const endTime = new Date();
  document.getElementById("startBtn").disabled = false;
  document.getElementById("endBtn").disabled = true;
  document.getElementById("statusDisplay").innerText = "Nenhuma chamada ativa";
  document.getElementById("timerDisplay").innerText = "";
  socket.emit("endCall", { username, end: endTime });
  notify("Chamada terminada por " + username);
});

// Lista de utilizadores online
socket.on("updateOnlineUsers", (users) => {
  const list = document.getElementById("onlineList");
  list.innerHTML = "";
  users.forEach((u) => {
    const li = document.createElement("li");
    li.innerText = u;
    list.appendChild(li);
  });
});

// Histórico de chamadas
socket.on("updateHistory", (history) => {
  historyData = history;
  renderHistory();
  updateChart();
  updateUserFilterOptions();
});

// Mostrar histórico filtrado
function renderHistory() {
  const userFilter = document.getElementById("filterUser").value;
  const list = document.getElementById("historyList");
  list.innerHTML = "";

  historyData
    .filter(item => !userFilter || item.username === userFilter)
    .forEach(item => {
      const li = document.createElement("li");
      const start = new Date(item.start).toLocaleTimeString();
      const end = new Date(item.end).toLocaleTimeString();
      li.innerText = `${item.username} - ${start} → ${end}`;
      list.appendChild(li);
    });
}

// Exportar CSV
document.getElementById("exportBtn").addEventListener("click", () => {
  let csv = "Utilizador,Início,Fim\\n";
  historyData.forEach(item => {
    const start = new Date(item.start).toLocaleString();
    const end = new Date(item.end).toLocaleString();
    csv += `${item.username},${start},${end}\\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "historico_chamadas.csv";
  a.click();
  URL.revokeObjectURL(url);
});

// Atualizar opções do filtro de utilizadores
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

document.getElementById("filterUser").addEventListener("change", renderHistory);

// Atualizar estado de presença
document.getElementById("userStatus").addEventListener("change", (e) => {
  const status = e.target.value;
  const tag = document.getElementById("status-indicator");
  tag.innerText = status === "ocupado" ? "🔴 ocupado" : "🟢 disponível";
  socket.emit("updateStatus", { username, status });
});

// Tema escuro alternável
const toggleThemeBtn = document.getElementById("toggleThemeBtn");
toggleThemeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-theme");
  const isDark = document.body.classList.contains("dark-theme");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  toggleThemeBtn.textContent = isDark ? "☀️" : "🌙";
});

// Aplicar tema guardado
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.body.classList.add("dark-theme");
  toggleThemeBtn.textContent = "☀️";
}

// Gráfico com Chart.js
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
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// Entrar na app
socket.emit("join", username);