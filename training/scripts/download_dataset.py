"""
Download the PlantVillage dataset from Kaggle.

Usage:
    uv run python scripts/download_dataset.py
    uv run python scripts/download_dataset.py --output ./data/PlantVillage
"""

import argparse
import shutil
from pathlib import Path

import kagglehub


DATASET_SLUG = "abdallahalidev/plantvillage-dataset"


def download_plantvillage(output_dir: str = "./data/PlantVillage") -> None:
    """Download and organize the PlantVillage dataset."""
    output_path = Path(output_dir)

    if output_path.exists() and any(output_path.iterdir()):
        # Count existing images
        image_count = sum(
            1
            for f in output_path.rglob("*")
            if f.suffix.lower() in (".jpg", ".jpeg", ".png")
        )
        print(f"Dataset already exists at {output_path} ({image_count} images)")
        print("To re-download, delete the directory first.")
        return

    print("Downloading PlantVillage dataset from Kaggle...")
    print("(This requires Kaggle API credentials - see https://github.com/Kaggle/kagglehub)")

    # Download dataset
    dataset_path = kagglehub.dataset_download(DATASET_SLUG)
    dataset_path = Path(dataset_path)
    print(f"Downloaded to: {dataset_path}")

    # Find the color images directory (most useful for classification)
    # PlantVillage dataset structure: plantvillage dataset/color/
    color_dir = None
    for candidate in [
        dataset_path / "plantvillage dataset" / "color",
        dataset_path / "plantvillage_dataset" / "color",
        dataset_path / "color",
    ]:
        if candidate.exists():
            color_dir = candidate
            break

    if color_dir is None:
        # Fallback: find any directory with class subdirectories
        for d in dataset_path.rglob("*"):
            if d.is_dir() and any(
                f.suffix.lower() in (".jpg", ".jpeg", ".png") for f in d.iterdir()
            ):
                color_dir = d.parent
                break

    if color_dir is None:
        print(f"Could not find image directory in {dataset_path}")
        print("Contents:")
        for item in sorted(dataset_path.rglob("*"))[:20]:
            print(f"  {item}")
        return

    # Copy to output directory
    print(f"Organizing dataset from {color_dir} to {output_path}...")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if output_path.exists():
        shutil.rmtree(output_path)

    shutil.copytree(color_dir, output_path)

    # Verify
    verify_dataset(output_path)


def verify_dataset(dataset_path: Path) -> None:
    """Verify the downloaded dataset structure."""
    classes = sorted([d.name for d in dataset_path.iterdir() if d.is_dir()])
    total_images = 0

    print(f"\nDataset verification:")
    print(f"  Location: {dataset_path}")
    print(f"  Classes found: {len(classes)}")
    print(f"  {'Class':<50} {'Images':>8}")
    print(f"  {'-' * 50} {'-' * 8}")

    for cls_name in classes:
        cls_dir = dataset_path / cls_name
        images = [
            f
            for f in cls_dir.iterdir()
            if f.suffix.lower() in (".jpg", ".jpeg", ".png")
        ]
        total_images += len(images)
        print(f"  {cls_name:<50} {len(images):>8}")

    print(f"  {'-' * 50} {'-' * 8}")
    print(f"  {'TOTAL':<50} {total_images:>8}")

    if len(classes) == 38:
        print("\n✓ All 38 PlantVillage classes found!")
    else:
        print(f"\n⚠ Expected 38 classes, found {len(classes)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download PlantVillage dataset")
    parser.add_argument(
        "--output",
        type=str,
        default="./data/PlantVillage",
        help="Output directory for the dataset",
    )
    args = parser.parse_args()
    download_plantvillage(args.output)
