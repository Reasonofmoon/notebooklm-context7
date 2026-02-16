'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { checkHealth, checkAuth, getBridgeUrl, setBridgeUrl } from '@/lib/bridge';
import './globals.css';

const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

const NAV_ITEMS = [
  { href: '/', icon: '⬡', label: 'Dashboard' },
  { href: '/studio', icon: '◈', label: 'Context7 Studio' },
  { href: '/query', icon: '◉', label: 'Query Console' },
];

function Sidebar({ bridgeStatus, onRefreshStatus }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">C7</div>
          <div>
            <div className="sidebar-logo-text">Context7 Coder</div>
            <div className="sidebar-logo-sub">Document-Grounded AI</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${pathname === item.href ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div
          className="bridge-status"
          onClick={onRefreshStatus}
          title="Click to refresh"
          style={{ cursor: 'pointer' }}
        >
          <span className={`bridge-dot ${bridgeStatus}`} />
          <span className="bridge-label">
            {bridgeStatus === 'connected' ? 'Bridge Connected' :
             bridgeStatus === 'checking' ? 'Checking...' :
             'Bridge Offline'}
          </span>
        </div>
      </div>
    </aside>
  );
}

function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

const ONBOARDING_STEPS = [
  {
    emoji: '🔌',
    label: 'Bridge 연결',
    desc: 'Dashboard에서 Bridge 서버 상태를 확인하고, 노트북을 생성하거나 선택합니다.',
    hint: 'localhost:4317',
  },
  {
    emoji: '◈',
    label: 'Context7 Studio',
    desc: '소스를 최대 7개까지 입력하고, Repomix로 코드를 패키징한 뒤 One-Click Bootstrap을 실행합니다.',
    hint: 'type|value|title',
  },
  {
    emoji: '🧠',
    label: 'Query Console',
    desc: '문서 근거 기반으로 AI에게 질문합니다. 템플릿을 활용하면 더욱 빠르게 시작할 수 있습니다.',
    hint: 'Ctrl + Enter',
  },
];

function OnboardingGuide({ onDismiss }) {
  const [closing, setClosing] = useState(false);

  const handleDismiss = useCallback((skipForever = false) => {
    setClosing(true);
    if (skipForever) {
      try { localStorage.setItem('c7_onboarding_skipped', 'true'); } catch {}
    }
    setTimeout(() => onDismiss(), 340);
  }, [onDismiss]);

  return (
    <div className={`onboarding-overlay ${closing ? 'closing' : ''}`} onClick={() => handleDismiss(false)}>
      <div className="onboarding-container" onClick={(e) => e.stopPropagation()}>
        <h2 className="onboarding-title">Context7 Coder 사용 가이드</h2>
        <p className="onboarding-subtitle">3단계로 문서 기반 AI 코딩을 시작하세요</p>

        <div className="onboarding-steps">
          {ONBOARDING_STEPS.map((step, i) => (
            <>
              {i > 0 && <div key={`arrow-${i}`} className="step-arrow">→</div>}
              <div key={i} className="onboarding-step">
                <div className="step-number">{i + 1}</div>
                <span className="step-emoji">{step.emoji}</span>
                <div className="step-label">{step.label}</div>
                <div className="step-desc">{step.desc}</div>
                <div className="step-hint">{step.hint}</div>
              </div>
            </>
          ))}
        </div>

        <button className="onboarding-dismiss" onClick={() => handleDismiss(false)}>
          ✨ 시작하기
        </button>
        <button className="onboarding-skip" onClick={() => handleDismiss(true)}>
          다시 보지 않기
        </button>
      </div>
    </div>
  );
}

function FloatingHelpButton({ onClick }) {
  return (
    <button className="floating-help-btn" onClick={onClick} title="사용 가이드 보기">
      ?
    </button>
  );
}

export default function RootLayout({ children }) {
  const [bridgeStatus, setBridgeStatus] = useState('checking');
  const [authStatus, setAuthStatus] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState('');
  const [selectedNotebookTitle, setSelectedNotebookTitle] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Show onboarding on first visit
  useEffect(() => {
    try {
      const skipped = localStorage.getItem('c7_onboarding_skipped');
      if (!skipped) {
        setShowOnboarding(true);
      }
    } catch {}
  }, []);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const refreshBridgeStatus = useCallback(async () => {
    setBridgeStatus('checking');
    try {
      const health = await checkHealth();
      if (health.ok) {
        setBridgeStatus('connected');
        const auth = await checkAuth();
        setAuthStatus(auth.ok ? 'authenticated' : 'unauthenticated');
      } else {
        setBridgeStatus('disconnected');
        setAuthStatus(null);
      }
    } catch {
      setBridgeStatus('disconnected');
      setAuthStatus(null);
    }
  }, []);

  useEffect(() => {
    refreshBridgeStatus();
    const interval = setInterval(refreshBridgeStatus, 30000);
    return () => clearInterval(interval);
  }, [refreshBridgeStatus]);

  const contextValue = {
    bridgeStatus,
    authStatus,
    selectedNotebookId,
    setSelectedNotebookId,
    selectedNotebookTitle,
    setSelectedNotebookTitle,
    addToast,
    refreshBridgeStatus,
  };

  return (
    <html lang="ko">
      <head>
        <title>Context7 Coder — Document-Grounded AI</title>
        <meta name="description" content="Repomix + NotebookLM 기반 문서 근거 중심 코딩 도구" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <AppContext.Provider value={contextValue}>
          <div className="app-shell">
            <Sidebar bridgeStatus={bridgeStatus} onRefreshStatus={refreshBridgeStatus} />
            <main className="main-content">
              {children}
            </main>
          </div>
          <ToastContainer toasts={toasts} />
          {showOnboarding && (
            <OnboardingGuide onDismiss={() => setShowOnboarding(false)} />
          )}
          {!showOnboarding && (
            <FloatingHelpButton onClick={() => setShowOnboarding(true)} />
          )}
        </AppContext.Provider>
      </body>
    </html>
  );
}
