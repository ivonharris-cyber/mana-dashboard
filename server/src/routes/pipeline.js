/**
 * Pipeline — Resource splitting + tunnel management between local, cat62, VPS
 * Kali Commander manages tunnels; resources (Ollama, bots, services) get distributed
 */
import { Router } from 'express';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const execAsync = promisify(exec);

router.use(authMiddleware);

// Active tunnels
const tunnels = new Map(); // id -> { process, type, localPort, remoteHost, remotePort, status }

// ── GET /api/pipeline/status — full pipeline overview ─────────────
router.get('/status', async (req, res) => {
  try {
    const subnets = db.prepare('SELECT * FROM subnets').all();
    const agents = db.prepare('SELECT * FROM agents').all();
    const runningBots = db.prepare("SELECT * FROM bot_processes WHERE status = 'running'").all();

    // Check local Ollama
    let localOllama = { status: 'offline', models: [] };
    try {
      const resp = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) });
      const data = await resp.json();
      localOllama = { status: 'online', models: data.models?.map(m => m.name) || [] };
    } catch {}

    // Check VPS Ollama
    let vpsOllama = { status: 'offline', models: [] };
    try {
      const resp = await fetch('http://141.136.47.94:11434/api/tags', { signal: AbortSignal.timeout(3000) });
      const data = await resp.json();
      vpsOllama = { status: 'online', models: data.models?.map(m => m.name) || [] };
    } catch {}

    // Resource allocation plan
    const resourcePlan = buildResourcePlan(agents, subnets, localOllama, vpsOllama);

    // Active tunnels
    const activeTunnels = [];
    for (const [id, t] of tunnels) {
      activeTunnels.push({ id, type: t.type, localPort: t.localPort, remoteHost: t.remoteHost, remotePort: t.remotePort, status: t.status });
    }

    res.json({
      pipeline: {
        local: { ollama: localOllama, botsRunning: runningBots.filter(b => b.host === 'local').length },
        vps: { ollama: vpsOllama, botsRunning: runningBots.filter(b => b.host === 'vps').length, ssh: 'root@141.136.47.94' },
        cat62: { subnet: subnets.find(s => s.id === 'cat62'), botsRunning: runningBots.filter(b => b.host === 'cat62').length },
        tailscale: { subnet: subnets.find(s => s.id === 'tailscale-mesh') },
      },
      tunnels: activeTunnels,
      resourcePlan,
      agents: agents.map(a => ({
        id: a.id, name: a.display_name, host: a.host, subnet: a.subnet_id, status: a.status,
        assignedOllama: a.ollama_url || null,
      })),
    });
  } catch (err) {
    console.error('[Pipeline] Status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/pipeline/tunnel — create an SSH tunnel ──────────────
router.post('/tunnel', async (req, res) => {
  const { type, localPort, remoteHost, remotePort, sshTarget } = req.body;
  // type: 'forward' (local->remote) or 'reverse' (remote->local)
  if (!localPort || !remoteHost || !remotePort) {
    return res.status(400).json({ error: 'localPort, remoteHost, remotePort required' });
  }

  const ssh = sshTarget || 'root@141.136.47.94';
  const tunnelId = `${type || 'forward'}-${localPort}-${remotePort}`;

  if (tunnels.has(tunnelId)) {
    return res.status(409).json({ error: 'Tunnel already exists', id: tunnelId });
  }

  try {
    const flag = type === 'reverse' ? '-R' : '-L';
    const binding = type === 'reverse'
      ? `${remotePort}:${remoteHost}:${localPort}`
      : `${localPort}:${remoteHost}:${remotePort}`;

    const args = [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ServerAliveInterval=30',
      '-o', 'ServerAliveCountMax=3',
      '-N', // no shell
      flag, binding,
      ssh,
    ];

    console.log(`[Pipeline] Opening tunnel: ssh ${args.join(' ')}`);
    const proc = spawn('ssh', args, { stdio: 'pipe', detached: false });

    let errBuf = '';
    proc.stderr.on('data', d => { errBuf += d.toString(); });
    proc.on('exit', (code) => {
      console.log(`[Pipeline] Tunnel ${tunnelId} exited (code ${code})`);
      const t = tunnels.get(tunnelId);
      if (t) t.status = 'closed';
      tunnels.delete(tunnelId);
    });

    tunnels.set(tunnelId, {
      process: proc,
      type: type || 'forward',
      localPort,
      remoteHost,
      remotePort,
      sshTarget: ssh,
      status: 'open',
      createdAt: new Date().toISOString(),
    });

    // Log to relay
    db.prepare('INSERT INTO relay_messages (source, target, type, content) VALUES (?, ?, ?, ?)').run(
      'kali-commander', null, 'tunnel',
      `Tunnel ${tunnelId} opened: ${flag} ${binding} via ${ssh}`
    );

    res.json({ success: true, id: tunnelId, binding: `${flag} ${binding}`, ssh });
  } catch (err) {
    console.error('[Pipeline] Tunnel error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/pipeline/tunnel/:id — close a tunnel ──────────────
router.delete('/tunnel/:id', (req, res) => {
  const t = tunnels.get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tunnel not found' });

  t.process.kill('SIGTERM');
  tunnels.delete(req.params.id);

  db.prepare('INSERT INTO relay_messages (source, target, type, content) VALUES (?, ?, ?, ?)').run(
    'kali-commander', null, 'tunnel', `Tunnel ${req.params.id} closed`
  );

  res.json({ success: true, closed: req.params.id });
});

// ── POST /api/pipeline/assign — assign agent to a host/subnet ─────
router.post('/assign', (req, res) => {
  const { agentId, host, subnetId, ollamaUrl } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId required' });

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const updates = [];
  const vals = [];
  if (host !== undefined) { updates.push('host = ?'); vals.push(host); }
  if (subnetId !== undefined) { updates.push('subnet_id = ?'); vals.push(subnetId); }
  if (ollamaUrl !== undefined) { updates.push('ollama_url = ?'); vals.push(ollamaUrl); }

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  vals.push(agentId);
  db.prepare(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`).run(...vals);

  const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  res.json({ success: true, agent: updated });
});

// ── POST /api/pipeline/distribute — auto-distribute agents across resources ──
router.post('/distribute', async (req, res) => {
  try {
    const agents = db.prepare('SELECT * FROM agents').all();
    const subnets = db.prepare('SELECT * FROM subnets').all();

    // Check what Ollama instances are available
    const ollamaEndpoints = [];
    for (const s of subnets) {
      if (s.ollama_url) {
        try {
          const resp = await fetch(`${s.ollama_url}/api/tags`, { signal: AbortSignal.timeout(3000) });
          const data = await resp.json();
          ollamaEndpoints.push({ subnetId: s.id, url: s.ollama_url, models: data.models?.map(m => m.name) || [], host: s.host_type });
        } catch {
          // unreachable
        }
      }
    }

    if (ollamaEndpoints.length === 0) {
      return res.json({ success: false, error: 'No Ollama instances reachable', distributed: 0 });
    }

    // Distribute: assign agents to subnets with matching models
    const assignments = [];
    for (const agent of agents) {
      if (agent.subnet_id && agent.host !== 'local') continue; // already assigned to remote

      // Find an endpoint that has this agent's model
      const match = ollamaEndpoints.find(e => e.models.some(m => m.startsWith(agent.model?.split(':')[0] || '')));
      if (match) {
        db.prepare('UPDATE agents SET subnet_id = ?, ollama_url = ?, host = ? WHERE id = ?').run(
          match.subnetId, match.url, match.host === 'vps' ? 'vps' : 'local', agent.id
        );
        assignments.push({ agent: agent.id, subnet: match.subnetId, ollama: match.url });
      } else {
        // Default to local
        const localEndpoint = ollamaEndpoints.find(e => e.host === 'local') || ollamaEndpoints[0];
        db.prepare('UPDATE agents SET subnet_id = ?, ollama_url = ? WHERE id = ?').run(
          localEndpoint.subnetId, localEndpoint.url, agent.id
        );
        assignments.push({ agent: agent.id, subnet: localEndpoint.subnetId, ollama: localEndpoint.url });
      }
    }

    db.prepare('INSERT INTO relay_messages (source, target, type, content) VALUES (?, ?, ?, ?)').run(
      'kali-commander', null, 'pipeline',
      `Auto-distributed ${assignments.length} agents across ${ollamaEndpoints.length} Ollama endpoint(s)`
    );

    res.json({ success: true, distributed: assignments.length, assignments, endpoints: ollamaEndpoints });
  } catch (err) {
    console.error('[Pipeline] Distribute error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/pipeline/kali/setup — set up Kali tunnel between cat62 and VPS ──
router.post('/kali/setup', async (req, res) => {
  const { cat62Ip, vpsHost } = req.body;
  const vps = vpsHost || 'root@141.136.47.94';

  const results = { tunnels: [], errors: [] };

  // Tunnel 1: Forward local Kali tools port to VPS
  try {
    const t1Args = ['-o', 'StrictHostKeyChecking=no', '-o', 'ServerAliveInterval=30', '-N',
      '-L', `4444:127.0.0.1:4444`, vps];
    const p1 = spawn('ssh', t1Args, { stdio: 'pipe', detached: false });
    p1.on('exit', () => tunnels.delete('kali-local-vps-4444'));
    tunnels.set('kali-local-vps-4444', { process: p1, type: 'forward', localPort: 4444, remoteHost: '127.0.0.1', remotePort: 4444, sshTarget: vps, status: 'open', createdAt: new Date().toISOString() });
    results.tunnels.push('kali-local-vps-4444: forward local:4444 -> VPS:4444');
  } catch (e) { results.errors.push(`tunnel1: ${e.message}`); }

  // Tunnel 2: Forward Kali SSH from cat62 through to VPS
  if (cat62Ip) {
    try {
      const t2Args = ['-o', 'StrictHostKeyChecking=no', '-o', 'ServerAliveInterval=30', '-N',
        '-L', `2222:${cat62Ip}:22`, vps];
      const p2 = spawn('ssh', t2Args, { stdio: 'pipe', detached: false });
      p2.on('exit', () => tunnels.delete('kali-cat62-via-vps'));
      tunnels.set('kali-cat62-via-vps', { process: p2, type: 'forward', localPort: 2222, remoteHost: cat62Ip, remotePort: 22, sshTarget: vps, status: 'open', createdAt: new Date().toISOString() });
      results.tunnels.push(`kali-cat62-via-vps: forward local:2222 -> cat62(${cat62Ip}):22 via VPS`);
    } catch (e) { results.errors.push(`tunnel2: ${e.message}`); }
  }

  // Tunnel 3: Reverse tunnel — expose local Ollama to VPS
  try {
    const t3Args = ['-o', 'StrictHostKeyChecking=no', '-o', 'ServerAliveInterval=30', '-N',
      '-R', '11434:127.0.0.1:11434', vps];
    const p3 = spawn('ssh', t3Args, { stdio: 'pipe', detached: false });
    p3.on('exit', () => tunnels.delete('ollama-reverse-vps'));
    tunnels.set('ollama-reverse-vps', { process: p3, type: 'reverse', localPort: 11434, remoteHost: '127.0.0.1', remotePort: 11434, sshTarget: vps, status: 'open', createdAt: new Date().toISOString() });
    results.tunnels.push('ollama-reverse-vps: reverse VPS:11434 -> local Ollama:11434');
  } catch (e) { results.errors.push(`tunnel3: ${e.message}`); }

  db.prepare('INSERT INTO relay_messages (source, target, type, content) VALUES (?, ?, ?, ?)').run(
    'kali-commander', null, 'pipeline',
    `Kali tunnel setup: ${results.tunnels.length} tunnels opened, ${results.errors.length} errors`
  );

  res.json({ success: results.errors.length === 0, ...results });
});

// ── Helper: build resource allocation plan ────────────────────────
function buildResourcePlan(agents, subnets, localOllama, vpsOllama) {
  const plan = {
    local: { capacity: 'high', gpu: 'RTX 5080 16GB', ollama: localOllama.status, models: localOllama.models, recommendedAgents: [] },
    vps: { capacity: 'medium', gpu: 'none (CPU)', ollama: vpsOllama.status, models: vpsOllama.models, recommendedAgents: [] },
    cat62: { capacity: 'low', gpu: 'unknown', ollama: 'unknown', recommendedAgents: [] },
  };

  // Split: heavy models (35b, coder) stay local (GPU); light models (8b, hermes) can go to VPS
  for (const a of agents) {
    const model = a.model || '';
    if (model.includes('35b') || model.includes('coder') || model.includes('mixtral')) {
      plan.local.recommendedAgents.push(a.id);
    } else if (model.includes('8b') || model.includes('hermes')) {
      // Can run on VPS CPU or local
      if (vpsOllama.status === 'online') {
        plan.vps.recommendedAgents.push(a.id);
      } else {
        plan.local.recommendedAgents.push(a.id);
      }
    } else {
      plan.local.recommendedAgents.push(a.id);
    }
  }

  return plan;
}

export default router;
