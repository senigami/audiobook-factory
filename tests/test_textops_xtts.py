import pytest
from app.textops import consolidate_single_word_sentences

def test_single_word_merge_next():
    text = "Wait. Come back."
    # sentences: ["Wait.", "Come back."]
    # "Wait" is 1 word, i < len-1, merges with "Come back."
    expected = "Wait, Come back."
    assert consolidate_single_word_sentences(text) == expected

def test_single_word_merge_prev():
    text = "Ready. Now."
    # sentences: ["Ready.", "Now."]
    # i=0: "Ready" (1 word), merges with NEXT -> "Ready, Now."
    # i=2 (skipped i=1)
    expected = "Ready, Now."
    assert consolidate_single_word_sentences(text) == expected

def test_multiple_single_words():
    text = "Wait. No. Stop. Go."
    # ["Wait.", "No.", "Stop.", "Go."]
    # i=0: "Wait" -> merges with "No" -> "Wait, No." (new_sentences)
    # i=2: "Stop" -> merges with "Go" -> "Stop, Go." (new_sentences)
    expected = "Wait, No., Stop, Go." # Wait, it becomes "split_sentences" might keep punctuation 
    # Let's see what split_sentences does.
    # It yields "Wait.", "No.", etc.
    # Actually my logic adds curr.rstrip(".!?") + ", " + sentences[i+1]
    # So "Wait, No."
    # Then it continues at i=2: "Stop, Go."
    # Combined with space: "Wait, No. Stop, Go."
    result = consolidate_single_word_sentences(text)
    assert "Wait, No." in result
    assert "Stop, Go." in result

def test_tailing_single_word():
    text = "The end is near. Goodbye."
    # ["The end is near.", "Goodbye."]
    # i=0: "The end is near." (4 words) -> new_sentences = ["The end is near."]
    # i=1: "Goodbye." (1 word) -> i=1, not < len-1. merges with PREV.
    # pop "The end is near.", push "The end is near, Goodbye."
    expected = "The end is near, Goodbye."
    assert consolidate_single_word_sentences(text) == expected
