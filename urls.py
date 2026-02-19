# urls.py

BASE_URL = "https://readnovelfull.com" # Change this if the domain changes

# I've used a list comprehension here to prepend the domain to your list automatically
RAW_PATHS = [
    "chapter-2261-keeping-a-promise",
    "...",
    "chapter-2792-status-quo"
]

# This creates the full usable URLs for the script
CHAPTER_URLS = [f"{BASE_URL}/shadow-slave/{path}.html" for path in RAW_PATHS]
