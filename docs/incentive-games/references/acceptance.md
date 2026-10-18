# Acceptance criteria

Validate the affected game in an available browser, using the host project's existing tools. Do not install a new testing stack solely for a small edit. If browser access is unavailable, state what remains unverified.

## Viewports

Use 320×568, 375×812, 390×844 and 430×932 for portrait, 844×390 for landscape and 1194×834 or the actual desktop target. Also test the real embedded container where applicable. These are practical QA sizes; only 320×568, 390×844 and rendered 1194×834 are retained canonical references.

## Layout

- Confirm document scrollWidth <= clientWidth + 1 and scrollHeight <= clientHeight + 1. Attempt page scrolling/touch gestures and verify it does not move. Measure the embedded game separately when hosted inside a scrollable operator page.
- Check the centre of the main action against the game viewport centre (within 1 CSS px on an unscaled page). Repeat with optional controls removed and with popup open.
- Check header, HUD, controller and footer visibility; no clipped labels/amounts, overlap, inaccessible actions, unintended margins or covered game-critical content.
- Confirm safe-area and viewport changes do not hide the bottom controls. Test open popup, keyboard, long amounts and loading/result states.
- Compare chrome visually to the bundled mobile/desktop/stake-picker references. Exclude sample artwork and device/operator framing from the comparison.

## Behaviour

- Stake opens the correct scrollable 3-column grid. Touch/wheel scrolling changes its scroll position without page scrolling. Selection updates the pending stake and value indicator and remains in view.
- Keyboard focus, Escape and focus return work; controls have accessible names and disabled states.
- Play is guarded against duplicate activation. Stake changes respect game state. Cash-out and stop retain the game's existing semantics.
- Supported turbo/autoplay/bonus/difficulty controls work; unsupported features stay unavailable. Autoplay has an accessible stop action.
- Balance, stake, last win and session values are supplied by the game, format correctly and are not copied from screenshots.
- A migrated game still loads, plays and settles under its existing rules; rerun relevant existing regression checks.

Record real results, the design-system version and any explicit user-approved exception. A screenshot alone does not prove that the game cannot scroll or that controls work.
