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

export default function RootLayout({ children }) {
  const [bridgeStatus, setBridgeStatus] = useState('checking');
  const [authStatus, setAuthStatus] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState('');
  const [selectedNotebookTitle, setSelectedNotebookTitle] = useState('');

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
        </AppContext.Provider>
      </body>
    </html>
  );
}
