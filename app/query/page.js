'use client';

import { useState, useCallback, useRef } from 'react';
import { useApp } from '../layout';
import { queryNotebook } from '@/lib/bridge';

const TEMPLATES = [
  {
    label: '📌 근거 기반',
    text: '업로드된 소스만 근거로 답변해.\n추측 금지.\n각 결론마다 근거 소스명과 함수명을 명시해.\n마지막에 구현 체크리스트를 5개 이내로 정리해.',
  },
  {
    label: '🏗 아키텍처 분석',
    text: '업로드된 코드를 분석해서 전체 아키텍처를 설명해.\n주요 모듈 간 의존 관계를 정리하고, 개선 포인트를 제안해.',
  },
  {
    label: '🐛 버그 헌팅',
    text: '업로드된 코드에서 잠재적인 버그, 에러 처리 누락, 엣지 케이스를 찾아줘.\n각 이슈마다 해당 소스 파일과 라인을 명시해.',
  },
  {
    label: '📝 구현 가이드',
    text: '다음 기능을 구현하려고 해. 업로드된 소스 코드 패턴을 따라서 구체적인 구현 방법을 알려줘:\n\n[여기에 기능 설명]',
  },
];

export default function QueryPage() {
  const app = useApp();
  const [question, setQuestion] = useState('');
  const [sourceIds, setSourceIds] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultTab, setResultTab] = useState('answer');
  const [history, setHistory] = useState([]);
  const resultRef = useRef(null);

  const notebookId = app.selectedNotebookId;

  const handleQuery = useCallback(async () => {
    if (!notebookId) {
      app.addToast('Dashboard에서 노트북을 선택하세요', 'error');
      return;
    }
    if (!question.trim()) {
      app.addToast('질문을 입력하세요', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await queryNotebook({
        notebookId,
        question: question.trim(),
        sourceIds: sourceIds.trim() || undefined,
        conversationId: conversationId.trim() || undefined,
      });

      const entry = {
        id: Date.now(),
        question: question.trim(),
        answer: res.answer || '',
        sourcesUsed: res.sourcesUsed || [],
        conversationId: res.returnedConversationId || '',
        raw: res,
        ok: res.ok,
        timestamp: new Date().toLocaleTimeString(),
      };

      setHistory((prev) => [entry, ...prev]);

      if (res.returnedConversationId) {
        setConversationId(res.returnedConversationId);
      }

      if (res.ok) {
        app.addToast('Query completed');
      } else {
        app.addToast(res.error || 'Query failed', 'error');
      }
    } catch (err) {
      app.addToast(err.message, 'error');
    }
    setLoading(false);
  }, [notebookId, question, sourceIds, conversationId, app]);

  const applyTemplate = (text) => {
    setQuestion(text);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      app.addToast('Copied to clipboard');
    });
  };

  const latestResult = history[0] || null;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Query Console</h1>
        <p className="page-subtitle">
          문서 근거 기반 AI 질의
          {notebookId && (
            <span style={{ marginLeft: 12 }}>
              <span className="badge badge-neutral">📒 {app.selectedNotebookTitle || notebookId}</span>
            </span>
          )}
        </p>
      </div>

      {!notebookId && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(254,202,87,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--warning)' }}>
            <span style={{ fontSize: 24 }}>⚠</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>노트북 미선택</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Dashboard에서 노트북을 선택한 후 질의하세요
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="two-col-wide">
        {/* Left: Query Input */}
        <div>
          {/* Templates */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">
                <span className="card-icon">⚡</span> Quick Templates
              </span>
            </div>
            <div className="template-chips">
              {TEMPLATES.map((t, i) => (
                <button
                  key={i}
                  className="template-chip"
                  onClick={() => applyTemplate(t.text)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question Input */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <span className="card-icon">💬</span> Question
              </span>
            </div>
            <div className="form-group">
              <textarea
                className="textarea"
                rows={8}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="업로드된 소스만 근거로 답변해..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) handleQuery();
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
                <label className="label">Source IDs (optional, comma-separated)</label>
                <input
                  className="input"
                  value={sourceIds}
                  onChange={(e) => setSourceIds(e.target.value)}
                  placeholder="source1,source2"
                />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
                <label className="label">Conversation ID (for follow-up)</label>
                <input
                  className="input"
                  value={conversationId}
                  onChange={(e) => setConversationId(e.target.value)}
                  placeholder="auto-filled after first query"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                onClick={handleQuery}
                disabled={loading || !question.trim()}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {loading ? (
                  <><span className="spinner spinner-sm" /> Querying...</>
                ) : (
                  '◉ Query NotebookLM (Ctrl+Enter)'
                )}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setQuestion('');
                  setSourceIds('');
                  setConversationId('');
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div ref={resultRef}>
          {latestResult ? (
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <span className="card-icon">📄</span> Result
                  <span className={`badge ${latestResult.ok ? 'badge-success' : 'badge-error'}`}>
                    {latestResult.ok ? 'OK' : 'ERROR'}
                  </span>
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyToClipboard(
                      resultTab === 'answer' ? latestResult.answer : JSON.stringify(latestResult.raw, null, 2)
                    )}
                  >
                    📋 Copy
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="result-header">
                <div className="result-tabs">
                  <button
                    className={`result-tab ${resultTab === 'answer' ? 'active' : ''}`}
                    onClick={() => setResultTab('answer')}
                  >
                    Answer
                  </button>
                  <button
                    className={`result-tab ${resultTab === 'json' ? 'active' : ''}`}
                    onClick={() => setResultTab('json')}
                  >
                    JSON
                  </button>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {latestResult.timestamp}
                </span>
              </div>

              {/* Sources Used */}
              {latestResult.sourcesUsed.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Sources Used:</div>
                  <div className="source-list">
                    {latestResult.sourcesUsed.map((s, i) => (
                      <span key={i} className="source-tag">
                        {typeof s === 'string' ? s : s.title || s.source_id || `Source ${i + 1}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Content */}
              <div className={`result-area ${latestResult.ok ? 'success' : 'error'}`}>
                {resultTab === 'answer'
                  ? (latestResult.answer || 'No answer returned')
                  : JSON.stringify(latestResult.raw, null, 2)
                }
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <div className="emoji">◉</div>
                <h3>No results yet</h3>
                <p>질문을 입력하고 Query 버튼을 눌러 문서 근거 기반 답변을 받으세요</p>
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 1 && (
            <div className="card" style={{ marginTop: 20 }}>
              <div className="card-header">
                <span className="card-title">
                  <span className="card-icon">🕒</span> History
                  <span className="badge badge-neutral">{history.length}</span>
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setHistory([])}
                >
                  Clear
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {history.slice(1).map((entry) => (
                  <div
                    key={entry.id}
                    className="notebook-item"
                    onClick={() => {
                      setHistory((prev) => {
                        const idx = prev.findIndex((e) => e.id === entry.id);
                        if (idx <= 0) return prev;
                        const item = prev[idx];
                        return [item, ...prev.filter((_, i) => i !== idx)];
                      });
                    }}
                  >
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`badge ${entry.ok ? 'badge-success' : 'badge-error'}`} style={{ fontSize: 9 }}>
                        {entry.ok ? 'OK' : 'ERR'}
                      </span>
                      {entry.question.substring(0, 60)}{entry.question.length > 60 ? '...' : ''}
                    </h4>
                    <p>{entry.timestamp}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
