# Huff n Puff Home Run 2

Static browser demo with official supplied pig, wolf, hard-hat and logo artwork. The October 18 official-art update is reconciled onto the latest Home Run version 10, retaining shared UI 0.1.62-preview, regional controls, replay/history, autoplay rules, audio and game mechanics.

Serve this directory with a static HTTP server. The root page opens `dist/`; the game entry is `dist/index.html` and the Outcomes browser is `dist/outcomes.html`.

## Validate and build

No dependency installation is required. With Node.js and Python 3:

```sh
node scripts/test-audio.cjs
node scripts/test-icicle.cjs
node scripts/test-reference-motion.cjs
python scripts/build-review-document.py
```

`dist/` is the complete static build. The Python command regenerates the self-contained Outcomes preview document. Tests cover audio, game maths/round settlement and reference animation. Browser visual/play verification is recorded separately by the publisher.

## GitHub Pages

Publish branch `main`, folder `/(root)`. `.nojekyll` is included. The repository root opens the game under `dist/`, and all dependencies are relative local files. Alternatively deploy the contents of `dist/` directly to any static host.

## Artwork and audio

Official character derivatives come from the supplied Huff n Puff Photoshop artwork. The raw Photoshop documents and raw asset packs are excluded. The linked Official Assets download contains the six extracted character/logo PNG derivatives and their provenance. Forest artwork, props, shared controls, fonts, animation and generated ElevenLabs audio are preserved. Asset approval for this repository is project-specific and does not grant a general license to redistribute other materials.

Service generation/session identifiers, internal design-file links, former Site configuration and original repository history are excluded from this publication copy. Audio file hashes and provider/model attribution remain in `dist/assets/audio/manifest.json`.
