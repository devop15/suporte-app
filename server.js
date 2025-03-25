const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const PORT = process.env.PORT || 10000;

// ✅ URI do MongoDB (trocar se necessário)
const MONGO_URI = "mongodb+srv://admin:admin123@cluster0.0tl6v.mongodb.net/suporteApp?retryWrites=true&w=majority";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Conexão MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB conectado"))
.catch((err) => console.error("❌ Erro MongoDB:", err));

// Schemas
const User = mongoose.model("User", new mongoose.Schema({
  username: String,
  password: String
}));

const Call = mongoose.model("Call", new mongoose.Schema({
  username: String,
  client: String,
  start: Date,
  end: Date
}));

// Estado atual
let onlineUsers = {};
let activeCalls = [];

// 🔐 API: Registo e Login
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  const exists = await User.findOne({ username });
  if (exists) return res.status(400).send("Utilizador já existe");
  await User.create({ username, password });
  res.status(201).send("Conta criada com sucesso");
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.status(401).send("Credenciais inválidas");
  res.send("Login efetuado com sucesso");
});

// 📁 Histórico
app.get("/api/load-history", async (req, res) => {
  const history = await Call.find().sort({ start: -1 });
  res.json(history);
});

app.delete("/api/delete-history", async (req, res) => {
  await Call.deleteMany({});
  io.emit("updateHistory", []);
  res.sendStatus(204);
});

// 🔌 WebSocket + Chat
io.on("connection", (socket) => {
  let currentUser = null;

  socket.on("join", (username) => {
    currentUser = username;
    onlineUsers[username] = { socketId: socket.id, status: "disponível" };
    updateOnlineUsers();
  });

  socket.on("updateStatus", ({ username, status }) => {
    if (onlineUsers[username]) {
      onlineUsers[username].status = status;
      updateOnlineUsers();
    }
  });

  socket.on("startCall", ({ username, client, start }) => {
    activeCalls.push({ username, client, start });
    if (onlineUsers[username]) {
      onlineUsers[username].status = "em chamada";
      updateOnlineUsers();
    }
    io.emit("updateActiveCalls", activeCalls);
    notify(`${username} iniciou chamada com ${client}`);
  });

  socket.on("endCall", async ({ username, client, start, end }) => {
    activeCalls = activeCalls.filter(c => !(c.username === username && c.client === client));
    if (onlineUsers[username]) {
      onlineUsers[username].status = "disponível";
      updateOnlineUsers();
    }
    io.emit("updateActiveCalls", activeCalls);
    await Call.create({ username, client, start, end });
    const history = await Call.find().sort({ start: -1 });
    io.emit("updateHistory", history);
    notify(`${username} terminou chamada com ${client}`);
  });

  socket.on("chatMessage", (msg) => {
    io.emit("chatMessage", msg);
  });

  socket.on("disconnect", () => {
    if (currentUser) {
      delete onlineUsers[currentUser];
      updateOnlineUsers();
    }
  });

  function updateOnlineUsers() {
    const list = Object.keys(onlineUsers).map((username) => ({
      username,
      status: onlineUsers[username].status
    }));
    io.emit("updateOnlineUsersStatus", list);
  }

  function notify(message) {
    io.emit("notify", message);
  }
});

// 🟢 Iniciar servidor
http.listen(PORT, () => {
  console.log(`🚀 Servidor online: http://localhost:${PORT}`);
});
