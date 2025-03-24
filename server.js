const express = require("express");
const http = require("http");
const path = require("path");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/suporte";
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schema atualizado
const callSchema = new mongoose.Schema({
  username: String,
  client: String,
  start: Date,
  end: Date,
});
const Call = mongoose.model("Call", callSchema);

// Estado dos utilizadores online
let onlineUsers = [];
const userStatusMap = {};

// Rota: login básico
app.post("/login", (req, res) => {
  const { username } = req.body;
  if (username) {
    res.status(200).json({ success: true });
  } else {
    res.status(400).json({ error: "Utilizador inválido" });
  }
});

// Rota: apagar histórico
app.delete("/api/delete-history", async (req, res) => {
  try {
    await Call.deleteMany({});
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao apagar histórico" });
  }
});

// Rota: recuperar histórico completo
app.get("/api/load-history", async (req, res) => {
  try {
    const history = await Call.find().sort({ end: -1 }).limit(100);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: "Erro ao recuperar histórico" });
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
    io.emit("updateOnlineUsers", onlineUsers);
    io.emit("notify", `${username} entrou na aplicação`);
  });

  socket.on("startCall", (data) => {
    socket.callStartTime = data.start || new Date();
    socket.callClient = data.client || "Sem cliente";
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
    const history = await Call.find().sort({ end: -1 }).limit(100);
    io.emit("updateHistory", history);
    io.emit("notify", `✅ ${data.username} terminou a chamada com ${callData.client}`);
  });

  socket.on("updateStatus", ({ username, status }) => {
    userStatusMap[username] = status;
    io.emit("notify", `${username} está agora ${status}`);
  });

  socket.on("disconnect", () => {
    if (currentUser) {
      onlineUsers = onlineUsers.filter(u => u !== currentUser);
      delete userStatusMap[currentUser];
      io.emit("updateOnlineUsers", onlineUsers);
      io.emit("notify", `${currentUser} saiu da aplicação`);
    }
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});