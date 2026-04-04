import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { spawnBot, stopBot, getBotStatus, getBotLogs, listRunningBots } from '../bot-runner.js';
import { awardXP } from '../evolution.js';

const router = Router();
router.use(authMiddleware);

// GET /api/bots - list all running bots + recent processes
router.get('/', (req, res) => {
  try {
    const running = listRunningBots();
    const recent = db.prepare('SELECT * FROM bot_processes ORDER BY started_at DESC LIMIT 50').all();
    res.json({ running, recent });
  } catch (err) {
    console.error('[Bots] List error:', err.message);
    res.status(500).json({ error: 'Failed to list bots' });
  }
});

// POST /api/bots/deploy/:agentId - spawn a bot for an agent
router.post('/deploy/:agentId', (req, res) => {
  try {
    const { port, ollamaUrl } = req.body;
    const result = spawnBot(req.params.agentId, { port, ollamaUrl });

    if (result.error) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (err) {
    console.error('[Bots] Deploy error:', err.message);
    res.status(500).json({ error: 'Failed to deploy bot' });
  }
});

// POST /api/bots/stop/:agentId - stop a running bot
router.post('/stop/:agentId', (req, res) => {
  try {
    const result = stopBot(req.params.agentId);
    if (result.error) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('[Bots] Stop error:', err.message);
    res.status(500).json({ error: 'Failed to stop bot' });
  }
});

// GET /api/bots/status/:agentId - get bot status
router.get('/status/:agentId', (req, res) => {
  try {
    const status = getBotStatus(req.params.agentId);
    res.json(status);
  } catch (err) {
    console.error('[Bots] Status error:', err.message);
    res.status(500).json({ error: 'Failed to get bot status' });
  }
});

// GET /api/bots/logs/:agentId - get bot logs
router.get('/logs/:agentId', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = getBotLogs(req.params.agentId, limit);
    res.json({ logs, agentId: req.params.agentId });
  } catch (err) {
    console.error('[Bots] Logs error:', err.message);
    res.status(500).json({ error: 'Failed to get bot logs' });
  }
});

// POST /api/bots/deploy-all - deploy all bots on a subnet
router.post('/deploy-all/:subnetId', (req, res) => {
  try {
    const agents = db.prepare('SELECT * FROM agents WHERE subnet_id = ?').all(req.params.subnetId);
    const results = [];

    for (const agent of agents) {
      const result = spawnBot(agent.id);
      results.push({ agentId: agent.id, ...result });
    }

    res.json({ deployed: results });
  } catch (err) {
    console.error('[Bots] Deploy-all error:', err.message);
    res.status(500).json({ error: 'Failed to deploy bots' });
  }
});

// POST /api/bots/chat/:agentId - chat with a running bot
router.post('/chat/:agentId', async (req, res) => {
  try {
    const status = getBotStatus(req.params.agentId);
    if (!status.running) {
      return res.status(400).json({ error: 'Bot not running' });
    }

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    // Forward to bot's HTTP API
    const response = await fetch(`http://127.0.0.1:${status.port}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await response.json();

    // Award XP for chat interaction
    const evo = awardXP(db, req.params.agentId, 'chat');
    if (evo.leveled || evo.evolved) {
      data.evolution = {
        leveled: evo.leveled,
        evolved: evo.evolved,
        newLevel: evo.newLevel,
        newStage: evo.newStage,
      };
    }

    res.json(data);
  } catch (err) {
    console.error('[Bots] Chat error:', err.message);
    res.status(500).json({ error: 'Failed to chat with bot' });
  }
});

export default router;
