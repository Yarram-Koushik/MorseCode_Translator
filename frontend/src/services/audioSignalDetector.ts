/**
 * Real-Time Microphone Audio Signal Processing Pipeline.
 * Captures microphone stream, estimates noise floor, tracks tone energy, and extracts pulse/gap intervals.
 */

export interface AudioSignalState {
  currentLevel: number;
  noiseFloor: number;
  peakLevel: number;
  threshold: number;
  isActive: boolean;
  snr: number;
  frequencyData: Uint8Array;
}

export class AudioSignalDetector {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private biquadFilter: BiquadFilterNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isListening: boolean = false;

  // Signal detection parameters
  private noiseFloor: number = 0.02;
  private peakLevel: number = 0.10;
  private threshold: number = 0.08;
  private isSignalActive: boolean = false;
  private signalStartTime: number = 0;

  // Frequency filter options (target CW tone around 600 - 800 Hz)
  private centerFreq: number = 700;

  public async start(
    _onSignalEvent?: (type: 'pulse_start' | 'pulse_end', durationMs: number, timestamp: number) => void
  ): Promise<boolean> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);

      // Optional bandpass filter around CW tone frequency
      this.biquadFilter = this.audioCtx.createBiquadFilter();
      this.biquadFilter.type = 'bandpass';
      this.biquadFilter.frequency.setValueAtTime(this.centerFreq, this.audioCtx.currentTime);
      this.biquadFilter.Q.setValueAtTime(3.0, this.audioCtx.currentTime);

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4;

      source.connect(this.biquadFilter);
      this.biquadFilter.connect(this.analyser);

      this.isListening = true;
      return true;
    } catch (e) {
      console.error('Failed to access microphone stream', e);
      return false;
    }
  }

  public setFilterFrequency(freq: number) {
    this.centerFreq = Math.max(300, Math.min(2500, freq));
    if (this.biquadFilter && this.audioCtx) {
      this.biquadFilter.frequency.setValueAtTime(this.centerFreq, this.audioCtx.currentTime);
    }
  }

  public setThreshold(threshold: number) {
    this.threshold = Math.max(0.01, Math.min(0.9, threshold));
  }

  public processAudio(
    onSignalEvent?: (type: 'pulse_start' | 'pulse_end', durationMs: number, timestamp: number) => void
  ): AudioSignalState | null {
    if (!this.analyser || !this.isListening) return null;

    const bufferLength = this.analyser.frequencyBinCount;
    const timeDomainData = new Float32Array(bufferLength);
    const frequencyData = new Uint8Array(bufferLength);

    this.analyser.getFloatTimeDomainData(timeDomainData);
    this.analyser.getByteFrequencyData(frequencyData);

    // Compute RMS Energy
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += timeDomainData[i] * timeDomainData[i];
    }
    const rms = Math.sqrt(sum / bufferLength);

    // Adapt dynamic noise floor (slow drift down)
    if (rms < this.noiseFloor) {
      this.noiseFloor = 0.95 * this.noiseFloor + 0.05 * rms;
    } else {
      this.noiseFloor = 0.999 * this.noiseFloor + 0.001 * rms;
    }

    // Adapt peak tracking
    if (rms > this.peakLevel) {
      this.peakLevel = 0.9 * this.peakLevel + 0.1 * rms;
    } else {
      this.peakLevel = 0.995 * this.peakLevel + 0.005 * rms;
    }

    // Dynamic threshold: 40% between noise floor and peak level
    const dynamicThresh = Math.max(this.threshold, this.noiseFloor + 0.35 * (this.peakLevel - this.noiseFloor));
    const isNowActive = rms > dynamicThresh;
    const now = performance.now();

    if (isNowActive && !this.isSignalActive) {
      this.isSignalActive = true;
      this.signalStartTime = now;
      if (onSignalEvent) onSignalEvent('pulse_start', 0, now);
    } else if (!isNowActive && this.isSignalActive) {
      this.isSignalActive = false;
      const dur = now - this.signalStartTime;
      if (onSignalEvent) onSignalEvent('pulse_end', dur, this.signalStartTime);
    }

    const snr = this.noiseFloor > 0 ? this.peakLevel / (this.noiseFloor + 1e-4) : 1.0;

    return {
      currentLevel: Number(rms.toFixed(4)),
      noiseFloor: Number(this.noiseFloor.toFixed(4)),
      peakLevel: Number(this.peakLevel.toFixed(4)),
      threshold: Number(dynamicThresh.toFixed(4)),
      isActive: this.isSignalActive,
      snr: Number(snr.toFixed(1)),
      frequencyData,
    };
  }

  public stop() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.analyser = null;
    this.biquadFilter = null;
    this.isListening = false;
    this.isSignalActive = false;
  }
}

export const audioSignalDetector = new AudioSignalDetector();
