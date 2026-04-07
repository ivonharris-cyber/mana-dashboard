import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All routes require auth
router.use(authMiddleware);

function getN8NConfig() {
  const n8nUrl = process.env.N8N_URL || 'http://localhost:5678';
  const n8nAuth = process.env.N8N_AUTH || 'admin:trendweaver2026';
  const basicAuth = Buffer.from(n8nAuth).toString('base64');
  return { n8nUrl, basicAuth };
}

async function n8nFetch(path, options = {}) {
  const { n8nUrl, basicAuth } = getN8NConfig();
  const url = `${n8nUrl}${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`n8n responded with ${response.status}: ${text}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// GET /api/workflows/n8n-redirect - redirect to actual n8n UI
router.get('/n8n-redirect', (req, res) => {
  const { n8nUrl } = getN8NConfig();
  const subPath = req.query.path || '';
  res.redirect(`${n8nUrl}${subPath}`);
});

// GET /api/workflows - list all n8n workflows
router.get('/', async (req, res) => {
  try {
    const data = await n8nFetch('/api/v1/workflows');
    res.json(data);
  } catch (err) {
    console.error('[Workflows] List error:', err.message);
    res.status(502).json({
      error: 'Failed to fetch workflows from n8n',
      details: err.message
    });
  }
});

// POST /api/workflows/:id/activate - activate a workflow
router.post('/:id/activate', async (req, res) => {
  try {
    const data = await n8nFetch(`/api/v1/workflows/${req.params.id}/activate`, {
      method: 'POST'
    });
    res.json(data);
  } catch (err) {
    console.error('[Workflows] Activate error:', err.message);
    res.status(502).json({
      error: 'Failed to activate workflow',
      details: err.message
    });
  }
});

// POST /api/workflows/:id/deactivate - deactivate a workflow
router.post('/:id/deactivate', async (req, res) => {
  try {
    const data = await n8nFetch(`/api/v1/workflows/${req.params.id}/deactivate`, {
      method: 'POST'
    });
    res.json(data);
  } catch (err) {
    console.error('[Workflows] Deactivate error:', err.message);
    res.status(502).json({
      error: 'Failed to deactivate workflow',
      details: err.message
    });
  }
});

// POST /api/workflows/trigger/:id - trigger a workflow webhook
router.post('/trigger/:id', async (req, res) => {
  try {
    const data = await n8nFetch(`/webhook/${req.params.id}`, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Workflows] Trigger error:', err.message);
    res.status(502).json({
      error: 'Failed to trigger workflow',
      details: err.message
    });
  }
});

export default router;
