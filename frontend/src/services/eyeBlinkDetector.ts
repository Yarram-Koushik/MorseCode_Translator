/**
 * Real-Time Eye-Blink Morse Detector using MediaPipe FaceLandmarker and Eye Aspect Ratio (EAR).
 */

import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

export interface EyeDetectionFrame {
  leftEar: number;
  rightEar: number;
  avgEar: number;
  isBlinking: boolean;
  faceDetected: boolean;
  landmarks?: any[];
}

export class EyeBlinkDetector {
  private landmarker: FaceLandmarker | null = null;
  private isInitialized: boolean = false;
  private blinkThreshold: number = 0.22;
  private isCurrentlyBlinking: boolean = false;
  private blinkStartTime: number = 0;

  // Landmark indices for MediaPipe 468/478 mesh
  // Left eye: 33 (outer), 133 (inner), 160 (top 1), 158 (top 2), 144 (bottom 1), 153 (bottom 2)
  private readonly LEFT_EYE = { outer: 33, inner: 133, top1: 160, top2: 158, bottom1: 144, bottom2: 153 };
  // Right eye: 362 (outer), 263 (inner), 385 (top 1), 387 (top 2), 380 (bottom 1), 373 (bottom 2)
  private readonly RIGHT_EYE = { outer: 362, inner: 263, top1: 385, top2: 387, bottom1: 380, bottom2: 373 };

  public async initialize(): Promise<boolean> {
    if (this.isInitialized && this.landmarker) return true;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      this.isInitialized = true;
      return true;
    } catch (e) {
      console.warn('GPU FaceLandmarker init failed, falling back to CPU mode', e);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        this.landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        this.isInitialized = true;
        return true;
      } catch (err) {
        console.error('Fatal: FaceLandmarker initialization failed', err);
        return false;
      }
    }
  }

  public setThreshold(threshold: number) {
    this.blinkThreshold = Math.max(0.1, Math.min(0.4, threshold));
  }

  public getThreshold(): number {
    return this.blinkThreshold;
  }

  private distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }

  private computeEar(landmarks: any[], eye: typeof this.LEFT_EYE): number {
    const p1 = landmarks[eye.outer];
    const p4 = landmarks[eye.inner];
    const p2 = landmarks[eye.top1];
    const p6 = landmarks[eye.bottom1];
    const p3 = landmarks[eye.top2];
    const p5 = landmarks[eye.bottom2];

    if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0.3;

    const vertical1 = this.distance(p2, p6);
    const vertical2 = this.distance(p3, p5);
    const horizontal = this.distance(p1, p4);

    if (horizontal < 1e-5) return 0.3;
    return (vertical1 + vertical2) / (2.0 * horizontal);
  }

  /**
   * Process a single video frame.
   * Returns detection metrics and triggers callbacks on blink open/closed events.
   */
  public processVideoFrame(
    videoElement: HTMLVideoElement,
    timestampMs: number,
    onBlinkEvent?: (type: 'blink_start' | 'blink_end', durationMs: number, timestamp: number) => void
  ): EyeDetectionFrame {
    if (!this.landmarker || !this.isInitialized || videoElement.readyState < 2) {
      return { leftEar: 0.3, rightEar: 0.3, avgEar: 0.3, isBlinking: false, faceDetected: false };
    }

    try {
      const results = this.landmarker.detectForVideo(videoElement, timestampMs);
      if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
        return { leftEar: 0.3, rightEar: 0.3, avgEar: 0.3, isBlinking: false, faceDetected: false };
      }

      const landmarks = results.faceLandmarks[0];
      const leftEar = this.computeEar(landmarks, this.LEFT_EYE);
      const rightEar = this.computeEar(landmarks, this.RIGHT_EYE);
      const avgEar = (leftEar + rightEar) / 2.0;

      const isClosed = avgEar < this.blinkThreshold;
      const now = performance.now();

      if (isClosed && !this.isCurrentlyBlinking) {
        // Blink started
        this.isCurrentlyBlinking = true;
        this.blinkStartTime = now;
        if (onBlinkEvent) onBlinkEvent('blink_start', 0, now);
      } else if (!isClosed && this.isCurrentlyBlinking) {
        // Blink ended
        this.isCurrentlyBlinking = false;
        const dur = now - this.blinkStartTime;
        if (onBlinkEvent) onBlinkEvent('blink_end', dur, this.blinkStartTime);
      }

      return {
        leftEar: Number(leftEar.toFixed(3)),
        rightEar: Number(rightEar.toFixed(3)),
        avgEar: Number(avgEar.toFixed(3)),
        isBlinking: this.isCurrentlyBlinking,
        faceDetected: true,
        landmarks,
      };
    } catch (e) {
      return { leftEar: 0.3, rightEar: 0.3, avgEar: 0.3, isBlinking: false, faceDetected: false };
    }
  }

  public close() {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
    this.isInitialized = false;
  }
}

export const eyeBlinkDetector = new EyeBlinkDetector();
