# Replacement guide

The win character is the sixth cell of assets/chicken/rig-atlas.png (3 columns × 2 rows), extracted at runtime. One image is shared by every win tier. Preserve transparent padding and silhouette. Count-up, title entrance, rays, confetti and character motion live in ig-shell.css and game.js; they are editable code, not baked into the character.

The main scene uses horizon.png, johnny-sheet.png and objects.png; keep existing atlas cell contracts in ASSET-MANIFEST.json. Audio is synthesized in game.js. Core Flow Testing uses the same runtime and presentation in a sandboxed fixture document. Review-specific recovery/tutorial panels are built from the shared modal component.

Every screen and flow maps to its stable ID in journey-manifest.json. Buttons in core-flow.js send these IDs to the isolated adapter in game.js. Recovery panels are simulated only. Browser captures remain outstanding.
