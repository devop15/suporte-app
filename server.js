const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Call } = require('./mongo');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/history', async (req, res) => {
    const history = await Call.find();
    res.json(history);
});

app.post('/api/history', async (req, res) => {
    const newCall = new Call(req.body);
    await newCall.save();
    io.emit('notification', { message: `Chamada de ${req.body.name} finalizada.` });
    res.status(201).json({ success: true });
});

io.on('connection', (socket) => {
    console.log('Novo cliente conectado');

    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));