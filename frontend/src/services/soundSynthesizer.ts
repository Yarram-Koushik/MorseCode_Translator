/**
 * Web Audio API Sound Synthesizer for CW (Continuous Wave) Morse code audio.
 */

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlayingActiveTone: boolean = false;
  private frequency: number = 650; // Hz

  constructor() {
    // Lazy initialize AudioContext on user interaction
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setFrequency(freq: number) {
    this.frequency = Math.max(300, Math.min(1200, freq));
    if (this.oscillator) {
      this.oscillator.frequency.setValueAtTime(this.frequency, this.ctx!.currentTime);
    }
  }

  /**
   * Starts a continuous tone immediately (e.g. while telegraph key or eye blink is held).
   */
  public startTone() {
    this.initContext();
    if (this.isPlayingActiveTone || !this.ctx) return;

    this.oscillator = this.ctx.createOscillator();
    this.gainNode = this.ctx.createGain();

    this.oscillator.type = 'sine';
    this.oscillator.frequency.setValueAtTime(this.frequency, this.ctx.currentTime);

    // Smooth envelope attack (5ms) to prevent audio click
    this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 0.006);

    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);

    this.oscillator.start();
    this.isPlayingActiveTone = true;
  }

  /**
   * Stops the active continuous tone with a smooth release decay.
   */
  public stopTone() {
    if (!this.isPlayingActiveTone || !this.ctx || !this.gainNode || !this.oscillator) return;

    const stopTime = this.ctx.currentTime + 0.008;
    this.gainNode.gain.linearRampToValueAtTime(0, stopTime);
    this.oscillator.stop(stopTime + 0.01);

    this.isPlayingActiveTone = false;
    this.oscillator = null;
    this.gainNode = null;
  }

  /**
   * Plays a sequence of Morse code (e.g. "... --- ...") with proper timing intervals.
   */
  public async playMorseSequence(
    morse: string,
    wpm: number = 15,
    onProgress?: (index: number, symbol: string) => void
  ): Promise<void> {
    this.initContext();
    if (!this.ctx) return;

    const unitMs = 1200 / Math.max(wpm, 1);
    const dotMs = unitMs;
    const dashMs = unitMs * 3;
    const intraGapMs = unitMs;
    const charGapMs = unitMs * 3;
    const wordGapMs = unitMs * 7;

    const words = morse.trim().split(/\s*[\/\|]\s*|\s{2,}/);
    let symIndex = 0;

    for (let w = 0; w < words.length; w++) {
      const chars = words[w].trim().split(' ');
      for (let c = 0; c < chars.length; c++) {
        const symbol = chars[c].trim();
        for (let s = 0; s < symbol.length; s++) {
          const char = symbol[s];
          if (onProgress) onProgress(symIndex++, char);

          if (char === '.') {
            this.startTone();
            await new Promise((r) => setTimeout(r, dotMs));
            this.stopTone();
          } else if (char === '-') {
            this.startTone();
            await new Promise((r) => setTimeout(r, dashMs));
            this.stopTone();
          }
          // Intra-element gap
          await new Promise((r) => setTimeout(r, intraGapMs));
        }
        // Character gap
        await new Promise((r) => setTimeout(r, charGapMs - intraGapMs));
      }
      // Word gap
      if (w < words.length - 1) {
        await new Promise((r) => setTimeout(r, wordGapMs - charGapMs));
      }
    }
  }
}

export const soundSynthesizer = new SoundSynthesizer();
