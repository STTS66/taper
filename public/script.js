const API_URL = '/api';

// Elements
const authOverlay = document.getElementById('auth-overlay');
const gameUI = document.getElementById('game-ui');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const btnPlay = document.getElementById('btn-play');
const authError = document.getElementById('auth-error');

const playerNameEl = document.getElementById('player-name');
const balanceEl = document.getElementById('balance');
const clickPowerEl = document.getElementById('click-power');
const btnLogout = document.getElementById('btn-logout');

const tapTarget = document.getElementById('tap-target');
const floatingTexts = document.getElementById('floating-texts');
const btnBuyUpgrade = document.querySelector('.buy-btn');
const upgradePriceEl = document.getElementById('upgrade-price');

// Game State
let gameState = {
    balance: 0,
    clickPower: 1,
    claimedRewards: [],
    token: null,
    username: ''
};

// Check for existing token
const savedToken = localStorage.getItem('tapper_token');
if (savedToken) {
    gameState.token = savedToken;
    fetchProfile();
}

async function fetchProfile() {
    try {
        const res = await fetch(`${API_URL}/me`, {
            headers: { 'Authorization': `Bearer ${gameState.token}` }
        });
        if (res.ok) {
            const data = await res.json();
            gameState.username = data.user.username;
            gameState.balance = data.user.balance;
            gameState.clickPower = data.user.click_power;
            gameState.claimedRewards = data.user.claimed_rewards || [];
            showGame();
        } else {
            localStorage.removeItem('tapper_token');
            gameState.token = null;
        }
    } catch (e) {
        console.error(e);
    }
}

async function handleAuth() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    authError.textContent = '';

    if (!username || !password) {
        authError.textContent = 'Введите имя и пароль';
        return;
    }

    try {
        let res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (res.status === 400) {
            const temp = await res.json();
            if (temp.error === 'User not found') {
                res = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
            } else {
                authError.textContent = temp.error;
                return;
            }
        }

        const data = await res.json();

        if (res.ok) {
            gameState.token = data.token;
            gameState.username = data.user.username;
            gameState.balance = data.user.balance;
            gameState.clickPower = data.user.click_power;
            gameState.claimedRewards = data.user.claimed_rewards || [];
            localStorage.setItem('tapper_token', data.token);
            showGame();
        } else {
            authError.textContent = data.error || 'Ошибка';
        }
    } catch (e) {
        authError.textContent = 'Ошибка сети';
    }
}

btnPlay.addEventListener('click', handleAuth);
btnLogout.addEventListener('click', () => {
    localStorage.removeItem('tapper_token');
    gameState.token = null;
    saveProgress();
    gameUI.classList.add('hidden');
    authOverlay.classList.remove('hidden');
    usernameInput.value = '';
    passwordInput.value = '';
});

function showGame() {
    authOverlay.classList.add('hidden');
    gameUI.classList.remove('hidden');

    // Check for admin
    const navBtnAdmin = document.getElementById('nav-btn-admin');
    if (gameState.username === 'admin') {
        navBtnAdmin.classList.remove('hidden');
        fetchAdminStats();
    } else {
        navBtnAdmin.classList.add('hidden');
    }

    updateUI();
    loadQuests();
}

// -------------- ADMIN LOGIC --------------
const adminUserCountEl = document.getElementById('admin-user-count');
const btnRefreshAdmin = document.getElementById('btn-refresh-admin');
const btnAddQuest = document.getElementById('btn-add-quest');
const adminQuestMsg = document.getElementById('admin-quest-msg');

async function fetchAdminStats() {
    if (!gameState.token || gameState.username !== 'admin') return;

    adminUserCountEl.textContent = '...';
    try {
        const res = await fetch(`${API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${gameState.token}` }
        });
        if (res.ok) {
            const data = await res.json();
            adminUserCountEl.textContent = data.totalUsers;
        } else {
            console.error('Failed to load admin stats');
        }
    } catch (e) {
        console.error(e);
    }
}

async function handleAddAdminQuest() {
    const title = document.getElementById('admin-quest-title').value.trim();
    const description = document.getElementById('admin-quest-desc').value.trim();
    const condition_type = document.getElementById('admin-quest-type').value;
    const condition_value = parseInt(document.getElementById('admin-quest-goal').value);
    const reward_amount = parseInt(document.getElementById('admin-quest-reward').value);

    adminQuestMsg.style.color = 'white';
    adminQuestMsg.textContent = 'Создание...';

    if (!title || !description || !condition_value || !reward_amount) {
        adminQuestMsg.style.color = '#ff4d4d';
        adminQuestMsg.textContent = 'Заполните все поля!';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/quests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${gameState.token}`
            },
            body: JSON.stringify({ title, description, condition_type, condition_value, reward_amount })
        });

        if (res.ok) {
            adminQuestMsg.style.color = '#00f2fe';
            adminQuestMsg.textContent = '✅ Квест успешно создан!';
            // clear form
            document.getElementById('admin-quest-title').value = '';
            document.getElementById('admin-quest-desc').value = '';
            document.getElementById('admin-quest-goal').value = '';
            document.getElementById('admin-quest-reward').value = '';
            // reload quests for everyone
            loadQuests();
        } else {
            adminQuestMsg.style.color = '#ff4d4d';
            adminQuestMsg.textContent = 'Ошибка создания';
        }
    } catch (e) {
        console.error(e);
        adminQuestMsg.textContent = 'Ошибка сети';
    }
}

if (btnRefreshAdmin) {
    btnRefreshAdmin.addEventListener('click', fetchAdminStats);
}
if (btnAddQuest) {
    btnAddQuest.addEventListener('click', handleAddAdminQuest);
}

// Game Logic
function getUpgradePrice() {
    return Math.floor(10 * Math.pow(1.2, gameState.clickPower - 1));
}

function updateUI() {
    playerNameEl.textContent = gameState.username;
    balanceEl.textContent = gameState.balance.toLocaleString('ru-RU');
    clickPowerEl.textContent = gameState.clickPower.toLocaleString('ru-RU');
    upgradePriceEl.textContent = getUpgradePrice().toLocaleString('ru-RU');

    if (gameState.balance < getUpgradePrice()) {
        btnBuyUpgrade.style.opacity = '0.5';
        btnBuyUpgrade.style.cursor = 'not-allowed';
    } else {
        btnBuyUpgrade.style.opacity = '1';
        btnBuyUpgrade.style.cursor = 'pointer';
    }
}

tapTarget.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevents modern browsers from firing simulated mousedown
    Array.from(e.touches).forEach(t => handleTap(t.clientX, t.clientY));
});

tapTarget.addEventListener('mousedown', (e) => {
    handleTap(e.clientX, e.clientY);
});

function handleTap(x, y) {
    gameState.balance += gameState.clickPower;
    updateUI();
    showFloatingText(x, y, `+${gameState.clickPower}`);
    scheduleSave();
}

function showFloatingText(x, y, text) {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    el.style.left = `${x - 20}px`;
    el.style.top = `${y - 20}px`;

    floatingTexts.appendChild(el);
    setTimeout(() => { el.remove(); }, 1000);
}

btnBuyUpgrade.addEventListener('click', () => {
    const price = getUpgradePrice();
    if (gameState.balance >= price) {
        gameState.balance -= price;
        gameState.clickPower += 1;
        updateUI();
        scheduleSave();
    }
});

let saveTimeout = null;
function scheduleSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveProgress, 1000);
}

async function saveProgress() {
    if (!gameState.token) return;
    try {
        await fetch(`${API_URL}/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${gameState.token}`
            },
            body: JSON.stringify({
                balance: gameState.balance,
                click_power: gameState.clickPower,
                claimed_rewards: gameState.claimedRewards
            })
        });
    } catch (e) {
        console.error('Failed to save progress', e);
    }
}

// ---------------- TAB LOGIC ----------------
const navBtns = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class
        navBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(t => t.classList.remove('active', 'hidden'));
        tabContents.forEach(t => t.classList.add('hidden'));

        // Add active class
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(tabId).classList.remove('hidden');
        document.getElementById(tabId).classList.add('active');

        if (tabId === 'tab-rewards') {
            renderRewards();
        } else if (tabId === 'tab-top') {
            renderLeaderboard();
        }
    });
});

// ---------------- LEADERBOARD LOGIC ----------------
const leaderboardListEl = document.getElementById('leaderboard-list');

async function renderLeaderboard() {
    leaderboardListEl.innerHTML = '<div style="text-align:center; padding: 20px;">Загрузка...</div>';
    try {
        const res = await fetch(`${API_URL}/leaderboard`);
        if (res.ok) {
            const players = await res.json();
            leaderboardListEl.innerHTML = '';

            if (players.length === 0) {
                leaderboardListEl.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 20px;">Пока нет игроков</div>';
                return;
            }

            players.forEach((player, index) => {
                const isMe = player.username === gameState.username;
                const div = document.createElement('div');
                div.className = `reward-item ${isMe ? 'highlight-me' : ''}`;
                div.style.background = isMe ? 'rgba(0, 242, 254, 0.2)' : 'rgba(0, 0, 0, 0.3)';
                div.style.marginBottom = '10px';

                let medal = `#${index + 1}`;
                if (index === 0) medal = '🥇';
                if (index === 1) medal = '🥈';
                if (index === 2) medal = '🥉';

                div.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span style="font-size: 1.5rem; font-weight: bold; width: 30px; text-align: center; color: var(--accent);">${medal}</span>
                        <div>
                            <h4 style="color: ${isMe ? 'var(--accent)' : 'white'};">${player.username} ${isMe ? '(Вы)' : ''}</h4>
                            <p style="color: var(--text-muted); font-size: 0.85em;">Сила клика: ${parseInt(player.click_power).toLocaleString('ru-RU')}</p>
                        </div>
                    </div>
                    <div style="text-align: right; background: rgba(0,0,0,0.5); padding: 5px 10px; border-radius: 8px;">
                        <span style="color: #ffd700; font-weight: bold;">${parseInt(player.balance).toLocaleString('ru-RU')}</span> 🪙
                    </div>
                `;
                leaderboardListEl.appendChild(div);
            });
        }
    } catch (e) {
        console.error('Leaderboard fetch error', e);
        leaderboardListEl.innerHTML = '<div style="text-align:center; color: red;">Ошибка загрузки</div>';
    }
}

// ---------------- REWARDS LOGIC ----------------
const rewardsListEl = document.getElementById('rewards-list');
let dynamicRewards = [];

async function loadQuests() {
    try {
        const res = await fetch(`${API_URL}/quests`, {
            headers: { 'Authorization': `Bearer ${gameState.token}` }
        });
        if (res.ok) {
            const data = await res.json();

            // Map DB quests to frontend format
            dynamicRewards = data.map(q => ({
                id: q.string_id,
                title: q.title,
                desc: q.description,
                condition_type: q.condition_type,
                condition_value: parseInt(q.condition_value),
                reward_amount: parseInt(q.reward_amount)
            }));

            // Check if all global quests are done, if so, generate infinite random ones
            const allClaimed = dynamicRewards.every(q => gameState.claimedRewards.includes(q.id));
            if (allClaimed && dynamicRewards.length > 0) {
                generateDailyQuests();
            }

            renderRewards();
        }
    } catch (e) {
        console.error('Failed to load quests', e);
    }
}

function generateDailyQuests() {
    // Generate 3 random infinite quests based on current state
    const randomQuests = [];
    for (let i = 1; i <= 3; i++) {
        // Base numbers on player's current balance/power to scale infinitely
        const factor = Math.max(1, Math.floor(gameState.clickPower * 1.5));
        const requiredCoins = 1000 * factor * i;
        const reward = 500 * factor * i;
        const qId = `daily_random_${gameState.clickPower}_${i}`; // Changes when power changes

        dynamicRewards.push({
            id: qId,
            title: `🎲 Ежедневный квест ${i}`,
            desc: `Накопи ${requiredCoins.toLocaleString('ru-RU')} монет (Награда: +${reward.toLocaleString('ru-RU')} 🪙)`,
            condition_type: 'balance',
            condition_value: requiredCoins,
            reward_amount: reward
        });
    }
}

function checkCondition(quest) {
    if (quest.condition_type === 'balance') return gameState.balance >= quest.condition_value;
    if (quest.condition_type === 'click_power') return gameState.clickPower >= quest.condition_value;
    return false;
}

function renderRewards() {
    rewardsListEl.innerHTML = '';

    dynamicRewards.forEach(reward => {
        const isClaimed = gameState.claimedRewards.includes(reward.id);
        const canClaim = !isClaimed && checkCondition(reward);

        const div = document.createElement('div');
        div.className = 'reward-item';
        div.innerHTML = `
            <div class="reward-info">
                <h4>${reward.title}</h4>
                <p>${reward.desc}</p>
            </div>
            <button class="btn primary" ${isClaimed || !canClaim ? 'disabled' : ''}>
                ${isClaimed ? 'Получено' : 'Собрать'}
            </button>
        `;

        if (!isClaimed && canClaim) {
            const btn = div.querySelector('button');
            btn.addEventListener('click', () => claimReward(reward.id));
        }

        rewardsListEl.appendChild(div);
    });
}

function claimReward(id) {
    if (gameState.claimedRewards.includes(id)) return;

    const reward = dynamicRewards.find(r => r.id === id);
    if (reward && checkCondition(reward)) {
        // Apply reward
        gameState.balance += reward.reward_amount;
        gameState.claimedRewards.push(id);

        // Re-check for infinite quests trigger
        const globalQuests = dynamicRewards.filter(q => !q.id.startsWith('daily_random_'));
        const allClaimed = globalQuests.every(q => gameState.claimedRewards.includes(q.id));
        if (allClaimed && !dynamicRewards.some(q => q.id.startsWith(`daily_random_${gameState.clickPower}`))) {
            generateDailyQuests();
        }

        updateUI();
        renderRewards();
        scheduleSave();
    }
}
