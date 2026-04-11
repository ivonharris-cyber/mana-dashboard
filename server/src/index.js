import 'dotenv/config';
import express from 'express';
import http from 'http';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

import db from './db.js';
import authRoutes from './routes/auth.js';
import agentRoutes from './routes/agents.js';
import servicesRoutes from './routes/services.js';
import relayRoutes, { setIO } from './routes/relay.js';
import workflowRoutes from './routes/workflows.js';
import sessionRoutes from './routes/sessions.js';
import networkRoutes from './routes/network.js';
import botRoutes from './routes/bots.js';
import pipelineRoutes from './routes/pipeline.js';
import obsidianRoutes from './routes/obsidian.js';
import studioRoutes from './routes/studio.js';
import systemRoutes from './routes/system.js';
import hapaiRoutes from './routes/hapai.js';
import swarmRoutes from './routes/swarm.js';
import { setBotIO, stopAllBots } from './bot-runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT) || 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'mana-dashboard-secret';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

// Express app
const app = express();
const server = createServer(app);

// ── CORS Origins — locked to known hosts ──
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : [
      'http://141.136.47.94:3003',
      'http://100.119.206.43:3003',
      'http://localhost:3003',
      'http://localhost:5173'
    ];

const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (same-origin, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error('CORS: origin not allowed'), false);
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Share io with relay routes + bot runner
setIO(io);
setBotIO(io);

// ── Middleware ──────────────────────────────────────────────────────────

// CORS — locked to allowed origins only
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('CORS: origin not allowed'), false);
  },
  credentials: true
}));

// Helmet — full security headers + CSP enabled
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  // X-Frame-Options DENY
  frameguard: { action: 'deny' },
  // X-Content-Type-Options nosniff (on by default, explicit here)
  noSniff: true,
  // Referrer-Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Hide X-Powered-By
  hidePoweredBy: true
}));

// Global rate limiting: 500 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});
app.use(limiter);

// Strict webhook rate limiter: 30 requests per minute
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Webhook rate limit exceeded. Max 30 requests per minute.' }
});

// Webhook auth middleware — requires Bearer token
function webhookAuth(req, res, next) {
  if (!WEBHOOK_SECRET) {
    // If no secret configured, allow (dev mode)
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Webhook authentication required. Provide Authorization: Bearer <token>' });
  }
  const token = authHeader.split(' ')[1];
  if (token !== WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Invalid webhook token' });
  }
  next();
}

// Body parsing
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
    if (res.statusCode >= 400) {
      console.warn(log);
    } else {
      console.log(log);
    }
  });
  next();
});

// ── API Routes ─────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/relay', relayRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/obsidian', obsidianRoutes);
app.use('/api/studio', studioRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/hapai', hapaiRoutes);
app.use('/api/swarm', swarmRoutes);

// API health endpoint (no auth required)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ── Webhook for n8n agent diary (rate-limited + token-authed) ──
app.post('/api/webhook/relay', webhookLimiter, webhookAuth, (req, res) => {
  const { agent, task, output, source, type, content } = req.body;
  const msgSource = source || agent || 'n8n-agent';
  const msgType = type || 'agent-diary';
  const msgContent = content || `[${agent || 'Agent'}] ${task || ''}: ${(output || '').substring(0, 500)}`;

  try {
    const result = db.prepare(
      'INSERT INTO relay_messages (source, target, type, content, metadata) VALUES (?, ?, ?, ?, ?)'
    ).run(msgSource, null, msgType, msgContent,
      JSON.stringify({ agent, task, output: (output || '').substring(0, 1000), timestamp: new Date().toISOString() }));

    const message = db.prepare('SELECT * FROM relay_messages WHERE id = ?').get(result.lastInsertRowid);

    // Log agent activity + XP
    if (agent) {
      const agentId = agent.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      try {
        db.prepare('INSERT INTO agent_activity (agent_id, action, detail, xp_gained) VALUES (?, ?, ?, ?)').run(agentId, 'task', (task || '').substring(0, 200), 10);
        db.prepare('UPDATE agents SET status = ?, xp = xp + 10, total_interactions = total_interactions + 1 WHERE id = ?').run('working', agentId);
      } catch { /* agent may not exist */ }
    }

    if (io) io.to('relay').emit('relay:message', message);
    res.status(201).json({ logged: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('[Webhook] Relay error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Webhook for agent chat (rate-limited + token-authed) ──
app.post('/api/webhook/chat/:agentId', webhookLimiter, webhookAuth, (req, res) => {
  const { agentId } = req.params;
  const { message } = req.body;

  // Forward to n8n agent webhook
  const n8nUrl = `http://localhost:5678/webhook/${agentId}`;
  const postData = JSON.stringify({ prompt: message, session_id: `dashboard-${Date.now()}` });

  const n8nReq = http.request(n8nUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (n8nRes) => {
    let data = '';
    n8nRes.on('data', chunk => data += chunk);
    n8nRes.on('end', () => {
      try {
        const result = JSON.parse(data);
        const output = Array.isArray(result) ? result[0]?.output : result?.output;

        // Log conversation to relay
        db.prepare('INSERT INTO relay_messages (source, target, type, content, metadata) VALUES (?, ?, ?, ?, ?)').run(
          'ivon', agentId, 'chat', message, null);
        db.prepare('INSERT INTO relay_messages (source, target, type, content, metadata) VALUES (?, ?, ?, ?, ?)').run(
          agentId, 'ivon', 'chat', (output || '').substring(0, 2000), null);

        if (io) {
          io.to('relay').emit('relay:message', { source: agentId, type: 'chat', content: (output || '').substring(0, 500) });
        }

        res.json({ agent: agentId, reply: output });
      } catch {
        res.json({ agent: agentId, reply: data });
      }
    });
  });
  n8nReq.on('error', (err) => res.status(500).json({ error: err.message }));
  n8nReq.write(postData);
  n8nReq.end();
});

// ── Static files + SPA ─────────────────────────────────────────────────

const distPath = path.join(__dirname, '..', '..', 'app', 'dist');
app.use(express.static(distPath));

// SPA catch-all: serve index.html for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).json({ error: 'App not built yet. Run: cd app && npm run build' });
    }
  });
});

// ── Socket.IO ──────────────────────────────────────────────────────────

// JWT authentication on handshake
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };
    next();
  } catch (err) {
    return next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.user.username} (${socket.id})`);

  // Join relay room automatically
  socket.join('relay');

  // Handle relay:send events
  socket.on('relay:send', (data) => {
    const message = {
      source: data.source || socket.user.username,
      target: data.target || null,
      type: data.type || 'info',
      content: data.content,
      metadata: data.metadata || null,
      created_at: new Date().toISOString()
    };

    // Save to database
    try {
      const result = db.prepare(
        'INSERT INTO relay_messages (source, target, type, content, metadata) VALUES (?, ?, ?, ?, ?)'
      ).run(
        message.source,
        message.target,
        message.type,
        message.content,
        message.metadata ? JSON.stringify(message.metadata) : null
      );

      message.id = result.lastInsertRowid;

      // Broadcast to relay room
      io.to('relay').emit('relay:message', message);
    } catch (err) {
      console.error('[Socket] Save relay message error:', err.message);
      socket.emit('relay:error', { error: 'Failed to save message' });
    }
  });

  // Handle agent status updates
  socket.on('agent:status', (data) => {
    if (data.id && data.status) {
      try {
        db.prepare('UPDATE agents SET status = ? WHERE id = ?').run(data.status, data.id);
        io.to('relay').emit('agent:status', { id: data.id, status: data.status });
      } catch (err) {
        console.error('[Socket] Agent status update error:', err.message);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.user.username} (${socket.id})`);
  });
});

// ── n8n Agent Status Sync ──────────────────────────────────────────────

async function syncAgentStatusFromN8N() {
  const n8nUrl = process.env.N8N_URL || 'http://172.17.0.1:5678';
  const n8nEmail = process.env.N8N_EMAIL || 'admin@ivonharris.com';
  const n8nPassword = process.env.N8N_PASSWORD || 'ManaOps2026!';

  try {
    // Login to n8n
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const loginRes = await fetch(`${n8nUrl}/rest/login`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrLdapLoginId: n8nEmail, password: n8nPassword })
    });
    clearTimeout(timeout);

    if (!loginRes.ok) {
      console.warn(`[n8n Sync] Login failed: ${loginRes.status}`);
      return;
    }

    const setCookie = loginRes.headers.get('set-cookie') || loginRes.headers.get('Set-Cookie');
    let cookie = '';
    if (setCookie) {
      const cookies = setCookie.split(/,(?=\s*\w+=)/).map(c => c.split(';')[0].trim());
      cookie = cookies.join('; ');
    }

    // Fetch workflows
    const wfController = new AbortController();
    const wfTimeout = setTimeout(() => wfController.abort(), 10000);
    const wfRes = await fetch(`${n8nUrl}/rest/workflows?limit=500`, {
      signal: wfController.signal,
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
    });
    clearTimeout(wfTimeout);

    if (!wfRes.ok) {
      console.warn(`[n8n Sync] Workflows fetch failed: ${wfRes.status}`);
      return;
    }

    const wfData = await wfRes.json();
    const workflows = Array.isArray(wfData) ? wfData : (wfData?.data || []);
    const activeWorkflowNames = workflows.filter(wf => wf.active).map(wf => wf.name.toLowerCase());

    // Sync agent statuses
    const agents = db.prepare('SELECT * FROM agents').all();
    const updateStmt = db.prepare('UPDATE agents SET status = ? WHERE id = ?');
    let onlineCount = 0;

    const syncTransaction = db.transaction(() => {
      for (const agent of agents) {
        const agentName = (agent.name || '').toLowerCase();
        const agentId = (agent.id || '').toLowerCase();

        const hasActiveWorkflow = activeWorkflowNames.some(wfName =>
          wfName.includes(agentName) ||
          wfName.includes(agentId) ||
          wfName.includes(agentId.replace(/-/g, ' ')) ||
          (agentId.startsWith('mana-') && wfName.includes(agentId.replace('mana-', 'mana ')))
        );

        if (hasActiveWorkflow) {
          updateStmt.run('online', agent.id);
          onlineCount++;
        }
      }
    });
    syncTransaction();

    console.log(`[n8n Sync] ${onlineCount} agents online from ${activeWorkflowNames.length} active workflows (${workflows.length} total)`);
  } catch (err) {
    console.warn(`[n8n Sync] Failed: ${err.message}`);
  }
}

// ── Start Server ───────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║   ManaMetaMaori Command Center - API Server     ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║   API:       http://localhost:${PORT}              ║`);
  console.log(`  ║   Socket.IO: ws://localhost:${PORT}               ║`);
  console.log('  ║   Status:    ONLINE                             ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  [${new Date().toISOString()}] Server started on port ${PORT}`);

  // Sync agent status from n8n on startup (after 5s delay to let n8n be ready)
  setTimeout(syncAgentStatusFromN8N, 5000);
  // Re-sync every 5 minutes
  setInterval(syncAgentStatusFromN8N, 5 * 60 * 1000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  stopAllBots();
  io.close();
  db.close();
  server.close(() => {
    console.log('[Server] Closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n[Server] SIGTERM received...');
  stopAllBots();
  io.close();
  db.close();
  server.close(() => {
    process.exit(0);
  });
});

export { app, server, io };
