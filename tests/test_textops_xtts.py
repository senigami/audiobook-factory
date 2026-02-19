from app.textops import consolidate_single_word_sentences

def test_single_word_merge_next():
    text = "Wait. Come back."
    # sentences: ["Wait.", "Come back."]
    # "Wait" is 1 word, i < len-1, merges with "Come back."
    expected = "Wait; Come back."
    assert consolidate_single_word_sentences(text) == expected

def test_single_word_merge_prev():
    text = "Ready. Now."
    # sentences: ["Ready.", "Now."]
    expected = "Ready; Now."
    assert consolidate_single_word_sentences(text) == expected

def test_multiple_single_words():
    text = "Wait. No. Stop. Go."
    result = consolidate_single_word_sentences(text)
    assert result == "Wait; No; Stop; Go."

def test_tailing_single_word():
    text = "The end is near. Goodbye."
    # ["The end is near.", "Goodbye."]
    # i=0: "The end is near." (4 words) -> new_sentences = ["The end is near."]
    # i=1: "Goodbye." (1 word) -> i=1, not < len-1. merges with PREV.
    # pop "The end is near.", push "The end is near, Goodbye."
    expected = "The end is near; Goodbye."
    assert consolidate_single_word_sentences(text) == expected
