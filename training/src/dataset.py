"""
Dataset pipeline for PlantVillage with synthetic severity label generation.

Severity labels are generated via HSV color segmentation:
  1. Convert leaf image to HSV
  2. Segment healthy (green) vs diseased (brown/yellow/black) regions
  3. Calculate infected_ratio = diseased_pixels / total_leaf_pixels
  4. Bin into: Mild (0-25%), Moderate (26-50%), Severe (51-75%), Critical (76-100%)
  5. Healthy class plants → Mild (0%)
"""

import json
from pathlib import Path

import albumentations as A
import cv2
import numpy as np
import torch
from albumentations.pytorch import ToTensorV2
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm

from .utils import DISEASE_CLASSES, is_healthy_class


# ─── Severity Label Generation ────────────────────────────────────────────────


def estimate_severity_from_image(image_path: str | Path) -> tuple[float, int]:
    """
    Estimate disease severity from a leaf image using HSV color segmentation.

    Returns:
        (infected_ratio, severity_class_index)
        severity_class_index: 0=Mild, 1=Moderate, 2=Severe, 3=Critical
    """
    img = cv2.imread(str(image_path))
    if img is None:
        return 0.0, 0

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # ── Step 1: Create leaf mask (separate leaf from background) ──
    # Background is typically white/light gray in PlantVillage
    # Leaf has saturation > threshold
    leaf_mask = hsv[:, :, 1] > 30  # Saturation channel > 30

    total_leaf_pixels = np.sum(leaf_mask)
    if total_leaf_pixels < 100:
        # Too few leaf pixels detected, likely bad segmentation
        return 0.0, 0

    # ── Step 2: Segment healthy (green) regions ──
    # Green in HSV: H=35-85, S>40, V>40
    green_lower = np.array([35, 40, 40])
    green_upper = np.array([85, 255, 255])
    green_mask = cv2.inRange(hsv, green_lower, green_upper)

    # ── Step 3: Segment diseased regions ──
    # Brown/yellow: H=10-35, S>30, V>30
    brown_lower = np.array([10, 30, 30])
    brown_upper = np.array([35, 255, 255])
    brown_mask = cv2.inRange(hsv, brown_lower, brown_upper)

    # Dark spots (black/dark brown): V<80, S>20
    dark_lower = np.array([0, 20, 0])
    dark_upper = np.array([180, 255, 80])
    dark_mask = cv2.inRange(hsv, dark_lower, dark_upper)

    # Light spots / yellowing: H=20-40, S=20-120
    yellow_lower = np.array([20, 20, 100])
    yellow_upper = np.array([40, 120, 255])
    yellow_mask = cv2.inRange(hsv, yellow_lower, yellow_upper)

    # Combine diseased regions
    diseased_mask = cv2.bitwise_or(brown_mask, dark_mask)
    diseased_mask = cv2.bitwise_or(diseased_mask, yellow_mask)

    # Only count diseased pixels within the leaf
    diseased_on_leaf = cv2.bitwise_and(diseased_mask, diseased_mask, mask=leaf_mask.astype(np.uint8) * 255)

    diseased_pixels = np.sum(diseased_on_leaf > 0)
    infected_ratio = diseased_pixels / total_leaf_pixels

    # Clamp to [0, 1]
    infected_ratio = float(np.clip(infected_ratio, 0.0, 1.0))

    # Bin into severity classes
    if infected_ratio <= 0.25:
        severity_class = 0  # Mild
    elif infected_ratio <= 0.50:
        severity_class = 1  # Moderate
    elif infected_ratio <= 0.75:
        severity_class = 2  # Severe
    else:
        severity_class = 3  # Critical

    return infected_ratio, severity_class


def generate_severity_labels(
    data_root: str | Path,
    cache_path: str | Path | None = None,
) -> dict[str, tuple[float, int]]:
    """
    Generate severity labels for all images in the dataset.

    Args:
        data_root: Path to the PlantVillage dataset root
        cache_path: Optional path to cache results as JSON

    Returns:
        Dict mapping image_path -> (infected_ratio, severity_class)
    """
    data_root = Path(data_root)
    cache_path = Path(cache_path) if cache_path else data_root / "severity_labels.json"

    # Try loading from cache
    if cache_path.exists():
        print(f"Loading cached severity labels from {cache_path}")
        with open(cache_path) as f:
            cached = json.load(f)
        # Convert lists back to tuples
        return {k: (v[0], v[1]) for k, v in cached.items()}

    print("Generating severity labels via color segmentation...")
    severity_labels = {}

    # Iterate over all class directories
    class_dirs = sorted([d for d in data_root.iterdir() if d.is_dir()])

    for class_dir in tqdm(class_dirs, desc="Processing classes"):
        class_name = class_dir.name
        is_healthy = is_healthy_class(class_name)

        image_files = sorted(
            f
            for f in class_dir.iterdir()
            if f.suffix.lower() in (".jpg", ".jpeg", ".png")
        )

        for img_path in image_files:
            rel_path = str(img_path.relative_to(data_root))

            if is_healthy:
                # Healthy plants have 0% infection
                severity_labels[rel_path] = (0.0, 0)
            else:
                ratio, sev_class = estimate_severity_from_image(img_path)
                severity_labels[rel_path] = (ratio, sev_class)

    # Cache results
    print(f"Caching severity labels to {cache_path}")
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_path, "w") as f:
        json.dump({k: list(v) for k, v in severity_labels.items()}, f)

    # Print distribution
    from collections import Counter

    severity_counts = Counter(v[1] for v in severity_labels.values())
    severity_names = ["Mild", "Moderate", "Severe", "Critical"]
    print("\nSeverity distribution:")
    for idx, name in enumerate(severity_names):
        count = severity_counts.get(idx, 0)
        print(f"  {name}: {count} ({100 * count / len(severity_labels):.1f}%)")

    return severity_labels


# ─── Transforms ───────────────────────────────────────────────────────────────


def get_transforms(image_size: int = 256, train: bool = True) -> A.Compose:
    """
    Get augmentation pipeline.

    Args:
        image_size: Target image size (MobileNetV5 supports 256/512/768)
        train: Whether to apply training augmentations
    """
    if train:
        return A.Compose(
            [
                A.RandomResizedCrop(
                    size=(image_size, image_size),
                    scale=(0.8, 1.0),
                    ratio=(0.9, 1.1),
                ),
                A.HorizontalFlip(p=0.5),
                A.VerticalFlip(p=0.2),
                A.Rotate(limit=30, p=0.5),
                A.ColorJitter(
                    brightness=0.2,
                    contrast=0.2,
                    saturation=0.2,
                    hue=0.1,
                    p=0.5,
                ),
                A.GaussianBlur(blur_limit=(3, 5), p=0.2),
                A.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225],
                ),
                ToTensorV2(),
            ]
        )
    else:
        return A.Compose(
            [
                A.Resize(image_size, image_size),
                A.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225],
                ),
                ToTensorV2(),
            ]
        )


# ─── Dataset ─────────────────────────────────────────────────────────────────


class PlantDiseaseDataset(Dataset):
    """
    PlantVillage dataset with disease + severity labels.

    Expects folder structure:
        data_root/
            Apple___Apple_scab/
                image001.jpg
                ...
            Apple___Black_rot/
                ...
    """

    def __init__(
        self,
        image_paths: list[str],
        disease_labels: list[int],
        severity_labels: list[int],
        data_root: str | Path,
        transform: A.Compose | None = None,
    ):
        self.image_paths = image_paths
        self.disease_labels = disease_labels
        self.severity_labels = severity_labels
        self.data_root = Path(data_root)
        self.transform = transform

    def __len__(self) -> int:
        return len(self.image_paths)

    def __getitem__(self, idx: int) -> dict:
        img_path = self.data_root / self.image_paths[idx]
        image = cv2.imread(str(img_path))
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        if self.transform:
            transformed = self.transform(image=image)
            image = transformed["image"]

        return {
            "image": image,
            "disease_label": torch.tensor(self.disease_labels[idx], dtype=torch.long),
            "severity_label": torch.tensor(
                self.severity_labels[idx], dtype=torch.long
            ),
            "path": self.image_paths[idx],
        }


# ─── Data Loaders ─────────────────────────────────────────────────────────────


def create_dataloaders(
    data_root: str | Path,
    image_size: int = 256,
    train_split: float = 0.7,
    val_split: float = 0.15,
    test_split: float = 0.15,
    batch_size: int = 32,
    num_workers: int = 4,
    seed: int = 42,
    severity_method: str = "color_segmentation",
    subset: int | None = None,
) -> tuple[DataLoader, DataLoader, DataLoader, dict]:
    """
    Create train/val/test data loaders.

    Args:
        data_root: Path to PlantVillage dataset root
        image_size: Target image size
        train_split: Fraction for training
        val_split: Fraction for validation
        test_split: Fraction for testing
        batch_size: Batch size
        num_workers: Number of data loading workers
        seed: Random seed
        severity_method: Method for severity labeling
        subset: If set, use only this many samples (for quick testing)

    Returns:
        (train_loader, val_loader, test_loader, info_dict)
    """
    data_root = Path(data_root)

    # Build class-to-index mapping from actual directory contents
    class_dirs = sorted([d.name for d in data_root.iterdir() if d.is_dir()])
    class_to_idx = {cls: idx for idx, cls in enumerate(class_dirs)}

    # Collect all image paths and disease labels
    all_paths: list[str] = []
    all_disease_labels: list[int] = []

    for cls_name in class_dirs:
        cls_dir = data_root / cls_name
        cls_idx = class_to_idx[cls_name]
        for img_path in sorted(cls_dir.iterdir()):
            if img_path.suffix.lower() in (".jpg", ".jpeg", ".png"):
                rel_path = str(img_path.relative_to(data_root))
                all_paths.append(rel_path)
                all_disease_labels.append(cls_idx)

    print(f"Found {len(all_paths)} images across {len(class_dirs)} classes")

    # Generate severity labels
    if severity_method == "color_segmentation":
        severity_map = generate_severity_labels(data_root)
        all_severity_labels = [severity_map[p][1] for p in all_paths]
    else:
        # Default: all Mild
        all_severity_labels = [0] * len(all_paths)

    # Subset for quick testing
    if subset and subset < len(all_paths):
        indices = np.random.RandomState(seed).choice(
            len(all_paths), size=subset, replace=False
        )
        all_paths = [all_paths[i] for i in indices]
        all_disease_labels = [all_disease_labels[i] for i in indices]
        all_severity_labels = [all_severity_labels[i] for i in indices]
        print(f"Using subset of {subset} images")

    # Stratified split (stratify by disease label)
    # First split: train vs (val + test)
    val_test_ratio = val_split + test_split
    train_paths, valtest_paths, train_disease, valtest_disease, train_severity, valtest_severity = train_test_split(
        all_paths,
        all_disease_labels,
        all_severity_labels,
        test_size=val_test_ratio,
        stratify=all_disease_labels,
        random_state=seed,
    )

    # Second split: val vs test
    val_ratio_of_valtest = val_split / val_test_ratio
    val_paths, test_paths, val_disease, test_disease, val_severity, test_severity = train_test_split(
        valtest_paths,
        valtest_disease,
        valtest_severity,
        test_size=(1 - val_ratio_of_valtest),
        stratify=valtest_disease,
        random_state=seed,
    )

    print(f"Split: train={len(train_paths)}, val={len(val_paths)}, test={len(test_paths)}")

    # Create datasets
    train_dataset = PlantDiseaseDataset(
        train_paths, train_disease, train_severity, data_root,
        transform=get_transforms(image_size, train=True),
    )
    val_dataset = PlantDiseaseDataset(
        val_paths, val_disease, val_severity, data_root,
        transform=get_transforms(image_size, train=False),
    )
    test_dataset = PlantDiseaseDataset(
        test_paths, test_disease, test_severity, data_root,
        transform=get_transforms(image_size, train=False),
    )

    # Create data loaders
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=True,
        drop_last=True,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True,
    )
    test_loader = DataLoader(
        test_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True,
    )

    info = {
        "num_classes": len(class_dirs),
        "class_names": class_dirs,
        "class_to_idx": class_to_idx,
        "train_size": len(train_paths),
        "val_size": len(val_paths),
        "test_size": len(test_paths),
    }

    return train_loader, val_loader, test_loader, info
