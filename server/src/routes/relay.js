import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Store io reference - set from index.js
let io = null;
export function setIO(socketIO) {
  io = socketIO;
}

// Webhook rate limiter: 30 req/min
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Webhook rate limit exceeded. Max 30 requests per minute.' }
});

// Webhook auth middleware
function webhookAuth(req, res, next) {
  const secret = process.env.WEBHOOK_SECRET || '';
  if (!secret) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Webhook authentication required' });
  }
  if (authHeader.split(' ')[1] !== secret) {
    return res.status(403).json({ error: 'Invalid webhook token' });
  }
  next();
}

// ── Webhook for n8n agents to post relay messages (rate-limited + authed) ──
router.post('/webhook', webhookLimiter, webhookAuth, (req, res) => {
  try {
    const { agent, task, output, source, type, content } = req.body;

    // Support both direct relay format and n8n diary format
    const msgSource = source || agent || 'n8n-agent';
    const msgType = type || 'agent-diary';
    const msgContent = content || `[${agent || 'Agent'}] ${task || ''}: ${(output || '').substring(0, 500)}`;

    const result = db.prepare(
      'INSERT INTO relay_messages (source, target, type, content, metadata) VALUES (?, ?, ?, ?, ?)'
    ).run(
      msgSource,
      null,
      msgType,
      msgContent,
      JSON.stringify({ agent, task, output: (output || '').substring(0, 1000), timestamp: new Date().toISOString() })
    );

    const message = db.prepare('SELECT * FROM relay_messages WHERE id = ?').get(result.lastInsertRowid);

    // Also log to agent_activity if we have an agent_id
    if (agent) {
      const agentId = agent.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      try {
        db.prepare(
          'INSERT INTO agent_activity (agent_id, action, detail, xp_gained) VALUES (?, ?, ?, ?)'
        ).run(agentId, 'task', (task || '').substring(0, 200), 10);

        // Update agent status + XP
        db.prepare(
          'UPDATE agents SET status = ?, xp = xp + 10, total_interactions = total_interactions + 1 WHERE id = ?'
        ).run('working', agentId);
      } catch { /* agent may not exist in DB yet */ }
    }

    // Broadcast via Socket.IO
    if (io) {
      io.to('relay').emit('relay:message', message);
    }

    res.status(201).json({ logged: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('[Relay] Webhook error:', err.message);
    res.status(500).json({ error: 'Failed to log relay message' });
  }
});

// All other routes require auth
router.use(authMiddleware);

// GET /api/relay - list messages with optional filters
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const source = req.query.source;
    const type = req.query.type;

    let sql = 'SELECT * FROM relay_messages';
    const conditions = [];
    const params = [];

    if (source) {
      conditions.push('source = ?');
      params.push(source);
    }
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const messages = db.prepare(sql).all(...params);
    const total = db.prepare('SELECT COUNT(*) as count FROM relay_messages').get().count;
    res.json({ messages, total });
  } catch (err) {
    console.error('[Relay] List error:', err.message);
    res.status(500).json({ error: 'Failed to list relay messages' });
  }
});

// POST /api/relay - create message and broadcast via Socket.IO
router.post('/', (req, res) => {
  try {
    const { source, target, type, content, metadata } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = db.prepare(
      'INSERT INTO relay_messages (source, target, type, content, metadata) VALUES (?, ?, ?, ?, ?)'
    ).run(
      source || 'dashboard',
      target || null,
      type || 'info',
      content,
      metadata ? JSON.stringify(metadata) : null
    );

    const message = db.prepare('SELECT * FROM relay_messages WHERE id = ?').get(result.lastInsertRowid);

    // Broadcast to relay room via Socket.IO
    if (io) {
      io.to('relay').emit('relay:message', message);
    }

    res.status(201).json({ message });
  } catch (err) {
    console.error('[Relay] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create relay message' });
  }
});

// DELETE /api/relay/:id - delete message
router.delete('/:id', (req, res) => {
  try {
    const message = db.prepare('SELECT * FROM relay_messages WHERE id = ?').get(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    db.prepare('DELETE FROM relay_messages WHERE id = ?').run(req.params.id);
    res.json({ success: true, deleted: parseInt(req.params.id) });
  } catch (err) {
    console.error('[Relay] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete relay message' });
  }
});

export default router;
