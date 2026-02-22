from app.textops import (
    clean_text_for_tts, 
    find_long_sentences, 
    safe_split_long_sentences, 
    pack_text_to_limit, 
    preprocess_text, 
    split_into_parts,
    split_sentences,
    consolidate_single_word_sentences,
    sanitize_for_xtts,
    safe_filename
)
from app.config import SENT_CHAR_LIMIT

def test_preprocess():
    assert preprocess_text("Hello [ignored] World {too} (bye)") == "Hello ignored World too bye"

def test_clean_text():
    raw = "Hello\nWorld!!!"
    assert clean_text_for_tts(raw)

def test_consolidate_single_word_sentences():
    text = "Yes. I will go."
    res = consolidate_single_word_sentences(text)
    assert res

def test_sanitize_for_xtts():
    text = "Hello!!..."
    assert "Hello!" in sanitize_for_xtts(text)

def test_find_long_sentences():
    long_sent = "A" * (SENT_CHAR_LIMIT + 1) + "."
    hits = find_long_sentences(long_sent)
    assert len(hits) == 1

def test_safe_split_long_sentences():
    long_sent = "I am a very long sentence! " * 50
    split_src = safe_split_long_sentences(long_sent)
    assert split_src

def test_pack_text_to_limit():
    blocks = pack_text_to_limit("A\nB", limit=5)
    assert blocks == "A B"

def test_safe_filename():
    assert safe_filename("Hello World: A Test/Subtitle") == "Hello World: A TestSubtitle"

def test_split_sentences():
    assert len(list(split_sentences("One. Two! Three?"))) == 3
