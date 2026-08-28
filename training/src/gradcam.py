"""
Class Activation Mapping for the multi-task model.

This module deliberately computes the CAM the *same way the exported ONNX graph
does* -- a weighted sum of the final feature map using the head's ``Linear``
weights. That gives train/serve parity: a heatmap rendered here is pixel-for-pixel
what the browser and the Android app will draw for the same image.

For this architecture (global-average-pool feeding a single ``Linear``) CAM is
not an approximation of Grad-CAM -- it is algebraically identical to it. See
``docs/MODEL_CONTRACT.md`` section 3.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn.functional as F

from .model import MultiTaskPlantModel
from .utils import DISEASE_CLASSES, SEVERITY_CLASSES


class ClassActivationMapper:
    """Produces per-class heatmaps without any backward pass."""

    def __init__(self, model: MultiTaskPlantModel, device: torch.device) -> None:
        self.model = model.to(device).eval()
        self.device = device
        if not model.cam_exact:
            print(
                "note: this backbone does not expose an unpooled feature grid, so "
                "the CAM is computed from pre-head features and is approximate."
            )

    @torch.no_grad()
    def generate(
        self,
        image: torch.Tensor,
        target_class: int | None = None,
        head: str = "disease",
    ) -> tuple[np.ndarray, int, float]:
        """Heatmap for one image.

        Args:
            image: ``[1, 3, H, W]`` or ``[3, H, W]``, already preprocessed.
            target_class: Class to explain. Defaults to the predicted class.
            head: ``"disease"`` or ``"severity"``.

        Returns:
            ``(heatmap[h, w] in [0, 1], class_index, class_probability)``
        """
        if head not in ("disease", "severity"):
            raise ValueError(f"head must be 'disease' or 'severity', got {head!r}")

        if image.dim() == 3:
            image = image.unsqueeze(0)
        image = image.to(self.device)

        disease_logits, severity_logits, disease_cam, severity_cam = (
            self.model.forward_with_cam(image)
        )

        logits, cams = (
            (disease_logits, disease_cam)
            if head == "disease"
            else (severity_logits, severity_cam)
        )

        if target_class is None:
            target_class = int(logits.argmax(dim=1).item())

        probability = float(F.softmax(logits, dim=1)[0, target_class].item())

        # Contract section 5: relu, then min-max normalise. A flat map stays flat
        # rather than being amplified into noise by dividing by ~zero.
        cam = cams[0, target_class].relu().cpu().numpy()
        span = float(cam.max() - cam.min())
        cam = (cam - cam.min()) / span if span > 1e-8 else np.zeros_like(cam)

        return cam, target_class, probability

    @staticmethod
    def overlay(
        original_rgb: np.ndarray,
        heatmap: np.ndarray,
        alpha: float = 0.45,
        colormap: int = cv2.COLORMAP_INFERNO,
    ) -> np.ndarray:
        """Alpha-composite a heatmap over an RGB uint8 image.

        Inferno is the default rather than JET: JET is not perceptually uniform
        and invents banding that looks like structure in the data.
        """
        h, w = original_rgb.shape[:2]
        resized = cv2.resize(heatmap, (w, h), interpolation=cv2.INTER_LINEAR)
        coloured = cv2.applyColorMap((resized * 255).astype(np.uint8), colormap)
        coloured = cv2.cvtColor(coloured, cv2.COLOR_BGR2RGB)

        blended = alpha * coloured.astype(np.float32) + (1 - alpha) * original_rgb.astype(
            np.float32
        )
        return np.clip(blended, 0, 255).astype(np.uint8)


def generate_cam_visualization(
    model: MultiTaskPlantModel,
    image_path: str | Path,
    device: torch.device,
    transform,
    output_path: str | Path | None = None,
    head: str = "disease",
) -> tuple[np.ndarray, np.ndarray, dict]:
    """Render an original / heatmap / overlay triptych for one image file.

    Returns ``(original_rgb, overlay_rgb, prediction_info)``.
    """
    if transform is None:
        raise ValueError("A preprocessing transform is required.")

    original_bgr = cv2.imread(str(image_path))
    if original_bgr is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")
    original_rgb = cv2.cvtColor(original_bgr, cv2.COLOR_BGR2RGB)

    input_tensor = transform(image=original_rgb)["image"].unsqueeze(0)

    mapper = ClassActivationMapper(model, device)
    heatmap, class_index, probability = mapper.generate(input_tensor, head=head)
    overlay = mapper.overlay(original_rgb, heatmap)

    names = DISEASE_CLASSES if head == "disease" else SEVERITY_CLASSES
    info = {
        "head": head,
        "class_index": class_index,
        "class_name": names[class_index],
        "confidence": probability,
    }

    if output_path is not None:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        for ax, img, title in (
            (axes[0], original_rgb, "Original"),
            (axes[1], heatmap, f"CAM ({head})"),
            (axes[2], overlay, "Overlay"),
        ):
            ax.imshow(img, cmap="inferno" if img is heatmap else None)
            ax.set_title(title)
            ax.axis("off")

        plt.suptitle(
            f"{info['class_name']} - {probability:.1%} confidence", fontsize=12
        )
        plt.tight_layout()
        plt.savefig(str(output_path), dpi=150, bbox_inches="tight")
        plt.close(fig)

    return original_rgb, overlay, info


# Back-compat aliases for older call sites.
GradCAM = ClassActivationMapper
generate_gradcam_visualization = generate_cam_visualization
