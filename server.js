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

// Modelos
const callSchema = new mongoose.Schema({
  username: String,
  start: Date,
  end: Date,
});
const Call = mongoose.model("Call", callSchema);

// Utilizadores online
let onlineUsers = [];

// Rotas básicas (opcional para autenticação futura)
app.post("/login", (req, res) => {
  const { username } = req.body;
  if (username) {
    res.status(200).json({ success: true });
  } else {
    res.status(400).json({ error: "Utilizador inválido" });
  }
});

// Socket.IO
io.on("connection", (socket) => {
  let currentUser = null;

  socket.on("join", (username) => {
    currentUser = username;
    if (!onlineUsers.includes(username)) {
      onlineUsers.push(username);
    }
    io.emit("updateOnlineUsers", onlineUsers);
  });

  socket.on("startCall", (data) => {
    socket.callStartTime = new Date();
  });

  socket.on("endCall", async (data) => {
    const callData = {
      username: data.username,
      start: socket.callStartTime,
      end: data.end,
    };
    await Call.create(callData);
    const history = await Call.find().sort({ end: -1 }).limit(10);
    io.emit("updateHistory", history);
  });

  socket.on("disconnect", () => {
    if (currentUser) {
      onlineUsers = onlineUsers.filter(u => u !== currentUser);
      io.emit("updateOnlineUsers", onlineUsers);
    }
  });
});

// Start do servidor
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});