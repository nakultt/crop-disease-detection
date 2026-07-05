"""
Export trained multi-task MobileNetV5 model to ONNX format.

Pipeline:
  1. Load trained PyTorch checkpoint
  2. Export to ONNX with opset 17+ (for GELU support)
  3. Simplify with onnxsim (removes redundant ops)
  4. Validate numerical equivalence
  5. Copy to Next.js public/models/ directory

Usage:
    uv run python -m src.export_onnx --checkpoint outputs/best_model.pth
    uv run python -m src.export_onnx --checkpoint outputs/best_model.pth --verify
"""

import argparse
import shutil
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch

from .model import MultiTaskMobileNetV5
from .utils import ensure_dir, load_config


class MultiTaskMobileNetV5ONNX(torch.nn.Module):
    """
    Wrapper that returns a single tuple for ONNX export compatibility.
    Also exports the last conv layer activations for client-side Grad-CAM.
    """

    def __init__(self, model: MultiTaskMobileNetV5):
        super().__init__()
        self.model = model

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        disease_logits, severity_logits = self.model(x)
        return disease_logits, severity_logits


def export_to_onnx(
    checkpoint_path: str,
    config: dict,
    output_path: str = "outputs/model.onnx",
    opset_version: int = 17,
) -> str:
    """
    Export trained model to ONNX format.

    Returns path to the simplified ONNX model.
    """
    model_cfg = config["model"]
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Load model
    print("Loading model checkpoint...")
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)

    model = MultiTaskMobileNetV5(
        backbone_name=model_cfg["backbone"],
        pretrained=False,
        num_disease_classes=model_cfg["num_disease_classes"],
        num_severity_classes=model_cfg["num_severity_classes"],
        dropout=model_cfg["dropout"],
        freeze_backbone=False,
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    # Wrap for ONNX export
    export_model = MultiTaskMobileNetV5ONNX(model)
    export_model.eval()

    # Create dummy input
    image_size = config["data"]["image_size"]
    dummy_input = torch.randn(1, 3, image_size, image_size)

    # Export to ONNX
    print(f"Exporting to ONNX (opset {opset_version})...")

    torch.onnx.export(
        export_model,
        dummy_input,
        str(output_path),
        opset_version=opset_version,
        input_names=["input"],
        output_names=["disease_logits", "severity_logits"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "disease_logits": {0: "batch_size"},
            "severity_logits": {0: "batch_size"},
        },
    )

    print(f"Exported raw ONNX: {output_path} ({output_path.stat().st_size / 1024 / 1024:.1f} MB)")

    # Simplify with onnxsim
    print("Simplifying with onnxsim...")
    import onnxsim

    onnx_model = onnx.load(str(output_path))
    simplified_model, check = onnxsim.simplify(onnx_model)

    if check:
        simplified_path = output_path.with_name(
            output_path.stem + "_simplified" + output_path.suffix
        )
        onnx.save(simplified_model, str(simplified_path))
        print(
            f"Simplified ONNX: {simplified_path} "
            f"({simplified_path.stat().st_size / 1024 / 1024:.1f} MB)"
        )
    else:
        print("WARNING: onnxsim simplification failed, using raw ONNX")
        simplified_path = output_path

    # Validate ONNX model
    print("Validating ONNX model...")
    onnx_model = onnx.load(str(simplified_path))
    onnx.checker.check_model(onnx_model)
    print("ONNX model validation passed ✓")

    return str(simplified_path)


def verify_onnx(
    checkpoint_path: str,
    onnx_path: str,
    config: dict,
    tolerance: float = 1e-4,
) -> bool:
    """Verify ONNX model output matches PyTorch model output."""
    model_cfg = config["model"]
    image_size = config["data"]["image_size"]

    # Load PyTorch model
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    model = MultiTaskMobileNetV5(
        backbone_name=model_cfg["backbone"],
        pretrained=False,
        num_disease_classes=model_cfg["num_disease_classes"],
        num_severity_classes=model_cfg["num_severity_classes"],
        dropout=model_cfg["dropout"],
        freeze_backbone=False,
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    # Create test input
    test_input = torch.randn(1, 3, image_size, image_size)

    # PyTorch inference
    with torch.no_grad():
        pt_disease, pt_severity = model(test_input)

    # ONNX inference
    session = ort.InferenceSession(onnx_path)
    onnx_result = session.run(None, {"input": test_input.numpy()})
    onnx_disease, onnx_severity = onnx_result

    # Compare
    disease_diff = np.abs(pt_disease.numpy() - onnx_disease).max()
    severity_diff = np.abs(pt_severity.numpy() - onnx_severity).max()

    print(f"Max absolute difference (disease): {disease_diff:.6f}")
    print(f"Max absolute difference (severity): {severity_diff:.6f}")

    passed = disease_diff < tolerance and severity_diff < tolerance
    if passed:
        print(f"✓ Verification passed (tolerance={tolerance})")
    else:
        print(f"✗ Verification FAILED (tolerance={tolerance})")

    return passed


def copy_to_frontend(onnx_path: str, config: dict) -> None:
    """Copy ONNX model to Next.js public directory."""
    export_cfg = config.get("export", {})
    pc_model_dir = export_cfg.get("pc_model_dir", "../pc/public/models")

    dest_dir = ensure_dir(pc_model_dir)
    dest_path = dest_dir / "model.onnx"

    shutil.copy2(onnx_path, str(dest_path))
    print(f"Copied ONNX model to: {dest_path}")


def main():
    parser = argparse.ArgumentParser(description="Export model to ONNX")
    parser.add_argument(
        "--checkpoint",
        type=str,
        default="outputs/best_model.pth",
        help="Path to model checkpoint",
    )
    parser.add_argument(
        "--config",
        type=str,
        default="configs/default.yaml",
        help="Path to config file",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output ONNX path (overrides config)",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify ONNX output matches PyTorch",
    )
    parser.add_argument(
        "--no-copy",
        action="store_true",
        help="Don't copy to frontend directory",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    export_cfg = config.get("export", {})

    output_path = args.output or export_cfg.get("onnx_output", "outputs/model.onnx")

    # Export
    simplified_path = export_to_onnx(
        checkpoint_path=args.checkpoint,
        config=config,
        output_path=output_path,
        opset_version=export_cfg.get("onnx_opset", 17),
    )

    # Verify
    if args.verify:
        verify_onnx(args.checkpoint, simplified_path, config)

    # Copy to frontend
    if not args.no_copy:
        copy_to_frontend(simplified_path, config)


if __name__ == "__main__":
    main()
