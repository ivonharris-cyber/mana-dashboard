/**
 * Claw Heartbeat — 1hr interval keepalive
 * Checks all services, pings Tailscale VPN, keeps laptop + services active
 * Sends status to relay log via the dashboard API
 */
import 'dotenv/config';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3003';
const HEARTBEAT_INTERVAL = 60 * 60 * 1000; // 1 hour
const VPS_HOST = process.env.VPS_HOST || '141.136.47.94';

async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function checkService(name, url) {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(url, 5000);
    return { name, status: res.ok ? 'green' : 'amber', ms: Date.now() - start };
  } catch {
    return { name, status: 'red', ms: Date.now() - start };
  }
}

async function heartbeat() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Claw Heartbeat — checking services...`);

  const checks = await Promise.allSettled([
    checkService('ollama', 'http://127.0.0.1:11434/api/tags'),
    checkService('n8n', 'http://localhost:5678'),
    checkService('dashboard', `${DASHBOARD_URL}/api/health`),
    checkService('vps', `http://${VPS_HOST}:18789/health`),
    checkService('openclaw', 'http://localhost:18789/health'),
  ]);

  const results = checks.map(c => c.status === 'fulfilled' ? c.value : { name: 'unknown', status: 'red', ms: 0 });
  const healthy = results.filter(r => r.status === 'green').length;
  const total = results.length;

  const summary = results.map(r => `${r.name}:${r.status}(${r.ms}ms)`).join(' | ');
  console.log(`[${timestamp}] ${healthy}/${total} healthy — ${summary}`);

  // Post to relay log
  try {
    await fetch(`${DASHBOARD_URL}/api/relay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'heartbeat',
        target: 'dashboard',
        type: healthy === total ? 'info' : 'warning',
        content: `Claw Heartbeat: ${healthy}/${total} services healthy — ${summary}`,
        metadata: JSON.stringify({ checks: results, timestamp })
      })
    });
  } catch {
    console.log(`[${timestamp}] Could not post to relay (dashboard may be offline)`);
  }

  // Ping Tailscale to keep VPN alive
  try {
    const { exec } = await import('child_process');
    exec('tailscale ping --timeout=3s ' + VPS_HOST, (err, stdout) => {
      if (err) {
        console.log(`[${timestamp}] Tailscale ping failed: ${err.message}`);
      } else {
        console.log(`[${timestamp}] Tailscale: ${stdout.trim()}`);
      }
    });
  } catch {
    console.log(`[${timestamp}] Tailscale ping skipped`);
  }

  // Prevent sleep — keep display active (Windows)
  try {
    const { exec } = await import('child_process');
    exec('powershell -Command "[System.Windows.Forms.SendKeys]::SendWait(\'{F15}\')"', () => {});
  } catch {
    // non-critical
  }
}

// Run immediately then every hour
console.log('Claw Heartbeat started — checking every 1 hour');
console.log(`Dashboard: ${DASHBOARD_URL}`);
console.log(`VPS: ${VPS_HOST}`);
console.log('---');
heartbeat();
setInterval(heartbeat, HEARTBEAT_INTERVAL);
