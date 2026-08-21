# 📡 Morse Signal Lab — Multimodal Signal Intelligence & Morse Communication Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0+-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0+-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Pytest-17%2F17%20Passed-brightgreen.svg?style=flat&logo=pytest&logoColor=white)](https://docs.pytest.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **"Detect Morse signals from real-world sources, reconstruct timing intervals, decode with confidence estimation, communicate across live rooms, and analyze recorded audio/video intelligence."**

**Morse Signal Lab** is an end-to-end Signal Intelligence (SIGINT) and communication suite designed to transcend traditional keyboard typing. It detects, translates, and synthesizes International Morse Code (ITU-R M.1677-1) across multiple physical modalities with sub-millisecond precision.

---

## 🌟 Key Highlights & Modalities

### 1. 👁️ Eye-Blink Morse (Vision DSP)
- Real-time webcam facial landmark detection powered by **MediaPipe WebAssembly**.
- Dual **Eye Aspect Ratio (EAR)** computation with dynamic eye-closure state machine.
- Converts intentional eye blinks into dits (dots) and dahs (dashes).
- **100% Client-Side DSP** — Raw camera feed never leaves your browser memory.

### 2. 🎙️ Acoustic Sound Morse (Audio DSP)
- Real-time microphone listening engine using **Web Audio API** and `AnalyserNode`.
- Custom adjustable **Bandpass Filter (400–1200 Hz)** with dynamic spectral RMS energy peak detection.
- Adaptive noise floor tracker to isolate pure CW tones even in noisy acoustic environments.

### 3. 💡 Optical Light & Flash Morse (Video Frame Analysis)
- Video region-of-interest (ROI) luminance differential analyzer.
- Dynamic ambient illumination tracking to detect flashlights, optical beacons, and screen flashes.

### 4. 🖲️ Tactile Telegraph Key (Physical Hardware Simulation)
- Virtual brass telegraph key with authentic click sidetone audio synthesis.
- Measures raw hold durations (ms) and gap durations (ms) to classify dits, dahs, character gaps, and word gaps using the official **PARIS Standard**.

### 5. ⌨️ Deterministic Keyboard Studio & Ambiguity Analysis
- Bi-directional instant text $\leftrightarrow$ Morse encoding and decoding.
- Full support for ITU alphabets, numbers, punctuation, and tactical prosigns (`SOS`, `SK`, `AR`, `BT`, `AS`).
- Ambiguity tree analyzer calculating alternative probability decodings.

### 6. 🛰️ Real-Time Two-User Communication (Encrypted Rooms)
- WebSocket-backed bidirectional chat room (`/ws/room/{room_code}`).
- Live peer transmission telemetry banner with dynamic sidetone audio synthesis.
- Decoded chat timeline with confidence scores, CW audio playback, and synchronized visual flash playback.
- Compact in-room transceiver supporting both manual telegraph key tapping and quick text encoding.

### 7. 🔬 Media Recording Forensics (Audio & Video Upload)
- Drag-and-drop analysis workbench supporting **MP3, WAV, M4A, OGG, MP4, and WebM**.
- Synchronized media player with an interactive **Signal Timeline Oscilloscope**.
- Time-stamped event ledger breaking down each classified pulse and gap with duration and confidence %.
- Real-time forensic filter sliders (detection threshold ratio, bandpass frequency, min pulse duration) with instant re-analysis.
- Export complete forensics report as JSON.

### 8. 🎓 Morse Academy & Speedrun Arena
- **Learning Trainer**: Progressive training across Beginner (letters), Intermediate (words/prosigns), and Advanced (sentences).
- **Dual Practice Modes**: "Listen & Decode" (audio flashcards) and "See & Transmit" (telegraph key practice).
- Real-time accuracy %, streak counters, PARIS speed metrics, and spaced-repetition mistake review.
- **Speedrun Arena**: "60-Second Rapid Decode" and "Tactical Intercept Decipher" time trials with scoring and leaderboard submission.

### 9. 🎯 4-Step Guided Calibration Wizard
- Empirical calibration wizard: Baseline calibration $\to$ 3 short dots $\to$ 3 long dashes $\to$ empirical split threshold calculation.
- Persists user-specific timing profiles to backend SQLite `/api/calibration`.

### 10. 🛡️ Privacy & Accessibility
- High-contrast visual theme toggle for low-visibility operations.
- Tactical keyboard shortcuts (`Spacebar` for telegraph key, `1–5` for modality switching, `Esc` for modals).
- One-click local data, tokens, and signal history purge.

---

## 🏗️ Signal Processing Pipeline

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Input Source   │ ──> │ Signal Detection │ ──> │  Signal Events   │
│ (Eye/Audio/Tap) │     │  (Filter/Noise)  │     │   (Dits & Dahs)  │
└─────────────────┘     └──────────────────┘     └──────────────────┘
                                                           │
┌─────────────────┐     ┌──────────────────┐     ┌─────────▼────────┐
│   Plain Text    │ <── │ Ambiguity Ranker │ <── │ Timing Engine    │
│ (Decoded Output)│     │  (Fuzzy Scoring) │     │ (PARIS Standard) │
└─────────────────┘     └──────────────────┘     └──────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS / Vanilla CSS, Lucide Icons, MediaPipe FaceLandmarker, Web Audio API |
| **Backend** | FastAPI, Python 3.12, Uvicorn, SQLAlchemy ORM, Pydantic v2, Pytest, WebSockets |
| **Database** | SQLite (persistent local database) |
| **Design System** | Stitch MCP Military-Grade SIGINT Dark Theme (`#080C14`, `#06B6D4`, `#F59E0B`, `#10B981`) |

---

## 🚀 Quick Start & Installation

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/Yarram-Koushik/MorseCode_Translator.git
cd MorseCode_Translator
```

### 2. Backend Setup
```bash
# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Start FastAPI backend server
uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

### 3. Frontend Setup
```bash
# Open a new terminal
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev -- --host 127.0.0.1 --port 5173
```

### 4. Access the Application
- **Frontend UI**: [http://localhost:5173](http://localhost:5173)
- **Backend API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 🧪 Running Automated Tests

### Backend Test Suite (Pytest)
```bash
# Run all 17 backend test cases
pytest -v
```

### Frontend Build Verification
```bash
cd frontend
npm run build
```

---

## 📡 API Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check and version status |
| `POST` | `/api/morse/encode` | Convert plain text to Morse code with confidence score |
| `POST` | `/api/morse/decode` | Convert Morse string to decoded plain text |
| `POST` | `/api/morse/timing/reconstruct` | Reconstruct Morse from raw timestamped intervals |
| `POST` | `/api/morse/ambiguity/analyze` | Analyze Morse sequence for possible ambiguities |
| `POST` | `/api/auth/register` | Register new radio operator account |
| `POST` | `/api/auth/token` | Obtain JWT access token |
| `GET` | `/api/auth/me` | Retrieve authenticated operator profile |
| `POST` | `/api/rooms` | Create a new encrypted communication room |
| `GET` | `/api/rooms/{code}` | Get room details and active member roster |
| `POST` | `/api/rooms/{code}/messages` | Post a decoded message to room timeline |
| `WS` | `/ws/room/{code}` | Bidirectional WebSocket stream for live peer telemetry |
| `POST` | `/api/analysis/audio` | Upload and analyze recorded audio file |
| `POST` | `/api/analysis/video` | Upload and analyze recorded video file |
| `POST` | `/api/calibration/` | Save custom timing calibration profile |
| `POST` | `/api/training/challenges/submit` | Submit Speedrun challenge score |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

Developed with ❤️ by **[Yarram Koushik](https://github.com/Yarram-Koushik)**.
