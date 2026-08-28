"""
Multi-task plant disease model: one backbone, two linear heads.

The module is deliberately structured so that **Class Activation Mapping is
exact**, not an approximation. See ``docs/MODEL_CONTRACT.md`` section 3 for the
derivation. The short version::

    x -> backbone (global_pool='') -> S   [B, C, h, w]
      -> S.mean((2, 3))            -> f   [B, C]
      -> Dropout -> Linear(W, b)   -> logits

Because *we* own the global-average-pool -- rather than letting timm fold it
into its own head, where a non-linearity sits between the pool and the
classifier -- the identity

    logit_k - b_k = mean_{i,j} ( sum_c W[k, c] * S[c, i, j] )

holds exactly. The bracketed term is the CAM for class ``k``, and for this
architecture it is identical to Grad-CAM, with no backward pass required.

Keeping ``global_pool=''`` and a single ``Linear`` per head is therefore a
*correctness constraint*, not a style choice.
"""

from __future__ import annotations

import timm
import torch
import torch.nn as nn

# --- Backbone presets --------------------------------------------------------
#
# Approximate fp32 ONNX sizes for the full multi-task model at 256x256.
# Deployment budgets (docs/MODEL_CONTRACT.md section 7): 32 MB web, 48 MB Android.

BACKBONE_PRESETS: dict[str, dict[str, object]] = {
    "mobile": {
        "name": "mobilenetv4_conv_small.e2400_r224_in1k",
        "params_m": 3.8,
        "onnx_mb": 15,
        "targets": ("web", "android", "server"),
        "note": "Default. Fits every deployment target with room to spare.",
    },
    "balanced": {
        "name": "efficientnet_b0.ra4_e3600_r224_in1k",
        "params_m": 5.3,
        "onnx_mb": 21,
        "targets": ("web", "android", "server"),
        "note": "A point or two more accuracy than `mobile` for ~6 MB.",
    },
    "large": {
        "name": "mobilenetv4_conv_medium.e500_r256_in1k",
        "params_m": 9.7,
        "onnx_mb": 39,
        "targets": ("android", "server"),
        "note": "Over the 32 MB web budget; fine for Android and server.",
    },
    "server": {
        "name": "hf_hub:timm/mobilenetv5_300m.gemma3n",
        "params_m": 300.0,
        "onnx_mb": 1170,
        "targets": ("server",),
        "note": "1.17 GB fp32. Cannot be deployed to a browser or an APK.",
    },
}

DEFAULT_BACKBONE: str = str(BACKBONE_PRESETS["mobile"]["name"])


def resolve_backbone(name: str) -> str:
    """Map a preset key (``mobile``, ``server``, ...) to a timm model name.

    Anything that is not a preset key passes through untouched, so a config may
    still name a timm model directly.
    """
    preset = BACKBONE_PRESETS.get(name)
    return str(preset["name"]) if preset else name


class MultiTaskPlantModel(nn.Module):
    """Shared backbone with a disease head (38-way) and a severity head (4-way).

    Args:
        backbone_name: A preset key from :data:`BACKBONE_PRESETS`, or any timm
            model name.
        pretrained: Load ImageNet weights for the backbone.
        num_disease_classes: Size of the disease head.
        num_severity_classes: Size of the severity head.
        dropout: Dropout on the pooled feature vector, before each ``Linear``.
            It must stay *before* the ``Linear`` for CAM exactness.
        freeze_backbone: Start with the backbone frozen (phase-1 training).
        image_size: Square input resolution, used to probe the feature grid.
    """

    def __init__(
        self,
        backbone_name: str = DEFAULT_BACKBONE,
        pretrained: bool = True,
        num_disease_classes: int = 38,
        num_severity_classes: int = 4,
        dropout: float = 0.3,
        freeze_backbone: bool = True,
        image_size: int = 256,
    ) -> None:
        super().__init__()

        self.backbone_name = resolve_backbone(backbone_name)
        self.num_disease_classes = num_disease_classes
        self.num_severity_classes = num_severity_classes
        self.image_size = image_size

        # global_pool="" keeps the spatial grid intact so we can pool it
        # ourselves. This is what makes CAM exact.
        self.backbone = timm.create_model(
            self.backbone_name,
            pretrained=pretrained,
            num_classes=0,
            global_pool="",
        )

        # Probe the backbone to learn its channel count and grid size, and to
        # confirm it really does hand back a 4-D spatial map.
        self.cam_exact = True
        with torch.no_grad():
            probe = self.backbone(torch.zeros(1, 3, image_size, image_size))

        if probe.ndim != 4:
            # Transformer-style backbones return tokens. Fall back to timm's own
            # feature extractor and record that CAM is no longer exact.
            self.cam_exact = False
            with torch.no_grad():
                probe = self.backbone.forward_features(
                    torch.zeros(1, 3, image_size, image_size)
                )
            if probe.ndim != 4:
                raise ValueError(
                    f"Backbone {self.backbone_name!r} produces a {probe.ndim}-D "
                    "feature map; CAM requires a 4-D [B, C, h, w] grid. "
                    "Choose a convolutional backbone."
                )

        self.feature_dim: int = int(probe.shape[1])
        self.cam_grid: tuple[int, int] = (int(probe.shape[2]), int(probe.shape[3]))

        self.dropout = nn.Dropout(p=dropout)
        self.disease_head = nn.Linear(self.feature_dim, num_disease_classes)
        self.severity_head = nn.Linear(self.feature_dim, num_severity_classes)

        if freeze_backbone:
            self.freeze_backbone()

    # --- Feature extraction --------------------------------------------------

    def feature_map(self, x: torch.Tensor) -> torch.Tensor:
        """Spatial feature map ``S`` of shape ``[B, C, h, w]``."""
        if self.cam_exact:
            return self.backbone(x)
        return self.backbone.forward_features(x)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """Returns ``(disease_logits, severity_logits)``."""
        s = self.feature_map(x)
        f = self.dropout(s.mean(dim=(2, 3)))
        return self.disease_head(f), self.severity_head(f)

    def forward_with_cam(
        self, x: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        """Returns ``(disease_logits, severity_logits, disease_cam, severity_cam)``.

        The CAM cubes are ``[B, K, h, w]`` -- one activation map per class. This
        is the shape the exported ONNX graph emits, so clients need no
        gradients to explain a prediction.
        """
        s = self.feature_map(x)
        f = self.dropout(s.mean(dim=(2, 3)))

        disease_logits = self.disease_head(f)
        severity_logits = self.severity_head(f)

        # An einsum over channels is exactly a 1x1 convolution with the head's
        # weight matrix.
        disease_cam = torch.einsum("kc,bchw->bkhw", self.disease_head.weight, s)
        severity_cam = torch.einsum("kc,bchw->bkhw", self.severity_head.weight, s)

        return disease_logits, severity_logits, disease_cam, severity_cam

    # --- Freezing and fine-tuning --------------------------------------------

    def freeze_backbone(self) -> None:
        for p in self.backbone.parameters():
            p.requires_grad = False

    def unfreeze_backbone(self, num_blocks: int = 3) -> int:
        """Unfreeze the last ``num_blocks`` stages of the backbone.

        "Last N modules" is not the same as "last N blocks". timm backbones end
        in a run of parameterless modules (``global_pool``, ``flatten``, and an
        ``Identity`` classifier once ``num_classes=0``), so naively taking the
        last N ``named_children`` unfreezes nothing at all and turns phase-2
        fine-tuning into a silent no-op.

        Instead this walks into the ``blocks`` stack, unfreezes its last N
        stages, and unfreezes everything downstream of it (``conv_head``,
        ``norm_head``, ...), which is the intended meaning.

        Returns the number of parameter tensors made trainable.
        """
        for p in self.backbone.parameters():
            p.requires_grad = False

        if num_blocks <= 0:
            return 0

        children = list(self.backbone.named_children())
        block_index = next(
            (i for i, (name, _) in enumerate(children) if name == "blocks"), None
        )

        modules: list[nn.Module] = []
        if block_index is not None:
            stages = list(self.backbone.blocks)  # type: ignore[union-attr]
            modules.extend(stages[-num_blocks:])
            modules.extend(module for _name, module in children[block_index + 1 :])
        else:
            # Backbone has no `blocks` attribute: fall back to the last N
            # top-level children that actually own parameters.
            parameterised = [
                module
                for _name, module in children
                if any(p.numel() for p in module.parameters())
            ]
            modules.extend(parameterised[-num_blocks:])

        unfrozen = 0
        for module in modules:
            for p in module.parameters():
                p.requires_grad = True
                unfrozen += 1
        return unfrozen

    def param_groups(self, backbone_lr: float, head_lr: float) -> list[dict]:
        """Optimiser param groups: a lower LR for the backbone than the heads."""
        backbone_params = [p for p in self.backbone.parameters() if p.requires_grad]
        head_params = [
            *self.disease_head.parameters(),
            *self.severity_head.parameters(),
        ]

        groups: list[dict] = []
        if backbone_params:
            groups.append(
                {"params": backbone_params, "lr": backbone_lr, "name": "backbone"}
            )
        groups.append({"params": head_params, "lr": head_lr, "name": "heads"})
        return groups

    # --- Introspection -------------------------------------------------------

    @property
    def total_params(self) -> int:
        return sum(p.numel() for p in self.parameters())

    @property
    def trainable_params(self) -> int:
        return sum(p.numel() for p in self.parameters() if p.requires_grad)

    def summary(self) -> str:
        h, w = self.cam_grid
        kind = "exact" if self.cam_exact else "approximate"
        return "\n".join(
            [
                "MultiTaskPlantModel",
                f"  Backbone:      {self.backbone_name}",
                f"  Feature dim:   {self.feature_dim}",
                f"  CAM grid:      {h}x{w} ({kind})",
                f"  Disease head:  {self.num_disease_classes} classes",
                f"  Severity head: {self.num_severity_classes} classes",
                f"  Total params:  {self.total_params:,}",
                f"  Trainable:     {self.trainable_params:,}",
            ]
        )


# Back-compat alias: earlier checkpoints and scripts refer to this name.
MultiTaskMobileNetV5 = MultiTaskPlantModel
