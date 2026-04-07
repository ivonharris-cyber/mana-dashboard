import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import db from '../db.js';

const router = Router();
const execAsync = promisify(exec);

async function checkService(name, checkFn) {
  const start = Date.now();
  try {
    const details = await checkFn();
    const responseTime = Date.now() - start;

    // Save to DB
    db.prepare('INSERT INTO service_checks (service, status, response_time) VALUES (?, ?, ?)').run(
      name, 'green', responseTime
    );

    return {
      service: name,
      status: 'green',
      responseTime,
      lastChecked: new Date().toISOString(),
      details: details || 'OK'
    };
  } catch (err) {
    const responseTime = Date.now() - start;
    const isTimeout = responseTime >= 3000 || err.type === 'aborted' || err.name === 'AbortError';
    const status = isTimeout ? 'amber' : 'red';

    db.prepare('INSERT INTO service_checks (service, status, response_time) VALUES (?, ?, ?)').run(
      name, status, responseTime
    );

    return {
      service: name,
      status,
      responseTime,
      lastChecked: new Date().toISOString(),
      details: err.message || 'Unreachable'
    };
  }
}

async function fetchWithTimeout(url, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// GET /api/services/health - check all services
router.get('/health', async (req, res) => {
  try {
    const checks = await Promise.all([
      // Ollama
      checkService('ollama', async () => {
        const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
        const response = await fetchWithTimeout(`${ollamaUrl}/api/tags`, 3000);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const modelCount = data.models ? data.models.length : 0;
        return `${modelCount} model(s) loaded`;
      }),

      // n8n
      checkService('n8n', async () => {
        const n8nUrl = process.env.N8N_URL || 'http://localhost:5678';
        const response = await fetchWithTimeout(`${n8nUrl}/api/v1/workflows`, 3000);
        if (!response.ok && response.status !== 401) throw new Error(`HTTP ${response.status}`);
        return response.status === 401 ? 'Running (auth required)' : 'Running';
      }),

      // Tailscale
      checkService('tailscale', async () => {
        try {
          const { stdout } = await execAsync('tailscale status --json', { timeout: 3000 });
          const data = JSON.parse(stdout);
          const peerCount = data.Peer ? Object.keys(data.Peer).length : 0;
          return `Connected, ${peerCount} peer(s)`;
        } catch (err) {
          throw new Error(err.stderr || err.message || 'Tailscale not available');
        }
      }),

      // VPS
      checkService('vps', async () => {
        const vpsHost = process.env.VPS_HOST || '141.136.47.94';
        const response = await fetchWithTimeout(`http://${vpsHost}:18789/health`, 5000);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return 'VPS online';
      }),

      // OpenClaw
      checkService('openclaw', async () => {
        const openclawUrl = process.env.OPENCLAW_URL || 'http://localhost:18789';
        const response = await fetchWithTimeout(`${openclawUrl}/health`, 3000);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return 'Gateway online';
      }),

      // Hapai Intranet
      checkService('hapai', async () => {
        const hapaiUrl = process.env.HAPAI_URL || 'http://192.168.17.55:3000';
        const response = await fetchWithTimeout(`${hapaiUrl}/api/health`, 3000);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return 'Intranet online';
      })
    ]);

    res.json({ services: checks, checkedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[Services] Health check error:', err.message);
    res.status(500).json({ error: 'Failed to check services' });
  }
});

export default router;
