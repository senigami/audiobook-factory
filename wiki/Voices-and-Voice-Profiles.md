# Voices and Voice Profiles

The **AI Voice Lab** is the standard for managing your narrator library. It uses a unified **Voice** and **Variant** model to keep your workspace organized and efficient.

## 🎙️ Core Concepts

- **Voice**: A high-level narrator identity (e.g., "Narrator", "Dracula").
- **Variants**: Stylistic or emotional variations of that same voice (e.g., "Normal", "Angry", "Whisper").
- **Samples**: The reference audio files used to "clone" the voice.

Each **Voice** always has at least one variant (usually the "Default" variant). You can add as many variants as you need to capture different performances.

## 🚀 Creating and Managing Voices

1. **New Voice**: Click **+ New Voice** at the top. Give it a name like "Victor the Vampire".
2. **Expansion**: The list uses an **Accordion** layout. Opening one voice card automatically collapses others to keep your view clean.
3. **Add Samples**: Drop 3–5 high-quality `.wav` files into the **Samples** section.
   - _Note_: For new variants with no samples, this section auto-expands so you can get to work immediately.
4. **Build**: Click **Build Voice**. Once built, the Samples section auto-collapses to provide a cleaner view of the performance controls.
5. **Add Variants**: Use the **+ Variant** button inside the expanded voice card to create a new stylistic companion for that voice.

## 🗣️ UI & Navigation

- **Mini Expansion Chevron**: Located in the bottom-right of the Voice avatar. It rotates to show expansion state.
- **Update Indicator**: A tiny rotating arrow in the top-left of the avatar indicates if a variant needs samples or a rebuild.
- **Variant Tabs**: Switch between different styles easily. Selecting a tab in a collapsed card will intelligently auto-expand it.
- **Kebab Menu**: Access the **Delete Voice** action from the top-right of the card. This will remove the speaker and cascade deletion to all variant folders and samples on disk.

## ⚙️ Performance Tuning

- **Playback Speed**: Adjust the default speaking rate (0.5x to 2.0x) using the pill-style popover.
- **Edit Script**: Customize the preview text. Testing a voice generates a private preview clip for that specific variant.
- **Build Progress**: Real-time progress indicators show you exactly where the voice is in the cloning process.

---

[[Home]] | [[Recording Guide]] | [[Concepts]]
