"""
Morse Engine: Centralized, deterministic Morse Code encoder, decoder, and validator.
Complies with International Telecommunication Union (ITU-R M.1677-1) standard.
"""

from typing import Dict, List, Tuple, Optional
import re

# ITU Standard Morse Code Mappings
CHAR_TO_MORSE: Dict[str, str] = {
    # Letters
    'A': '.-',    'B': '-...',  'C': '-.-.',  'D': '-..',
    'E': '.',     'F': '..-.',  'G': '--.',   'H': '....',
    'I': '..',    'J': '.---',  'K': '-.-',   'L': '.-..',
    'M': '--',    'N': '-.',    'O': '---',   'P': '.--.',
    'Q': '--.-',  'R': '.-.',   'S': '...',   'T': '-',
    'U': '..-',   'V': '...-',  'W': '.--',   'X': '-..-',
    'Y': '-.--',  'Z': '--..',

    # Numbers
    '0': '-----', '1': '.----', '2': '..---', '3': '...--',
    '4': '....-', '5': '.....', '6': '-....', '7': '--...',
    '8': '---..', '9': '----.',

    # Punctuation & Symbols
    '.': '.-.-.-',
    ',': '--..--',
    '?': '..--..',
    "'": '.----.',
    '!': '-.-.--',
    '/': '-..-.',
    '(': '-.--.',
    ')': '-.--.-',
    '&': '.-...',
    ':': '---...',
    ';': '-.-.-.',
    '=': '-...-',
    '+': '.-.-.',
    '-': '-....-',
    '_': '..--.-',
    '"': '.-..-.',
    '$': '...-..-',
    '@': '.--.-.',

    # International Accented Extensions
    'Ä': '.-.-',
    'Á': '.--.-',
    'Å': '.--.-',
    'É': '..-..',
    'Ñ': '--.--',
    'Ö': '---.',
    'Ü': '..--',

    # Special Prosigns
    'SOS': '...---...',
    '<SOS>': '...---...',
    'SK': '...-.-',      # End of contact / Silent Key
    'AR': '.-.-.',       # End of transmission
    'BT': '-...-',       # Break / New paragraph
    'AS': '.-...',       # Wait
    'KA': '-.-.-',       # Starting signal
    'HH': '........',    # Error / Correction
}

# Inverted mapping: Morse -> Character
MORSE_TO_CHAR: Dict[str, str] = {v: k for k, v in CHAR_TO_MORSE.items() if not k.startswith('<')}
# Ensure SOS maps to SOS
MORSE_TO_CHAR['...---...'] = 'SOS'


class MorseEngine:
    """Centralized Morse Code Engine supporting bidirectional conversion, validation, and audio metadata."""

    @staticmethod
    def encode_text(text: str, char_delimiter: str = " ", word_delimiter: str = " / ") -> Tuple[str, float, List[Dict]]:
        """
        Encodes plain text into Morse code sequence.
        Returns (morse_string, confidence, token_breakdown)
        """
        if not text:
            return "", 1.0, []

        tokens_breakdown = []
        words = text.strip().split()
        encoded_words = []
        total_chars = 0
        valid_chars = 0

        for word in words:
            encoded_chars = []
            # Check if entire word is a known prosign like SOS or SK
            upper_word = word.upper()
            if upper_word in CHAR_TO_MORSE and len(upper_word) > 1:
                morse_sym = CHAR_TO_MORSE[upper_word]
                encoded_chars.append(morse_sym)
                total_chars += 1
                valid_chars += 1
                tokens_breakdown.append({
                    "char": upper_word,
                    "morse": morse_sym,
                    "valid": True,
                    "is_prosign": True
                })
            else:
                for char in upper_word:
                    total_chars += 1
                    if char in CHAR_TO_MORSE:
                        morse_sym = CHAR_TO_MORSE[char]
                        encoded_chars.append(morse_sym)
                        valid_chars += 1
                        tokens_breakdown.append({
                            "char": char,
                            "morse": morse_sym,
                            "valid": True
                        })
                    else:
                        # Unknown character representation
                        encoded_chars.append("?")
                        tokens_breakdown.append({
                            "char": char,
                            "morse": "?",
                            "valid": False
                        })
            encoded_words.append(char_delimiter.join(encoded_chars))

        morse_string = word_delimiter.join(encoded_words)
        confidence = (valid_chars / total_chars) if total_chars > 0 else 1.0
        return morse_string, confidence, tokens_breakdown

    @staticmethod
    def decode_morse(morse: str) -> Tuple[str, float, List[Dict]]:
        """
        Decodes Morse code string into plain text.
        Accepts flexible word delimiters ('/', '|', '  ', '   ') and character spaces (' ').
        Returns (decoded_text, confidence, token_breakdown)
        """
        if not morse or not morse.strip():
            return "", 1.0, []

        cleaned_morse = morse.strip()
        
        # Normalize word delimiters: Replace triple/double spaces or pipe or slash with standardized ' / '
        cleaned_morse = re.sub(r'\s*[/\|]\s*', ' / ', cleaned_morse)
        cleaned_morse = re.sub(r'\s{3,}', ' / ', cleaned_morse)
        cleaned_morse = re.sub(r'\s{2}', ' / ', cleaned_morse)

        words_raw = cleaned_morse.split(' / ')
        decoded_words = []
        tokens_breakdown = []
        total_symbols = 0
        valid_symbols = 0

        for word_morse in words_raw:
            chars_morse = [c.strip() for c in word_morse.split(' ') if c.strip()]
            decoded_chars = []
            for sym in chars_morse:
                total_symbols += 1
                # Check direct lookup
                if sym in MORSE_TO_CHAR:
                    char = MORSE_TO_CHAR[sym]
                    decoded_chars.append(char)
                    valid_symbols += 1
                    tokens_breakdown.append({
                        "morse": sym,
                        "char": char,
                        "valid": True
                    })
                else:
                    # Check for unknown / corrupted symbol
                    decoded_chars.append("")
                    tokens_breakdown.append({
                        "morse": sym,
                        "char": "",
                        "valid": False
                    })
            decoded_words.append("".join(decoded_chars))

        decoded_text = " ".join(decoded_words)
        confidence = (valid_symbols / total_symbols) if total_symbols > 0 else 0.0
        return decoded_text, confidence, tokens_breakdown

    @staticmethod
    def calculate_wpm_timing(wpm: float = 15.0) -> Dict[str, float]:
        """
        Calculates Paris standard timing intervals in milliseconds for a given WPM.
        Standard word 'PARIS' = 50 units.
        Duration of 1 unit t (ms) = 1200 / WPM
        """
        unit_ms = 1200.0 / max(wpm, 1.0)
        return {
            "wpm": wpm,
            "unit_ms": unit_ms,
            "dot_ms": unit_ms,               # 1 unit
            "dash_ms": unit_ms * 3.0,         # 3 units
            "intra_element_gap_ms": unit_ms,  # 1 unit
            "char_gap_ms": unit_ms * 3.0,     # 3 units
            "word_gap_ms": unit_ms * 7.0,     # 7 units
        }
