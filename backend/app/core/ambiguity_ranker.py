"""
Ambiguity Ranker: Identifies ambiguous Morse sequences and timing borderline cases,
suggesting ranked alternative character and word possibilities.
"""

from typing import List, Dict, Tuple
from app.core.morse_engine import MORSE_TO_CHAR, CHAR_TO_MORSE

class AmbiguityRanker:
    """Provides honest alternative candidates for ambiguous or noisy Morse sequences."""

    @staticmethod
    def rank_character_ambiguities(morse_sym: str, pulse_confidences: List[float] = None) -> List[Dict]:
        """
        Given a Morse character symbol (e.g. '.-' or '...'), generates possible alternative
        interpretations by testing single-element bitflips or neighbor timing ambiguities.
        """
        candidates = []
        clean_sym = morse_sym.strip()

        # Direct match if present
        if clean_sym in MORSE_TO_CHAR:
            direct_char = MORSE_TO_CHAR[clean_sym]
            candidates.append({
                "char": direct_char,
                "morse": clean_sym,
                "confidence": 0.95,
                "is_primary": True,
                "reason": "Direct ITU mapping match"
            })

        # Generate 1-distance variants (flipping dot to dash or vice-versa)
        for i, char in enumerate(clean_sym):
            flipped = list(clean_sym)
            flipped[i] = '-' if char == '.' else '.'
            flipped_sym = "".join(flipped)
            if flipped_sym in MORSE_TO_CHAR and MORSE_TO_CHAR[flipped_sym] not in [c["char"] for c in candidates]:
                # Confidence proportional to pulse confidence at that index if provided
                sub_conf = 0.50
                if pulse_confidences and i < len(pulse_confidences):
                    # Lower pulse confidence at index means higher plausibility of alternate
                    sub_conf = round(0.40 + (1.0 - pulse_confidences[i]) * 0.35, 2)
                candidates.append({
                    "char": MORSE_TO_CHAR[flipped_sym],
                    "morse": flipped_sym,
                    "confidence": sub_conf,
                    "is_primary": False,
                    "reason": f"Alternate interpretation of element {i+1} as {'dash' if flipped[i]=='-' else 'dot'}"
                })

        # Also check insertion/deletion (missing or extra dot/dash)
        # Insertion
        for insert_char in ['.', '-']:
            cand_sym = clean_sym + insert_char
            if cand_sym in MORSE_TO_CHAR and MORSE_TO_CHAR[cand_sym] not in [c["char"] for c in candidates]:
                candidates.append({
                    "char": MORSE_TO_CHAR[cand_sym],
                    "morse": cand_sym,
                    "confidence": 0.35,
                    "is_primary": False,
                    "reason": f"Plausible trailing {insert_char} omission"
                })
        # Deletion
        if len(clean_sym) > 1:
            cand_sym = clean_sym[:-1]
            if cand_sym in MORSE_TO_CHAR and MORSE_TO_CHAR[cand_sym] not in [c["char"] for c in candidates]:
                candidates.append({
                    "char": MORSE_TO_CHAR[cand_sym],
                    "morse": cand_sym,
                    "confidence": 0.30,
                    "is_primary": False,
                    "reason": "Plausible trailing ghost echo"
                })

        # Sort by confidence descending
        candidates.sort(key=lambda x: x["confidence"], reverse=True)
        return candidates[:5]
