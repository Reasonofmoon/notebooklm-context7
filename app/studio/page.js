'use client';

import { useState, useCallback } from 'react';
import { useApp } from '../layout';
import {
  ingestContext7,
  listSources,
  bootstrap,
} from '@/lib/bridge';

const STEP_CONFIG = [
  { key: 'notebook', label: 'Notebook Ready', icon: '📒' },
  { key: 'repomix', label: 'Repomix Packaging', icon: '📦' },
  { key: 'repomixSource', label: 'Package Upload', icon: '⬆' },
  { key: 'context7', label: 'Context7 Ingestion', icon: '◈' },
];

function parseSourceLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const parts = line.split('|');
      return {
        sourceType: (parts[0] || '').trim(),
        value: (parts[1] || '').trim(),
        title: (parts[2] || '').trim(),
      };
    })
    .filter((s) => s.sourceType && s.value);
}

export default function StudioPage() {
  const app = useApp();

  // Context7 sources
  const [sourcesText, setSourcesText] = useState(
    'url|https://nextjs.org/docs|Next.js Docs'
  );

  // Repomix config
  const [repomixDir, setRepomixDir] = useState('');
  const [repomixInclude, setRepomixInclude] = useState('src/**/*,README.md,package.json');
  const [repomixIgnore, setRepomixIgnore] = useState('**/node_modules/**,**/.next/**,package-lock.json');
  const [repomixOutput, setRepomixOutput] = useState('artifacts/repomix-pack.md');
  const [repomixEnabled, setRepomixEnabled] = useState(true);

  // State
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState({});
  const [result, setResult] = useState(null);
  const [sources, setSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);

  const notebookId = app.selectedNotebookId;
  const notebookTitle = app.selectedNotebookTitle;

  const runBootstrap = useCallback(async () => {
    if (!notebookId && !notebookTitle) {
      app.addToast('Select or create a notebook first', 'error');
      return;
    }

    setRunning(true);
    setResult(null);
    setSteps({
      notebook: 'running',
      repomix: 'pending',
      repomixSource: 'pending',
      context7: 'pending',
    });

    const parsed = parseSourceLines(sourcesText);

    const payload = {
      notebookId: notebookId || '',
      notebookTitle: notebookTitle || 'context7-notebook',
      createNotebookIfMissing: !notebookId,
      wait: true,
      repomix: {
        enabled: repomixEnabled,
        addAsSource: true,
        dir: repomixDir || '.',
        output: repomixOutput,
        include: repomixInclude,
        ignore: repomixIgnore,
        style: 'markdown',
        sourceTitle: 'Repomix Pack',
      },
      sources: parsed,
    };

    try {
      const res = await bootstrap(payload);
      setResult(res);

      const stepStates = {};
      if (res.steps) {
        for (const key of ['notebook', 'repomix', 'repomixSource', 'context7']) {
          const s = res.steps[key];
          if (s === null || s === undefined) {
            stepStates[key] = 'pending';
          } else if (s.ok) {
            stepStates[key] = 'done';
          } else {
            stepStates[key] = 'failed';
          }
        }
      }
      setSteps(stepStates);

      if (res.ok) {
        app.addToast('Bootstrap completed successfully! 🎉');
        if (res.notebookId) {
          app.setSelectedNotebookId(res.notebookId);
        }
      } else {
        app.addToast(res.error || 'Bootstrap had issues', 'error');
      }
    } catch (err) {
      app.addToast(err.message, 'error');
      setSteps({ notebook: 'failed', repomix: 'failed', repomixSource: 'failed', context7: 'failed' });
    }

    setRunning(false);
  }, [notebookId, notebookTitle, sourcesText, repomixEnabled, repomixDir, repomixInclude, repomixIgnore, repomixOutput, app]);

  const ingestOnly = useCallback(async () => {
    if (!notebookId) {
      app.addToast('Select a notebook first', 'error');
      return;
    }
    const parsed = parseSourceLines(sourcesText);
    if (parsed.length === 0) {
      app.addToast('No sources to ingest', 'error');
      return;
    }
    setRunning(true);
    try {
      const res = await ingestContext7({ notebookId, sources: parsed });
      setResult(res);
      app.addToast(res.ok ? 'Context7 ingestion complete!' : 'Some sources failed', res.ok ? 'success' : 'error');
    } catch (err) {
      app.addToast(err.message, 'error');
    }
    setRunning(false);
  }, [notebookId, sourcesText, app]);

  const loadSources = useCallback(async () => {
    if (!notebookId) {
      app.addToast('Select a notebook first', 'error');
      return;
    }
    setLoadingSources(true);
    try {
      const res = await listSources(notebookId);
      if (res.ok && Array.isArray(res.data)) {
        setSources(res.data);
      } else {
        setSources([]);
        app.addToast('Failed to load sources', 'error');
      }
    } catch {}
    setLoadingSources(false);
  }, [notebookId, app]);

  const getStepIcon = (status) => {
    switch (status) {
      case 'done': return '✓';
      case 'running': return '⟳';
      case 'failed': return '✗';
      default: return '○';
    }
  };

  const parsedCount = parseSourceLines(sourcesText).length;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Context7 Studio</h1>
        <p className="page-subtitle">
          소스 주입 + Repomix 패키징 + One-Click Bootstrap
          {notebookId && (
            <span style={{ marginLeft: 12 }}>
              <span className="badge badge-neutral">📒 {notebookTitle || notebookId}</span>
            </span>
          )}
        </p>
      </div>

      <div className="two-col-wide">
        {/* Left: Configuration */}
        <div>
          {/* Context7 Sources */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">
                <span className="card-icon">◈</span> Context7 Sources
                <span className="badge badge-neutral">{parsedCount}/7</span>
              </span>
            </div>
            <div className="form-group">
              <label className="label">한 줄에 하나씩: type|value|title</label>
              <textarea
                className="textarea"
                rows={6}
                value={sourcesText}
                onChange={(e) => setSourcesText(e.target.value)}
                placeholder={`url|https://nextjs.org/docs|Next.js Docs\nfile|C:\\path\\to\\file.ts|My File\nyoutube|https://youtube.com/watch?v=xxx|Tutorial`}
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Types: <code>url</code> · <code>file</code> · <code>text</code> · <code>youtube</code> · <code>drive</code>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={ingestOnly}
              disabled={running || !notebookId}
            >
              ◈ Ingest Context7 Only
            </button>
          </div>

          {/* Repomix Config */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <span className="card-icon">📦</span> Repomix Settings
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={repomixEnabled}
                  onChange={(e) => setRepomixEnabled(e.target.checked)}
                />
                Enabled
              </label>
            </div>
            {repomixEnabled && (
              <>
                <div className="form-group">
                  <label className="label">Project Directory (relative to workspace)</label>
                  <input
                    className="input"
                    value={repomixDir}
                    onChange={(e) => setRepomixDir(e.target.value)}
                    placeholder="e.g. projects/my-app (default: workspace root)"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Include Glob</label>
                  <input
                    className="input"
                    value={repomixInclude}
                    onChange={(e) => setRepomixInclude(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="label">Ignore Glob</label>
                  <input
                    className="input"
                    value={repomixIgnore}
                    onChange={(e) => setRepomixIgnore(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="label">Output Path</label>
                  <input
                    className="input"
                    value={repomixOutput}
                    onChange={(e) => setRepomixOutput(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Actions & Status */}
        <div>
          {/* Bootstrap Action */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">
                <span className="card-icon">🚀</span> One-Click Bootstrap
              </span>
            </div>

            {!notebookId && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--warning)' }}>
                ⚠ Dashboard에서 노트북을 선택하거나 제목을 입력하면 자동 생성됩니다
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={runBootstrap}
              disabled={running}
              style={{ width: '100%', justifyContent: 'center', padding: '14px 20px', fontSize: 15 }}
            >
              {running ? (
                <><span className="spinner spinner-sm" /> Running Bootstrap...</>
              ) : (
                '🚀 Run Bootstrap'
              )}
            </button>

            {/* Progress Stepper */}
            {Object.keys(steps).length > 0 && (
              <div className="stepper">
                {STEP_CONFIG.map(({ key, label, icon }) => {
                  const status = steps[key] || 'pending';
                  return (
                    <div key={key} className={`step ${status}`}>
                      <span className="step-icon">{getStepIcon(status)}</span>
                      {icon} {label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sources List */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">
                <span className="card-icon">📋</span> Current Sources
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadSources}
                disabled={loadingSources || !notebookId}
              >
                {loadingSources ? <span className="spinner spinner-sm" /> : '↻ Load'}
              </button>
            </div>
            {sources.length > 0 ? (
              <div className="source-list">
                {sources.map((s, i) => (
                  <span key={i} className="source-tag">
                    <span className="type-badge">{s.source_type || s.type || '?'}</span>
                    {s.title || s.name || s.source_id || `Source ${i + 1}`}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {notebookId ? 'Click Load to see current sources' : 'Select a notebook first'}
              </p>
            )}
          </div>

          {/* Raw Result */}
          {result && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <span className="card-icon">📄</span> Result
                </span>
                <span className={`badge ${result.ok ? 'badge-success' : 'badge-error'}`}>
                  {result.ok ? 'SUCCESS' : 'FAILED'}
                </span>
              </div>
              <div className={`result-area ${result.ok ? 'success' : 'error'}`}>
                {JSON.stringify(result, null, 2)}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
