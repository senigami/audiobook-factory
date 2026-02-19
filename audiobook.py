# NOTE: This is a standalone reference script for creating audiobooks.
# The main application uses app/engines.py instead of this file.
import os
import re
import subprocess

def get_duration(file_path):
    """Uses ffprobe to get the duration of an audio file in seconds."""
    cmd = [
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', file_path
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return float(result.stdout)

def create_audiobook(input_folder, book_title):
    # 1. Gather and sort files
    files = [f for f in os.listdir(input_folder) if f.endswith(('.wav', '.mp3'))]
    def extract_number(filename):
        match = re.search(r'(\d+)', filename)
        return int(match.group(1)) if match else 0
    files.sort(key=extract_number)

    if not files:
        print("No audio files found.")
        return

    # 2. Build the Metadata file and the file list for FFmpeg
    metadata = ";FFMETADATA1\n"
    metadata += f"title={book_title}\n\n"

    list_file_path = "files.txt"
    current_offset = 0

    with open(list_file_path, 'w') as list_f:
        for file in files:
            file_path = os.path.join(input_folder, file)
            duration = get_duration(file_path)

            # Add to list for concatenation
            list_f.write(f"file '{file_path}'\n")

            # Add to metadata chapters (timestamps are in nanoseconds: sec * 1000)
            start_ms = int(current_offset * 1000)
            end_ms = int((current_offset + duration) * 1000)

            metadata += "[CHAPTER]\nTIMEBASE=1/1000\n"
            metadata += f"START={start_ms}\n"
            metadata += f"END={end_ms}\n"
            metadata += f"title=Chapter {extract_number(file)}\n\n"

            current_offset += duration

    with open("metadata.txt", "w") as meta_f:
        meta_f.write(metadata)

    # 3. Concatenate and Encode to M4B (using AAC codec)
    output_filename = f"{book_title}.m4b"
    print(f"Generating {output_filename}...")

    # Step A: Merge files and inject metadata
    # -f concat: joins files
    # -i metadata.txt: adds the chapters
    # -c:a aac: encodes to high-quality AAC (standard for M4B)
    cmd = [
        'ffmpeg', '-f', 'concat', '-safe', '0', '-i', list_file_path,
        '-i', 'metadata.txt', '-map_metadata', '1',
        '-c:a', 'aac', '-b:a', '32k', '-ac', '1', '-movflags', '+faststart',
        output_filename, '-y'
    ]

    subprocess.run(cmd)

    # Cleanup temporary files
    os.remove(list_file_path)
    os.remove("metadata.txt")
    print(f"\nSuccess! Created {output_filename} with chapter markers.")

if __name__ == "__main__":
    # Point this to your folder of audio files
    create_audiobook(input_folder="to_combine", book_title="Shadow Slave Vol 1")
