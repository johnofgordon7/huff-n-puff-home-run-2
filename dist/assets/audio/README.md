# Huff n Puff Home Run audio

Original music and sound effects generated with the connected ElevenLabs plugin on 2026-10-12. Provenance, generation IDs, processing and file hashes are recorded in `manifest.json`.

`music.mp3` is a playful instrumental forest baseball score, mastered to -18 LUFS and processed with an 80 ms circular overlap for a smooth loop. The soundtrack starts after the first player interaction and continues at a low level behind game cues.

One-shot cues: `bat-hit.mp3`, `miss.mp3`, `bounce.mp3`, `collect.mp3`, `hazard.mp3`, `record.mp3`, `splash.mp3`, `bird.mp3`. Multiplier pickups use a brighter playback rate. Wind and slide use the generated `wind.mp3` and `slide.mp3` loops, with gain and playback rate responding to movement.

The menu's Sound control mutes the full mix. Music has its own saved toggle. Background tabs and the isolated Outcomes review are silent. Music dips under reward fanfares. Reused decoded buffers keep impacts immediate and prevent overlapping music tracks. Synthesized one-shot fallbacks are used only while an asset is unavailable; no delayed event is replayed when loading finishes.
