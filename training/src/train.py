"""
Multi-task training loop with two-phase training strategy.

Phase 1: Frozen backbone, train heads only (higher LR)
Phase 2: Unfreeze last N backbone blocks, fine-tune with lower LR

Combined loss: total = w_disease * CE(disease) + w_severity * CE(severity)

Usage:
    uv run python -m src.train --config configs/default.yaml
    uv run python -m src.train --config configs/default.yaml --epochs 1 --subset 100
"""

import argparse
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.tensorboard import SummaryWriter
from tqdm import tqdm

from .dataset import create_dataloaders
from .model import MultiTaskMobileNetV5
from .utils import ensure_dir, get_device, load_config, set_seed


def train_one_epoch(
    model: MultiTaskMobileNetV5,
    loader: torch.utils.data.DataLoader,
    optimizer: torch.optim.Optimizer,
    disease_criterion: nn.Module,
    severity_criterion: nn.Module,
    device: torch.device,
    w_disease: float = 1.0,
    w_severity: float = 0.5,
) -> dict[str, float]:
    """Train for one epoch."""
    model.train()

    total_loss = 0.0
    total_disease_loss = 0.0
    total_severity_loss = 0.0
    disease_correct = 0
    severity_correct = 0
    total_samples = 0

    pbar = tqdm(loader, desc="Training", leave=False)
    for batch in pbar:
        images = batch["image"].to(device)
        disease_labels = batch["disease_label"].to(device)
        severity_labels = batch["severity_label"].to(device)

        # Forward pass
        disease_logits, severity_logits = model(images)

        # Compute losses
        d_loss = disease_criterion(disease_logits, disease_labels)
        s_loss = severity_criterion(severity_logits, severity_labels)
        loss = w_disease * d_loss + w_severity * s_loss

        # Backward pass
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        # Track metrics
        batch_size = images.size(0)
        total_loss += loss.item() * batch_size
        total_disease_loss += d_loss.item() * batch_size
        total_severity_loss += s_loss.item() * batch_size

        disease_preds = disease_logits.argmax(dim=1)
        severity_preds = severity_logits.argmax(dim=1)
        disease_correct += (disease_preds == disease_labels).sum().item()
        severity_correct += (severity_preds == severity_labels).sum().item()
        total_samples += batch_size

        pbar.set_postfix(
            loss=f"{loss.item():.4f}",
            d_acc=f"{100 * disease_correct / total_samples:.1f}%",
            s_acc=f"{100 * severity_correct / total_samples:.1f}%",
        )

    return {
        "loss": total_loss / total_samples,
        "disease_loss": total_disease_loss / total_samples,
        "severity_loss": total_severity_loss / total_samples,
        "disease_acc": disease_correct / total_samples,
        "severity_acc": severity_correct / total_samples,
    }


@torch.no_grad()
def validate(
    model: MultiTaskMobileNetV5,
    loader: torch.utils.data.DataLoader,
    disease_criterion: nn.Module,
    severity_criterion: nn.Module,
    device: torch.device,
    w_disease: float = 1.0,
    w_severity: float = 0.5,
) -> dict[str, float]:
    """Validate the model."""
    model.eval()

    total_loss = 0.0
    total_disease_loss = 0.0
    total_severity_loss = 0.0
    disease_correct = 0
    severity_correct = 0
    total_samples = 0

    for batch in tqdm(loader, desc="Validating", leave=False):
        images = batch["image"].to(device)
        disease_labels = batch["disease_label"].to(device)
        severity_labels = batch["severity_label"].to(device)

        disease_logits, severity_logits = model(images)

        d_loss = disease_criterion(disease_logits, disease_labels)
        s_loss = severity_criterion(severity_logits, severity_labels)
        loss = w_disease * d_loss + w_severity * s_loss

        batch_size = images.size(0)
        total_loss += loss.item() * batch_size
        total_disease_loss += d_loss.item() * batch_size
        total_severity_loss += s_loss.item() * batch_size

        disease_preds = disease_logits.argmax(dim=1)
        severity_preds = severity_logits.argmax(dim=1)
        disease_correct += (disease_preds == disease_labels).sum().item()
        severity_correct += (severity_preds == severity_labels).sum().item()
        total_samples += batch_size

    return {
        "loss": total_loss / total_samples,
        "disease_loss": total_disease_loss / total_samples,
        "severity_loss": total_severity_loss / total_samples,
        "disease_acc": disease_correct / total_samples,
        "severity_acc": severity_correct / total_samples,
    }


def train(config: dict, epochs_override: int | None = None, subset: int | None = None) -> None:
    """Run the full training pipeline."""
    # Extract config sections
    data_cfg = config["data"]
    model_cfg = config["model"]
    train_cfg = config["training"]

    epochs = epochs_override or train_cfg["epochs"]
    output_dir = ensure_dir(train_cfg["output_dir"])
    device = get_device(train_cfg["device"])

    set_seed(train_cfg["seed"])

    # ── Create data loaders ──
    print("\n" + "=" * 60)
    print("LOADING DATASET")
    print("=" * 60)

    train_loader, val_loader, test_loader, data_info = create_dataloaders(
        data_root=data_cfg["root"],
        image_size=data_cfg["image_size"],
        train_split=data_cfg["train_split"],
        val_split=data_cfg["val_split"],
        test_split=data_cfg["test_split"],
        batch_size=train_cfg["batch_size"],
        num_workers=data_cfg.get("num_workers", 4),
        seed=train_cfg["seed"],
        severity_method=data_cfg["severity_method"],
        subset=subset,
    )

    # ── Create model ──
    print("\n" + "=" * 60)
    print("BUILDING MODEL")
    print("=" * 60)

    model = MultiTaskMobileNetV5(
        backbone_name=model_cfg["backbone"],
        pretrained=model_cfg["pretrained"],
        num_disease_classes=model_cfg["num_disease_classes"],
        num_severity_classes=model_cfg["num_severity_classes"],
        dropout=model_cfg["dropout"],
        freeze_backbone=model_cfg["freeze_backbone"],
    )
    print(model.summary())
    model = model.to(device)

    # ── Loss functions ──
    disease_criterion = nn.CrossEntropyLoss()
    severity_criterion = nn.CrossEntropyLoss()

    # ── TensorBoard ──
    writer = SummaryWriter(log_dir=str(output_dir / "tensorboard"))

    # ── Training ──
    print("\n" + "=" * 60)
    print("TRAINING")
    print("=" * 60)

    best_val_loss = float("inf")
    patience_counter = 0
    fine_tune_after = train_cfg["fine_tune_after_epoch"]
    patience = train_cfg["early_stopping_patience"]

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()

        # ── Phase transition: unfreeze backbone ──
        if epoch == fine_tune_after + 1:
            print(f"\n{'=' * 60}")
            print(f"PHASE 2: Unfreezing backbone (epoch {epoch})")
            print(f"{'=' * 60}")
            model.unfreeze_backbone(num_blocks=train_cfg["unfreeze_blocks"])

        # ── Set up optimizer (recreate after phase transition) ──
        if epoch == 1 or epoch == fine_tune_after + 1:
            param_groups = model.get_trainable_params()

            if epoch <= fine_tune_after:
                # Phase 1: Train heads only
                lr = train_cfg["lr"]
                for pg in param_groups:
                    pg["lr"] = lr
            else:
                # Phase 2: Fine-tune with differential LR
                for pg in param_groups:
                    if pg["name"] == "backbone":
                        pg["lr"] = train_cfg["fine_tune_lr"]
                    else:
                        pg["lr"] = train_cfg["fine_tune_lr"] * 10  # Heads get 10x backbone LR

            optimizer = torch.optim.AdamW(param_groups, weight_decay=1e-4)
            print(f"Optimizer reset: {[{pg['name']: pg['lr']} for pg in param_groups]}")

        # ── Train ──
        phase = "Phase 1 (frozen)" if epoch <= fine_tune_after else "Phase 2 (fine-tune)"
        print(f"\nEpoch {epoch}/{epochs} [{phase}]")

        train_metrics = train_one_epoch(
            model, train_loader, optimizer,
            disease_criterion, severity_criterion, device,
            w_disease=train_cfg["loss_weight_disease"],
            w_severity=train_cfg["loss_weight_severity"],
        )

        val_metrics = validate(
            model, val_loader,
            disease_criterion, severity_criterion, device,
            w_disease=train_cfg["loss_weight_disease"],
            w_severity=train_cfg["loss_weight_severity"],
        )

        epoch_time = time.time() - epoch_start

        # ── Log metrics ──
        print(
            f"  Train: loss={train_metrics['loss']:.4f}, "
            f"disease_acc={100 * train_metrics['disease_acc']:.2f}%, "
            f"severity_acc={100 * train_metrics['severity_acc']:.2f}%"
        )
        print(
            f"  Val:   loss={val_metrics['loss']:.4f}, "
            f"disease_acc={100 * val_metrics['disease_acc']:.2f}%, "
            f"severity_acc={100 * val_metrics['severity_acc']:.2f}%"
        )
        print(f"  Time: {epoch_time:.1f}s")

        # TensorBoard
        for prefix, metrics in [("train", train_metrics), ("val", val_metrics)]:
            for key, value in metrics.items():
                writer.add_scalar(f"{prefix}/{key}", value, epoch)

        # ── Early stopping / checkpointing ──
        if val_metrics["loss"] < best_val_loss:
            best_val_loss = val_metrics["loss"]
            patience_counter = 0

            # Save best model
            checkpoint = {
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_loss": best_val_loss,
                "val_disease_acc": val_metrics["disease_acc"],
                "val_severity_acc": val_metrics["severity_acc"],
                "config": config,
                "data_info": data_info,
            }
            torch.save(checkpoint, output_dir / "best_model.pth")
            print(f"  ✓ Saved best model (val_loss={best_val_loss:.4f})")
        else:
            patience_counter += 1
            print(f"  No improvement ({patience_counter}/{patience})")

            if patience_counter >= patience:
                print(f"\nEarly stopping triggered after {epoch} epochs")
                break

    # ── Save final model ──
    torch.save(
        {
            "epoch": epoch,
            "model_state_dict": model.state_dict(),
            "config": config,
            "data_info": data_info,
        },
        output_dir / "final_model.pth",
    )

    writer.close()

    print(f"\n{'=' * 60}")
    print("TRAINING COMPLETE")
    print(f"{'=' * 60}")
    print(f"Best validation loss: {best_val_loss:.4f}")
    print(f"Models saved to: {output_dir}")
    print(f"TensorBoard logs: {output_dir / 'tensorboard'}")
    print(f"Run: tensorboard --logdir {output_dir / 'tensorboard'}")


def main():
    parser = argparse.ArgumentParser(description="Train Multi-Task MobileNetV5")
    parser.add_argument(
        "--config",
        type=str,
        default="configs/default.yaml",
        help="Path to config file",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=None,
        help="Override number of epochs",
    )
    parser.add_argument(
        "--subset",
        type=int,
        default=None,
        help="Use only N samples (for quick testing)",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    train(config, epochs_override=args.epochs, subset=args.subset)


if __name__ == "__main__":
    main()
