import express from 'express';
const router = express.Router();

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const BOT_NAMES = ['Shield', 'Grok', 'Hera', 'Builder', 'Ops', 'Aroha', 'Cat62', 'ComfyUI Artist', 'AI Dev', 'Secretary', 'Dev Engineer', 'Media Listener', 'AutoBot SecTeam', 'Cyborg', 'Phoenix'];
const BOT_ACTIONS = [
  'Security scan completed', 'Content generated', 'Workflow triggered', 'Email processed',
  'Store health checked', 'Image rendered', 'API request handled', 'Database backed up',
  'SSL cert verified', 'Reel published', 'Product updated', 'Order processed',
  'Model inference complete', 'Log rotation done', 'Container health OK', 'Metrics collected',
  'Voice synthesis done', 'Template deployed', 'SEO audit complete', 'Cache cleared'
];
const NODES = ['Mother Ship', 'Beast', 'ROG Strix'];

function generateActivity() {
  const items = [];
  const count = randomBetween(8, 15);
  for (let i = 0; i < count; i++) {
    const mins = i * randomBetween(1, 4);
    items.push({
      bot: BOT_NAMES[randomBetween(0, BOT_NAMES.length - 1)],
      action: BOT_ACTIONS[randomBetween(0, BOT_ACTIONS.length - 1)],
      time: mins === 0 ? 'just now' : `${mins}m ago`,
      node: NODES[randomBetween(0, 2)],
      status: Math.random() > 0.1 ? 'success' : 'warning'
    });
  }
  return items;
}

router.get('/status', (req, res) => {
  const activeBots = randomBetween(6, 14);

  res.json({
    nodes: [
      {
        name: 'Mother Ship',
        ip: '141.136.47.94',
        tailscale_ip: '100.119.206.43',
        os: 'linux',
        status: 'online',
        cpu_percent: randomBetween(8, 45),
        memory_used_mb: randomBetween(3200, 4800),
        memory_total_mb: 8192,
        disk_used_gb: randomBetween(46, 52),
        disk_total_gb: 100,
        containers_running: randomBetween(13, 16),
        containers_total: 18,
        uptime_hours: randomBetween(200, 500)
      },
      {
        name: 'Beast / Dauntless',
        ip: '148.230.100.223',
        tailscale_ip: '100.95.62.64',
        os: 'linux',
        status: 'online',
        cpu_percent: randomBetween(15, 65),
        memory_used_mb: randomBetween(12000, 22000),
        memory_total_mb: 32768,
        disk_used_gb: randomBetween(180, 220),
        disk_total_gb: 331,
        containers_running: randomBetween(28, 35),
        containers_total: 38,
        uptime_hours: randomBetween(100, 300)
      },
      {
        name: 'ROG Strix',
        ip: 'local',
        tailscale_ip: 'local',
        os: 'windows',
        status: 'online',
        cpu_percent: randomBetween(5, 35),
        memory_used_mb: randomBetween(18000, 32000),
        memory_total_mb: 49152,
        disk_used_gb: randomBetween(580, 620),
        disk_total_gb: 1000,
        containers_running: randomBetween(2, 6),
        containers_total: 8,
        uptime_hours: randomBetween(10, 100),
        gpu: 'RTX 5080 16GB'
      }
    ],
    active_bots: activeBots,
    total_bots: 15,
    total_services: 24,
    active_workflows: randomBetween(18, 25),
    services: [
      { name: 'n8n', node: 'Mother Ship', port: 5678, status: 'healthy', detail: `${randomBetween(18, 25)} workflows` },
      { name: 'Portainer', node: 'Mother Ship', port: 9000, status: 'healthy', detail: '18 containers' },
      { name: 'Dozzle', node: 'Mother Ship', port: 8080, status: 'healthy', detail: 'Live logs' },
      { name: 'Uptime Kuma', node: 'Mother Ship', port: 3001, status: 'healthy', detail: 'Monitoring' },
      { name: 'OpenClaw', node: 'Mother Ship', port: 18789, status: 'healthy', detail: '15 agents' },
      { name: 'Ollama', node: 'Mother Ship', port: 11434, status: 'healthy', detail: '6 models' },
      { name: 'Dashboard', node: 'Mother Ship', port: 3003, status: 'healthy', detail: 'This app' },
      { name: 'Watchtower', node: 'Mother Ship', port: null, status: 'healthy', detail: 'Auto-update' },
      { name: 'OpenClaw', node: 'Beast', port: 64780, status: 'healthy', detail: '2 agents' },
      { name: 'Reel Pipeline', node: 'Beast', port: 7880, status: 'healthy', detail: `${randomBetween(15, 20)} reels` },
      { name: 'FaceForge', node: 'Beast', port: 7885, status: 'healthy', detail: 'Face swap API' },
      { name: 'Mana Node', node: 'Beast', port: 9080, status: 'healthy', detail: 'Health + Proxy' },
      { name: 'Kokoro TTS', node: 'Beast', port: 8880, status: 'healthy', detail: '67 voices' },
      { name: 'KFM Radio', node: 'Beast', port: 8089, status: 'healthy', detail: 'Live' },
      { name: 'ComfyUI', node: 'Beast', port: 8188, status: 'healthy', detail: '3 models' },
      { name: 'Ollama', node: 'Beast', port: 11434, status: 'healthy', detail: '5 models' },
      { name: 'Traefik', node: 'Beast', port: 443, status: 'healthy', detail: 'Reverse proxy' },
      { name: 'MariaDB', node: 'Beast', port: 3306, status: 'healthy', detail: '16 databases' },
      { name: 'Redis', node: 'Beast', port: 6379, status: 'healthy', detail: 'Cached' },
      { name: '16 WooCommerce Stores', node: 'Beast', port: 443, status: 'healthy', detail: '240 products' },
      { name: 'ManaMetaMaori.com', node: 'Beast', port: 3080, status: 'healthy', detail: 'React SPA' },
      { name: 'Grok Romance', node: 'Beast', port: 8091, status: Math.random() > 0.3 ? 'healthy' : 'idle', detail: 'Chat app' },
      { name: 'Showcase', node: 'Beast', port: 8090, status: 'healthy', detail: 'Reel viewer' },
      { name: 'Ollama', node: 'ROG Strix', port: 11434, status: 'healthy', detail: '8 models GPU' }
    ],
    tailscale_mesh: [
      { name: 'Mother Ship', ip: '100.119.206.43', os: 'linux', online: true },
      { name: 'Dauntless', ip: '100.95.62.64', os: 'linux', online: true },
      { name: 'S62 Pro', ip: '100.120.233.93', os: 'android', online: true },
      { name: 'admin-ivon-ndi', ip: '100.98.189.48', os: 'windows', online: false },
      { name: 'Security', ip: '100.69.148.57', os: 'android', online: true },
      { name: 'ROG Strix', ip: 'local', os: 'windows', online: true }
    ],
    recent_activity: generateActivity(),
    security: {
      firewall: 'active',
      fail2ban: 'active',
      last_scan: '2m ago',
      threats_blocked_24h: randomBetween(12, 80),
      ssl_certs_valid: 3,
      wordfence_stores: 16
    }
  });
});

export default router;
