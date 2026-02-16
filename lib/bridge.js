const DEFAULT_BRIDGE_URL = 'http://localhost:4317';

function getBridgeUrl() {
  if (typeof window === 'undefined') return DEFAULT_BRIDGE_URL;
  return localStorage.getItem('context7_bridge_url') || DEFAULT_BRIDGE_URL;
}

export function setBridgeUrl(url) {
  localStorage.setItem('context7_bridge_url', url);
}

async function request(path, options = {}) {
  const base = getBridgeUrl();
  const url = `${base}${path}`;
  const controller = new AbortController();
  const timeout = options.timeoutMs || 300000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method: options.method || 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json();
    return { ...data, _status: res.status };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Request timed out', _status: 0 };
    }
    return { ok: false, error: err.message, _status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth() {
  return request('/api/health', { method: 'GET', timeoutMs: 10000 });
}

export async function checkAuth() {
  return request('/api/auth/check', { timeoutMs: 15000 });
}

export async function listNotebooks() {
  return request('/api/notebook/list', { timeoutMs: 30000 });
}

export async function createNotebook(title) {
  return request('/api/notebook/create', { body: { title } });
}

export async function listSources(notebookId) {
  return request('/api/source/list', { body: { notebookId } });
}

export async function addSource({ notebookId, sourceType, value, title, wait = true }) {
  return request('/api/source/add', {
    body: { notebookId, sourceType, value, title, wait },
  });
}

export async function ingestContext7({ notebookId, sources, wait = true }) {
  return request('/api/context7/ingest', {
    body: { notebookId, sources, wait },
    timeoutMs: 600000,
  });
}

export async function queryNotebook({ notebookId, question, sourceIds, conversationId }) {
  return request('/api/query', {
    body: { notebookId, question, sourceIds, conversationId },
    timeoutMs: 180000,
  });
}

export async function createMindmap({ notebookId, title, sourceIds }) {
  return request('/api/mindmap/create', {
    body: { notebookId, title, sourceIds },
    timeoutMs: 300000,
  });
}

export async function packageRepomix(options = {}) {
  return request('/api/repomix/package', {
    body: options,
    timeoutMs: 300000,
  });
}

export async function bootstrap(payload) {
  return request('/api/flow/bootstrap', {
    body: payload,
    timeoutMs: 600000,
  });
}

export { getBridgeUrl };
