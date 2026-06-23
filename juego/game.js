// --- Game Settings & Variables ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const gridCount = 20; // 20x20 grid
let gridCellSize = canvas.width / gridCount;

// Game state machine
const STATES = {
  START: 'START',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER'
};
let gameState = STATES.START;

// Snake & Food variables
let snake = [];
let food = { x: 0, y: 0 };
let dx = 1; // Movement x
let dy = 0; // Movement y
let nextDx = 1;
let nextDy = 0;

// Scoring
let score = 0;
let highScore = parseInt(localStorage.getItem('snake_high_score')) || 0;

// Game Loop Timing
let lastTime = 0;
let gameSpeed = 150; // Milliseconds per tick (easy default)
let isLoopRunning = false;

// Audio Settings
let audioCtx = null;
const soundToggle = document.getElementById('sound-toggle');

// DOM Overlays & UI
const currentScoreEl = document.getElementById('current-score');
const highScoreEl = document.getElementById('high-score');
const finalScoreEl = document.getElementById('final-score');
const startOverlay = document.getElementById('start-overlay');
const pauseOverlay = document.getElementById('pause-overlay');
const gameoverOverlay = document.getElementById('gameover-overlay');

// DOM Controls
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const resumeBtn = document.getElementById('resume-btn');
const diffEasy = document.getElementById('diff-easy');
const diffMedium = document.getElementById('diff-medium');
const diffHard = document.getElementById('diff-hard');

// Initialize UI
updateScoreboard();

// --- Retro Audio Synth (8-Bit Sound Effects) ---
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type) {
  if (!soundToggle.checked) return;
  initAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;

  switch (type) {
    case 'eat': {
      // Short high pitch slide (ping)
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.1); // C6
      
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    }
    case 'gameover': {
      // Low descending noise/sine wave
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.45);
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(now);
      osc.stop(now + 0.5);
      break;
    }
    case 'highscore': {
      // Upward arpeggio
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        
        gain.gain.setValueAtTime(0.1, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.01, now + idx * 0.08 + 0.07);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.07);
      });
      break;
    }
    case 'pause': {
      // Double click
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, now);
      
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(now);
      osc.stop(now + 0.05);
      break;
    }
  }
}

// --- Logical Canvas Setup ---
canvas.width = 400;
canvas.height = 400;
gridCellSize = canvas.width / gridCount;
draw();

// --- Game Logic functions ---

function initGame() {
  console.log("initGame: Initializing snake and scores");
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
  ];
  dx = 1;
  dy = 0;
  nextDx = 1;
  nextDy = 0;
  score = 0;
  updateScoreboard();
  placeFood();
  console.log("initGame complete. Snake head:", snake[0], "Food:", food);
}

function placeFood() {
  let safe = false;
  while (!safe) {
    food.x = Math.floor(Math.random() * gridCount);
    food.y = Math.floor(Math.random() * gridCount);
    
    // Check if food coordinates collide with snake body
    safe = true;
    for (let segment of snake) {
      if (segment.x === food.x && segment.y === food.y) {
        safe = false;
        break;
      }
    }
  }
}

function changeGameState(newState) {
  console.log("changeGameState: Transitioning to", newState);
  gameState = newState;
  
  // Hide all overlays first
  startOverlay.classList.remove('active');
  pauseOverlay.classList.remove('active');
  gameoverOverlay.classList.remove('active');
  
  // Show active overlay based on state
  if (gameState === STATES.START) {
    startOverlay.classList.add('active');
  } else if (gameState === STATES.PAUSED) {
    pauseOverlay.classList.add('active');
    playSound('pause');
  } else if (gameState === STATES.GAMEOVER) {
    gameoverOverlay.classList.add('active');
    finalScoreEl.textContent = score;
    playSound('gameover');
  }
}

function updateScoreboard() {
  currentScoreEl.textContent = String(score).padStart(3, '0');
  highScoreEl.textContent = String(highScore).padStart(3, '0');
}

// --- Input Handling ---
function changeDirection(newDx, newDy) {
  // Prevent snake from reversing into itself
  if ((newDx === 1 && dx === -1) || (newDx === -1 && dx === 1)) return;
  if ((newDy === 1 && dy === -1) || (newDy === -1 && dy === 1)) return;
  
  nextDx = newDx;
  nextDy = newDy;
}

window.addEventListener('keydown', (e) => {
  // Prevent space and arrow keys from scrolling the window while playing
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }

  if (gameState === STATES.PLAYING) {
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        changeDirection(0, -1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        changeDirection(0, 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        changeDirection(-1, 0);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        changeDirection(1, 0);
        break;
      case ' ':
        changeGameState(STATES.PAUSED);
        break;
    }
  } else if (e.key === ' ') {
    if (gameState === STATES.START || gameState === STATES.GAMEOVER) {
      startGamePlay();
    } else if (gameState === STATES.PAUSED) {
      resumeGamePlay();
    }
  }
});

// --- Mobile D-pad Listeners ---
document.getElementById('dpad-up').addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(0, -1); });
document.getElementById('dpad-down').addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(0, 1); });
document.getElementById('dpad-left').addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(-1, 0); });
document.getElementById('dpad-right').addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(1, 0); });

document.getElementById('dpad-up').addEventListener('mousedown', () => changeDirection(0, -1));
document.getElementById('dpad-down').addEventListener('mousedown', () => changeDirection(0, 1));
document.getElementById('dpad-left').addEventListener('mousedown', () => changeDirection(-1, 0));
document.getElementById('dpad-right').addEventListener('mousedown', () => changeDirection(1, 0));

// --- Difficulty Control ---
const diffButtons = [diffEasy, diffMedium, diffHard];
diffButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    diffButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gameSpeed = parseInt(btn.getAttribute('data-speed'));
    initAudio();
  });
});

// --- Action Button Listeners ---
function startGamePlay() {
  initAudio();
  initGame();
  changeGameState(STATES.PLAYING);
}

function resumeGamePlay() {
  changeGameState(STATES.PLAYING);
}

startBtn.addEventListener('click', startGamePlay);
restartBtn.addEventListener('click', startGamePlay);
resumeBtn.addEventListener('click', resumeGamePlay);

// --- Drawing / Rendering ---
function draw() {
  // Clear Canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw Subtle Grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= gridCount; i++) {
    // vertical
    ctx.beginPath();
    ctx.moveTo(i * gridCellSize, 0);
    ctx.lineTo(i * gridCellSize, canvas.height);
    ctx.stroke();
    // horizontal
    ctx.beginPath();
    ctx.moveTo(0, i * gridCellSize);
    ctx.lineTo(canvas.width, i * gridCellSize);
    ctx.stroke();
  }
  
  // Draw Food
  ctx.shadowBlur = 15;
  ctx.shadowColor = varColor('--neon-pink');
  ctx.fillStyle = varColor('--neon-pink');
  ctx.beginPath();
  ctx.arc(
    food.x * gridCellSize + gridCellSize / 2,
    food.y * gridCellSize + gridCellSize / 2,
    gridCellSize / 2.5,
    0,
    Math.PI * 2
  );
  ctx.fill();
  
  // Draw Snake
  ctx.shadowBlur = 10;
  ctx.shadowColor = varColor('--neon-green');
  
  snake.forEach((segment, idx) => {
    // Draw head slightly different
    if (idx === 0) {
      ctx.fillStyle = varColor('--neon-cyan');
      ctx.shadowColor = varColor('--neon-cyan');
    } else {
      ctx.fillStyle = varColor('--neon-green');
      ctx.shadowColor = varColor('--neon-green');
    }
    
    ctx.fillRect(
      segment.x * gridCellSize + 1,
      segment.y * gridCellSize + 1,
      gridCellSize - 2,
      gridCellSize - 2
    );
  });
  
  // Reset shadow for performance
  ctx.shadowBlur = 0;
}

// Helpers for CSS variables
function varColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// --- Main Loop Tick ---
function tick() {
  if (gameState !== STATES.PLAYING) return;
  
  // Apply direction updates
  dx = nextDx;
  dy = nextDy;
  
  // Calculate new head
  const head = { x: snake[0].x + dx, y: snake[0].y + dy };
  console.log("tick: snake[0]=", snake[0], "dx/dy=", dx, dy, "head=", head);
  
  // Wall collision check
  if (head.x < 0 || head.x >= gridCount || head.y < 0 || head.y >= gridCount) {
    console.log("tick: GAME OVER due to wall collision. head=", head, "gridCount=", gridCount);
    changeGameState(STATES.GAMEOVER);
    return;
  }
  
  // Self collision check
  for (let segment of snake) {
    if (head.x === segment.x && head.y === segment.y) {
      console.log("tick: GAME OVER due to self collision. head=", head, "segment=", segment);
      changeGameState(STATES.GAMEOVER);
      return;
    }
  }
  
  // Insert new head
  snake.unshift(head);
  
  // Food check
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    
    // Record check
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('snake_high_score', highScore);
      playSound('highscore');
    } else {
      playSound('eat');
    }
    
    updateScoreboard();
    placeFood();
  } else {
    // Remove tail if didn't eat food
    snake.pop();
  }
}

// Main Game Loop using standard performance.now delta accumulation
function gameLoop(timestamp) {
  if (!isLoopRunning) return;
  
  if (!lastTime) lastTime = timestamp;
  const elapsed = timestamp - lastTime;
  
  if (elapsed >= gameSpeed) {
    tick();
    draw();
    lastTime = timestamp;
  }
  
  requestAnimationFrame(gameLoop);
}

// Start Game Loop Execution
isLoopRunning = true;
requestAnimationFrame((timestamp) => {
  lastTime = timestamp;
  draw(); // First draw
  gameLoop(timestamp);
});
