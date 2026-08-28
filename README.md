# PlantGuard

Plant disease detection that shows its work: identify one of 38 conditions
across 14 crops from a leaf photograph, estimate infection severity, and see
the exact regions that drove the decision — in a browser or on an Android
phone, entirely on-device.

```
training/   PyTorch pipeline -> ONNX + manifest
pc/         Next.js web app  (on-device inference, ONNX Runtime Web)
mobile/     Android app      (on-device inference, ONNX Runtime Android)
docs/       The contracts both clients implement
```

## The idea worth knowing about

Most "explainable" disease classifiers ship a heatmap that never touches the
model — a colour heuristic that highlights brown pixels and calls it attention.
This one derives the heatmap from the classifier's own arithmetic.

The architecture is constrained so that **Class Activation Mapping is exact**:

```
x -> backbone (global_pool='') -> S  [B, C, h, w]
  -> S.mean((2,3))             -> f  [B, C]
  -> Dropout -> Linear(W, b)   -> logits
```

Because the global-average-pool belongs to the model rather than to timm's
internal head, this is an algebraic identity:

```
logit_k - b_k  ==  mean over (i,j) of  sum_c W[k,c] * S[c,i,j]
                                       \______________________/
                                             CAM_k[i,j]
```

`CAM_k` is the exact per-location contribution to class `k`'s logit — and for a
GAP+Linear head it is *identical* to Grad-CAM, since the gradient weights reduce
to `W[k,c]/(h·w)`. No backward pass, no approximation.

So the exporter bakes the whole CAM cube into the ONNX graph as two extra
outputs, and every client gets genuine explanations for free:

| output | shape |
| --- | --- |
| `disease_logits` | `[B, 38]` |
| `severity_logits` | `[B, 4]` |
| `disease_cam` | `[B, 38, h, w]` |
| `severity_cam` | `[B, 4, h, w]` |

Selecting a runner-up in either app shows *that class's* evidence, because the
full cube is retained client-side.

The identity is asserted end-to-end in
`training/tests/test_export.py::test_cam_identity_survives_export`. **If it ever
fails, every heatmap in both apps is fiction** — treat it as a release blocker,
not a flaky test.

## Results

Trained on PlantVillage (38 classes, 54,305 images; 70/15/15 split), evaluated on
8,146 held-out test images:

| task | accuracy | macro F1 |
| --- | --- | --- |
| Disease (38 classes) | **96.96%** | 0.959 |
| Severity (4 levels) | 82.49% | 0.781 |

Backbone `mobilenetv4_conv_small`, 2.5M parameters, **9.7 MB** of fp32 ONNX,
~84 ms per image in a browser on CPU. Early stopping ended training at epoch 25
of 30; the run takes about 20 minutes on an RTX 4060.

Severity scores lower than disease by design — see the limitation below; the
labels it is scored against are themselves a colour heuristic.

## Quick start

### 1. Train and export

```bash
cd training
uv sync
uv run python main.py download          # PlantVillage from Kaggle (~2 GB)
uv run python main.py train             # two-phase, ~38 s/epoch on an RTX 4060
uv run python main.py evaluate          # metrics + confusion matrices + CAM samples
uv run python main.py export --verify   # ONNX + manifest, published to both apps
```

`uv run python main.py info` prints what exists on disk and what to run next.

To try the apps before a model is trained:

```bash
uv run python main.py export --demo
```

That publishes an untrained artifact flagged `trained: false`, which makes both
apps show a prominent "predictions are not meaningful" banner. Untrained output
is never presented as a diagnosis.

### 2. Web app

```bash
cd pc && npm run dev
```

### 3. Android app

Open `mobile/` in Android Studio and run, or:

```bash
cd mobile && ./gradlew installDebug
```

## Model size is a hard constraint

`mobilenetv5_300m.gemma3n` exports to **1.17 GB** of fp32 ONNX. That cannot load
in a browser and cannot ship in an APK. The default backbone is
`mobilenetv4_conv_small` at **~10 MB** — 121× smaller.

```bash
cd training && uv run python main.py backbones
```

| preset | params | fp32 ONNX | deployable to |
| --- | --- | --- | --- |
| `mobile` *(default)* | 3.8 M | ~10 MB | web, android, server |
| `balanced` | 5.3 M | ~21 MB | web, android, server |
| `large` | 9.7 M | ~39 MB | android, server |
| `server` | 300 M | ~1170 MB | server only |

Export enforces the budgets in [`docs/MODEL_CONTRACT.md`](docs/MODEL_CONTRACT.md)
(32 MB web, 48 MB Android) and **refuses to publish** an artifact that busts
them, rather than shipping something the browser cannot load.

## Nothing leaves the device

Both clients run the model locally — ONNX Runtime Web (WASM) in the browser,
ONNX Runtime Android on the phone. Photographs are never uploaded, and there is
no server component. The web app is cross-origin isolated so WASM can use
multiple threads.

## Known limitations

These are real and worth stating plainly:

- **Severity labels are synthetic.** PlantVillage has no human severity
  annotations, so `dataset.py` derives them by HSV colour segmentation: mask the
  leaf, measure the non-green fraction, bin into four levels. The severity head
  therefore learns to reproduce *a colour heuristic*, not ground-truth agronomic
  severity. Both apps say so on screen. Replace
  `estimate_severity_from_image` with real annotations before anyone acts on the
  number.
- **PlantVillage is laboratory imagery** — single leaves on uniform backgrounds.
  Accuracy on it does not transfer to a photograph taken in a field, with soil,
  sky, multiple leaves and uneven light.
- **Treatment advice is generic.** Product availability, dosage and regulations
  vary by region; the apps direct users to a local extension service.
- Disease classes cover 14 crops. Anything outside them will still be forced
  into one of the 38 labels, which is what the confidence figure and the
  runners-up list are there to expose.

## Contracts

Both clients read `model.json` rather than hardcoding class lists, input size or
normalisation, so re-exporting with a different backbone or label set needs no
code change.

- [`docs/MODEL_CONTRACT.md`](docs/MODEL_CONTRACT.md) — ONNX graph I/O, the CAM
  derivation, preprocessing, manifest schema, size budgets.
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — colour, type, spacing,
  motion and accessibility rules shared by the web and Android apps.

## Repository hygiene

Model artifacts (`*.onnx`, `*.pth`) and the dataset are generated, large, and
`.gitignore`d. They are reproduced by `main.py train` + `main.py export`, not
committed.

> **Note:** earlier commits added the 1.17 GB model five times over, so
> `.git` currently carries ~1.4 GB of history. New commits will not add more.
> Shrinking what is already there requires a history rewrite
> (`git filter-repo`), which force-pushes and breaks every existing clone — so
> it is deliberately left as your call.
