# Shared win celebration

One popup and one penguin image cover all five tiers. The image is the existing win pose, cell 6 (column 3, row 2) of `dist/assets/chicken/rig-atlas.png`, trimmed by the existing atlas loader. Replace this one pose to update every celebration; no tier-specific penguin assets are required. Labels, amounts, rays, confetti and motion are rendered independently.

| Tier | Multiplier | Accent |
| --- | --- | --- |
| Nice Win | 5–<10× | Mint |
| Big Win | 10–<25× | Ice blue |
| Mega Win | 25–<50× | Violet |
| Epic Win | 50–<100× | Pink violet |
| Legendary Win | ≥100× | Gold |

The popup opens after settlement. It shows the total returned amount (not net profit), counts up to the exact payout, and animates the existing penguin and title. Higher tiers increase count-up time and confetti density. The payout logic and round engine are unchanged.

Continue first completes an active count-up, then dismisses. Escape dismisses. Autoplay waits until the count-up plus a 1.8-second hold completes; Stop autoplay cancels continuation. Reduced motion shows the final amount immediately and removes animated effects. Focus is contained and background controls are inert while the popup is open.

Artist review: Game menu → Win celebration previews. All five previews use the pending stake but neither spend nor award credits. Previews stop autoplay and return to the preview picker on dismissal.

Verification: boundary tests at 4.99, 5, 9.99, 10, 24.99, 25, 49.99, 50, 99.99, 100 and above; all five presentations, exact payout completion, autoplay cancellation and reduced motion checked with a scripted DOM fixture. Math and round engine verified byte-identical to the prior revision. Browser rendering remains unverified in this environment.
