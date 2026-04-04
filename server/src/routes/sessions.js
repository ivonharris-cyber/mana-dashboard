import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// GET /api/sessions - list all sessions
router.get('/', (req, res) => {
  try {
    const sessions = db.prepare('SELECT * FROM sessions ORDER BY last_active DESC').all();
    res.json({ sessions });
  } catch (err) {
    console.error('[Sessions] List error:', err.message);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// POST /api/sessions - create session
router.post('/', (req, res) => {
  try {
    const { location, name, status, context } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Session name is required' });
    }

    const result = db.prepare(
      'INSERT INTO sessions (location, name, status, context) VALUES (?, ?, ?, ?)'
    ).run(
      location || 'local',
      name,
      status || 'active',
      context ? JSON.stringify(context) : null
    );

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ session });
  } catch (err) {
    console.error('[Sessions] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// PUT /api/sessions/:id - update session
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const allowedFields = ['location', 'name', 'status', 'context'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        if (field === 'context' && typeof req.body[field] === 'object') {
          values.push(JSON.stringify(req.body[field]));
        } else {
          values.push(req.body[field]);
        }
      }
    }

    // Always update last_active on update
    updates.push('last_active = CURRENT_TIMESTAMP');

    if (updates.length === 1) {
      // Only last_active, no real fields to update
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    res.json({ session });
  } catch (err) {
    console.error('[Sessions] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// POST /api/sessions/sync - stub for syncing between local and server
router.post('/sync', (req, res) => {
  try {
    const { localSessions, serverUrl } = req.body;

    // Stub implementation - in future this would:
    // 1. Pull sessions from remote server
    // 2. Merge with local sessions
    // 3. Push merged state back
    // 4. Return unified session list

    const sessions = db.prepare('SELECT * FROM sessions ORDER BY last_active DESC').all();

    res.json({
      success: true,
      message: 'Sync stub - local sessions returned',
      sessions,
      syncedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Sessions] Sync error:', err.message);
    res.status(500).json({ error: 'Failed to sync sessions' });
  }
});

export default router;
