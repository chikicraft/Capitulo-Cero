// Configura la URL pública del backend (Render.com)
// Ejemplo: const BACKEND_URL = 'https://tu-backend.onrender.com';
const BACKEND_URL = 'https://capitulo-cero-backend.onrender.com';
let socket;

socket = io(BACKEND_URL);

let username = null;
let activeChat = { type: 'general', with: null }; // {type: 'general'|'private', with: 'username'}

const loginModal = document.getElementById('loginModal');
const usernameInput = document.getElementById('usernameInput');
const joinBtn = document.getElementById('joinBtn');

const generalBtn = document.getElementById('generalBtn');
const usersList = document.getElementById('usersList');

const chatTitle = document.getElementById('chatTitle');
const messagesEl = document.getElementById('messages');

const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

// Estado local de usuarios
let connectedUsers = [];

// --- Registro simple ---
joinBtn.addEventListener('click', joinChat);
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinChat();
});

function joinChat() {
  const name = (usernameInput.value || '').trim();
  if (!name) return alert('Ingresa un nombre válido');
  username = name;

  socket = io(BACKEND_URL, { transports: ['websocket'] });

  socket.on('connect', () => {
    socket.emit('join', username, (res) => {
      if (!res?.ok) {
        alert(res?.error || 'No se pudo entrar');
        return;
      }

      connectedUsers = res.users || [];
      renderUsers();

      // 🔹 MOSTRAR MENSAJES GUARDADOS
      if (Array.isArray(res.messages)) {
        res.messages.forEach(msg => {
          renderMessage(msg);
        });
      }

      loginModal.style.display = 'none';
      setActiveChat('general');
      systemMessage(`Te has conectado como ${username}`);
    });
  });


  // Eventos del servidor
  socket.on('user-connected', ({ username: u, users }) => {
    connectedUsers = users || connectedUsers;
    renderUsers();
    systemMessage(`${u} se ha conectado`);
  });

  socket.on('user-disconnected', ({ username: u, users }) => {
    connectedUsers = users || connectedUsers;
    renderUsers();
    systemMessage(`${u} se ha desconectado`);
  });

  socket.on('message', (msg) => {
    // Solo mostrar mensajes del chat general si está activo
    if (activeChat.type === 'general') addMessage(msg);
  });

  socket.on('private-message', (msg) => {
    // Mostrar si el hilo privado corresponde al usuario
    const isForThisThread =
      (activeChat.type === 'private') &&
      (msg.from === activeChat.with || msg.to === activeChat.with);

    if (isForThisThread) addMessage(msg);
    // Opcional: notificación si llega privado y no estás en ese hilo
    else systemMessage(`Mensaje privado de ${msg.from}`);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket error:', err.message);
    systemMessage('Error de conexión con el servidor');
  });
}

// --- UI: cambiar chat activo ---
generalBtn.addEventListener('click', () => setActiveChat('general'));

function setActiveChat(type, withUser = null) {
  activeChat = { type, with: withUser };
  chatTitle.textContent = type === 'general' ? 'Chat general' : `Chat con ${withUser}`;
  document.querySelectorAll('.chat-tab').forEach(el => el.classList.remove('active'));
  if (type === 'general') generalBtn.classList.add('active');

  // Limpiar mensajes al cambiar de hilo (opcional)
  messagesEl.innerHTML = '';
}

function renderUsers() {
  usersList.innerHTML = '';
  connectedUsers
    .filter(u => u !== username) // no mostrarte a ti mismo
    .forEach(u => {
      const li = document.createElement('li');
      li.className = 'user-item';
      li.innerHTML = `
        <span class="user-name">${u}</span>
        <span class="user-status online">●</span>
      `;
      li.addEventListener('click', () => {
        setActiveChat('private', u);
      });
      usersList.appendChild(li);
    });
}

// --- Envío de mensajes ---
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const text = (messageInput.value || '').trim();
  if (!text || !socket || !username) return;

  if (activeChat.type === 'general') {
    socket.emit('message', { text });
  } else {
    socket.emit('private-message', { to: activeChat.with, text });
  }

  messageInput.value = '';
}

// --- Render de mensajes ---
function addMessage({ from, text, at, scope, to }) {
  const isMe = from === username;
  const time = formatTime(at);

  const wrapper = document.createElement('div');
  wrapper.className = `message ${isMe ? 'me' : ''}`;

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `
    <span>${from}</span>
    <span>${time}</span>
  `;

  const content = document.createElement('div');
  content.className = 'text';
  content.textContent = text;

  wrapper.appendChild(meta);
  wrapper.appendChild(content);
  messagesEl.appendChild(wrapper);

  // Scroll automático al último mensaje
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function systemMessage(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message';
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<span>Sistema</span><span>${formatTime(new Date().toISOString())}</span>`;
  const content = document.createElement('div');
  content.className = 'text';
  content.textContent = text;
  wrapper.appendChild(meta);
  wrapper.appendChild(content);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

// --- UX móvil: abrir/cerrar sidebar ---
const topbar = document.querySelector('.topbar');
const sidebar = document.querySelector('.sidebar');
topbar?.addEventListener('click', () => {
  if (window.innerWidth <= 900) {
    sidebar.classList.toggle('open');
  }
});
