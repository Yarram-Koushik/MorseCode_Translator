import React from 'react';
import {
  Eye,
  Mic,
  Sun,
  Hand,
  Keyboard,
  Upload,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  Cpu,
  Radio
} from 'lucide-react';

interface DashboardViewProps {
  onSelectMode: (tab: string, mode?: string) => void;
  wpm: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectMode, wpm }) => {
  const inputModes = [
    {
      id: 'eye',
      title: 'Eye-Blink Morse',
      desc: 'High-precision facial landmark tracking & Eye Aspect Ratio (EAR) temporal blink detector.',
      icon: Eye,
      color: 'var(--cyan-light)',
      badge: 'VISION DSP',
      badgeClass: 'cyan',
    },
    {
      id: 'audio',
      title: 'Acoustic Sound Morse',
      desc: 'Real-time microphone audio processing with dynamic noise floor tracker and tone filter.',
      icon: Mic,
      color: 'var(--amber-light)',
      badge: 'AUDIO DSP',
      badgeClass: 'amber',
    },
    {
      id: 'light',
      title: 'Light & Flash Morse',
      desc: 'Video frame ROI luminance differential analyzer for flashlights and optical beacons.',
      icon: Sun,
      color: '#FDE047',
      badge: 'OPTICAL DSP',
      badgeClass: 'amber',
    },
    {
      id: 'tap',
      title: 'Tactile Telegraph Key',
      desc: 'Virtual precision telegraph key with real-time hold duration meter & tactile feedback.',
      icon: Hand,
      color: '#34D399',
      badge: 'PHYSICAL KEY',
      badgeClass: 'emerald',
    },
    {
      id: 'keyboard',
      title: 'Deterministic Studio',
      desc: 'Bi-directional text & Morse verification studio with ambiguity analysis and audio synthesis.',
      icon: Keyboard,
      color: '#A78BFA',
      badge: 'CORE ENGINE',
      badgeClass: 'cyan',
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>
      {/* Hero Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '48px 40px',
          marginBottom: 32,
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(14, 19, 31, 0.9) 0%, rgba(20, 27, 45, 0.8) 100%)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
        }}
      >
        <div style={{ maxWidth: 850, position: 'relative', zIndex: 2 }}>
          <div className="telemetry-badge cyan" style={{ marginBottom: 16 }}>
            <Cpu size={14} />
            <span>UNIFIED MULTIMODAL SIGNAL INTELLIGENCE PLATFORM</span>
          </div>

          <h1 style={{
            fontSize: '2.75rem',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            marginBottom: 16,
            color: '#FFFFFF',
          }}>
            Communicate <span style={{
              background: 'linear-gradient(135deg, #22D3EE, #38BDF8, #F59E0B)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>Beyond Typing.</span>
          </h1>

          <p style={{
            fontSize: '1.125rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: 28,
          }}>
            Detect and reconstruct Morse code across real-world physical signals: eye blinks, acoustic tones, light flashes, and tactile taps. Decoded with deterministic ITU precision and confidence estimation.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <button
              onClick={() => onSelectMode('studio', 'tap')}
              className="btn btn-primary"
              style={{ padding: '12px 24px', fontSize: '1rem' }}
            >
              <Zap size={18} />
              <span>Launch Live Signal Studio</span>
            </button>

            <button
              onClick={() => onSelectMode('room')}
              className="btn btn-secondary"
              style={{ padding: '12px 24px', fontSize: '1rem' }}
            >
              <Radio size={18} />
              <span>Start Real-time Comms</span>
            </button>

            <button
              onClick={() => onSelectMode('analysis')}
              className="btn btn-ghost"
              style={{ padding: '12px 24px', fontSize: '1rem', border: '1px solid var(--border-subtle)' }}
            >
              <Upload size={18} />
              <span>Analyze Media Recording</span>
            </button>
          </div>
        </div>

        {/* Decorative Accent */}
        <div style={{
          position: 'absolute',
          right: -50,
          top: -50,
          width: 350,
          height: 350,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Real-time Telemetry Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
        marginBottom: 36,
      }}>
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>PARIS SPEED</span>
            <Activity size={16} color="var(--cyan-primary)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {wpm} <span style={{ fontSize: '0.9rem', color: 'var(--cyan-light)', fontWeight: 500 }}>WPM</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Unit interval: {Math.round(1200 / wpm)} ms / dot
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>SIGNAL ENGINE</span>
            <ShieldCheck size={16} color="var(--emerald-lock)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34D399' }}>
            ITU-R M.1677
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Deterministic standard verification
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>EDGE PRIVACY</span>
            <ShieldCheck size={16} color="var(--amber-signal)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--amber-light)' }}>
            100% Client DSP
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Zero raw camera/mic data streamed to backend
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>MODALITIES</span>
            <Zap size={16} color="var(--cyan-primary)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            5 Inputs + Upload
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Eye, Audio, Light, Tap, Key, Media
          </div>
        </div>
      </div>

      {/* Input Modalities Grid */}
      <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Zap size={20} color="var(--cyan-primary)" />
        Signal Acquisition & Modalities
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 20,
        marginBottom: 40,
      }}>
        {inputModes.map((mode) => {
          const Icon = mode.icon;
          return (
            <div
              key={mode.id}
              onClick={() => onSelectMode('studio', mode.id)}
              className="glass-panel"
              style={{
                padding: 24,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon size={24} color={mode.color} />
                  </div>
                  <span className={`telemetry-badge ${mode.badgeClass}`}>
                    {mode.badge}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                  {mode.title}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
                  {mode.desc}
                </p>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 14,
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  OPEN STUDIO
                </span>
                <ArrowRight size={16} color="var(--cyan-light)" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Unified Architecture Diagram Panel */}
      <div className="glass-panel" style={{ padding: '32px 28px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
          Unified Signal Processing Pipeline
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 24 }}>
          Every input method normalizes through the same temporal reconstruction and ambiguity resolution engine:
        </p>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
        }}>
          <div style={{ padding: '10px 16px', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: 8, color: 'var(--cyan-light)' }}>
            Input Adapter (Eye / Audio / Light / Tap)
          </div>
          <span style={{ color: 'var(--text-muted)' }}>➔</span>
          <div style={{ padding: '10px 16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, color: 'var(--amber-light)' }}>
            Timestamped Signal Events (ON/OFF)
          </div>
          <span style={{ color: 'var(--text-muted)' }}>➔</span>
          <div style={{ padding: '10px 16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 8, color: '#6EE7B7' }}>
            Timing Engine (Paris Standard)
          </div>
          <span style={{ color: 'var(--text-muted)' }}>➔</span>
          <div style={{ padding: '10px 16px', background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.3)', borderRadius: 8, color: '#C4B5FD' }}>
            Morse Engine & Ambiguity Ranker
          </div>
          <span style={{ color: 'var(--text-muted)' }}>➔</span>
          <div style={{ padding: '10px 16px', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-primary)' }}>
            Decoded Text & Confidence Audit
          </div>
        </div>
      </div>
    </div>
  );
};
