const express = require("express");
const http = require("http");
const path = require("path");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
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

// Schema atualizado para incluir o cliente
const callSchema = new mongoose.Schema({
  username: String,
  client: String,
  start: Date,
  end: Date,
});
const Call = mongoose.model("Call", callSchema);

// Utilizadores online + estado
let onlineUsers = [];
const userStatusMap = {}; // { Pedro Robalo: "disponível", user2: "ocupado" }

// Rota opcional de login
app.post("/login", (req, res) => {
  const { username } = req.body;
  if (username) {
    res.status(200).json({ success: true });
  } else {
    res.status(400).json({ error: "Utilizador inválido" });
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

// Start do servidor
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});