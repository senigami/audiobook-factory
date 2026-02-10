import os
import re

def merge_files(input_folder):
    # 1. Get all .txt files
    # Ensure they are files (not directories) and match the extension
    files = [f for f in os.listdir(input_folder) 
             if f.endswith('.txt') and os.path.isfile(os.path.join(input_folder, f))]
    
    if not files:
        # If no .txt files, check for subfolders
        subfolders = [d for d in os.listdir(input_folder) 
                      if os.path.isdir(os.path.join(input_folder, d))]
        
        if subfolders:
            print(f"No .txt files found in '{input_folder}'. Found {len(subfolders)} subfolders. Processing each...")
            for sub in sorted(subfolders):
                sub_path = os.path.join(input_folder, sub)
                print(f"\n>>> Processing subfolder: {sub}")
                merge_files(sub_path)
            return
        else:
            print(f"No .txt files or subfolders found in '{input_folder}'.")
            return

    # 2. Precision Extraction for chapter_XXXX.txt
    def extract_number(filename):
        # Specifically looks for digits after an underscore or hyphen
        match = re.search(r'(\d+)', filename)
        return int(match.group(1)) if match else 0

    # Sort files numerically so 1894 comes before 1895
    files.sort(key=extract_number)

    # 3. Handle naming
    first_num = extract_number(files[0])
    last_num = extract_number(files[-1])
    output_filename = f"Chapter {first_num} - {last_num}.txt"

    print(f"--- Combining {len(files)} files ---")

    combined_content = []
    total_word_count = 0

    for file in files:
        file_path = os.path.join(input_folder, file)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    # Update word count
                    total_word_count += len(content.split())
                    combined_content.append(content)
        except Exception as e:
            print(f"   ! Error reading {file}: {e}")

    # 4. Join with 3 blank lines (4 newlines)
    # This provides the visual separation you wanted
    final_text = "\n\n\n\n\n".join(combined_content)

    # 5. Save the file
    with open(output_filename, 'w', encoding='utf-8') as f:
        f.write(final_text)

    print(f"Success! Created: {output_filename}")
    print(f"Total Words: {total_word_count:,}")

if __name__ == "__main__":
    target_folder = "to_combine" 
    
    if not os.path.exists(target_folder):
        os.makedirs(target_folder)
        print(f"Folder '{target_folder}' created. Move your files there and run again.")
    else:
        merge_files(target_folder)