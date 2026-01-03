const Setup = (() => {
    let mode = '';
    let playersCount = 0;
    let currentPickingPlayer = 0;
    let playerConfigs = []; 
    let takenColors = [];

    const selectMode = (m) => {
        mode = m;
        playersCount = m === 'AI' ? 2 : parseInt(m);
        document.getElementById('setup-players').style.display = 'none';
        document.getElementById('setup-colors').style.display = 'block';
        updateColorPicker();
    };

    const updateColorPicker = () => {
        const text = document.getElementById('color-setup-text');
        const count = mode === 'AI' ? 1 : playersCount;
        text.innerText = `Player ${currentPickingPlayer + 1}, Choose Color`;
        
        document.querySelectorAll('.color-dot').forEach(dot => {
            const color = dot.classList[1];
            dot.classList.toggle('locked', takenColors.includes(color));
        });
    };

    const pickColor = (color) => {
        if (takenColors.includes(color)) return;

        playerConfigs.push({ color, isAI: false });
        takenColors.push(color);
        currentPickingPlayer++;

        const targetCount = mode === 'AI' ? 1 : playersCount;

        if (currentPickingPlayer === targetCount) {
            if (mode === 'AI') {
                const available = ['red', 'green', 'yellow', 'blue'].filter(c => !takenColors.includes(c));
                playerConfigs.push({ color: available[0], isAI: true });
            }
            finishSetup();
        } else {
            updateColorPicker();
        }
    };

    const finishSetup = () => {
        const overlay = document.getElementById('modal-overlay');
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
            Game.init(playerConfigs);
        }, 400);
    };

    return { selectMode, pickColor };
})();

const Game = (() => {
    const COLORS = ['red', 'green', 'yellow', 'blue'];
    const SAFE_POINTS = ["6,1", "1,8", "8,13", "13,6", "8,2", "2,6", "6,12", "12,8"];
    
    // Path definition per starting color
    // Corrected path definitions to avoid using cell coordinates that are part of the center-house (6,7,8)
    const PATHS = {
        red: [[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[7,1],[7,2],[7,3],[7,4],[7,5]],
        green: [[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[1,7],[2,7],[3,7],[4,7],[5,7]],
        yellow: [[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[7,13],[7,12],[7,11],[7,10],[7,9]],
        blue: [[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[13,7],[12,7],[11,7],[10,7],[9,7]]
    };

    let state = {
        players: [], 
        turnIdx: 0,
        diceValue: 0,
        isRolling: false,
        isMoving: false,
        sixCount: 0
    };

    const init = (configs) => {
        state.players = COLORS.map(c => {
            const cfg = configs.find(x => x.color === c);
            if (!cfg) return null;
            return {
                color: c,
                isAI: cfg.isAI,
                tokens: [-1, -1, -1, -1],
                finished: 0
            };
        }).filter(x => x !== null);

        drawBoard();
        updateUI();
        
        if (state.players[0].isAI) setTimeout(roll, 1000);
    };

    const drawBoard = () => {
        const board = document.getElementById('board');
        board.innerHTML = '';

        // Generate Homes
        COLORS.forEach(c => {
            const home = document.createElement('div');
            home.className = `home ${c}`;
            const inner = document.createElement('div');
            inner.className = 'home-inner';
            for (let i = 0; i < 4; i++) {
                const slot = document.createElement('div');
                slot.className = 'home-slot';
                slot.id = `slot-${c}-${i}`;
                inner.appendChild(slot);
            }
            home.appendChild(inner);
            board.appendChild(home);
        });

        // Path Grid
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                // Modified skip logic:
                // Skip the 4 Home Bases (6x6 corners)
                if ((r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8)) continue;
                // Skip the 3x3 Center House (Rows 6,7,8 AND Cols 6,7,8)
                if (r >= 6 && r <= 8 && c >= 6 && c <= 8) continue;
                
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.pos = `${r},${c}`;
                cell.style.gridArea = `${r+1} / ${c+1}`;
                if (SAFE_POINTS.includes(`${r},${c}`)) cell.classList.add('safe-star');
                
                if (r === 7 && c > 0 && c < 7) cell.classList.add('path-red');
                if (c === 7 && r > 0 && r < 7) cell.classList.add('path-green');
                if (r === 7 && c > 8 && c < 14) cell.classList.add('path-yellow');
                if (c === 7 && r > 8 && r < 14) cell.classList.add('path-blue');

                board.appendChild(cell);
            }
        }

        const center = document.createElement('div');
        center.className = 'center-house';
        ['r','g','y','b'].forEach(x => {
            const tri = document.createElement('div');
            tri.className = `tri tri-${x}`;
            center.appendChild(tri);
        });
        board.appendChild(center);

        state.players.forEach(p => {
            p.tokens.forEach((_, i) => {
                const token = document.createElement('div');
                token.className = `token ${p.color}`;
                token.id = `token-${p.color}-${i}`;
                token.onclick = () => handleTokenInput(p.color, i);
                document.getElementById(`slot-${p.color}-${i}`).appendChild(token);
            });
        });
    };

    const roll = async () => {
        if (state.isRolling || state.isMoving) return;
        const player = state.players[state.turnIdx];
        const diceEl = document.getElementById(`dice-${player.color}`);
        
        state.isRolling = true;
        diceEl.classList.add('shake');

        await new Promise(r => setTimeout(r, 700));

        state.diceValue = Math.floor(Math.random() * 6) + 1;
        renderDice(player.color, state.diceValue);
        diceEl.classList.remove('shake');
        state.isRolling = false;

        if (state.diceValue === 6) {
            state.sixCount++;
            if (state.sixCount === 3) {
                state.sixCount = 0;
                return nextTurn();
            }
        } else {
            state.sixCount = 0;
        }

        const moves = getValidMoves();
        if (moves.length === 0) {
            setTimeout(nextTurn, 1000);
        } else if (player.isAI) {
            setTimeout(aiLogic, 900);
        } else {
            moves.forEach(i => {
                const tok = document.getElementById(`token-${player.color}-${i}`);
                if (tok) tok.classList.add('active');
            });
        }
    };

    const handleTokenInput = async (color, idx) => {
        if (state.isMoving || state.isRolling || state.diceValue === 0) return;
        if (state.players[state.turnIdx].color !== color) return;
        if (!getValidMoves().includes(idx)) return;

        state.isMoving = true;
        document.querySelectorAll('.token').forEach(t => t.classList.remove('active'));

        const player = state.players[state.turnIdx];
        const startPos = player.tokens[idx];

        if (startPos === -1) {
            player.tokens[idx] = 0;
            renderPosition(color, idx);
            await new Promise(r => setTimeout(r, 200));
        } else {
            for (let i = 0; i < state.diceValue; i++) {
                player.tokens[idx]++;
                renderPosition(color, idx);
                await new Promise(r => setTimeout(r, 160));
            }
        }

        finalizeTurn(color, idx);
    };

    const renderPosition = (color, idx) => {
        const player = state.players.find(p => p.color === color);
        if (!player) return;
        const pos = player.tokens[idx];
        const token = document.getElementById(`token-${color}-${idx}`);
        if (!token) return;
        
        if (pos === -1) {
            const slot = document.getElementById(`slot-${color}-${idx}`);
            if (slot) slot.appendChild(token);
        } else if (pos >= 56) {
            token.style.display = 'none';
        } else {
            const coords = PATHS[color][pos];
            if (coords) {
                const cell = document.querySelector(`.cell[data-pos="${coords[0]},${coords[1]}"]`);
                // Robust check to prevent appendChild error on null cell
                if (cell) {
                    cell.appendChild(token);
                    stackAdjust(cell);
                } else {
                    // Fallback: If cell doesn't exist but token is supposed to be on path, 
                    // it might be at the finish threshold
                    token.style.display = 'none';
                }
            }
        }
    };

    const stackAdjust = (cell) => {
        if (!cell) return;
        const tokens = cell.querySelectorAll('.token');
        tokens.forEach((t, i) => {
            if (tokens.length > 1) {
                t.style.width = '60%'; t.style.height = '60%';
                t.style.transform = `translate(${(i%2)*10 - 5}px, ${Math.floor(i/2)*10 - 5}px)`;
            } else {
                t.style.width = '80%'; t.style.height = '80%';
                t.style.transform = 'translate(0,0)';
            }
        });
    };

    const finalizeTurn = (color, idx) => {
        const player = state.players[state.turnIdx];
        const pos = player.tokens[idx];
        const coords = PATHS[color][pos];
        
        // Final threshold reached (56 is the finish marker)
        if (pos >= 56) {
            player.finished++;
            if (player.finished === 4) return declareWinner(color);
            return bonusTurn();
        }

        let killed = false;
        if (coords && !SAFE_POINTS.includes(`${coords[0]},${coords[1]}`)) {
            state.players.forEach(p => {
                if (p.color === color) return;
                p.tokens.forEach((tPos, tIdx) => {
                    if (tPos === -1 || tPos >= 56) return;
                    const enemyCoords = PATHS[p.color][tPos];
                    if (enemyCoords && enemyCoords[0] === coords[0] && enemyCoords[1] === coords[1]) {
                        p.tokens[tIdx] = -1;
                        renderPosition(p.color, tIdx);
                        killed = true;
                    }
                });
            });
        }

        if (killed || state.diceValue === 6) {
            bonusTurn();
        } else {
            nextTurn();
        }
    };

    const bonusTurn = () => {
        state.diceValue = 0;
        state.isMoving = false;
        state.isRolling = false;
        updateUI();
        if (state.players[state.turnIdx].isAI) setTimeout(roll, 1000);
    };

    const nextTurn = () => {
        state.turnIdx = (state.turnIdx + 1) % state.players.length;
        state.diceValue = 0;
        state.isMoving = false;
        state.isRolling = false;
        state.sixCount = 0;
        updateUI();
        if (state.players[state.turnIdx].isAI) setTimeout(roll, 1200);
    };

    const getValidMoves = () => {
        const p = state.players[state.turnIdx];
        if (!p) return [];
        return p.tokens.map((pos, i) => {
            if (pos === -1 && state.diceValue === 6) return i;
            if (pos !== -1 && pos + state.diceValue <= 56) return i;
            return null;
        }).filter(x => x !== null);
    };

    const aiLogic = () => {
        const p = state.players[state.turnIdx];
        const moves = getValidMoves();
        if (moves.length === 0) return;
        let choice = moves[0];

        for (const m of moves) {
            const pos = p.tokens[m];
            if (pos + state.diceValue === 56) { choice = m; break; }
            const target = PATHS[p.color][pos + state.diceValue];
            if (target && isEnemyNearby(target)) { choice = m; break; }
            if (p.tokens[choice] === -1 && state.diceValue === 6) choice = m;
            if (pos > p.tokens[choice]) choice = m;
        }

        handleTokenInput(p.color, choice);
    };

    const isEnemyNearby = (coords) => {
        return state.players.some((p, i) => {
            if (i === state.turnIdx) return false;
            return p.tokens.some(pos => {
                if (pos === -1 || pos >= 56) return false;
                const ec = PATHS[p.color][pos];
                return ec && ec[0] === coords[0] && ec[1] === coords[1];
            });
        });
    };

    const updateUI = () => {
        const player = state.players[state.turnIdx];
        if (!player) return;
        const msg = document.getElementById('turn-msg');
        msg.innerText = `${player.isAI ? 'AI THINKING...' : player.color + "'S TURN"}`;
        msg.style.borderColor = `var(--${player.color})`;
        msg.style.color = `var(--${player.color})`;

        document.querySelectorAll('.dice-box').forEach(d => d.classList.add('disabled-dice'));
        const activeDice = document.getElementById(`dice-${player.color}`);
        if (activeDice) activeDice.classList.remove('disabled-dice');
    };

    const renderDice = (color, val) => {
        const body = document.querySelector(`#dice-${color} .dice-body`);
        if (!body) return;
        body.innerHTML = '';
        const dots = {
            1: [[2,2]], 2: [[1,1],[3,3]], 3: [[1,1],[2,2],[3,3]],
            4: [[1,1],[1,3],[3,1],[3,3]], 5: [[1,1],[1,3],[2,2],[3,1],[3,3]],
            6: [[1,1],[1,3],[2,1],[2,3],[3,1],[3,3]]
        };
        dots[val].forEach(p => {
            const d = document.createElement('div');
            d.className = 'dice-dot';
            d.style.gridArea = `${p[0]}/${p[1]}`;
            body.appendChild(d);
        });
    };

    const declareWinner = (color) => {
        const scr = document.getElementById('winner-screen');
        const txt = document.getElementById('winner-text');
        txt.innerText = `${color.toUpperCase()} VICTORIOUS!`;
        txt.style.color = `var(--${color})`;
        scr.style.display = 'flex';
    };

    return { init, roll };
})();
