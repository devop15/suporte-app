// --- Autenticação Simples ---
const users = [
  { username: "user1", password: "pass1" },
  { username: "user2", password: "pass2" },
];

// Verificar login
function checkAuth() {
  const user = localStorage.getItem("loggedInUser");
  if (!user && !window.location.href.includes("login.html")) {
    window.location.href = "login.html";
  } else {
    document.getElementById("userDisplay").innerText = user;
  }
}

// Logout
function logout() {
  localStorage.removeItem("loggedInUser");
  socket.emit("userDisconnected", localStorage.getItem("loggedInUser"));
  window.location.href = "login.html";
}
document.getElementById("logoutButton")?.addEventListener("click", logout);

// --- Tema claro/escuro ---
document.getElementById("themeToggle")?.addEventListener("click", () => {
  document.body.classList.toggle("dark-theme");
  const theme = document.body.classList.contains("dark-theme") ? "dark" : "light";
  localStorage.setItem("theme", theme);
});

const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") document.body.classList.add("dark-theme");

// --- WebSocket ---
const socket = io();
const onlineUsers = new Set();

// Emitir usuário online
socket.emit("userConnected", localStorage.getItem("loggedInUser"));

// Receber lista de online
socket.on("updateOnlineUsers", (users) => {
  const list = document.getElementById("onlineList");
  list.innerHTML = "";
  users.forEach((u) => {
    const li = document.createElement("li");
    li.textContent = u;
    list.appendChild(li);
  });
});

// --- Chamada ---
let callStart = null;
let timerInterval = null;

function startCall() {
  const name = document.getElementById("collaboratorName").value.trim();
  const tag = document.getElementById("callTag").value;

  if (name === "") {
    alert("Insira o nome do colaborador");
    return;
  }

  callStart = new Date();

  document.getElementById("startButton").disabled = true;
  document.getElementById("endButton").disabled = false;

  document.getElementById("statusDisplay").innerText = `Em chamada (${name} - ${tag})`;
  socket.emit("startCall", { name, tag, time: callStart.toLocaleTimeString() });

  startTimer();
}

function endCall() {
  if (!callStart) return;

  const name = document.getElementById("collaboratorName").value.trim();
  const tag = document.getElementById("callTag").value;
  const end = new Date();
  const duration = Math.floor((end - callStart) / 1000);

  const callData = {
    name,
    tag,
    start: callStart.toLocaleTimeString(),
    end: end.toLocaleTimeString(),
    duration,
    date: new Date().toISOString().split("T")[0],
    user: localStorage.getItem("loggedInUser")
  };

  fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(callData)
  });

  socket.emit("endCall");

  resetUI();
  stopTimer();
}

function resetUI() {
  callStart = null;
  document.getElementById("startButton").disabled = false;
  document.getElementById("endButton").disabled = true;
  document.getElementById("statusDisplay").innerText = "Estado atual: Nenhum";
  document.getElementById("collaboratorName").value = "";
  document.getElementById("callTag").value = "Geral";
  document.getElementById("callTimer").innerText = "";
}

// --- Timer ao vivo ---
function startTimer() {
  const timer = document.getElementById("callTimer");
  timerInterval = setInterval(() => {
    const now = new Date();
    const elapsed = Math.floor((now - callStart) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const secs = String(elapsed % 60).padStart(2, "0");
    timer.innerText = `⏱️ Tempo: ${mins}:${secs}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  document.getElementById("callTimer").innerText = "";
}

// --- Notificações de chamada ---
socket.on("startCall", (data) => {
  showNotification(`📞 ${data.name} iniciou chamada (${data.tag}) às ${data.time}`);
  document.getElementById("statusDisplay").innerText = `⚡ ${data.name} em chamada (${data.tag})`;
});

socket.on("endCall", () => {
  document.getElementById("statusDisplay").innerText = "Estado atual: Nenhum";
});

function showNotification(msg) {
  const div = document.createElement("div");
  div.className = "notification";
  div.innerText = msg;
  document.getElementById("notifications").appendChild(div);
  setTimeout(() => div.remove(), 5000);
}

// --- Histórico ---
async function loadHistory() {
  const res = await fetch("/api/history");
  const history = await res.json();
  renderHistory(history);
}

function renderHistory(data) {
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  data.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="details">
        <strong>${item.name}</strong> (${item.tag})
        <div>${item.start} → ${item.end}</div>
      </div>
      <span>${item.duration}s • ${item.date}</span>
    `;
    list.appendChild(li);
  });
}

async function applyFilters() {
  const name = document.getElementById("filterName").value.toLowerCase();
  const tag = document.getElementById("filterTag").value;
  const date = document.getElementById("filterDate").value;

  const res = await fetch("/api/history");
  let history = await res.json();

  if (name) {
    history = history.filter((h) => h.name.toLowerCase().includes(name));
  }
  if (tag) {
    history = history.filter((h) => h.tag === tag);
  }
  if (date) {
    history = history.filter((h) => h.date === date);
  }

  renderHistory(history);
}

// --- Exportar CSV ---
async function exportCSV() {
  const res = await fetch("/api/history");
  const history = await res.json();
  const csvRows = [
    ["Nome", "Tag", "Início", "Fim", "Duração (s)", "Data"]
  ];

  history.forEach((item) => {
    csvRows.push([item.name, item.tag, item.start, item.end, item.duration, item.date]);
  });

  const blob = new Blob([csvRows.map(e => e.join(",")).join("\n")], { type: 'text/csv' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "historico_chamadas.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// --- Histórico Pessoal ---
async function showPersonalHistory() {
  const user = localStorage.getItem("loggedInUser");
  const res = await fetch("/api/history");
  const history = await res.json();
  const filtered = history.filter(h => h.user === user);
  renderHistory(filtered);
}

// --- Inicialização ---
checkAuth();
loadHistory();