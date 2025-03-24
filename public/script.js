// Simulação de autenticação
const users = [
    { username: "user1", password: "pass1" },
    { username: "user2", password: "pass2" },
];

// Verificar autenticação
function checkAuth() {
    const loggedInUser = localStorage.getItem("loggedInUser");
    if (!loggedInUser && !window.location.href.includes("login.html")) {
        window.location.href = "login.html";
    }
}

// Login
document.getElementById("loginForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const user = users.find((u) => u.username === username && u.password === password);
    if (user) {
        localStorage.setItem("loggedInUser", username);
        window.location.href = "index.html";
    } else {
        alert("Nome de utilizador ou senha incorretos.");
    }
});

// Alternar tema
document.getElementById("themeToggle")?.addEventListener("click", () => {
    document.body.classList.toggle("dark-theme");
    const isDark = document.body.classList.contains("dark-theme");
    localStorage.setItem("theme", isDark ? "dark" : "light");
});

// Aplicar tema salvo
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
}

// Função de Logout
function logout() {
    localStorage.removeItem("loggedInUser");
    window.location.href = "login.html";
}

// Associar a função de logout ao botão
document.getElementById("logoutButton")?.addEventListener("click", logout);

// Exibir notificações
const socket = io();
socket.on('notification', (data) => {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerText = data.message;
    document.getElementById('notifications').appendChild(notification);

    // Remover a notificação após 5 segundos
    setTimeout(() => {
        notification.remove();
    }, 5000);
});

// Lógica das chamadas
let callStartTime = null;
let collaboratorName = '';

function startCall() {
    const nameInput = document.getElementById('collaboratorName').value.trim();
    if (nameInput === '') {
        alert('Por favor, insira o nome do colaborador.');
        return;
    }
    collaboratorName = nameInput;
    callStartTime = new Date();
    document.getElementById('startButton').disabled = true;
    document.getElementById('endButton').disabled = false;
    document.getElementById('statusDisplay').innerText = `Estado atual: Em Chamada (Iniciada às ${callStartTime.toLocaleTimeString()})`;
    document.getElementById('statusDisplay').classList.add('active');
    socket.emit('startCall', { collaboratorName });
}

function endCall() {
    if (!callStartTime) {
        alert('Nenhuma chamada foi iniciada.');
        return;
    }
    const callEndTime = new Date();
    const duration = Math.floor((callEndTime - callStartTime) / 1000);
    const historyList = document.getElementById('historyList');
    const historyItem = document.createElement('li');
    historyItem.innerHTML = `
        <div class="details">
            <strong>${collaboratorName}</strong>
            <span>Iniciada às ${callStartTime.toLocaleTimeString()}</span>
            <span>Finalizada às ${callEndTime.toLocaleTimeString()}</span>
        </div>
        <span>Duração: ${duration} segundos</span>
    `;
    historyList.appendChild(historyItem);

    // Resetar estado
    callStartTime = null;
    document.getElementById('startButton').disabled = false;
    document.getElementById('endButton').disabled = true;
    document.getElementById('statusDisplay').innerText = 'Estado atual: Nenhum';
    document.getElementById('statusDisplay').classList.remove('active');
    document.getElementById('collaboratorName').value = '';
    socket.emit('endCall');
}

// Verificar autenticação ao carregar a página
checkAuth();