const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tapper_game',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

module.exports = {
    async query(text, params) {
        return pool.query(text, params);
    }
};
