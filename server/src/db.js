import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'mana.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT,
    model TEXT,
    color TEXT,
    role_desc TEXT,
    status TEXT DEFAULT 'offline',
    avatar_url TEXT,
    telegram_token TEXT,
    soul_path TEXT,
    workspace_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS relay_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT,
    target TEXT,
    type TEXT DEFAULT 'info',
    content TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT,
    name TEXT,
    status TEXT DEFAULT 'active',
    context TEXT,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS service_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service TEXT,
    status TEXT,
    response_time INTEGER,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed admin user if not exists
const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existingAdmin) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)').run(
    'admin', hashedPassword, 'Ivon Harris', 'admin'
  );
  console.log('[DB] Seeded admin user');
}

// Seed agents if not exists
const agentSeeds = [
  {
    id: 'tina',
    name: 'Tina',
    display_name: 'Tina',
    model: 'nous-hermes2',
    color: '#EC4899',
    role_desc: 'Content/reels'
  },
  {
    id: 'lozgic',
    name: 'LOZGIC',
    display_name: 'Lozgic',
    model: 'qwen3.5:35b',
    color: '#3B82F6',
    role_desc: 'Strategy'
  },
  {
    id: 'forge',
    name: 'FORGE',
    display_name: 'Forge',
    model: 'qwen3.5:35b',
    color: '#F97316',
    role_desc: 'Code/DevOps'
  },
  {
    id: 'security',
    name: 'Security',
    display_name: 'Security',
    model: 'llama3.1:8b',
    color: '#EF4444',
    role_desc: 'Monitoring'
  },
  {
    id: 'hapai',
    name: 'HAPI',
    display_name: 'Hapai',
    model: 'deepseek-coder-v2',
    color: '#22C55E',
    role_desc: 'Intranet'
  },
  {
    id: 'creative',
    name: 'Creative',
    display_name: 'Creative',
    model: 'mixtral-creative',
    color: '#A855F7',
    role_desc: 'Creative'
  },
  {
    id: 'main',
    name: 'Main',
    display_name: 'Main',
    model: 'qwen3.5:35b',
    color: '#06B6D4',
    role_desc: 'Default'
  }
];

const insertAgent = db.prepare(`
  INSERT OR IGNORE INTO agents (id, name, display_name, model, color, role_desc, soul_path, workspace_path)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const existingAgentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get().count;
if (existingAgentCount === 0) {
  const insertMany = db.transaction((agents) => {
    for (const agent of agents) {
      insertAgent.run(
        agent.id,
        agent.name,
        agent.display_name,
        agent.model,
        agent.color,
        agent.role_desc,
        `D:/AI/openclaw/agents/${agent.id}/SOUL.md`,
        `D:/AI/openclaw/.openclaw/agents/${agent.id}/workspace`
      );
    }
  });
  insertMany(agentSeeds);
  console.log('[DB] Seeded 7 agents');
}

export default db;
