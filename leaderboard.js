/**
 * Leaderboard Module for Classic Games Arcade
 * Handles score submission, retrieval, and display
 * Works with localStorage locally and AWS API Gateway when deployed
 */

const Leaderboard = (function() {
    // Environment detection
    const isLocal = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '';

    // API endpoint - update this after deploying to AWS
    const API_BASE = 'https://YOUR_API_GATEWAY_URL/prod';

    // Game configurations
    const GAMES = {
        'pong': { name: 'Pong', scoreType: 'high', metric: 'wins', icon: '🏓' },
        'flappy-bird': { name: 'Flappy Bird', scoreType: 'high', metric: 'score', icon: '🐦' },
        'snake': { name: 'Snake', scoreType: 'high', metric: 'score', icon: '🐍' },
        'rooftop-snipers': { name: 'Rooftop Rumble', scoreType: 'high', metric: 'wins', icon: '🎯' },
        'chess': { name: 'Chess', scoreType: 'high', metric: 'wins', icon: '♟️' },
        'city-runner': { name: 'City Runner', scoreType: 'high', metric: 'meters', icon: '🏃' },
        'retro-football': { name: 'Retro Football', scoreType: 'high', metric: 'points', icon: '🏈' },
        'bedtime-berzerk': { name: 'Bedtime Berzerk', scoreType: 'low', metric: 'time', icon: '🛏️' },
        'homerun-derby': { name: 'Homerun Derby', scoreType: 'high', metric: 'feet', icon: '⚾' }
    };

    const STORAGE_KEY = 'arcadeLeaderboards';
    const MAX_ENTRIES = 10;

    // Initialize localStorage with empty leaderboards if needed
    function initStorage() {
        if (!localStorage.getItem(STORAGE_KEY)) {
            const emptyLeaderboards = {};
            Object.keys(GAMES).forEach(gameId => {
                emptyLeaderboards[gameId] = [];
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyLeaderboards));
        }
    }

    // Get all leaderboards from localStorage
    function getLocalLeaderboards() {
        initStorage();
        return JSON.parse(localStorage.getItem(STORAGE_KEY));
    }

    // Save leaderboards to localStorage
    function saveLocalLeaderboards(leaderboards) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(leaderboards));
    }

    // Format score for display based on game type
    function formatScore(gameId, score) {
        const game = GAMES[gameId];
        if (!game) return score.toString();

        if (game.metric === 'time') {
            // Format as mm:ss
            const totalSeconds = Math.floor(score / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else if (game.metric === 'meters') {
            return `${Math.floor(score)}m`;
        } else if (game.metric === 'feet') {
            return `${Math.floor(score)} ft`;
        } else if (game.metric === 'points' || game.metric === 'score') {
            return score.toLocaleString();
        } else if (game.metric === 'wins') {
            return score === 1 ? '1 win' : `${score} wins`;
        }
        return score.toString();
    }

    // Check if a score qualifies for the leaderboard
    function scoreQualifies(gameId, score, leaderboard) {
        const game = GAMES[gameId];
        if (!game) return false;

        if (leaderboard.length < MAX_ENTRIES) return true;

        const worstScore = leaderboard[leaderboard.length - 1].score;

        if (game.scoreType === 'high') {
            return score > worstScore;
        } else {
            return score < worstScore;
        }
    }

    // Get the rank a score would achieve
    function getRank(gameId, score, leaderboard) {
        const game = GAMES[gameId];
        if (!game) return -1;

        for (let i = 0; i < leaderboard.length; i++) {
            if (game.scoreType === 'high' && score > leaderboard[i].score) {
                return i + 1;
            } else if (game.scoreType === 'low' && score < leaderboard[i].score) {
                return i + 1;
            }
        }

        if (leaderboard.length < MAX_ENTRIES) {
            return leaderboard.length + 1;
        }

        return -1;
    }

    // Create and show the name prompt modal
    function showNamePrompt(rank, gameId) {
        return new Promise((resolve) => {
            const game = GAMES[gameId] || { name: 'Game' };

            // Create modal elements
            const overlay = document.createElement('div');
            overlay.id = 'leaderboard-modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.85);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                animation: fadeIn 0.3s ease;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 40px;
                border-radius: 20px;
                text-align: center;
                color: white;
                font-family: 'Courier New', monospace;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                max-width: 400px;
                width: 90%;
            `;

            modal.innerHTML = `
                <h2 style="font-size: 28px; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
                    NEW HIGH SCORE!
                </h2>
                <p style="font-size: 20px; margin-bottom: 20px; color: #ffd700;">
                    You ranked #${rank} in ${game.name}!
                </p>
                <input type="text" id="leaderboard-name-input" maxlength="10" placeholder="Enter your name"
                    style="
                        width: 100%;
                        padding: 15px;
                        font-size: 18px;
                        border: none;
                        border-radius: 10px;
                        text-align: center;
                        font-family: 'Courier New', monospace;
                        margin-bottom: 20px;
                        box-sizing: border-box;
                    "
                />
                <button id="leaderboard-submit-btn" style="
                    padding: 15px 40px;
                    font-size: 18px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-family: 'Courier New', monospace;
                    transition: transform 0.2s, background 0.2s;
                ">
                    Submit
                </button>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Add animation styles
            const style = document.createElement('style');
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                #leaderboard-submit-btn:hover {
                    background: #45a049;
                    transform: scale(1.05);
                }
            `;
            document.head.appendChild(style);

            const input = document.getElementById('leaderboard-name-input');
            const submitBtn = document.getElementById('leaderboard-submit-btn');

            input.focus();

            function submit() {
                const name = input.value.trim() || 'Anonymous';
                overlay.remove();
                style.remove();
                resolve(name);
            }

            submitBtn.addEventListener('click', submit);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submit();
            });
        });
    }

    // LOCAL STORAGE METHODS

    async function localGetLeaderboard(gameId) {
        const leaderboards = getLocalLeaderboards();
        return leaderboards[gameId] || [];
    }

    async function localGetAllLeaderboards() {
        return getLocalLeaderboards();
    }

    async function localSubmitScore(gameId, playerName, score) {
        const leaderboards = getLocalLeaderboards();
        const leaderboard = leaderboards[gameId] || [];
        const game = GAMES[gameId];

        if (!game) return { qualified: false, rank: -1 };

        // Check if score qualifies
        if (!scoreQualifies(gameId, score, leaderboard)) {
            return { qualified: false, rank: -1 };
        }

        const rank = getRank(gameId, score, leaderboard);

        // Insert the new score
        const newEntry = {
            playerName,
            score,
            timestamp: Date.now()
        };

        leaderboard.splice(rank - 1, 0, newEntry);

        // Keep only top 10
        if (leaderboard.length > MAX_ENTRIES) {
            leaderboard.pop();
        }

        leaderboards[gameId] = leaderboard;
        saveLocalLeaderboards(leaderboards);

        return { qualified: true, rank };
    }

    // API METHODS (for AWS deployment)

    async function apiGetLeaderboard(gameId) {
        try {
            const response = await fetch(`${API_BASE}/scores/${gameId}`);
            if (!response.ok) throw new Error('API error');
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
            // Fallback to localStorage
            return localGetLeaderboard(gameId);
        }
    }

    async function apiGetAllLeaderboards() {
        try {
            const response = await fetch(`${API_BASE}/scores`);
            if (!response.ok) throw new Error('API error');
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch all leaderboards:', error);
            // Fallback to localStorage
            return localGetAllLeaderboards();
        }
    }

    async function apiSubmitScore(gameId, playerName, score) {
        try {
            const response = await fetch(`${API_BASE}/scores/${gameId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerName, score })
            });
            if (!response.ok) throw new Error('API error');
            return await response.json();
        } catch (error) {
            console.error('Failed to submit score:', error);
            // Fallback to localStorage
            return localSubmitScore(gameId, playerName, score);
        }
    }

    // PUBLIC API

    /**
     * Get the leaderboard for a specific game
     * @param {string} gameId - The game identifier
     * @returns {Promise<Array>} Array of {playerName, score, timestamp}
     */
    async function getLeaderboard(gameId) {
        if (isLocal) {
            return localGetLeaderboard(gameId);
        }
        return apiGetLeaderboard(gameId);
    }

    /**
     * Get all leaderboards (top entries for each game)
     * @returns {Promise<Object>} Object with gameId keys and leaderboard arrays
     */
    async function getAllLeaderboards() {
        if (isLocal) {
            return localGetAllLeaderboards();
        }
        return apiGetAllLeaderboards();
    }

    /**
     * Check if a score qualifies for the leaderboard and submit it
     * This function handles the entire flow: check, prompt for name, submit
     * @param {string} gameId - The game identifier
     * @param {number} score - The score to submit
     * @returns {Promise<{qualified: boolean, rank: number}>}
     */
    async function checkAndSubmitScore(gameId, score) {
        const leaderboard = await getLeaderboard(gameId);

        if (!scoreQualifies(gameId, score, leaderboard)) {
            return { qualified: false, rank: -1 };
        }

        const rank = getRank(gameId, score, leaderboard);
        const playerName = await showNamePrompt(rank, gameId);

        if (isLocal) {
            return localSubmitScore(gameId, playerName, score);
        }
        return apiSubmitScore(gameId, playerName, score);
    }

    /**
     * Render a leaderboard into a container element
     * @param {string} gameId - The game identifier
     * @param {HTMLElement} container - The container to render into
     * @param {number} limit - Maximum entries to show (default 10)
     */
    async function renderLeaderboard(gameId, container, limit = 10) {
        const leaderboard = await getLeaderboard(gameId);
        const game = GAMES[gameId];

        if (!game) {
            container.innerHTML = '<p>Unknown game</p>';
            return;
        }

        if (leaderboard.length === 0) {
            container.innerHTML = '<p style="color: #888; font-style: italic;">No scores yet. Be the first!</p>';
            return;
        }

        const entries = leaderboard.slice(0, limit);
        let html = '<div class="leaderboard-entries">';

        entries.forEach((entry, index) => {
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
            const formattedScore = formatScore(gameId, entry.score);

            html += `
                <div class="leaderboard-entry" style="
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 12px;
                    margin: 4px 0;
                    background: ${rank <= 3 ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)'};
                    border-radius: 6px;
                    font-size: 14px;
                ">
                    <span class="rank" style="min-width: 40px;">${medal}</span>
                    <span class="name" style="flex: 1; text-align: left; margin-left: 10px;">${entry.playerName}</span>
                    <span class="score" style="font-weight: bold; color: #ffd700;">${formattedScore}</span>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * Render a mini leaderboard preview (top 3) for the index page
     * @param {string} gameId - The game identifier
     * @param {HTMLElement} container - The container to render into
     */
    async function renderMiniLeaderboard(gameId, container) {
        const leaderboard = await getLeaderboard(gameId);
        const game = GAMES[gameId];

        if (!game) return;

        if (leaderboard.length === 0) {
            container.innerHTML = '<div class="no-scores">No scores yet</div>';
            return;
        }

        const entries = leaderboard.slice(0, 3);
        let html = '';

        entries.forEach((entry, index) => {
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
            const formattedScore = formatScore(gameId, entry.score);

            html += `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;color:#555;">
                <span>${medal} ${entry.playerName}</span>
                <span style="color:#667eea;font-weight:bold;">${formattedScore}</span>
            </div>`;
        });

        container.innerHTML = html;
    }

    // Initialize on load
    initStorage();

    // Return public API
    return {
        GAMES,
        isLocal,
        getLeaderboard,
        getAllLeaderboards,
        checkAndSubmitScore,
        formatScore,
        renderLeaderboard,
        renderMiniLeaderboard,
        scoreQualifies,
        getRank
    };
})();

// Make available globally
window.Leaderboard = Leaderboard;
