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

def test_sanitize_xtts_quotes_behavior():
    # Double quotes stripped, single quotes preserved
    assert sanitize_for_xtts('“Smart” quotes') == "Smart quotes."
    assert sanitize_for_xtts("‘Single’ quotes") == "'Single' quotes."

def test_sanitize_xtts_pacing():
    # Ellipsis becomes period and space (trimmed if at sentence end)
    assert sanitize_for_xtts("Thinking...") == "Thinking."
    # Dash becomes comma
    assert sanitize_for_xtts("Wait— what") == "Wait, what."

def test_sanitize_acronyms():
    assert sanitize_for_xtts("A.B.C.") == "A B C."

def test_sanitize_fractions():
    # 444/7000 to 444 out of 7000
    assert sanitize_for_xtts("444/7000") == "444 out of 7000."
    assert sanitize_for_xtts("score 1/2") == "score 1 out of 2."

def test_sanitize_standalone_initials():
    # Standalone letter should NOT be treated as acronym (preserves the dot)
    # But single-word sentences are still consolidated with commas for pacing.
    assert sanitize_for_xtts("It is I. I am here.") == "It is I. I am here."
    assert sanitize_for_xtts("Plan A.") == "Plan A."
    # Mr., A., and Smith are each single-word sentences, so they merge with commas.
    assert sanitize_for_xtts("Mr. A. Smith") == "Mr, A, Smith."

def test_safe_split_robust_for_short_text():
    # The bug we fixed: short text without punctuation was erased
    assert safe_split_long_sentences("Test 2") == "Test 2"
    assert safe_split_long_sentences("Hello") == "Hello"

def test_split_sentences_preserves_trailing_text():
    text = "Sentence one. Sentence two"
    parts = list(split_sentences(text))
    assert len(parts) == 2
    assert parts[0][0] == "Sentence one."
    assert parts[1][0] == "Sentence two"

def test_pack_text_to_limit():
    text = "Short line 1.\nShort line 2.\nShort line 3."
    packed = pack_text_to_limit(text, limit=100)
    assert packed == "Short line 1. Short line 2. Short line 3."
    
    packed_small = pack_text_to_limit(text, limit=15)
    assert "Short line 1.\nShort line 2.\nShort line 3." == packed_small

def test_sanitize_removes_non_ascii():
    assert sanitize_for_xtts("Hello 🚀") == "Hello."
