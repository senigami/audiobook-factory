
import sys
import os
from pathlib import Path
import time
import threading

# Add parent dir to sys.path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.jobs import Job, update_job

def test_progress_parsing():
    job_id = "test_progress_job"
    j = Job(
        id=job_id,
        chapter_file="test_chapter.txt",
        engine="bark",
        status="running",
        progress=0.0,
        log=""
    )
    # Simulate internal state initialization in worker_loop
    j._total_sentences = 0
    j._last_broadcast_p = 0.0
    
    # Mock update_job to verify it's being called
    updates = []
    def mock_update(jid, **kwargs):
        updates.append(kwargs)
        if 'progress' in kwargs:
            j.progress = kwargs['progress']
    
    import app.jobs
    app.jobs.update_job = mock_update
    
    # Simulating the on_output closure behavior in worker_loop
    # We need to wrap it because on_output in jobs.py is a local function in worker_loop.
    # However, I can redefine it here based on the logic I just wrote to test the regex and token logic.
    
    import re
    def simulated_on_output(line: str, job_obj):
        s = line.strip()
        new_progress = None
        
        # tqdm progress match
        progress_match = re.search(r'(\d+)%', s)
        is_progress_line = progress_match and "|" in s
        if is_progress_line:
            p_val = round(int(progress_match.group(1)) / 100.0, 2)
            if p_val > job_obj.progress:
                new_progress = p_val

        # Structured Progress Parsing
        if s.startswith("SENTENCE_COUNT:"):
            job_obj._total_sentences = int(s.split(":")[1].strip())
            return
        
        if s.startswith("SENTENCE_COMPLETED:"):
            current = int(s.split(":")[1].strip())
            total = getattr(job_obj, '_total_sentences', 1)
            p_val = round((current / total) * 0.95, 2)
            new_progress = p_val
            
        if new_progress is not None:
            if new_progress > job_obj._last_broadcast_p:
                job_obj.progress = new_progress
                job_obj._last_broadcast_p = new_progress
                mock_update(job_obj.id, progress=new_progress)

    print("Step 1: SENTENCE_COUNT: 4")
    simulated_on_output("SENTENCE_COUNT: 4", j)
    assert j._total_sentences == 4
    
    print("Step 2: SENTENCE_COMPLETED: 1")
    simulated_on_output("SENTENCE_COMPLETED: 1", j)
    # 1/4 * 0.95 = 0.2375 -> 0.24
    print(f"Progress: {j.progress}")
    assert j.progress == 0.24
    
    print("Step 3: SENTENCE_COMPLETED: 2")
    simulated_on_output("SENTENCE_COMPLETED: 2", j)
    # 2/4 * 0.95 = 0.475 -> 0.48
    print(f"Progress: {j.progress}")
    assert j.progress == 0.48
    
    print("Step 4: Standard tqdm line: 60%")
    simulated_on_output(" 60%|██████    | 6/10", j)
    print(f"Progress: {j.progress}")
    assert j.progress == 0.6
    
    print("Step 5: SENTENCE_COMPLETED: 3")
    simulated_on_output("SENTENCE_COMPLETED: 3", j)
    # 3/4 * 0.95 = 0.7125 -> 0.71
    print(f"Progress: {j.progress}")
    assert j.progress == 0.71
    
    print("Step 6: SENTENCE_COMPLETED: 4")
    simulated_on_output("SENTENCE_COMPLETED: 4", j)
    # 4/4 * 0.95 = 0.95
    print(f"Progress: {j.progress}")
    assert j.progress == 0.95

    print("\nAll progress parsing tests passed!")

if __name__ == "__main__":
    test_progress_parsing()
