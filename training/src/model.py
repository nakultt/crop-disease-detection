"""
Multi-Task MobileNetV5 model architecture.

Uses MobileNetV5 (mobilenetv5_300m.gemma3n) from timm as the backbone,
with two task-specific heads:
  - Disease Classification Head (38 classes)
  - Severity Estimation Head (4 classes: Mild/Moderate/Severe/Critical)
"""

import torch
import torch.nn as nn
import timm


class MultiTaskMobileNetV5(nn.Module):
    """
    Multi-task model with MobileNetV5 backbone and two classification heads.

    The backbone's feature dimension is auto-detected via a dummy forward pass,
    since MobileNetV5's output dim differs from MobileNetV2's fixed 1280.
    """

    def __init__(
        self,
        backbone_name: str = "hf_hub:timm/mobilenetv5_300m.gemma3n",
        pretrained: bool = True,
        num_disease_classes: int = 38,
        num_severity_classes: int = 4,
        dropout: float = 0.3,
        freeze_backbone: bool = True,
    ):
        super().__init__()

        self.backbone_name = backbone_name
        self.num_disease_classes = num_disease_classes
        self.num_severity_classes = num_severity_classes

        # Load MobileNetV5 backbone (num_classes=0 strips the classification head)
        print(f"Loading backbone: {backbone_name} (pretrained={pretrained})")
        self.backbone = timm.create_model(
            backbone_name,
            pretrained=pretrained,
            num_classes=0,  # Remove classification head → feature extractor only
        )

        # Auto-detect feature dimension via dummy forward pass
        with torch.no_grad():
            dummy_input = torch.randn(1, 3, 256, 256)
            features = self.backbone(dummy_input)
            self.feature_dim = features.shape[-1]

        print(f"Backbone feature dimension: {self.feature_dim}")

        # Disease Classification Head
        self.disease_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(self.feature_dim, num_disease_classes),
        )

        # Severity Estimation Head
        self.severity_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(self.feature_dim, num_severity_classes),
        )

        # Optionally freeze backbone
        if freeze_backbone:
            self.freeze_backbone()

    def freeze_backbone(self) -> None:
        """Freeze all backbone parameters."""
        for param in self.backbone.parameters():
            param.requires_grad = False
        print("Backbone frozen (heads only will be trained)")

    def unfreeze_backbone(self, num_blocks: int = 3) -> None:
        """
        Unfreeze the last N blocks of the backbone for fine-tuning.

        Args:
            num_blocks: Number of blocks to unfreeze from the end
        """
        # First, freeze everything
        for param in self.backbone.parameters():
            param.requires_grad = False

        # Get all named children of the backbone
        children = list(self.backbone.named_children())

        # Unfreeze the last num_blocks modules
        modules_to_unfreeze = children[-num_blocks:] if num_blocks > 0 else []

        unfrozen_count = 0
        for name, module in modules_to_unfreeze:
            for param in module.parameters():
                param.requires_grad = True
                unfrozen_count += 1

        total_params = sum(1 for _ in self.backbone.parameters())
        print(
            f"Unfroze last {num_blocks} blocks: "
            f"{unfrozen_count}/{total_params} backbone parameters trainable"
        )

    def forward(
        self, x: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Forward pass.

        Args:
            x: Input tensor of shape (B, 3, H, W)

        Returns:
            (disease_logits, severity_logits)
            disease_logits: shape (B, 38)
            severity_logits: shape (B, 4)
        """
        # Extract features from backbone
        features = self.backbone(x)  # (B, feature_dim)

        # Task-specific heads
        disease_logits = self.disease_head(features)  # (B, 38)
        severity_logits = self.severity_head(features)  # (B, 4)

        return disease_logits, severity_logits

    def get_features(self, x: torch.Tensor) -> torch.Tensor:
        """Extract backbone features without passing through heads."""
        return self.backbone(x)

    def get_trainable_params(self) -> list[dict]:
        """
        Get parameter groups for optimizer with different learning rates.

        Returns a list of param groups:
          - Backbone params (lower LR for fine-tuning)
          - Head params (higher LR)
        """
        backbone_params = [
            p for p in self.backbone.parameters() if p.requires_grad
        ]
        head_params = list(self.disease_head.parameters()) + list(
            self.severity_head.parameters()
        )

        param_groups = []

        if backbone_params:
            param_groups.append(
                {"params": backbone_params, "name": "backbone"}
            )

        param_groups.append({"params": head_params, "name": "heads"})

        return param_groups

    @property
    def total_params(self) -> int:
        return sum(p.numel() for p in self.parameters())

    @property
    def trainable_params(self) -> int:
        return sum(p.numel() for p in self.parameters() if p.requires_grad)

    def summary(self) -> str:
        """Print model summary."""
        lines = [
            f"MultiTaskMobileNetV5",
            f"  Backbone: {self.backbone_name}",
            f"  Feature dim: {self.feature_dim}",
            f"  Disease classes: {self.num_disease_classes}",
            f"  Severity classes: {self.num_severity_classes}",
            f"  Total params: {self.total_params:,}",
            f"  Trainable params: {self.trainable_params:,}",
            f"  Frozen params: {self.total_params - self.trainable_params:,}",
        ]
        return "\n".join(lines)
