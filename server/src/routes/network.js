import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const execAsync = promisify(exec);

router.use(authMiddleware);

// GET /api/network/subnets - list all subnets
router.get('/subnets', (req, res) => {
  try {
    const subnets = db.prepare('SELECT * FROM subnets ORDER BY created_at ASC').all();
    // Attach agent counts
    const enriched = subnets.map((s) => {
      const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents WHERE subnet_id = ?').get(s.id).count;
      const onlineCount = db.prepare("SELECT COUNT(*) as count FROM agents WHERE subnet_id = ? AND status = 'online'").get(s.id).count;
      return { ...s, agentCount, onlineCount };
    });
    res.json({ subnets: enriched });
  } catch (err) {
    console.error('[Network] List subnets error:', err.message);
    res.status(500).json({ error: 'Failed to list subnets' });
  }
});

// GET /api/network/subnets/:id - get single subnet with its agents
router.get('/subnets/:id', (req, res) => {
  try {
    const subnet = db.prepare('SELECT * FROM subnets WHERE id = ?').get(req.params.id);
    if (!subnet) return res.status(404).json({ error: 'Subnet not found' });

    const agents = db.prepare('SELECT * FROM agents WHERE subnet_id = ?').all(req.params.id);
    const processes = db.prepare("SELECT * FROM bot_processes WHERE subnet_id = ? AND status = 'running'").all(req.params.id);

    res.json({ subnet, agents, processes });
  } catch (err) {
    console.error('[Network] Get subnet error:', err.message);
    res.status(500).json({ error: 'Failed to get subnet' });
  }
});

// POST /api/network/subnets - create subnet
router.post('/subnets', (req, res) => {
  try {
    const { id, name, cidr, gateway, host_type, tailscale_ip, tailscale_name, ollama_url, ssh_host } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'id and name required' });

    db.prepare(`
      INSERT INTO subnets (id, name, cidr, gateway, host_type, tailscale_ip, tailscale_name, ollama_url, ssh_host)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, cidr || null, gateway || null, host_type || 'local', tailscale_ip || null, tailscale_name || null, ollama_url || null, ssh_host || null);

    const subnet = db.prepare('SELECT * FROM subnets WHERE id = ?').get(id);
    res.status(201).json({ subnet });
  } catch (err) {
    console.error('[Network] Create subnet error:', err.message);
    res.status(500).json({ error: 'Failed to create subnet' });
  }
});

// PUT /api/network/subnets/:id - update subnet
router.put('/subnets/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM subnets WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Subnet not found' });

    const fields = ['name', 'cidr', 'gateway', 'host_type', 'tailscale_ip', 'tailscale_name', 'ollama_url', 'ssh_host', 'status'];
    const updates = [];
    const values = [];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(req.params.id);
    db.prepare(`UPDATE subnets SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const subnet = db.prepare('SELECT * FROM subnets WHERE id = ?').get(req.params.id);
    res.json({ subnet });
  } catch (err) {
    console.error('[Network] Update subnet error:', err.message);
    res.status(500).json({ error: 'Failed to update subnet' });
  }
});

// DELETE /api/network/subnets/:id
router.delete('/subnets/:id', (req, res) => {
  try {
    const subnet = db.prepare('SELECT * FROM subnets WHERE id = ?').get(req.params.id);
    if (!subnet) return res.status(404).json({ error: 'Subnet not found' });

    db.prepare('DELETE FROM subnets WHERE id = ?').run(req.params.id);
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    console.error('[Network] Delete subnet error:', err.message);
    res.status(500).json({ error: 'Failed to delete subnet' });
  }
});

// GET /api/network/discover - discover Tailscale, services, integrations
router.get('/discover', async (req, res) => {
  const results = { tailscale: null, local: null, services: {}, errors: [] };

  async function probe(url, timeout = 5000) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      return { ok: resp.ok, status: resp.status };
    } catch { return { ok: false, status: 0 }; }
  }

  async function probeJSON(url, timeout = 5000) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      if (!resp.ok) return null;
      return await resp.json();
    } catch { return null; }
  }

  // Tailscale — known nodes, ping to check status
  try {
    const nodes = [
      { name: 'mother-ship', ip: '100.119.206.43', os: 'linux' },
      { name: 'dauntless', ip: '100.95.62.64', os: 'linux' },
      { name: 's62-pro', ip: '100.120.233.93', os: 'android' },
      { name: 'admin-ivon-ndi', ip: '100.98.189.48', os: 'windows', checkPort: 18789 },
    ];

    const peerChecks = await Promise.allSettled(
      nodes.map(async (n) => {
        const port = n.checkPort || 22;
        const reachable = await probe(`http://${n.ip}:${port}`, 3000).catch(() => ({ ok: false }));
        const online = reachable.ok || (await probe(`http://${n.ip}:9080`, 3000)).ok
          || (await probe(`http://${n.ip}:5678`, 3000)).ok
          || (await probe(`http://${n.ip}:18789`, 3000)).ok;
        return { ...n, online, isCat62: n.name.includes('s62') };
      })
    );

    results.tailscale = {
      connected: true,
      self: { name: 'mother-ship', ip: '100.119.206.43', os: 'linux' },
      peers: peerChecks.map(p => p.status === 'fulfilled' ? p.value : { name: '?', ip: '?', os: '?', online: false, isCat62: false }),
    };
  } catch (err) {
    results.tailscale = { connected: false, error: err.message };
    results.errors.push(`Tailscale: ${err.message}`);
  }

  // Mana Node — real service health from Beast
  try {
    const manaNode = await probeJSON('http://host.docker.internal:19080/status', 8000);
    if (manaNode?.nodes) {
      results.services.manaNode = {
        status: 'online',
        servicesUp: manaNode.nodes.filter(n => n.status === 'up').length,
        servicesDown: manaNode.nodes.filter(n => n.status === 'down').length,
        nodes: manaNode.nodes,
      };
    }
  } catch { results.errors.push('Mana Node unreachable'); }

  // n8n
  try {
    const n8n = await probe('http://host.docker.internal:5678', 5000);
    results.services.n8n = { status: n8n.ok ? 'online' : 'offline', port: 5678 };
  } catch { results.services.n8n = { status: 'offline' }; }

  // Slack — check API
  try {
    const slackToken = process.env.SLACK_BOT_TOKEN;
    if (slackToken) {
      const resp = await fetch('https://slack.com/api/auth.test', {
        headers: { 'Authorization': `Bearer ${slackToken}` },
        signal: AbortSignal.timeout(5000),
      });
      const data = await resp.json();
      results.services.slack = { status: data.ok ? 'online' : 'offline', team: data.team, user: data.user };
    } else {
      results.services.slack = { status: 'no_token' };
    }
  } catch { results.services.slack = { status: 'offline' }; }

  // Notion — check connection
  try {
    const notionKey = process.env.NOTION_API_KEY;
    if (notionKey) {
      const resp = await fetch('https://api.notion.com/v1/users/me', {
        headers: { 'Authorization': `Bearer ${notionKey}`, 'Notion-Version': '2022-06-28' },
        signal: AbortSignal.timeout(5000),
      });
      const data = await resp.json();
      results.services.notion = { status: resp.ok ? 'online' : 'offline', name: data.name };
    } else {
      results.services.notion = { status: 'no_token' };
    }
  } catch { results.services.notion = { status: 'offline' }; }

  // Ollama Beast
  try {
    const ollama = await probeJSON('http://host.docker.internal:18434/api/tags', 5000);
    results.services.ollama = {
      status: ollama ? 'online' : 'offline',
      models: ollama?.models?.length || 0,
    };
  } catch { results.services.ollama = { status: 'offline' }; }

  // Reel Pipeline
  try {
    const reel = await probeJSON(`http://148.230.100.223:7880/health`, 5000);
    results.services.reelPipeline = {
      status: reel?.status === 'ok' ? 'online' : 'offline',
      reels: reel?.reels || null,
    };
  } catch { results.services.reelPipeline = { status: 'offline' }; }

  // OpenClaw Beast
  try {
    const oc = await probe('http://148.230.100.223:64780', 5000);
    results.services.openclawBeast = { status: oc.ok ? 'online' : 'offline' };
  } catch { results.services.openclawBeast = { status: 'offline' }; }

  res.json(results);
});

// GET /api/network/topology - full network topology map
router.get('/topology', async (req, res) => {
  try {
    const subnets = db.prepare('SELECT * FROM subnets').all();
    const agents = db.prepare('SELECT * FROM agents').all();
    const processes = db.prepare("SELECT * FROM bot_processes WHERE status = 'running'").all();

    // Build topology
    const topology = subnets.map((subnet) => ({
      ...subnet,
      agents: agents.filter((a) => a.subnet_id === subnet.id).map((a) => ({
        ...a,
        process: processes.find((p) => p.agent_id === a.id) || null,
      })),
    }));

    // Unassigned agents
    const unassigned = agents.filter((a) => !a.subnet_id);

    res.json({ topology, unassigned });
  } catch (err) {
    console.error('[Network] Topology error:', err.message);
    res.status(500).json({ error: 'Failed to build topology' });
  }
});

// POST /api/network/subnets/:id/health - check subnet health
router.post('/subnets/:id/health', async (req, res) => {
  const subnet = db.prepare('SELECT * FROM subnets WHERE id = ?').get(req.params.id);
  if (!subnet) return res.status(404).json({ error: 'Subnet not found' });

  const checks = { subnet: subnet.id, timestamp: new Date().toISOString() };

  // Check Ollama on this subnet
  if (subnet.ollama_url) {
    try {
      const response = await fetch(`${subnet.ollama_url}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      const data = await response.json();
      checks.ollama = { status: 'green', models: data.models?.length || 0 };
    } catch (err) {
      checks.ollama = { status: 'red', error: err.message };
    }
  }

  // Check SSH reachability (for VPS/remote subnets)
  if (subnet.ssh_host) {
    try {
      await execAsync(`ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=no ${subnet.ssh_host} "echo ok"`, { timeout: 5000 });
      checks.ssh = { status: 'green' };
    } catch {
      checks.ssh = { status: 'red' };
    }
  }

  // Check Tailscale reachability
  if (subnet.tailscale_ip) {
    try {
      await execAsync(`tailscale ping --timeout=3s ${subnet.tailscale_ip}`, { timeout: 5000 });
      checks.tailscale = { status: 'green' };
    } catch {
      checks.tailscale = { status: 'red' };
    }
  }

  // Update subnet status
  const overallStatus = Object.values(checks).every((c) => c?.status !== 'red') ? 'online' : 'degraded';
  db.prepare('UPDATE subnets SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(overallStatus, subnet.id);

  res.json(checks);
});

export default router;
