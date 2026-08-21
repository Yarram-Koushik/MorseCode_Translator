import React from 'react';
import { Radio, Activity, Settings, User as UserIcon, Volume2, Sparkles, Terminal } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  wpm: number;
  user: any | null;
  onOpenAuth: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  wpm,
  user,
  onOpenAuth,
  onOpenSettings,
  onLogout,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'studio', label: 'Signal Studio', icon: Radio },
    { id: 'room', label: 'Live Comms', icon: Terminal },
    { id: 'analysis', label: 'Decode Media', icon: Sparkles },
    { id: 'trainer', label: 'Trainer & Games', icon: Volume2 },
  ];

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(7, 9, 14, 0.85)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '0 24px',
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        height: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Brand Logo & Telemetry Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            onClick={() => setCurrentTab('dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(2, 132, 199, 0.4))',
              border: '1px solid var(--cyan-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(6, 182, 212, 0.25)',
            }}>
              <Radio size={20} color="var(--cyan-light)" />
            </div>
            <div>
              <div style={{
                fontSize: '1.1rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                MORSE <span style={{ color: 'var(--cyan-primary)' }}>SIGNAL LAB</span>
              </div>
              <div style={{
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
              }}>
                MULTIMODAL SIGNAL INTELLIGENCE
              </div>
            </div>
          </div>

          <div className="telemetry-badge cyan" style={{ display: 'none', marginLeft: 12 }}>
            <span className="pulse-dot" />
            <span>ONLINE • {wpm} WPM</span>
          </div>
        </div>

        {/* Center Navigation Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className="btn btn-ghost"
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? 'var(--cyan-light)' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid transparent',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.875rem',
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Status Badges & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="telemetry-badge amber" style={{ display: 'flex' }}>
            <span className="pulse-dot active" />
            <span>PARIS • {wpm} WPM</span>
          </div>

          <button
            onClick={onOpenSettings}
            className="btn btn-secondary"
            style={{ padding: 8, borderRadius: 'var(--radius-md)' }}
            title="Configure System & Calibration"
          >
            <Settings size={18} />
          </button>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="telemetry-badge emerald">
                <UserIcon size={12} />
                <span>{user.username}</span>
              </div>
              <button
                onClick={onLogout}
                className="btn btn-ghost"
                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <UserIcon size={16} />
              <span>Operator Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
