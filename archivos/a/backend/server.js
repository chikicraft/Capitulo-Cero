import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import registerSocketHandlers from './socket.js';

const app = express();
app.use(cors({
  origin: "https://chikicraft.github.io"
}));


// Salud de servidor
app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Realtime chat server running' });
});

const server = http.createServer(app);

// Configurar Socket.IO con CORS abierto (ajusta dominios en producción)
const io = new Server(server, {
  cors: {
    origin: 'https://chikicraft.github.io',
    methods: ['GET', 'POST']
  }
});

// Registrar manejadores de sockets
registerSocketHandlers(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
