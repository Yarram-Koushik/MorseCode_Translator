import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Keyboard,
  Hand,
  Volume2,
  VolumeX,
  Play,
  Square,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Radio,
  Eye,
  Mic,
  Sun,
  Camera,
  Target,
} from 'lucide-react';
import { MorseService, ITU_MORSE_TABLE, type MorseToken } from '../services/morseService';
import { TimingService, type SignalInterval, type ReconstructedEvent } from '../services/timingService';
import { soundSynthesizer } from '../services/soundSynthesizer';
import { eyeBlinkDetector } from '../services/eyeBlinkDetector';
import { audioSignalDetector, type AudioSignalState } from '../services/audioSignalDetector';
import { lightFlashDetector, type LightDetectionState } from '../services/lightFlashDetector';
import { CalibrationModal } from './CalibrationModal';
import { ApiClient } from '../services/api';

interface StudioViewProps {
  initialMode?: string;
  wpm: number;
  onSelectTab: (tab: string) => void;
}

export const StudioView: React.FC<StudioViewProps> = ({ initialMode = 'tap', wpm, onSelectTab: _onSelectTab }) => {
  const [activeMode, setActiveMode] = useState<string>(initialMode);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);

  // Common Reconstructed State (Shared across all modalities)
  const [reconstructedMorse, setReconstructedMorse] = useState<string>('');
  const [reconstructedText, setReconstructedText] = useState<string>('');
  const [confidenceScore, setConfidenceScore] = useState<number>(1.0);
  const [signalQuality, setSignalQuality] = useState<number>(1.0);
  const [reconstructedEvents, setReconstructedEvents] = useState<ReconstructedEvent[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Keyboard Mode States
  const [inputText, setInputText] = useState<string>('HELLO WORLD');
  const [encodedMorse, setEncodedMorse] = useState<string>('');
  const [inputMorse, setInputMorse] = useState<string>('... --- ...');
  const [decodedText, setDecodedText] = useState<string>('SOS');
  const [keyboardTokens, setKeyboardTokens] = useState<MorseToken[]>([]);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [activePlayIndex, setActivePlayIndex] = useState<number>(-1);
  const [ambiguityCandidates, setAmbiguityCandidates] = useState<any[]>([]);

  // Telegraph Tap Key States
  const [isKeyPressed, setIsKeyPressed] = useState<boolean>(false);
  const [keyPressStartTime, setKeyPressStartTime] = useState<number | null>(null);
  const [currentHoldDuration, setCurrentHoldDuration] = useState<number>(0);
  const [tapIntervals, setTapIntervals] = useState<SignalInterval[]>([]);

  // Eye Blink Mode States
  const [isEyeCameraRunning, setIsEyeCameraRunning] = useState<boolean>(false);
  const [eyeEarState, setEyeEarState] = useState<{ left: number; right: number; avg: number; isBlinking: boolean }>({
    left: 0.3, right: 0.3, avg: 0.3, isBlinking: false
  });
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [eyeThreshold, setEyeThreshold] = useState<number>(0.22);
  const eyeVideoRef = useRef<HTMLVideoElement | null>(null);
  const eyeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const eyeStreamRef = useRef<MediaStream | null>(null);
  const eyeAnimFrameRef = useRef<number | null>(null);

  // Audio Mode States
  const [isAudioListening, setIsAudioListening] = useState<boolean>(false);
  const [audioState, setAudioState] = useState<AudioSignalState | null>(null);
  const [audioBandpassFreq, setAudioBandpassFreq] = useState<number>(700);
  const audioCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioAnimFrameRef = useRef<number | null>(null);

  // Light / Flash Mode States
  const [isLightCameraRunning, setIsLightCameraRunning] = useState<boolean>(false);
  const [lightState, setLightState] = useState<LightDetectionState | null>(null);
  const lightVideoRef = useRef<HTMLVideoElement | null>(null);
  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lightStreamRef = useRef<MediaStream | null>(null);
  const lightAnimFrameRef = useRef<number | null>(null);

  // Canvas Oscillograph Ref (for Tap Key)
  const tapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastReleaseTimeRef = useRef<number>(Date.now());
  const holdTimerRef = useRef<number | null>(null);
  const autoGapTimerRef = useRef<number | null>(null);

  // Timing thresholds from WPM
  const unitMs = Math.round(1200 / Math.max(wpm, 1));
  const dotMs = unitMs;
  const dashMs = unitMs * 3;
  const charGapMs = unitMs * 3;
  const wordGapMs = unitMs * 7;
  const timingServiceRef = useRef<TimingService>(new TimingService(dotMs, dashMs, charGapMs, wordGapMs));

  useEffect(() => {
    timingServiceRef.current.updateParameters(dotMs, dashMs, charGapMs, wordGapMs);
  }, [dotMs, dashMs, charGapMs, wordGapMs]);

  useEffect(() => {
    if (initialMode) setActiveMode(initialMode);
  }, [initialMode]);

  // Text -> Morse encode effect
  useEffect(() => {
    const res = MorseService.encode(inputText);
    setEncodedMorse(res.morse);
    setKeyboardTokens(res.tokens);
  }, [inputText]);

  // Morse -> Text decode effect
  useEffect(() => {
    const res = MorseService.decode(inputMorse);
    setDecodedText(res.text);
  }, [inputMorse]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlayMorse = async (morseToPlay: string) => {
    if (isPlayingAudio || !morseToPlay) return;
    setIsPlayingAudio(true);
    setActivePlayIndex(0);
    try {
      await soundSynthesizer.playMorseSequence(morseToPlay, wpm, (idx) => {
        setActivePlayIndex(idx);
      });
    } catch (e) {
      console.error('Audio play error', e);
    } finally {
      setIsPlayingAudio(false);
      setActivePlayIndex(-1);
    }
  };

  const handleCheckAmbiguity = async (morseSym: string) => {
    try {
      const res = await ApiClient.analyzeAmbiguity(morseSym);
      setAmbiguityCandidates(res.candidates);
    } catch (e) {
      const list = Object.entries(ITU_MORSE_TABLE)
        .filter(([_, m]) => m.length === morseSym.length || Math.abs(m.length - morseSym.length) <= 1)
        .slice(0, 4)
        .map(([char, morse]) => ({ char, morse, confidence: 0.65, reason: 'Similar length pattern' }));
      setAmbiguityCandidates(list);
    }
  };

  // Unified signal event processor
  const handleIngestSignalEvent = useCallback((type: 'pulse' | 'gap', durationMs: number, timestamp: number) => {
    if (durationMs < 20) return;

    setTapIntervals((prev) => {
      const updated = [...prev, { type, duration_ms: durationMs, timestamp_ms: timestamp }];
      const result = timingServiceRef.current.processIntervals(updated);
      setReconstructedMorse(result.morse);
      setReconstructedText(result.text);
      setConfidenceScore(result.confidence);
      setSignalQuality(result.signalQuality);
      setReconstructedEvents(result.events);
      return updated;
    });
  }, []);

  // ==========================================
  // TACTILE TELEGRAPH KEY HANDLERS
  // ==========================================
  const handleKeyDownAction = useCallback(() => {
    if (isKeyPressed) return;
    const now = Date.now();
    setIsKeyPressed(true);
    setKeyPressStartTime(now);
    setCurrentHoldDuration(0);

    if (soundEnabled) {
      soundSynthesizer.startTone();
    }

    if (lastReleaseTimeRef.current > 0 && tapIntervals.length > 0) {
      const gapDur = now - lastReleaseTimeRef.current;
      if (gapDur > 20) {
        setTapIntervals((prev) => [...prev, { type: 'gap', duration_ms: gapDur, timestamp_ms: lastReleaseTimeRef.current }]);
      }
    }

    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    holdTimerRef.current = window.setInterval(() => {
      setCurrentHoldDuration(Date.now() - now);
    }, 16);

    if (autoGapTimerRef.current) clearTimeout(autoGapTimerRef.current);
  }, [isKeyPressed, soundEnabled, tapIntervals.length]);

  const handleKeyUpAction = useCallback(() => {
    if (!isKeyPressed || !keyPressStartTime) return;
    const now = Date.now();
    const holdDuration = now - keyPressStartTime;

    setIsKeyPressed(false);
    setKeyPressStartTime(null);
    lastReleaseTimeRef.current = now;

    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    if (soundEnabled) {
      soundSynthesizer.stopTone();
    }

    if (holdDuration > 15) {
      const newIntervals: SignalInterval[] = [
        ...tapIntervals,
        { type: 'pulse', duration_ms: holdDuration, timestamp_ms: keyPressStartTime },
      ];
      setTapIntervals(newIntervals);

      const result = timingServiceRef.current.processIntervals(newIntervals);
      setReconstructedMorse(result.morse);
      setReconstructedText(result.text);
      setConfidenceScore(result.confidence);
      setSignalQuality(result.signalQuality);
      setReconstructedEvents(result.events);

      autoGapTimerRef.current = window.setTimeout(() => {
        const gapDur = Date.now() - now;
        if (gapDur >= charGapMs) {
          const withGap: SignalInterval[] = [
            ...newIntervals,
            { type: 'gap', duration_ms: gapDur, timestamp_ms: now },
          ];
          const gapResult = timingServiceRef.current.processIntervals(withGap);
          setReconstructedMorse(gapResult.morse);
          setReconstructedText(gapResult.text);
        }
      }, wordGapMs);
    }
  }, [isKeyPressed, keyPressStartTime, soundEnabled, tapIntervals, charGapMs, wordGapMs]);

  // Spacebar hotkey
  useEffect(() => {
    if (activeMode !== 'tap') return;

    const handleSpaceDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleKeyDownAction();
      }
    };
    const handleSpaceUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleKeyUpAction();
      }
    };

    window.addEventListener('keydown', handleSpaceDown);
    window.addEventListener('keyup', handleSpaceUp);
    return () => {
      window.removeEventListener('keydown', handleSpaceDown);
      window.removeEventListener('keyup', handleSpaceUp);
    };
  }, [activeMode, handleKeyDownAction, handleKeyUpAction]);

  // ==========================================
  // EYE-BLINK VISION DSP PIPELINE
  // ==========================================
  const startEyeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      eyeStreamRef.current = stream;
      if (eyeVideoRef.current) {
        eyeVideoRef.current.srcObject = stream;
        await eyeVideoRef.current.play();
      }

      await eyeBlinkDetector.initialize();
      eyeBlinkDetector.setThreshold(eyeThreshold);
      setIsEyeCameraRunning(true);

      const renderEyeLoop = () => {
        if (eyeVideoRef.current && eyeCanvasRef.current) {
          const video = eyeVideoRef.current;
          const canvas = eyeCanvasRef.current;
          const ctx = canvas.getContext('2d');

          if (ctx && video.readyState >= 2) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const frame = eyeBlinkDetector.processVideoFrame(
              video,
              performance.now(),
              (type, durationMs, timestamp) => {
                if (type === 'blink_start') {
                  if (soundEnabled) soundSynthesizer.startTone();
                } else if (type === 'blink_end') {
                  if (soundEnabled) soundSynthesizer.stopTone();
                  handleIngestSignalEvent('pulse', durationMs, timestamp);
                }
              }
            );

            setFaceDetected(frame.faceDetected);
            setEyeEarState({
              left: frame.leftEar,
              right: frame.rightEar,
              avg: frame.avgEar,
              isBlinking: frame.isBlinking,
            });

            // Draw eye overlay dots
            if (frame.landmarks) {
              ctx.fillStyle = frame.isBlinking ? '#F59E0B' : '#06B6D4';
              const leftOuter = frame.landmarks[33];
              const rightOuter = frame.landmarks[362];
              if (leftOuter) {
                ctx.beginPath();
                ctx.arc(leftOuter.x * canvas.width, leftOuter.y * canvas.height, 4, 0, 2 * Math.PI);
                ctx.fill();
              }
              if (rightOuter) {
                ctx.beginPath();
                ctx.arc(rightOuter.x * canvas.width, rightOuter.y * canvas.height, 4, 0, 2 * Math.PI);
                ctx.fill();
              }
            }
          }
        }
        eyeAnimFrameRef.current = requestAnimationFrame(renderEyeLoop);
      };

      renderEyeLoop();
    } catch (e) {
      console.error('Eye camera start error', e);
    }
  };

  const stopEyeCamera = () => {
    if (eyeAnimFrameRef.current) cancelAnimationFrame(eyeAnimFrameRef.current);
    if (eyeStreamRef.current) {
      eyeStreamRef.current.getTracks().forEach((t) => t.stop());
      eyeStreamRef.current = null;
    }
    setIsEyeCameraRunning(false);
  };

  // ==========================================
  // ACOUSTIC SOUND DSP PIPELINE
  // ==========================================
  const startAudioListening = async () => {
    const ok = await audioSignalDetector.start((type, durationMs, timestamp) => {
      if (type === 'pulse_end') {
        handleIngestSignalEvent('pulse', durationMs, timestamp);
      }
    });

    if (ok) {
      setIsAudioListening(true);
      const renderAudioLoop = () => {
        const state = audioSignalDetector.processAudio((type, durationMs, timestamp) => {
          if (type === 'pulse_end') {
            handleIngestSignalEvent('pulse', durationMs, timestamp);
          }
        });
        setAudioState(state);

        // Draw audio spectrum on canvas
        if (audioCanvasRef.current && state) {
          const canvas = audioCanvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const width = canvas.width;
            const height = canvas.height;
            ctx.clearRect(0, 0, width, height);

            const barWidth = (width / state.frequencyData.length) * 2;
            let x = 0;
            for (let i = 0; i < state.frequencyData.length; i++) {
              const barHeight = (state.frequencyData[i] / 255) * height;
              ctx.fillStyle = state.isActive ? 'rgba(245, 158, 11, 0.8)' : 'rgba(6, 182, 212, 0.7)';
              ctx.fillRect(x, height - barHeight, barWidth, barHeight);
              x += barWidth + 1;
            }
          }
        }

        audioAnimFrameRef.current = requestAnimationFrame(renderAudioLoop);
      };
      renderAudioLoop();
    }
  };

  const stopAudioListening = () => {
    if (audioAnimFrameRef.current) cancelAnimationFrame(audioAnimFrameRef.current);
    audioSignalDetector.stop();
    setIsAudioListening(false);
  };

  // ==========================================
  // LIGHT / FLASH OPTICAL DSP PIPELINE
  // ==========================================
  const startLightCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' },
      });
      lightStreamRef.current = stream;
      if (lightVideoRef.current) {
        lightVideoRef.current.srcObject = stream;
        await lightVideoRef.current.play();
      }
      setIsLightCameraRunning(true);

      const renderLightLoop = () => {
        if (lightVideoRef.current && lightCanvasRef.current) {
          const video = lightVideoRef.current;
          const canvas = lightCanvasRef.current;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          if (ctx && video.readyState >= 2) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const state = lightFlashDetector.processCanvasFrame(
              canvas,
              (type, durationMs, timestamp) => {
                if (type === 'light_on') {
                  if (soundEnabled) soundSynthesizer.startTone();
                } else if (type === 'light_off') {
                  if (soundEnabled) soundSynthesizer.stopTone();
                  handleIngestSignalEvent('pulse', durationMs, timestamp);
                }
              }
            );
            setLightState(state);

            // Draw ROI box
            const roi = lightFlashDetector.getROI();
            ctx.strokeStyle = state?.isActive ? '#F59E0B' : '#06B6D4';
            ctx.lineWidth = 3;
            ctx.strokeRect(roi.x * canvas.width, roi.y * canvas.height, roi.width * canvas.width, roi.height * canvas.height);
          }
        }
        lightAnimFrameRef.current = requestAnimationFrame(renderLightLoop);
      };
      renderLightLoop();
    } catch (e) {
      console.error('Light camera error', e);
    }
  };

  const stopLightCamera = () => {
    if (lightAnimFrameRef.current) cancelAnimationFrame(lightAnimFrameRef.current);
    if (lightStreamRef.current) {
      lightStreamRef.current.getTracks().forEach((t) => t.stop());
      lightStreamRef.current = null;
    }
    setIsLightCameraRunning(false);
  };

  // Cleanup all hardware on unmount or tab switch
  useEffect(() => {
    return () => {
      stopEyeCamera();
      stopAudioListening();
      stopLightCamera();
    };
  }, []);

  const handleClearAll = () => {
    setTapIntervals([]);
    setReconstructedMorse('');
    setReconstructedText('');
    setReconstructedEvents([]);
    setCurrentHoldDuration(0);
    lastReleaseTimeRef.current = 0;
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
      {/* Studio Header & Modality Navigation */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 24,
      }}>
        <div>
          <div className="telemetry-badge cyan" style={{ marginBottom: 6 }}>
            <Radio size={14} />
            <span>MULTIMODAL SIGNAL STUDIO</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#FFFFFF' }}>
            Signal Acquisition Workbench
          </h1>
        </div>

        {/* Modality Tabs */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          background: 'rgba(14, 19, 31, 0.9)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 4,
          gap: 4,
        }}>
          {[
            { id: 'tap', label: 'Telegraph Key', icon: Hand },
            { id: 'eye', label: 'Eye-Blink (Vision)', icon: Eye },
            { id: 'audio', label: 'Sound (Audio DSP)', icon: Mic },
            { id: 'light', label: 'Light / Flash', icon: Sun },
            { id: 'keyboard', label: 'Keyboard Tester', icon: Keyboard },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  stopEyeCamera();
                  stopAudioListening();
                  stopLightCamera();
                  setActiveMode(item.id);
                }}
                className="btn btn-ghost"
                style={{
                  background: isActive ? 'rgba(6, 182, 212, 0.18)' : 'transparent',
                  color: isActive ? 'var(--cyan-light)' : 'var(--text-secondary)',
                  border: isActive ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid transparent',
                  padding: '8px 14px',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Modality Top Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setIsCalibrating(true)}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.8rem' }}
          >
            <Target size={14} />
            <span>Calibrate {activeMode.toUpperCase()} Timing</span>
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="btn btn-ghost"
            style={{ padding: '8px 12px', fontSize: '0.8rem' }}
          >
            {soundEnabled ? <Volume2 size={16} color="var(--cyan-light)" /> : <VolumeX size={16} color="var(--text-muted)" />}
            <span style={{ marginLeft: 6 }}>{soundEnabled ? 'Sidetone Audio ON' : 'Audio Muted'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="telemetry-badge emerald" style={{ fontSize: '0.75rem' }}>
            QUALITY: {Math.round(signalQuality * 100)}%
          </span>
          <button
            onClick={handleClearAll}
            className="btn btn-ghost"
            style={{ padding: '8px 14px', fontSize: '0.8rem', color: 'var(--text-muted)' }}
          >
            <RotateCcw size={14} />
            <span>Clear Signals</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. EYE-BLINK VISION DSP MODE                                              */}
      {/* ========================================================================= */}
      {activeMode === 'eye' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24 }}>
          <div className="glass-panel" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Eye size={20} color="var(--cyan-light)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>FaceLandmarker Eye Aspect Ratio (EAR)</h3>
              </div>
              <span className={`telemetry-badge ${faceDetected ? 'emerald' : 'rose'}`}>
                {faceDetected ? 'FACE TRACKED' : 'SEARCHING FACE'}
              </span>
            </div>

            {/* Video Viewport Container */}
            <div style={{
              position: 'relative',
              width: '100%',
              height: 320,
              background: '#070A10',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
              marginBottom: 16,
            }}>
              <video ref={eyeVideoRef} style={{ display: 'none' }} playsInline muted />
              <canvas ref={eyeCanvasRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

              {!isEyeCameraRunning && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(7, 10, 16, 0.85)',
                  gap: 12,
                }}>
                  <Camera size={36} color="var(--text-muted)" />
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Camera stream is currently inactive</div>
                  <button onClick={startEyeCamera} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                    <Eye size={16} />
                    <span>Start Eye Tracking</span>
                  </button>
                </div>
              )}

              {isEyeCameraRunning && (
                <div style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  padding: '6px 12px',
                  background: 'rgba(0, 0, 0, 0.75)',
                  borderRadius: 6,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: eyeEarState.isBlinking ? 'var(--amber-light)' : 'var(--cyan-light)',
                  border: `1px solid ${eyeEarState.isBlinking ? 'var(--amber-signal)' : 'var(--cyan-primary)'}`,
                }}>
                  EAR: {eyeEarState.avg} • {eyeEarState.isBlinking ? 'CLOSED (BLINKING)' : 'EYES OPEN'}
                </div>
              )}
            </div>

            {/* EAR Threshold Slider & Controls */}
            {isEyeCameraRunning && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Blink Closure Threshold (EAR)</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan-light)' }}>{eyeThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min={0.12}
                    max={0.32}
                    step={0.01}
                    value={eyeThreshold}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEyeThreshold(val);
                      eyeBlinkDetector.setThreshold(val);
                    }}
                    style={{ width: '100%', accentColor: 'var(--cyan-primary)' }}
                  />
                </div>
                <button onClick={stopEyeCamera} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
                  Stop Camera
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Reconstructed Morse Stream */}
          <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Decoded Eye Signal Stream</h3>
                <span className="telemetry-badge emerald">CONFIDENCE: {Math.round(confidenceScore * 100)}%</span>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  RECONSTRUCTED MORSE
                </label>
                <div style={{
                  background: '#070A10',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.3rem',
                  letterSpacing: '0.15em',
                  color: 'var(--cyan-light)',
                  minHeight: 56,
                }}>
                  {reconstructedMorse || <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Blink short for DOT, hold longer for DASH...</span>}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  TRANSLATED TEXT
                </label>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  minHeight: 56,
                }}>
                  {reconstructedText || <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem', fontWeight: 400 }}>Awaiting eye blinks...</span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => handlePlayMorse(reconstructedMorse)} disabled={!reconstructedMorse} className="btn btn-secondary" style={{ flex: 1 }}>
                <Play size={16} />
                <span>Play Sound</span>
              </button>
              <button onClick={() => handleCopy(reconstructedText)} disabled={!reconstructedText} className="btn btn-primary" style={{ flex: 1 }}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ACOUSTIC SOUND DSP MODE                                                */}
      {/* ========================================================================= */}
      {activeMode === 'audio' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24 }}>
          <div className="glass-panel" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Mic size={20} color="var(--amber-light)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Microphone Spectral DSP</h3>
              </div>
              <span className={`telemetry-badge ${isAudioListening ? 'emerald' : 'rose'}`}>
                {isAudioListening ? 'LISTENING' : 'MICROPHONE IDLE'}
              </span>
            </div>

            {/* Audio Spectrum Canvas */}
            <div style={{
              background: '#070A10',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 8 }}>
                <span>REAL-TIME FREQUENCY SPECTRUM</span>
                <span>SNR: {audioState ? `${audioState.snr}x` : '—'}</span>
              </div>
              <canvas ref={audioCanvasRef} width={500} height={140} style={{ width: '100%', height: 140, display: 'block' }} />
            </div>

            {!isAudioListening ? (
              <button onClick={startAudioListening} className="btn btn-amber" style={{ width: '100%', padding: '12px 0' }}>
                <Mic size={18} />
                <span>Start Microphone Audio Detection</span>
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Target Tone Filter</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber-light)' }}>{audioBandpassFreq} Hz</span>
                  </div>
                  <input
                    type="range"
                    min={400}
                    max={1200}
                    step={25}
                    value={audioBandpassFreq}
                    onChange={(e) => {
                      const f = Number(e.target.value);
                      setAudioBandpassFreq(f);
                      audioSignalDetector.setFilterFrequency(f);
                    }}
                    style={{ width: '100%', accentColor: 'var(--amber-signal)' }}
                  />
                </div>
                <button onClick={stopAudioListening} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
                  Stop Audio
                </button>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Acoustic Morse Stream</h3>
                <span className="telemetry-badge amber">CONFIDENCE: {Math.round(confidenceScore * 100)}%</span>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  RECONSTRUCTED MORSE
                </label>
                <div style={{
                  background: '#070A10',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.3rem',
                  letterSpacing: '0.15em',
                  color: 'var(--amber-light)',
                  minHeight: 56,
                }}>
                  {reconstructedMorse || <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Make beeps, whistles or taps into mic...</span>}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  TRANSLATED TEXT
                </label>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  minHeight: 56,
                }}>
                  {reconstructedText || <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem', fontWeight: 400 }}>Awaiting acoustic pulses...</span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => handlePlayMorse(reconstructedMorse)} disabled={!reconstructedMorse} className="btn btn-secondary" style={{ flex: 1 }}>
                <Play size={16} />
                <span>Play Sound</span>
              </button>
              <button onClick={() => handleCopy(reconstructedText)} disabled={!reconstructedText} className="btn btn-primary" style={{ flex: 1 }}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. LIGHT / FLASH OPTICAL DSP MODE                                         */}
      {/* ========================================================================= */}
      {activeMode === 'light' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24 }}>
          <div className="glass-panel" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sun size={20} color="#FDE047" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Optical Luminance Differential (ROI)</h3>
              </div>
              <span className={`telemetry-badge ${lightState?.isActive ? 'amber' : 'cyan'}`}>
                {lightState?.isActive ? 'FLASH ON' : 'AMBIENT LEVEL'}
              </span>
            </div>

            <div style={{
              position: 'relative',
              width: '100%',
              height: 320,
              background: '#070A10',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
              marginBottom: 16,
            }}>
              <video ref={lightVideoRef} style={{ display: 'none' }} playsInline muted />
              <canvas ref={lightCanvasRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

              {!isLightCameraRunning && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(7, 10, 16, 0.85)',
                  gap: 12,
                }}>
                  <Sun size={36} color="var(--text-muted)" />
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Point camera at flashing light or torch</div>
                  <button onClick={startLightCamera} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                    <Camera size={16} />
                    <span>Start Light Camera</span>
                  </button>
                </div>
              )}
            </div>

            {isLightCameraRunning && (
              <button onClick={stopLightCamera} className="btn btn-secondary" style={{ width: '100%', padding: '10px 0' }}>
                Stop Light Camera
              </button>
            )}
          </div>

          {/* Right Column */}
          <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Decoded Optical Signal</h3>
                <span className="telemetry-badge cyan">CONFIDENCE: {Math.round(confidenceScore * 100)}%</span>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  RECONSTRUCTED MORSE
                </label>
                <div style={{
                  background: '#070A10',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.3rem',
                  letterSpacing: '0.15em',
                  color: 'var(--cyan-light)',
                  minHeight: 56,
                }}>
                  {reconstructedMorse || <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Flash light inside the box for dots and dashes...</span>}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  TRANSLATED TEXT
                </label>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  minHeight: 56,
                }}>
                  {reconstructedText || <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem', fontWeight: 400 }}>Awaiting light pulses...</span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => handlePlayMorse(reconstructedMorse)} disabled={!reconstructedMorse} className="btn btn-secondary" style={{ flex: 1 }}>
                <Play size={16} />
                <span>Play Sound</span>
              </button>
              <button onClick={() => handleCopy(reconstructedText)} disabled={!reconstructedText} className="btn btn-primary" style={{ flex: 1 }}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TACTILE TELEGRAPH KEY MODE                                             */}
      {/* ========================================================================= */}
      {activeMode === 'tap' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="glass-panel" style={{ padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Hand size={18} color="#34D399" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Tactile Telegraph Key</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mouse / Touch / Spacebar Trigger</span>
                </div>
              </div>
            </div>

            <div style={{
              background: '#070A10',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              marginBottom: 24,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                <span>SIGNAL OSCILLOGRAPH (TEMPORAL PULSE TRAIN)</span>
                <span>{tapIntervals.filter((i) => i.type === 'pulse').length} PULSES ({reconstructedEvents.length} EVENTS)</span>
              </div>
              <canvas ref={tapCanvasRef} width={560} height={100} style={{ width: '100%', height: 100, display: 'block', borderRadius: 4 }} />
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 0',
            }}>
              <div
                className={`telegraph-key ${isKeyPressed ? 'pressed' : ''}`}
                onMouseDown={handleKeyDownAction}
                onMouseUp={handleKeyUpAction}
                onMouseLeave={handleKeyUpAction}
                onTouchStart={(e) => { e.preventDefault(); handleKeyDownAction(); }}
                onTouchEnd={(e) => { e.preventDefault(); handleKeyUpAction(); }}
              >
                <div className="telegraph-key-cap">
                  {isKeyPressed ? 'ON' : 'PRESS'}
                </div>
              </div>

              <div style={{ marginTop: 18, textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: isKeyPressed ? 'var(--amber-light)' : 'var(--text-muted)',
                }}>
                  HOLD: {currentHoldDuration} ms • {currentHoldDuration > 0 ? (currentHoldDuration < (dotMs + dashMs)/2 ? 'DOT (.)' : 'DASH (-)') : 'IDLE'}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Signal Reconstruction & Decoder</h3>
                <div className="telemetry-badge emerald">CONFIDENCE: {Math.round(confidenceScore * 100)}%</div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  RECONSTRUCTED MORSE SEQUENCE
                </label>
                <div style={{
                  background: '#070A10',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.4rem',
                  letterSpacing: '0.15em',
                  color: 'var(--cyan-light)',
                  minHeight: 60,
                }}>
                  {reconstructedMorse || <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Tap the telegraph key to generate Morse pulses...</span>}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  DECODED TRANSLATION
                </label>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  minHeight: 60,
                }}>
                  {reconstructedText || <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem', fontWeight: 400 }}>Awaiting signal input...</span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => handlePlayMorse(reconstructedMorse)} disabled={!reconstructedMorse} className="btn btn-secondary" style={{ flex: 1 }}>
                <Play size={16} />
                <span>Replay Tone</span>
              </button>
              <button onClick={() => handleCopy(reconstructedText)} disabled={!reconstructedText} className="btn btn-primary" style={{ flex: 1 }}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. DETERMINISTIC KEYBOARD TESTER                                          */}
      {/* ========================================================================= */}
      {activeMode === 'keyboard' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="glass-panel" style={{ padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Keyboard size={18} color="var(--cyan-light)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Text to Morse Encoder</h3>
              </div>
              <span className="telemetry-badge cyan">ITU-R COMPLIANT</span>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type text to convert..."
              rows={3}
              style={{
                width: '100%',
                background: '#070A10',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
                color: 'var(--text-primary)',
                fontSize: '1rem',
                marginBottom: 16,
                outline: 'none',
              }}
            />

            <div style={{
              background: '#070A10',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              fontFamily: 'var(--font-mono)',
              fontSize: '1.2rem',
              color: 'var(--cyan-light)',
              minHeight: 56,
              marginBottom: 16,
            }}>
              {encodedMorse || '—'}
            </div>

            {/* Token Breakdown Chips */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                SYMBOL BREAKDOWN (CLICK TO ANALYZE AMBIGUITY)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {keyboardTokens.map((tok, idx) => (
                  <div
                    key={idx}
                    className={`morse-symbol-chip ${activePlayIndex === idx ? 'active' : ''}`}
                    onClick={() => handleCheckAmbiguity(tok.morse)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="char">{tok.char}</span>
                    <span className="code">{tok.morse}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => handlePlayMorse(encodedMorse)} disabled={!encodedMorse || isPlayingAudio} className="btn btn-primary" style={{ flex: 1 }}>
                {isPlayingAudio ? <Square size={16} /> : <Play size={16} />}
                <span>{isPlayingAudio ? 'Playing Tone...' : 'Play CW Audio'}</span>
              </button>
              <button onClick={() => handleCopy(encodedMorse)} disabled={!encodedMorse} className="btn btn-secondary" style={{ flex: 1 }}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied' : 'Copy Morse'}</span>
              </button>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="var(--amber-light)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Morse to Text Decoder</h3>
              </div>
              <span className="telemetry-badge amber">FUZZY TOLERANT</span>
            </div>

            <textarea
              value={inputMorse}
              onChange={(e) => setInputMorse(e.target.value)}
              placeholder="... --- ..."
              rows={3}
              style={{
                width: '100%',
                background: '#070A10',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
                color: 'var(--cyan-light)',
                fontSize: '1.1rem',
                fontFamily: 'var(--font-mono)',
                marginBottom: 16,
                outline: 'none',
              }}
            />

            <div style={{
              background: '#070A10',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              fontSize: '1.4rem',
              fontWeight: 800,
              color: '#FFFFFF',
              minHeight: 56,
              marginBottom: 16,
            }}>
              {decodedText || '—'}
            </div>

            {/* Ambiguity Candidates */}
            {ambiguityCandidates.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 6 }}>
                  UNCERTAINTY / BORDERLINE CANDIDATES
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ambiguityCandidates.map((cand, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderRadius: 6,
                        fontSize: '0.8rem',
                      }}
                    >
                      <span><strong>{cand.char}</strong> ({cand.morse})</span>
                      <span className="telemetry-badge amber">{Math.round(cand.confidence * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => handleCopy(decodedText)} disabled={!decodedText} className="btn btn-amber" style={{ width: '100%' }}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'Copied' : 'Copy Translation'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Guided Calibration Modal */}
      <CalibrationModal
        isOpen={isCalibrating}
        onClose={() => setIsCalibrating(false)}
        mode={activeMode as any}
        onCalibrationComplete={(cal) => {
          timingServiceRef.current.updateParameters(cal.dotMs, cal.dashMs, cal.charGapMs, cal.wordGapMs);
          if (activeMode === 'eye') {
            setEyeThreshold(cal.threshold);
            eyeBlinkDetector.setThreshold(cal.threshold);
          }
        }}
      />
    </div>
  );
};
