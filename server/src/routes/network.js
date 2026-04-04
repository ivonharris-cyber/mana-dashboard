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

// GET /api/network/discover - discover Tailscale peers + local network
router.get('/discover', async (req, res) => {
  const results = { tailscale: null, local: null, errors: [] };

  // Tailscale discovery
  try {
    const { stdout } = await execAsync('tailscale status --json', { timeout: 5000 });
    const data = JSON.parse(stdout);
    const self = data.Self || {};
    const peers = data.Peer ? Object.values(data.Peer) : [];

    results.tailscale = {
      connected: true,
      self: {
        name: self.HostName,
        ip: self.TailscaleIPs?.[0],
        os: self.OS,
        online: self.Online,
      },
      peers: peers.map((p) => ({
        name: p.HostName,
        ip: p.TailscaleIPs?.[0],
        os: p.OS,
        online: p.Online,
        lastSeen: p.LastSeen,
        isCat62: (p.HostName || '').toLowerCase().includes('cat62'),
      })),
    };

    // Auto-update cat62 subnet if found
    const cat62Peer = peers.find((p) => (p.HostName || '').toLowerCase().includes('cat62'));
    if (cat62Peer) {
      db.prepare('UPDATE subnets SET tailscale_ip = ?, status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(
        cat62Peer.TailscaleIPs?.[0] || null,
        cat62Peer.Online ? 'online' : 'offline',
        'cat62'
      );
    }

    // Update tailscale-mesh subnet
    db.prepare('UPDATE subnets SET tailscale_ip = ?, status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(
      self.TailscaleIPs?.[0] || null,
      'online',
      'tailscale-mesh'
    );
  } catch (err) {
    results.tailscale = { connected: false, error: err.message };
    results.errors.push(`Tailscale: ${err.message}`);
  }

  // Local network info
  try {
    const { stdout } = await execAsync('ipconfig', { timeout: 3000 });
    const ipMatches = [...stdout.matchAll(/IPv4 Address[.\s]*:\s*([\d.]+)/gi)];
    results.local = {
      addresses: ipMatches.map((m) => m[1]),
    };

    // Update local-lan subnet
    const lanIp = ipMatches.find((m) => m[1].startsWith('192.168.'));
    if (lanIp) {
      db.prepare('UPDATE subnets SET gateway = ?, status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(
        lanIp[1], 'online', 'local-lan'
      );
    }
  } catch (err) {
    results.errors.push(`Local: ${err.message}`);
  }

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
