"""
Tests for the ONNX export path and the manifest that clients rely on.

These exercise a real export end to end (untrained weights, so they stay
offline and fast) and assert the properties the web and Android apps depend on:
output names, CAM cube shapes, the CAM identity surviving the ONNX round-trip,
manifest completeness, and the deployment size budget.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import pytest
import torch

from src.export_onnx import (
    OUTPUT_NAMES,
    SIZE_BUDGETS_MB,
    export_to_onnx,
    write_manifest,
)
from src.model import MultiTaskPlantModel
from src.utils import DISEASE_CLASSES, SEVERITY_CLASSES

IMAGE_SIZE = 256

CONFIG = {
    "data": {"image_size": IMAGE_SIZE},
    "model": {
        "backbone": "mobile",
        "num_disease_classes": 38,
        "num_severity_classes": 4,
        "dropout": 0.3,
    },
    "training": {"output_dir": "./outputs"},
}


@pytest.fixture(scope="module")
def exported(tmp_path_factory) -> tuple[Path, Path, MultiTaskPlantModel]:
    """Export once and share the artifacts across the module's tests."""
    model = MultiTaskPlantModel(
        backbone_name="mobile",
        pretrained=False,
        freeze_backbone=False,
        image_size=IMAGE_SIZE,
    ).eval()

    out_dir = tmp_path_factory.mktemp("export")
    onnx_path = export_to_onnx(
        model, out_dir / "model.onnx", image_size=IMAGE_SIZE, simplify=False
    )
    manifest_path = write_manifest(
        onnx_path, model, CONFIG, precision="fp32", trained=False, metrics=None
    )
    return onnx_path, manifest_path, model


@pytest.fixture(scope="module")
def session(exported) -> ort.InferenceSession:
    onnx_path, _, _ = exported
    return ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])


def test_graph_exposes_the_four_contract_outputs(session: ort.InferenceSession):
    assert [o.name for o in session.get_outputs()] == OUTPUT_NAMES


def test_graph_input_is_nchw_float32(session: ort.InferenceSession):
    (inp,) = session.get_inputs()
    assert inp.name == "input"
    assert inp.shape[1:] == [3, IMAGE_SIZE, IMAGE_SIZE]
    assert inp.type == "tensor(float)"


def test_output_shapes(session: ort.InferenceSession):
    x = np.random.randn(1, 3, IMAGE_SIZE, IMAGE_SIZE).astype(np.float32)
    logits_d, logits_s, cam_d, cam_s = session.run(OUTPUT_NAMES, {"input": x})
    assert logits_d.shape == (1, 38)
    assert logits_s.shape == (1, 4)
    assert cam_d.shape == (1, 38, 8, 8)
    assert cam_s.shape == (1, 4, 8, 8)


def test_batch_axis_is_dynamic(session: ort.InferenceSession):
    x = np.random.randn(3, 3, IMAGE_SIZE, IMAGE_SIZE).astype(np.float32)
    logits_d, _, cam_d, _ = session.run(OUTPUT_NAMES, {"input": x})
    assert logits_d.shape[0] == 3
    assert cam_d.shape[0] == 3


def test_onnx_matches_pytorch(exported, session: ort.InferenceSession):
    _, _, model = exported
    x = np.random.randn(1, 3, IMAGE_SIZE, IMAGE_SIZE).astype(np.float32)

    with torch.no_grad():
        expected = model.forward_with_cam(torch.from_numpy(x))
    actual = session.run(OUTPUT_NAMES, {"input": x})

    for name, want, got in zip(OUTPUT_NAMES, expected, actual, strict=True):
        diff = np.abs(want.numpy() - got).max()
        assert diff < 1e-3, f"{name} drifted by {diff:.2e} through ONNX export"


def test_cam_identity_survives_export(exported, session: ort.InferenceSession):
    """The whole point of the graph: heatmaps must explain the actual logits."""
    _, _, model = exported
    x = np.random.randn(2, 3, IMAGE_SIZE, IMAGE_SIZE).astype(np.float32)
    logits_d, _, cam_d, _ = session.run(OUTPUT_NAMES, {"input": x})

    bias = model.disease_head.bias.detach().numpy()
    error = np.abs(cam_d.mean(axis=(2, 3)) - (logits_d - bias)).max()
    assert error < 1e-2, f"CAM identity broken after export: {error:.2e}"


def test_argmax_of_cam_mean_matches_predicted_class(session: ort.InferenceSession):
    """A client picking the top class gets the map that explains that class."""
    x = np.random.randn(1, 3, IMAGE_SIZE, IMAGE_SIZE).astype(np.float32)
    logits_d, _, cam_d, _ = session.run(OUTPUT_NAMES, {"input": x})
    assert int(logits_d.argmax()) == int(cam_d.mean(axis=(2, 3)).argmax())


# --- Manifest ---------------------------------------------------------------


@pytest.fixture(scope="module")
def manifest(exported) -> dict:
    _, manifest_path, _ = exported
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def test_manifest_is_written_next_to_the_graph(exported):
    onnx_path, manifest_path, _ = exported
    assert manifest_path.name == "model.json"
    assert manifest_path.parent == onnx_path.parent


def test_manifest_class_lists_match_the_head_sizes(manifest: dict):
    assert manifest["classes"]["disease"] == DISEASE_CLASSES
    assert manifest["classes"]["severity"] == SEVERITY_CLASSES
    assert len(manifest["classes"]["disease"]) == 38
    assert len(manifest["classes"]["severity"]) == 4


def test_manifest_declares_output_names_the_graph_actually_has(
    manifest: dict, session: ort.InferenceSession
):
    graph_outputs = {o.name for o in session.get_outputs()}
    assert set(manifest["outputs"].values()) == graph_outputs


def test_manifest_preprocessing_is_complete(manifest: dict):
    inp = manifest["input"]
    assert inp["size"] == IMAGE_SIZE
    assert inp["layout"] == "NCHW"
    assert len(inp["mean"]) == 3
    assert len(inp["std"]) == 3


def test_manifest_reports_cam_grid_matching_the_tensors(
    manifest: dict, session: ort.InferenceSession
):
    x = np.random.randn(1, 3, IMAGE_SIZE, IMAGE_SIZE).astype(np.float32)
    _, _, cam_d, _ = session.run(OUTPUT_NAMES, {"input": x})
    assert manifest["cam"]["grid"] == list(cam_d.shape[2:])
    assert manifest["cam"]["exact"] is True


def test_untrained_export_is_flagged_so_clients_can_warn(manifest: dict):
    assert manifest["trained"] is False
    assert manifest["metrics"] is None


def test_manifest_severity_ranges_cover_every_level(manifest: dict):
    assert set(manifest["severityRanges"]) == set(manifest["classes"]["severity"])


def test_default_export_fits_the_web_budget(exported, manifest: dict):
    onnx_path, _, _ = exported
    size_mb = onnx_path.stat().st_size / 1024 / 1024
    assert size_mb < SIZE_BUDGETS_MB["web"], (
        f"default export is {size_mb:.1f} MB, over the "
        f"{SIZE_BUDGETS_MB['web']} MB web budget"
    )
    assert manifest["sizeBytes"] == onnx_path.stat().st_size
