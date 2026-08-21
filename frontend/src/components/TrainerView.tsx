import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy,
  GraduationCap,
  Play,
  Volume2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Zap,
  Timer,
  Award,
  Flame,
  ArrowRight,
  Hand,
} from 'lucide-react';
import { ITU_MORSE_TABLE } from '../services/morseService';
import { soundSynthesizer } from '../services/soundSynthesizer';
import { ApiClient } from '../services/api';
import { TimingService, type SignalInterval } from '../services/timingService';

interface TrainerQuestion {
  prompt: string;
  morse: string;
  type: 'letter' | 'word' | 'prosign';
}

const BEGINNER_SET: TrainerQuestion[] = [
  { prompt: 'E', morse: '.', type: 'letter' },
  { prompt: 'T', morse: '-', type: 'letter' },
  { prompt: 'A', morse: '.-', type: 'letter' },
  { prompt: 'N', morse: '-.', type: 'letter' },
  { prompt: 'I', morse: '..', type: 'letter' },
  { prompt: 'M', morse: '--', type: 'letter' },
  { prompt: 'S', morse: '...', type: 'letter' },
  { prompt: 'O', morse: '---', type: 'letter' },
  { prompt: 'H', morse: '....', type: 'letter' },
  { prompt: '5', morse: '.....', type: 'letter' },
];

const INTERMEDIATE_SET: TrainerQuestion[] = [
  { prompt: 'CQ', morse: '-.-. --.-', type: 'word' },
  { prompt: 'SOS', morse: '... --- ...', type: 'prosign' },
  { prompt: 'HI', morse: '.... ..', type: 'word' },
  { prompt: 'RADIO', morse: '.-. .- -.. .. ---', type: 'word' },
  { prompt: 'SIGNAL', morse: '... .. --. -. .- .-..', type: 'word' },
  { prompt: 'ALPHA', morse: '.- .-.. .--. .... .-', type: 'word' },
  { prompt: 'BRAVO', morse: '-... .-. .- ...- ---', type: 'word' },
];

const ADVANCED_SET: TrainerQuestion[] = [
  { prompt: 'MAYDAY MAYDAY', morse: '-- .- -.-- -.. .- -.-- / -- .- -.-- -.. .- -.--', type: 'word' },
  { prompt: 'TRANSMIT CLEAR', morse: '- .-. .- -. ... -- .. - / -.-. .-.. . .- .-.', type: 'word' },
  { prompt: 'BEACON ACTIVE', morse: '-... . .- -.-. --- -. / .- -.-. - .. ...- .', type: 'word' },
];

export const TrainerView: React.FC<{ wpm: number; user: any | null }> = ({ wpm, user: _user }) => {
  const [activeTab, setActiveTab] = useState<'learn' | 'challenge'>('learn');

  // Learning Trainer States
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [practiceMode, setPracticeMode] = useState<'listen' | 'transmit'>('listen');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [isAnswerChecked, setIsAnswerChecked] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [mistakesList, setMistakesList] = useState<string[]>([]);

  // Telegraph Key Practice Transmit States
  const [isKeyPressed, setIsKeyPressed] = useState<boolean>(false);
  const [keyPressStart, setKeyPressStart] = useState<number | null>(null);
  const [tapIntervals, setTapIntervals] = useState<SignalInterval[]>([]);
  const [reconstructedMorse, setReconstructedMorse] = useState<string>('');
  const lastReleaseRef = useRef<number>(Date.now());
  const unitMs = Math.round(1200 / Math.max(wpm, 1));
  const timingServiceRef = useRef<TimingService>(new TimingService(unitMs, unitMs * 3, unitMs * 3, unitMs * 7));

  // Speedrun Challenge States
  const [isChallengeActive, setIsChallengeActive] = useState<boolean>(false);
  const [challengeType, setChallengeType] = useState<string>('speedrun_60');
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [challengeScore, setChallengeScore] = useState<number>(0);
  const [challengeSolved, setChallengeSolved] = useState<number>(0);
  const [challengeCurrentQ, setChallengeCurrentQ] = useState<TrainerQuestion>(BEGINNER_SET[0]);
  const [challengeAnswer, setChallengeAnswer] = useState<string>('');
  const [isChallengeFinished, setIsChallengeFinished] = useState<boolean>(false);

  const timerRef = useRef<number | null>(null);

  // Get active dataset
  const currentSet = level === 'beginner' ? BEGINNER_SET : level === 'intermediate' ? INTERMEDIATE_SET : ADVANCED_SET;
  const currentQ = currentSet[currentIndex % currentSet.length];

  // Auto-play audio prompt in 'listen' mode on new question
  useEffect(() => {
    if (activeTab === 'learn' && practiceMode === 'listen') {
      soundSynthesizer.playMorseSequence(currentQ.morse, wpm);
    }
  }, [currentIndex, level, practiceMode, activeTab, currentQ.morse, wpm]);

  // Handle checking answer in Trainer
  const handleCheckAnswer = () => {
    if (isAnswerChecked) {
      // Advance to next question
      setIsAnswerChecked(false);
      setUserAnswer('');
      setReconstructedMorse('');
      setTapIntervals([]);
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    const cleanedUser = practiceMode === 'listen' ? userAnswer.trim().toUpperCase() : reconstructedMorse.trim();
    const target = practiceMode === 'listen' ? currentQ.prompt.trim().toUpperCase() : currentQ.morse.trim();

    const ok = cleanedUser === target;
    setIsCorrect(ok);
    setIsAnswerChecked(true);

    if (ok) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      setCorrectCount((prev) => prev + 1);
    } else {
      setStreak(0);
      setWrongCount((prev) => prev + 1);
      if (!mistakesList.includes(currentQ.prompt)) {
        setMistakesList((prev) => [...prev, currentQ.prompt]);
      }
    }
  };

  // Telegraph Key Handlers for 'transmit' mode
  const handleKeyDownAction = useCallback(() => {
    if (isKeyPressed) return;
    const now = Date.now();
    setIsKeyPressed(true);
    setKeyPressStart(now);
    soundSynthesizer.startTone();

    if (lastReleaseRef.current > 0 && tapIntervals.length > 0) {
      const gap = now - lastReleaseRef.current;
      if (gap > 20) {
        setTapIntervals((prev) => [...prev, { type: 'gap', duration_ms: gap, timestamp_ms: lastReleaseRef.current }]);
      }
    }
  }, [isKeyPressed, tapIntervals.length]);

  const handleKeyUpAction = useCallback(() => {
    if (!isKeyPressed || !keyPressStart) return;
    const now = Date.now();
    const holdDuration = now - keyPressStart;

    setIsKeyPressed(false);
    setKeyPressStart(null);
    lastReleaseRef.current = now;
    soundSynthesizer.stopTone();

    if (holdDuration > 15) {
      const updated: SignalInterval[] = [
        ...tapIntervals,
        { type: 'pulse', duration_ms: holdDuration, timestamp_ms: keyPressStart },
      ];
      setTapIntervals(updated);

      const res = timingServiceRef.current.processIntervals(updated);
      setReconstructedMorse(res.morse);
    }
  }, [isKeyPressed, keyPressStart, tapIntervals]);

  // Start Speedrun Challenge
  const handleStartChallenge = (type: string) => {
    setChallengeType(type);
    setIsChallengeActive(true);
    setIsChallengeFinished(false);
    setChallengeScore(0);
    setChallengeSolved(0);
    setChallengeAnswer('');
    setTimeLeft(type === 'speedrun_60' ? 60 : 45);

    const allQuestions = [...BEGINNER_SET, ...INTERMEDIATE_SET];
    const randQ = allQuestions[Math.floor(Math.random() * allQuestions.length)];
    setChallengeCurrentQ(randQ);
    soundSynthesizer.playMorseSequence(randQ.morse, wpm);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleFinishChallenge();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Submit Answer in Speedrun Challenge
  const handleChallengeSubmit = () => {
    if (!isChallengeActive) return;
    const isOk = challengeAnswer.trim().toUpperCase() === challengeCurrentQ.prompt.trim().toUpperCase();

    if (isOk) {
      const points = 100 + Math.round(wpm * 2);
      setChallengeScore((prev) => prev + points);
      setChallengeSolved((prev) => prev + 1);
    }

    setChallengeAnswer('');
    const allQuestions = [...BEGINNER_SET, ...INTERMEDIATE_SET, ...ADVANCED_SET];
    const nextQ = allQuestions[Math.floor(Math.random() * allQuestions.length)];
    setChallengeCurrentQ(nextQ);
    soundSynthesizer.playMorseSequence(nextQ.morse, wpm);
  };

  const handleFinishChallenge = () => {
    setIsChallengeActive(false);
    setIsChallengeFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);

    // Submit to backend
    ApiClient.submitChallenge({
      challenge_id: challengeType,
      score: challengeScore,
      accuracy: challengeSolved > 0 ? 0.95 : 0.5,
      wpm_speed: wpm,
      time_taken_seconds: 60 - timeLeft,
      completed: true,
    }).catch(() => {});
  };

  const accuracy = correctCount + wrongCount > 0 ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 100;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
      {/* Header & Tabs */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 24,
      }}>
        <div>
          <div className="telemetry-badge emerald" style={{ marginBottom: 6 }}>
            <GraduationCap size={14} />
            <span>PHASE 5 MORSE FLUIDITY ACADEMY</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#FFFFFF' }}>
            Morse Trainer & Speedrun Arena
          </h1>
        </div>

        <div style={{
          display: 'flex',
          background: 'rgba(14, 19, 31, 0.9)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 4,
          gap: 4,
        }}>
          <button
            onClick={() => setActiveTab('learn')}
            className="btn btn-ghost"
            style={{
              background: activeTab === 'learn' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              color: activeTab === 'learn' ? '#34D399' : 'var(--text-secondary)',
              border: activeTab === 'learn' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
              padding: '8px 16px',
              fontSize: '0.85rem',
            }}
          >
            <GraduationCap size={16} />
            <span>Learning Trainer</span>
          </button>

          <button
            onClick={() => setActiveTab('challenge')}
            className="btn btn-ghost"
            style={{
              background: activeTab === 'challenge' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              color: activeTab === 'challenge' ? 'var(--amber-light)' : 'var(--text-secondary)',
              border: activeTab === 'challenge' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent',
              padding: '8px 16px',
              fontSize: '0.85rem',
            }}
          >
            <Trophy size={16} />
            <span>Speedrun Challenges</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 1. LEARNING TRAINER WORKBENCH                                         */}
      {/* ===================================================================== */}
      {activeTab === 'learn' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24 }}>
          {/* Main Flashcard Card */}
          <div className="glass-panel" style={{ padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              {/* Level & Practice Mode Pickers */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => { setLevel(lvl); setCurrentIndex(0); setIsAnswerChecked(false); }}
                      className="btn btn-ghost"
                      style={{
                        background: level === lvl ? 'rgba(6, 182, 212, 0.18)' : 'transparent',
                        color: level === lvl ? 'var(--cyan-light)' : 'var(--text-secondary)',
                        border: level === lvl ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid transparent',
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        textTransform: 'capitalize',
                      }}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => { setPracticeMode('listen'); setIsAnswerChecked(false); }}
                    className="btn btn-ghost"
                    style={{
                      background: practiceMode === 'listen' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                      color: practiceMode === 'listen' ? 'var(--amber-light)' : 'var(--text-secondary)',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                    }}
                  >
                    <Volume2 size={14} />
                    <span>Listen & Decode</span>
                  </button>

                  <button
                    onClick={() => { setPracticeMode('transmit'); setIsAnswerChecked(false); }}
                    className="btn btn-ghost"
                    style={{
                      background: practiceMode === 'transmit' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                      color: practiceMode === 'transmit' ? '#34D399' : 'var(--text-secondary)',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                    }}
                  >
                    <Hand size={14} />
                    <span>See & Transmit</span>
                  </button>
                </div>
              </div>

              {/* Flashcard Box */}
              <div style={{
                background: '#070A10',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: 'var(--radius-lg)',
                padding: '40px 24px',
                textAlign: 'center',
                marginBottom: 24,
                position: 'relative',
              }}>
                {practiceMode === 'listen' ? (
                  <div>
                    <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 12 }}>
                      AUDIO MORSE FLASHCARD • QUESTION #{currentIndex + 1}
                    </div>
                    <button
                      onClick={() => soundSynthesizer.playMorseSequence(currentQ.morse, wpm)}
                      className="btn btn-secondary"
                      style={{ padding: '12px 24px', fontSize: '1rem', margin: '0 auto 16px' }}
                    >
                      <Play size={18} />
                      <span>Replay CW Sidetone</span>
                    </button>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      Listen carefully to the rhythm and enter the plain letter or word below.
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 8 }}>
                      TARGET PROMPT TO TRANSMIT
                    </div>
                    <div style={{ fontSize: '3rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.1em', marginBottom: 8 }}>
                      {currentQ.prompt}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--cyan-light)', fontFamily: 'var(--font-mono)' }}>
                      Target Morse: {currentQ.morse}
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area */}
              {practiceMode === 'listen' ? (
                <div style={{ marginBottom: 24 }}>
                  <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                    ENTER YOUR DECODED ANSWER
                  </label>
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCheckAnswer(); }}
                    placeholder="Type decoded letter or word..."
                    disabled={isAnswerChecked}
                    style={{
                      width: '100%',
                      background: '#070A10',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: 14,
                      color: 'var(--text-primary)',
                      fontSize: '1.25rem',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.1em',
                      textAlign: 'center',
                      outline: 'none',
                    }}
                  />
                </div>
              ) : (
                <div style={{ marginBottom: 24, textAlign: 'center' }}>
                  <div
                    className={`telegraph-key ${isKeyPressed ? 'pressed' : ''}`}
                    onMouseDown={handleKeyDownAction}
                    onMouseUp={handleKeyUpAction}
                    onMouseLeave={handleKeyUpAction}
                    onTouchStart={(e) => { e.preventDefault(); handleKeyDownAction(); }}
                    onTouchEnd={(e) => { e.preventDefault(); handleKeyUpAction(); }}
                    style={{ width: 110, height: 110, margin: '0 auto 16px' }}
                  >
                    <div className="telegraph-key-cap" style={{ width: 75, height: 75, fontSize: '0.9rem' }}>
                      {isKeyPressed ? 'ON' : 'TAP'}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', color: 'var(--cyan-light)', minHeight: 32 }}>
                    {reconstructedMorse || 'Tap key to input code...'}
                  </div>
                </div>
              )}

              {/* Feedback Alert */}
              {isAnswerChecked && (
                <div style={{
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  background: isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 20,
                }}>
                  {isCorrect ? <CheckCircle2 size={24} color="#34D399" /> : <XCircle size={24} color="#F87171" />}
                  <div>
                    <strong style={{ color: isCorrect ? '#6EE7B7' : '#FCA5A5' }}>
                      {isCorrect ? 'Perfect! Accurate timing & translation.' : 'Not quite right.'}
                    </strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      Correct answer: <strong>{currentQ.prompt}</strong> ({currentQ.morse})
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleCheckAnswer}
              className={`btn ${isAnswerChecked ? 'btn-primary' : 'btn-amber'}`}
              style={{ width: '100%', padding: '14px 0', fontSize: '1rem' }}
            >
              {isAnswerChecked ? (
                <>
                  <span>Next Question</span>
                  <ArrowRight size={18} />
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Verify Answer</span>
                </>
              )}
            </button>
          </div>

          {/* Right Column: Performance Stats & Quick Alphabet Reference */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Stats Card */}
            <div className="glass-panel" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Training Performance</h3>
                <span className="telemetry-badge emerald">REAL-TIME</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 12, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ACCURACY</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34D399' }}>{accuracy}%</div>
                </div>
                <div style={{ padding: 12, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Flame size={12} color="var(--amber-light)" />
                    <span>STREAK</span>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--amber-light)' }}>{streak}</div>
                </div>
                <div style={{ padding: 12, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>SOLVED</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--cyan-light)' }}>{correctCount}</div>
                </div>
                <div style={{ padding: 12, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>PARIS SPEED</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{wpm} WPM</div>
                </div>
              </div>

              {mistakesList.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 6 }}>
                    LETTERS TO REVIEW
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {mistakesList.map((m, i) => (
                      <span key={i} className="telemetry-badge rose" style={{ fontSize: '0.75rem' }}>
                        {m} ({ITU_MORSE_TABLE[m] || ' '})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick ITU Reference Card */}
            <div className="glass-panel" style={{ padding: 20 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12 }}>ITU Quick Morse Cheat Sheet</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: '0.8rem', maxHeight: 220, overflowY: 'auto' }}>
                {Object.entries(ITU_MORSE_TABLE).slice(0, 26).map(([char, code]) => (
                  <div key={char} style={{ padding: '6px 8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{char}</strong>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan-light)' }}>{code}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. SPEEDRUN ARENA & TIME TRIALS                                       */}
      {/* ===================================================================== */}
      {activeTab === 'challenge' && (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {!isChallengeActive && !isChallengeFinished ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Challenge 1 */}
              <div className="glass-panel" style={{ padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Timer size={24} color="var(--amber-light)" />
                  </div>
                  <div className="telemetry-badge amber" style={{ marginBottom: 8 }}>TIME TRIAL</div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8 }}>60-Second Rapid Decode</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
                    Decode as many acoustic Morse code signals as possible before the 60-second timer runs out. Multipliers applied for streaks.
                  </p>
                </div>
                <button
                  onClick={() => handleStartChallenge('speedrun_60')}
                  className="btn btn-amber"
                  style={{ width: '100%', padding: '12px 0' }}
                >
                  <Zap size={16} />
                  <span>Start 60s Trial</span>
                </button>
              </div>

              {/* Challenge 2 */}
              <div className="glass-panel" style={{ padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Award size={24} color="var(--cyan-light)" />
                  </div>
                  <div className="telemetry-badge cyan" style={{ marginBottom: 8 }}>ACCURACY FOCUS</div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8 }}>Tactical Intercept Decipher</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
                    45-second high-speed intercepted transmission challenge with intermediate prosigns and words.
                  </p>
                </div>
                <button
                  onClick={() => handleStartChallenge('intercept_45')}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px 0' }}
                >
                  <Sparkles size={16} />
                  <span>Start Intercept</span>
                </button>
              </div>
            </div>
          ) : isChallengeActive ? (
            /* Active Challenge View */
            <div className="glass-panel" style={{ padding: 36 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Timer size={22} color="var(--amber-light)" />
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: timeLeft <= 10 ? '#F87171' : 'var(--amber-light)' }}>
                    {timeLeft}s REMAINING
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="telemetry-badge cyan" style={{ fontSize: '0.85rem' }}>
                    SCORE: {challengeScore}
                  </div>
                  <div className="telemetry-badge emerald" style={{ fontSize: '0.85rem' }}>
                    SOLVED: {challengeSolved}
                  </div>
                </div>
              </div>

              {/* Challenge Question Box */}
              <div style={{
                background: '#070A10',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 'var(--radius-lg)',
                padding: '40px 24px',
                textAlign: 'center',
                marginBottom: 24,
              }}>
                <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 12 }}>
                  LISTEN & DECODE
                </div>
                <button
                  onClick={() => soundSynthesizer.playMorseSequence(challengeCurrentQ.morse, wpm)}
                  className="btn btn-secondary"
                  style={{ padding: '10px 20px', margin: '0 auto 16px' }}
                >
                  <Play size={16} />
                  <span>Replay Sound</span>
                </button>
              </div>

              {/* Challenge Input */}
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  autoFocus
                  value={challengeAnswer}
                  onChange={(e) => setChallengeAnswer(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleChallengeSubmit(); }}
                  placeholder="Type answer and press Enter..."
                  style={{
                    flex: 1,
                    background: '#070A10',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: 14,
                    color: 'var(--text-primary)',
                    fontSize: '1.25rem',
                    fontFamily: 'var(--font-mono)',
                    textAlign: 'center',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleChallengeSubmit}
                  className="btn btn-amber"
                  style={{ padding: '0 24px' }}
                >
                  <span>Submit</span>
                </button>
              </div>
            </div>
          ) : (
            /* Challenge Completed Summary */
            <div className="glass-panel" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Trophy size={32} color="var(--amber-light)" />
              </div>
              <div className="telemetry-badge amber" style={{ marginBottom: 12 }}>SPEEDRUN COMPLETE</div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8 }}>
                Final Score: {challengeScore} Points
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                You successfully solved {challengeSolved} signals at {wpm} WPM speed!
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                <button
                  onClick={() => handleStartChallenge(challengeType)}
                  className="btn btn-amber"
                  style={{ padding: '12px 28px' }}
                >
                  <RotateCcw size={16} />
                  <span>Try Again</span>
                </button>
                <button
                  onClick={() => setIsChallengeFinished(false)}
                  className="btn btn-secondary"
                  style={{ padding: '12px 28px' }}
                >
                  <span>Choose Another Mode</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
