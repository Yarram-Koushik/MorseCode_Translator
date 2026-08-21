"""
Timing Reconstruction Engine: Reconstructs Morse symbols, gaps, sequences, and text
from raw physical signal transitions (ON/OFF duration intervals).
Supports fixed, calibrated, and adaptive timing models.
"""

from typing import List, Dict, Tuple, Optional
import math
from app.core.morse_engine import MorseEngine, MORSE_TO_CHAR

class TimingEngine:
    """Reconstructs Morse pulses (dot/dash) and spacing (char/word gaps) from raw temporal signal events."""

    def __init__(
        self,
        mode: str = "calibrated",
        dot_duration_ms: float = 100.0,
        dash_duration_ms: float = 300.0,
        char_gap_ms: float = 300.0,
        word_gap_ms: float = 700.0,
        tolerance_ratio: float = 0.40
    ):
        self.mode = mode
        self.dot_duration_ms = max(dot_duration_ms, 20.0)
        self.dash_duration_ms = max(dash_duration_ms, self.dot_duration_ms * 1.5)
        self.char_gap_ms = max(char_gap_ms, self.dot_duration_ms * 1.5)
        self.word_gap_ms = max(word_gap_ms, self.char_gap_ms * 1.8)
        self.tolerance_ratio = tolerance_ratio
        
        # Midpoint split thresholds
        self.pulse_split_threshold = (self.dot_duration_ms + self.dash_duration_ms) / 2.0
        self.gap_split_threshold = (self.dot_duration_ms + self.char_gap_ms) / 2.0
        self.word_split_threshold = (self.char_gap_ms + self.word_gap_ms) / 2.0

    def classify_pulse(self, duration_ms: float) -> Tuple[str, float]:
        """
        Classifies an active signal ON pulse as '.' (dot) or '-' (dash).
        Returns (symbol, confidence)
        """
        if duration_ms <= 0:
            return ".", 0.0

        # Distance to ideal dot vs ideal dash
        dist_dot = abs(duration_ms - self.dot_duration_ms) / self.dot_duration_ms
        dist_dash = abs(duration_ms - self.dash_duration_ms) / self.dash_duration_ms

        if duration_ms < self.pulse_split_threshold:
            symbol = "."
            # Confidence is high if close to dot_duration_ms, drops if close to boundary
            margin = abs(duration_ms - self.pulse_split_threshold) / (self.pulse_split_threshold - self.dot_duration_ms + 1e-5)
            confidence = max(0.5, min(1.0, 0.7 + 0.3 * min(1.0, margin) - 0.2 * dist_dot))
        else:
            symbol = "-"
            margin = abs(duration_ms - self.pulse_split_threshold) / (self.dash_duration_ms - self.pulse_split_threshold + 1e-5)
            confidence = max(0.5, min(1.0, 0.7 + 0.3 * min(1.0, margin) - 0.2 * dist_dash))

        return symbol, round(max(0.1, min(1.0, confidence)), 3)

    def classify_gap(self, duration_ms: float) -> Tuple[str, float]:
        """
        Classifies an inactive signal OFF gap as:
        'intra' (within symbol, ignored in Morse output),
        'char' (space between letters, ' '),
        'word' (space between words, ' / ')
        """
        if duration_ms < self.gap_split_threshold:
            return "intra", 0.95
        elif duration_ms < self.word_split_threshold:
            margin = abs(duration_ms - self.gap_split_threshold) / (self.word_split_threshold - self.gap_split_threshold + 1e-5)
            confidence = max(0.5, min(1.0, 0.75 + 0.25 * min(1.0, margin)))
            return "char", round(confidence, 3)
        else:
            return "word", 0.98

    def process_signal_intervals(self, intervals: List[Dict]) -> Dict:
        """
        Processes an ordered list of raw signal intervals:
        [
          {"type": "pulse", "duration_ms": 110, "timestamp_ms": 1000},
          {"type": "gap",   "duration_ms": 80,  "timestamp_ms": 1110},
          {"type": "pulse", "duration_ms": 320, "timestamp_ms": 1190},
          {"type": "gap",   "duration_ms": 350, "timestamp_ms": 1510},
          ...
        ]
        Reconstructs Morse sequence, decoded text, telemetry event log, and signal metrics.
        """
        if not intervals:
            return {
                "morse_sequence": "",
                "decoded_text": "",
                "overall_confidence": 1.0,
                "signal_quality": 1.0,
                "estimated_wpm": 15.0,
                "reconstructed_events": []
            }

        reconstructed_events = []
        morse_tokens = []
        current_char_symbols = []
        confidences = []
        pulse_durations = []

        for item in intervals:
            item_type = item.get("type", "pulse")
            dur = float(item.get("duration_ms", 0.0))
            ts = float(item.get("timestamp_ms", 0.0))
            raw_reading = item.get("raw_reading", None)

            if item_type == "pulse" and dur > 15.0: # Filter sub-15ms noise glitch
                pulse_durations.append(dur)
                sym, conf = self.classify_pulse(dur)
                current_char_symbols.append(sym)
                confidences.append(conf)

                reconstructed_events.append({
                    "event_type": "dot" if sym == "." else "dash",
                    "duration_ms": dur,
                    "timestamp_ms": ts,
                    "classification": sym,
                    "confidence": conf,
                    "raw_reading": raw_reading
                })

            elif item_type == "gap" and dur > 15.0:
                gap_type, conf = self.classify_gap(dur)
                confidences.append(conf)

                if gap_type == "char":
                    if current_char_symbols:
                        morse_tokens.append("".join(current_char_symbols))
                        current_char_symbols = []
                    reconstructed_events.append({
                        "event_type": "char_gap",
                        "duration_ms": dur,
                        "timestamp_ms": ts,
                        "classification": " ",
                        "confidence": conf
                    })

                elif gap_type == "word":
                    if current_char_symbols:
                        morse_tokens.append("".join(current_char_symbols))
                        current_char_symbols = []
                    if morse_tokens and morse_tokens[-1] != "/":
                        morse_tokens.append("/")
                    reconstructed_events.append({
                        "event_type": "word_gap",
                        "duration_ms": dur,
                        "timestamp_ms": ts,
                        "classification": " / ",
                        "confidence": conf
                    })
                else:
                    reconstructed_events.append({
                        "event_type": "element_gap",
                        "duration_ms": dur,
                        "timestamp_ms": ts,
                        "classification": "",
                        "confidence": conf
                    })

        # Append any remaining symbols
        if current_char_symbols:
            morse_tokens.append("".join(current_char_symbols))

        # Build clean Morse sequence
        morse_string_parts = []
        for tok in morse_tokens:
            if tok == "/":
                morse_string_parts.append(" / ")
            else:
                if morse_string_parts and not morse_string_parts[-1].endswith(" ") and morse_string_parts[-1] != " / ":
                    morse_string_parts.append(" ")
                morse_string_parts.append(tok)

        morse_sequence = "".join(morse_string_parts).strip()
        decoded_text, text_conf, token_breakdown = MorseEngine.decode_morse(morse_sequence)

        # Estimate WPM from average dot duration
        estimated_unit_ms = self.dot_duration_ms
        if pulse_durations:
            dots = [d for d in pulse_durations if d < self.pulse_split_threshold]
            if dots:
                estimated_unit_ms = sum(dots) / len(dots)
        estimated_wpm = round(1200.0 / max(estimated_unit_ms, 10.0), 1)

        # Overall confidence & signal quality calculation
        avg_conf = sum(confidences) / len(confidences) if confidences else 1.0
        combined_confidence = round(0.5 * avg_conf + 0.5 * text_conf, 3)

        # Signal quality: Penalizes high jitter in dot durations
        signal_quality = 1.0
        if len(pulse_durations) > 2:
            std_dev = (sum((p - sum(pulse_durations)/len(pulse_durations))**2 for p in pulse_durations) / len(pulse_durations))**0.5
            jitter_penalty = min(0.4, std_dev / (self.dash_duration_ms + 1e-5))
            signal_quality = round(max(0.4, 1.0 - jitter_penalty), 3)

        return {
            "morse_sequence": morse_sequence,
            "decoded_text": decoded_text,
            "overall_confidence": combined_confidence,
            "signal_quality": signal_quality,
            "estimated_wpm": estimated_wpm,
            "reconstructed_events": reconstructed_events,
            "token_breakdown": token_breakdown
        }
