# Concepts

Understanding how Audiobook Studio organizes data is key to a smooth workflow.

## 🏗️ Hierarchy

- **Library**: The collection of all your projects.
- **Project**: Represents a single audiobook or collection. Contains metadata (Author, Series, Cover).
- **Chapter**: A logical division of a project. Contains the text and its generated audio.
- **Segment**: A single sentence or paragraph within a chapter. This is the smallest unit of generation.
- **Character**: A persona assigned to segments. Chapters are narrated by a "Narrator" by default, but you can assign specific "Characters" to dialogue.

## 🎙️ AI Voice Lab

- **Voice Profile**: A cloned voice based on short audio samples.
- **Speaker**: A higher-level grouping for Voice Profiles, allowing multiple "variants" (e.g., "Main - Calm", "Main - Shouting") under one identity.
- **Sample**: A 6–10 second `.wav` file used to train a Voice Profile.

## 🔄 Generation Workflow

1. **Analysis**: The system scans your text for long sentences (over 500 characters) and automatically splits them to ensure high-quality TTS.
2. **Queuing**: When you click "Generate", segments are added to a background queue.
3. **Synthesis**: The Coqui XTTS engine processes segments one by one.
4. **Baking**: After all segments in a chapter are generated, they are "stitched" together into a single master audio file for that chapter.
5. **Assembly**: Finally, all chapter audio files are bundled into a standard `.m4b` audiobook format with chapters and metadata.

---

[[Home]] | [[Library and Projects]] | [[Voices and Voice Profiles]]
