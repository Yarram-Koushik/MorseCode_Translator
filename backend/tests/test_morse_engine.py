import pytest
from app.core.morse_engine import MorseEngine, CHAR_TO_MORSE, MORSE_TO_CHAR

def test_morse_encode_basic_letters():
    text = "HELLO WORLD"
    morse, conf, tokens = MorseEngine.encode_text(text)
    assert morse == ".... . .-.. .-.. --- / .-- --- .-. .-.. -.."
    assert conf == 1.0
    assert len(tokens) == 10

def test_morse_decode_basic_letters():
    morse = ".... . .-.. .-.. --- / .-- --- .-. .-.. -.."
    text, conf, tokens = MorseEngine.decode_morse(morse)
    assert text == "HELLO WORLD"
    assert conf == 1.0

def test_morse_encode_numbers_and_punctuation():
    text = "TEST 123, OK?"
    morse, conf, tokens = MorseEngine.encode_text(text)
    assert ".----" in morse # '1'
    assert "--..--" in morse # ','
    assert "..--.." in morse # '?'
    assert conf == 1.0

def test_morse_decode_flexible_delimiters():
    # Test slash, pipe, and double space
    morse1 = "... --- ... / .--. .-.. .- -."
    morse2 = "... --- ... | .--. .-.. .- -."
    morse3 = "... --- ...   .--. .-.. .- -."
    
    t1, _, _ = MorseEngine.decode_morse(morse1)
    t2, _, _ = MorseEngine.decode_morse(morse2)
    t3, _, _ = MorseEngine.decode_morse(morse3)
    
    assert t1 == "SOS PLAN"
    assert t2 == "SOS PLAN"
    assert t3 == "SOS PLAN"

def test_morse_prosign_sos():
    text = "SOS"
    morse, conf, tokens = MorseEngine.encode_text(text)
    assert morse == "...---..."
    assert conf == 1.0

    # Decoding SOS prosign
    decoded, conf, _ = MorseEngine.decode_morse("...---...")
    assert decoded == "SOS"

def test_morse_unknown_characters():
    text = "HELLO # WORLD"
    morse, conf, tokens = MorseEngine.encode_text(text)
    assert "?" in morse
    assert conf < 1.0

    decoded, d_conf, _ = MorseEngine.decode_morse(".... . .-.. .-.. --- / ........ / .-- --- .-. .-.. -..")
    # '........' is mapped to HH (prosign) or unknown
    assert len(decoded) > 0

def test_wpm_timing_calculation():
    timing_15 = MorseEngine.calculate_wpm_timing(15.0)
    assert timing_15["unit_ms"] == 80.0
    assert timing_15["dot_ms"] == 80.0
    assert timing_15["dash_ms"] == 240.0
    assert timing_15["char_gap_ms"] == 240.0
    assert timing_15["word_gap_ms"] == 560.0

    timing_20 = MorseEngine.calculate_wpm_timing(20.0)
    assert timing_20["unit_ms"] == 60.0
    assert timing_20["dot_ms"] == 60.0
    assert timing_20["dash_ms"] == 180.0
