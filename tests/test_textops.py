import pytest
from app.textops import (
    sanitize_for_xtts,
    safe_split_long_sentences,
    pack_text_to_limit,
    split_sentences
)

def test_sanitize_xtts_adds_period():
    assert sanitize_for_xtts("Test 1") == "Test 1."
    assert sanitize_for_xtts("Test 1.") == "Test 1."
    assert sanitize_for_xtts("Hello world!") == "Hello world!"
    assert sanitize_for_xtts("Is this real?") == "Is this real?"

def test_sanitize_xtts_normalizes_quotes():
    assert sanitize_for_xtts('“Smart” quotes') == '"Smart" quotes.'
    assert sanitize_for_xtts("‘Single’ quotes") == "'Single' quotes."

def test_sanitize_xtts_replaces_ellipses():
    assert sanitize_for_xtts("Thinking...") == "Thinking,."
    assert sanitize_for_xtts("Wait… what") == "Wait, what."

def test_safe_split_robust_for_short_text():
    # The bug we fixed: short text without punctuation was erased
    assert safe_split_long_sentences("Test 2") == "Test 2"
    assert safe_split_long_sentences("Hello") == "Hello"

def test_split_sentences_preserves_trailing_text():
    text = "Sentence one. Sentence two"
    parts = list(split_sentences(text))
    # Should get two parts
    assert len(parts) == 2
    assert parts[0][0] == "Sentence one."
    assert parts[1][0] == "Sentence two"

def test_pack_text_to_limit():
    text = "Short line 1.\nShort line 2.\nShort line 3."
    # With a small limit, they should be packed
    packed = pack_text_to_limit(text, limit=100)
    assert packed == "Short line 1. Short line 2. Short line 3."
    
    # With a very small limit, they should stay separate
    packed_small = pack_text_to_limit(text, limit=15)
    # Note: pack_text_to_limit uses (limit - 5) as the threshold
    # "Short line 1." is 13 chars. 13 + 1 + 13 = 27 > (15-5=10)
    # So it should stay separate
    assert "Short line 1.\nShort line 2.\nShort line 3." == packed_small

def test_sanitize_removes_non_ascii():
    assert sanitize_for_xtts("Hello 🚀") == "Hello."
