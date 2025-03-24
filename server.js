const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

require('dotenv').config();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/suporte', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Mongoose Schema
const CallSchema = new mongoose.Schema({
  name: String,
  tag: String,
  start: String,
  end: String,
  duration: Number,
  date: String,
  user: String
});
const Call = mongoose.model('Call', CallSchema);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// REST API
app.get('/api/history', async (req, res) => {
  const history = await Call.find().sort({ date: -1 });
  res.json(history);
});

app.post('/api/history', async (req, res) => {
  const newCall = new Call(req.body);
  await newCall.save();
  io.emit('notification', { message: `📞 ${req.body.name} finalizou uma chamada.` });
  res.status(201).json({ success: true });
});

// Online users tracking
const onlineUsers = new Set();

io.on('connection', (socket) => {
  socket.on('userConnected', (username) => {
    onlineUsers.add(username);
    io.emit('updateOnlineUsers', Array.from(onlineUsers));
  });

  socket.on('userDisconnected', (username) => {
    onlineUsers.delete(username);
    io.emit('updateOnlineUsers', Array.from(onlineUsers));
  });

  socket.on('disconnect', () => {
    // Desconexão anônima — opcionalmente podemos limpar algo
  });

  socket.on('startCall', (data) => {
    io.emit('startCall', data);
  });

  socket.on('endCall', () => {
    io.emit('endCall');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});