# PlantGuard — Android app

Jetpack Compose + Material 3. Runs the disease model on-device via ONNX Runtime
Android; photographs never leave the phone.

```bash
./gradlew installDebug      # build and install
./gradlew testDebugUnitTest # unit tests
```

Or open this directory in Android Studio and hit Run.

The app needs `model.onnx` and `model.json` in `app/src/main/assets/`. Produce
them from `training/`:

```bash
cd ../training && uv run python main.py export --demo
```

They are gitignored, so a fresh clone needs this before the app will do
anything. Without them the app shows a setup message naming the exact command
rather than crashing.

- **minSdk 26** (Android 8.0) — reaches essentially every device in use. The
  project template shipped with minSdk 35, which restricted it to Android 15+.
- **applicationId** `com.plantguard.app`.

## How it works

```
assets/model.json ──▶ ModelManifest       validate, drive everything from it
assets/model.onnx ──▶ PlantDiseaseClassifier
                            │
                            ├─ logits ────▶ DiagnosisCard, SeverityCard
                            └─ CAM cube ──▶ HeatmapRenderer ──▶ HeatmapCard
```

`AnalysisViewModel` owns the classifier. That matters: building one parses and
optimises the whole graph and allocates native memory, so it is created once and
survives configuration changes. Constructing a classifier per image — as the
first version did — re-parsed the model on every analysis and leaked a session
each time.

### The heatmap is real

The ONNX graph emits a class activation cube (`[1, 38, h, w]`) alongside its
logits, so the overlay comes from the model's own arithmetic rather than from
colour heuristics applied to the photo. See
[`../docs/MODEL_CONTRACT.md`](../docs/MODEL_CONTRACT.md) for the derivation.

The whole cube is retained, so tapping a runner-up in the candidates list shows
*that class's* evidence without re-running inference.

Colormaps are Inferno, Viridis and Magma — all perceptually uniform. JET is
deliberately absent: its bands invent edges that read as structure in the data.

## Layout

| path | role |
| --- | --- |
| `model/ModelManifest.kt` | Manifest parsing + validation (uses `org.json`, no extra deps) |
| `model/PlantDiseaseClassifier.kt` | ORT session, preprocessing, `predict()` |
| `model/HeatmapRenderer.kt` | Normalise, bilinear upscale, colormaps, compositing |
| `model/Recommendations.kt` | Treatment table (generated from the web app's) |
| `AnalysisViewModel.kt` | Owns the classifier; decoding, EXIF, state |
| `ui/AnalysisScreen.kt` | Screen scaffold and section ordering |
| `ui/Components.kt` | Cards: model status, intake, heatmap, diagnosis, severity, advice |
| `ui/CameraCapture.kt` | FileProvider URIs for `TakePicture` |
| `ui/theme/` | Material 3 light + dark, severity colours |

## Notes worth knowing

- **No permissions required.** Gallery access uses `PickVisualMedia` (the system
  photo picker), and camera captures write to the app's own cache via a
  `FileProvider`. Neither needs a runtime permission, and nothing is written to
  the shared gallery.
- **Large photos are downsampled at decode time.** A 12 MP capture decoded at
  full size costs ~50 MB of heap for an image about to be scaled to 256 px, so
  `BitmapFactory.inSampleSize` caps the long edge at 1024 first. EXIF rotation
  is applied so a portrait photo is not analysed sideways.
- **Preprocessing matches training**: short-side resize then centre-crop, not a
  squash to square, which would distort leaf geometry.
- **The overlay is composited in one draw.** Colouring 262,144 pixels via
  `drawPoint` per pixel takes hundreds of milliseconds; building the pixel array
  and blitting once is effectively free.
- **`OrtEnvironment` is a process-wide singleton** and is deliberately *not*
  closed when the classifier closes — tearing it down would break every other
  consumer in the process.
- **Untrained models are labelled.** When `model.json` says `trained: false`, a
  banner states predictions are not meaningful and the treatment card says it is
  shown for completeness only.

## Tests

```bash
./gradlew testDebugUnitTest          # 37 JVM tests
./gradlew connectedDebugAndroidTest  # on-device: real ORT session + CAM
```

JVM tests cover manifest parsing/validation, the heatmap maths (normalise,
bilinear upscale, hotspot description) and the recommendation table — mirroring
`pc/src/app/lib/*.test.ts` so the two clients cannot drift apart.

`android.graphics` and `org.json` are stubbed in JVM unit tests; `org.json` is
supplied as a real test dependency, and anything needing `Canvas`/`Bitmap` or a
live ONNX session runs as an instrumented test instead.

## Build configuration

Two AGP 9 specifics are worth knowing if you touch the Gradle files:

- Do **not** apply `org.jetbrains.kotlin.android`. AGP 9 brings its own Kotlin
  support and registers the `kotlin` extension itself; applying the plugin on
  top fails with *"Cannot add extension with name 'kotlin'"*.
- The release block uses `isMinifyEnabled` / `isShrinkResources` rather than
  `optimization { enable = true }`, which additionally requires the
  `android.r8.gradual.support` flag.

`app/src/main/assets/*.onnx` is excluded from APK compression (`noCompress`), so
the graph reaches the device byte-for-byte and does not need a full in-memory
decompress on load.
