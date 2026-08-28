"""
Export the trained multi-task model to ONNX, plus the manifest clients read.

What makes this exporter different from a plain ``torch.onnx.export`` is that it
bakes **Class Activation Mapping into the graph**. The exported model emits four
tensors instead of two::

    disease_logits   [B, 38]
    severity_logits  [B,  4]
    disease_cam      [B, 38, h, w]
    severity_cam     [B,  4, h, w]

so the browser and the Android app can render a genuine, model-derived
explanation without running a backward pass. See ``docs/MODEL_CONTRACT.md``.

Alongside ``model.onnx`` it writes ``model.json`` -- input size, normalisation,
class lists, CAM grid, metrics and a ``trained`` flag. Clients read the manifest
rather than hardcoding any of it.

Usage::

    uv run python -m src.export_onnx --checkpoint outputs/best_model.pth --verify
    uv run python -m src.export_onnx --demo                # untrained smoke-test artifact
    uv run python -m src.export_onnx --precision fp16      # halve the download
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import shutil
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch

from .model import BACKBONE_PRESETS, MultiTaskPlantModel, resolve_backbone
from .utils import (
    DISEASE_CLASSES,
    SEVERITY_CLASSES,
    SEVERITY_RANGES,
    ensure_dir,
    load_config,
)

# Deployment budgets from docs/MODEL_CONTRACT.md section 7.
SIZE_BUDGETS_MB: dict[str, int] = {"web": 32, "android": 48}

OUTPUT_NAMES = ["disease_logits", "severity_logits", "disease_cam", "severity_cam"]

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


class CamExportWrapper(torch.nn.Module):
    """Adapts the model's 4-tuple CAM forward into an ONNX-traceable module."""

    def __init__(self, model: MultiTaskPlantModel) -> None:
        super().__init__()
        self.model = model

    def forward(
        self, x: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        return self.model.forward_with_cam(x)


def build_model(
    config: dict,
    checkpoint_path: str | None,
    demo: bool = False,
) -> MultiTaskPlantModel:
    """Instantiate the model, loading a checkpoint unless this is a demo export."""
    model_cfg = config["model"]
    image_size = int(config["data"]["image_size"])

    model = MultiTaskPlantModel(
        backbone_name=model_cfg["backbone"],
        # A demo export keeps the ImageNet backbone so the graph is realistic;
        # a real export loads every weight from the checkpoint anyway.
        pretrained=demo,
        num_disease_classes=int(model_cfg["num_disease_classes"]),
        num_severity_classes=int(model_cfg["num_severity_classes"]),
        dropout=float(model_cfg["dropout"]),
        freeze_backbone=False,
        image_size=image_size,
    )

    if not demo:
        if checkpoint_path is None:
            raise ValueError("A --checkpoint is required unless --demo is passed.")
        ckpt = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        state = ckpt.get("model_state_dict", ckpt)
        missing, unexpected = model.load_state_dict(state, strict=False)
        if missing:
            raise RuntimeError(
                "Checkpoint is missing weights for: "
                + ", ".join(sorted(missing)[:8])
                + ("..." if len(missing) > 8 else "")
                + "\nThis usually means the checkpoint predates the exact-CAM "
                "architecture change. Retrain, or export with --demo."
            )
        if unexpected:
            print(f"  note: ignoring {len(unexpected)} unexpected checkpoint keys")

    model.eval()
    return model


def export_to_onnx(
    model: MultiTaskPlantModel,
    output_path: Path,
    image_size: int,
    opset_version: int = 17,
    simplify: bool = True,
) -> Path:
    """Trace the model to ONNX and (optionally) run onnxsim over it."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    wrapper = CamExportWrapper(model).eval()
    dummy = torch.randn(1, 3, image_size, image_size)

    print(f"Exporting to ONNX (opset {opset_version})...")
    torch.onnx.export(
        wrapper,
        dummy,
        str(output_path),
        opset_version=opset_version,
        input_names=["input"],
        output_names=OUTPUT_NAMES,
        dynamic_axes={name: {0: "batch"} for name in ["input", *OUTPUT_NAMES]},
        do_constant_folding=True,
    )
    print(f"  raw: {output_path.name} ({_mb(output_path):.1f} MB)")

    if simplify:
        try:
            import onnxsim

            simplified, ok = onnxsim.simplify(onnx.load(str(output_path)))
            if ok:
                onnx.save(simplified, str(output_path))
                print(f"  simplified: {_mb(output_path):.1f} MB")
            else:
                print("  note: onnxsim could not verify the simplified graph; keeping raw")
        except ImportError:
            print("  note: onnxsim not installed; skipping simplification")

    onnx.checker.check_model(onnx.load(str(output_path)))
    print("  graph validation passed")
    return output_path


def apply_precision(onnx_path: Path, precision: str) -> Path:
    """Convert the graph to fp16 or dynamically quantise it to int8, in place."""
    if precision == "fp32":
        return onnx_path

    before = _mb(onnx_path)

    if precision == "fp16":
        try:
            from onnxconverter_common import float16
        except ImportError:
            print(
                "  warning: onnxconverter-common not installed; "
                "staying at fp32. Install it for fp16 export."
            )
            return onnx_path
        model_fp16 = float16.convert_float_to_float16(
            onnx.load(str(onnx_path)), keep_io_types=True
        )
        onnx.save(model_fp16, str(onnx_path))

    elif precision == "int8":
        try:
            from onnxruntime.quantization import QuantType, quantize_dynamic
        except ImportError:
            print("  warning: onnxruntime.quantization unavailable; staying at fp32.")
            return onnx_path
        tmp = onnx_path.with_suffix(".int8.onnx")
        quantize_dynamic(
            model_input=str(onnx_path),
            model_output=str(tmp),
            weight_type=QuantType.QInt8,
        )
        tmp.replace(onnx_path)
        print(
            "  note: dynamic int8 quantises Gemm/MatMul weights. Convolutional "
            "backbones benefit less than transformers; measure accuracy before shipping."
        )

    else:
        raise ValueError(f"Unknown precision {precision!r}")

    print(f"  {precision}: {before:.1f} MB -> {_mb(onnx_path):.1f} MB")
    return onnx_path


def write_manifest(
    onnx_path: Path,
    model: MultiTaskPlantModel,
    config: dict,
    precision: str,
    trained: bool,
    metrics: dict | None,
) -> Path:
    """Write the ``model.json`` that every client reads before inference."""
    h, w = model.cam_grid
    manifest = {
        "schemaVersion": 1,
        "modelVersion": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "backbone": model.backbone_name,
        "trained": trained,
        "precision": precision,
        "sizeBytes": onnx_path.stat().st_size,
        "input": {
            "name": "input",
            "size": int(config["data"]["image_size"]),
            "layout": "NCHW",
            "mean": IMAGENET_MEAN,
            "std": IMAGENET_STD,
        },
        "outputs": {
            "disease": "disease_logits",
            "severity": "severity_logits",
            "diseaseCam": "disease_cam",
            "severityCam": "severity_cam",
        },
        "cam": {
            "grid": [h, w],
            "exact": bool(model.cam_exact),
            "method": "CAM" if model.cam_exact else "CAM (pre-head features)",
        },
        "classes": {"disease": DISEASE_CLASSES, "severity": SEVERITY_CLASSES},
        "severityRanges": SEVERITY_RANGES,
        "metrics": metrics,
    }

    manifest_path = onnx_path.with_name("model.json")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"  manifest: {manifest_path.name}")
    return manifest_path


def verify_onnx(
    model: MultiTaskPlantModel,
    onnx_path: Path,
    image_size: int,
    tolerance: float = 1e-3,
) -> bool:
    """Check the ONNX graph against PyTorch, including the CAM identity."""
    test_input = torch.randn(1, 3, image_size, image_size)

    with torch.no_grad():
        pt = model.forward_with_cam(test_input)

    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    outs = session.run(OUTPUT_NAMES, {"input": test_input.numpy()})

    ok = True
    for name, pt_tensor, onnx_tensor in zip(OUTPUT_NAMES, pt, outs, strict=True):
        diff = float(np.abs(pt_tensor.numpy() - onnx_tensor).max())
        status = "ok" if diff < tolerance else "FAIL"
        if diff >= tolerance:
            ok = False
        print(f"  {name:<16} max|diff| = {diff:.2e}  [{status}]")

    # The CAM identity is the whole point of this graph; assert it end-to-end
    # on the exported artifact rather than trusting the PyTorch side alone.
    disease_logits, _, disease_cam, _ = outs
    identity_err = float(
        np.abs(
            disease_cam.mean(axis=(2, 3))
            - (disease_logits - model.disease_head.bias.detach().numpy())
        ).max()
    )
    identity_ok = identity_err < 1e-2
    print(
        f"  CAM identity     max|mean(CAM) - (logit - bias)| = {identity_err:.2e}  "
        f"[{'ok' if identity_ok else 'FAIL'}]"
    )
    return ok and identity_ok


def copy_to_clients(onnx_path: Path, manifest_path: Path, config: dict) -> None:
    """Publish the graph + manifest into the web and Android asset directories."""
    export_cfg = config.get("export", {})
    size_mb = _mb(onnx_path)

    targets = {
        "web": export_cfg.get("pc_model_dir", "../pc/public/models"),
        "android": export_cfg.get("mobile_assets_dir", "../mobile/app/src/main/assets"),
    }

    for target, dest_dir in targets.items():
        budget = SIZE_BUDGETS_MB[target]
        if size_mb > budget:
            print(
                f"  SKIPPED {target}: {size_mb:.0f} MB exceeds the {budget} MB budget.\n"
                f"          Use a smaller backbone (see BACKBONE_PRESETS) or "
                f"--precision fp16."
            )
            continue
        dest = ensure_dir(dest_dir)
        shutil.copy2(onnx_path, dest / "model.onnx")
        shutil.copy2(manifest_path, dest / "model.json")
        print(f"  -> {target}: {dest / 'model.onnx'} ({size_mb:.1f} MB)")


def _mb(path: Path) -> float:
    return path.stat().st_size / 1024 / 1024


def _load_metrics(config: dict) -> dict | None:
    """Pick up test metrics written by ``src.evaluate``, if they exist."""
    metrics_path = Path(config["training"]["output_dir"]) / "test_metrics.json"
    if not metrics_path.exists():
        return None
    try:
        return json.loads(metrics_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Export the model to ONNX + manifest.")
    parser.add_argument("--checkpoint", default="outputs/best_model.pth")
    parser.add_argument("--config", default="configs/default.yaml")
    parser.add_argument("--output", default=None, help="Overrides the config path.")
    parser.add_argument(
        "--precision", choices=["fp32", "fp16", "int8"], default="fp32"
    )
    parser.add_argument("--verify", action="store_true", help="Compare ONNX to PyTorch.")
    parser.add_argument("--no-copy", action="store_true", help="Do not publish to clients.")
    parser.add_argument("--no-simplify", action="store_true")
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Export an UNTRAINED model to smoke-test the pipeline. "
        "The manifest is flagged trained:false and clients show a warning banner.",
    )
    parser.add_argument(
        "--strict-budget",
        action="store_true",
        help="Exit non-zero if the artifact exceeds a deployment budget.",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    export_cfg = config.get("export", {})
    image_size = int(config["data"]["image_size"])

    backbone = resolve_backbone(config["model"]["backbone"])
    print(f"Backbone: {backbone}")
    for key, preset in BACKBONE_PRESETS.items():
        if preset["name"] == backbone and "web" not in preset["targets"]:
            print(f"  warning: preset {key!r} is not web-deployable -- {preset['note']}")

    model = build_model(config, None if args.demo else args.checkpoint, demo=args.demo)
    print(model.summary())

    output_path = Path(args.output or export_cfg.get("onnx_output", "outputs/model.onnx"))
    export_to_onnx(
        model,
        output_path,
        image_size=image_size,
        opset_version=int(export_cfg.get("onnx_opset", 17)),
        simplify=not args.no_simplify,
    )
    apply_precision(output_path, args.precision)

    metrics = None if args.demo else _load_metrics(config)
    manifest_path = write_manifest(
        output_path,
        model,
        config,
        precision=args.precision,
        trained=not args.demo,
        metrics=metrics,
    )

    if args.verify and args.precision == "fp32":
        if not verify_onnx(model, output_path, image_size):
            print("Verification FAILED.")
            return 1
    elif args.verify:
        print(f"  note: skipping numeric verification for {args.precision} export")

    if not args.no_copy:
        copy_to_clients(output_path, manifest_path, config)

    size_mb = _mb(output_path)
    over = [t for t, b in SIZE_BUDGETS_MB.items() if size_mb > b]
    if over and args.strict_budget:
        print(f"Artifact is over budget for: {', '.join(over)}")
        return 1

    if args.demo:
        print(
            "\nDEMO EXPORT: the heads are untrained, so predictions are noise. "
            "Clients will display a warning banner."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
