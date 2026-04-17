import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const BEAST_URL = process.env.BEAST_URL || 'http://host.docker.internal';
const COMFYUI_URL = process.env.COMFYUI_URL || `${BEAST_URL}:8188`;
const BRANDULATE_URL = process.env.BRANDULATE_URL || `${BEAST_URL}:4020`;
const OLLAMA_URL = process.env.OLLAMA_URL || `${BEAST_URL}:11434`;
const N8N_URL = process.env.N8N_URL || 'http://host.docker.internal:5678';

// ── Studio DB ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS studio_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'video',
    status TEXT DEFAULT 'draft',
    description TEXT,
    tags TEXT,
    assets TEXT,
    timeline TEXT,
    social_targets TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS studio_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'image',
    path TEXT,
    url TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES studio_projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS model_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source TEXT DEFAULT 'huggingface',
    source_id TEXT,
    type TEXT DEFAULT 'checkpoint',
    size_bytes INTEGER,
    location TEXT,
    status TEXT DEFAULT 'available',
    tags TEXT,
    downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Projects CRUD ────────────────────────────────────────────────

router.get('/projects', (req, res) => {
  const projects = db.prepare('SELECT * FROM studio_projects ORDER BY updated_at DESC').all();
  res.json({ projects });
});

router.post('/projects', (req, res) => {
  const { name, type, description, tags, social_targets } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const result = db.prepare(
    'INSERT INTO studio_projects (name, type, description, tags, social_targets) VALUES (?, ?, ?, ?, ?)'
  ).run(name, type || 'video', description || '', JSON.stringify(tags || []), JSON.stringify(social_targets || []));

  const project = db.prepare('SELECT * FROM studio_projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ project });
});

router.put('/projects/:id', (req, res) => {
  const { name, type, status, description, tags, social_targets, timeline } = req.body;
  const existing = db.prepare('SELECT * FROM studio_projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  db.prepare(`
    UPDATE studio_projects SET name=?, type=?, status=?, description=?, tags=?, social_targets=?, timeline=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(
    name || existing.name, type || existing.type, status || existing.status,
    description || existing.description, tags ? JSON.stringify(tags) : existing.tags,
    social_targets ? JSON.stringify(social_targets) : existing.social_targets,
    timeline || existing.timeline, req.params.id
  );

  const project = db.prepare('SELECT * FROM studio_projects WHERE id = ?').get(req.params.id);
  res.json({ project });
});

router.delete('/projects/:id', (req, res) => {
  db.prepare('DELETE FROM studio_projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Assets ───────────────────────────────────────────────────────

router.get('/projects/:id/assets', (req, res) => {
  const assets = db.prepare('SELECT * FROM studio_assets WHERE project_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ assets });
});

router.post('/projects/:id/assets', (req, res) => {
  const { name, type, path, url, metadata } = req.body;
  const result = db.prepare(
    'INSERT INTO studio_assets (project_id, name, type, path, url, metadata) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, name, type || 'image', path || null, url || null, JSON.stringify(metadata || {}));

  const asset = db.prepare('SELECT * FROM studio_assets WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ asset });
});

// ── Model Library ────────────────────────────────────────────────

router.get('/models', (req, res) => {
  const models = db.prepare('SELECT * FROM model_library ORDER BY downloaded_at DESC').all();
  res.json({ models });
});

router.post('/models', (req, res) => {
  const { name, source, source_id, type, size_bytes, location, tags } = req.body;
  const result = db.prepare(
    'INSERT INTO model_library (name, source, source_id, type, size_bytes, location, tags) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(name, source || 'huggingface', source_id || '', type || 'checkpoint', size_bytes || 0, location || '', JSON.stringify(tags || []));

  const model = db.prepare('SELECT * FROM model_library WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ model });
});

// ── Pipeline Status ──────────────────────────────────────────────

router.get('/pipeline', async (req, res) => {
  try {
    // Check ComfyUI via Mana Node health on Beast (avoids Docker networking issues)
    const MANA_NODE = process.env.MANA_NODE_URL || 'http://host.docker.internal:9080';
    const [comfyui, brandulate, ollama] = await Promise.allSettled([
      fetch(`${MANA_NODE}/status`, { signal: AbortSignal.timeout(8000) })
        .then(r => r.json())
        .then(data => {
          const comfy = data.nodes?.find(n => n.name?.includes('ComfyUI'));
          if (comfy?.status === 'up') return { status: 'online' };
          throw new Error('ComfyUI down');
        }),
      fetch(`${BRANDULATE_URL}/analytics`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
      fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
    ]);

    res.json({
      comfyui: comfyui.status === 'fulfilled' ? { status: 'online', ...comfyui.value } : { status: 'offline' },
      brandulate: brandulate.status === 'fulfilled' ? { status: 'online', ...brandulate.value } : { status: 'offline' },
      ollama: ollama.status === 'fulfilled' ? {
        status: 'online',
        models: ollama.value.models?.map(m => ({ name: m.name, size: m.size })) || []
      } : { status: 'offline' },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Generate (ComfyUI proxy) ─────────────────────────────────────

router.post('/generate/image', async (req, res) => {
  try {
    const response = await fetch(`${COMFYUI_URL}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(120000),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: `ComfyUI: ${err.message}` });
  }
});

// ── AI Script Writer ─────────────────────────────────────────────

router.post('/generate/script', async (req, res) => {
  try {
    const { prompt, model, type } = req.body;
    const systemPrompts = {
      music: 'You are a music producer and lyricist. Write song lyrics, chord progressions, and production notes.',
      video: 'You are a video director. Write scene breakdowns, shot lists, and narration scripts.',
      reel: 'You are a social media content expert. Write punchy, engaging reel scripts under 60 seconds.',
      romance: 'You are a romance writer. Write vivid, sensual scenes with emotional depth.',
    };

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'nous-hermes2',
        messages: [
          { role: 'system', content: systemPrompts[type] || systemPrompts.video },
          { role: 'user', content: prompt },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(120000),
    });

    const data = await response.json();
    res.json({ script: data.message?.content || data.response || '', model: model || 'nous-hermes2', type });
  } catch (err) {
    res.status(502).json({ error: `Ollama: ${err.message}` });
  }
});

// ── Filmora Export ───────────────────────────────────────────────

router.post('/export/filmora', (req, res) => {
  const { project_id, scenes } = req.body;
  const project = db.prepare('SELECT * FROM studio_projects WHERE id = ?').get(project_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Generate Filmora-compatible XML (FCPXML subset)
  const sceneXml = (scenes || []).map((s, i) => `
    <clip name="Scene ${i + 1}" offset="${i * 150}/30s" duration="150/30s">
      <video ref="${s.asset || 'placeholder'}" />
      <note>${s.description || ''}</note>
    </clip>`).join('');

  const fcpxml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
    <format id="r1" name="FFVideoFormat1080p30" frameDuration="100/3000s" width="1080" height="1920"/>
  </resources>
  <library>
    <event name="${project.name}">
      <project name="${project.name}">
        <sequence format="r1">
          <spine>${sceneXml}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;

  res.json({ fcpxml, filename: `${project.name.replace(/\s+/g, '-').toLowerCase()}.fcpxml` });
});

export default router;
