/**
 * Bot Agent — standalone process that connects to Ollama + dashboard relay
 * Spawned by bot-runner.js, communicates via IPC (process.send)
 *
 * Environment variables:
 *   BOT_AGENT_ID, BOT_AGENT_NAME, BOT_MODEL, BOT_PORT,
 *   BOT_OLLAMA_URL, BOT_DASHBOARD_URL, BOT_SOUL_PATH,
 *   BOT_SUBNET_ID, BOT_HOST, BOT_COLOR, BOT_ROLE
 */
import http from 'http';
import fs from 'fs';

const AGENT_ID = process.env.BOT_AGENT_ID || 'unknown';
const AGENT_NAME = process.env.BOT_AGENT_NAME || 'Bot';
const MODEL = process.env.BOT_MODEL || 'nous-hermes2';
const PORT = parseInt(process.env.BOT_PORT) || 4001;
const OLLAMA_URL = process.env.BOT_OLLAMA_URL || 'http://127.0.0.1:11434';
const DASHBOARD_URL = process.env.BOT_DASHBOARD_URL || 'http://127.0.0.1:3003';
const SOUL_PATH = process.env.BOT_SOUL_PATH || '';
const SUBNET_ID = process.env.BOT_SUBNET_ID || '';
const HOST = process.env.BOT_HOST || 'local';
const ROLE = process.env.BOT_ROLE || '';

let systemPrompt = `You are ${AGENT_NAME}, an AI agent in the ManaMetaMaori network. ${ROLE}. You are hosted on subnet "${SUBNET_ID}" (${HOST}). Be concise and helpful.`;

// Load SOUL.md if available
if (SOUL_PATH) {
  try {
    const soulContent = fs.readFileSync(SOUL_PATH, 'utf-8');
    systemPrompt = soulContent;
    console.log(`Loaded SOUL.md from ${SOUL_PATH}`);
  } catch {
    console.log(`No SOUL.md at ${SOUL_PATH}, using default prompt`);
  }
}

// Memory bank — loaded from dashboard API on startup + refreshed periodically
let memoryBank = [];

async function loadMemoryBank() {
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/agents/${AGENT_ID}/memories`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      memoryBank = data.memories || [];
      console.log(`Loaded ${memoryBank.length} memories for ${AGENT_NAME}`);
    }
  } catch {
    // Dashboard may not be authed for internal calls — memories loaded best-effort
  }
}

function buildSystemPrompt() {
  let prompt = systemPrompt;
  if (memoryBank.length > 0) {
    const memoryText = memoryBank
      .map((m) => `[${m.type}] ${m.content}`)
      .join('\n');
    prompt += `\n\n## Memory Bank (${memoryBank.length} entries)\n${memoryText}`;
  }
  return prompt;
}

// Load memories on startup (delayed to allow dashboard to be ready)
setTimeout(loadMemoryBank, 3000);
// Refresh memories every 5 minutes
setInterval(loadMemoryBank, 300000);

// ── Ollama Chat ───────────────────────────────────────────────────────

async function ollamaChat(messages) {
  const body = JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      ...messages,
    ],
    stream: false,
  });

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`Ollama ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.message?.content || data.response || '';
}

async function ollamaPing() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ── HTTP Server (bot API) ─────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Content-Type', 'application/json');

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    const ollamaOk = await ollamaPing();
    res.end(JSON.stringify({
      agent: AGENT_ID,
      name: AGENT_NAME,
      model: MODEL,
      subnet: SUBNET_ID,
      host: HOST,
      ollama: ollamaOk ? 'connected' : 'disconnected',
      uptime: process.uptime(),
      status: 'online',
    }));
    return;
  }

  // Chat endpoint
  if (url.pathname === '/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { message, messages: msgHistory } = JSON.parse(body);
        const msgs = msgHistory || [{ role: 'user', content: message }];
        const reply = await ollamaChat(msgs);

        // Relay the interaction to dashboard
        if (process.send) {
          process.send({
            type: 'relay',
            target: null,
            msgType: 'chat',
            content: `[${AGENT_NAME}] User: ${message || msgs[msgs.length - 1]?.content} → ${reply.substring(0, 200)}`,
          });
        }

        res.end(JSON.stringify({ reply, agent: AGENT_ID, model: MODEL }));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Execute a task (relay-triggered)
  if (url.pathname === '/task' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { task, from } = JSON.parse(body);
        const reply = await ollamaChat([
          { role: 'user', content: `Task from ${from || 'dashboard'}: ${task}` },
        ]);

        if (process.send) {
          process.send({
            type: 'relay',
            target: from || 'dashboard',
            msgType: 'task-result',
            content: `[${AGENT_NAME}] Task complete: ${reply.substring(0, 300)}`,
          });
        }

        res.end(JSON.stringify({ result: reply, agent: AGENT_ID }));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Subnet scan (for netwatch/sentinel bots)
  if (url.pathname === '/scan' && req.method === 'GET') {
    const scanResult = {
      agent: AGENT_ID,
      subnet: SUBNET_ID,
      timestamp: new Date().toISOString(),
      ollamaReachable: await ollamaPing(),
      dashboardUrl: DASHBOARD_URL,
      port: PORT,
    };

    if (process.send) {
      process.send({
        type: 'relay',
        msgType: 'scan',
        content: `[${AGENT_NAME}] Subnet scan: ollama=${scanResult.ollamaReachable ? 'UP' : 'DOWN'}`,
      });
    }

    res.end(JSON.stringify(scanResult));
    return;
  }

  // Info
  if (url.pathname === '/' && req.method === 'GET') {
    res.end(JSON.stringify({
      agent: AGENT_ID,
      name: AGENT_NAME,
      model: MODEL,
      subnet: SUBNET_ID,
      host: HOST,
      role: ROLE,
      endpoints: ['/health', '/chat', '/task', '/scan'],
    }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Bot ${AGENT_NAME} (${AGENT_ID}) listening on port ${PORT}`);
  console.log(`  Model: ${MODEL}`);
  console.log(`  Ollama: ${OLLAMA_URL}`);
  console.log(`  Subnet: ${SUBNET_ID} (${HOST})`);

  // Notify parent we're online
  if (process.send) {
    process.send({ type: 'status', status: 'online' });
  }
});

// ── Heartbeat ─────────────────────────────────────────────────────────

const heartbeatInterval = setInterval(() => {
  if (process.send) {
    process.send({ type: 'heartbeat', uptime: process.uptime() });
  }
}, 30000);

// ── Graceful shutdown ─────────────────────────────────────────────────

function shutdown() {
  console.log(`Bot ${AGENT_ID} shutting down...`);
  clearInterval(heartbeatInterval);
  if (process.send) {
    process.send({ type: 'status', status: 'offline' });
  }
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
