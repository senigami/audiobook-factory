import re
from pathlib import Path
from typing import List, Tuple
from .config import SAFE_SPLIT_TARGET, SENT_CHAR_LIMIT

CHAPTER_RE = re.compile(r"^(Chapter\s+(\d+)\s*:\s*.+)$", re.MULTILINE)
SENT_SPLIT_RE = re.compile(r'(.+?[.!?]["\'”’]*)(\s+|$)', re.DOTALL)

def split_by_chapter_markers(full_text: str) -> List[Tuple[int, str, str]]:
    matches = list(CHAPTER_RE.finditer(full_text))
    if not matches:
        return []
    spans = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(full_text)
        heading = m.group(1).strip()
        chap_num = int(m.group(2))
        body = full_text[start:end].strip()
        spans.append((chap_num, heading, body))
    return spans

def split_into_parts(text: str, max_chars: int = 30000, start_index: int = 1) -> List[Tuple[int, str, str]]:
    if not text:
        return []

    parts = []
    part_num = start_index
    
    remaining_text = text.strip()
    
    while remaining_text:
        if len(remaining_text) <= max_chars:
            parts.append((part_num, f"Part {part_num}", remaining_text))
            break
            
        split_point = -1
        chunk = remaining_text[:max_chars]
        p_break = chunk.rfind("\n\n")
        if p_break > max_chars * 0.7:
            split_point = p_break + 2
        else:
            nl_break = chunk.rfind("\n")
            if nl_break > max_chars * 0.8:
                split_point = nl_break + 1
            else:
                search_start = int(max_chars * 0.8)
                sent_match = None
                for m in re.finditer(r'[.!?](\s+|$)', chunk[search_start:]):
                    sent_match = m
                
                if sent_match:
                    split_point = search_start + sent_match.end()
                else:
                    space_break = chunk.rfind(" ")
                    if space_break > 0:
                        split_point = space_break + 1
                    else:
                        split_point = max_chars
        
        parts.append((part_num, f"Part {part_num}", remaining_text[:split_point].strip()))
        remaining_text = remaining_text[split_point:].strip()
        part_num += 1
        
    return parts

def safe_filename(s: str, max_len: int = 80) -> str:
    s = re.sub(r"[^\w\s\-:]", "", s).strip()
    return s.replace(" ", "_")[:max_len]

def write_chapters_to_folder(chapters, out_dir: Path, prefix: str = "chapter") -> List[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for chap_num, heading, body in chapters:
        fname = out_dir / f"{prefix}_{chap_num:04}_{safe_filename(heading)}.txt"
        fname.write_text(body + "\n", encoding="utf-8")
        written.append(fname)
    return written

def split_sentences(text: str):
    last_end = 0
    for m in SENT_SPLIT_RE.finditer(text):
        s = m.group(1).strip()
        if s:
            yield s, m.start(1), m.end(1)
        last_end = m.end()
    
    remainder = text[last_end:].strip()
    if remainder:
        yield remainder, last_end, len(text)

def safe_split_long_sentences(text: str, target: int = SAFE_SPLIT_TARGET) -> str:
    def split_one(s: str) -> List[str]:
        if len(s) <= target:
            return [s]
        seps = ["; ", " - ", ", ", ": ", " and ", " but ", " so ", " because "]
        for sep in seps:
            if sep in s:
                parts = s.split(sep)
                out, buf = [], ""
                for i, p in enumerate(parts):
                    chunk = (p if i == 0 else (sep.strip() + " " + p)).strip()
                    if not buf:
                        buf = chunk
                    elif len(buf) + 1 + len(chunk) <= target:
                        buf = (buf + " " + chunk).strip()
                    else:
                        out.append(buf.rstrip(" .") + ".")
                        buf = chunk
                if buf:
                    out.append(buf.rstrip(" .") + ".")
                if max(len(x) for x in out) < len(s):
                    return out

        out = []
        i = 0
        while i < len(s):
            j = min(len(s), i + target)
            if j < len(s):
                ws = s.rfind(" ", i, j)
                if ws > i + 60:
                    j = ws
            out.append(s[i:j].strip().rstrip(" .") + ".")
            i = j
        return out

    pieces = []
    for s, _, _ in split_sentences(text):
        pieces.extend(split_one(s) if len(s) > target else [s])
    return "\n".join(pieces)

def find_long_sentences(text: str, limit: int = SENT_CHAR_LIMIT):
    hits = []
    idx = 0
    for s, start, end in split_sentences(text):
        idx += 1
        if len(s) > limit:
            hits.append((idx, len(s), start, end, s))
    return hits

def clean_text_for_tts(text: str) -> str:
    """Normalize punctuation and characters to avoid TTS speech artifacts."""
    # Handle smart quotes
    text = text.replace('“', '"').replace('”', '"').replace('‘', "'").replace('’', "'")
    # Handle dashes and ellipses. Use commas for ellipses to prevent breaks.
    text = text.replace("—", " - ").replace("–", " - ").replace("…", ", ").replace("...", ", ")
    
    # Common redundant punctuation artifacts
    text = text.replace(".' .", ". ").replace(".' ", ". ").replace("'.", ".'")
    text = text.replace('".', '."').replace('?"', '"?').replace('!"', '"!')
    
    # Normalize spaces after punctuation (if missing)
    text = re.sub(r'([.!?])(?=[^ \s.!?\'"])', r'\1 ', text)
    # Collapse multiple spaces
    text = re.sub(r' +', ' ', text)
    
    return text.strip()

def consolidate_single_word_sentences(text: str) -> str:
    """
    XTTS v2 often produces gibberish for single-word sentences (e.g., "Wait.").
    This merges them with neighbors using commas.
    """
    sentences = []
    for s, _, _ in split_sentences(text):
        sentences.append(s)
    
    if len(sentences) <= 1:
        return text

    new_sentences = []
    i = 0
    skip_next = False
    
    while i < len(sentences):
        curr = sentences[i]
        words = curr.split()
        # Clean words of punctuation to count actual words
        word_count = len([w for w in words if re.search(r'\w', w)])
        
        if word_count == 1:
            if i < len(sentences) - 1:
                # Merge with NEXT
                combined = curr.rstrip(".!?") + ", " + sentences[i+1]
                new_sentences.append(combined)
                i += 2 # Skip the one we merged with
                continue
            elif len(new_sentences) > 0:
                # Merge with PREVIOUS (tailing single word)
                prev = new_sentences.pop()
                combined = prev.rstrip(".!?") + ", " + curr
                new_sentences.append(combined)
            else:
                new_sentences.append(curr)
        else:
            new_sentences.append(curr)
        i += 1
        
    return " ".join(new_sentences)

def sanitize_for_xtts(text: str) -> str:
    """
    Advanced sanitization to prevent XTTS hallucinations (e.g., 'nahnday').
    Based on Gemini feedback: handles smart quotes, ellipses, and non-ASCII chars.
    """
    # 0. Consolidate dangerous single-word sentences first
    text = consolidate_single_word_sentences(text)

    # 1. Convert smart quotes to straight quotes
    text = text.replace('“', '"').replace('”', '"').replace('‘', "'").replace('’', "'")
    # Replace ellipses with a comma for better natural pauses without breaking the thought
    text = text.replace('...', ', ').replace('…', ', ')
    # Remove any non-standard characters/emojis
    text = re.sub(r'[^\x00-\x7F]+', '', text) 
    # Collapse multiple spaces (but preserve newlines) and trim
    text = re.sub(r'[^\S\r\n]+', ' ', text).strip()
    
    # Ensure terminal punctuation (XTTS v2 can fail on short strings without it)
    if text and not text[-1] in ".!?":
        text += "."
        
    return text

def pack_text_to_limit(text: str, limit: int = SENT_CHAR_LIMIT, pad: bool = False) -> str:
    """
    Greedily packs sentences into larger chunks as close to the limit as possible.
    This gives XTTS the maximum context and prevents choppiness from short lines.
    If pad is True, each chunk is padded with spaces up to the limit.
    """
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if not lines:
        return ""
        
    packed = []
    current_chunk = ""
    
    for line in lines:
        if current_chunk and len(current_chunk) + 1 + len(line) <= limit:
            current_chunk += " " + line
        elif not current_chunk and len(line) <= limit:
            current_chunk = line
        else:
            if current_chunk:
                if pad:
                    current_chunk = current_chunk.ljust(limit)
                packed.append(current_chunk)
            current_chunk = line
            
    if current_chunk:
        if pad:
            current_chunk = current_chunk.ljust(limit)
        packed.append(current_chunk)
        
    return '\n'.join(packed)
