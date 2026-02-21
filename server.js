require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const path = require('path');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(cors());
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// DB connection validation
db.query('SELECT NOW()').then(() => console.log('Connected to PostgreSQL')).catch(console.error);

// Keep-Alive Ping (prevents Render from sleeping)
app.get('/api/ping', (req, res) => {
    res.send('pong');
});

if (process.env.RENDER_EXTERNAL_HOSTNAME) {
    const https = require('https');
    setInterval(() => {
        https.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}/api/ping`);
    }, 14 * 60 * 1000); // Ping every 14 minutes
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

        const hash = await bcrypt.hash(password, 10);

        try {
            const result = await db.query(
                'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, balance, click_power, claimed_rewards, rebirths, avatar_url',
                [username, hash]
            );

            const user = result.rows[0];
            const claimed_rewards = JSON.parse(user.claimed_rewards || '[]');

            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
            res.json({ token, user: { username: user.username, balance: parseInt(user.balance), click_power: parseInt(user.click_power), rebirths: parseInt(user.rebirths || 0), avatar_url: user.avatar_url, claimed_rewards } });
        } catch (dbErr) {
            if (dbErr.code === '23505') { // unique violation
                return res.status(400).json({ error: 'Username already exists' });
            }
            throw dbErr;
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(400).json({ error: 'User not found' });

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

        const claimed_rewards = JSON.parse(user.claimed_rewards || '[]');
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
        res.json({ token, user: { username: user.username, role: user.role, balance: parseInt(user.balance), click_power: parseInt(user.click_power), rebirths: parseInt(user.rebirths || 0), avatar_url: user.avatar_url, claimed_rewards } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get profile
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT username, role, balance, click_power, claimed_rewards, rebirths, avatar_url FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = result.rows[0];
        const claimed_rewards = JSON.parse(user.claimed_rewards || '[]');

        res.json({ user: { username: user.username, role: user.role, balance: parseInt(user.balance), click_power: parseInt(user.click_power), rebirths: parseInt(user.rebirths || 0), avatar_url: user.avatar_url, claimed_rewards } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Save progress
app.post('/api/save', authenticateToken, async (req, res) => {
    try {
        let { balance, click_power, claimed_rewards, rebirths } = req.body;
        if (typeof balance !== 'number' || typeof click_power !== 'number') {
            return res.status(400).json({ error: 'Invalid data types' });
        }
        rebirths = typeof rebirths === 'number' ? rebirths : 0;

        const rewardsStr = JSON.stringify(claimed_rewards || []);
        const result = await db.query(
            'UPDATE users SET balance = $1, click_power = $2, claimed_rewards = $3, rebirths = $4 WHERE id = $5',
            [balance, click_power, rewardsStr, rebirths, req.user.id]
        );

        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ------------------ PROFILE API ------------------
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { username, avatar_url } = req.body;
        if (!username || username.trim() === '') {
            return res.status(400).json({ error: 'Username cannot be empty' });
        }

        // Check if username is taken by someone else
        const existing = await db.query('SELECT * FROM users WHERE username = $1 AND id != $2', [username, req.user.id]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Username is already taken' });
        }

        await db.query('UPDATE users SET username = $1, avatar_url = $2 WHERE id = $3', [username, avatar_url, req.user.id]);

        // Return new token because username changed
        const token = jwt.sign({ id: req.user.id, username: username }, JWT_SECRET);
        res.json({ success: true, token, username, avatar_url });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/profile/password', authenticateToken, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 5) {
            return res.status(400).json({ error: 'New password must be at least 5 characters' });
        }

        const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
        const validPassword = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
        if (!validPassword) {
            return res.status(400).json({ error: 'Неверный старый пароль' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);

        res.json({ success: true });
    } catch (err) {
        console.error('Password error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});
// -------------------------------------------------

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const result = await db.query(
            "SELECT username, balance, click_power, rebirths FROM users WHERE role != 'admin' ORDER BY balance DESC LIMIT 50"
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// Get Quests
app.get('/api/quests', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM quests ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Quests error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin Create Quest
app.post('/api/admin/quests', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admins only.' });
        }

        const { title, description, condition_type, condition_value, reward_amount } = req.body;
        const string_id = 'quest_' + Date.now();

        await db.query(
            'INSERT INTO quests (string_id, title, description, condition_type, condition_value, reward_amount) VALUES ($1, $2, $3, $4, $5, $6)',
            [string_id, title, description, condition_type, condition_value, reward_amount]
        );

        res.json({ success: true, string_id });
    } catch (err) {
        console.error('Admin create quest error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin Stats
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admins only.' });
        }

        const result = await db.query('SELECT COUNT(*) FROM users');
        const userCount = result.rows[0].count;

        res.json({ totalUsers: parseInt(userCount) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/admin/quests/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied.' });
        }
        const { id } = req.params;
        await db.query('DELETE FROM quests WHERE string_id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/admin/quests/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied.' });
        }
        const { id } = req.params;
        const { title, description, reward_amount } = req.body;
        await db.query(
            'UPDATE quests SET title = $1, description = $2, reward_amount = $3 WHERE string_id = $4',
            [title, description, reward_amount, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied.' });
        }
        const result = await db.query('SELECT id, username, balance, click_power, rebirths, role FROM users ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/admin/users/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied.' });
        }
        const { id } = req.params;
        const { username, balance, click_power, rebirths, role, new_password } = req.body;

        // Start building dynamic query
        let updates = [];
        let values = [];
        let queryIndex = 1;

        if (username !== undefined) {
            updates.push(`username = $${queryIndex++}`);
            values.push(username);
        }
        if (balance !== undefined) {
            updates.push(`balance = $${queryIndex++}`);
            values.push(parseInt(balance));
        }
        if (click_power !== undefined) {
            updates.push(`click_power = $${queryIndex++}`);
            values.push(parseInt(click_power));
        }
        if (rebirths !== undefined) {
            updates.push(`rebirths = $${queryIndex++}`);
            values.push(parseInt(rebirths));
        }
        if (role !== undefined) {
            updates.push(`role = $${queryIndex++}`);
            values.push(role);
        }

        // Handle password change separately to hash it
        if (new_password && new_password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(new_password.trim(), salt);
            updates.push(`password_hash = $${queryIndex++}`);
            values.push(hashed);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        // Add the ID
        values.push(id);
        const queryString = `UPDATE users SET ${updates.join(', ')} WHERE id = $${queryIndex}`;

        await db.query(queryString, values);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
