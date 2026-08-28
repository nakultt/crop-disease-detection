"""
PlantGuard training CLI.

A thin dispatcher over the pipeline stages so there is one entry point to learn::

    uv run python main.py download            # fetch PlantVillage from Kaggle
    uv run python main.py train               # train (two-phase)
    uv run python main.py evaluate            # metrics + confusion matrices + CAMs
    uv run python main.py export --verify     # ONNX + manifest, published to both apps
    uv run python main.py export --demo       # untrained artifact, to smoke-test the apps
    uv run python main.py cam IMAGE.jpg       # explain a single image
    uv run python main.py backbones           # list presets and their size budgets
    uv run python main.py info                # what exists on disk right now

Every subcommand forwards unknown flags to the underlying module, so
``main.py train --epochs 1`` works exactly like ``python -m src.train --epochs 1``.
"""

from __future__ import annotations

import argparse
import json
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).parent


def _run_module(module: str, argv: list[str]) -> int:
    """Invoke ``python -m <module> <argv>`` in-process."""
    saved = sys.argv
    sys.argv = [module.replace(".", "/") + ".py", *argv]
    try:
        runpy.run_module(module, run_name="__main__")
        return 0
    except SystemExit as exc:  # argparse / explicit exits from the module
        return int(exc.code or 0)
    finally:
        sys.argv = saved


def cmd_backbones(_args: argparse.Namespace, _rest: list[str]) -> int:
    from src.model import BACKBONE_PRESETS

    print(f"{'preset':<10} {'params':>8} {'onnx':>9}  {'targets':<26} note")
    print("-" * 100)
    for key, preset in BACKBONE_PRESETS.items():
        targets = ", ".join(preset["targets"])
        print(
            f"{key:<10} {preset['params_m']:>7.1f}M {preset['onnx_mb']:>7} MB  "
            f"{targets:<26} {preset['note']}"
        )
    print("\nBudgets: 32 MB web, 48 MB android (docs/MODEL_CONTRACT.md section 7).")
    print("Set `model.backbone` in configs/default.yaml to a preset key or a timm name.")
    return 0


def cmd_info(_args: argparse.Namespace, _rest: list[str]) -> int:
    """Report what is on disk, so it is obvious what step to run next."""

    def size(path: Path) -> str:
        if not path.exists():
            return "missing"
        if path.is_dir():
            n = sum(1 for _ in path.rglob("*") if _.is_file())
            return f"{n:,} files"
        mb = path.stat().st_size / 1024 / 1024
        return f"{mb:,.1f} MB"

    items = [
        ("Dataset", ROOT / "data" / "PlantVillage"),
        ("Checkpoint", ROOT / "outputs" / "best_model.pth"),
        ("ONNX graph", ROOT / "outputs" / "model.onnx"),
        ("Manifest", ROOT / "outputs" / "model.json"),
        ("Web model", ROOT.parent / "pc" / "public" / "models" / "model.onnx"),
        ("Android model", ROOT.parent / "mobile" / "app" / "src" / "main" / "assets" / "model.onnx"),
    ]
    print(f"{'artifact':<16} {'status':>14}  path")
    print("-" * 92)
    for label, path in items:
        print(f"{label:<16} {size(path):>14}  {path}")

    manifest = ROOT / "outputs" / "model.json"
    if manifest.exists():
        data = json.loads(manifest.read_text(encoding="utf-8"))
        print(f"\nExported backbone : {data['backbone']}")
        print(f"Precision         : {data['precision']}")
        print(f"CAM grid          : {data['cam']['grid']} (exact={data['cam']['exact']})")
        print(f"Trained           : {data['trained']}")
        if data.get("metrics"):
            m = data["metrics"]
            print(
                f"Test accuracy     : disease {m['diseaseAccuracy']:.2%}, "
                f"severity {m['severityAccuracy']:.2%}"
            )

    dataset = ROOT / "data" / "PlantVillage"
    if not dataset.exists() or not any(dataset.iterdir()):
        print("\nNext step: `uv run python main.py download` to fetch PlantVillage.")
    elif not (ROOT / "outputs" / "best_model.pth").exists():
        print("\nNext step: `uv run python main.py train`.")
    elif not manifest.exists():
        print("\nNext step: `uv run python main.py export --verify`.")
    return 0


def cmd_cam(args: argparse.Namespace, _rest: list[str]) -> int:
    """Explain a single image with the exact CAM used by the deployed apps."""
    import torch

    from src.dataset import get_transforms
    from src.gradcam import generate_cam_visualization
    from src.model import MultiTaskPlantModel
    from src.utils import get_device, load_config

    config = load_config(args.config)
    device = get_device(config["training"]["device"])
    image_size = int(config["data"]["image_size"])

    checkpoint = Path(args.checkpoint)
    if not checkpoint.exists():
        print(f"No checkpoint at {checkpoint}. Train first, or pass --checkpoint.")
        return 1

    model = MultiTaskPlantModel(
        backbone_name=config["model"]["backbone"],
        pretrained=False,
        num_disease_classes=config["model"]["num_disease_classes"],
        num_severity_classes=config["model"]["num_severity_classes"],
        dropout=config["model"]["dropout"],
        freeze_backbone=False,
        image_size=image_size,
    )
    ckpt = torch.load(str(checkpoint), map_location="cpu", weights_only=False)
    model.load_state_dict(ckpt.get("model_state_dict", ckpt))

    output = Path(args.output or f"outputs/cam_{Path(args.image).stem}.png")
    _, _, info = generate_cam_visualization(
        model=model,
        image_path=args.image,
        device=device,
        transform=get_transforms(image_size=image_size, train=False),
        output_path=output,
        head=args.head,
    )
    print(f"{info['class_name']}  ({info['confidence']:.1%})")
    print(f"Saved: {output}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="main.py",
        description="PlantGuard: multi-task plant disease detection with exact CAM.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("download", help="Download PlantVillage from Kaggle.")
    sub.add_parser("train", help="Train the model (forwards flags to src.train).")
    sub.add_parser("evaluate", help="Evaluate a checkpoint (forwards to src.evaluate).")
    sub.add_parser("export", help="Export ONNX + manifest (forwards to src.export_onnx).")
    sub.add_parser("backbones", help="List backbone presets and size budgets.")
    sub.add_parser("info", help="Show which artifacts exist on disk.")

    cam = sub.add_parser("cam", help="Render a CAM explanation for one image.")
    cam.add_argument("image", help="Path to a leaf image.")
    cam.add_argument("--checkpoint", default="outputs/best_model.pth")
    cam.add_argument("--config", default="configs/default.yaml")
    cam.add_argument("--head", choices=["disease", "severity"], default="disease")
    cam.add_argument("--output", default=None)

    return parser


FORWARDED = {
    "download": "scripts.download_dataset",
    "train": "src.train",
    "evaluate": "src.evaluate",
    "export": "src.export_onnx",
}

HANDLED = {"backbones": cmd_backbones, "info": cmd_info, "cam": cmd_cam}


def main() -> int:
    parser = build_parser()
    args, rest = parser.parse_known_args()

    if args.command in FORWARDED:
        return _run_module(FORWARDED[args.command], rest)

    handler = HANDLED[args.command]
    return handler(args, rest)


if __name__ == "__main__":
    raise SystemExit(main())
