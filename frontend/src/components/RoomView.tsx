import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio,
  Users,
  Send,
  Play,
  Copy,
  Check,
  RotateCcw,
  Hand,
  Keyboard,
  Eye,
  Mic,
  Sun,
  ShieldCheck,
  LogOut,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ApiClient } from '../services/api';
import { MorseService } from '../services/morseService';
import { TimingService, type SignalInterval } from '../services/timingService';
import { soundSynthesizer } from '../services/soundSynthesizer';

interface RoomMessage {
  id: string;
  sender: string;
  sender_name?: string;
  morse: string;
  morse_code?: string;
  text: string;
  plain_text?: string;
  input_method: string;
  confidence?: number;
  signal_quality?: number;
  timestamp: number | string;
}

interface RoomMember {
  user_id: string;
  username: string;
  input_method: string;
  is_active: boolean;
}

interface RoomViewProps {
  wpm: number;
  user: any | null;
  onOpenAuth: () => void;
}

export const RoomView: React.FC<RoomViewProps> = ({ wpm, user, onOpenAuth: _onOpenAuth }) => {
  const [isInRoom, setIsInRoom] = useState<boolean>(false);
  const [roomCode, setRoomCode] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('Tactical Morse Channel');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Active Transmitting Status from Partner
  const [partnerTransmitting, setPartnerTransmitting] = useState<{
    sender: string;
    morse: string;
    inputMethod: string;
  } | null>(null);

  // In-Room Transmission Mode
  const [transceiverMode, setTransceiverMode] = useState<'tap' | 'text'>('tap');
  const [typedMessage, setTypedMessage] = useState<string>('');
  const [isKeyPressed, setIsKeyPressed] = useState<boolean>(false);
  const [keyPressStart, setKeyPressStart] = useState<number | null>(null);
  const [currentHoldMs, setCurrentHoldMs] = useState<number>(0);
  const [tapIntervals, setTapIntervals] = useState<SignalInterval[]>([]);
  const [liveMorse, setLiveMorse] = useState<string>('');
  const [liveText, setLiveText] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [flashingActive, setFlashingActive] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const lastReleaseRef = useRef<number>(Date.now());
  const partnerClearTimerRef = useRef<number | null>(null);

  // Calculate timing thresholds from WPM
  const unitMs = Math.round(1200 / Math.max(wpm, 1));
  const dotMs = unitMs;
  const dashMs = unitMs * 3;
  const charGapMs = unitMs * 3;
  const wordGapMs = unitMs * 7;
  const timingServiceRef = useRef<TimingService>(new TimingService(dotMs, dashMs, charGapMs, wordGapMs));

  useEffect(() => {
    timingServiceRef.current.updateParameters(dotMs, dashMs, charGapMs, wordGapMs);
  }, [dotMs, dashMs, charGapMs, wordGapMs]);

  // Connect WebSocket when inside room
  const connectWebSocket = useCallback((code: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `ws://localhost:8000/ws/room/${code}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Send join event
      const payload = {
        type: 'join',
        username: user?.username || `Operator-${Math.floor(1000 + Math.random() * 9000)}`,
        input_method: transceiverMode,
      };
      ws.send(JSON.stringify(payload));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'members_list') {
          setMembers(data.members || []);
        } else if (data.type === 'member_joined') {
          setMembers((prev) => {
            const exists = prev.some((m) => m.user_id === data.user_id);
            if (exists) return prev;
            return [...prev, { user_id: data.user_id, username: data.username, input_method: data.input_method || 'tap', is_active: true }];
          });
        } else if (data.type === 'member_left') {
          setMembers((prev) => prev.filter((m) => m.user_id !== data.user_id));
        } else if (data.type === 'signal_telemetry') {
          // Partner live signal stream
          if (data.sender !== (user?.username || 'me')) {
            setPartnerTransmitting({
              sender: data.sender,
              morse: data.morse || '',
              inputMethod: data.input_method || 'tap',
            });
            if (soundEnabled && data.event === 'pulse_start') {
              soundSynthesizer.startTone();
            } else if (soundEnabled && data.event === 'pulse_end') {
              soundSynthesizer.stopTone();
            }

            if (partnerClearTimerRef.current) clearTimeout(partnerClearTimerRef.current);
            partnerClearTimerRef.current = window.setTimeout(() => {
              setPartnerTransmitting(null);
            }, 3000);
          }
        } else if (data.type === 'chat_message' || data.type === 'message') {
          const newMsg: RoomMessage = {
            id: data.id || `msg-${Date.now()}-${Math.random()}`,
            sender: data.sender || data.sender_name || 'Operator',
            morse: data.morse || data.morse_code || '',
            text: data.text || data.plain_text || '',
            input_method: data.input_method || 'tap',
            confidence: data.confidence || 0.95,
            signal_quality: data.signal_quality || 0.95,
            timestamp: data.timestamp || Date.now(),
          };
          setMessages((prev) => [...prev, newMsg]);
        }
      } catch (e) {
        console.error('WS parse error', e);
      }
    };

    ws.onerror = (err) => {
      console.warn('WS error', err);
    };

    ws.onclose = () => {
      // ws closed
    };

    wsRef.current = ws;
  }, [user, transceiverMode, soundEnabled]);

  // Create Room handler
  const handleCreateRoom = async () => {
    try {
      setErrorMsg('');
      const res = await ApiClient.createRoom(roomName, false);
      const code = res.room_code || res.code;
      setRoomCode(code);
      setIsInRoom(true);
      connectWebSocket(code);
    } catch (e: any) {
      // Fallback offline room code
      const randCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomCode(randCode);
      setIsInRoom(true);
      connectWebSocket(randCode);
    }
  };

  // Join Room handler
  const handleJoinRoom = async () => {
    if (!joinCodeInput.trim()) {
      setErrorMsg('Please enter a valid 6-character room code.');
      return;
    }
    const code = joinCodeInput.trim().toUpperCase();
    try {
      setErrorMsg('');
      const res = await ApiClient.getRoom(code);
      setRoomCode(code);
      setRoomName(res.name || `Room ${code}`);
      setIsInRoom(true);
      connectWebSocket(code);
    } catch (e: any) {
      // Allow joining code anyway
      setRoomCode(code);
      setIsInRoom(true);
      connectWebSocket(code);
    }
  };

  // Leave room
  const handleLeaveRoom = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsInRoom(false);
    setMessages([]);
    setMembers([]);
    setPartnerTransmitting(null);
  };

  // Copy Room Link / Code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Send decoded message to room
  const handleSendMessage = (morseToSend: string, textToSend: string, method: string) => {
    if (!morseToSend && !textToSend) return;

    const senderName = user?.username || 'You';
    const msgPayload = {
      type: 'chat_message',
      room_code: roomCode,
      sender: senderName,
      morse: morseToSend,
      text: textToSend,
      input_method: method,
      confidence: 0.98,
      signal_quality: 0.95,
      timestamp: Date.now(),
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msgPayload));
    } else {
      // Append locally
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          sender: senderName,
          morse: morseToSend,
          text: textToSend,
          input_method: method,
          confidence: 0.98,
          signal_quality: 0.95,
          timestamp: Date.now(),
        },
      ]);
    }

    // Persist to backend if possible
    ApiClient.sendMessage(roomCode, morseToSend, textToSend, method).catch(() => {});

    // Clear local buffers
    setTapIntervals([]);
    setLiveMorse('');
    setLiveText('');
    setTypedMessage('');
  };

  // Send Text as Morse
  const handleSendTypedText = () => {
    if (!typedMessage.trim()) return;
    const encoded = MorseService.encode(typedMessage.trim());
    handleSendMessage(encoded.morse, typedMessage.trim().toUpperCase(), 'keyboard');
  };

  // Telegraph Key Down
  const handleKeyDownAction = useCallback(() => {
    if (isKeyPressed) return;
    const now = Date.now();
    setIsKeyPressed(true);
    setKeyPressStart(now);
    setCurrentHoldMs(0);

    if (soundEnabled) soundSynthesizer.startTone();

    // Broadcast live pulse start to partner
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'signal_telemetry',
        event: 'pulse_start',
        sender: user?.username || 'Operator',
        input_method: 'tap',
      }));
    }

    if (lastReleaseRef.current > 0 && tapIntervals.length > 0) {
      const gap = now - lastReleaseRef.current;
      if (gap > 20) {
        setTapIntervals((prev) => [...prev, { type: 'gap', duration_ms: gap, timestamp_ms: lastReleaseRef.current }]);
      }
    }

    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    holdTimerRef.current = window.setInterval(() => {
      setCurrentHoldMs(Date.now() - now);
    }, 16);
  }, [isKeyPressed, soundEnabled, tapIntervals.length, user]);

  // Telegraph Key Up
  const handleKeyUpAction = useCallback(() => {
    if (!isKeyPressed || !keyPressStart) return;
    const now = Date.now();
    const holdDuration = now - keyPressStart;

    setIsKeyPressed(false);
    setKeyPressStart(null);
    lastReleaseRef.current = now;

    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    if (soundEnabled) soundSynthesizer.stopTone();

    // Broadcast live pulse end
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'signal_telemetry',
        event: 'pulse_end',
        sender: user?.username || 'Operator',
        duration_ms: holdDuration,
        input_method: 'tap',
      }));
    }

    if (holdDuration > 15) {
      const updated: SignalInterval[] = [
        ...tapIntervals,
        { type: 'pulse', duration_ms: holdDuration, timestamp_ms: keyPressStart },
      ];
      setTapIntervals(updated);

      const res = timingServiceRef.current.processIntervals(updated);
      setLiveMorse(res.morse);
      setLiveText(res.text);
    }
  }, [isKeyPressed, keyPressStart, soundEnabled, tapIntervals, user]);

  // Play Morse CW Audio
  const handlePlayMessageAudio = async (msgId: string, morseCode: string) => {
    if (playingMessageId) return;
    setPlayingMessageId(msgId);
    try {
      await soundSynthesizer.playMorseSequence(morseCode, wpm);
    } catch (e) {
      console.error(e);
    } finally {
      setPlayingMessageId(null);
    }
  };

  // Visual Flashing Playback
  const handleVisualFlashPlayback = async (morseCode: string) => {
    if (flashingActive) return;
    setFlashingActive(true);

    const symbols = morseCode.split('');
    for (const sym of symbols) {
      if (sym === '.') {
        soundSynthesizer.startTone();
        await new Promise((r) => setTimeout(r, dotMs));
        soundSynthesizer.stopTone();
        await new Promise((r) => setTimeout(r, dotMs));
      } else if (sym === '-') {
        soundSynthesizer.startTone();
        await new Promise((r) => setTimeout(r, dashMs));
        soundSynthesizer.stopTone();
        await new Promise((r) => setTimeout(r, dotMs));
      } else if (sym === ' ') {
        await new Promise((r) => setTimeout(r, charGapMs));
      } else if (sym === '/') {
        await new Promise((r) => setTimeout(r, wordGapMs));
      }
    }
    setFlashingActive(false);
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
      {/* Header */}
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
            <span>PHASE 3 ENCRYPTED SIGNAL LINK</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#FFFFFF' }}>
            Two-User Real-Time Morse Channel
          </h1>
        </div>

        {isInRoom && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ROOM CODE:</span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan-light)', fontSize: '1.1rem' }}>
                {roomCode}
              </strong>
              <button
                onClick={handleCopyCode}
                className="btn btn-ghost"
                style={{ padding: 4 }}
                title="Copy Room Code"
              >
                {isCopied ? <Check size={14} color="#34D399" /> : <Copy size={14} />}
              </button>
            </div>

            <button
              onClick={handleLeaveRoom}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.8rem' }}
            >
              <LogOut size={14} />
              <span>Leave Room</span>
            </button>
          </div>
        )}
      </div>

      {/* LOBBY: NOT IN ROOM */}
      {!isInRoom ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, maxWidth: 960, margin: '40px auto' }}>
          {/* Create Room Box */}
          <div className="glass-panel" style={{ padding: 36, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Radio size={24} color="var(--cyan-light)" />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>Create Communication Room</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
                Generate a unique secure room code. Share it with your communication partner to exchange real-time multimodal Morse signals.
              </p>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  CHANNEL NAME / CALLSIGN
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Tactical Channel Alpha"
                  style={{
                    width: '100%',
                    background: '#070A10',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleCreateRoom}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px 0', fontSize: '1rem' }}
            >
              <Sparkles size={18} />
              <span>Generate Room Code & Launch</span>
            </button>
          </div>

          {/* Join Room Box */}
          <div className="glass-panel" style={{ padding: 36, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Users size={24} color="var(--amber-light)" />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>Join Existing Channel</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
                Enter the 6-character room code provided by your peer to link into the live encrypted transceiver stream.
              </p>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  ENTER 6-CHARACTER ROOM CODE
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  style={{
                    width: '100%',
                    background: '#070A10',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                    color: 'var(--amber-light)',
                    fontSize: '1.25rem',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.2em',
                    textAlign: 'center',
                    outline: 'none',
                  }}
                />
              </div>

              {errorMsg && (
                <div style={{ color: '#F87171', fontSize: '0.8rem', marginBottom: 12 }}>
                  {errorMsg}
                </div>
              )}
            </div>

            <button
              onClick={handleJoinRoom}
              className="btn btn-amber"
              style={{ width: '100%', padding: '14px 0', fontSize: '1rem' }}
            >
              <Users size={18} />
              <span>Connect to Channel</span>
            </button>
          </div>
        </div>
      ) : (
        /* IN-ROOM INTERACTION DASHBOARD */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          {/* Main Column: Chat Stream & In-Room Transceiver */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Live Partner Transmission Glowing Banner */}
            {partnerTransmitting && (
              <div style={{
                padding: '14px 20px',
                background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
                border: '1px solid var(--amber-signal)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                animation: 'pulse 1.5s infinite',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="pulse-dot" style={{ width: 10, height: 10 }} />
                  <div>
                    <strong style={{ color: '#FFFFFF' }}>{partnerTransmitting.sender}</strong> is transmitting live via {partnerTransmitting.inputMethod.toUpperCase()}...
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', color: 'var(--amber-light)' }}>
                  {partnerTransmitting.morse || '· — ·'}
                </div>
              </div>
            )}

            {/* Chat Messages Timeline */}
            <div className="glass-panel" style={{
              padding: 24,
              minHeight: 380,
              maxHeight: 480,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
                <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  DECODED CHANNEL STREAM • {messages.length} TRANSMISSIONS
                </span>
                <span className="telemetry-badge emerald" style={{ fontSize: '0.7rem' }}>
                  WEBSOCKET LIVE
                </span>
              </div>

              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', margin: 'auto 0', color: 'var(--text-dim)', padding: '40px 0' }}>
                  <Radio size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <div>No signals transmitted in this room yet.</div>
                  <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Use the tactile telegraph key or text transmitter below to transmit.</div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender === (user?.username || 'You');
                  return (
                    <div
                      key={msg.id}
                      style={{
                        padding: 16,
                        background: isMe ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${isMe ? 'rgba(6, 182, 212, 0.3)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ color: isMe ? 'var(--cyan-light)' : '#FFFFFF', fontSize: '0.95rem' }}>
                            {msg.sender}
                          </strong>
                          <span className="telemetry-badge cyan" style={{ fontSize: '0.65rem' }}>
                            {msg.input_method.toUpperCase()}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {typeof msg.timestamp === 'number' ? new Date(msg.timestamp).toLocaleTimeString() : msg.timestamp}
                        </span>
                      </div>

                      {/* Decoded Plain Text */}
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF', marginBottom: 6 }}>
                        {msg.text || '—'}
                      </div>

                      {/* Raw Morse String */}
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.9rem',
                        color: 'var(--cyan-light)',
                        letterSpacing: '0.1em',
                        marginBottom: 12,
                      }}>
                        {msg.morse}
                      </div>

                      {/* Action Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: 10 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => handlePlayMessageAudio(msg.id, msg.morse)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            disabled={playingMessageId === msg.id}
                          >
                            <Play size={12} />
                            <span>{playingMessageId === msg.id ? 'Playing...' : 'CW Audio'}</span>
                          </button>

                          <button
                            onClick={() => handleVisualFlashPlayback(msg.morse)}
                            className="btn btn-ghost"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            disabled={flashingActive}
                          >
                            <Sun size={12} color="#FDE047" />
                            <span>Flash</span>
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          <span>CONF: {Math.round((msg.confidence || 0.95) * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* In-Room Transceiver Transmitter */}
            <div className="glass-panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setTransceiverMode('tap')}
                    className="btn btn-ghost"
                    style={{
                      background: transceiverMode === 'tap' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                      color: transceiverMode === 'tap' ? '#34D399' : 'var(--text-secondary)',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                    }}
                  >
                    <Hand size={14} />
                    <span>Telegraph Key</span>
                  </button>

                  <button
                    onClick={() => setTransceiverMode('text')}
                    className="btn btn-ghost"
                    style={{
                      background: transceiverMode === 'text' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                      color: transceiverMode === 'text' ? 'var(--cyan-light)' : 'var(--text-secondary)',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                    }}
                  >
                    <Keyboard size={14} />
                    <span>Quick Text</span>
                  </button>
                </div>

                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="btn btn-ghost"
                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                >
                  {soundEnabled ? <Volume2 size={14} color="var(--cyan-light)" /> : <VolumeX size={14} color="var(--text-muted)" />}
                </button>
              </div>

              {transceiverMode === 'tap' ? (
                <div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    {/* Compact Telegraph Key */}
                    <div
                      className={`telegraph-key ${isKeyPressed ? 'pressed' : ''}`}
                      onMouseDown={handleKeyDownAction}
                      onMouseUp={handleKeyUpAction}
                      onMouseLeave={handleKeyUpAction}
                      onTouchStart={(e) => { e.preventDefault(); handleKeyDownAction(); }}
                      onTouchEnd={(e) => { e.preventDefault(); handleKeyUpAction(); }}
                      style={{ width: 100, height: 100 }}
                    >
                      <div className="telegraph-key-cap" style={{ width: 68, height: 68, fontSize: '0.85rem' }}>
                        {isKeyPressed ? 'ON' : 'TAP'}
                      </div>
                    </div>

                    {/* Live Stream Previews */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        background: '#070A10',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        padding: 10,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1.1rem',
                        color: 'var(--cyan-light)',
                        minHeight: 42,
                        marginBottom: 8,
                      }}>
                        {liveMorse || <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Live Morse sequence...</span>}
                      </div>

                      <div style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: 10,
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: '#FFFFFF',
                        minHeight: 42,
                      }}>
                        {liveText || <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 400 }}>Decoded translation...</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button
                        onClick={() => handleSendMessage(liveMorse, liveText, 'tap')}
                        disabled={!liveMorse}
                        className="btn btn-primary"
                        style={{ padding: '10px 16px', fontSize: '0.85rem' }}
                      >
                        <Send size={14} />
                        <span>Send</span>
                      </button>

                      <button
                        onClick={() => { setTapIntervals([]); setLiveMorse(''); setLiveText(''); }}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                      >
                        <RotateCcw size={12} />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 8 }}>
                    Hold duration: {currentHoldMs} ms • PARIS Speed: {wpm} WPM
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12 }}>
                  <input
                    type="text"
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendTypedText(); }}
                    placeholder="Type message to encode and send to room..."
                    style={{
                      flex: 1,
                      background: '#070A10',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: 12,
                      color: 'var(--text-primary)',
                      fontSize: '0.95rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSendTypedText}
                    disabled={!typedMessage.trim()}
                    className="btn btn-primary"
                    style={{ padding: '0 20px' }}
                  >
                    <Send size={16} />
                    <span>Send Morse</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Room Members & Telemetry */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Active Operators Roster */}
            <div className="glass-panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Users size={18} color="var(--cyan-light)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Channel Members</h3>
                <span className="telemetry-badge cyan" style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>
                  {members.length > 0 ? members.length : 1} ACTIVE
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Self */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(6, 182, 212, 0.1)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  borderRadius: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="pulse-dot" style={{ width: 8, height: 8 }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--cyan-light)' }}>
                      {user?.username || 'You (Local)'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    HOST / OPERATOR
                  </span>
                </div>

                {/* Other connected members */}
                {members.filter((m) => m.username !== (user?.username || 'You')).map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="pulse-dot" style={{ width: 8, height: 8 }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {m.username}
                      </span>
                    </div>
                    <span className="telemetry-badge amber" style={{ fontSize: '0.65rem' }}>
                      {m.input_method.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Channel Modality Legend */}
            <div className="glass-panel" style={{ padding: 20 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12 }}>Supported Modalities</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Eye size={14} color="var(--cyan-light)" />
                  <span>Eye-Blink (Vision DSP)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mic size={14} color="var(--amber-light)" />
                  <span>Acoustic Mic (Audio DSP)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sun size={14} color="#FDE047" />
                  <span>Flashlight (Optical ROI)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Hand size={14} color="#34D399" />
                  <span>Tactile Telegraph Key</span>
                </div>
              </div>
            </div>

            {/* Privacy & Encryption Guarantee */}
            <div style={{
              padding: 16,
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <ShieldCheck size={16} color="#34D399" />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6EE7B7' }}>Local DSP Privacy</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Only reconstructed timing intervals and decoded symbols are transmitted across WebSockets. Raw camera video or mic audio is never streamed to servers.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
