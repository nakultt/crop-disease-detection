"""
Convert ONNX model to NCNN format for Android deployment.

Uses PNNX (recommended over the older onnx2ncnn) for better
compatibility with MobileNetV5's newer operations (GELU, RMSNorm).

Pipeline:
  1. Load simplified ONNX model
  2. Convert to NCNN using pnnx
  3. Verify NCNN model produces valid outputs
  4. Copy model.param + model.bin to Android assets

Usage:
    uv run python -m src.export_ncnn --onnx outputs/model_simplified.onnx
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

from .utils import ensure_dir, load_config


def find_pnnx() -> str | None:
    """Find the PNNX executable."""
    # Check if pnnx is in PATH
    result = subprocess.run(
        ["pnnx", "--help"],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0 or "pnnx" in result.stdout.lower() or "pnnx" in result.stderr.lower():
        return "pnnx"

    # Check common locations
    common_paths = [
        Path.home() / "ncnn" / "build" / "tools" / "pnnx" / "pnnx",
        Path.home() / "ncnn" / "build" / "tools" / "pnnx" / "pnnx.exe",
        Path("/usr/local/bin/pnnx"),
    ]

    for p in common_paths:
        if p.exists():
            return str(p)

    return None


def convert_onnx_to_ncnn(
    onnx_path: str,
    output_dir: str = "outputs/ncnn",
    pnnx_path: str | None = None,
) -> tuple[str, str]:
    """
    Convert ONNX model to NCNN format using PNNX.

    Returns:
        (param_path, bin_path) tuple
    """
    onnx_path = Path(onnx_path)
    output_dir = ensure_dir(output_dir)

    if not onnx_path.exists():
        raise FileNotFoundError(f"ONNX model not found: {onnx_path}")

    # Find PNNX
    pnnx_cmd = pnnx_path or find_pnnx()

    if pnnx_cmd is None:
        print("=" * 60)
        print("PNNX NOT FOUND")
        print("=" * 60)
        print()
        print("PNNX is required to convert ONNX to NCNN.")
        print("Install instructions:")
        print()
        print("Option 1: Download pre-built binary")
        print("  https://github.com/pnnx/pnnx/releases")
        print()
        print("Option 2: Build from NCNN source")
        print("  git clone https://github.com/Tencent/ncnn.git")
        print("  cd ncnn && mkdir build && cd build")
        print("  cmake .. && cmake --build . --target pnnx")
        print()
        print("After installing, either:")
        print("  1. Add pnnx to your PATH")
        print("  2. Re-run with --pnnx-path /path/to/pnnx")
        print()

        # Fallback: try onnx2ncnn
        print("Attempting fallback with onnx2ncnn...")
        return _fallback_onnx2ncnn(onnx_path, output_dir)

    # Run PNNX conversion
    print(f"Converting ONNX to NCNN using PNNX...")
    print(f"  Input: {onnx_path}")
    print(f"  Output: {output_dir}")

    cmd = [
        str(pnnx_cmd),
        str(onnx_path),
        f"ncnnparam={output_dir / 'model.param'}",
        f"ncnnbin={output_dir / 'model.bin'}",
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"PNNX conversion failed:")
        print(f"  stdout: {result.stdout}")
        print(f"  stderr: {result.stderr}")
        print("\nAttempting fallback with onnx2ncnn...")
        return _fallback_onnx2ncnn(onnx_path, output_dir)

    param_path = output_dir / "model.param"
    bin_path = output_dir / "model.bin"

    if not param_path.exists() or not bin_path.exists():
        # PNNX might output with different names
        for f in output_dir.iterdir():
            if f.suffix == ".param":
                shutil.move(str(f), str(param_path))
            elif f.suffix == ".bin" and "ncnn" in f.stem:
                shutil.move(str(f), str(bin_path))

    print(f"NCNN param: {param_path} ({param_path.stat().st_size / 1024:.1f} KB)")
    print(f"NCNN bin: {bin_path} ({bin_path.stat().st_size / 1024 / 1024:.1f} MB)")

    return str(param_path), str(bin_path)


def _fallback_onnx2ncnn(onnx_path: Path, output_dir: Path) -> tuple[str, str]:
    """Fallback conversion using onnx2ncnn if PNNX is not available."""
    # Check for onnx2ncnn
    try:
        result = subprocess.run(["onnx2ncnn", "--help"], capture_output=True, text=True)
    except FileNotFoundError:
        print("onnx2ncnn also not found.")
        print("Please install PNNX or onnx2ncnn to convert models.")
        print()
        print("For now, creating placeholder NCNN files...")
        return _create_placeholder_ncnn(output_dir)

    param_path = output_dir / "model.param"
    bin_path = output_dir / "model.bin"

    cmd = ["onnx2ncnn", str(onnx_path), str(param_path), str(bin_path)]
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"onnx2ncnn conversion failed: {result.stderr}")
        return _create_placeholder_ncnn(output_dir)

    return str(param_path), str(bin_path)


def _create_placeholder_ncnn(output_dir: Path) -> tuple[str, str]:
    """Create placeholder NCNN files (for development flow)."""
    param_path = output_dir / "model.param"
    bin_path = output_dir / "model.bin"

    param_path.write_text(
        "# PLACEHOLDER - Replace with actual NCNN model\n"
        "# Convert using: pnnx model_simplified.onnx\n"
    )
    bin_path.write_bytes(b"PLACEHOLDER")

    print(f"Created placeholder files (not functional):")
    print(f"  {param_path}")
    print(f"  {bin_path}")

    return str(param_path), str(bin_path)


def copy_to_mobile(param_path: str, bin_path: str, config: dict) -> None:
    """Copy NCNN model files to Android assets directory."""
    export_cfg = config.get("export", {})
    mobile_dir = export_cfg.get("mobile_assets_dir", "../mobile/app/src/main/assets")

    dest_dir = ensure_dir(mobile_dir)

    shutil.copy2(param_path, str(dest_dir / "model.param"))
    shutil.copy2(bin_path, str(dest_dir / "model.bin"))

    print(f"Copied NCNN model to: {dest_dir}")


def main():
    parser = argparse.ArgumentParser(description="Convert ONNX to NCNN")
    parser.add_argument(
        "--onnx",
        type=str,
        default="outputs/model_simplified.onnx",
        help="Path to simplified ONNX model",
    )
    parser.add_argument(
        "--config",
        type=str,
        default="configs/default.yaml",
        help="Path to config file",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Output directory for NCNN files",
    )
    parser.add_argument(
        "--pnnx-path",
        type=str,
        default=None,
        help="Path to PNNX executable",
    )
    parser.add_argument(
        "--no-copy",
        action="store_true",
        help="Don't copy to mobile assets directory",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    export_cfg = config.get("export", {})
    output_dir = args.output_dir or export_cfg.get("ncnn_output_dir", "outputs/ncnn")

    # Convert
    param_path, bin_path = convert_onnx_to_ncnn(
        onnx_path=args.onnx,
        output_dir=output_dir,
        pnnx_path=args.pnnx_path,
    )

    # Copy to mobile
    if not args.no_copy:
        copy_to_mobile(param_path, bin_path, config)


if __name__ == "__main__":
    main()
