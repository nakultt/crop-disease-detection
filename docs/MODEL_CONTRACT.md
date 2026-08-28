# Model Contract v1

The single source of truth shared by the exporter (`training/src/export_onnx.py`),
the web client (`pc/`), and the Android client (`mobile/`).
Any change here MUST be mirrored in all three.

## 1. Artifacts

Every export produces two files that ship together:

| File | Purpose |
| --- | --- |
| `model.onnx` | The graph (see §2). |
| `model.json` | Manifest describing the graph (see §3). Clients read this FIRST. |

Clients must never hardcode class lists, input size, or normalisation constants.
They read `model.json` and adapt. If `model.json` is missing, the client must
show a setup message, not guess.

## 2. ONNX graph I/O

### Input

| Name | Shape | dtype | Notes |
| --- | --- | --- | --- |
| `input` | `[batch, 3, H, W]` | float32 | NCHW, RGB, ImageNet-normalised (§4). `batch` is dynamic; `H`/`W` fixed by `manifest.input.size`. |

### Outputs (order is fixed; clients address them **by name**)

| Name | Shape | dtype | Notes |
| --- | --- | --- | --- |
| `disease_logits` | `[batch, 38]` | float32 | Raw logits. Client applies softmax. |
| `severity_logits` | `[batch, 4]` | float32 | Raw logits. Client applies softmax. |
| `disease_cam` | `[batch, 38, h, w]` | float32 | Class Activation Map cube, one map per disease class. |
| `severity_cam` | `[batch, 4, h, w]` | float32 | CAM cube, one map per severity level. |

`h`/`w` are the backbone's final feature-map resolution (typically `H/32`, e.g. 8x8
for a 256px input). They are reported in `manifest.cam.grid` but clients must
also read them off the returned tensor's dims rather than assuming.

## 3. Why the CAM is exact (not an approximation)

The architecture is:

```
x -> backbone -> feature map A  [B, C, h, w]
              -> global average pool -> f  [B, C]
              -> Dropout -> Linear(W, b)  -> logits  [B, K]
```

Because pooling is a *global average* and the head is a single `Linear`, for class `k`:

```
logit_k = b_k + sum_c W[k,c] * f_c
        = b_k + sum_c W[k,c] * (1/(h*w)) * sum_{i,j} A[c,i,j]
        = b_k + (1/(h*w)) * sum_{i,j} ( sum_c W[k,c] * A[c,i,j] )
                                       \_______________________/
                                            CAM_k[i,j]
```

So `CAM_k[i,j] = sum_c W[k,c] * A[c,i,j]` is the exact per-location contribution
to `logit_k`, and its spatial mean is the logit up to the bias. This is Zhou et al.
(2016) Class Activation Mapping, and for this architecture it is **identical to
Grad-CAM** — Grad-CAM's gradient weights `d(logit_k)/dA[c,i,j]` reduce to exactly
`W[k,c]/(h*w)` here. No gradients, no backward pass, no extra parameters.

The exporter therefore implements each CAM as a `1x1 Conv2d` whose weight is the
head's `Linear.weight` reshaped to `[K, C, 1, 1]` (bias omitted — a constant
offset does not change the normalised heatmap). Dropout is identity at eval time.

**Consequence:** dropout must sit *before* the Linear and the head must remain a
single Linear on globally-average-pooled features. If a head ever gains a hidden
layer, this identity breaks and the exporter must fall back to real Grad-CAM.

## 4. Preprocessing (identical on every client)

1. Decode image to RGB.
2. Resize so the **short side** is `manifest.input.size`, then **centre-crop** to
   `size x size`. (Do not squash-resize; it distorts leaf geometry.)
3. Scale to `[0, 1]` by dividing by 255.
4. Normalise per channel: `(v - mean[c]) / std[c]` using `manifest.input.mean`
   and `manifest.input.std`.
5. Lay out as NCHW: all R, then all G, then all B.

## 5. Post-processing

- **Probabilities:** numerically-stable softmax over each logit vector.
- **Top-K:** sort descending, take `K = 5` for disease.
- **Heatmap for the predicted class `k`:**
  1. Take `cam[0, k]` -> `[h, w]`.
  2. `relu`: clamp negatives to 0. (Negative evidence is not shown.)
  3. Normalise to `[0,1]` by `(v - min) / (max - min)`; if `max == min`, emit all zeros.
  4. Bilinearly upscale `[h, w]` -> display resolution. Nearest-neighbour looks blocky
     and is not acceptable.
  5. Map through a colormap and alpha-composite over the source image.

## 6. `model.json` manifest schema

```jsonc
{
  "schemaVersion": 1,
  "modelVersion": "2026-08-28T12:00:00Z",   // ISO-8601 export timestamp
  "backbone": "mobilenetv4_conv_small.e2400_r224_in1k",
  "trained": true,                           // false => clients MUST show a demo banner
  "precision": "fp32",                       // "fp32" | "fp16" | "int8"
  "sizeBytes": 15728640,
  "input":  { "name": "input", "size": 256, "layout": "NCHW",
              "mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225] },
  "outputs": { "disease": "disease_logits", "severity": "severity_logits",
               "diseaseCam": "disease_cam", "severityCam": "severity_cam" },
  "cam": { "grid": [8, 8], "exact": true, "method": "CAM" },
  "classes": {
    "disease":  ["Apple___Apple_scab", "..."],   // exactly 38, index == output index
    "severity": ["Mild", "Moderate", "Severe", "Critical"]
  },
  "severityRanges": { "Mild": "0-25%", "Moderate": "26-50%",
                      "Severe": "51-75%", "Critical": "76-100%" },
  "metrics": {                                  // null when trained == false
    "diseaseAccuracy": 0.9942, "diseaseMacroF1": 0.9931,
    "severityAccuracy": 0.8710, "severityMacroF1": 0.8455,
    "evaluatedOn": "test", "numSamples": 8138
  }
}
```

`trained: false` is produced by `--demo` exports (ImageNet weights, untrained
heads). Clients that see it must display a prominent banner stating predictions
are not meaningful. Never silently present demo output as a real diagnosis.

## 7. Size budget

| Target | Budget | Enforcement |
| --- | --- | --- |
| Web (`pc/public/models/`) | <= 32 MB | Export warns above budget, fails with `--strict-budget`. |
| Android (`mobile/.../assets/`) | <= 48 MB | Same. |

A backbone whose fp32 export exceeds these is not deployable to that target.
`mobilenetv5_300m.gemma3n` exports at ~1.17 GB and is **server-only**.
