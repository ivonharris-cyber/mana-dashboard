import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All routes require auth
router.use(authMiddleware);

function getN8NConfig() {
  const n8nUrl = process.env.N8N_URL || 'http://localhost:5678';
  const n8nEmail = process.env.N8N_EMAIL || 'admin@ivonharris.com';
  const n8nPassword = process.env.N8N_PASSWORD || 'ManaOps2026!';
  return { n8nUrl, n8nEmail, n8nPassword };
}

// Session cookie cache — avoids re-login on every request
let n8nSessionCookie = null;
let n8nSessionExpiry = 0;

async function n8nLogin() {
  const { n8nUrl, n8nEmail, n8nPassword } = getN8NConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${n8nUrl}/rest/login`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrLdapLoginId: n8nEmail,
        password: n8nPassword
      })
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`n8n login failed with ${response.status}: ${text}`);
    }

    // Extract session cookie from set-cookie header
    const setCookie = response.headers.get('set-cookie') || response.headers.get('Set-Cookie');
    if (setCookie) {
      // Parse all cookies from the header (may be comma-separated or multiple headers)
      const cookies = setCookie.split(/,(?=\s*\w+=)/).map(c => c.split(';')[0].trim());
      n8nSessionCookie = cookies.join('; ');
    }

    // Cache for 55 minutes (n8n sessions typically last 1 hour)
    n8nSessionExpiry = Date.now() + 55 * 60 * 1000;

    console.log('[Workflows] n8n session established');
    return n8nSessionCookie;
  } catch (err) {
    clearTimeout(timeout);
    n8nSessionCookie = null;
    n8nSessionExpiry = 0;
    throw err;
  }
}

async function getSessionCookie() {
  if (n8nSessionCookie && Date.now() < n8nSessionExpiry) {
    return n8nSessionCookie;
  }
  return await n8nLogin();
}

async function n8nFetch(path, options = {}) {
  const { n8nUrl } = getN8NConfig();
  const url = `${n8nUrl}${path}`;

  // Get or refresh session cookie
  let cookie;
  try {
    cookie = await getSessionCookie();
  } catch (loginErr) {
    throw new Error(`n8n login failed: ${loginErr.message}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers
    });
    clearTimeout(timeout);

    // If 401/403, invalidate session and retry once
    if (response.status === 401 || response.status === 403) {
      n8nSessionCookie = null;
      n8nSessionExpiry = 0;
      const retryCookie = await n8nLogin();
      const retryHeaders = { 'Content-Type': 'application/json', ...options.headers };
      if (retryCookie) retryHeaders['Cookie'] = retryCookie;

      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), 10000);
      const retryResponse = await fetch(url, {
        ...options,
        signal: retryController.signal,
        headers: retryHeaders
      });
      clearTimeout(retryTimeout);

      if (!retryResponse.ok) {
        const text = await retryResponse.text().catch(() => '');
        throw new Error(`n8n responded with ${retryResponse.status} after re-login: ${text}`);
      }

      const contentType = retryResponse.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await retryResponse.json();
      }
      return await retryResponse.text();
    }

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
    // n8n v2 wraps response in { data: [...] } — normalize to flat array
    const workflows = Array.isArray(data) ? data : (data?.data || data?.workflows || []);
    res.json({ workflows });
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
