"""
TEXT PROCESSING PIPELINE - ORDER OF OPERATIONS
-----------------------------------------------
1. INGESTION (split_by_chapter_markers / split_into_parts)
   - [preprocess_text] Strips brackets [], braces {}, and parentheses () early.
   - [clean_text_for_tts] (Part of Sanitization, but happens before split)
     - Strips leading ellipses/punctuation to prevent speech hallucinations.
     - Normalizes acronyms/initials (A.B.C. -> A B C, but A. stays A.).
     - Normalizes fractions (444/7000 -> 444 out of 7000).

2. SANITIZATION (sanitize_for_xtts)
   - Step A: [clean_text_for_tts]
     - Normalize Quotes: Convert smart quotes (“ ”) to empty and normalize (‘ ’) to (').
     - Stripping: Removes double quotes (") while preserving single quotes (').
     - Leading Punc: Strips early dots/ellipses to prevent speech hallucinations.
     - Acronyms: Convert 2+ letters + period (A.B. -> A B) for better TTS prosody.
     - Fractions: Convert numbers like 444/7000 to "444 out of 7000".
     - Pacing: Convert dashes (—) to commas and ellipses (…) to periods.
     - Artifact Cleanup: Fix redundant punctuation patterns like ".' ." or "'. ".
     - Spacing: Ensures space after .!?, and removes space before ,;:.
     - Sentence Integrity: Repair artifacts like ".," or ",." introduced by splitting.
   - Step B: [consolidate_single_word_sentences]
     - Strips leading punctuation from each sentence to prevent hallucinations.
     - Filters out symbol-only lines (e.g. "!!!") that contain no alphanumeric text.
     - Finds single-word sentences (e.g. "Wait!") and merges them into neighbors 
       using commas to prevent XTTS v2 from failing or hallucinating on short strings.
       Favors forward-merging over backward-merging.
   - Step C: [ASCII Filter]
     - Strict removal of all non-ASCII characters to prevent speech engine crashes.
   - Step D: [Whitespace Collapse]
     - Trims and collapses multiple spaces into single spaces.
   - Step E: [Terminal Punctuation]
     - Ensures every voice line ends in a terminal punctuation mark (. ! or ?) 
       while correctly ignoring trailing quotes or parentheses.

3. FINAL SEGMENTATION (pack_text_to_limit)
   - Greedily packs the cleaned sentences into blocks <= 250 characters (SENT_CHAR_LIMIT).
   - This ensures the speech engine receives enough context for natural prosody
     while staying strictly within the reliability threshold of the model.
"""

import re
from pathlib import Path
from typing import List, Tuple
from .config import SAFE_SPLIT_TARGET, SENT_CHAR_LIMIT

CHAPTER_RE = re.compile(r"^(Chapter\s+(\d+)\s*:\s*.+)$", re.MULTILINE)
SENT_SPLIT_RE = re.compile(r'(.+?[.!?]["\'”’]*)(\s+|$)', re.DOTALL)

def preprocess_text(text: str) -> str:
    """Foundational cleaning to remove unspoken characters before splitting or analysis."""
    if not text:
        return ""
    # Strip brackets, braces, and parentheses
    for char in "[]{}()":
        text = text.replace(char, "")
    return text

def split_by_chapter_markers(full_text: str) -> List[Tuple[int, str, str]]:
    full_text = preprocess_text(full_text)
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
    text = preprocess_text(text)
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
    """Removes illegal filename characters but preserves spaces for readability."""
    s = re.sub(r"[^\w\s\-:]", "", s).strip()
    return s[:max_len]

def write_chapters_to_folder(chapters, out_dir: Path, prefix: str = "chapter", include_heading: bool = True) -> List[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for chap_num, heading, body in chapters:
        if include_heading:
            # Traditional chapter naming: [prefix]_[num]_[heading].txt
            fname = out_dir / f"{prefix}_{chap_num:04}_{safe_filename(heading)}.txt"
        else:
            # Clean part naming: [OriginalFilename]_[num].txt
            # Using 3 digits as requested (001)
            fname = out_dir / f"{prefix}_{chap_num:03}.txt"
            
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
                        connector = "" if chunk[0] in ",;:" else " "
                        buf = (buf + connector + chunk).strip()
                    else:
                        out.append(buf.rstrip(" .") + ".")
                        buf = chunk.lstrip(",; ")
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
    text = preprocess_text(text)
    hits = []
    idx = 0
    for s, start, end in split_sentences(text):
        idx += 1
        if len(s) > limit:
            hits.append((idx, len(s), start, end, s))
    return hits

# --- ORDER OF OPERATIONS FOR CREATING SAFE TEXT ---
# 1. Preprocess: Remove unspoken formatting/bracket characters [ ] { } ( ).
# 2. Normalize Quotes: Convert smart quotes (“ ”) to empty and normalize (‘ ’) to (').
# 3. Stripping: Removes double quotes (") while preserving single quotes (').
# 4. Leading Punc: Strips leading ellipses/dots to prevent speech hallucinations.
# 5. Acronyms: Convert 2+ letters + period (A.B. -> A B) for better TTS prosody.
# 6. Fractions: Convert numbers like 444/7000 to "444 out of 7000".
# 7. Pacing: Convert dashes (—) to commas and ellipses (…) to periods.
# 8. Artifact Cleanup: Fix redundant punctuation patterns like ".' ." or "'. ".
# 9. Spacing: Ensures space after .!?, and removes space before ,;:.
# 10. Sentence Integrity: Repair artifacts like ".," or ",." introduced by splitting.
# 11. Consolidation: Split, strip leading punc (e.g. ". Or") and filter symbol-only lines (e.g. "!!!").
#     Merge short sentences (<= 2 words) into neighbors using forward-favored semicolons.

def clean_text_for_tts(text: str) -> str:
    """Normalize punctuation and characters to avoid TTS speech artifacts."""
    # Remove unspoken formatting characters at the absolute start
    text = preprocess_text(text)
    
    # Handle smart quotes and then strip all quotes (standard and normalized)
    text = text.replace('“', '').replace('”', '').replace('‘', "'").replace('’', "'")
    text = text.replace('"', '')
    
    # Normalize acronyms/initials: A.B. if 2 or more. A. alone is a period.
    # This ensures "A.B.C." isn't split into 4 sentences but "It is I." is handled.
    pattern = r'\b(?:[A-Za-z]\.){2,}'
    text = re.sub(pattern, lambda m: m.group(0).replace('.', ' '), text)
    
    # Normalize fractions (444/7000 -> 444 out of 7000)
    text = re.sub(r'(\d+)/(\d+)', r'\1 out of \2', text)
    
    # Strip leading dots/ellipses/punctuation that often cause hallucinations at the start of blocks
    text = text.lstrip(" .…!?,")
    # Handle dashes and ellipses. Use commas for ellipses to prevent breaks.
    text = text.replace("—", ", ").replace("…", ". ").replace("...", ". ")
    
    # Common redundant punctuation artifacts
    text = text.replace(".' .", ". ").replace(".' ", ". ").replace("'.", ".'")
    text = text.replace('".', '."').replace('?"', '"?').replace('!"', '"!')
    
    # Normalize spaces after punctuation (if missing)
    text = re.sub(r'([.!?])(?=[^ \s.!?\'"])', r'\1 ', text)
    # Collapse multiple spaces
    text = re.sub(r' +', ' ', text)
    # Remove spaces before punctuation
    text = re.sub(r' +([,;:])', r'\1', text)
    # Remove redundant punctuation
    # Fix !. -> ! and ?. -> ? but preserve ... and ..
    text = re.sub(r'([!?])\.+', r'\1', text)
    # Fix ., -> , and ,. -> . and .; -> ; etc
    text = text.replace(".,", ",").replace(",.", ".").replace(".;", ";").replace(". :", ":")
    # Collapse multiple identical punctuations like !! -> ! or ?? -> ? (preserving ...)
    text = re.sub(r'([!?])\1+', r'\1', text)
    
    # Consolidate short sentences (<= 2 words) (like "Wait!" or "No way!") with neighbors
    text = consolidate_single_word_sentences(text.strip())
    
    return text.strip()

def consolidate_single_word_sentences(text: str) -> str:
    """
    TTS engines (especially XTTS) often fail on short sentences.
    This merges them (<= 2 words) with neighbors using commas for a natural flow.
    """
    # Filter to only keep sentences that actually contain a word/number.
    # We also strip leading dots/ellipses from sentences here to prevent " . Or was it" issues.
    sentences_raw = [s.strip() for s, _, _ in split_sentences(text)]
    sentences = []
    for s in sentences_raw:
        cleaned = s.lstrip(" .…!?,")
        if re.search(r'\w', cleaned):
            sentences.append(cleaned)
    
    if len(sentences) <= 1:
        return text

    new_sentences = []
    for i, curr in enumerate(sentences):
        # Count actual words (containing at least one alphanumeric)
        word_count = len([w for w in curr.split() if re.search(r'\w', w)])
        
        if word_count <= 2:
            if i < len(sentences) - 1:
                # Merge with NEXT (favored)
                # Convert terminal punctuation to semicolon to merge with next in rejoining phase
                new_sentences.append(curr.rstrip(".!?") + ";")
            elif new_sentences:
                # Last resort: merge with PREVIOUS
                prev = new_sentences.pop()
                # Clean up prev if it already ends in a semicolon from a forward merge
                # then merge with a semicolon
                new_sentences.append(prev.rstrip(".!?;") + "; " + curr)
            else:
                new_sentences.append(curr)
        else:
            new_sentences.append(curr)
        
    return " ".join(new_sentences)

def sanitize_for_xtts(text: str) -> str:
    """
    Advanced sanitization specifically tuned for Coqui XTTS v2.
    It builds on the base cleaning plus specific hallucination prevention.
    """
    # 1. Perform base TTS cleaning (includes bracket stripping and consolidation)
    text = clean_text_for_tts(text)

    # 2. Remove any remaining non-ASCII characters that might cause hallucinations
    text = re.sub(r'[^\x00-\x7F]+', '', text) 
    # Collapse multiple spaces (but preserve newlines) and trim
    text = re.sub(r'[^\S\r\n]+', ' ', text).strip()
    
    # 3. Ensure terminal punctuation (XTTS v2 can fail on short strings without it)
    # Use regex to check for end-of-sentence punctuation even if followed by quotes/parens
    if text and not re.search(r'[.!?]["\')\]\s]*$', text):
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
            connector = "" if line[0] in ",;:" else " "
            current_chunk += connector + line
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
