'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApp } from './layout';
import {
  checkHealth,
  checkAuth,
  listNotebooks,
  createNotebook,
  getBridgeUrl,
  setBridgeUrl,
} from '@/lib/bridge';

function StatusCard({ icon, iconClass, title, value, detail }) {
  return (
    <div className="status-card">
      <div className={`status-icon ${iconClass}`}>{icon}</div>
      <div className="status-info">
        <h3>{title}</h3>
        <p>{value}{detail ? ` — ${detail}` : ''}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const app = useApp();
  const [health, setHealth] = useState(null);
  const [auth, setAuth] = useState(null);
  const [notebooks, setNotebooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [bridgeUrlInput, setBridgeUrlInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const h = await checkHealth();
      setHealth(h);
      if (h.ok) {
        const a = await checkAuth();
        setAuth(a);
        if (a.ok) {
          const n = await listNotebooks();
          if (n.ok && Array.isArray(n.data)) {
            setNotebooks(n.data);
          }
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    setBridgeUrlInput(getBridgeUrl());
    refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const result = await createNotebook(newTitle.trim());
    setCreating(false);
    if (result.ok && result.notebookId) {
      app.setSelectedNotebookId(result.notebookId);
      app.setSelectedNotebookTitle(newTitle.trim());
      app.addToast(`Notebook "${newTitle.trim()}" created`);
      setNewTitle('');
      refresh();
    } else {
      app.addToast(result.error || 'Failed to create notebook', 'error');
    }
  };

  const selectNotebook = (nb) => {
    const id = nb.notebook_id || nb.id || '';
    const title = nb.title || nb.name || '';
    app.setSelectedNotebookId(id);
    app.setSelectedNotebookTitle(title);
    app.addToast(`Selected: ${title}`);
  };

  const saveBridgeUrl = () => {
    setBridgeUrl(bridgeUrlInput.trim());
    app.addToast('Bridge URL updated — refreshing...');
    setShowSettings(false);
    setTimeout(() => {
      app.refreshBridgeStatus();
      refresh();
    }, 300);
  };

  const nlmVersion = health?.tools?.nlm?.stdout || 'N/A';
  const repomixVersion = health?.tools?.repomix?.stdout || 'N/A';

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Bridge 연결 상태와 노트북을 관리합니다</p>
      </div>

      {/* Status Grid */}
      <div className="status-grid">
        <StatusCard
          icon={app.bridgeStatus === 'connected' ? '✓' : '✗'}
          iconClass={app.bridgeStatus === 'connected' ? 'success' : 'error'}
          title="Bridge Server"
          value={app.bridgeStatus === 'connected' ? 'Connected' : 'Offline'}
          detail={app.bridgeStatus === 'connected' ? getBridgeUrl() : 'Start bridge server'}
        />
        <StatusCard
          icon={app.authStatus === 'authenticated' ? '🔑' : '🔒'}
          iconClass={app.authStatus === 'authenticated' ? 'success' : 'warning'}
          title="Auth (nlm)"
          value={app.authStatus === 'authenticated' ? 'Authenticated' : 'Not authenticated'}
          detail={app.authStatus !== 'authenticated' ? 'Run: nlm login' : ''}
        />
        <StatusCard
          icon="📦"
          iconClass="neutral"
          title="nlm CLI"
          value={nlmVersion.split('\n')[0]}
        />
        <StatusCard
          icon="🧩"
          iconClass="neutral"
          title="Repomix"
          value={repomixVersion.split('\n')[0]}
        />
      </div>

      {/* Settings Toggle */}
      <div style={{ marginBottom: 20 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowSettings(!showSettings)}
        >
          ⚙ Bridge Settings
        </button>
        {showSettings && (
          <div className="card" style={{ marginTop: 12, maxWidth: 500 }}>
            <div className="form-group">
              <label className="label">Bridge URL</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  value={bridgeUrlInput}
                  onChange={(e) => setBridgeUrlInput(e.target.value)}
                  placeholder="http://localhost:4317"
                />
                <button className="btn btn-primary btn-sm" onClick={saveBridgeUrl}>
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="two-col-wide">
        {/* Notebooks */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-icon">📒</span> Notebooks
            </span>
            <button className="btn btn-secondary btn-sm" onClick={refresh} disabled={loading}>
              {loading ? <span className="spinner spinner-sm" /> : '↻ Refresh'}
            </button>
          </div>

          {app.selectedNotebookId && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(108,92,231,0.08)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent-primary)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Selected Notebook</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{app.selectedNotebookTitle || app.selectedNotebookId}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{app.selectedNotebookId}</div>
            </div>
          )}

          {notebooks.length > 0 ? (
            <div className="notebook-grid">
              {notebooks.slice(0, 12).map((nb, i) => {
                const id = nb.notebook_id || nb.id || `nb-${i}`;
                const title = nb.title || nb.name || 'Untitled';
                return (
                  <div
                    key={id}
                    className={`notebook-item ${app.selectedNotebookId === id ? 'selected' : ''}`}
                    onClick={() => selectNotebook(nb)}
                  >
                    <h4>{title}</h4>
                    <p>{id}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="emoji">📒</div>
              <h3>{loading ? 'Loading notebooks...' : 'No notebooks found'}</h3>
              <p>Create a notebook below or connect your bridge server</p>
            </div>
          )}
        </div>

        {/* Create Notebook */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-icon">✚</span> Create Notebook
            </span>
          </div>
          <div className="form-group">
            <label className="label">Notebook Title</label>
            <input
              className="input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. context7-my-project"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={creating || !newTitle.trim()}
          >
            {creating ? <><span className="spinner spinner-sm" /> Creating...</> : '📒 Create & Select'}
          </button>
        </div>
      </div>
    </>
  );
}
