"""
Tests for the model architecture -- above all, the exact-CAM identity.

If ``test_cam_identity_holds`` fails, the exported ONNX graph is producing
heatmaps that do not correspond to what the classifier actually did, and every
"explanation" shown in the web and Android apps becomes fiction. Treat a failure
here as a release blocker, not a flaky test.
"""

from __future__ import annotations

import pytest
import torch

from src.model import (
    BACKBONE_PRESETS,
    DEFAULT_BACKBONE,
    MultiTaskPlantModel,
    resolve_backbone,
)

IMAGE_SIZE = 256


@pytest.fixture(scope="module")
def model() -> MultiTaskPlantModel:
    """An untrained mobile-preset model. `pretrained=False` keeps tests offline."""
    m = MultiTaskPlantModel(
        backbone_name="mobile",
        pretrained=False,
        freeze_backbone=False,
        dropout=0.0,
        image_size=IMAGE_SIZE,
    )
    return m.eval()


def test_resolve_backbone_maps_presets():
    assert resolve_backbone("mobile") == BACKBONE_PRESETS["mobile"]["name"]
    assert resolve_backbone("server") == BACKBONE_PRESETS["server"]["name"]


def test_resolve_backbone_passes_through_timm_names():
    assert resolve_backbone("resnet18") == "resnet18"


def test_default_backbone_is_web_deployable():
    preset = next(
        p for p in BACKBONE_PRESETS.values() if p["name"] == DEFAULT_BACKBONE
    )
    assert "web" in preset["targets"], "the default must fit in a browser"
    assert preset["onnx_mb"] <= 32


def test_forward_shapes(model: MultiTaskPlantModel):
    logits_d, logits_s = model(torch.randn(2, 3, IMAGE_SIZE, IMAGE_SIZE))
    assert logits_d.shape == (2, 38)
    assert logits_s.shape == (2, 4)


def test_cam_shapes_match_manifest_contract(model: MultiTaskPlantModel):
    _, _, cam_d, cam_s = model.forward_with_cam(
        torch.randn(2, 3, IMAGE_SIZE, IMAGE_SIZE)
    )
    h, w = model.cam_grid
    assert cam_d.shape == (2, 38, h, w)
    assert cam_s.shape == (2, 4, h, w)


def test_cam_grid_is_reported_and_square(model: MultiTaskPlantModel):
    h, w = model.cam_grid
    assert h == w == IMAGE_SIZE // 32
    assert model.cam_exact is True


@pytest.mark.parametrize("head", ["disease", "severity"])
def test_cam_identity_holds(model: MultiTaskPlantModel, head: str):
    """mean over (h, w) of CAM_k == logit_k - bias_k.

    This is the algebraic guarantee that makes the exported heatmaps genuine
    (docs/MODEL_CONTRACT.md section 3). Tolerance is float32 summation noise over
    an 8x8 grid, not slack for a real discrepancy.
    """
    with torch.no_grad():
        logits_d, logits_s, cam_d, cam_s = model.forward_with_cam(
            torch.randn(4, 3, IMAGE_SIZE, IMAGE_SIZE)
        )

    logits, cams, bias = (
        (logits_d, cam_d, model.disease_head.bias)
        if head == "disease"
        else (logits_s, cam_s, model.severity_head.bias)
    )

    error = (cams.mean(dim=(2, 3)) - (logits - bias)).abs().max().item()
    assert error < 1e-3, f"CAM identity broken for {head} head: max error {error:.2e}"


def test_dropout_does_not_disturb_cam_at_eval():
    """Dropout is identity at eval, so the identity must survive a non-zero rate."""
    m = MultiTaskPlantModel(
        backbone_name="mobile",
        pretrained=False,
        freeze_backbone=False,
        dropout=0.5,
        image_size=IMAGE_SIZE,
    ).eval()

    with torch.no_grad():
        logits, _, cam, _ = m.forward_with_cam(torch.randn(1, 3, IMAGE_SIZE, IMAGE_SIZE))

    error = (cam.mean(dim=(2, 3)) - (logits - m.disease_head.bias)).abs().max().item()
    assert error < 1e-3


@pytest.fixture
def frozen_model() -> MultiTaskPlantModel:
    return MultiTaskPlantModel(
        backbone_name="mobile",
        pretrained=False,
        freeze_backbone=True,
        image_size=IMAGE_SIZE,
    )


def test_freeze_leaves_only_the_heads_trainable(frozen_model: MultiTaskPlantModel):
    head_params = sum(
        p.numel()
        for p in (*frozen_model.disease_head.parameters(), *frozen_model.severity_head.parameters())
    )
    assert frozen_model.trainable_params == head_params


def test_unfreeze_actually_unfreezes_backbone_weights(frozen_model: MultiTaskPlantModel):
    """Regression guard: timm backbones end in parameterless modules, so a naive
    "last N children" walk silently unfreezes nothing and phase 2 does nothing."""
    before = frozen_model.trainable_params
    tensors = frozen_model.unfreeze_backbone(num_blocks=2)

    assert tensors > 0, "unfreeze_backbone touched no parameter tensors"
    assert frozen_model.trainable_params > before


@pytest.mark.parametrize("num_blocks", [1, 2, 3])
def test_unfreezing_more_blocks_trains_more_weights(num_blocks: int):
    m = MultiTaskPlantModel(
        backbone_name="mobile",
        pretrained=False,
        freeze_backbone=True,
        image_size=IMAGE_SIZE,
    )
    m.unfreeze_backbone(num_blocks=num_blocks)
    unfrozen = m.trainable_params

    reference = MultiTaskPlantModel(
        backbone_name="mobile",
        pretrained=False,
        freeze_backbone=True,
        image_size=IMAGE_SIZE,
    )
    reference.unfreeze_backbone(num_blocks=num_blocks + 1)

    assert reference.trainable_params >= unfrozen


def test_unfreeze_zero_blocks_is_a_no_op(frozen_model: MultiTaskPlantModel):
    before = frozen_model.trainable_params
    assert frozen_model.unfreeze_backbone(num_blocks=0) == 0
    assert frozen_model.trainable_params == before


def test_param_groups_split_learning_rates():
    m = MultiTaskPlantModel(
        backbone_name="mobile",
        pretrained=False,
        freeze_backbone=False,
        image_size=IMAGE_SIZE,
    )
    groups = m.param_groups(backbone_lr=1e-4, head_lr=1e-3)
    by_name = {g["name"]: g for g in groups}
    assert by_name["backbone"]["lr"] == 1e-4
    assert by_name["heads"]["lr"] == 1e-3


def test_frozen_backbone_yields_heads_only_group():
    m = MultiTaskPlantModel(
        backbone_name="mobile",
        pretrained=False,
        freeze_backbone=True,
        image_size=IMAGE_SIZE,
    )
    groups = m.param_groups(backbone_lr=1e-4, head_lr=1e-3)
    assert [g["name"] for g in groups] == ["heads"]


def test_heads_are_a_single_linear(model: MultiTaskPlantModel):
    """A hidden layer in either head would silently break CAM exactness."""
    assert isinstance(model.disease_head, torch.nn.Linear)
    assert isinstance(model.severity_head, torch.nn.Linear)
