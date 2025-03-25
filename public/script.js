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

// Dark mode
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

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("loggedInUser");
  window.location.href = "login.html";
});

// Iniciar chamada
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

// Terminar chamada
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

// Atualizar estado
document.getElementById("userStatus").addEventListener("change", (e) => {
  const status = e.target.value;
  document.getElementById("status-indicator").innerText = `?? ${status}`;
  socket.emit("updateStatus", { username, status });
});

// Exportar CSV
document.getElementById("exportBtn").addEventListener("click", () => {
  if (!historyData.length) return alert("Sem dados para exportar");

  let csv = "Utilizador,Cliente,In赤cio,Fim\n";
  historyData.forEach(c => {
    const start = new Date(c.start).toLocaleString();
    const end = new Date(c.end).toLocaleString();
    csv += `${c.username},${c.client},${start},${end}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "historico_chamadas.csv";
  a.click();
});

// Apagar hist車rico (definitivo)
document.getElementById("deleteHistory").addEventListener("click", async () => {
  if (confirm("Apagar hist車rico permanentemente?")) {
    await fetch("/api/delete-history", { method: "DELETE" });
    historyData = [];
    renderHistory([]);
  }
});

// Recuperar hist車rico do servidor
document.getElementById("recoverHistory").addEventListener("click", async () => {
  const res = await fetch("/api/load-history");
  const data = await res.json();
  historyData = data;
  renderHistory(data);
});

// Limpar da tela (visual apenas)
document.getElementById("clearVisualHistory").addEventListener("click", () => {
  document.getElementById("historyList").innerHTML = "";
});

// Aplicar filtro de hist車rico
document.getElementById("applyFilterBtn").addEventListener("click", () => {
  const selectedUser = document.getElementById("filterUser").value;
  const filtered = selectedUser
    ? historyData.filter(item => item.username === selectedUser)
    : historyData;
  renderHistory(filtered);
});

// Renderizar hist車rico
function renderHistory(data) {
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  const usersSet = new Set();

  data.forEach(item => {
    const li = document.createElement("li");
    const start = item.start ? new Date(item.start).toLocaleString() : "Desconhecido";
    const end = item.end ? new Date(item.end).toLocaleString() : "Desconhecido";
    li.textContent = `${item.username} - ${item.client} ↙ ${start} ↙ ${end}`;
    list.appendChild(li);
    usersSet.add(item.username);
  });

  const filter = document.getElementById("filterUser");
  filter.innerHTML = '<option value="">Todos</option>';
  usersSet.forEach(u => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = u;
    filter.appendChild(opt);
  });
}

// Ativos em chamada
socket.on("updateActiveCalls", (calls) => {
  activeCalls = calls;
  const list = document.getElementById("activeCallsList");
  list.innerHTML = "";
  calls.forEach(call => {
    const li = document.createElement("li");
    li.textContent = `${call.username} com ${call.client}`;
    list.appendChild(li);
  });
});

// Online com estado
socket.on("updateOnlineUsersStatus", (users) => {
  const list = document.getElementById("onlineList");
  list.innerHTML = "";

  users.forEach(user => {
    const li = document.createElement("li");
    if (user.status === "em chamada") {
      li.innerHTML = `<span style="color: red;">?? ${user.username} (${user.status})</span>`;
    } else {
      li.innerHTML = `<span style="color: green;">?? ${user.username} (${user.status})</span>`;
    }
    list.appendChild(li);
  });
});

// Hist車rico
socket.on("updateHistory", (data) => {
  historyData = data;
  renderHistory(data);
});

// Notifica??es
socket.on("notify", (msg) => {
  const note = document.createElement("div");
  note.className = "notification";
  note.textContent = msg;
  const container = document.getElementById("notifications");
  container.appendChild(note);
  setTimeout(() => container.removeChild(note), 5000);
});

// Chat
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

if (chatForm) {
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (msg) {
      socket.emit("chatMessage", { username, message: msg });
      chatInput.value = "";
    }
  });

  socket.on("chatMessage", (data) => {
    const el = document.createElement("div");
    el.className = "chat-message";
    el.innerHTML = `<strong>${data.username}</strong>: ${data.message}`;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}