"""
Tests for severity-label generation and the label/recommendation tables.

The severity labels are *synthetic* -- derived from HSV colour segmentation
rather than agronomist annotation. These tests pin the binning behaviour so a
refactor cannot silently shift what "Severe" means, and document the known
limitation in one place.
"""

from __future__ import annotations

import cv2
import numpy as np
import pytest

from src.dataset import estimate_severity_from_image
from src.utils import (
    DISEASE_CLASSES,
    SEVERITY_CLASSES,
    SEVERITY_RANGES,
    get_disease_index,
    get_disease_name,
    get_recommendations,
    get_severity_name,
    is_healthy_class,
)


# --- Label tables -----------------------------------------------------------


def test_disease_classes_are_unique_and_complete():
    assert len(DISEASE_CLASSES) == 38
    assert len(set(DISEASE_CLASSES)) == 38


def test_disease_index_round_trips():
    for index, name in enumerate(DISEASE_CLASSES):
        assert get_disease_index(name) == index


def test_disease_display_names_are_humanised():
    """`get_disease_name` returns the label shown to users, not the raw class id."""
    assert get_disease_name(0) == "Apple – Apple scab"
    assert all("___" not in get_disease_name(i) for i in range(len(DISEASE_CLASSES)))


def test_severity_levels_are_ordered_worst_last():
    assert SEVERITY_CLASSES == ["Mild", "Moderate", "Severe", "Critical"]
    for index, level in enumerate(SEVERITY_CLASSES):
        assert get_severity_name(index) == level


def test_every_severity_level_has_a_stated_range():
    assert set(SEVERITY_RANGES) == set(SEVERITY_CLASSES)


def test_healthy_classes_are_detected():
    healthy = [c for c in DISEASE_CLASSES if is_healthy_class(c)]
    assert len(healthy) == 12
    assert all("healthy" in c.lower() for c in healthy)
    assert not is_healthy_class("Tomato___Late_blight")


@pytest.mark.parametrize("disease", DISEASE_CLASSES)
@pytest.mark.parametrize("severity", SEVERITY_CLASSES)
def test_every_class_and_severity_pair_yields_advice(disease: str, severity: str):
    """No combination may fall through to an empty recommendation list."""
    advice = get_recommendations(disease, severity)
    assert advice, f"no recommendations for {disease} @ {severity}"
    assert all(isinstance(line, str) and line.strip() for line in advice)


# --- Severity estimation ----------------------------------------------------


def _write_image(path, bgr: np.ndarray) -> str:
    cv2.imwrite(str(path), bgr)
    return str(path)


def _solid(hue: int, sat: int, val: int, size: int = 128) -> np.ndarray:
    """A solid HSV patch returned as BGR, for driving the segmenter."""
    hsv = np.full((size, size, 3), (hue, sat, val), dtype=np.uint8)
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)


def test_fully_green_leaf_reads_as_mild(tmp_path):
    path = _write_image(tmp_path / "green.png", _solid(hue=60, sat=200, val=180))
    ratio, level = estimate_severity_from_image(path)
    assert ratio < 0.25
    assert level == 0


def test_fully_brown_leaf_reads_as_critical(tmp_path):
    path = _write_image(tmp_path / "brown.png", _solid(hue=15, sat=200, val=120))
    ratio, level = estimate_severity_from_image(path)
    assert ratio > 0.75
    assert level == 3


def test_severity_increases_monotonically_with_diseased_area(tmp_path):
    """Half-and-half images must not bin below a mostly-green one."""
    levels = []
    for diseased_fraction in (0.0, 0.35, 0.6, 0.95):
        img = _solid(hue=60, sat=200, val=180)
        cut = int(img.shape[0] * diseased_fraction)
        if cut:
            img[:cut] = _solid(hue=15, sat=200, val=120)[:cut]
        path = _write_image(tmp_path / f"mix_{diseased_fraction}.png", img)
        levels.append(estimate_severity_from_image(path)[1])

    assert levels == sorted(levels), f"severity is not monotonic: {levels}"
    assert levels[0] == 0
    assert levels[-1] == 3


def test_unreadable_image_degrades_to_mild_rather_than_raising(tmp_path):
    ratio, level = estimate_severity_from_image(tmp_path / "does-not-exist.png")
    assert (ratio, level) == (0.0, 0)


def test_background_only_image_is_not_scored_as_diseased(tmp_path):
    """A near-white frame has too few leaf pixels to judge; it must not read Critical."""
    white = np.full((128, 128, 3), 245, dtype=np.uint8)
    path = _write_image(tmp_path / "white.png", white)
    ratio, level = estimate_severity_from_image(path)
    assert (ratio, level) == (0.0, 0)


def test_ratio_is_always_a_valid_fraction(tmp_path):
    for hue in (0, 30, 60, 90, 120, 150, 179):
        path = _write_image(tmp_path / f"h{hue}.png", _solid(hue=hue, sat=180, val=160))
        ratio, level = estimate_severity_from_image(path)
        assert 0.0 <= ratio <= 1.0
        assert level in range(len(SEVERITY_CLASSES))
