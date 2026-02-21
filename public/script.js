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
    updateUI();
}

// Game Logic
function getUpgradePrice() {
    return Math.floor(10 * Math.pow(1.5, gameState.clickPower - 1));
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
        }
    });
});

// ---------------- REWARDS LOGIC ----------------
const rewardsListEl = document.getElementById('rewards-list');

const REWARDS = [
    {
        id: 'first_100',
        title: '🚀 Первый шаг',
        desc: 'Накопить 100 монет (Награда: +50 🪙)',
        condition: () => gameState.balance >= 100,
        claim: () => { gameState.balance += 50; }
    },
    {
        id: 'power_5',
        title: '💪 Силач',
        desc: 'Достигнуть силы клика 5 (Награда: +500 🪙)',
        condition: () => gameState.clickPower >= 5,
        claim: () => { gameState.balance += 500; }
    },
    {
        id: 'rich_10k',
        title: '💰 Магнат',
        desc: 'Накопить 10,000 монет (Награда: +10 Силы клика)',
        condition: () => gameState.balance >= 10000,
        claim: () => { gameState.clickPower += 10; }
    },
    {
        id: 'millionaire',
        title: '🏆 Миллионер',
        desc: 'Накопить 1,000,000 монет (Награда: +500,000 🪙)',
        condition: () => gameState.balance >= 1000000,
        claim: () => { gameState.balance += 500000; }
    }
];

function renderRewards() {
    rewardsListEl.innerHTML = '';

    REWARDS.forEach(reward => {
        const isClaimed = gameState.claimedRewards.includes(reward.id);
        const canClaim = !isClaimed && reward.condition();

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

    const reward = REWARDS.find(r => r.id === id);
    if (reward && reward.condition()) {
        reward.claim();
        gameState.claimedRewards.push(id);
        updateUI();
        renderRewards();
        scheduleSave();
    }
}
