require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// DB connection validation
db.query('SELECT NOW()').then(() => console.log('Connected to PostgreSQL')).catch(console.error);

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
                'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, balance, click_power, claimed_rewards',
                [username, hash]
            );

            const user = result.rows[0];
            const claimed_rewards = JSON.parse(user.claimed_rewards || '[]');

            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
            res.json({ token, user: { username: user.username, balance: parseInt(user.balance), click_power: parseInt(user.click_power), claimed_rewards } });
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
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
        res.json({ token, user: { username: user.username, balance: parseInt(user.balance), click_power: parseInt(user.click_power), claimed_rewards } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get profile
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT username, balance, click_power, claimed_rewards FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = result.rows[0];
        const claimed_rewards = JSON.parse(user.claimed_rewards || '[]');

        res.json({ user: { username: user.username, balance: parseInt(user.balance), click_power: parseInt(user.click_power), claimed_rewards } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Save progress
app.post('/api/save', authenticateToken, async (req, res) => {
    try {
        let { balance, click_power, claimed_rewards } = req.body;
        if (typeof balance !== 'number' || typeof click_power !== 'number') {
            return res.status(400).json({ error: 'Invalid data types' });
        }

        const rewardsStr = JSON.stringify(claimed_rewards || []);
        const result = await db.query(
            'UPDATE users SET balance = $1, click_power = $2, claimed_rewards = $3 WHERE id = $4',
            [balance, click_power, rewardsStr, req.user.id]
        );

        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT username, balance, click_power FROM users ORDER BY balance DESC LIMIT 50'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
        if (req.user.username !== 'admin') {
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
        if (req.user.username !== 'admin') {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
