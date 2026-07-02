const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPathEnv = process.env.DB_PATH;
let dbPath;

if (dbPathEnv) {
    dbPath = path.isAbsolute(dbPathEnv) ? dbPathEnv : path.resolve(process.cwd(), dbPathEnv);
} else {
    const dataDir = path.resolve(process.cwd(), 'data');
    dbPath = path.join(dataDir, 'notifications.db');
}

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

module.exports = db;
