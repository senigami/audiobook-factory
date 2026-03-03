# File Formats and Audio Guidance

Technical details to ensure your audiobook sounds professional.

## 📏 Character Limits

**Crucial**: The AI engine performs best with short text blocks.

- **Limit**: 500 characters per segment.
- **Auto-Fix**: The application will automatically split longer sentences at logical break points (commas, periods) during text analysis.
- **Warning**: Segments exceeding 500 characters may cause the generation to sound distorted or cut off.

## 🎵 Supported Formats

- **Input Text**: `.txt` (UTF-8) is recommended.
- **Input Audio**: `.wav`, `.mp3`, `.m4a`, `.ogg`, `.flac`. (.wav is preferred for cloning).
- **Internal Processing**: `.wav` (44.1kHz or 48kHz).
- **Final Output**: `.m4b` (AAC encoding, 64kbps default).

## 🎚️ Audio Quality Tips

- **Bitrate**: Final audiobooks are encoded at 64kbps Mono by default, which is standard for high-quality voice audio.
- **Normalization**: The system attempts to normalize loudness across chapters during the final **Assembly** process.

---

[[Home]] | [[Recording Guide]] | [[Concepts]]
