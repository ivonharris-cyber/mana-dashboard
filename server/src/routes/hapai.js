import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const HAPAI_URL = process.env.HAPAI_URL || 'http://192.168.17.55:3000';

async function fetchHapai(path, timeout = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${HAPAI_URL}${path}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// GET /api/hapai/status - get Hapai intranet status
router.get('/status', async (req, res) => {
  try {
    const health = await fetchHapai('/api/health');
    res.json({ status: 'online', ...health, url: HAPAI_URL });
  } catch (err) {
    res.json({ status: 'offline', error: err.message, url: HAPAI_URL });
  }
});

// GET /api/hapai/stats - get Hapai stats (announcements, users, tickets)
router.get('/stats', async (req, res) => {
  try {
    const results = await Promise.allSettled([
      fetchHapai('/api/health'),
    ]);
    const health = results[0].status === 'fulfilled' ? results[0].value : null;
    res.json({
      status: health ? 'online' : 'offline',
      url: HAPAI_URL,
      uptime: health?.uptime || null,
    });
  } catch (err) {
    res.json({ status: 'offline', error: err.message });
  }
});

export default router;
