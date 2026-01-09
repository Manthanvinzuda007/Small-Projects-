
 // --- Game State ---
        const gameState = {
            board: Array(9).fill(null),
            currentPlayer: 'X',
            gameActive: true,
            scores: { X: 0, O: 0, draw: 0 },
            names: { X: "Player X", O: "Player O" },
            soundEnabled: true,
            isDark: true
        };

        const winningConditions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
            [0, 4, 8], [2, 4, 6]             // Diagonals
        ];

        // --- DOM Elements ---
        const gridEl = document.getElementById('game-grid');
        const turnTextEl = document.getElementById('turn-text');
        const turnIconEl = document.getElementById('turn-icon');
        const turnIndicatorEl = document.getElementById('turn-indicator');
        const overlayEl = document.getElementById('result-overlay');
        const resultTitleEl = document.getElementById('result-title');
        const resultSubEl = document.getElementById('result-subtitle');
        const scoreXEl = document.getElementById('score-x');
        const scoreOEl = document.getElementById('score-o');
        const scoreDrawEl = document.getElementById('score-draw');
        const nameXInput = document.getElementById('name-x');
        const nameOInput = document.getElementById('name-o');

        // --- Audio System (Synth) ---
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        function playTone(type) {
            if (!gameState.soundEnabled) return;
            if (audioCtx.state === 'suspended') audioCtx.resume();

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            const now = audioCtx.currentTime;

            if (type === 'click-x') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'click-o') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'win') {
                // Arpeggio
                const notes = [440, 554, 659, 880];
                notes.forEach((freq, i) => {
                    const o = audioCtx.createOscillator();
                    const g = audioCtx.createGain();
                    o.connect(g);
                    g.connect(audioCtx.destination);
                    o.type = 'triangle';
                    o.frequency.value = freq;
                    g.gain.setValueAtTime(0, now + i*0.05);
                    g.gain.linearRampToValueAtTime(0.1, now + i*0.05 + 0.05);
                    g.gain.linearRampToValueAtTime(0, now + i*0.05 + 0.3);
                    o.start(now + i*0.05);
                    o.stop(now + i*0.05 + 0.4);
                });
            } else if (type === 'reset') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(200, now);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            }
        }

        // --- SVGs ---
        const svgX = `<svg class="w-3/5 h-3/5 drop-shadow-lg" viewBox="0 0 100 100"><path d="M20,20 L80,80 M80,20 L20,80" stroke="#00f3ff" stroke-width="12" stroke-linecap="round" class="x-path" /></svg>`;
        const svgO = `<svg class="w-3/5 h-3/5 drop-shadow-lg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" stroke="#ff00ff" stroke-width="12" fill="none" class="o-circle" /></svg>`;

        // --- Initialization ---
        function initGame() {
            gridEl.innerHTML = '';
            for (let i = 0; i < 9; i++) {
                const cell = document.createElement('div');
                cell.className = 'cell cell-hover bg-slate-800/50 rounded-xl flex items-center justify-center text-4xl overflow-hidden';
                cell.dataset.index = i;
                cell.addEventListener('click', () => handleCellClick(i));
                gridEl.appendChild(cell);
            }
            updateTurnIndicator();
        }

        // --- Core Logic ---
        function handleCellClick(index) {
            if (!gameState.gameActive || gameState.board[index]) return;

            // Update State
            gameState.board[index] = gameState.currentPlayer;
            
            // Render Move
            const cell = gridEl.children[index];
            cell.innerHTML = gameState.currentPlayer === 'X' ? svgX : svgO;
            cell.classList.remove('cell-hover');
            
            // Audio
            playTone(gameState.currentPlayer === 'X' ? 'click-x' : 'click-o');

            // Check Result
            checkResult();
        }

        function checkResult() {
            let roundWon = false;
            let winIndices = [];

            for (let i = 0; i < winningConditions.length; i++) {
                const [a, b, c] = winningConditions[i];
                if (gameState.board[a] && gameState.board[a] === gameState.board[b] && gameState.board[a] === gameState.board[c]) {
                    roundWon = true;
                    winIndices = [a, b, c];
                    break;
                }
            }

            if (roundWon) {
                endGame(true, winIndices);
                return;
            }

            if (!gameState.board.includes(null)) {
                endGame(false);
                return;
            }

            // Switch Turn
            gameState.currentPlayer = gameState.currentPlayer === 'X' ? 'O' : 'X';
            updateTurnIndicator();
        }

        function updateTurnIndicator() {
            const player = gameState.currentPlayer;
            const name = player === 'X' ? gameState.names.X : gameState.names.O;
            
            turnIconEl.innerText = player;
            turnTextEl.innerText = `${name}'s Turn`;
            
            // CSS Color switching
            turnIconEl.className = `text-xl font-bold ${player === 'X' ? 'text-neonBlue' : 'text-neonPink'}`;
            turnIndicatorEl.style.borderColor = player === 'X' ? 'rgba(0, 243, 255, 0.3)' : 'rgba(255, 0, 255, 0.3)';
            turnIndicatorEl.style.borderWidth = '1px';
        }

        function endGame(hasWinner, indices) {
            gameState.gameActive = false;
            
            if (hasWinner) {
                const winner = gameState.currentPlayer;
                gameState.scores[winner]++;
                updateScoreboard();
                
                // Visuals
                indices.forEach(index => {
                    gridEl.children[index].classList.add('winning-cell');
                });
                
                showOverlay(`${winner} Wins!`, `${winner === 'X' ? gameState.names.X : gameState.names.O} takes the round`);
                playTone('win');
                fireConfetti();
            } else {
                gameState.scores.draw++;
                updateScoreboard();
                showOverlay("It's a Draw", "No more moves left");
                playTone('reset');
            }
        }

        function showOverlay(title, subtitle) {
            resultTitleEl.innerText = title;
            resultSubEl.innerText = subtitle;
            
            // If X won, style title blue, else pink
            if (title.includes('X')) {
                resultTitleEl.className = "text-4xl font-bold mb-2 scale-100 transition-transform duration-500 text-neonBlue drop-shadow-[0_0_10px_rgba(0,243,255,0.5)]";
            } else if (title.includes('O')) {
                resultTitleEl.className = "text-4xl font-bold mb-2 scale-100 transition-transform duration-500 text-neonPink drop-shadow-[0_0_10px_rgba(255,0,255,0.5)]";
            } else {
                resultTitleEl.className = "text-4xl font-bold mb-2 scale-100 transition-transform duration-500 text-white";
            }

            overlayEl.style.pointerEvents = 'auto';
            overlayEl.classList.remove('opacity-0');
        }

        function resetGame() {
            gameState.board.fill(null);
            gameState.gameActive = true;
            gameState.currentPlayer = 'X';
            
            // Hide Overlay
            overlayEl.style.pointerEvents = 'none';
            overlayEl.classList.add('opacity-0');
            resultTitleEl.classList.remove('scale-100');
            resultTitleEl.classList.add('scale-0');

            // Reset Grid
            playTone('reset');
            initGame();
        }

        function updateScoreboard() {
            scoreXEl.innerText = gameState.scores.X;
            scoreOEl.innerText = gameState.scores.O;
            scoreDrawEl.innerText = gameState.scores.draw;
        }

        // --- Event Listeners for Inputs ---
        nameXInput.addEventListener('input', (e) => {
            gameState.names.X = e.target.value || "Player X";
            if (gameState.currentPlayer === 'X') updateTurnIndicator();
        });

        nameOInput.addEventListener('input', (e) => {
            gameState.names.O = e.target.value || "Player O";
            if (gameState.currentPlayer === 'O') updateTurnIndicator();
        });

        // --- Theme & Sound Toggles ---
        document.getElementById('theme-btn').addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            gameState.isDark = !gameState.isDark;
        });

        document.getElementById('sound-btn').addEventListener('click', () => {
            gameState.soundEnabled = !gameState.soundEnabled;
            document.getElementById('icon-sound-on').classList.toggle('hidden');
            document.getElementById('icon-sound-off').classList.toggle('hidden');
        });

        // --- Canvas Confetti Engine ---
        function fireConfetti() {
            const canvas = document.getElementById('confetti-canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            const particles = [];
            const colors = ['#00f3ff', '#ff00ff', '#ffffff'];

            for (let i = 0; i < 100; i++) {
                particles.push({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                    w: Math.random() * 8 + 2,
                    h: Math.random() * 5 + 2,
                    vx: (Math.random() - 0.5) * 20,
                    vy: (Math.random() - 0.5) * 20,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    life: 100,
                    gravity: 0.2
                });
            }

            function animate() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                let active = false;

                particles.forEach(p => {
                    if (p.life > 0) {
                        active = true;
                        p.x += p.vx;
                        p.y += p.vy;
                        p.vy += p.gravity;
                        p.life--;
                        p.vx *= 0.95; // Friction

                        ctx.fillStyle = p.color;
                        ctx.globalAlpha = p.life / 100;
                        ctx.fillRect(p.x, p.y, p.w, p.h);
                    }
                });

                if (active) requestAnimationFrame(animate);
                else ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            animate();
        }

        // Initialize
        initGame();
