import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue, onChildAdded, push, serverTimestamp, onDisconnect } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyCmC_cXIvvA4EPAezjzsInBf_Ng-V4jwfk",
  authDomain: "hxchatt.firebaseapp.com",
  databaseURL: "https://hxchatt-default-rtdb.firebaseio.com",
  projectId: "hxchatt",
  storageBucket: "hxchatt.firebasestorage.app",
  messagingSenderId: "382150861330",
  appId: "1:382150861330:web:ab20a639246cd48bac6ecb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const PeerConnection = window.RTCPeerConnection;
const SessionDescription = window.RTCSessionDescription;
const IceCandidate = window.RTCIceCandidate;
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
// ============ STATE ============
const state = {
  activePage: 'home',
  sansClicks: 0,
  socksMode: false,
  rainbowMode: false,
  myKeyPair: null,
  peerPublicKey: null,
  roomId: null,
  userId: 'user_' + Math.random().toString(36).substr(2, 9),
  isHost: false,
  isMobile: isMobileDevice(),
  participants: 0,
  peerOnline: false,
  peerLeft: false,
  currentTheme: 'normal',
  gameState: {
    active: false,
    isHost: false,
    round: 1,
    myScore: 0,
    opponentScore: 0,
    myChoice: null,
    opponentChoice: null,
    timeLeft: 10,
    timer: null,
    waitingForAccept: false,
    waitingForChoice: false
  },
  callState: {
    active: false,
    isCaller: false,
    callTimer: null,
    timeElapsed: 0,
    localStream: null,
    remoteStream: null,
    pc: null
  }
};

// Умное определение мобильного устройства
function isMobileDevice() {
  // Основные критерии для мобильных устройств
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'phone', 'tablet'];
  
  // Проверяем User Agent на наличие мобильных ключевых слов
  const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
  
  // Проверяем сенсорные возможности
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Проверяем размер экрана (более консервативный порог)
  const isSmallScreen = window.innerWidth <= 768;
  
  // Проверяем соотношение сторон (портретная ориентация часто указывает на мобильное)
  const isPortrait = window.innerHeight >= window.innerWidth;
  
  // Логика определения мобильного устройства
  // Устройство считается мобильным если:
  // 1. User Agent указывает на мобильное устройство ИЛИ
  // 2. Есть сенсорный экран И маленький экран И портретная ориентация
  const isMobile = isMobileUA || (hasTouch && isSmallScreen && isPortrait);
  
  // Логируем для отладки
  console.log('📱 Mobile Detection:', {
    userAgent: isMobileUA,
    touch: hasTouch,
    smallScreen: isSmallScreen,
    portrait: isPortrait,
    final: isMobile
  });
  
  return isMobile;
}

// Mobile Detection and Responsive Behavior
function checkMobile() {
  state.isMobile = isMobileDevice();
  
  // Обновляем CSS класс для тела документа
  document.body.classList.toggle('mobile-device', state.isMobile);
  document.body.classList.toggle('desktop-device', !state.isMobile);
  
  // Логируем изменения
  console.log('🔄 checkMobile():', {
    isMobile: state.isMobile,
    width: window.innerWidth,
    height: window.innerHeight,
    deviceClass: state.isMobile ? 'mobile-device' : 'desktop-device'
  });
  
  if (state.isMobile && state.roomId) {
    // Auto-show room status indicator on mobile when in chat
    const indicator = document.getElementById('room-status-indicator');
    if (indicator) indicator.classList.add('show');
  } else {
    const indicator = document.getElementById('room-status-indicator');
    if (indicator) indicator.classList.remove('show');
  }
}

// Room Status Indicator Functions
function updateRoomStatus() {
  const indicator = document.getElementById('room-status-indicator');
  const statusBall = document.getElementById('room-status-ball');
  const roomName = document.getElementById('room-name');
  const participantsCount = document.getElementById('participants-count');
  
  if (!state.roomId) {
    indicator.classList.remove('show');
    return;
  }
  
  roomName.textContent = state.roomId;
  
  // Update status ball based on peer status
  statusBall.className = 'room-status-ball';
  if (state.peerLeft) {
    statusBall.classList.add('offline');
  } else if (state.peerOnline) {
    statusBall.classList.add('online');
  } else {
    statusBall.classList.add('offline');
  }
  
  // Update participants count
  const count = state.peerOnline ? 2 : (state.peerLeft ? 1 : 1);
  participantsCount.textContent = `${count} participant ${count !== 1 ? 's' : ''}`;
  
  // Show indicator on mobile
  if (state.isMobile) {
    indicator.classList.add('show');
  }
}

function showRoomStatus() {
  updateRoomStatus();
}

// Theme Toggle Functionality
const themeToggle = document.getElementById('theme-toggle');

function toggleTheme() {
  if (state.currentTheme === 'normal') {
    document.body.classList.add('hacker-theme');
    state.currentTheme = 'hacker';
    themeToggle.innerHTML = '🌸';
    showToast('Переключено на хакерскую тему! 🖤');
    localStorage.setItem('haxTheme', 'hacker');
  } else {
    document.body.classList.remove('hacker-theme');
    state.currentTheme = 'normal';
    themeToggle.innerHTML = '🎨';
    showToast('Переключено на обычную тему!');
    localStorage.setItem('haxTheme', 'normal');
  }
}

// Load saved theme
function loadTheme() {
  const savedTheme = localStorage.getItem('haxTheme');
  if (savedTheme === 'hacker') {
    document.body.classList.add('hacker-theme');
    state.currentTheme = 'hacker';
    themeToggle.innerHTML = '🌸';
  } else {
    state.currentTheme = 'normal';
    themeToggle.innerHTML = '🎨';
  }
}

themeToggle.addEventListener('click', toggleTheme);

// ============ PARTICLES ============
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const particles = [];
for(let i = 0; i < 50; i++) {
  particles.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    size: Math.random() * 2 + 1
  });
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    if(p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if(p.y < 0 || p.y > canvas.height) p.vy *= -1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  requestAnimationFrame(animateParticles);
}
animateParticles();

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // Принудительно обновляем определение мобильного устройства
  setTimeout(() => {
    checkMobile();
    console.log('📱 Mobile Detection (resize):', {
      width: window.innerWidth,
      height: window.innerHeight,
      isMobile: state.isMobile
    });
  }, 100);
});

// ============ NAVIGATION ============
const pages = document.querySelectorAll('.page');
const navButtons = document.querySelectorAll('#nav-menu button');
const menuBtn = document.getElementById('menu-btn');
const navMenu = document.getElementById('nav-menu');

function toggleMenu() {
  navMenu.classList.toggle('active');
  menuBtn.innerHTML = navMenu.classList.contains('active') ? '✖ Close' : '≡ Menu';
}

menuBtn.addEventListener('click', toggleMenu);

function showPage(pageId) {
  state.activePage = pageId;
  pages.forEach(p => p.classList.remove('active'));
  navButtons.forEach(b => {
    b.classList.remove('active');
    if(b.getAttribute('data-page') === pageId) b.classList.add('active');
  });
  const page = document.getElementById(pageId + '-page');
  if(page) page.classList.add('active');
}

navButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    showPage(e.target.getAttribute('data-page'));
    toggleMenu();
  });
});

// ============ VOICE MESSAGES ============
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

const voiceBtn = document.getElementById('voice-btn');

voiceBtn.addEventListener('click', async () => {
  if (!state.roomId || !state.peerPublicKey) {
    showToast('Сначала подключитесь к комнате!');
    return;
  }
  
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await sendVoiceMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      isRecording = true;
      voiceBtn.classList.add('recording');
      voiceBtn.textContent = '⏹️';
      showToast('🎤 Запись голосового сообщения...');
      
    } catch(err) {
      console.error('Ошибка доступа к микрофону:', err);
      showToast('Ошибка: нет доступа к микрофону');
    }
  } else {
    mediaRecorder.stop();
    isRecording = false;
    voiceBtn.classList.remove('recording');
    voiceBtn.textContent = '🎤';
  }
});

async function sendVoiceMessage(audioBlob) {
  try {
    showToast('⏳ Отправка голосового сообщения...');
    
    // Convert audio to base64
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    
    reader.onloadend = async () => {
      const base64Audio = reader.result; // data:audio/webm;base64,xxxxx
      
      // Send message with base64 audio
      const encrypted = encryptMessage(`[VOICE]:${base64Audio}`);
      
      const messageRef = push(ref(db, `rooms/${state.roomId}/messages`));
      await set(messageRef, {
        sender: state.userId,
        ciphertext: encrypted,
        type: 'voice',
        timestamp: serverTimestamp()
      });
      
      showToast('✅ Голосовое сообщение отправлено!');
    };
    
  } catch(err) {
    console.error('Ошибка отправки:', err);
    showToast('Ошибка отправки голосового сообщения');
  }
}

// ============ SANS EASTER EGG ============
const sansImg = document.getElementById('sans-image');
const sansCounter = document.getElementById('sans-counter');
const socksMsg = document.getElementById('socks-message');
const confettiContainer = document.getElementById('confetti-container');

sansImg.addEventListener('click', () => {
  if(state.activePage !== 'home') return;
  
  state.sansClicks++;
  sansCounter.textContent = state.sansClicks;
  sansCounter.classList.add('show');
  
  if(state.sansClicks === 3) {
    activateSansMegalovania();
  } else {
    createConfetti(20);
  }
});

function activateSansMegalovania() {
  state.rainbowMode = true;
  document.body.classList.add('rainbow-mode');
  socksMsg.innerHTML = '💀 YOU\'RE GONNA HAVE A BAD TIME 💀';
  socksMsg.classList.add('active');
  createConfetti(200);
  
  setTimeout(() => {
    socksMsg.classList.remove('active');
    showToast('...but nobody came.', 3000);
  }, 3000);
  
  setTimeout(() => {
    document.body.classList.remove('rainbow-mode');
    state.rainbowMode = false;
    state.sansClicks = 0;
    sansCounter.classList.remove('show');
  }, 10000);
}

function createConfetti(count) {
  const colors = ['#ff0000', '#ffff00', '#0000ff', '#ff5aab', '#00ff00'];
  for(let i = 0; i < count; i++) {
    const conf = document.createElement('div');
    conf.className = 'confetti';
    conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    conf.style.width = conf.style.height = Math.random() * 10 + 5 + 'px';
    conf.style.animationName = i % 2 === 0 ? 'fall-left' : 'fall-right';
    conf.style.animationDelay = Math.random() * 0.5 + 's';
    confettiContainer.appendChild(conf);
    conf.addEventListener('animationend', () => conf.remove());
  }
}

function activateSocksMode() {
  if(state.socksMode) return;
  state.socksMode = true;
  document.body.classList.add('socks-mode');
  socksMsg.innerHTML = '🧦 SOCKS MODE ACTIVATED! 🧦<br><small style="font-size:1.5rem;">now you\'re one of us... uwu</small>';
  socksMsg.classList.add('active');
  createConfetti(150);
  
  setTimeout(() => {
    socksMsg.classList.remove('active');
  }, 3000);
  
  showToast('Socks mode активирован! 🧦✨', 3000);
}

// ============ TOAST ============
const toastContainer = document.getElementById('toast-container');

function showToast(msg, ms = 2600) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  toastContainer.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, ms);
}

// ============ CRYPTO ============
function generateKeyPair() {
  const kp = nacl.box.keyPair();
  state.myKeyPair = { publicKey: kp.publicKey, secretKey: kp.secretKey };
  return nacl.util.encodeBase64(kp.publicKey);
}

async function sha256hex(u8) {
  if(!crypto.subtle) return 'N/A';
  try {
    const hash = await crypto.subtle.digest('SHA-256', u8);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  } catch(e) {
    return 'Error';
  }
}

function encryptMessage(text) {
  const nonce = nacl.randomBytes(24);
  const encoder = new TextEncoder();
  const msgU8 = encoder.encode(text);
  const box = nacl.box(msgU8, nonce, state.peerPublicKey, state.myKeyPair.secretKey);
  return nacl.util.encodeBase64(nonce) + ':' + nacl.util.encodeBase64(box);
}

function decryptMessage(ciphertext) {
  const parts = ciphertext.split(':');
  if(parts.length !== 2) throw new Error('Invalid format');
  
  const nonce = nacl.util.decodeBase64(parts[0]);
  const ct = nacl.util.decodeBase64(parts[1]);
  const msgU8 = nacl.box.open(ct, nonce, state.peerPublicKey, state.myKeyPair.secretKey);
  if(!msgU8) throw new Error('Decryption failed');
  
  const decoder = new TextDecoder();
  return decoder.decode(msgU8);
}

// ============ FIREBASE ROOM LOGIC ============
const chatStatus = document.getElementById('chat-status');
const chatMessages = document.getElementById('chat-messages');
const chatInputArea = document.getElementById('chat-input-area');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const roomSetup = document.getElementById('room-setup');
const roomCodeDisplay = document.getElementById('room-code-display');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const joinRoomInput = document.getElementById('join-room-input');
const typingIndicator = document.getElementById('typing-indicator');
const callBtn = document.getElementById('call-btn');

let typingTimeout = null;

// Typing indicator logic
chatInput.addEventListener('input', () => {
  if(!state.roomId) return;
  
  // Check for game command
  const text = chatInput.value.toLowerCase().trim();
  if (text === 'играть') {
    startGameInvitation();
    return; // Don't continue typing logic for game command
  }
  
  // Set typing status
  set(ref(db, `rooms/${state.roomId}/typing/${state.userId}`), true);
  
  // Clear after 2 seconds
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    set(ref(db, `rooms/${state.roomId}/typing/${state.userId}`), false);
  }, 2000);
});

function generateRoomCode() {
  return 'HAX-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ============ GAME SYSTEM ============

function startGameInvitation() {
  if (state.gameState.active) {
    showToast('Игра уже идёт!');
    return;
  }
  
  state.gameState.active = true;
  state.gameState.isHost = true;
  state.gameState.waitingForAccept = true;
  state.gameState.round = 1;
  state.gameState.myScore = 0;
  state.gameState.opponentScore = 0;
  
  // Send game invitation to Firebase
  set(ref(db, `rooms/${state.roomId}/game/invitation`), {
    from: state.userId,
    timestamp: Date.now()
  });
  
  showGameModal('Ожидание принятия игры...', 'accept');
  showToast('Приглашение отправлено! Ждём ответ... 🎮');
}

function showGameModal(statusText, mode = 'choices') {
  const modal = document.getElementById('game-modal');
  const status = document.getElementById('game-status');
  const choices = document.getElementById('game-choices');
  const acceptBtn = document.getElementById('accept-game-btn');
  const declineBtn = document.getElementById('decline-game-btn');
  const playAgainBtn = document.getElementById('play-again-btn');
  const timerBar = document.getElementById('timer-bar');
  const timerCount = document.getElementById('timer-count');
  
  status.textContent = statusText;
  modal.classList.add('active');
  
  // Reset all elements
  choices.style.display = 'none';
  acceptBtn.style.display = 'none';
  declineBtn.style.display = 'none';
  playAgainBtn.style.display = 'none';
  timerBar.style.width = '100%';
  
  if (mode === 'accept') {
    acceptBtn.style.display = 'inline-block';
    declineBtn.style.display = 'inline-block';
  } else if (mode === 'choices') {
    choices.style.display = 'flex';
  } else if (mode === 'result') {
    playAgainBtn.style.display = 'inline-block';
  }
}

function closeGameModal() {
  const modal = document.getElementById('game-modal');
  modal.classList.remove('active');
  
  // Clear timer
  if (state.gameState.timer) {
    clearInterval(state.gameState.timer);
  }
}

function makeChoice(choice) {
  if (!state.gameState.active || !state.gameState.waitingForChoice) {
    return;
  }
  
  state.gameState.myChoice = choice;
  state.gameState.waitingForChoice = false;
  
  // Disable choices
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = true;
  });
  
  // Send choice to Firebase
  set(ref(db, `rooms/${state.roomId}/game/choice/${state.userId}`), {
    choice: choice,
    timestamp: Date.now()
  });
  
  showToast(`Вы выбрали: ${getChoiceName(choice)} ✊`);
}

function getChoiceName(choice) {
  const names = {
    'rock': '🪨 Камень',
    'paper': '📄 Бумага',
    'scissors': '✂️ Ножницы'
  };
  return names[choice] || choice;
}

function determineWinner(choice1, choice2) {
  if (choice1 === choice2) return 'tie';
  
  const wins = {
    'rock': 'scissors',
    'scissors': 'paper',
    'paper': 'rock'
  };
  
  if (wins[choice1] === choice2) return 'player1';
  return 'player2';
}

function startTimer() {
  state.gameState.timeLeft = 10;
  const timerBar = document.getElementById('timer-bar');
  const timerCount = document.getElementById('timer-count');
  
  state.gameState.timer = setInterval(() => {
    state.gameState.timeLeft--;
    timerCount.textContent = state.gameState.timeLeft;
    timerBar.style.width = (state.gameState.timeLeft * 10) + '%';
    
    if (state.gameState.timeLeft <= 0) {
      clearInterval(state.gameState.timer);
      // Auto-choose random if time runs out
      const choices = ['rock', 'paper', 'scissors'];
      const randomChoice = choices[Math.floor(Math.random() * 3)];
      makeChoice(randomChoice);
    }
  }, 1000);
}

function updateGameUI() {
  document.getElementById('current-round').textContent = state.gameState.round;
  document.getElementById('my-score').textContent = `Ваш счёт: ${state.gameState.myScore}`;
  document.getElementById('opponent-score').textContent = `Счёт противника: ${state.gameState.opponentScore}`;
}

function handleGameInvitation(fromUser) {
  if (state.gameState.active) return; // Already in a game
  
  state.gameState.active = true;
  state.gameState.isHost = false;
  state.gameState.waitingForAccept = true;
  
  showGameModal(`${fromUser} приглашает вас сыграть в Камень-Ножницы-Бумага!`, 'accept');
  showToast('Получено приглашение в игру! 🎮');
}

function setupGameListeners() {
  if (!state.roomId) return;
  
  // Listen for game invitations
  onValue(ref(db, `rooms/${state.roomId}/game/invitation`), (snapshot) => {
    if (snapshot.exists() && !state.gameState.active) {
      const invitation = snapshot.val();
      if (invitation.from !== state.userId) {
        handleGameInvitation(invitation.from);
      }
    }
  });
  
  // Listen for game responses
  onValue(ref(db, `rooms/${state.roomId}/game/response`), (snapshot) => {
    if (snapshot.exists()) {
      const response = snapshot.val();
      if (response.from !== state.userId) {
        if (response.accepted) {
          startGame();
        } else {
          closeGameModal();
          state.gameState.active = false;
          showToast('Игра отклонена 😔');
        }
      }
    }
  });
  
  // Listen for game choices
  onValue(ref(db, `rooms/${state.roomId}/game/choice`), (snapshot) => {
    if (snapshot.exists()) {
      const choices = snapshot.val();
      const players = Object.keys(choices);
      
      if (players.length === 2) {
        // Both players have made their choices
        const player1Choice = choices[players[0]].choice;
        const player2Choice = choices[players[1]].choice;
        
        setTimeout(() => {
          processRoundResult(player1Choice, player2Choice);
        }, 1000); // Show choices for 1 second
      }
    }
  });
}

function acceptGame() {
  state.gameState.waitingForAccept = false;
  
  // Send acceptance response
  set(ref(db, `rooms/${state.roomId}/game/response`), {
    from: state.userId,
    accepted: true,
    timestamp: Date.now()
  });
  
  showToast('Игра принята! 🎉');
  startGame();
}

function declineGame() {
  // Send decline response
  set(ref(db, `rooms/${state.roomId}/game/response`), {
    from: state.userId,
    accepted: false,
    timestamp: Date.now()
  });
  
  closeGameModal();
  state.gameState.active = false;
}

function startGame() {
  state.gameState.round = 1;
  state.gameState.myScore = 0;
  state.gameState.opponentScore = 0;
  state.gameState.myChoice = null;
  state.gameState.opponentChoice = null;
  
  updateGameUI();
  showGameModal('Игра началась! Сделайте ваш выбор:', 'choices');
  
  // Enable choices and start timer
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = false;
  });
  
  state.gameState.waitingForChoice = true;
  startTimer();
}

function processRoundResult(choice1, choice2) {
  const player1Choice = state.gameState.isHost ? choice1 : choice2;
  const player2Choice = state.gameState.isHost ? choice2 : choice1;
  
  const winner = determineWinner(player1Choice, player2Choice);
  let resultText = '';
  
  if (winner === 'tie') {
    resultText = `Ничья! ${getChoiceName(player1Choice)} = ${getChoiceName(player2Choice)}`;
  } else if (winner === 'player1') {
    state.gameState.myScore++;
    resultText = `Вы выиграли раунд! ${getChoiceName(player1Choice)} побеждает ${getChoiceName(player2Choice)}`;
  } else {
    state.gameState.opponentScore++;
    resultText = `Вы проиграли раунд! ${getChoiceName(player2Choice)} побеждает ${getChoiceName(player1Choice)}`;
  }
  
  updateGameUI();
  showGameModal(resultText, 'result');
  
  // Clear choices for next round
  set(ref(db, `rooms/${state.roomId}/game/choice`), null);
  
  if (state.gameState.round >= 3) {
    // Game over
    setTimeout(() => {
      endGame();
    }, 2000);
  } else {
    // Next round
    setTimeout(() => {
      nextRound();
    }, 2000);
  }
}

function nextRound() {
  state.gameState.round++;
  state.gameState.myChoice = null;
  state.gameState.opponentChoice = null;
  
  updateGameUI();
  showGameModal(`Раунд ${state.gameState.round}! Сделайте ваш выбор:`, 'choices');
  
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = false;
  });
  
  state.gameState.waitingForChoice = true;
  startTimer();
}

function endGame() {
  let finalResult = '';
  
  if (state.gameState.myScore > state.gameState.opponentScore) {
    finalResult = `🎉 Поздравляем! Вы выиграли игру ${state.gameState.myScore}:${state.gameState.opponentScore}!`;
    createConfetti(100);
  } else if (state.gameState.myScore < state.gameState.opponentScore) {
    finalResult = `😔 Вы проиграли игру ${state.gameState.myScore}:${state.gameState.opponentScore}.`;
  } else {
    finalResult = `🤝 Ничья! ${state.gameState.myScore}:${state.gameState.opponentScore}`;
  }
  
  showGameModal(finalResult, 'result');
  showToast('Игра завершена!');
  
  // Clean up game state after some time
  setTimeout(() => {
    closeGameModal();
    state.gameState.active = false;
    set(ref(db, `rooms/${state.roomId}/game`), null);
  }, 5000);
}

function playAgain() {
  if (state.gameState.isHost) {
    // Host starts new game
    startGameInvitation();
  } else {
    // Guest sends new invitation
    startGameInvitation();
  }
}

// Add event listeners for game buttons
document.getElementById('accept-game-btn').addEventListener('click', acceptGame);
document.getElementById('decline-game-btn').addEventListener('click', declineGame);
document.getElementById('play-again-btn').addEventListener('click', playAgain);

createRoomBtn.addEventListener('click', async () => {
  try {
    const roomCode = generateRoomCode();
    state.roomId = roomCode;
    state.isHost = true;
    
    // Generate keys
    const pubKey = generateKeyPair();
    
    // Create room in Firebase
    const roomRef = ref(db, `rooms/${roomCode}`);
    await set(roomRef, {
      created: serverTimestamp(),
      host: {
        userId: state.userId,
        publicKey: pubKey,
        online: true
      },
      sessionStart: Date.now()
    });
    
    // Show room code
    roomCodeDisplay.textContent = roomCode;
    roomCodeDisplay.style.display = 'block';
    roomCodeDisplay.onclick = () => {
      navigator.clipboard.writeText(roomCode);
      showToast('Код скопирован! 📋');
      createConfetti(20);
    };
    
    chatStatus.textContent = '⏳ Ожидается собеседник...';
    showToast('Комната создана! Код: ' + roomCode);
    
    // Listen for guest
    onValue(ref(db, `rooms/${roomCode}/guest`), (snapshot) => {
      if(snapshot.exists()) {
        const guest = snapshot.val();
        state.peerPublicKey = nacl.util.decodeBase64(guest.publicKey);
        state.peerOnline = guest.online !== false;
        state.peerLeft = !guest.online;
        
        chatStatus.textContent = state.peerOnline ? '🟢 Подключено! Чат начат!' : '🔴 Собеседник офлайн';
        showToast('Собеседник подключился! 🎉');
        createConfetti(50);
        showRoomStatus();
        startChat();
        
        // Track guest online status
        onValue(ref(db, `rooms/${roomCode}/guest/online`), (onlineSnapshot) => {
          state.peerOnline = onlineSnapshot.val() !== false;
          state.peerLeft = !state.peerOnline;
          
          if (!state.peerOnline) {
            chatStatus.textContent = '🔴 Собеседник офлайн';
            showToast('Собеседник покинул чат', 4000);
            createConfetti(30);
          } else {
            chatStatus.textContent = '🟢 Подключено! Чат начат!';
          }
          showRoomStatus();
        });
      }
    });
    
  } catch(e) {
    console.error(e);
    showToast('Ошибка создания комнаты: ' + e.message);
  }
});

joinRoomBtn.addEventListener('click', async () => {
  const roomCode = joinRoomInput.value.trim().toUpperCase();
  if(!roomCode) {
    showToast('Введите код комнаты!');
    return;
  }
  
  try {
    state.roomId = roomCode;
    state.isHost = false;
    
    // Generate keys
    const pubKey = generateKeyPair();
    
    // Check if room exists
    const roomRef = ref(db, `rooms/${roomCode}`);
    onValue(roomRef, async (snapshot) => {
      if(!snapshot.exists()) {
        showToast('Комната не найдена!');
        return;
      }
      
      const room = snapshot.val();
      
      // Get host public key
      if(room.host && room.host.publicKey) {
        state.peerPublicKey = nacl.util.decodeBase64(room.host.publicKey);
        state.peerOnline = room.host.online !== false;
        state.peerLeft = !room.host.online;
        
        // Join as guest
        await set(ref(db, `rooms/${roomCode}/guest`), {
          userId: state.userId,
          publicKey: pubKey,
          online: true
        });
        
        chatStatus.textContent = state.peerOnline ? '🟢 Подключено! Чат начат!' : '🔴 Хост офлайн';
        showToast('Подключились к комнате! 🎉');
        createConfetti(50);
        showRoomStatus();
        startChat();
        
        // Track host online status
        onValue(ref(db, `rooms/${roomCode}/host/online`), (onlineSnapshot) => {
          state.peerOnline = onlineSnapshot.val() !== false;
          state.peerLeft = !state.peerOnline;
          
          if (!state.peerOnline) {
            chatStatus.textContent = '🔴 Хост офлайн';
            showToast('Хост покинул чат', 4000);
            createConfetti(30);
          } else {
            chatStatus.textContent = '🟢 Подключено! Чат начат!';
          }
          showRoomStatus();
        });
      }
    }, { onlyOnce: true });
    
  } catch(e) {
    console.error(e);
    showToast('Ошибка подключения: ' + e.message);
  }
});

function startChat() {
  roomSetup.style.display = 'none';
  chatMessages.style.display = 'flex';
  chatInputArea.style.display = 'flex';
  
  // Show room status indicator on mobile
  showRoomStatus();
  
  // Set up online status tracking
  setupOnlineStatusTracking();
  
  // Listen for typing indicator
  const typingRef = ref(db, `rooms/${state.roomId}/typing`);
  onValue(typingRef, (snapshot) => {
    if(snapshot.exists()) {
      const typing = snapshot.val();
      // Check if OTHER user is typing
      const otherUserTyping = Object.keys(typing).some(uid => 
        uid !== state.userId && typing[uid] === true
      );
      
      if(otherUserTyping) {
        typingIndicator.classList.add('show');
        chatMessages.scrollTop = chatMessages.scrollHeight;
      } else {
        typingIndicator.classList.remove('show');
      }
    }
  });
  
  // Listen for messages
  const messagesRef = ref(db, `rooms/${state.roomId}/messages`);
  onValue(messagesRef, (snapshot) => {
    // Clear messages but keep typing indicator
    const messages = chatMessages.querySelectorAll('.message');
    messages.forEach(m => m.remove());
    
    if(snapshot.exists()) {
      const messagesList = [];
      snapshot.forEach((child) => {
        messagesList.push({ id: child.key, ...child.val() });
      });
      
      messagesList.sort((a, b) => a.timestamp - b.timestamp);
      
      messagesList.forEach(msg => {
        // Skip messages from unknown senders (old session users)
        if (msg.sender !== state.userId && state.peerPublicKey) {
          try {
            const decrypted = decryptMessage(msg.ciphertext);
            
            // Check for socks mode
            if(decrypted.toLowerCase().includes('socks') || decrypted.toLowerCase().includes('носки')) {
              activateSocksMode();
            }
            
            // Check for game command (only from other user)
            if (msg.sender !== state.userId && decrypted.toLowerCase().includes('играть')) {
              handleGameInvitation(msg.sender);
            }
            
            displayMessage(decrypted, msg.sender === state.userId);
          } catch(e) {
            // Silently skip messages that can't be decrypted (from old sessions)
          }
        } else if (msg.sender === state.userId) {
          // Always show own messages
          try {
            const decrypted = decryptMessage(msg.ciphertext);
            displayMessage(decrypted, true);
          } catch(e) {
            // Silently skip
          }
        }
      });
    }
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
  
  // Listen for game events
  setupGameListeners();
  
  // Listen for call events
  setupCallListeners();
}

function setupOnlineStatusTracking() {
  if (!state.roomId) return;
  
  const userPath = state.isHost ? 'host' : 'guest';
  
  // Track my own online status
  onDisconnect(ref(db, `rooms/${state.roomId}/${userPath}/online`)).set(false);
  
  // Track peer online status
  const peerPath = state.isHost ? 'guest' : 'host';
  onValue(ref(db, `rooms/${state.roomId}/${peerPath}/online`), (snapshot) => {
    const isOnline = snapshot.val() !== false;
    state.peerOnline = isOnline;
    state.peerLeft = !isOnline;
    
    chatStatus.textContent = isOnline ? '🟢 Подключено! Чат начат!' : '🔴 Собеседник офлайн';
    showRoomStatus();
    
    if (!isOnline) {
      showToast('Собеседник покинул чат', 4000);
    }
  });
}

function displayMessage(text, isSent) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message ' + (isSent ? 'sent' : 'received');
  
  // Check if voice message
  if (text.startsWith('[VOICE]:')) {
    const base64Audio = text.substring(8); // data:audio/webm;base64,xxxxx
    const playerId = 'voice-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    // Create waveform bars (random heights for visual effect)
    const bars = Array.from({length: 25}, () => {
      const height = 8 + Math.random() * 20;
      return `<div class="voice-wave-bar" style="height: ${height}px;"></div>`;
    }).join('');
    
    msgDiv.innerHTML = `
      <div class="voice-player" data-player-id="${playerId}">
        <button class="voice-play-btn" data-action="play">▶️</button>
        <div class="voice-waveform">${bars}</div>
        <div class="voice-duration">0:00</div>
        <audio data-voice-audio="${playerId}">
          <source src="${base64Audio}" type="audio/webm">
        </audio>
      </div>
      <div class="message-time">${new Date().toLocaleTimeString()}</div>
    `;
    
    // Setup audio controls
    setTimeout(() => setupVoicePlayer(playerId), 0);
  } else {
    msgDiv.innerHTML = `
      <div>${text}</div>
      <div class="message-time">${new Date().toLocaleTimeString()}</div>
    `;
  }
  
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Setup custom voice player controls
function setupVoicePlayer(playerId) {
  const player = document.querySelector(`[data-player-id="${playerId}"]`);
  if (!player) return;
  
  const audio = player.querySelector(`[data-voice-audio="${playerId}"]`);
  const playBtn = player.querySelector('.voice-play-btn');
  const durationEl = player.querySelector('.voice-duration');
  const waveBars = player.querySelectorAll('.voice-wave-bar');
  
  let isPlaying = false;
  let animationFrame = null;
  
  // Format time (seconds to mm:ss)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Update waveform animation
  const updateWaveform = () => {
    if (!isPlaying || !audio.duration) return;
    
    const progress = audio.currentTime / audio.duration;
    const activeBarCount = Math.floor(waveBars.length * progress);
    
    waveBars.forEach((bar, index) => {
      if (index < activeBarCount) {
        bar.classList.add('active');
      } else {
        bar.classList.remove('active');
      }
    });
    
    if (isPlaying) {
      animationFrame = requestAnimationFrame(updateWaveform);
    }
  };
  
  // Play/Pause toggle
  playBtn.addEventListener('click', () => {
    if (isPlaying) {
      audio.pause();
      playBtn.textContent = '▶️';
      isPlaying = false;
      if (animationFrame) cancelAnimationFrame(animationFrame);
    } else {
      // Pause all other audio players
      document.querySelectorAll('[data-voice-audio]').forEach(otherAudio => {
        if (otherAudio !== audio && !otherAudio.paused) {
          otherAudio.pause();
          const otherPlayer = otherAudio.closest('.voice-player');
          if (otherPlayer) {
            otherPlayer.querySelector('.voice-play-btn').textContent = '▶️';
            otherPlayer.querySelectorAll('.voice-wave-bar').forEach(bar => bar.classList.remove('active'));
          }
        }
      });
      
      audio.play();
      playBtn.textContent = '⏸️';
      isPlaying = true;
      updateWaveform();
    }
  });
  
  // Update duration display
  audio.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(audio.duration);
  });
  
  audio.addEventListener('timeupdate', () => {
    durationEl.textContent = formatTime(audio.currentTime);
  });
  
  // Reset on end
  audio.addEventListener('ended', () => {
    playBtn.textContent = '▶️';
    isPlaying = false;
    waveBars.forEach(bar => bar.classList.remove('active'));
    durationEl.textContent = formatTime(audio.duration);
    if (animationFrame) cancelAnimationFrame(animationFrame);
  });
  
  // Prevent context menu (right-click download)
  audio.addEventListener('contextmenu', (e) => e.preventDefault());
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const text = chatInput.value.trim();
  if(!text) return;
  
  try {
    // Clear typing indicator immediately
    await set(ref(db, `rooms/${state.roomId}/typing/${state.userId}`), false);
    
    const encrypted = encryptMessage(text);
    
    const messageRef = push(ref(db, `rooms/${state.roomId}/messages`));
    await set(messageRef, {
      sender: state.userId,
      ciphertext: encrypted,
      timestamp: serverTimestamp()
    });
    
    chatInput.value = '';
  } catch(e) {
    console.error(e);
    showToast('Ошибка отправки: ' + e.message);
  }
}

// ============ CALL SYSTEM ============

callBtn.addEventListener('click', () => {
  if (!state.peerOnline) {
    showToast('Собеседник оффлайн!');
    return;
  }
  if (state.callState.active) {
    showToast('Звонок уже идёт!');
    return;
  }
  
  initiateCall();
});
async function createOffer() {
  if (!state.callState.pc) return;

  try {
    const offer = await state.callState.pc.createOffer();
    await state.callState.pc.setLocalDescription(offer);

    const roomCallData = {
      offer: {
        type: offer.type,
        sdp: offer.sdp
      },
      from: state.userId
    };

    await set(ref(db, `rooms/${state.roomId}/call`), roomCallData);
    console.log("Offer успешно отправлен в Firebase.");
  } catch (err) {
    console.error('Ошибка создания offer:', err);
  }
}
async function initiateCall() {
  // Проверяем, не идет ли уже звонок
  if (state.callState.active) {
    showToast('Звонок уже идёт!');
    return;
  }
  
  // 1. СРАЗУ показываем окно, чтобы пользователь видел отклик
  showCallModal('Звонок...', 'calling');
  console.log("Модальное окно звонка должно быть показано.");

  // 2. Устанавливаем состояние
  state.callState.active = true;
  state.callState.isCaller = true;
  
  try {
    // 3. Настраиваем WebRTC (включая запрос на микрофон)
    await setupCallPeerConnection();
    console.log("setupCallPeerConnection завершен.");

    // 4. Создаем Offer (предложение звонка)
    await createOffer();
    console.log("createOffer завершен.");

  } catch (error) {
    console.error("Ошибка при инициации звонка:", error);
    showToast('Ошибка звонка: ' + error.message);
    // Если что-то пошло не так, завершаем звонок
    endCall();
  }
}


function showCallModal(statusText, mode) {
  const modal = document.getElementById('call-modal');
  const status = document.getElementById('call-status');
  const timer = document.getElementById('call-timer');
  const buttons = document.getElementById('call-buttons');
  
  status.textContent = statusText;
  timer.textContent = '00:00';
  buttons.innerHTML = '';
  modal.classList.add('active');
  
  if (mode === 'incoming') {
    buttons.innerHTML = `
      <button class="call-btn accept" onclick="acceptCall()">✅</button>
      <button class="call-btn decline" onclick="declineCall()">❌</button>
    `;
  } else if (mode === 'ongoing' || mode === 'calling') {
    buttons.innerHTML = `
      <button class="call-btn end" onclick="endCall()">❌</button>
    `;
  }
  
  startCallTimer();
}

function startCallTimer() {
  state.callState.timeElapsed = 0;
  const timerEl = document.getElementById('call-timer');
  
  state.callState.callTimer = setInterval(() => {
    state.callState.timeElapsed++;
    const mins = Math.floor(state.callState.timeElapsed / 60).toString().padStart(2, '0');
    const secs = (state.callState.timeElapsed % 60).toString().padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
  }, 1000);
}

function closeCallModal() {
  const modal = document.getElementById('call-modal');
  modal.classList.remove('active');
  
  if (state.callState.callTimer) {
    clearInterval(state.callState.callTimer);
  }
}
function setupCallListeners() {
  const callRef = ref(db, `rooms/${state.roomId}/call`);

  // 1. Основной слушатель для Offer/Answer
  onValue(callRef, async (snapshot) => {
    if (!snapshot.exists()) {
      if (state.callState.active || state.callState.pc) {
        showToast('Звонок завершён');
        endCall();
      }
      return;
    }

    const callData = snapshot.val();

    // ПРИНИМАЮЩИЙ: Ловим Offer
    if (callData.offer && !state.callState.isCaller && !state.callState.pc) {
      showCallModal('Входящий звонок', 'incoming');
      await setupCallPeerConnection();
      await state.callState.pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
      await createAnswer();
    }
    
    // ЗВОНЯЩИЙ: Ловим Answer
    if (callData.answer && state.callState.isCaller && state.callState.pc && state.callState.pc.signalingState !== 'stable') {
      await state.callState.pc.setRemoteDescription(new RTCSessionDescription(callData.answer));
    }
  });

  // 2. ОТДЕЛЬНЫЙ слушатель для кандидатов (чтобы не терять их)
  const candidatesRef = ref(db, `rooms/${state.roomId}/call/candidates`);
  onChildAdded(candidatesRef, (snapshot) => {
    const candidate = snapshot.val();
    
    // Важно: ждем, пока pc создастся, если кандидат прилетел слишком быстро
    const checkAndAdd = setInterval(() => {
      const pc = state.callState.pc;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        if (candidate.from !== state.userId) {
          pc.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(e => console.warn("ICE error:", e));
        }
        clearInterval(checkAndAdd);
      }
    }, 500); // проверяем каждые полсекунды, готов ли пир
  });
}
function setupCallPeerConnection() {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  });
  state.callState.pc = pc;

  // Логи ICE и connection
  pc.oniceconnectionstatechange = () => {
    console.log('ICE connection:', pc.iceConnectionState);
  };

  pc.onconnectionstatechange = () => {
    console.log('Peer connection state:', pc.connectionState);
    if (pc.connectionState === 'connected') {
      showCallModal('Звонок в процессе', 'ongoing');
    }
    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
      endCall();
    }
  };

  // ontrack — один, слитый, с улучшенным play
  pc.ontrack = (event) => {
    console.log('ONTRACK finally сработал!', event.track.kind, event.track.muted);
    console.log('📡 Получен удаленный трек:', {
      kind: event.track.kind,
      enabled: event.track.enabled,
      muted: event.track.muted,
      readyState: event.track.readyState,
      id: event.track.id
    });

    if (!state.callState.remoteStream) {
      state.callState.remoteStream = new MediaStream();
    }
    state.callState.remoteStream.addTrack(event.track);

    let remoteAudio = document.getElementById('remoteAudio');
    if (!remoteAudio) {
      remoteAudio = document.createElement('audio');
      remoteAudio.id = 'remoteAudio';
      remoteAudio.autoplay = true;
      remoteAudio.style.display = 'none';
      document.body.appendChild(remoteAudio);
    }

    remoteAudio.srcObject = state.callState.remoteStream;

    // Пробуем играть сразу + ждём клик/тап если заблокировано
    const tryPlay = () => {
      remoteAudio.play()
        .then(() => console.log('🔊 Звук пошёл!'))
        .catch(e => console.warn('Автоплей заблокирован:', e));
    };
    tryPlay();
    document.addEventListener('click', tryPlay, { once: true });
    document.addEventListener('touchstart', tryPlay, { once: true });
    showToast('Нажми на экран, если звук не пошёл');
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const candidateRef = push(ref(db, `rooms/${state.roomId}/call/candidates`));
      set(candidateRef, { ...event.candidate.toJSON(), from: state.userId });
    }
  };

  // НЕ запрашиваем микрофон здесь автоматически!
  // Для звонящего (caller) — оставляем запрос здесь
  // Для принимающего (callee) — перенесём в acceptCall
  if (state.callState.isCaller) {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        state.callState.localStream = stream;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        console.log('✅ Локальный поток добавлен (caller)');
      })
      .catch(err => {
        console.error('Микрофон caller:', err);
        showToast('Нет микрофона у звонящего');
        endCall();
      });
  }
  // Для callee — микрофон запросим в acceptCall после клика "✅"
}
async function createAnswer() {
  if (!state.callState.pc) return;

  // Проверка трека (если getUserMedia провалилось раньше, не идем дальше)
  if (state.callState.pc.getSenders().length === 0) {
    console.error('Нет аудио-трека на callee');
    showToast('Нет микрофона');
    endCall();
    return;
  }

  try {
    const answer = await state.callState.pc.createAnswer();
    await state.callState.pc.setLocalDescription(answer);

    await set(ref(db, `rooms/${state.roomId}/call/answer`), {
      type: answer.type,
      sdp: answer.sdp
    });
    console.log("Answer успешно отправлен в Firebase.");
  } catch (err) {
    console.error('Ошибка создания answer:', err);
  }
}
window.acceptCall = function() {
  if (!state.callState.pc) {
    setupCallPeerConnection();
  }

  // Запрашиваем микрофон ОТ КЛИКА — браузер разрешит
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      state.callState.localStream = stream;
      stream.getTracks().forEach(track => state.callState.pc.addTrack(track, stream));
      console.log('✅ Локальный поток добавлен на callee (от клика ✅)');
    })
    .catch(err => {
      console.error('Микрофон на принимающей стороне:', err);
      showToast('Нет доступа к микрофону');
      endCall();
      return;
    });

  // Отправляем согласие
  set(ref(db, `rooms/${state.roomId}/call/response`), {
    from: state.userId,
    accepted: true,
    timestamp: Date.now()
  });

  showCallModal('Звонок в процессе', 'ongoing');
}

window.declineCall = function() {
  // Просто завершаем звонок. endCall сама всё почистит в Firebase.
  endCall();
}

window.endCall = function() {
  if (!state.callState.active && !state.callState.pc) return; // Если уже завершено, ничего не делаем

  console.log('Завершение звонка...');

  if (state.callState.pc) {
    state.callState.pc.close();
    state.callState.pc = null;
  }
  
  if (state.callState.localStream) {
    state.callState.localStream.getTracks().forEach(track => track.stop());
    state.callState.localStream = null;
  }
  
  if (state.callState.callTimer) {
    clearInterval(state.callState.callTimer);
  }
  
  state.callState.remoteStream = null;
  state.callState.active = false;
  state.callState.isCaller = false;
  
  closeCallModal();
  
  // ГЛАВНОЕ ИЗМЕНЕНИЕ: Просто удаляем всю ветку /call в Firebase.
  // Другой клиент увидит, что она пропала, и тоже завершит звонок.
  // Это самый надежный способ.
  set(ref(db, `rooms/${state.roomId}/call`), null);
}

// ============ MANUAL KEY GEN ============
document.getElementById('manual-gen').addEventListener('click', () => {
  const pubKey = generateKeyPair();
  document.getElementById('pub-key-display').value = pubKey;
  document.getElementById('key-info').style.display = 'block';
  sha256hex(state.myKeyPair.publicKey).then(fp => {
    document.getElementById('key-fp').textContent = fp.slice(0, 32);
  });
  showToast('Ключи перегенерированы! 🔑');
  createConfetti(30);
});

// ============ PWA и MOBILE ОПТИМИЗАЦИИ ============

// Регистрация Service Worker для PWA функциональности
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('✅ Service Worker зарегистрирован:', registration.scope);
      
      // Обновление Service Worker
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('🔄 Новая версия Service Worker загружается...');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('🚀 Новая версия приложения доступна!');
            showToast('🔄 Обновление готово! Перезагрузите страницу.', 5000);
          }
        });
      });
      
      // Прослушиваем сообщения от Service Worker
      navigator.serviceWorker.addEventListener('message', event => {
        console.log('📨 Сообщение от SW:', event.data);
      });
      
    } catch (error) {
      console.log('❌ Ошибка регистрации Service Worker:', error);
    }
  } else {
    console.log('❌ Service Worker не поддерживается');
  }
}

// Оптимизация для работы с виртуальной клавиатурой
function setupKeyboardOptimization() {
  const chatInput = document.getElementById('chat-input');
  
  if (!chatInput) return;
  
  // Фокус на input - сдвигаем viewport
  chatInput.addEventListener('focus', () => {
    setTimeout(() => {
      chatInput.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }, 300); // Даем время клавиатуре появиться
  });
  
  // При фокусе добавляем класс для оптимизации (только для мобильных)
  chatInput.addEventListener('focus', () => {
    if (state.isMobile) {
      document.body.classList.add('keyboard-open');
      document.documentElement.style.setProperty('--keyboard-height', '300px');
    }
  });
  
  // При потере фокуса убираем оптимизацию (только для мобильных)
  chatInput.addEventListener('blur', () => {
    if (state.isMobile) {
      document.body.classList.remove('keyboard-open');
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    }
  });
  
  // Отключаем zoom на focus для iOS
  chatInput.addEventListener('touchstart', () => {
    document.body.style.zoom = '1';
    setTimeout(() => {
      document.body.style.zoom = '';
    }, 500);
  });
}

// Улучшения для touch устройств
function setupTouchOptimizations() {
  // Отключаем context menu на long press
  document.addEventListener('contextmenu', (e) => {
    if (state.isMobile) {
      e.preventDefault();
    }
  });
  
  // Touch feedback для кнопок
  document.addEventListener('touchstart', (e) => {
    const target = e.target.closest('button, .btn, [role="button"]');
    if (target) {
      target.classList.add('touch-active');
    }
  }, { passive: true });
  
  document.addEventListener('touchend', (e) => {
    const target = e.target.closest('button, .btn, [role="button"]');
    if (target) {
      setTimeout(() => {
        target.classList.remove('touch-active');
      }, 150);
    }
  }, { passive: true });
  
  // Отключаем pull-to-refresh на мобильных
  if (state.isMobile) {
    let startY = 0;
    document.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchmove', (e) => {
      const currentY = e.touches[0].clientY;
      const scrollTop = window.pageYOffset;
      
      // Отключаем pull-to-refresh только в чате
      if (scrollTop <= 0 && currentY > startY && state.activePage === 'chat') {
        e.preventDefault();
      }
    });
  }
}

// Обработка изменения ориентации
function setupOrientationHandler() {
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      checkMobile();
      // Пересчитываем высоты элементов
      const chatMessages = document.getElementById('chat-messages');
      if (chatMessages && state.activePage === 'chat') {
        chatMessages.style.maxHeight = window.innerHeight * 0.5 + 'px';
      }
    }, 500); // Даем время на смену ориентации
  });
}

// Функция для предотвращения accidental zoom
function setupZoomPrevention() {
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', function() {
  console.log('Secure Hax Messenger initialized! 💬🔐');
  
  // Инициализируем определение мобильного устройства
  checkMobile();
  console.log('Mobile mode:', state.isMobile ? 'ON' : 'OFF');
  
  // PWA инициализация
  registerServiceWorker();
  
  // Mobile оптимизации
  setupKeyboardOptimization();
  setupTouchOptimizations();
  setupOrientationHandler();
  setupZoomPrevention();
  
  showPage('home');
  checkMobile();
  loadTheme(); // Load saved theme
  
  // ============ SCROLL REVEAL ANIMATIONS ============
  // Intersection Observer для плавного появления элементов
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target); // Анимация только один раз
      }
    });
  }, observerOptions);
  
  // Наблюдаем за всеми элементами с классом scroll-reveal
  document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-scale').forEach(el => {
    observer.observe(el);
  });
  
  // Setup game button listeners
  document.getElementById('close-game-btn').addEventListener('click', closeGameModal);
  
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const choice = this.getAttribute('data-choice');
      makeChoice(choice);
    });
  });
  
  // Page visibility и мобильные оптимизации
  document.addEventListener('visibilitychange', () => {
    checkMobile();
    if (document.visibilityState === 'visible') {
      setTimeout(checkMobile, 100);
    }
  });

  // PWA обработчики
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('📱 PWA может быть установлена');
    e.preventDefault();
    // Сохраняем событие для позднего использования
    window.deferredPrompt = e;
    
    // Показываем пользователю возможность установки
    showToast('📱 Нажмите "Добавить на главный экран" для установки приложения!', 5000);
  });

  window.addEventListener('appinstalled', (e) => {
    console.log('✅ PWA установлена успешно');
    showToast('🎉 Secure Hax Messenger установлен как приложение!');
  });

  window.addEventListener('beforeunload', () => {
    if (state.roomId) {
      const userPath = state.isHost ? 'host' : 'guest';
      set(ref(db, `rooms/${state.roomId}/${userPath}/online`), false);
    }
    if (state.callState.active) {
      endCall();
    }
  });

  // Touch gesture обработчики для лучшего UX
  let touchStartY = 0;
  let touchStartX = 0;
  
  document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  
  document.addEventListener('touchend', (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaY = touchEndY - touchStartY;
    const deltaX = touchEndX - touchStartX;
    
    // Detected swipe gestures для навигации (если нужно)
    if (Math.abs(deltaY) < 50 && Math.abs(deltaX) > 100) {
      if (deltaX > 50 && state.activePage === 'chat') {
        // Swipe right - показать меню
        toggleMenu();
      }
    }
  }, { passive: true });

  // Добавляем CSS классы для определения touch возможностей
  const isTouchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouchCapable) {
    document.body.classList.add('touch-capable');
  } else {
    document.body.classList.add('no-touch');
  }

  // Устанавливаем оптимальные значения для CSS переменных
  const setCSSVariables = () => {
    const root = document.documentElement;
    
    // Safe area значения
    root.style.setProperty('--safe-area-inset-bottom', 
      getComputedStyle(document.body).getPropertyValue('padding-bottom'));
    
    // Висота клавиатуры (по умолчанию)
    root.style.setProperty('--keyboard-height', '0px');
  };

  setCSSVariables();
  window.addEventListener('resize', setCSSVariables);
});
