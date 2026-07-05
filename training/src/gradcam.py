"""
Grad-CAM implementation for MobileNetV5 multi-task model.

Generates heatmaps showing which regions of the leaf image
contributed most to the model's prediction.

Supports targeting either the disease or severity head.
"""

import cv2
import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn.functional as F
from pathlib import Path

from .model import MultiTaskMobileNetV5


class GradCAM:
    """
    Grad-CAM implementation that dynamically discovers
    the last convolutional layer in MobileNetV5's backbone.
    """

    def __init__(self, model: MultiTaskMobileNetV5, device: torch.device):
        self.model = model
        self.device = device
        self.activations = None
        self.gradients = None

        # Find the last convolutional layer in the backbone
        self.target_layer = self._find_last_conv_layer()
        print(f"Grad-CAM target layer: {self.target_layer.__class__.__name__}")

        # Register hooks
        self.target_layer.register_forward_hook(self._save_activation)
        self.target_layer.register_full_backward_hook(self._save_gradient)

    def _find_last_conv_layer(self) -> torch.nn.Module:
        """Find the last convolutional layer in the backbone."""
        last_conv = None
        for module in self.model.backbone.modules():
            if isinstance(module, (torch.nn.Conv2d,)):
                last_conv = module
        if last_conv is None:
            raise ValueError("No Conv2d layer found in backbone")
        return last_conv

    def _save_activation(self, module, input, output):
        """Hook to save forward activations."""
        self.activations = output.detach()

    def _save_gradient(self, module, grad_input, grad_output):
        """Hook to save backward gradients."""
        self.gradients = grad_output[0].detach()

    def generate_heatmap(
        self,
        image: torch.Tensor,
        target_class: int | None = None,
        head: str = "disease",
    ) -> np.ndarray:
        """
        Generate Grad-CAM heatmap for a single image.

        Args:
            image: Preprocessed image tensor (1, 3, H, W) or (3, H, W)
            target_class: Target class index. If None, uses predicted class.
            head: Which head to target ("disease" or "severity")

        Returns:
            Heatmap as numpy array (H, W) with values in [0, 1]
        """
        if image.dim() == 3:
            image = image.unsqueeze(0)

        image = image.to(self.device)
        image.requires_grad_(True)

        self.model.eval()

        # Forward pass
        disease_logits, severity_logits = self.model(image)

        # Select target head
        if head == "disease":
            logits = disease_logits
        elif head == "severity":
            logits = severity_logits
        else:
            raise ValueError(f"Unknown head: {head}")

        # Use predicted class if not specified
        if target_class is None:
            target_class = logits.argmax(dim=1).item()

        # Backward pass for target class
        self.model.zero_grad()
        target_score = logits[0, target_class]
        target_score.backward(retain_graph=True)

        # Compute Grad-CAM
        # Global average pooling of gradients
        weights = self.gradients.mean(dim=(2, 3), keepdim=True)  # (1, C, 1, 1)

        # Weighted combination of activation maps
        cam = (weights * self.activations).sum(dim=1, keepdim=True)  # (1, 1, H, W)

        # ReLU + normalize
        cam = F.relu(cam)
        cam = cam.squeeze().cpu().numpy()

        # Normalize to [0, 1]
        if cam.max() > 0:
            cam = (cam - cam.min()) / (cam.max() - cam.min())

        return cam

    def generate_overlay(
        self,
        original_image: np.ndarray,
        heatmap: np.ndarray,
        alpha: float = 0.5,
        colormap: int = cv2.COLORMAP_JET,
    ) -> np.ndarray:
        """
        Overlay heatmap on original image.

        Args:
            original_image: RGB image (H, W, 3) with values in [0, 255]
            heatmap: Grad-CAM heatmap (h, w) with values in [0, 1]
            alpha: Transparency of heatmap overlay
            colormap: OpenCV colormap

        Returns:
            Overlay image (H, W, 3) in RGB, values [0, 255]
        """
        h, w = original_image.shape[:2]

        # Resize heatmap to match original image
        heatmap_resized = cv2.resize(heatmap, (w, h))

        # Convert to colormap
        heatmap_colored = cv2.applyColorMap(
            (heatmap_resized * 255).astype(np.uint8), colormap
        )
        heatmap_colored = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)

        # Overlay
        overlay = (
            alpha * heatmap_colored.astype(np.float32)
            + (1 - alpha) * original_image.astype(np.float32)
        )
        overlay = np.clip(overlay, 0, 255).astype(np.uint8)

        return overlay


def generate_gradcam_visualization(
    model: MultiTaskMobileNetV5,
    image_path: str | Path,
    device: torch.device,
    transform=None,
    output_path: str | Path | None = None,
    head: str = "disease",
) -> tuple[np.ndarray, np.ndarray, dict]:
    """
    Generate Grad-CAM visualization for a single image.

    Args:
        model: Trained model
        image_path: Path to input image
        device: Torch device
        transform: Preprocessing transform
        output_path: Optional path to save visualization
        head: Target head ("disease" or "severity")

    Returns:
        (original_image, overlay_image, prediction_info)
    """
    # Load and preprocess image
    original = cv2.imread(str(image_path))
    original_rgb = cv2.cvtColor(original, cv2.COLOR_BGR2RGB)

    if transform:
        transformed = transform(image=original_rgb)
        input_tensor = transformed["image"].unsqueeze(0)
    else:
        raise ValueError("Transform is required")

    # Get predictions
    model.eval()
    with torch.no_grad():
        input_on_device = input_tensor.to(device)
        disease_logits, severity_logits = model(input_on_device)

    disease_probs = F.softmax(disease_logits, dim=1)
    severity_probs = F.softmax(severity_logits, dim=1)

    disease_pred = disease_logits.argmax(dim=1).item()
    severity_pred = severity_logits.argmax(dim=1).item()

    # Generate Grad-CAM
    gradcam = GradCAM(model, device)
    heatmap = gradcam.generate_heatmap(input_tensor, head=head)
    overlay = gradcam.generate_overlay(original_rgb, heatmap)

    prediction_info = {
        "disease_class": disease_pred,
        "disease_confidence": disease_probs[0, disease_pred].item(),
        "severity_class": severity_pred,
        "severity_confidence": severity_probs[0, severity_pred].item(),
    }

    # Save visualization
    if output_path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        fig, axes = plt.subplots(1, 3, figsize=(15, 5))

        axes[0].imshow(original_rgb)
        axes[0].set_title("Original")
        axes[0].axis("off")

        axes[1].imshow(heatmap, cmap="jet")
        axes[1].set_title(f"Grad-CAM ({head})")
        axes[1].axis("off")

        axes[2].imshow(overlay)
        axes[2].set_title("Overlay")
        axes[2].axis("off")

        plt.suptitle(
            f"Disease: class {disease_pred} ({prediction_info['disease_confidence']:.1%}) | "
            f"Severity: class {severity_pred} ({prediction_info['severity_confidence']:.1%})",
            fontsize=12,
        )
        plt.tight_layout()
        plt.savefig(str(output_path), dpi=150, bbox_inches="tight")
        plt.close()

    return original_rgb, overlay, prediction_info
