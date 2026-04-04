import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { execSync } from 'child_process';

const router = Router();
router.use(authMiddleware);

const NODES = [
  { id: 'local', name: 'ROG Strix', host: null, type: 'local', gpu: true },
  { id: 'mother-ship', name: 'Mother Ship', host: '141.136.47.94', type: 'vps' },
  { id: 'srv1558001', name: 'srv1558001', host: '148.230.100.223', type: 'vps' },
  { id: 'cat62', name: 'CAT S62 Pro', host: null, type: 'mobile', tailscale: '100.120.233.93' },
];

function runLocal(cmd) {
  try { return execSync(cmd, { timeout: 10000, encoding: 'utf-8' }).trim(); } catch { return ''; }
}

function runSSH(host, cmd) {
  try {
    return execSync(`ssh -o ConnectTimeout=5 -o BatchMode=yes root@${host} "${cmd.replace(/"/g, '\\"')}"`, {
      timeout: 15000, encoding: 'utf-8'
    }).trim();
  } catch { return ''; }
}

// GET /api/system/overview — all nodes status
router.get('/overview', async (req, res) => {
  const nodes = [];

  for (const node of NODES) {
    const info = { ...node, status: 'offline', cpu: null, ram: null, disk: null, gpu_info: null, docker: [] };

    if (node.type === 'mobile') {
      info.status = 'tailscale';
      nodes.push(info);
      continue;
    }

    try {
      if (node.type === 'local') {
        // Local machine stats
        const mem = runLocal('wsl -d Ubuntu-24.04 -e bash -c "free -b | grep Mem"');
        if (mem) {
          const parts = mem.split(/\s+/);
          info.ram = { total: parseInt(parts[1]) || 0, used: parseInt(parts[2]) || 0 };
        }

        // GPU via nvidia-smi
        const gpu = runLocal('nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,temperature.gpu,utilization.gpu --format=csv,noheader,nounits 2>nul');
        if (gpu) {
          const [name, vramTotal, vramUsed, vramFree, temp, util] = gpu.split(', ');
          info.gpu_info = {
            name, vram_total_mb: parseInt(vramTotal), vram_used_mb: parseInt(vramUsed),
            vram_free_mb: parseInt(vramFree), temp_c: parseInt(temp), utilization_pct: parseInt(util)
          };
        }

        // Disk
        const diskC = runLocal('wsl -d Ubuntu-24.04 -e bash -c "df -B1 /mnt/c | tail -1"');
        const diskD = runLocal('wsl -d Ubuntu-24.04 -e bash -c "df -B1 /mnt/d | tail -1"');
        info.disk = {};
        if (diskC) {
          const p = diskC.split(/\s+/);
          info.disk.C = { total: parseInt(p[1]) || 0, used: parseInt(p[2]) || 0, free: parseInt(p[3]) || 0 };
        }
        if (diskD) {
          const p = diskD.split(/\s+/);
          info.disk.D = { total: parseInt(p[1]) || 0, used: parseInt(p[2]) || 0, free: parseInt(p[3]) || 0 };
        }

        info.status = 'online';
      } else if (node.host) {
        // Remote VPS
        const stats = runSSH(node.host, 'echo CPU=$(nproc) && free -b | grep Mem && df -B1 / | tail -1 && docker ps --format {{.Names}} 2>/dev/null');
        if (stats) {
          info.status = 'online';
          const lines = stats.split('\n');
          for (const line of lines) {
            if (line.startsWith('CPU=')) info.cpu = parseInt(line.split('=')[1]);
            if (line.startsWith('Mem:')) {
              const p = line.split(/\s+/);
              info.ram = { total: parseInt(p[1]) || 0, used: parseInt(p[2]) || 0 };
            }
            if (line.startsWith('/dev/')) {
              const p = line.split(/\s+/);
              info.disk = { root: { total: parseInt(p[1]) || 0, used: parseInt(p[2]) || 0, free: parseInt(p[3]) || 0 } };
            }
          }
          info.docker = lines.filter(l => !l.startsWith('CPU=') && !l.startsWith('Mem:') && !l.startsWith('/dev/') && l.trim()).filter(Boolean);
        }
      }
    } catch { /* node unreachable */ }

    nodes.push(info);
  }

  res.json({ nodes });
});

// GET /api/system/vram — GPU VRAM details (local only)
router.get('/vram', (req, res) => {
  const gpu = runLocal('nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,temperature.gpu,utilization.gpu,power.draw,power.limit --format=csv,noheader,nounits 2>nul');
  if (!gpu) return res.json({ available: false });

  const [name, total, used, free, temp, util, power, powerLimit] = gpu.split(', ');
  const processes = runLocal('nvidia-smi --query-compute-apps=pid,name,used_memory --format=csv,noheader,nounits 2>nul');
  const procs = processes ? processes.split('\n').map(l => {
    const [pid, pname, mem] = l.split(', ');
    return { pid: parseInt(pid), name: pname?.trim(), vram_mb: parseInt(mem) };
  }).filter(p => p.pid) : [];

  res.json({
    available: true,
    gpu: {
      name: name?.trim(), vram_total_mb: parseInt(total), vram_used_mb: parseInt(used),
      vram_free_mb: parseInt(free), temp_c: parseInt(temp), utilization_pct: parseInt(util),
      power_w: parseFloat(power), power_limit_w: parseFloat(powerLimit),
    },
    processes: procs,
  });
});

// GET /api/system/storage — large files across all drives
router.get('/storage', (req, res) => {
  const drive = req.query.drive || 'D';
  const path = req.query.path || `\\AI\\models`;
  const fullPath = `${drive}:${path}`;

  const result = runLocal(`wsl -d Ubuntu-24.04 -e bash -c "find /mnt/${drive.toLowerCase()}${path.replace(/\\\\/g, '/')} -maxdepth 2 -type f -size +100M -printf '%s %p\\n' 2>/dev/null | sort -rn | head -50"`);

  const files = result ? result.split('\n').filter(Boolean).map(line => {
    const spaceIdx = line.indexOf(' ');
    const size = parseInt(line.substring(0, spaceIdx));
    const fpath = line.substring(spaceIdx + 1);
    const name = fpath.split('/').pop();
    const dir = fpath.substring(0, fpath.lastIndexOf('/'));
    return { name, path: fpath, dir, size_bytes: size, size_gb: parseFloat((size / 1e9).toFixed(2)) };
  }) : [];

  // Get drive totals
  const diskInfo = runLocal(`wsl -d Ubuntu-24.04 -e bash -c "df -B1 /mnt/${drive.toLowerCase()} | tail -1"`);
  let driveInfo = null;
  if (diskInfo) {
    const p = diskInfo.split(/\s+/);
    driveInfo = { total: parseInt(p[1]) || 0, used: parseInt(p[2]) || 0, free: parseInt(p[3]) || 0 };
  }

  res.json({ drive: fullPath, driveInfo, files, count: files.length });
});

// GET /api/system/storage/remote — large files on a VPS
router.get('/storage/remote', (req, res) => {
  const host = req.query.host || '141.136.47.94';
  const path = req.query.path || '/opt';

  const result = runSSH(host, `find ${path} -maxdepth 3 -type f -size +50M -printf '%s %p\\n' 2>/dev/null | sort -rn | head -50`);
  const files = result ? result.split('\n').filter(Boolean).map(line => {
    const spaceIdx = line.indexOf(' ');
    const size = parseInt(line.substring(0, spaceIdx));
    const fpath = line.substring(spaceIdx + 1);
    return { name: fpath.split('/').pop(), path: fpath, size_bytes: size, size_gb: parseFloat((size / 1e9).toFixed(2)) };
  }) : [];

  res.json({ host, path, files, count: files.length });
});

// POST /api/system/transfer — transfer file between nodes
router.post('/transfer', (req, res) => {
  const { from_host, from_path, to_host, to_path } = req.body;
  if (!from_path || !to_path) return res.status(400).json({ error: 'from_path and to_path required' });

  // This would be async in production — for now just validate
  res.json({
    status: 'queued',
    transfer: { from_host: from_host || 'local', from_path, to_host: to_host || 'local', to_path },
    command: from_host && to_host
      ? `scp root@${from_host}:${from_path} root@${to_host}:${to_path}`
      : from_host
        ? `scp root@${from_host}:${from_path} ${to_path}`
        : `scp ${from_path} root@${to_host}:${to_path}`
  });
});

export default router;
