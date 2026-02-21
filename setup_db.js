const db = require('./db');
const bcrypt = require('bcryptjs');

async function setup() {
    try {
        console.log('Connecting to database...');

        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                balance BIGINT DEFAULT 0,
                click_power BIGINT DEFAULT 1,
                claimed_rewards TEXT DEFAULT '[]',
                role VARCHAR(20) DEFAULT 'user'
            );
        `);
        console.log('Table users ensured.');

        const adminUser = 'admin';
        const adminPass = 'Adm!n_T@pper$2026_UltraStrong';

        const existingAdmin = await db.query('SELECT * FROM users WHERE username = $1', [adminUser]);

        if (existingAdmin.rows.length === 0) {
            const hash = await bcrypt.hash(adminPass, 10);
            await db.query(
                'INSERT INTO users (username, password_hash, balance, click_power, claimed_rewards, role) VALUES ($1, $2, $3, $4, $5, $6)',
                [adminUser, hash, 999999999999, 1000, '[]', 'admin']
            );
            console.log('Admin account created with 999,999,999,999 balance!');
            console.log(`Username: ${adminUser}`);
            console.log(`Password: ${adminPass}`);
        } else {
            console.log('Admin account already exists.');
            await db.query('UPDATE users SET balance = $1 WHERE username = $2', [999999999999, adminUser]);
            console.log('Admin balance reset to max.');
        }

        console.log('Database setup complete.');
        process.exit(0);
    } catch (err) {
        console.error('Error during setup:', err);
        process.exit(1);
    }
}

setup();
