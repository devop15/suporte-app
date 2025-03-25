const express = require("express");
const http = require("http");
const path = require("path");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/suporte";
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schemas
const userSchema = new mongoose.Schema({
  username: String,
  passwordHash: String
});
const callSchema = new mongoose.Schema({
  username: String,
  client: String,
  start: Date,
  end: Date
});

const User = mongoose.model("User", userSchema);
const Call = mongoose.model("Call", callSchema);

// Estado
let onlineUsers = [];
let activeCalls = [];
const userStatusMap = {};

// Função para emitir utilizadores com estado
function emitOnlineUsersWithStatus() {
  const usersWithStatus = onlineUsers.map(username => {
    const isInCall = activeCalls.find(c => c.username === username);
    return {
      username,
      status: isInCall ? "em chamada" : (userStatusMap[username] || "disponível")
    };
  });

  io.emit("updateOnlineUsersStatus", usersWithStatus);
}

// ROTAS API

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("Dados inválidos");

  const exists = await User.findOne({ username });
  if (exists) return res.status(409).send("Utilizador já existe");

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ username, passwordHash });
  res.status(201).json({ success: true });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("Dados inválidos");

  const user = await User.findOne({ username });
  if (!user) return res.status(401).send("Utilizador não encontrado");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).send("Palavra-passe incorreta");

  res.status(200).json({ success: true });
});

app.delete("/api/delete-history", async (req, res) => {
  try {
    await Call.deleteMany({});
    res.status(200).json({ success: true });
  } catch {
    res.status(500).json({ error: "Erro ao apagar histórico" });
  }
});

app.get("/api/load-history", async (req, res) => {
  try {
    const history = await Call.find().sort({ end: -1 }).limit(100);
    res.json(history);
  } catch {
    res.status(500).json({ error: "Erro ao carregar histórico" });
  }
});

// WebSocket
io.on("connection", (socket) => {
  let currentUser = null;

  socket.on("join", (username) => {
    currentUser = username;
    if (!onlineUsers.includes(username)) {
      onlineUsers.push(username);
    }
    userStatusMap[username] = "disponível";
    emitOnlineUsersWithStatus();
    io.emit("updateActiveCalls", activeCalls);
    io.emit("notify", `${username} entrou na aplicação`);
  });

  socket.on("startCall", (data) => {
    socket.callStartTime = data.start || new Date();
    socket.callClient = data.client || "Sem cliente";
    activeCalls.push({ username: data.username, client: data.client });
    emitOnlineUsersWithStatus();
    io.emit("updateActiveCalls", activeCalls);
    io.emit("notify", `📞 ${data.username} iniciou uma chamada com ${data.client}`);
  });

  socket.on("endCall", async (data) => {
    const callData = {
      username: data.username,
      client: data.client || socket.callClient || "Sem cliente",
      start: socket.callStartTime || new Date(),
      end: data.end || new Date()
    };

    await Call.create(callData);
    activeCalls = activeCalls.filter(call => call.username !== data.username);

    const history = await Call.find().sort({ end: -1 }).limit(100);
    emitOnlineUsersWithStatus();
    io.emit("updateHistory", history);
    io.emit("updateActiveCalls", activeCalls);
    io.emit("notify", `✅ ${data.username} terminou a chamada com ${callData.client}`);
  });

  socket.on("updateStatus", ({ username, status }) => {
    userStatusMap[username] = status;
    emitOnlineUsersWithStatus();
    io.emit("notify", `${username} está agora ${status}`);
  });

  socket.on("chatMessage", (data) => {
    io.emit("chatMessage", {
      username: data.username,
      message: data.message,
    });
  });

  socket.on("disconnect", () => {
    if (currentUser) {
      onlineUsers = onlineUsers.filter(u => u !== currentUser);
      delete userStatusMap[currentUser];
      activeCalls = activeCalls.filter(call => call.username !== currentUser);
      emitOnlineUsersWithStatus();
      io.emit("updateActiveCalls", activeCalls);
      io.emit("notify", `${currentUser} saiu da aplicação`);
    }
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
