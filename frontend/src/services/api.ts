/**
 * Unified API Client for Morse Signal Lab.
 */

const API_BASE_URL = 'http://localhost:8000/api';

export interface EncodeResponse {
  plain_text: string;
  morse: string;
  tokens: Array<{ char: string; morse: string; type: string }>;
  timing_metadata: {
    wpm: number;
    unit_duration_ms: number;
    dot_duration_ms: number;
    dash_duration_ms: number;
    char_gap_ms: number;
    word_gap_ms: number;
  };
}

export interface DecodeResponse {
  morse: string;
  plain_text: string;
  confidence: number;
  unrecognized_symbols: string[];
  candidates: Array<{ text: string; confidence: number }>;
}

export class ApiClient {
  private static token: string | null = localStorage.getItem('morse_token');

  public static setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('morse_token', token);
    } else {
      localStorage.removeItem('morse_token');
    }
  }

  public static getToken(): string | null {
    return this.token;
  }

  public static async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(err.detail || 'Request failed');
    }

    return response.json();
  }

  public static async encodeText(text: string, wpm: number = 15): Promise<EncodeResponse> {
    return this.request<EncodeResponse>('/morse/encode', {
      method: 'POST',
      body: JSON.stringify({ text, wpm }),
    });
  }

  public static async decodeMorse(morse: string): Promise<DecodeResponse> {
    return this.request<DecodeResponse>('/morse/decode', {
      method: 'POST',
      body: JSON.stringify({ morse }),
    });
  }

  public static async reconstructTiming(intervals: any[], wpm: number = 15) {
    return this.request('/morse/reconstruct-timing', {
      method: 'POST',
      body: JSON.stringify({ intervals, wpm }),
    });
  }

  public static async analyzeAmbiguity(morseSymbol: string) {
    return this.request('/morse/analyze-ambiguity', {
      method: 'POST',
      body: JSON.stringify({ morse_symbol: morseSymbol }),
    });
  }

  public static async saveCalibration(data: {
    mode: string;
    dot_duration_ms: number;
    dash_duration_ms: number;
    char_gap_ms: number;
    word_gap_ms: number;
    threshold_value: number;
  }) {
    return this.request('/calibration/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async createRoom(name: string, isPrivate: boolean = true) {
    return this.request('/rooms/', {
      method: 'POST',
      body: JSON.stringify({ name, is_private: isPrivate }),
    });
  }

  public static async getRoom(roomCode: string) {
    return this.request(`/rooms/${roomCode}`);
  }

  public static async getRoomMessages(roomCode: string) {
    return this.request(`/messages/room/${roomCode}`);
  }

  public static async sendMessage(roomCode: string, morseCode: string, plainText: string, inputMethod: string) {
    return this.request('/messages/', {
      method: 'POST',
      body: JSON.stringify({
        room_code: roomCode,
        morse_code: morseCode,
        plain_text: plainText,
        input_method: inputMethod,
      }),
    });
  }

  public static async uploadAudioForAnalysis(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(`${API_BASE_URL}/analysis/audio`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error('Audio analysis failed');
    return res.json();
  }

  public static async uploadVideoForAnalysis(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(`${API_BASE_URL}/analysis/video`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error('Video analysis failed');
    return res.json();
  }

  public static async saveTrainingSession(data: any) {
    return this.request('/training/session', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async submitChallenge(data: any) {
    return this.request('/training/challenges/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async getLeaderboard(challengeId: string) {
    return this.request(`/training/challenges/leaderboard/${challengeId}`);
  }

  public static async login(credentials: URLSearchParams) {
    const res = await fetch(`${API_BASE_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: credentials.toString(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Authentication failed' }));
      throw new Error(err.detail || 'Login failed');
    }
    return res.json();
  }

  public static async register(data: any) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async getMe() {
    return this.request('/auth/me');
  }
}
