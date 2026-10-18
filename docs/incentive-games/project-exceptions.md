# Implementation notes — IG 1.0.0

Applied standard shell, exact exported SVG controls, symmetric controller tracks, three-column internally scrolling stake overlay, persistent header/footer and compact controls.

No user-approved deviations. Inter is bundled locally from Google Fonts. No runtime remote font dependency was introduced. The game clock and session duration are separate live values.

2026-10-12 portable local browser checks passed at 320×568, 375×812, 390×844, 430×932, 844×390 and 1194×834: no page overflow and the Play button is centered at every size. Music toggling and saved preference persistence were checked in the menu. The ElevenLabs audio update preserves the IG 1.0.0 shell, with Sound and Music in the existing menu and no layout deviation. Audio lifecycle and event checks pass the new audio regression suite; existing math and round regressions also pass.
