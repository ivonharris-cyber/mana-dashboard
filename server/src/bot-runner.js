/**
 * Bot Runner Engine — spawns, monitors, and manages bot agent processes
 * Each bot connects to Ollama for inference and the dashboard relay for comms
 */
import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track running bot processes
const runningBots = new Map(); // agentId -> { process, port, startedAt }

const BOT_AGENT_SCRIPT = path.join(__dirname, 'bot-agent.js');
const BASE_PORT = 4000; // Bots get ports 4001, 4002, etc.

let ioRef = null;

export function setBotIO(io) {
  ioRef = io;
}

function getNextPort() {
  const usedPorts = new Set();
  for (const [, bot] of runningBots) {
    usedPorts.add(bot.port);
  }
  // Also check DB for ports
  const dbPorts = db.prepare("SELECT port FROM bot_processes WHERE status = 'running'").all();
  for (const row of dbPorts) {
    if (row.port) usedPorts.add(row.port);
  }
  let port = BASE_PORT + 1;
  while (usedPorts.has(port)) port++;
  return port;
}

export function spawnBot(agentId, options = {}) {
  if (runningBots.has(agentId)) {
    return { error: 'Bot already running', pid: runningBots.get(agentId).process.pid };
  }

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) {
    return { error: 'Agent not found' };
  }

  const subnet = agent.subnet_id
    ? db.prepare('SELECT * FROM subnets WHERE id = ?').get(agent.subnet_id)
    : null;

  const port = options.port || getNextPort();
  const ollamaUrl = options.ollamaUrl || agent.ollama_url || subnet?.ollama_url || process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  const dashboardUrl = options.dashboardUrl || `http://127.0.0.1:${process.env.PORT || 3003}`;

  const env = {
    ...process.env,
    BOT_AGENT_ID: agentId,
    BOT_AGENT_NAME: agent.display_name || agent.name,
    BOT_MODEL: agent.model || 'nous-hermes2',
    BOT_PORT: String(port),
    BOT_OLLAMA_URL: ollamaUrl,
    BOT_DASHBOARD_URL: dashboardUrl,
    BOT_SOUL_PATH: agent.soul_path || '',
    BOT_SUBNET_ID: agent.subnet_id || '',
    BOT_HOST: agent.host || 'local',
    BOT_COLOR: agent.color || '#6B7280',
    BOT_ROLE: agent.role_desc || '',
  };

  console.log(`[BotRunner] Spawning ${agentId} on port ${port} (model: ${agent.model}, ollama: ${ollamaUrl})`);

  const child = fork(BOT_AGENT_SCRIPT, [], {
    env,
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    detached: false,
  });

  const logBuffer = [];

  child.stdout.on('data', (data) => {
    const line = `[${agentId}] ${data.toString().trim()}`;
    logBuffer.push(line);
    if (logBuffer.length > 200) logBuffer.shift();
    console.log(line);
  });

  child.stderr.on('data', (data) => {
    const line = `[${agentId}:ERR] ${data.toString().trim()}`;
    logBuffer.push(line);
    if (logBuffer.length > 200) logBuffer.shift();
    console.error(line);
  });

  child.on('message', (msg) => {
    if (msg.type === 'heartbeat') {
      db.prepare('UPDATE bot_processes SET last_heartbeat = CURRENT_TIMESTAMP WHERE agent_id = ? AND status = ?').run(agentId, 'running');
    }
    if (msg.type === 'relay' && ioRef) {
      // Forward bot relay messages to dashboard
      ioRef.to('relay').emit('relay:message', {
        source: agentId,
        target: msg.target || null,
        type: msg.msgType || 'bot',
        content: msg.content,
        created_at: new Date().toISOString(),
      });
      // Save to DB
      db.prepare('INSERT INTO relay_messages (source, target, type, content) VALUES (?, ?, ?, ?)').run(
        agentId, msg.target || null, msg.msgType || 'bot', msg.content
      );
    }
    if (msg.type === 'status') {
      db.prepare('UPDATE agents SET status = ? WHERE id = ?').run(msg.status, agentId);
      if (ioRef) {
        ioRef.to('relay').emit('agent:status', { id: agentId, status: msg.status });
      }
    }
  });

  child.on('exit', (code) => {
    console.log(`[BotRunner] ${agentId} exited with code ${code}`);
    runningBots.delete(agentId);
    db.prepare("UPDATE bot_processes SET status = 'stopped', logs = ? WHERE agent_id = ? AND status = 'running'").run(
      logBuffer.join('\n'), agentId
    );
    db.prepare("UPDATE agents SET status = 'offline' WHERE id = ?").run(agentId);
    if (ioRef) {
      ioRef.to('relay').emit('agent:status', { id: agentId, status: 'offline' });
    }
  });

  runningBots.set(agentId, {
    process: child,
    port,
    startedAt: new Date().toISOString(),
    logs: logBuffer,
  });

  // Record in DB
  db.prepare("DELETE FROM bot_processes WHERE agent_id = ? AND status != 'running'").run(agentId);
  db.prepare(`
    INSERT INTO bot_processes (agent_id, subnet_id, host, port, pid, status, ollama_url, started_at, last_heartbeat)
    VALUES (?, ?, ?, ?, ?, 'running', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(agentId, agent.subnet_id, agent.host || 'local', port, child.pid, ollamaUrl);

  // Update agent status
  db.prepare("UPDATE agents SET status = 'online', bot_port = ? WHERE id = ?").run(port, agentId);
  if (ioRef) {
    ioRef.to('relay').emit('agent:status', { id: agentId, status: 'online' });
  }

  return { success: true, pid: child.pid, port, agentId };
}

export function stopBot(agentId) {
  const bot = runningBots.get(agentId);
  if (!bot) {
    return { error: 'Bot not running' };
  }

  console.log(`[BotRunner] Stopping ${agentId} (PID ${bot.process.pid})`);
  bot.process.kill('SIGTERM');

  // Cleanup happens in the exit handler
  return { success: true, agentId };
}

export function getBotStatus(agentId) {
  const bot = runningBots.get(agentId);
  if (!bot) {
    return { running: false, agentId };
  }
  return {
    running: true,
    agentId,
    pid: bot.process.pid,
    port: bot.port,
    startedAt: bot.startedAt,
    logCount: bot.logs.length,
  };
}

export function getBotLogs(agentId, limit = 50) {
  const bot = runningBots.get(agentId);
  if (bot) {
    return bot.logs.slice(-limit);
  }
  // Check DB for old logs
  const proc = db.prepare("SELECT logs FROM bot_processes WHERE agent_id = ? ORDER BY started_at DESC LIMIT 1").get(agentId);
  if (proc?.logs) {
    return proc.logs.split('\n').slice(-limit);
  }
  return [];
}

export function listRunningBots() {
  const bots = [];
  for (const [agentId, bot] of runningBots) {
    bots.push({
      agentId,
      pid: bot.process.pid,
      port: bot.port,
      startedAt: bot.startedAt,
      logCount: bot.logs.length,
    });
  }
  return bots;
}

export function stopAllBots() {
  for (const [agentId] of runningBots) {
    stopBot(agentId);
  }
}
