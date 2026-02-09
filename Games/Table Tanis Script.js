        const canvas = document.getElementById('pongCanvas');
        const ctx = canvas.getContext('2d');
        const container = document.getElementById('game-container');
        const overlay = document.getElementById('overlay');
        const startBtn = document.getElementById('startBtn');
        const speedBar = document.getElementById('speedBar');
        
        // Audio Synthesis Setup
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        function playSound(freq, type = 'square', duration = 0.1) {
            if(audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        }

        const WIDTH = 900;
        const HEIGHT = 500;
        canvas.width = WIDTH;
        canvas.height = HEIGHT;

        const PADDLE_WIDTH = 12;
        const PADDLE_HEIGHT = 100;
        const BALL_RADIUS = 7;
        const WINNING_SCORE = 11;

        let gameRunning = false;
        let playerScore = 0;
        let cpuScore = 0;
        let level = 1;
        let particles = [];
        let ballTrail = [];

        const ball = {
            x: WIDTH / 2,
            y: HEIGHT / 2,
            dx: 6,
            dy: 6,
            speed: 7
        };

        const player = { x: 20, y: HEIGHT / 2 - 50, color: '#22d3ee' };
        const cpu = { x: WIDTH - 32, y: HEIGHT / 2 - 50, speed: 4.5, color: '#ec4899' };

        class Particle {
            constructor(x, y, color) {
                this.x = x;
                this.y = y;
                this.color = color;
                this.size = Math.random() * 4 + 1;
                this.speedX = (Math.random() - 0.5) * 8;
                this.speedY = (Math.random() - 0.5) * 8;
                this.alpha = 1;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                this.alpha -= 0.02;
            }
            draw() {
                ctx.save();
                ctx.globalAlpha = this.alpha;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        function createExplosion(x, y, color) {
            for (let i = 0; i < 15; i++) {
                particles.push(new Particle(x, y, color));
            }
            container.classList.add('shake');
            setTimeout(() => container.classList.remove('shake'), 150);
        }

        function movePaddle(e) {
            const rect = canvas.getBoundingClientRect();
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const scaleY = HEIGHT / rect.height;
            player.y = (clientY - rect.top) * scaleY - PADDLE_HEIGHT / 2;
            
            if (player.y < 0) player.y = 0;
            if (player.y > HEIGHT - PADDLE_HEIGHT) player.y = HEIGHT - PADDLE_HEIGHT;
        }

        window.addEventListener('mousemove', movePaddle);
        window.addEventListener('touchmove', (e) => { e.preventDefault(); movePaddle(e); }, { passive: false });

        function resetBall(winner) {
            ball.x = WIDTH / 2;
            ball.y = HEIGHT / 2;
            ball.speed = 7 + (level * 0.4);
            ball.dx = (winner === 'player' ? -1 : 1) * ball.speed;
            ball.dy = (Math.random() - 0.5) * 10;
            ballTrail = [];
        }

        function collision(b, p) {
            return b.x + BALL_RADIUS > p.x && 
                   b.x - BALL_RADIUS < p.x + PADDLE_WIDTH && 
                   b.y + BALL_RADIUS > p.y && 
                   b.y - BALL_RADIUS < p.y + PADDLE_HEIGHT;
        }

        function update() {
            if (!gameRunning) return;

            // Trail Logic
            ballTrail.push({x: ball.x, y: ball.y});
            if (ballTrail.length > 8) ballTrail.shift();

            ball.x += ball.dx;
            ball.y += ball.dy;

            // CPU AI (Interpolated)
            let targetY = ball.y - PADDLE_HEIGHT / 2;
            cpu.y += (targetY - cpu.y) * 0.12 * (0.8 + level * 0.1);

            if (ball.y + BALL_RADIUS > HEIGHT || ball.y - BALL_RADIUS < 0) {
                ball.dy *= -1;
                playSound(300, 'sine', 0.05);
            }

            let paddle = (ball.x < WIDTH / 2) ? player : cpu;
            if (collision(ball, paddle)) {
                let hitPoint = (ball.y - (paddle.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
                let angle = hitPoint * (Math.PI / 4);
                let dir = (ball.x < WIDTH / 2) ? 1 : -1;
                
                ball.dx = dir * ball.speed * Math.cos(angle);
                ball.dy = ball.speed * Math.sin(angle);
                ball.speed += 0.25;

                createExplosion(ball.x, ball.y, paddle.color);
                playSound(dir === 1 ? 440 : 550, 'square', 0.1);
            }

            // Progress bar
            speedBar.style.width = `${Math.min((ball.speed - 7) * 10, 100)}%`;

            if (ball.x < 0) {
                cpuScore++;
                document.getElementById('cpuScore').innerText = cpuScore;
                playSound(150, 'sawtooth', 0.3);
                checkGameOver();
                resetBall('cpu');
            } else if (ball.x > WIDTH) {
                playerScore++;
                document.getElementById('playerScore').innerText = playerScore;
                if (playerScore % 2 === 0) {
                    level++;
                    document.getElementById('gameLevel').innerText = `LVL ${level.toString().padStart(2, '0')}`;
                }
                playSound(880, 'sine', 0.3);
                checkGameOver();
                resetBall('player');
            }

            particles = particles.filter(p => p.alpha > 0);
            particles.forEach(p => p.update());
        }

        function render() {
            ctx.clearRect(0, 0, WIDTH, HEIGHT);

            // Center Net
            ctx.setLineDash([5, 10]);
            ctx.strokeStyle = "rgba(255,255,255,0.05)";
            ctx.strokeRect(WIDTH / 2, 0, 1, HEIGHT);
            ctx.setLineDash([]);

            // Trail
            ballTrail.forEach((t, i) => {
                ctx.beginPath();
                ctx.arc(t.x, t.y, BALL_RADIUS * (i / ballTrail.length), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(34, 211, 238, ${i / 20})`;
                ctx.fill();
            });

            // Particles
            particles.forEach(p => p.draw());

            // Paddles with Glow
            ctx.shadowBlur = 15;
            ctx.fillStyle = player.color;
            ctx.shadowColor = player.color;
            ctx.fillRect(player.x, player.y, PADDLE_WIDTH, PADDLE_HEIGHT);

            ctx.fillStyle = cpu.color;
            ctx.shadowColor = cpu.color;
            ctx.fillRect(cpu.x, cpu.y, PADDLE_WIDTH, PADDLE_HEIGHT);

            // Ball
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#fff";
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        function checkGameOver() {
            if (playerScore >= WINNING_SCORE || cpuScore >= WINNING_SCORE) {
                gameRunning = false;
                overlay.style.display = 'flex';
                document.getElementById('overlayTitle').innerText = playerScore >= WINNING_SCORE ? "VICTORY" : "DEFEATED";
                document.getElementById('overlayMsg').innerText = `FINAL SCORE ${playerScore} - ${cpuScore}`;
                startBtn.querySelector('span').innerText = "RE-INITIALIZE";
                playerScore = 0;
                cpuScore = 0;
                level = 1;
                document.getElementById('playerScore').innerText = 0;
                document.getElementById('cpuScore').innerText = 0;
                document.getElementById('gameLevel').innerText = "LVL 01";
            }
        }

        function gameLoop() {
            update();
            render();
            requestAnimationFrame(gameLoop);
        }

        startBtn.addEventListener('click', () => {
            if(audioCtx.state === 'suspended') audioCtx.resume();
            overlay.style.display = 'none';
            gameRunning = true;
            resetBall('player');
        });

        gameLoop();
