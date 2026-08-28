# PlantGuard — web app

Next.js 16 + React 19. Runs the disease model entirely in the browser via ONNX
Runtime Web; leaf photographs never leave the device.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 56 unit tests
npm run lint       # biome check
```

The app needs a model in `public/models/`. Produce one from `training/`:

```bash
cd ../training && uv run python main.py export --demo
```

Without it the page renders a setup message naming the exact command — it does
not crash, and the upload control is disabled and removed from the tab order.

## How it works

```
model.json  ──▶ manifest.ts   validate, then drive everything from it
model.onnx  ──▶ inference.ts  streaming download ──▶ ORT session ──▶ predict()
                     │
                     ├─ logits ──▶ DiagnosisCard, SeverityGauge
                     └─ CAM cube ─▶ cam.ts ──▶ HeatmapViewer
```

**Nothing is hardcoded.** Class lists, input size, normalisation constants and
output names all come from `model.json`, so re-exporting with a different
backbone or label set needs no code change here. A malformed manifest fails
loudly rather than silently shifting every logit.

### The heatmap is real

The ONNX graph emits a class activation cube (`[1, 38, h, w]`) alongside its
logits, so the heatmap is derived from the model's own arithmetic rather than
from colour heuristics applied to the photo. See the derivation in
[`../docs/MODEL_CONTRACT.md`](../docs/MODEL_CONTRACT.md).

The **whole cube** is retained client-side (~10 KB), so selecting a runner-up in
the candidates list shows *that class's* evidence without re-running the model.
Showing the winner's map for every selection would quietly make the explanation
a lie.

Colormaps are Inferno, Viridis and Magma — all perceptually uniform. JET is
deliberately absent: its bands invent edges that read as structure in the data.

## Layout

| path | role |
| --- | --- |
| `lib/manifest.ts` | Manifest types, validation, class-name formatting |
| `lib/inference.ts` | ORT session, streaming load, preprocessing, `predict()` |
| `lib/cam.ts` | Normalise, bilinear upscale, colormaps, compositing |
| `lib/recommendations.ts` | Treatment table (mirrored in the Android app) |
| `components/HeatmapViewer.tsx` | Overlay / side-by-side, opacity, colormap |
| `components/DiagnosisCard.tsx` | Top-1 + candidates, confidence warnings |
| `components/SeverityGauge.tsx` | SVG dial + per-level distribution |
| `components/ModelStatus.tsx` | Provenance, download progress, demo banner |

## Notes worth knowing

- **Cross-origin isolation.** `next.config.ts` sends COOP/COEP over the whole
  document so `SharedArrayBuffer` is available and WASM can use 4 threads.
  `inference.ts` reads `crossOriginIsolated` at runtime and falls back to a
  single thread where it doesn't take effect. This is only safe because every
  asset is same-origin — adding a third-party script, font or image will need a
  `crossorigin` attribute and CORP headers on the remote host.
- **Preprocessing matches training**: short-side resize then centre-crop.
  Squashing a non-square photo into a square distorts leaf geometry and
  measurably shifts predictions.
- **Confidence needs margin.** A result is only presented as confident when
  top-1 ≥ 85% *and* it leads the runner-up by ≥ 30 points. 55% against a 45%
  runner-up is a coin toss, not a diagnosis.
- **Untrained models are labelled.** When `model.json` says `trained: false`,
  a banner states predictions are not meaningful and the treatment panel says
  it is shown for completeness only.
- **Accessibility** is a requirement, not a pass: full keyboard path, visible
  focus rings, `prefers-reduced-motion` honoured, severity encoded by label as
  well as colour, and the heatmap canvas carries an `aria-label` describing
  the highlighted region in words.

## Tests

`npm test` covers the CAM maths (ReLU + normalise, bilinear upscale, colormap
LUTs, hotspot description) and manifest validation — the same properties
`training/tests/` pins on the export side.
