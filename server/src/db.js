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

// Migration helper: add column if it doesn't exist
function addColumnIfMissing(table, column, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    console.log(`[DB] Added column ${table}.${column}`);
  }
}

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
    host TEXT DEFAULT 'local',
    subnet_id TEXT,
    ollama_url TEXT,
    bot_port INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subnets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cidr TEXT,
    gateway TEXT,
    host_type TEXT DEFAULT 'local',
    tailscale_ip TEXT,
    tailscale_name TEXT,
    ollama_url TEXT,
    ssh_host TEXT,
    status TEXT DEFAULT 'unknown',
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bot_processes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    subnet_id TEXT,
    host TEXT,
    port INTEGER,
    pid INTEGER,
    status TEXT DEFAULT 'stopped',
    ollama_url TEXT,
    started_at DATETIME,
    last_heartbeat DATETIME,
    logs TEXT,
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (subnet_id) REFERENCES subnets(id)
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

// Migrate existing agents table (add new columns for network support)
addColumnIfMissing('agents', 'host', "TEXT DEFAULT 'local'");
addColumnIfMissing('agents', 'subnet_id', 'TEXT');
addColumnIfMissing('agents', 'ollama_url', 'TEXT');
addColumnIfMissing('agents', 'bot_port', 'INTEGER');

// Evolution system columns
addColumnIfMissing('agents', 'level', 'INTEGER DEFAULT 1');
addColumnIfMissing('agents', 'xp', 'INTEGER DEFAULT 0');
addColumnIfMissing('agents', 'evolution_stage', "TEXT DEFAULT 'seed'");
addColumnIfMissing('agents', 'memory_capacity', 'INTEGER DEFAULT 10');
addColumnIfMissing('agents', 'total_interactions', 'INTEGER DEFAULT 0');

// Agent memory bank table
db.exec(`
  CREATE TABLE IF NOT EXISTS agent_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    type TEXT DEFAULT 'fact',
    content TEXT NOT NULL,
    importance INTEGER DEFAULT 1,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_agent_memories_agent ON agent_memories(agent_id);
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

// Seed subnets
const subnetSeeds = [
  {
    id: 'local-lan',
    name: 'Local LAN',
    cidr: '192.168.17.0/24',
    gateway: '192.168.17.1',
    host_type: 'local',
    ollama_url: 'http://127.0.0.1:11434',
  },
  {
    id: 'vps-main',
    name: 'VPS (srv1553778)',
    cidr: '141.136.47.94/32',
    gateway: '141.136.47.94',
    host_type: 'vps',
    ssh_host: 'root@141.136.47.94',
    ollama_url: 'http://141.136.47.94:11434',
  },
  {
    id: 'tailscale-mesh',
    name: 'Tailscale Mesh',
    host_type: 'tailscale',
    ollama_url: null,
  },
  {
    id: 'cat62',
    name: 'cat62',
    host_type: 'tailscale',
    tailscale_name: 'cat62',
    ollama_url: null,
  },
];

const existingSubnetCount = db.prepare('SELECT COUNT(*) as count FROM subnets').get().count;
if (existingSubnetCount === 0) {
  const insertSubnet = db.prepare(`
    INSERT OR IGNORE INTO subnets (id, name, cidr, gateway, host_type, ssh_host, ollama_url, tailscale_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSubnets = db.transaction((subnets) => {
    for (const s of subnets) {
      insertSubnet.run(s.id, s.name, s.cidr || null, s.gateway || null, s.host_type, s.ssh_host || null, s.ollama_url || null, s.tailscale_name || null);
    }
  });
  insertSubnets(subnetSeeds);
  console.log('[DB] Seeded 4 subnets');
}

// Seed new subnet-hosted bots
const subnetBotSeeds = [
  {
    id: 'netwatch',
    name: 'NetWatch',
    display_name: 'NetWatch',
    model: 'llama3.1:8b',
    color: '#14B8A6',
    role_desc: 'Network monitor — pings all subnets, tracks uptime, alerts on failures',
    host: 'local',
    subnet_id: 'local-lan',
  },
  {
    id: 'gateway-vps',
    name: 'Gateway',
    display_name: 'Gateway',
    model: 'nous-hermes2',
    color: '#F59E0B',
    role_desc: 'VPS gateway bot — routes relay messages between subnets, manages remote services',
    host: 'vps',
    subnet_id: 'vps-main',
  },
  {
    id: 'cat62-keeper',
    name: 'Cat62 Keeper',
    display_name: 'Cat62 Keeper',
    model: 'llama3.1:8b',
    color: '#8B5CF6',
    role_desc: 'cat62 node manager — monitors and manages services on the cat62 Tailscale device',
    host: 'cat62',
    subnet_id: 'cat62',
  },
  {
    id: 'relay-mesh',
    name: 'Relay Mesh',
    display_name: 'Relay Mesh',
    model: 'nous-hermes2',
    color: '#0EA5E9',
    role_desc: 'Mesh relay — bridges messages across all Tailscale nodes, subnet-aware routing',
    host: 'tailscale',
    subnet_id: 'tailscale-mesh',
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    display_name: 'Sentinel',
    model: 'llama3.1:8b',
    color: '#DC2626',
    role_desc: 'Security sentinel — monitors traffic anomalies, port scans, auth failures across all subnets',
    host: 'local',
    subnet_id: 'local-lan',
  },
];

// Seed Kali Ops Commander + SEO Scraping Legend
const specialAgentSeeds = [
  {
    id: 'kali-commander',
    name: 'Kali Commander',
    display_name: 'Kali Commander',
    model: 'llama3.1:8b',
    color: '#00FF41',
    role_desc: 'Kali ops — manages tunnels, deploys services across cat62 and VPS, network recon',
    host: 'local',
    subnet_id: 'local-lan',
  },
  {
    id: 'seo-scraper',
    name: 'SEO Legend',
    display_name: 'SEO Legend',
    model: 'nous-hermes2',
    color: '#FFD700',
    role_desc: 'Data scraping, SEO analysis, trend mining across web sources',
    host: 'local',
    subnet_id: 'local-lan',
  },
  {
    id: 'delivery-vps',
    name: 'Delivery',
    display_name: 'Delivery',
    model: 'llama3.1:8b',
    color: '#10B981',
    role_desc: 'Content delivery pipeline — ComfyUI + Brandulate orchestration on VPS',
    host: 'vps',
    subnet_id: 'vps-main',
  },
];
for (const b of specialAgentSeeds) {
  const exists = db.prepare('SELECT id FROM agents WHERE id = ?').get(b.id);
  if (!exists) {
    db.prepare(`
      INSERT INTO agents (id, name, display_name, model, color, role_desc, host, subnet_id, soul_path, workspace_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(b.id, b.name, b.display_name, b.model, b.color, b.role_desc, b.host, b.subnet_id,
      `D:/AI/openclaw/agents/${b.id}/SOUL.md`, `D:/AI/openclaw/.openclaw/agents/${b.id}/workspace`);
    console.log(`[DB] Seeded agent: ${b.id}`);
  }
}

const existingSubnetBots = db.prepare("SELECT COUNT(*) as count FROM agents WHERE id IN ('netwatch','gateway-vps','cat62-keeper','relay-mesh','sentinel')").get().count;
if (existingSubnetBots === 0) {
  const insertSubnetBot = db.prepare(`
    INSERT OR IGNORE INTO agents (id, name, display_name, model, color, role_desc, host, subnet_id, soul_path, workspace_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertBots = db.transaction((bots) => {
    for (const b of bots) {
      insertSubnetBot.run(
        b.id, b.name, b.display_name, b.model, b.color, b.role_desc,
        b.host, b.subnet_id,
        `D:/AI/openclaw/agents/${b.id}/SOUL.md`,
        `D:/AI/openclaw/.openclaw/agents/${b.id}/workspace`
      );
    }
  });
  insertBots(subnetBotSeeds);
  console.log('[DB] Seeded 5 subnet bots (netwatch, gateway, cat62-keeper, relay-mesh, sentinel)');
}

export default db;
