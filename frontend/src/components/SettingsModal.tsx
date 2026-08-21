import React, { useState } from 'react';
import { X, Sliders, Volume2, ShieldCheck, Trash2, Eye, Keyboard, Check } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer';
import { ApiClient } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  wpm: number;
  setWpm: (wpm: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  wpm,
  setWpm,
}) => {
  const [sidetoneFreq, setSidetoneFreq] = useState<number>(650);
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    return localStorage.getItem('morse_high_contrast') === 'true';
  });
  const [purged, setPurged] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleFreqChange = (newFreq: number) => {
    setSidetoneFreq(newFreq);
    soundSynthesizer.setFrequency(newFreq);
  };

  const handleTestTone = () => {
    soundSynthesizer.startTone();
    setTimeout(() => soundSynthesizer.stopTone(), 200);
  };

  const handleToggleContrast = () => {
    const next = !highContrast;
    setHighContrast(next);
    localStorage.setItem('morse_high_contrast', String(next));
    if (next) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  };

  const handlePurgeAllData = () => {
    if (window.confirm('Are you sure you want to purge all local cached calibration profiles, tokens, and signal history?')) {
      ApiClient.setToken(null);
      localStorage.clear();
      setPurged(true);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: 16,
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: 520,
        padding: 32,
        position: 'relative',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ marginBottom: 24 }}>
          <div className="telemetry-badge amber" style={{ marginBottom: 8 }}>
            <Sliders size={12} />
            <span>CALIBRATION, TIMING & PRIVACY CONTROLS</span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Signal Settings & Audit</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Adjust transmission speed, audio side-tone synthesis, accessibility, and privacy.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* WPM Speed Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Standard Morse Speed (PARIS Standard)</span>
              <span className="telemetry-badge cyan">{wpm} WPM</span>
            </div>
            <input
              type="range"
              min={5}
              max={35}
              value={wpm}
              onChange={(e) => setWpm(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--cyan-primary)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              <span>5 WPM (Assistive / Slow)</span>
              <span>15 WPM (Standard)</span>
              <span>35 WPM (Expert)</span>
            </div>
          </div>

          {/* Sidetone Pitch Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>CW Sidetone Pitch Frequency</span>
              <span className="telemetry-badge amber">{sidetoneFreq} Hz</span>
            </div>
            <input
              type="range"
              min={400}
              max={950}
              step={10}
              value={sidetoneFreq}
              onChange={(e) => handleFreqChange(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--amber-signal)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Typical CW pitch: 600 - 700 Hz</span>
              <button
                type="button"
                onClick={handleTestTone}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              >
                <Volume2 size={12} />
                <span>Test Tone</span>
              </button>
            </div>
          </div>

          {/* Accessibility Mode Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Eye size={18} color="var(--cyan-light)" />
              <div>
                <strong style={{ fontSize: '0.85rem', color: '#FFFFFF' }}>High-Contrast Display Mode</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enhanced contrast borders and luminous text</div>
              </div>
            </div>
            <button
              onClick={handleToggleContrast}
              className={`btn ${highContrast ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.75rem' }}
            >
              {highContrast ? 'Active' : 'Disabled'}
            </button>
          </div>

          {/* Keyboard Shortcuts Guide */}
          <div style={{
            padding: 14,
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Keyboard size={14} color="var(--cyan-light)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Tactical Keyboard Shortcuts
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              <div><kbd style={{ background: '#1E293B', padding: '2px 6px', borderRadius: 4 }}>SPACEBAR</kbd> Telegraph Key</div>
              <div><kbd style={{ background: '#1E293B', padding: '2px 6px', borderRadius: 4 }}>ENTER</kbd> Submit Answer</div>
              <div><kbd style={{ background: '#1E293B', padding: '2px 6px', borderRadius: 4 }}>ESC</kbd> Close Dialogs</div>
              <div><kbd style={{ background: '#1E293B', padding: '2px 6px', borderRadius: 4 }}>1 - 5</kbd> Switch Modalities</div>
            </div>
          </div>

          {/* Privacy & Zero-Retention Guarantee */}
          <div style={{
            padding: 14,
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}>
            <ShieldCheck size={18} color="#34D399" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              <strong style={{ color: '#6EE7B7' }}>Zero Remote Video/Mic Retention:</strong> All live eye tracking, microphone DSP, and flash detection execute 100% locally in browser memory via MediaPipe WebAssembly and Web Audio API.
            </div>
          </div>

          {/* One-Click Privacy Purge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
            <button
              onClick={handlePurgeAllData}
              className="btn btn-ghost"
              style={{ color: '#F87171', padding: '6px 12px', fontSize: '0.8rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}
            >
              {purged ? <Check size={14} color="#34D399" /> : <Trash2 size={14} />}
              <span style={{ marginLeft: 6 }}>{purged ? 'Purged Successfully' : 'Purge All Local Data & Tokens'}</span>
            </button>

            <button
              onClick={onClose}
              className="btn btn-primary"
              style={{ padding: '8px 24px' }}
            >
              Apply & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
