# Animation direction — 2026-10-12

Motion reference: user-supplied `export-win.mp4` (12.07 seconds) and `export-lose.mp4` (7.87 seconds), both 1080×1920 at 30 fps. The clips are rough penguin/batter animatics. Their timing and staging guide the existing wolf and three baseball pigs; the game keeps its current forest artwork and controls.

## Shared launch and flight

The batter anticipates with a wider, lower stance and raised bat before a quick swing and planted follow-through. The tossed character rises, hangs briefly and falls into contact. Bat contact compresses the body, then stretches it forward. Positive pickups produce a readable upward turn, with the head and feet following the body. Bird contact causes a forward tumble over about 0.45 seconds; the character then recovers into its flight direction. Feedback color follows the most recent contact.

## Safe landing

The winning reference reaches the ground around 6.4 seconds. The character flattens into a low belly slide, then tucks and pushes up into an upright celebration around 9.0–10.0 seconds. The game adapts this into a short recovery after the existing physical slide ends, before showing the win celebration. Financial settlement remains separate from that visual hold.

## Pond loss

The losing reference enters the water nose-first around 6.4 seconds, curls and flattens briefly, and disappears. A crown-shaped splash peaks roughly 0.2–0.3 seconds after contact, dissolves into droplets and ripples, and leaves empty water for the final loss beat. The game follows this staging rather than leaving the pig bobbing above the settled pond.

## Scope and validation

Motion is relative to the game's actual event times; the clips' complete running times are not imposed on variable game routes. Presentation offsets, body rotation, squash and recovery must not change the physical route, collisions, outcome weights or exact-cent settlement. Reduced motion uses a direct static end pose and omits the roll, hop and splash movement. Normal, 2× and 3× playback remain supported.

The original clips and extracted reference frames are local study material. They are not included in the public site.

Validation passed: motion and full round/frame/render integration checks, existing math/physics and audio suites, grounded pose and score-caption clearance for all three pig styles, 1×/2×/3× reveal timing, preview isolation, and reduced-motion end states. Fresh browser captures verified the win recovery and pond ending at 390×844 with no runtime warnings. Layout checks at 320×568, 375×812, 390×844, 430×932, 844×390 and 1194×834 found no page overflow and a centered Play button.

The entry and review pages request a versioned game script so cached older animations cannot mask the update. The isolated Outcomes bundle is regenerated from the same source.
