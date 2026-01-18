// Manejadores de eventos Socket.IO
// Eventos: join, message, private-message, user-connected, user-disconnected

const usersBySocket = new Map();      // socket.id -> { username }
const socketsByUser = new Map();      // username -> socket.id
const connectedUsers = new Set();     // usernames conectados
const messages = []; // historial del chat general

export default function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    // join: registro simple de usuario
    socket.on('join', (username, ack) => {
      if (!username || typeof username !== 'string') {
        ack?.({
            ok: true,
            users: Array.from(connectedUsers),
            messages // 🔹 historial completo
          });
        return;
      }

      // Si el usuario ya estaba conectado en otra pestaña, reemplazamos su socket
      const prevSocketId = socketsByUser.get(username);
      if (prevSocketId && prevSocketId !== socket.id) {
        const prevSocket = io.sockets.sockets.get(prevSocketId);
        prevSocket?.disconnect(true);
      }

      usersBySocket.set(socket.id, { username });
      socketsByUser.set(username, socket.id);
      connectedUsers.add(username);

      // Notificar a todos
      io.emit('user-connected', { username, users: Array.from(connectedUsers) });

      // Confirmar al cliente
      ack?.({
        ok: true,
        users: Array.from(connectedUsers),
        messages
      });
    });

    // message: chat general
    socket.on('message', (payload) => {
      const user = usersBySocket.get(socket.id);
      if (!user) return;

      const msgText = sanitizeMessage(payload?.text);
      if (!msgText) return;

      const message = {
        from: user.username,
        text: msgText,
        at: new Date().toISOString(),
        scope: 'general'
      };

      // 🔹 GUARDAR MENSAJE EN EL HISTORIAL
      messages.push(message);

      // (opcional) limitar historial
      if (messages.length > 100) messages.shift();

      // 🔹 ENVIAR A TODOS
      io.emit('message', message);
    });

    // private-message: chat privado
    socket.on('private-message', ({ to, text }) => {
      const fromUser = usersBySocket.get(socket.id);
      if (!fromUser || !to) return;

      const msg = sanitizeMessage(text);
      if (!msg) return;

      const toSocketId = socketsByUser.get(to);
      const timestamp = new Date().toISOString();

      // Enviar al destinatario si está conectado
      if (toSocketId) {
        io.to(toSocketId).emit('private-message', {
          from: fromUser.username,
          to,
          text: msg,
          at: timestamp
        });
      }

      // Eco al emisor para mostrar el mensaje en su hilo privado
      socket.emit('private-message', {
        from: fromUser.username,
        to,
        text: msg,
        at: timestamp
      });
    });

    // Desconexión
    socket.on('disconnect', () => {
      const user = usersBySocket.get(socket.id);
      if (!user) return;

      usersBySocket.delete(socket.id);
      socketsByUser.delete(user.username);
      connectedUsers.delete(user.username);

      io.emit('user-disconnected', {
        username: user.username,
        users: Array.from(connectedUsers)
      });
    });
  });
}

// Limpieza básica del contenido
function sanitizeMessage(text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';
  // Evitar mensajes excesivamente largos
  return trimmed.slice(0, 2000);
}
