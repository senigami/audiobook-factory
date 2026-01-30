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

def safe_filename(s: str, max_len: int = 80) -> str:
    s = re.sub(r"[^\w\s\-:]", "", s).strip()
    return s.replace(" ", "_")[:max_len]

def write_chapters_to_folder(chapters, out_dir: Path) -> List[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for chap_num, heading, body in chapters:
        fname = out_dir / f"chapter_{chap_num:04}_{safe_filename(heading)}.txt"
        fname.write_text(body + "\n", encoding="utf-8")
        written.append(fname)
    return written

def split_sentences(text: str):
    for m in SENT_SPLIT_RE.finditer(text):
        s = m.group(1).strip()
        if s:
            yield s, m.start(1), m.end(1)

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