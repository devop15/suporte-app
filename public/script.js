const socket = io();
let startTime = null;
let timerInterval = null;

// Obter nome do utilizador da URL ou do localStorage
const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get("user") || localStorage.getItem("loggedInUser") || "user1";
document.getElementById("username").innerText = username;

// Função para atualizar o cronómetro
function updateTimer() {
  const now = new Date();
  const elapsed = new Date(now - startTime);
  const min = elapsed.getUTCMinutes().toString().padStart(2, "0");
  const sec = elapsed.getUTCSeconds().toString().padStart(2, "0");
  document.getElementById("timerDisplay").innerText = `Tempo: ${min}:${sec}`;
}

// Mostrar notificações animadas
function notify(message) {
  const container = document.getElementById("notifications");
  const el = document.createElement("div");
  el.className = "notification";
  el.innerText = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// Iniciar chamada
document.getElementById("startBtn").addEventListener("click", () => {
  startTime = new Date();
  timerInterval = setInterval(updateTimer, 1000);
  document.getElementById("startBtn").disabled = true;
  document.getElementById("endBtn").disabled = false;
  document.getElementById("statusDisplay").innerText = "Chamada em andamento...";
  socket.emit("startCall", { username, start: startTime });
  notify("Chamada iniciada!");
});

// Terminar chamada
document.getElementById("endBtn").addEventListener("click", () => {
  clearInterval(timerInterval);
  const endTime = new Date();
  document.getElementById("startBtn").disabled = false;
  document.getElementById("endBtn").disabled = true;
  document.getElementById("statusDisplay").innerText = "Nenhuma chamada ativa";
  document.getElementById("timerDisplay").innerText = "";
  socket.emit("endCall", { username, end: endTime });
  notify("Chamada terminada.");
});

// Atualizar histórico
socket.on("updateHistory", (history) => {
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  history.forEach((item) => {
    const li = document.createElement("li");
    const start = new Date(item.start).toLocaleTimeString();
    const end = new Date(item.end).toLocaleTimeString();
    li.innerText = `${item.username} - ${start} → ${end}`;
    list.appendChild(li);
  });
});

// Atualizar lista de utilizadores online
socket.on("updateOnlineUsers", (users) => {
  const list = document.getElementById("onlineList");
  list.innerHTML = "";
  users.forEach((u) => {
    const li = document.createElement("li");
    li.innerText = u;
    list.appendChild(li);
  });
});

// Avisos ao entrar ou sair
socket.emit("join", username);