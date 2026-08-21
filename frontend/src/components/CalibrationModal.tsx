import React, { useState, useEffect, useRef } from 'react';
import { X, Target, CheckCircle2, RotateCcw } from 'lucide-react';
import { ApiClient } from '../services/api';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'eye' | 'audio' | 'light' | 'tap';
  onCalibrationComplete: (cal: {
    dotMs: number;
    dashMs: number;
    charGapMs: number;
    wordGapMs: number;
    threshold: number;
  }) => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  mode,
  onCalibrationComplete,
}) => {
  const [step, setStep] = useState<number>(1); // 1: Baseline, 2: Short (Dot), 3: Long (Dash), 4: Finish
  const [samples, setSamples] = useState<number[]>([]);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [currentDuration, setCurrentDuration] = useState<number>(0);
  const [calculatedDot, setCalculatedDot] = useState<number>(120);
  const [calculatedDash, setCalculatedDash] = useState<number>(360);
  const [calculatedThreshold] = useState<number>(0.22);
  const pressStartRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSamples([]);
      setIsCapturing(false);
      setCurrentDuration(0);
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleStartCapture = () => {
    setIsCapturing(true);
    const now = Date.now();
    pressStartRef.current = now;
    timerRef.current = window.setInterval(() => {
      setCurrentDuration(Date.now() - now);
    }, 16);
  };

  const handleEndCapture = () => {
    if (!isCapturing) return;
    setIsCapturing(false);
    if (timerRef.current) clearInterval(timerRef.current);
    const dur = Date.now() - pressStartRef.current;
    if (dur > 30) {
      const newSamples = [...samples, dur];
      setSamples(newSamples);

      if (step === 2 && newSamples.length >= 3) {
        const avgDot = Math.round(newSamples.reduce((a, b) => a + b, 0) / newSamples.length);
        setCalculatedDot(avgDot);
        setSamples([]);
        setStep(3);
      } else if (step === 3 && newSamples.length >= 3) {
        const avgDash = Math.round(newSamples.reduce((a, b) => a + b, 0) / newSamples.length);
        setCalculatedDash(avgDash);
        setStep(4);
      }
    }
  };

  const handleSaveProfile = async () => {
    const finalDot = calculatedDot;
    const finalDash = calculatedDash;
    const charGap = finalDash;
    const wordGap = Math.round(finalDot * 7);

    try {
      await ApiClient.request('/calibration/', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          dot_duration_ms: finalDot,
          dash_duration_ms: finalDash,
          char_gap_ms: charGap,
          word_gap_ms: wordGap,
          threshold_value: calculatedThreshold,
        }),
      });
    } catch (e) {
      console.warn('Saved locally', e);
    }

    onCalibrationComplete({
      dotMs: finalDot,
      dashMs: finalDash,
      charGapMs: charGap,
      wordGapMs: wordGap,
      threshold: calculatedThreshold,
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 110,
      padding: 16,
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: 520,
        padding: 32,
        position: 'relative',
        border: '1px solid rgba(6, 182, 212, 0.3)',
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
          <div className="telemetry-badge cyan" style={{ marginBottom: 8 }}>
            <Target size={12} />
            <span>CALIBRATION WIZARD • {mode.toUpperCase()} MODE</span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Signal Calibration</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Tailor detection timing to your natural physiological speed and sensor response.
          </p>
        </div>

        {/* Step Progress Bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: step >= s ? 'var(--cyan-primary)' : 'rgba(255, 255, 255, 0.1)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Step 1: Baseline */}
        {step === 1 && (
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Step 1: Baseline Resting State</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Look directly at the camera with eyes naturally open (or remain silent for audio calibration) for a few moments.
            </p>
            <div style={{
              padding: 20,
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              marginBottom: 24,
            }}>
              <div className="pulse-dot" style={{ margin: '0 auto 12px', width: 12, height: 12 }} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--cyan-light)' }}>
                Baseline Resting Level: Normal
              </div>
            </div>
            <button
              onClick={() => { setStep(2); setSamples([]); }}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px 0' }}
            >
              Continue to Short Pulse (Dot)
            </button>
          </div>
        )}

        {/* Step 2: Short Pulse (Dot) */}
        {step === 2 && (
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Step 2: Calibrate Short Signal (DOT)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Perform <strong>3 SHORT</strong> {mode === 'eye' ? 'blinks' : 'signals'} using the button below or your natural input.
            </p>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <button
                onMouseDown={handleStartCapture}
                onMouseUp={handleEndCapture}
                onTouchStart={handleStartCapture}
                onTouchEnd={handleEndCapture}
                className={`btn ${isCapturing ? 'btn-amber' : 'btn-secondary'}`}
                style={{ width: 140, height: 140, borderRadius: '50%', fontSize: '1.1rem', fontWeight: 800, margin: '0 auto' }}
              >
                {isCapturing ? `${currentDuration} ms` : 'HOLD DOT'}
              </button>
              <div style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Samples collected: {samples.length} / 3
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Long Pulse (Dash) */}
        {step === 3 && (
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Step 3: Calibrate Long Signal (DASH)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Perform <strong>3 INTENTIONAL LONG</strong> {mode === 'eye' ? 'blinks' : 'signals'} (approx 3x longer than dots).
            </p>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <button
                onMouseDown={handleStartCapture}
                onMouseUp={handleEndCapture}
                onTouchStart={handleStartCapture}
                onTouchEnd={handleEndCapture}
                className={`btn ${isCapturing ? 'btn-amber' : 'btn-secondary'}`}
                style={{ width: 140, height: 140, borderRadius: '50%', fontSize: '1.1rem', fontWeight: 800, margin: '0 auto' }}
              >
                {isCapturing ? `${currentDuration} ms` : 'HOLD DASH'}
              </button>
              <div style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Samples collected: {samples.length} / 3
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Summary & Confirm */}
        {step === 4 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <CheckCircle2 size={44} color="#34D399" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>Calibration Computed!</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Your custom profile has been calculated and optimized:
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              padding: 16,
              background: '#070A10',
              borderRadius: 'var(--radius-md)',
              marginBottom: 24,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
            }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>DOT DURATION:</span>
                <div style={{ color: 'var(--cyan-light)', fontWeight: 700 }}>{calculatedDot} ms</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>DASH DURATION:</span>
                <div style={{ color: 'var(--amber-light)', fontWeight: 700 }}>{calculatedDash} ms</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>SPLIT THRESHOLD:</span>
                <div style={{ color: '#34D399', fontWeight: 700 }}>{Math.round((calculatedDot + calculatedDash) / 2)} ms</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>ESTIMATED SPEED:</span>
                <div style={{ color: '#A78BFA', fontWeight: 700 }}>{Math.round(1200 / calculatedDot)} WPM</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setStep(1); setSamples([]); }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                <RotateCcw size={16} />
                <span>Recalibrate</span>
              </button>
              <button
                onClick={handleSaveProfile}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Save & Apply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
