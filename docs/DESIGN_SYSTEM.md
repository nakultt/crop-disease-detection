# PlantGuard Design System

Shared visual language for the web app (`pc/`) and the Android app (`mobile/`).
The two should feel like one product. Values below are the source of truth.

## Principles

1. **The photograph is the hero.** Chrome recedes; the leaf and its heatmap get
   the largest, brightest surface on screen.
2. **Confidence is always visible.** No prediction is ever shown without its
   probability. A 34% guess must not look like a 99% one.
3. **Severity is encoded twice** — colour *and* position/label — so it survives
   colour-blindness and greyscale printing.
4. **Light and dark are equals.** Neither is an afterthought; both are designed.
5. **Motion is informative, never decorative.** Every animation communicates
   state change or spatial relationship, and every one is disabled under
   `prefers-reduced-motion`.

## Colour

Semantic tokens. Never use a raw hex in a component.

### Light

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#f6f8f6` | Page ground |
| `--surface` | `#ffffff` | Cards, panels |
| `--surface-2` | `#eef2ee` | Insets, track backgrounds |
| `--surface-3` | `#e2e9e3` | Hover on `surface-2` |
| `--border` | `#d6ded8` | Hairlines |
| `--border-strong` | `#b6c3ba` | Focused / emphasised edges |
| `--text` | `#111b15` | Primary copy |
| `--text-2` | `#4a5a50` | Secondary copy |
| `--text-3` | `#71857a` | Captions, metadata |
| `--accent` | `#12805c` | Primary actions, links |
| `--accent-hover` | `#0d6b4d` | Primary action hover |
| `--accent-soft` | `#e3f3ec` | Accent-tinted fills |
| `--accent-on` | `#ffffff` | Text on `--accent` |

### Dark

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#0b0f0d` | Page ground |
| `--surface` | `#141a17` | Cards, panels |
| `--surface-2` | `#1c2420` | Insets, track backgrounds |
| `--surface-3` | `#26302a` | Hover on `surface-2` |
| `--border` | `#26302a` | Hairlines |
| `--border-strong` | `#3a4741` | Focused / emphasised edges |
| `--text` | `#e8efe9` | Primary copy |
| `--text-2` | `#a5b5ab` | Secondary copy |
| `--text-3` | `#7d8f85` | Captions, metadata |
| `--accent` | `#3ddc97` | Primary actions, links |
| `--accent-hover` | `#5ee5ab` | Primary action hover |
| `--accent-soft` | `#12312a` | Accent-tinted fills |
| `--accent-on` | `#04150e` | Text on `--accent` |

### Severity scale (identical in both themes, AA-checked on `--surface`)

| Level | Light | Dark | Meaning |
| --- | --- | --- | --- |
| Mild | `#2f8f4e` | `#4ade80` | 0-25% tissue affected |
| Moderate | `#b3810a` | `#fbbf24` | 26-50% |
| Severe | `#c2570d` | `#fb923c` | 51-75% |
| Critical | `#c0322b` | `#f87171` | 76-100% |

Severity must ALWAYS carry its text label alongside the colour.

### Status

`--ok` = severity Mild. `--warn` = severity Moderate. `--danger` = severity Critical.

## Type

- **Family:** `Inter var` (web, via `next/font`), system fallback
  `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
  Android uses the platform default (Roboto / device sans).
- **Numerals:** tabular (`font-variant-numeric: tabular-nums`) for every
  percentage, confidence and metric so digits do not jitter as values animate.
- **Mono:** `"JetBrains Mono", ui-monospace, SFMono-Regular, monospace` for
  class ids and technical metadata only.

| Role | Size / line-height | Weight | Tracking |
| --- | --- | --- | --- |
| Display | 40/44 (28/32 on mobile) | 680 | -0.02em |
| Title | 24/30 | 640 | -0.015em |
| Heading | 17/24 | 620 | -0.01em |
| Body | 15/23 | 440 | 0 |
| Small | 13/19 | 460 | 0 |
| Label | 11/14 | 620 | 0.08em, uppercase |

## Space & shape

- Spacing scale (px): `2 4 6 8 12 16 20 24 32 40 56 72`. Nothing off-scale.
- Radii: `sm 8`, `md 12`, `lg 16`, `xl 22`, `full 9999`.
- Card padding: 20px (mobile 16px).
- Content max width: 1180px; single-column reading blocks cap at 68ch.

## Elevation

Shadows are soft and low-contrast; dark theme leans on borders instead of shadow.

- `--shadow-1`: `0 1px 2px rgba(16,32,24,.06), 0 1px 1px rgba(16,32,24,.04)`
- `--shadow-2`: `0 4px 16px rgba(16,32,24,.08), 0 1px 3px rgba(16,32,24,.05)`
- `--shadow-3`: `0 12px 40px rgba(16,32,24,.12), 0 2px 8px rgba(16,32,24,.06)`

## Motion

| Token | Duration | Easing | Use |
| --- | --- | --- | --- |
| `--ease-out` | 180ms | `cubic-bezier(.2,.8,.2,1)` | Enter, hover |
| `--ease-in-out` | 240ms | `cubic-bezier(.4,0,.2,1)` | Layout shifts |
| `--ease-spring` | 420ms | `cubic-bezier(.34,1.32,.64,1)` | Gauge needle, bars |

Under `prefers-reduced-motion: reduce`, all durations collapse to 0.01ms and
transforms are removed — the end state must be correct without any animation.

## Heatmap colormaps

JET is perceptually non-uniform and misleading. Ship these instead, user-switchable:

- **Inferno** (default) — perceptually uniform, reads in both themes, colour-blind safe.
- **Viridis** — uniform, colour-blind safe.
- **Magma** — uniform, lower-contrast alternative.

Each is a 256-entry lookup table shared between web and Android.

## Accessibility (non-negotiable)

- Contrast: >= 4.5:1 for body text, >= 3:1 for large text and UI boundaries.
- Every interactive element has a visible focus ring:
  `2px solid var(--accent)` with a `2px` offset. Never `outline: none` alone.
- Full keyboard path through upload -> analyse -> inspect -> reset.
- Hit targets >= 44x44px.
- All imagery has meaningful `alt`; the heatmap canvas carries an `aria-label`
  describing the highlighted region in words.
- Live results announce via `aria-live="polite"`.
- Never use colour alone to convey severity, confidence or status.

## Component inventory (both platforms)

`AppShell` (header + theme toggle + model badge) · `Dropzone` (drag / browse /
camera / paste / sample) · `AnalysisCard` (image + heatmap overlay + opacity +
colormap + side-by-side toggle) · `DiagnosisCard` (top-1 + top-5 bars) ·
`SeverityGauge` (SVG arc + needle + label) · `RecommendationList` ·
`ModelStatus` (download progress, demo banner, backend badge) ·
`HistoryStrip` (past analyses) · `EmptyState` · `ErrorState`.
