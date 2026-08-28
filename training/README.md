# Training pipeline

Multi-task plant disease detection: one backbone, two heads (38-way disease,
4-way severity), exported to ONNX with **class activation maps baked into the
graph** so the web and Android apps can explain a prediction without running a
backward pass.

```bash
uv sync                                   # install
uv run python main.py download            # fetch PlantVillage (~2 GB, Kaggle)
uv run python main.py train               # two-phase training
uv run python main.py evaluate            # metrics, confusion matrices, CAM samples
uv run python main.py export --verify     # ONNX + manifest -> both apps
```

`uv run python main.py info` prints what exists on disk and what to run next.

## Why the heatmaps are real

The architecture is deliberately constrained:

```
x -> backbone (global_pool='') -> S  [B, C, h, w]
  -> S.mean((2,3))             -> f  [B, C]
  -> Dropout -> Linear(W, b)   -> logits
```

Because the global-average-pool belongs to *this* module rather than to timm's
internal head, the following is an algebraic identity, not an approximation:

```
logit_k - b_k  ==  mean over (i,j) of  sum_c W[k,c] * S[c,i,j]
                                       \______________________/
                                              CAM_k[i,j]
```

`CAM_k` is the exact per-location contribution to class `k`'s logit, and for a
GAP+Linear head it is *identical* to Grad-CAM — the gradient weights reduce to
`W[k,c]/(h·w)`. So the exporter emits the CAM cube as two extra ONNX outputs and
every client gets genuine, model-derived explanations for free.

`tests/test_model.py::test_cam_identity_holds` and
`tests/test_export.py::test_cam_identity_survives_export` assert this end to end.
**If either fails, the heatmaps in the apps are fiction — treat it as a release
blocker.**

Two constraints follow, and both are load-bearing:

- The backbone must be created with `global_pool=''`.
- Each head must stay a single `Linear` on pooled features, with dropout
  *before* it. Adding a hidden layer breaks the identity.

## Picking a backbone

```bash
uv run python main.py backbones
```

| preset | params | fp32 ONNX | deployable to |
| --- | --- | --- | --- |
| `mobile` *(default)* | 3.8 M | ~10 MB | web, android, server |
| `balanced` | 5.3 M | ~21 MB | web, android, server |
| `large` | 9.7 M | ~39 MB | android, server |
| `server` | 300 M | ~1170 MB | server only |

Set `model.backbone` in `configs/default.yaml` to a preset key or any timm model
name. Export enforces the budgets in `docs/MODEL_CONTRACT.md` (32 MB web, 48 MB
Android) and **refuses to publish** an artifact that busts them, rather than
shipping something the browser cannot load.

`configs/server.yaml` keeps the 300M MobileNetV5 available as an accuracy
ceiling to measure the small models against.

## Two-phase training

1. **Epochs 1–10** — backbone frozen, heads only, `lr=1e-3`.
2. **Epochs 11+** — last N block stages unfrozen; backbone at `fine_tune_lr`,
   heads at `10 × fine_tune_lr`.

Loss is `1.0 · CE(disease) + 0.5 · CE(severity)`. Early stopping watches
validation loss with a patience of 5.

> Note: `unfreeze_backbone` walks into the `blocks` stack rather than taking the
> last N `named_children`. timm backbones end in a run of parameterless modules
> (`global_pool`, `flatten`, an `Identity` classifier), so the naive version
> unfreezes nothing and phase 2 silently does nothing at all.

## Exporting

```bash
uv run python main.py export --verify              # fp32 + numeric check vs PyTorch
uv run python main.py export --precision fp16      # ~half the download
uv run python main.py export --demo                # untrained artifact, to test the apps
uv run python main.py export --strict-budget       # non-zero exit if over budget
```

Every export writes `model.onnx` **and** `model.json`. The manifest carries the
input size, normalisation constants, class lists, CAM grid, precision and test
metrics; clients read it instead of hardcoding anything. `--demo` sets
`trained: false`, which makes both apps show a "predictions are not meaningful"
banner — untrained output is never presented as a diagnosis.

## Severity labels are synthetic

There are no human severity annotations in PlantVillage. `dataset.py` derives
them by HSV colour segmentation: mask the leaf, measure the non-green fraction,
bin into Mild / Moderate / Severe / Critical.

This means **the severity head learns to reproduce a colour heuristic**, not
ground-truth agronomic severity. It is reasonable for a demo and clearly wrong
for field use. Replace `estimate_severity_from_image` with real annotations
before anyone acts on the number. `tests/test_dataset.py` pins the binning so
the definition cannot drift unnoticed.

## Tests

```bash
uv run pytest -q
```

197 tests covering the CAM identity, ONNX round-trip fidelity, manifest
completeness against the live graph, the size budget, severity binning
monotonicity, and full coverage of the recommendation table.

On the reference run these produce disease accuracy **96.96%** and severity
accuracy **82.49%** on 8,146 held-out test images.

## Layout

| path | role |
| --- | --- |
| `main.py` | CLI dispatcher over every stage |
| `src/model.py` | Architecture + backbone presets. Owns the CAM constraint. |
| `src/dataset.py` | PlantVillage loading, augmentation, synthetic severity |
| `src/train.py` | Two-phase training loop |
| `src/evaluate.py` | Metrics, confusion matrices, CAM samples, `test_metrics.json` |
| `src/gradcam.py` | CAM rendering — same maths as the ONNX graph |
| `src/export_onnx.py` | ONNX + manifest + quantisation + budget enforcement |
| `src/export_ncnn.py` | Optional NCNN conversion for Android |
| `src/utils.py` | Label tables, treatment recommendations, config, seeding |
