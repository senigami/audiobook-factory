import cloudscraper
from bs4 import BeautifulSoup
import os
import time
import random
from urls import RAW_PATHS, CHAPTER_URLS

def throttled_summarizer(names, urls, content_id):
    output_dir = "shadow_slave_summaries"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    scraper = cloudscraper.create_scraper(
        browser={'browser': 'chrome', 'platform': 'darwin', 'desktop': True}
    )

    for i, (name, url) in enumerate(zip(names, urls)):
        file_path = os.path.join(output_dir, f"{name}.txt")

        if os.path.exists(file_path):
            print(f"[{i+1}/{len(urls)}] Skipping: {name}")
            continue

        for attempt in range(3):
            try:
                print(f"[{i+1}/{len(urls)}] Requesting: {url}")
                response = scraper.get(url, timeout=20)
                
                if response.status_code == 404:
                    print(f"   ! 404 Error: Check URL structure.")
                    break 
                
                response.raise_for_status()
                soup = BeautifulSoup(response.text, 'html.parser')
                content_element = soup.find(id=content_id)
                
                if not content_element:
                    print(f"   ! ID '{content_id}' not found.")
                    break

                for unwanted in content_element.find_all(['script', 'style', 'ins', 'iframe']):
                    unwanted.decompose()

                # --- NEW FORMATTING LOGIC ---
                # 1. Extract the raw text with a single newline separator
                raw_text = content_element.get_text(separator='\n', strip=True)

                # 2. Split by lines, find the first line (the title), and add the return
                lines = raw_text.split('\n')
                if len(lines) > 1:
                    # Joins the title, adds two newlines, then joins the rest of the body
                    formatted_text = lines[0] + "\n\n" + "\n".join(lines[1:])
                else:
                    formatted_text = raw_text

                # 3. Save the formatted text
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(formatted_text)
                
                print(f"   ✓ Saved {name} (Formatted)")
                time.sleep(random.uniform(5.0, 8.0))
                break 

            except Exception as e:
                print(f"   ! Attempt {attempt + 1} failed: {e}")
                time.sleep(10)

if __name__ == "__main__":
    TARGET_ID = "chr-content" 
    throttled_summarizer(RAW_PATHS, CHAPTER_URLS, TARGET_ID)