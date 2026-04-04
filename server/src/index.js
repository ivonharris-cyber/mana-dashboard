import 'dotenv/config';
import express from 'express';
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
import { setBotIO, stopAllBots } from './bot-runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT) || 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'mana-dashboard-secret';

// Express app
const app = express();
const server = createServer(app);

// Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3003'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Share io with relay routes + bot runner
setIO(io);
setBotIO(io);

// ── Middleware ──────────────────────────────────────────────────────────

// CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3003'],
  credentials: true
}));

// Helmet with CSP disabled
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting: 500 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});
app.use(limiter);

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

// API health endpoint (no auth required)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
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
