import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Store io reference - set from index.js
let io = null;
export function setIO(socketIO) {
  io = socketIO;
}

// All routes require auth
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
    res.json({ messages });
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
