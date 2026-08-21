import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { StudioView } from './components/StudioView';
import { RoomView } from './components/RoomView';
import { AnalysisView } from './components/AnalysisView';
import { TrainerView } from './components/TrainerView';
import { AuthModal } from './components/AuthModal';
import { SettingsModal } from './components/SettingsModal';
import { ApiClient } from './services/api';
import { ShieldCheck } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [studioInitialMode, setStudioInitialMode] = useState<string>('tap');
  const [wpm, setWpm] = useState<number>(15);
  const [user, setUser] = useState<any | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'offline' | 'checking'>('checking');

  // Check auth and backend health on load
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const token = ApiClient.getToken();
        if (token) {
          try {
            const me = await ApiClient.getMe();
            setUser(me);
          } catch (e) {
            ApiClient.setToken(null);
          }
        }
        // Test backend endpoint
        const res = await fetch('http://localhost:8000/health');
        if (res.ok) {
          setBackendStatus('connected');
        } else {
          setBackendStatus('offline');
        }
      } catch (e) {
        setBackendStatus('offline');
      }
    };
    checkBackend();
  }, []);

  const handleSelectModeFromDashboard = (tab: string, mode?: string) => {
    if (mode) setStudioInitialMode(mode);
    setCurrentTab(tab);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-abyss)' }}>
      {/* Global Navigation Header */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        wpm={wpm}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={() => {
          ApiClient.setToken(null);
          setUser(null);
        }}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1 }}>
        {currentTab === 'dashboard' && (
          <DashboardView
            onSelectMode={handleSelectModeFromDashboard}
            wpm={wpm}
          />
        )}

        {currentTab === 'studio' && (
          <StudioView
            initialMode={studioInitialMode}
            wpm={wpm}
            onSelectTab={setCurrentTab}
          />
        )}

        {currentTab === 'room' && (
          <RoomView
            wpm={wpm}
            user={user}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {currentTab === 'analysis' && (
          <AnalysisView />
        )}

        {currentTab === 'trainer' && (
          <TrainerView wpm={wpm} user={user} />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '24px 32px',
        background: 'rgba(7, 9, 14, 0.95)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Morse Signal Lab</span>
          <span>•</span>
          <span>ITU-R M.1677-1 Standard</span>
          <span>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} color="#34D399" />
            Zero Server Video Retention
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)' }}>
          <span className={`pulse-dot ${backendStatus === 'connected' ? '' : 'danger'}`} />
          <span>BACKEND ENGINE: {backendStatus === 'connected' ? 'ONLINE (FASTAPI)' : 'STANDALONE LOCAL MODE'}</span>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(u) => setUser(u)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        wpm={wpm}
        setWpm={setWpm}
      />
    </div>
  );
};
export default App;
