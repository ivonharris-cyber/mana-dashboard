import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { EVOLUTION_STAGES, xpForNextLevel, getStageForLevel, awardXP } from '../evolution.js';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// GET /api/agents - list all agents
router.get('/', (req, res) => {
  try {
    const agents = db.prepare('SELECT * FROM agents ORDER BY created_at ASC').all();
    res.json({ agents });
  } catch (err) {
    console.error('[Agents] List error:', err.message);
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

// GET /api/agents/:id - get single agent
router.get('/:id', (req, res) => {
  try {
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json({ agent });
  } catch (err) {
    console.error('[Agents] Get error:', err.message);
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

// PUT /api/agents/:id - update agent fields
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const allowedFields = [
      'name', 'display_name', 'model', 'color', 'role_desc',
      'status', 'avatar_url', 'telegram_token', 'soul_path', 'workspace_path'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    res.json({ agent });
  } catch (err) {
    console.error('[Agents] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// POST /api/agents - create new agent (also creates SOUL.md + directories on disk)
router.post('/', (req, res) => {
  try {
    const { id, name, display_name, model, color, role_desc } = req.body;

    if (!id || !name) {
      return res.status(400).json({ error: 'Agent id and name are required' });
    }

    const existing = db.prepare('SELECT id FROM agents WHERE id = ?').get(id);
    if (existing) {
      return res.status(409).json({ error: 'Agent with this id already exists' });
    }

    const agentsBase = process.env.AGENTS_BASE_PATH || '/opt/mana-dashboard/agents';
    const soulPath = `${agentsBase}/${id}/SOUL.md`;
    const workspacePath = `${agentsBase}/${id}/workspace`;

    db.prepare(`
      INSERT INTO agents (id, name, display_name, model, color, role_desc, soul_path, workspace_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      display_name || name,
      model || 'qwen3.5:35b',
      color || '#6B7280',
      role_desc || '',
      soulPath,
      workspacePath
    );

    // Create directories and SOUL.md on disk
    const soulDir = path.dirname(soulPath);
    try {
      fs.mkdirSync(soulDir, { recursive: true });
      fs.mkdirSync(workspacePath, { recursive: true });

      const soulContent = `# ${display_name || name} - SOUL.md\n\n## Identity\n- **Name**: ${display_name || name}\n- **Role**: ${role_desc || 'Agent'}\n- **Model**: ${model || 'qwen3.5:35b'}\n\n## Purpose\nDescribe this agent's purpose and personality here.\n\n## Guidelines\n- Be helpful and accurate\n- Follow the OpenClaw agent protocol\n`;

      if (!fs.existsSync(soulPath)) {
        fs.writeFileSync(soulPath, soulContent, 'utf-8');
      }
    } catch (fsErr) {
      console.warn('[Agents] Could not create disk files:', fsErr.message);
      // Non-fatal - agent is still created in DB
    }

    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
    res.status(201).json({ agent });
  } catch (err) {
    console.error('[Agents] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// GET /api/agents/:id/soul - read SOUL.md from disk
router.get('/:id/soul', (req, res) => {
  try {
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const soulPath = agent.soul_path;
    if (!soulPath) {
      return res.status(404).json({ error: 'No soul_path configured for this agent' });
    }

    try {
      const content = fs.readFileSync(soulPath, 'utf-8');
      res.json({ content, path: soulPath });
    } catch (fsErr) {
      if (fsErr.code === 'ENOENT') {
        return res.status(404).json({ error: 'SOUL.md file not found on disk', path: soulPath });
      }
      throw fsErr;
    }
  } catch (err) {
    console.error('[Agents] Read soul error:', err.message);
    res.status(500).json({ error: 'Failed to read SOUL.md' });
  }
});

// PUT /api/agents/:id/soul - write SOUL.md content to disk
router.put('/:id/soul', (req, res) => {
  try {
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const { content } = req.body;
    if (content === undefined) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const soulPath = agent.soul_path;
    if (!soulPath) {
      return res.status(404).json({ error: 'No soul_path configured for this agent' });
    }

    // Ensure directory exists
    const soulDir = path.dirname(soulPath);
    fs.mkdirSync(soulDir, { recursive: true });

    fs.writeFileSync(soulPath, content, 'utf-8');
    res.json({ success: true, path: soulPath });
  } catch (err) {
    console.error('[Agents] Write soul error:', err.message);
    res.status(500).json({ error: 'Failed to write SOUL.md' });
  }
});

// GET /api/agents/:id/evolution - get evolution stats + XP progress
router.get('/:id/evolution', (req, res) => {
  try {
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const stage = getStageForLevel(agent.level || 1);
    const xpNeeded = xpForNextLevel(agent.level || 1);
    const memoryCount = db.prepare('SELECT COUNT(*) as count FROM agent_memories WHERE agent_id = ?').get(req.params.id).count;

    res.json({
      level: agent.level || 1,
      xp: agent.xp || 0,
      xpNeeded,
      xpPercent: Math.round(((agent.xp || 0) / xpNeeded) * 100),
      stage: stage.id,
      stageLabel: stage.label,
      stageColor: stage.color,
      memoryCapacity: stage.memoryCapacity,
      memoryUsed: memoryCount,
      totalInteractions: agent.total_interactions || 0,
      stages: EVOLUTION_STAGES,
    });
  } catch (err) {
    console.error('[Agents] Evolution error:', err.message);
    res.status(500).json({ error: 'Failed to get evolution data' });
  }
});

// GET /api/agents/:id/memories - list memory bank entries
router.get('/:id/memories', (req, res) => {
  try {
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const limit = parseInt(req.query.limit) || 100;
    const memories = db.prepare(
      'SELECT * FROM agent_memories WHERE agent_id = ? ORDER BY importance DESC, created_at DESC LIMIT ?'
    ).all(req.params.id, limit);

    const capacity = agent.memory_capacity || 10;
    res.json({ memories, capacity, used: memories.length });
  } catch (err) {
    console.error('[Agents] Memories list error:', err.message);
    res.status(500).json({ error: 'Failed to list memories' });
  }
});

// POST /api/agents/:id/memories - add a memory entry
router.post('/:id/memories', (req, res) => {
  try {
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { content, type, importance, source } = req.body;
    if (!content) return res.status(400).json({ error: 'content is required' });

    const capacity = agent.memory_capacity || 10;
    const currentCount = db.prepare('SELECT COUNT(*) as count FROM agent_memories WHERE agent_id = ?').get(req.params.id).count;

    // If at capacity, remove lowest importance oldest entry
    if (currentCount >= capacity) {
      db.prepare(
        'DELETE FROM agent_memories WHERE id = (SELECT id FROM agent_memories WHERE agent_id = ? ORDER BY importance ASC, created_at ASC LIMIT 1)'
      ).run(req.params.id);
    }

    const result = db.prepare(
      'INSERT INTO agent_memories (agent_id, type, content, importance, source) VALUES (?, ?, ?, ?, ?)'
    ).run(req.params.id, type || 'fact', content, importance || 1, source || 'manual');

    // Award XP for learning
    const evo = awardXP(db, req.params.id, 'memory_add');

    const memory = db.prepare('SELECT * FROM agent_memories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ memory, evolution: evo });
  } catch (err) {
    console.error('[Agents] Memory add error:', err.message);
    res.status(500).json({ error: 'Failed to add memory' });
  }
});

// DELETE /api/agents/:id/memories/:memoryId - remove a memory entry
router.delete('/:id/memories/:memoryId', (req, res) => {
  try {
    const memory = db.prepare('SELECT * FROM agent_memories WHERE id = ? AND agent_id = ?').get(
      req.params.memoryId, req.params.id
    );
    if (!memory) return res.status(404).json({ error: 'Memory not found' });

    db.prepare('DELETE FROM agent_memories WHERE id = ?').run(req.params.memoryId);
    res.json({ success: true });
  } catch (err) {
    console.error('[Agents] Memory delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

// GET /api/agents/:id/history - get activity log + relay messages
router.get('/:id/history', (req, res) => {
  try {
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const limit = parseInt(req.query.limit) || 50;

    // Activity log
    const activity = db.prepare(
      'SELECT * FROM agent_activity WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(req.params.id, limit);

    // Relay messages involving this agent
    const relays = db.prepare(
      `SELECT * FROM relay_messages WHERE source = ? OR target = ? ORDER BY created_at DESC LIMIT ?`
    ).all(req.params.id, req.params.id, limit);

    // Bot process history
    const bots = db.prepare(
      'SELECT * FROM bot_processes WHERE agent_id = ? ORDER BY started_at DESC LIMIT 10'
    ).all(req.params.id);

    // Merge and sort by time
    const timeline = [
      ...activity.map(a => ({ ...a, _type: 'activity', _time: a.created_at })),
      ...relays.map(r => ({ ...r, _type: 'relay', _time: r.created_at })),
      ...bots.map(b => ({ ...b, _type: 'bot', _time: b.started_at || b.last_heartbeat })),
    ].sort((a, b) => new Date(b._time).getTime() - new Date(a._time).getTime()).slice(0, limit);

    res.json({ timeline, counts: { activity: activity.length, relays: relays.length, bots: bots.length } });
  } catch (err) {
    console.error('[Agents] History error:', err.message);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// DELETE /api/agents/:id - delete agent
router.delete('/:id', (req, res) => {
  try {
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    console.error('[Agents] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

export default router;
