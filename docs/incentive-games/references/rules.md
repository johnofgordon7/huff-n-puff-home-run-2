# IG controls and layout rules — 1.0.0

Authority: John Gordon approved the linked Figma controls/header/layout as the standard for all new and existing Incentive Games games on 2026-09-19. The package captures that approved baseline. Subsequent Figma edits are not automatically approved revisions: refresh the package when asked to adopt them.

## Layout contract

1. Use a single game surface that fills the available game viewport. Header/status strip stays at the top; bet/last-win summary stays at the bottom. Game artwork fills the intervening region; balance/utilities sit at its top and the controller at its bottom.
2. Disable horizontal and vertical page scrolling. Use the real viewport or embedded container height, including dynamic mobile viewport and safe areas. Do not hardcode a 390×844 page or blindly scale a whole desktop scene.
3. Reserve space for UI so game-critical content remains visible. Keep overlays and animations from increasing document dimensions. Avoid unused outer margins, desktop-width phone frames, unnecessary cards or explanatory panels.
4. Centre the main action on the game viewport, not on the aggregate width of the visible controls. Equal left/right layout tracks or explicit centred anchoring must preserve this when bonus/turbo/autoplay/difficulty controls vary.
5. Let the game region resize. Keep control typography and touch targets legible. The compact source demonstrates a 70px main button and 44px-high side controls at 320px width; use it when the regular 100px/50px arrangement cannot fit.
6. Mock OS status bars, browser chrome and operator site screenshots are reference context, not universal UI. Do not render fake battery/signal/time bars. The game's own clock/session values are separate.

## Component contract

| Component | Standard |
|---|---|
| Game status strip | Game name, clock/session duration and session result; compact Inter text; 20px reference component, excluding real device safe area |
| Balance panel | Upper left, balance with optional free bets; dark translucent panel, rounded corners, compact labels and stronger values |
| Utilities | Information and menu upper right; 44px reference targets with exact source glyphs |
| Play/action | Central dominant circular button, 100px regular / 70px compact; supplied SVG is the regular play state; preserve geometry when representing relevant gameplay actions |
| Stake control | Left of play; label and current stake, approved indented inner edge and paired chevrons; regular reference 129×46px |
| Stake progress | Thin purple value indicator below the stake control; derive from configured stake range, not a fixed screenshot length |
| Secondary actions | Turbo/autoplay to the right when supported; 50px regular buttons, 24px glyphs, 14px reference gap |
| Stake popup | Overlay anchored to stake control, nominal width 290px and height 256px; 3-column grid, internal vertical scroll, active/selected/focus states; constrain to available space |
| Result footer | Bet at left, last win at right; 32px desktop reference; mobile reference reserves more bottom space including safe-area context |
| Bonus/difficulty/autoplay | Use the corresponding named source variant; do not invent a different control language |

Amounts, game name, clock, session time, balance, free bets and last win are data. Do not hardcode screenshot values into production logic. The screenshot's differing selected/bet/footer amounts illustrate states, not a rule to desynchronise the UI.

## Visual contract

- Use Inter for the shared game chrome; preserve the game's own approved title/art typography separately. Obtain the real font from approved project assets when available; do not claim font-perfect matching with a fallback.
- Reuse the semantic colours in `tokens.json`. Standard surfaces are dark navy/translucent, primary text white, supporting text grey, purple accents and turquoise positive/selection accents.
- Preserve exported vector bytes. Use transparent components over game artwork; the blue visible through them in the screenshot is not the button fill colour.
- Use the source reference sizes as component measurements. A Figma frame's transforms can rotate its coordinate system; the desktop screenshot is 1194×834 even though raw local dimensions can report 834×1194. Do not copy those raw absolute coordinates into web layout.
- Change artwork, game scene, effects and mechanics per title. Keep standard controls consistent unless the user explicitly requests an exception. Do not attach slot-only geometry or effects to unrelated game families.

## Interaction contract

Use real buttons, labels and focus states. Support keyboard and touch. Confine scroll gestures to the stake grid or open dialog body without moving the game page. Keep overlays inside the available viewport, dismiss on Escape/outside action where appropriate, and restore focus to the trigger. On compact devices enlarge selectable hit regions as needed without creating overlapping targets.

Wire UI to the game's state: prevent duplicate plays, disable stake/difficulty changes while an accepted bet is active when appropriate, distinguish idle/running/result/error, and support autoplay stop. Preserve real cash-out/stop semantics for crash and tower games. Do not add nonfunctional controls or guess game rules merely because a reference shows an icon.

Operator restrictions and available features come from actual configuration. Existing restricted variants must remain restricted. Do not automatically activate autoplay, turbo, bonus buying or cash-out for every game.
