"""
Evaluation module for multi-task model.

Generates:
  - Per-task accuracy, precision, recall, F1 (macro + weighted)
  - Confusion matrices (38×38 disease, 4×4 severity)
  - Classification reports
  - Sample Grad-CAM visualizations

Usage:
    uv run python -m src.evaluate --checkpoint outputs/best_model.pth
"""

import argparse
import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import torch
import torch.nn.functional as F
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from tqdm import tqdm

from .dataset import create_dataloaders, get_transforms
from .gradcam import GradCAM
from .model import MultiTaskMobileNetV5
from .utils import (
    DISEASE_CLASSES,
    SEVERITY_CLASSES,
    ensure_dir,
    get_device,
    get_disease_name,
    load_config,
)


@torch.no_grad()
def collect_predictions(
    model: MultiTaskMobileNetV5,
    loader: torch.utils.data.DataLoader,
    device: torch.device,
) -> dict:
    """Collect all predictions and ground truths from a data loader."""
    model.eval()

    all_disease_preds = []
    all_disease_labels = []
    all_severity_preds = []
    all_severity_labels = []
    all_disease_probs = []
    all_severity_probs = []
    all_paths = []

    for batch in tqdm(loader, desc="Evaluating"):
        images = batch["image"].to(device)
        disease_labels = batch["disease_label"]
        severity_labels = batch["severity_label"]
        paths = batch["path"]

        disease_logits, severity_logits = model(images)

        disease_probs = F.softmax(disease_logits, dim=1).cpu()
        severity_probs = F.softmax(severity_logits, dim=1).cpu()

        disease_preds = disease_logits.argmax(dim=1).cpu()
        severity_preds = severity_logits.argmax(dim=1).cpu()

        all_disease_preds.extend(disease_preds.tolist())
        all_disease_labels.extend(disease_labels.tolist())
        all_severity_preds.extend(severity_preds.tolist())
        all_severity_labels.extend(severity_labels.tolist())
        all_disease_probs.append(disease_probs)
        all_severity_probs.append(severity_probs)
        all_paths.extend(paths)

    return {
        "disease_preds": all_disease_preds,
        "disease_labels": all_disease_labels,
        "severity_preds": all_severity_preds,
        "severity_labels": all_severity_labels,
        "disease_probs": torch.cat(all_disease_probs, dim=0),
        "severity_probs": torch.cat(all_severity_probs, dim=0),
        "paths": all_paths,
    }


def compute_metrics(labels: list[int], preds: list[int], class_names: list[str]) -> dict:
    """Compute classification metrics."""
    return {
        "accuracy": accuracy_score(labels, preds),
        "precision_macro": precision_score(labels, preds, average="macro", zero_division=0),
        "recall_macro": recall_score(labels, preds, average="macro", zero_division=0),
        "f1_macro": f1_score(labels, preds, average="macro", zero_division=0),
        "f1_weighted": f1_score(labels, preds, average="weighted", zero_division=0),
        "classification_report": classification_report(
            labels, preds, target_names=class_names, zero_division=0
        ),
    }


def plot_confusion_matrix(
    labels: list[int],
    preds: list[int],
    class_names: list[str],
    title: str,
    output_path: Path,
    figsize: tuple = None,
) -> None:
    """Plot and save confusion matrix."""
    cm = confusion_matrix(labels, preds)

    if figsize is None:
        n = len(class_names)
        figsize = (max(10, n * 0.4), max(8, n * 0.35))

    fig, ax = plt.subplots(figsize=figsize)

    # For disease matrix (38 classes), don't show annotations
    annot = len(class_names) <= 10

    sns.heatmap(
        cm,
        annot=annot,
        fmt="d" if annot else "",
        cmap="Blues",
        xticklabels=class_names,
        yticklabels=class_names,
        ax=ax,
    )
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(title)

    plt.xticks(rotation=45, ha="right", fontsize=6 if len(class_names) > 10 else 10)
    plt.yticks(fontsize=6 if len(class_names) > 10 else 10)
    plt.tight_layout()
    plt.savefig(str(output_path), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"Saved: {output_path}")


def generate_sample_gradcams(
    model: MultiTaskMobileNetV5,
    predictions: dict,
    data_root: Path,
    output_dir: Path,
    device: torch.device,
    num_samples: int = 16,
) -> None:
    """Generate Grad-CAM visualizations for sample images."""
    from .gradcam import generate_gradcam_visualization

    gradcam_dir = ensure_dir(output_dir / "gradcam")
    transform = get_transforms(image_size=256, train=False)

    # Select samples: mix of correct and incorrect predictions
    correct_indices = [
        i
        for i in range(len(predictions["paths"]))
        if predictions["disease_preds"][i] == predictions["disease_labels"][i]
    ]
    incorrect_indices = [
        i
        for i in range(len(predictions["paths"]))
        if predictions["disease_preds"][i] != predictions["disease_labels"][i]
    ]

    # Take half correct, half incorrect
    rng = np.random.RandomState(42)
    n_correct = min(num_samples // 2, len(correct_indices))
    n_incorrect = min(num_samples - n_correct, len(incorrect_indices))

    selected = []
    if correct_indices:
        selected += rng.choice(correct_indices, size=n_correct, replace=False).tolist()
    if incorrect_indices:
        selected += rng.choice(incorrect_indices, size=n_incorrect, replace=False).tolist()

    for idx in tqdm(selected, desc="Generating Grad-CAMs"):
        img_path = data_root / predictions["paths"][idx]
        true_label = predictions["disease_labels"][idx]
        pred_label = predictions["disease_preds"][idx]
        correct = "correct" if true_label == pred_label else "incorrect"

        output_path = gradcam_dir / f"{correct}_{idx}_{Path(predictions['paths'][idx]).stem}.png"

        try:
            generate_gradcam_visualization(
                model=model,
                image_path=img_path,
                device=device,
                transform=transform,
                output_path=output_path,
                head="disease",
            )
        except Exception as e:
            print(f"  Failed for {img_path}: {e}")


def evaluate(config: dict, checkpoint_path: str) -> None:
    """Run full evaluation pipeline."""
    data_cfg = config["data"]
    model_cfg = config["model"]
    train_cfg = config["training"]

    output_dir = ensure_dir(Path(train_cfg["output_dir"]) / "evaluation")
    device = get_device(train_cfg["device"])

    # Load model
    print("Loading model checkpoint...")
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)

    model = MultiTaskMobileNetV5(
        backbone_name=model_cfg["backbone"],
        pretrained=False,
        num_disease_classes=model_cfg["num_disease_classes"],
        num_severity_classes=model_cfg["num_severity_classes"],
        dropout=model_cfg["dropout"],
        freeze_backbone=False,
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model = model.to(device)

    # Load data
    _, _, test_loader, data_info = create_dataloaders(
        data_root=data_cfg["root"],
        image_size=data_cfg["image_size"],
        train_split=data_cfg["train_split"],
        val_split=data_cfg["val_split"],
        test_split=data_cfg["test_split"],
        batch_size=train_cfg["batch_size"],
        num_workers=data_cfg.get("num_workers", 4),
        seed=train_cfg["seed"],
        severity_method=data_cfg["severity_method"],
    )

    # Collect predictions
    print("\nCollecting predictions on test set...")
    predictions = collect_predictions(model, test_loader, device)

    # ── Disease Classification Metrics ──
    print("\n" + "=" * 60)
    print("DISEASE CLASSIFICATION METRICS")
    print("=" * 60)

    disease_class_names = data_info["class_names"]
    disease_metrics = compute_metrics(
        predictions["disease_labels"],
        predictions["disease_preds"],
        disease_class_names,
    )

    print(f"Accuracy: {disease_metrics['accuracy']:.4f}")
    print(f"Precision (macro): {disease_metrics['precision_macro']:.4f}")
    print(f"Recall (macro): {disease_metrics['recall_macro']:.4f}")
    print(f"F1 (macro): {disease_metrics['f1_macro']:.4f}")
    print(f"F1 (weighted): {disease_metrics['f1_weighted']:.4f}")
    print(f"\n{disease_metrics['classification_report']}")

    # Save disease report
    with open(output_dir / "disease_classification_report.txt", "w") as f:
        f.write(f"Disease Classification Report\n{'=' * 50}\n")
        f.write(f"Accuracy: {disease_metrics['accuracy']:.4f}\n")
        f.write(f"Precision (macro): {disease_metrics['precision_macro']:.4f}\n")
        f.write(f"Recall (macro): {disease_metrics['recall_macro']:.4f}\n")
        f.write(f"F1 (macro): {disease_metrics['f1_macro']:.4f}\n")
        f.write(f"F1 (weighted): {disease_metrics['f1_weighted']:.4f}\n\n")
        f.write(disease_metrics["classification_report"])

    # Disease confusion matrix
    plot_confusion_matrix(
        predictions["disease_labels"],
        predictions["disease_preds"],
        disease_class_names,
        "Disease Classification Confusion Matrix",
        output_dir / "disease_confusion_matrix.png",
    )

    # ── Severity Estimation Metrics ──
    print("\n" + "=" * 60)
    print("SEVERITY ESTIMATION METRICS")
    print("=" * 60)

    severity_metrics = compute_metrics(
        predictions["severity_labels"],
        predictions["severity_preds"],
        SEVERITY_CLASSES,
    )

    print(f"Accuracy: {severity_metrics['accuracy']:.4f}")
    print(f"Precision (macro): {severity_metrics['precision_macro']:.4f}")
    print(f"Recall (macro): {severity_metrics['recall_macro']:.4f}")
    print(f"F1 (macro): {severity_metrics['f1_macro']:.4f}")
    print(f"F1 (weighted): {severity_metrics['f1_weighted']:.4f}")
    print(f"\n{severity_metrics['classification_report']}")

    # Save severity report
    with open(output_dir / "severity_classification_report.txt", "w") as f:
        f.write(f"Severity Estimation Report\n{'=' * 50}\n")
        f.write(f"Accuracy: {severity_metrics['accuracy']:.4f}\n")
        f.write(f"Precision (macro): {severity_metrics['precision_macro']:.4f}\n")
        f.write(f"Recall (macro): {severity_metrics['recall_macro']:.4f}\n")
        f.write(f"F1 (macro): {severity_metrics['f1_macro']:.4f}\n")
        f.write(f"F1 (weighted): {severity_metrics['f1_weighted']:.4f}\n\n")
        f.write(severity_metrics["classification_report"])

    # Severity confusion matrix
    plot_confusion_matrix(
        predictions["severity_labels"],
        predictions["severity_preds"],
        SEVERITY_CLASSES,
        "Severity Estimation Confusion Matrix",
        output_dir / "severity_confusion_matrix.png",
        figsize=(8, 6),
    )

    # ── Grad-CAM Samples ──
    print("\n" + "=" * 60)
    print("GENERATING GRAD-CAM VISUALIZATIONS")
    print("=" * 60)

    generate_sample_gradcams(
        model=model,
        predictions=predictions,
        data_root=Path(data_cfg["root"]),
        output_dir=output_dir,
        device=device,
        num_samples=16,
    )

    # ── Save summary ──
    summary = {
        "disease": {
            "accuracy": disease_metrics["accuracy"],
            "precision_macro": disease_metrics["precision_macro"],
            "recall_macro": disease_metrics["recall_macro"],
            "f1_macro": disease_metrics["f1_macro"],
            "f1_weighted": disease_metrics["f1_weighted"],
        },
        "severity": {
            "accuracy": severity_metrics["accuracy"],
            "precision_macro": severity_metrics["precision_macro"],
            "recall_macro": severity_metrics["recall_macro"],
            "f1_macro": severity_metrics["f1_macro"],
            "f1_weighted": severity_metrics["f1_weighted"],
        },
        "test_samples": len(predictions["paths"]),
        "checkpoint": checkpoint_path,
    }

    with open(output_dir / "evaluation_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\nAll results saved to: {output_dir}")


def main():
    parser = argparse.ArgumentParser(description="Evaluate trained model")
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
    args = parser.parse_args()

    config = load_config(args.config)
    evaluate(config, args.checkpoint)


if __name__ == "__main__":
    main()
