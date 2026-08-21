/**
 * Client-Side Real-Time Timing Reconstruction Engine.
 */

import { MorseService } from './morseService';

export interface SignalInterval {
  type: 'pulse' | 'gap';
  duration_ms: number;
  timestamp_ms: number;
  raw_reading?: number;
}

export interface ReconstructedEvent {
  event_type: 'dot' | 'dash' | 'element_gap' | 'char_gap' | 'word_gap';
  duration_ms: number;
  timestamp_ms: number;
  classification: string;
  confidence: number;
  raw_reading?: number;
}

export class TimingService {
  private dotMs: number;
  private dashMs: number;
  private charGapMs: number;
  private wordGapMs: number;
  private pulseSplit: number;
  private gapSplit: number;
  private wordSplit: number;

  constructor(
    dotMs: number = 100,
    dashMs: number = 300,
    charGapMs: number = 300,
    wordGapMs: number = 700
  ) {
    this.dotMs = Math.max(dotMs, 20);
    this.dashMs = Math.max(dashMs, this.dotMs * 1.5);
    this.charGapMs = Math.max(charGapMs, this.dotMs * 1.5);
    this.wordGapMs = Math.max(wordGapMs, this.charGapMs * 1.8);

    this.pulseSplit = (this.dotMs + this.dashMs) / 2;
    this.gapSplit = (this.dotMs + this.charGapMs) / 2;
    this.wordSplit = (this.charGapMs + this.wordGapMs) / 2;
  }

  public updateParameters(dotMs: number, dashMs: number, charGapMs: number, wordGapMs: number) {
    this.dotMs = Math.max(dotMs, 20);
    this.dashMs = Math.max(dashMs, this.dotMs * 1.5);
    this.charGapMs = Math.max(charGapMs, this.dotMs * 1.5);
    this.wordGapMs = Math.max(wordGapMs, this.charGapMs * 1.8);
    this.pulseSplit = (this.dotMs + this.dashMs) / 2;
    this.gapSplit = (this.dotMs + this.charGapMs) / 2;
    this.wordSplit = (this.charGapMs + this.wordGapMs) / 2;
  }

  public classifyPulse(durationMs: number): { symbol: '.' | '-'; confidence: number } {
    if (durationMs <= 0) return { symbol: '.', confidence: 0.1 };

    if (durationMs < this.pulseSplit) {
      const margin = Math.abs(durationMs - this.pulseSplit) / (this.pulseSplit - this.dotMs + 1e-5);
      const conf = Math.max(0.5, Math.min(1.0, 0.7 + 0.3 * Math.min(1.0, margin)));
      return { symbol: '.', confidence: Number(conf.toFixed(2)) };
    } else {
      const margin = Math.abs(durationMs - this.pulseSplit) / (this.dashMs - this.pulseSplit + 1e-5);
      const conf = Math.max(0.5, Math.min(1.0, 0.7 + 0.3 * Math.min(1.0, margin)));
      return { symbol: '-', confidence: Number(conf.toFixed(2)) };
    }
  }

  public classifyGap(durationMs: number): { type: 'intra' | 'char' | 'word'; confidence: number } {
    if (durationMs < this.gapSplit) {
      return { type: 'intra', confidence: 0.95 };
    } else if (durationMs < this.wordSplit) {
      const margin = Math.abs(durationMs - this.gapSplit) / (this.wordSplit - this.gapSplit + 1e-5);
      const conf = Math.max(0.5, Math.min(1.0, 0.75 + 0.25 * Math.min(1.0, margin)));
      return { type: 'char', confidence: Number(conf.toFixed(2)) };
    } else {
      return { type: 'word', confidence: 0.98 };
    }
  }

  public processIntervals(intervals: SignalInterval[]): {
    morse: string;
    text: string;
    confidence: number;
    signalQuality: number;
    events: ReconstructedEvent[];
  } {
    if (!intervals || intervals.length === 0) {
      return { morse: '', text: '', confidence: 1.0, signalQuality: 1.0, events: [] };
    }

    const events: ReconstructedEvent[] = [];
    const tokens: string[] = [];
    let currentSymbols: string[] = [];
    const confs: number[] = [];
    const pulseDurs: number[] = [];

    for (const item of intervals) {
      const dur = item.duration_ms;
      if (dur < 15) continue; // Filter noise blips

      if (item.type === 'pulse') {
        pulseDurs.push(dur);
        const { symbol, confidence } = this.classifyPulse(dur);
        currentSymbols.push(symbol);
        confs.push(confidence);

        events.push({
          event_type: symbol === '.' ? 'dot' : 'dash',
          duration_ms: dur,
          timestamp_ms: item.timestamp_ms,
          classification: symbol,
          confidence,
          raw_reading: item.raw_reading,
        });
      } else if (item.type === 'gap') {
        const { type, confidence } = this.classifyGap(dur);
        confs.push(confidence);

        if (type === 'char') {
          if (currentSymbols.length > 0) {
            tokens.push(currentSymbols.join(''));
            currentSymbols = [];
          }
          events.push({
            event_type: 'char_gap',
            duration_ms: dur,
            timestamp_ms: item.timestamp_ms,
            classification: ' ',
            confidence,
          });
        } else if (type === 'word') {
          if (currentSymbols.length > 0) {
            tokens.push(currentSymbols.join(''));
            currentSymbols = [];
          }
          if (tokens.length > 0 && tokens[tokens.length - 1] !== '/') {
            tokens.push('/');
          }
          events.push({
            event_type: 'word_gap',
            duration_ms: dur,
            timestamp_ms: item.timestamp_ms,
            classification: ' / ',
            confidence,
          });
        } else {
          events.push({
            event_type: 'element_gap',
            duration_ms: dur,
            timestamp_ms: item.timestamp_ms,
            classification: '',
            confidence,
          });
        }
      }
    }

    if (currentSymbols.length > 0) {
      tokens.push(currentSymbols.join(''));
    }

    // Assemble Morse string
    const morseParts: string[] = [];
    for (const t of tokens) {
      if (t === '/') {
        morseParts.push(' / ');
      } else {
        if (morseParts.length > 0 && !morseParts[morseParts.length - 1].endsWith(' ') && morseParts[morseParts.length - 1] !== ' / ') {
          morseParts.push(' ');
        }
        morseParts.push(t);
      }
    }

    const morseString = morseParts.join('').trim();
    const decodeResult = MorseService.decode(morseString);

    const avgConf = confs.length > 0 ? confs.reduce((a, b) => a + b, 0) / confs.length : 1.0;
    const combinedConf = Number((0.5 * avgConf + 0.5 * decodeResult.confidence).toFixed(2));

    let signalQuality = 1.0;
    if (pulseDurs.length > 2) {
      const avg = pulseDurs.reduce((a, b) => a + b, 0) / pulseDurs.length;
      const std = Math.sqrt(pulseDurs.reduce((acc, p) => acc + Math.pow(p - avg, 2), 0) / pulseDurs.length);
      const penalty = Math.min(0.4, std / (this.dashMs + 1e-5));
      signalQuality = Number(Math.max(0.4, 1.0 - penalty).toFixed(2));
    }

    return {
      morse: morseString,
      text: decodeResult.text,
      confidence: combinedConf,
      signalQuality,
      events,
    };
  }
}
