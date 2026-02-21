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

const tapTarget = document.getElementById('tap-target');
const floatingTexts = document.getElementById('floating-texts');
const btnBuyUpgrade = document.getElementById('btn-buy-upgrade');
const upgradePriceEl = document.getElementById('upgrade-price');
const rebirthCountEl = document.getElementById('rebirth-count');
const rebirthMultiplierEl = document.getElementById('rebirth-multiplier');
const btnBuyRebirth = document.getElementById('btn-buy-rebirth');

let gameState = {
    balance: 0,
    clickPower: 1,
    rebirths: 0,
    claimedRewards: [],
    token: null,
    username: '',
    userId: null,
    role: 'user'
};

function getAvatarUrl(url, username) {
    if (url) return url;
    const initial = (username || 'U').charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${initial}&background=random&color=fff&size=100`;
}

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
            gameState.userId = data.user.id;
            gameState.role = data.user.role || 'user';
            gameState.balance = data.user.balance;
            gameState.clickPower = data.user.click_power;
            gameState.rebirths = data.user.rebirths || 0;
            gameState.claimedRewards = data.user.claimed_rewards || [];
            gameState.avatarUrl = data.user.avatar_url || '';
            headerAvatarEl.src = getAvatarUrl(gameState.avatarUrl, gameState.username);
            headerAvatarEl.style.display = 'block';
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
            gameState.userId = data.user.id;
            gameState.role = data.user.role || 'user';
            gameState.balance = data.user.balance;
            gameState.clickPower = data.user.click_power;
            gameState.rebirths = data.user.rebirths || 0;
            gameState.claimedRewards = data.user.claimed_rewards || [];
            gameState.avatarUrl = data.user.avatar_url || '';
            localStorage.setItem('tapper_token', data.token);
            headerAvatarEl.src = getAvatarUrl(gameState.avatarUrl, gameState.username);
            headerAvatarEl.style.display = 'block';
            showGame();
        } else {
            authError.textContent = data.error || 'Ошибка';
        }
    } catch (e) {
        authError.textContent = 'Ошибка сети';
    }
}

btnPlay.addEventListener('click', handleAuth);

// ---------------- PROFILE LOGIC ----------------
const profileUsernameEl = document.getElementById('profile-username');
const profileAvatarUploadEl = document.getElementById('profile-avatar-upload');
const profileAvatarPreviewEl = document.getElementById('profile-avatar-preview');
const headerAvatarEl = document.getElementById('header-avatar');
const btnSaveProfile = document.getElementById('btn-save-profile');
const profileMsg = document.getElementById('profile-msg');

let uploadedAvatarBase64 = null;

profileAvatarUploadEl.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        profileMsg.style.color = '#ff4d4d';
        profileMsg.textContent = 'Пожалуйста, выберите картинку';
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 150;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            uploadedAvatarBase64 = canvas.toDataURL('image/jpeg', 0.8);
            profileAvatarPreviewEl.src = uploadedAvatarBase64;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

const profileOldPassEl = document.getElementById('profile-old-pass');
const profileNewPassEl = document.getElementById('profile-new-pass');
const btnChangePassword = document.getElementById('btn-change-password');

function loadProfileUI() {
    profileUsernameEl.value = gameState.username;
    uploadedAvatarBase64 = null;

    if (gameState.avatarUrl) {
        profileAvatarPreviewEl.src = gameState.avatarUrl;
        headerAvatarEl.src = gameState.avatarUrl;
        headerAvatarEl.style.display = 'block';
    } else {
        profileAvatarPreviewEl.src = getAvatarUrl(null, gameState.username);
        headerAvatarEl.src = profileAvatarPreviewEl.src;
        headerAvatarEl.style.display = 'block';
    }
}

btnSaveProfile.addEventListener('click', async () => {
    const newUsername = profileUsernameEl.value.trim();
    const newAvatarUrl = uploadedAvatarBase64 !== null ? uploadedAvatarBase64 : gameState.avatarUrl;

    if (!newUsername) {
        profileMsg.style.color = '#ff4d4d';
        profileMsg.textContent = 'Имя не может быть пустым';
        return;
    }

    profileMsg.style.color = 'white';
    profileMsg.textContent = 'Сохранение...';

    try {
        const res = await fetch(`${API_URL}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${gameState.token}`
            },
            body: JSON.stringify({ username: newUsername, avatar_url: newAvatarUrl })
        });

        const data = await res.json();

        if (res.ok) {
            profileMsg.style.color = '#00f2fe';
            profileMsg.textContent = 'Профиль успешно сохранен!';

            gameState.username = newUsername;
            gameState.avatarUrl = newAvatarUrl;
            gameState.token = data.token; // Server gives a new token because username is used in JWT payload
            localStorage.setItem('tapper_token', data.token);

            updateUI();
            loadProfileUI();
        } else {
            profileMsg.style.color = '#ff4d4d';
            profileMsg.textContent = data.error || 'Ошибка сохранения';
        }
    } catch (e) {
        profileMsg.style.color = '#ff4d4d';
        profileMsg.textContent = 'Ошибка сети';
    }
});

btnChangePassword.addEventListener('click', async () => {
    const oldPassword = profileOldPassEl.value;
    const newPassword = profileNewPassEl.value;

    if (!oldPassword || !newPassword) {
        profileMsg.style.color = '#ff4d4d';
        profileMsg.textContent = 'Заполните оба пароля';
        return;
    }

    profileMsg.style.color = 'white';
    profileMsg.textContent = 'Смена пароля...';

    try {
        const res = await fetch(`${API_URL}/profile/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${gameState.token}`
            },
            body: JSON.stringify({ oldPassword, newPassword })
        });

        const data = await res.json();

        if (res.ok) {
            profileMsg.style.color = '#00f2fe';
            profileMsg.textContent = 'Пароль успешно изменен!';
            profileOldPassEl.value = '';
            profileNewPassEl.value = '';
        } else {
            profileMsg.style.color = '#ff4d4d';
            profileMsg.textContent = data.error || 'Ошибка смены пароля';
        }
    } catch (e) {
        profileMsg.style.color = '#ff4d4d';
        profileMsg.textContent = 'Ошибка сети';
    }
});
// -----------------------------------------------

function showGame() {
    authOverlay.classList.add('hidden');
    gameUI.classList.remove('hidden');

    // Check for admin
    const navBtnAdmin = document.getElementById('nav-btn-admin');
    if (gameState.role === 'admin') {
        navBtnAdmin.classList.remove('hidden');
        fetchAdminStats();
    } else {
        navBtnAdmin.classList.add('hidden');
    }

    updateUI();
    loadQuests();
    loadProfileUI();
}

// -------------- ADMIN LOGIC --------------
const adminUserCountEl = document.getElementById('admin-user-count');
const btnRefreshAdmin = document.getElementById('btn-refresh-admin');
const btnAddQuest = document.getElementById('btn-add-quest');
const adminQuestMsg = document.getElementById('admin-quest-msg');

async function fetchAdminStats() {
    if (!gameState.token || gameState.role !== 'admin') return;

    adminUserCountEl.textContent = '...';
    try {
        const res = await fetch(`${API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${gameState.token}` }
        });
        if (res.ok) {
            const data = await res.json();
            adminUserCountEl.textContent = data.totalUsers;
        }

        // Fetch Users List
        const usersRes = await fetch(`${API_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${gameState.token}` }
        });
        if (usersRes.ok) {
            const users = await usersRes.json();
            const usersListEl = document.getElementById('admin-users-list');
            usersListEl.innerHTML = '';
            users.forEach(u => {
                const div = document.createElement('div');
                div.style.padding = '10px';
                div.style.background = 'rgba(255,255,255,0.1)';
                div.style.borderRadius = '5px';
                div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <div>
                            <strong style="color:var(--accent)">${u.username}</strong>
                            <span style="color: gray; font-size: 0.8em; margin-left:10px;">ID: ${u.id}</span>
                        </div>
                        <div style="text-align: right;">
                            <div>🪙 ${parseInt(u.balance).toLocaleString('ru-RU')}</div>
                            <div style="font-size: 0.8em; color: gray;">💪 ${parseInt(u.click_power).toLocaleString('ru-RU')} | 🌟 ${u.rebirths || 0}</div>
                        </div>
                    </div>
                    <button class="btn primary" style="width: 100%; padding: 5px; font-size: 0.8em;" onclick="editAdminUser(${u.id}, '${u.username}', ${u.balance}, ${u.click_power}, ${u.rebirths || 0}, '${u.role}')">⚙️ Изменить</button>
                `;
                usersListEl.appendChild(div);
            });
        }

        // Render Quests List for Admin
        renderAdminQuests();
    } catch (e) {
        console.error(e);
    }
}

async function renderAdminQuests() {
    const listEl = document.getElementById('admin-quests-list');
    listEl.innerHTML = '';

    // Use the dynamicRewards that already fetched the quests
    const globalQuests = dynamicRewards.filter(q => !q.id.startsWith('daily_random_'));
    if (globalQuests.length === 0) {
        listEl.innerHTML = '<div style="color: gray;">Нет созданных квестов</div>';
        return;
    }

    globalQuests.forEach(q => {
        const div = document.createElement('div');
        div.style.padding = '10px';
        div.style.background = 'rgba(255,255,255,0.1)';
        div.style.borderRadius = '5px';
        div.innerHTML = `
            <div style="margin-bottom: 10px;">
                <strong style="color:var(--accent)">${q.title}</strong>
                <p style="font-size: 0.9em; margin-top: 5px;">${q.desc}</p>
                <div style="font-size: 0.8em; color: #ffd700; margin-top: 5px;">Награда: ${q.reward_amount.toLocaleString('ru-RU')} 🪙</div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn primary" style="padding: 5px 10px; font-size: 0.8em; flex: 1;" onclick="editAdminQuest('${q.id}')">✏️ Награда</button>
                <button class="btn" style="padding: 5px 10px; font-size: 0.8em; background: #ff4d4d; color: white; flex: 1;" onclick="deleteAdminQuest('${q.id}')">🗑️ Удалить</button>
            </div>
        `;
        listEl.appendChild(div);
    });
}

window.deleteAdminQuest = async function (questId) {
    if (!confirm('Удалить этот квест у всех игроков?')) return;
    try {
        const res = await fetch(`${API_URL}/admin/quests/${questId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${gameState.token}` }
        });
        if (res.ok) {
            await loadQuests();
            renderAdminQuests();
        }
    } catch (e) { console.error(e); }
}

window.editAdminQuest = async function (questId) {
    const quest = dynamicRewards.find(q => q.id === questId);
    if (!quest) return;

    const newReward = prompt(`Введите новую награду для "${quest.title}":`, quest.reward_amount);
    if (!newReward || isNaN(parseInt(newReward))) return;

    try {
        const res = await fetch(`${API_URL}/admin/quests/${questId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${gameState.token}`
            },
            body: JSON.stringify({
                title: quest.title,
                description: quest.desc,
                reward_amount: parseInt(newReward)
            })
        });
        if (res.ok) {
            await loadQuests();
            renderAdminQuests();
        }
    } catch (e) { console.error(e); }
}

// Global Modal Elements
const adminEditModal = document.getElementById('admin-edit-modal');
const adminEditId = document.getElementById('admin-edit-id');
const adminEditUsername = document.getElementById('admin-edit-username');
const adminEditBalance = document.getElementById('admin-edit-balance');
const adminEditPower = document.getElementById('admin-edit-power');
const adminEditRebirths = document.getElementById('admin-edit-rebirths');
const adminEditRole = document.getElementById('admin-edit-role');
const adminEditPassword = document.getElementById('admin-edit-password');
const btnAdminEditSave = document.getElementById('btn-admin-edit-save');

window.editAdminUser = function (userId, username, currentBalance, currentPower, currentRebirths, currentRole) {
    adminEditId.value = userId;
    adminEditUsername.value = username;
    adminEditBalance.value = currentBalance;
    adminEditPower.value = currentPower;
    adminEditRebirths.value = currentRebirths;
    adminEditRole.value = currentRole;
    adminEditPassword.value = ''; // Always empty initially

    adminEditModal.classList.remove('hidden');
}

btnAdminEditSave.addEventListener('click', async () => {
    const userId = adminEditId.value;
    const bodyData = {
        username: adminEditUsername.value.trim(),
        balance: adminEditBalance.value,
        click_power: adminEditPower.value,
        rebirths: adminEditRebirths.value,
        role: adminEditRole.value,
        new_password: adminEditPassword.value
    };

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${gameState.token}`
            },
            body: JSON.stringify(bodyData)
        });

        if (res.ok) {
            adminEditModal.classList.add('hidden');
            fetchAdminStats();
            alert('Данные изменены.');
        } else {
            const err = await res.json();
            alert('Ошибка сервера: ' + err.error);
        }
    } catch (e) {
        console.error(e);
        alert('Ошибка сети');
    }
});

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

function getRebirthPrice(currentRebirths) {
    if (currentRebirths === undefined) currentRebirths = gameState.rebirths;
    const price = 10000 * Math.pow(1.5, currentRebirths);
    if (!isFinite(price) || price > 1e300) {
        return 1e300; // Cap it so it doesn't become "Infinity"
    }
    return Math.floor(price);
}

function updateUI() {
    playerNameEl.textContent = gameState.username;
    balanceEl.textContent = gameState.balance.toLocaleString('ru-RU');
    clickPowerEl.textContent = gameState.clickPower.toLocaleString('ru-RU');
    upgradePriceEl.textContent = getUpgradePrice().toLocaleString('ru-RU');
    rebirthCountEl.textContent = gameState.rebirths.toLocaleString('ru-RU');
    rebirthMultiplierEl.textContent = (1 + gameState.rebirths).toLocaleString('ru-RU');

    // Update rebirth UI price
    const currentRebirthPrice = getRebirthPrice();
    const rebirthPriceDisplay = document.querySelector('#upgrade-rebirth p');
    if (rebirthPriceDisplay) {
        rebirthPriceDisplay.innerHTML = `Цена: ${currentRebirthPrice.toLocaleString('ru-RU')} 🪙 за 1 шт.`;
    }

    if (gameState.balance < getUpgradePrice()) {
        btnBuyUpgrade.style.opacity = '0.5';
        btnBuyUpgrade.style.cursor = 'not-allowed';
    } else {
        btnBuyUpgrade.style.opacity = '1';
        btnBuyUpgrade.style.cursor = 'pointer';
    }

    if (gameState.balance < currentRebirthPrice) {
        btnBuyRebirth.style.opacity = '0.5';
        btnBuyRebirth.style.cursor = 'not-allowed';
    } else {
        btnBuyRebirth.style.opacity = '1';
        btnBuyRebirth.style.cursor = 'pointer';
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
    const earned = gameState.clickPower * (1 + gameState.rebirths);
    gameState.balance += earned;
    updateUI();
    showFloatingText(x, y, `+${earned}`);
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

// ---- LOGOUT LOGIC ----
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('tapper_token');
        location.reload();
    });
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

btnBuyRebirth.addEventListener('click', () => {
    let price = getRebirthPrice(gameState.rebirths);
    let boughtAny = false;

    // Loop to buy maximum possible rebirths
    while (gameState.balance >= price) {
        gameState.balance -= price;
        gameState.rebirths += 1;
        boughtAny = true;
        // recalculate price for the next one
        price = getRebirthPrice(gameState.rebirths);
    }

    if (boughtAny) {
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
                rebirths: gameState.rebirths,
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
        } else if (tabId === 'tab-profile') {
            loadProfileUI();
        } else if (tabId === 'tab-chat') {
            loadChatContacts();
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

                if (!isMe) {
                    div.style.cursor = 'pointer';
                    div.title = 'Нажмите, чтобы открыть чат';
                    div.onclick = () => {
                        // Switch to chat tab
                        document.querySelector('[data-tab="tab-chat"]').click();
                        openChatDialog(player.id, player.username, getAvatarUrl(player.avatar_url, player.username));
                    };
                }

                let medal = `#${index + 1}`;
                if (index === 0) medal = '🥇';
                if (index === 1) medal = '🥈';
                if (index === 2) medal = '🥉';

                div.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span style="font-size: 1.5rem; font-weight: bold; width: 30px; text-align: center; color: var(--accent);">${medal}</span>
                        <div>
                            <h4 style="color: ${isMe ? 'var(--accent)' : 'white'};">${player.username} ${isMe ? '(Вы)' : ''}</h4>
                            <p style="color: var(--text-muted); font-size: 0.85em;">💪: ${parseInt(player.click_power).toLocaleString('ru-RU')} | 🌟: ${player.rebirths || 0}</p>
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

// ---------------- CHAT LOGIC ----------------
const chatListView = document.getElementById('chat-list-view');
const chatDialogView = document.getElementById('chat-dialog-view');
const chatContactsList = document.getElementById('chat-contacts-list');
const chatMessagesArea = document.getElementById('chat-messages-area');
const chatCurrentUsername = document.getElementById('chat-current-username');
const chatCurrentAvatar = document.getElementById('chat-current-avatar');
const chatInputText = document.getElementById('chat-input-text');
const chatImageUpload = document.getElementById('chat-image-upload');
const btnChatSend = document.getElementById('btn-chat-send');
const btnBackToChats = document.getElementById('btn-back-to-chats');
const btnChatBlockUser = document.getElementById('btn-chat-block-user');

let currentChatUserId = null;
let chatPollInterval = null;
let uploadedChatImageBase64 = null;
let isCurrentChatBlocked = false;

async function loadChatContacts() {
    chatListView.classList.remove('hidden');
    chatDialogView.classList.add('hidden');
    stopChatPolling();

    chatContactsList.innerHTML = '<div style="text-align:center;">Загрузка...</div>';
    try {
        const res = await fetch(`${API_URL}/chats`, {
            headers: { 'Authorization': `Bearer ${gameState.token}` }
        });
        if (res.ok) {
            const users = await res.json();
            chatContactsList.innerHTML = '';
            if (users.length === 0) {
                chatContactsList.innerHTML = '<div style="text-align:center; color: var(--text-muted);">Нет чатов.<br><br>Откройте меню "Топ"<br>и нажмите на любого игрока,<br>чтобы написать ему!</div>';
                return;
            }

            users.forEach(u => {
                const div = document.createElement('div');
                div.style.cssText = 'background: rgba(0,0,0,0.5); padding: 15px; border-radius: 10px; display: flex; align-items: center; gap: 15px; cursor: pointer; transition: 0.2s;';
                div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.1)';
                div.onmouseout = () => div.style.background = 'rgba(0,0,0,0.5)';
                const avatar = getAvatarUrl(u.avatar_url, u.username);
                div.onclick = () => openChatDialog(u.id, u.username, avatar);

                const statusColor = u.is_online ? '#00ff00' : '#888';
                div.innerHTML = `
                    <div style="position: relative;">
                        <img src="${avatar}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid ${statusColor};">
                        <div style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; border-radius: 50%; background: ${statusColor}; border: 2px solid #000;"></div>
                    </div>
                    <div style="flex: 1;">
                        <h4 style="margin: 0; color: white;">${u.username} <span style="font-size: 0.8em; color: var(--accent);">${u.role === 'admin' ? '(Admin)' : ''}</span></h4>
                    </div>
                `;
                chatContactsList.appendChild(div);
            });
        }
    } catch (e) {
        chatContactsList.innerHTML = '<div style="color:#ff4d4d;text-align:center;">Ошибка загрузки</div>';
    }
}

function openChatDialog(userId, username, avatar) {
    currentChatUserId = userId;
    chatCurrentUsername.textContent = username;
    chatCurrentAvatar.src = avatar;

    chatListView.classList.add('hidden');
    chatDialogView.classList.remove('hidden');

    chatInputText.value = '';
    uploadedChatImageBase64 = null;
    chatInputText.disabled = true;
    btnChatSend.disabled = true;

    loadMessages();
    startChatPolling();
}

function stopChatPolling() {
    if (chatPollInterval) clearInterval(chatPollInterval);
    chatPollInterval = null;
    currentChatUserId = null;
}

function startChatPolling() {
    stopChatPolling();
    chatPollInterval = setInterval(loadMessages, 3000);
}

async function loadMessages() {
    if (!currentChatUserId) return;
    try {
        const res = await fetch(`${API_URL}/messages/${currentChatUserId}`, {
            headers: { 'Authorization': `Bearer ${gameState.token}` }
        });
        if (res.ok) {
            const data = await res.json();

            isCurrentChatBlocked = data.iBlockedThem || data.theyBlockedMe;
            btnChatBlockUser.textContent = data.iBlockedThem ? 'Разблокировать' : '🚫 В ЧС';
            btnChatBlockUser.style.background = data.iBlockedThem ? 'var(--accent)' : '#ff4d4d';

            if (isCurrentChatBlocked) {
                chatInputText.disabled = true;
                btnChatSend.disabled = true;
                chatInputText.placeholder = data.iBlockedThem ? 'Вы заблокировали пользователя.' : 'Пользователь закрыл личные сообщения.';
            } else {
                chatInputText.disabled = false;
                btnChatSend.disabled = false;
                chatInputText.placeholder = 'Напишите сообщение...';
            }

            renderMessages(data.messages);
        }
    } catch (e) {
        console.error('Messages error', e);
    }
}

function renderMessages(msgs) {
    chatMessagesArea.innerHTML = '';
    if (msgs.length === 0) {
        chatMessagesArea.innerHTML = '<div style="text-align:center; color: gray; margin-top: 20px;">Нет сообщений. Напишите первым!</div>';
        return;
    }

    msgs.forEach(m => {
        const isMe = m.sender_id === gameState.userId;
        const div = document.createElement('div');
        div.style.cssText = `max-width: 80%; padding: 10px 15px; border-radius: 15px; margin-bottom: 5px; clear: both; word-break: break-word; float: ${isMe ? 'right' : 'left'}; background: ${isMe ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}; color: ${isMe ? 'black' : 'white'}; border-bottom-${isMe ? 'right' : 'left'}-radius: 0;`;

        if (m.image_url) {
            div.innerHTML += `<img src="${m.image_url}" style="max-width: 100%; border-radius: 10px; margin-bottom: 5px; cursor: pointer;" onclick="window.open('${m.image_url}')">`;
        }
        if (m.text) {
            div.innerHTML += `<div>${m.text}</div>`;
        }
        chatMessagesArea.appendChild(div);
    });

    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
}

btnBackToChats.addEventListener('click', () => {
    stopChatPolling();
    loadChatContacts();
});

if (chatImageUpload) {
    chatImageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('Файл слишком большой! Макс 5МБ');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            uploadedChatImageBase64 = event.target.result;
            chatInputText.placeholder = 'Картинка прикреплена! Добавьте текст...';
            chatInputText.focus();
        };
        reader.readAsDataURL(file);
    });
}

if (btnChatSend) {
    btnChatSend.addEventListener('click', async () => {
        if (isCurrentChatBlocked) return;
        const text = chatInputText.value.trim();
        if (!text && !uploadedChatImageBase64) return;

        chatInputText.disabled = true;
        btnChatSend.disabled = true;

        try {
            const res = await fetch(`${API_URL}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${gameState.token}`
                },
                body: JSON.stringify({
                    receiver_id: currentChatUserId,
                    text: text,
                    image_url: uploadedChatImageBase64
                })
            });

            if (res.ok) {
                chatInputText.value = '';
                uploadedChatImageBase64 = null;
                chatInputText.placeholder = 'Напишите сообщение...';
                loadMessages();
            } else if (res.status === 403) {
                alert('Пользователь закрыл личные сообщения.');
                loadMessages();
            }
        } catch (e) {
            alert('Ошибка отправки');
        }

        chatInputText.disabled = false;
        btnChatSend.disabled = false;
        chatInputText.focus();
    });
}

if (btnChatBlockUser) {
    btnChatBlockUser.addEventListener('click', async () => {
        if (!currentChatUserId) return;
        try {
            const res = await fetch(`${API_URL}/users/${currentChatUserId}/block`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${gameState.token}` }
            });
            if (res.ok) {
                loadMessages();
            }
        } catch (e) { }
    });
}

if (chatInputText) {
    chatInputText.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnChatSend.click();
    });
}
