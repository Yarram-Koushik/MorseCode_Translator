/**
 * Real-Time Light / Flash Morse Detector.
 * Analyzes video frame canvas region-of-interest (ROI) luminance transitions to detect flashing light pulses.
 */

export interface LightDetectionState {
  currentLuminance: number;
  baselineLuminance: number;
  peakLuminance: number;
  threshold: number;
  isActive: boolean;
  contrastRatio: number;
}

export class LightFlashDetector {
  private baselineLuminance: number = 0.2;
  private peakLuminance: number = 0.7;
  private thresholdRatio: number = 0.4;
  private isSignalActive: boolean = false;
  private pulseStartTime: number = 0;

  // Custom ROI bounding box (percentages: 0 to 1)
  private roi = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };

  public setROI(x: number, y: number, width: number, height: number) {
    this.roi = {
      x: Math.max(0, Math.min(0.9, x)),
      y: Math.max(0, Math.min(0.9, y)),
      width: Math.max(0.1, Math.min(1 - x, width)),
      height: Math.max(0.1, Math.min(1 - y, height)),
    };
  }

  public getROI() {
    return this.roi;
  }

  public processCanvasFrame(
    canvas: HTMLCanvasElement,
    onLightEvent?: (type: 'light_on' | 'light_off', durationMs: number, timestamp: number) => void
  ): LightDetectionState | null {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const width = canvas.width;
    const height = canvas.height;
    if (width === 0 || height === 0) return null;

    const roiX = Math.floor(this.roi.x * width);
    const roiY = Math.floor(this.roi.y * height);
    const roiW = Math.floor(this.roi.width * width);
    const roiH = Math.floor(this.roi.height * height);

    try {
      const imageData = ctx.getImageData(roiX, roiY, roiW, roiH);
      const data = imageData.data;
      let totalLuminance = 0;
      const pixelCount = data.length / 4;

      // Sample pixels
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        totalLuminance += lum;
      }

      const meanLum = totalLuminance / pixelCount / 255.0;

      // Adapt baseline (slow drift)
      if (meanLum < this.baselineLuminance) {
        this.baselineLuminance = 0.9 * this.baselineLuminance + 0.1 * meanLum;
      } else {
        this.baselineLuminance = 0.99 * this.baselineLuminance + 0.01 * meanLum;
      }

      // Adapt peak
      if (meanLum > this.peakLuminance) {
        this.peakLuminance = 0.85 * this.peakLuminance + 0.15 * meanLum;
      } else {
        this.peakLuminance = 0.99 * this.peakLuminance + 0.01 * meanLum;
      }

      const dynamicThresh = this.baselineLuminance + this.thresholdRatio * (this.peakLuminance - this.baselineLuminance);
      const isNowOn = meanLum > dynamicThresh && (this.peakLuminance - this.baselineLuminance) > 0.06;
      const now = performance.now();

      if (isNowOn && !this.isSignalActive) {
        this.isSignalActive = true;
        this.pulseStartTime = now;
        if (onLightEvent) onLightEvent('light_on', 0, now);
      } else if (!isNowOn && this.isSignalActive) {
        this.isSignalActive = false;
        const dur = now - this.pulseStartTime;
        if (onLightEvent) onLightEvent('light_off', dur, this.pulseStartTime);
      }

      const contrast = this.baselineLuminance > 0 ? this.peakLuminance / (this.baselineLuminance + 1e-4) : 1.0;

      return {
        currentLuminance: Number(meanLum.toFixed(3)),
        baselineLuminance: Number(this.baselineLuminance.toFixed(3)),
        peakLuminance: Number(this.peakLuminance.toFixed(3)),
        threshold: Number(dynamicThresh.toFixed(3)),
        isActive: this.isSignalActive,
        contrastRatio: Number(contrast.toFixed(1)),
      };
    } catch (e) {
      return null;
    }
  }

  public reset() {
    this.baselineLuminance = 0.2;
    this.peakLuminance = 0.7;
    this.isSignalActive = false;
  }
}

export const lightFlashDetector = new LightFlashDetector();
