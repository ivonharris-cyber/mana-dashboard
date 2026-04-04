import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { getStageForLevel } from '../evolution.js';

const router = Router();
router.use(authMiddleware);

const VAULT_PATH = process.env.OBSIDIAN_VAULT || 'D:/AI/obsidian-vault';

// POST /api/obsidian/sync — sync all agent memories to Obsidian vault as markdown notes
router.post('/sync', (req, res) => {
  try {
    const agents = db.prepare('SELECT * FROM agents ORDER BY created_at ASC').all();
    const synced = [];

    for (const agent of agents) {
      const memories = db.prepare(
        'SELECT * FROM agent_memories WHERE agent_id = ? ORDER BY importance DESC, created_at DESC'
      ).all(agent.id);

      const stage = getStageForLevel(agent.level || 1);
      const agentDir = path.join(VAULT_PATH, 'agents');
      fs.mkdirSync(agentDir, { recursive: true });

      const memoryBlock = memories.length > 0
        ? memories.map((m) => `- **[${m.type}]** ${m.content} _(imp: ${m.importance}/5, ${m.source})_`).join('\n')
        : '_No memories yet_';

      const note = `# ${agent.display_name || agent.name}

## Identity
- **ID**: ${agent.id}
- **Model**: ${agent.model}
- **Role**: ${agent.role_desc || 'Agent'}
- **Status**: ${agent.status}
- **Subnet**: ${agent.subnet_id || 'unassigned'}
- **Host**: ${agent.host || 'local'}

## Evolution
- **Level**: ${agent.level || 1}
- **XP**: ${agent.xp || 0}
- **Stage**: ${stage.label} (${stage.id})
- **Memory Capacity**: ${stage.memoryCapacity}
- **Total Interactions**: ${agent.total_interactions || 0}

## Memory Bank (${memories.length} entries)
${memoryBlock}

---
_Synced from ManaMetaMaori Dashboard on ${new Date().toISOString()}_
`;

      const filePath = path.join(agentDir, `${agent.id}.md`);
      fs.writeFileSync(filePath, note, 'utf-8');
      synced.push(agent.id);
    }

    res.json({ success: true, synced, vaultPath: VAULT_PATH });
  } catch (err) {
    console.error('[Obsidian] Sync error:', err.message);
    res.status(500).json({ error: 'Failed to sync to Obsidian vault' });
  }
});

// GET /api/obsidian/status — vault info
router.get('/status', (req, res) => {
  try {
    const exists = fs.existsSync(VAULT_PATH);
    const agentNotes = exists
      ? fs.readdirSync(path.join(VAULT_PATH, 'agents')).filter((f) => f.endsWith('.md'))
      : [];
    const canvasFiles = exists && fs.existsSync(path.join(VAULT_PATH, 'canvas'))
      ? fs.readdirSync(path.join(VAULT_PATH, 'canvas')).filter((f) => f.endsWith('.canvas'))
      : [];

    res.json({
      connected: exists,
      vaultPath: VAULT_PATH,
      agentNotes: agentNotes.length,
      canvasFiles: canvasFiles.length,
      notes: agentNotes,
      canvases: canvasFiles,
    });
  } catch (err) {
    console.error('[Obsidian] Status error:', err.message);
    res.status(500).json({ error: 'Failed to check Obsidian vault' });
  }
});

export default router;
