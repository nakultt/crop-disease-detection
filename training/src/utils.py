"""
Utility functions, label mappings, and treatment recommendations.
"""

from pathlib import Path
from typing import Any

import torch

# ─── PlantVillage 38-class disease label mapping ─────────────────────────────
DISEASE_CLASSES = [
    "Apple___Apple_scab",
    "Apple___Black_rot",
    "Apple___Cedar_apple_rust",
    "Apple___healthy",
    "Blueberry___healthy",
    "Cherry_(including_sour)___Powdery_mildew",
    "Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
    "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy",
    "Orange___Haunglongbing_(Citrus_greening)",
    "Peach___Bacterial_spot",
    "Peach___healthy",
    "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Raspberry___healthy",
    "Soybean___healthy",
    "Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch",
    "Strawberry___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy",
]

# Human-readable disease names
DISEASE_DISPLAY_NAMES = {
    cls: cls.replace("___", " – ").replace("_", " ") for cls in DISEASE_CLASSES
}

# Severity classes
SEVERITY_CLASSES = ["Mild", "Moderate", "Severe", "Critical"]
SEVERITY_RANGES = {
    "Mild": "0–25%",
    "Moderate": "26–50%",
    "Severe": "51–75%",
    "Critical": "76–100%",
}

# ─── Treatment Recommendations ───────────────────────────────────────────────

TREATMENT_RECOMMENDATIONS: dict[str, dict[str, list[str]]] = {
    "default_diseased": {
        "Mild": [
            "Monitor the plant closely for progression.",
            "Remove affected leaves if possible.",
            "Ensure proper spacing for air circulation.",
        ],
        "Moderate": [
            "Apply appropriate fungicide or pesticide.",
            "Remove and destroy heavily affected leaves.",
            "Improve drainage and reduce overhead watering.",
        ],
        "Severe": [
            "Immediately apply targeted treatment (fungicide/bactericide).",
            "Prune and destroy all infected plant parts.",
            "Isolate affected plants to prevent spread.",
            "Consider consulting an agricultural extension officer.",
        ],
        "Critical": [
            "Urgently apply systemic treatment.",
            "Consider removing the entire plant to prevent spread.",
            "Disinfect all tools and surrounding soil.",
            "Seek professional agricultural advice immediately.",
        ],
    },
    "healthy": {
        "Mild": [
            "Plant appears healthy! Continue regular care.",
            "Maintain proper watering and fertilization schedule.",
            "Monitor periodically for early signs of disease.",
        ],
    },
}

# Disease-specific recommendations (override defaults)
DISEASE_SPECIFIC_RECOMMENDATIONS: dict[str, list[str]] = {
    "Apple___Apple_scab": [
        "Apply fungicide containing captan or myclobutanil.",
        "Rake and destroy fallen leaves in autumn.",
        "Prune trees to improve air circulation.",
    ],
    "Apple___Black_rot": [
        "Remove mummified fruits and cankers.",
        "Apply fungicide during early bloom.",
        "Maintain tree vigor with proper fertilization.",
    ],
    "Tomato___Early_blight": [
        "Apply chlorothalonil or copper-based fungicide.",
        "Mulch around plants to prevent soil splash.",
        "Rotate crops – avoid planting tomatoes in same spot for 2 years.",
    ],
    "Tomato___Late_blight": [
        "Apply fungicide immediately (chlorothalonil or mancozeb).",
        "Remove and destroy all infected plant material.",
        "Do NOT compost infected plants.",
        "Avoid overhead irrigation.",
    ],
    "Potato___Late_blight": [
        "Apply systemic fungicide (metalaxyl + mancozeb).",
        "Destroy infected tubers and plant debris.",
        "Ensure good field drainage.",
        "Use certified disease-free seed potatoes.",
    ],
    "Grape___Black_rot": [
        "Apply mancozeb or myclobutanil fungicide.",
        "Remove mummified berries and infected canes.",
        "Prune for good air circulation.",
    ],
    "Corn_(maize)___Common_rust_": [
        "Apply foliar fungicide if infection is early.",
        "Use resistant corn varieties in future plantings.",
        "Monitor humidity levels – rust thrives in moist conditions.",
    ],
}


def get_disease_index(class_name: str) -> int:
    """Get the index for a disease class name."""
    return DISEASE_CLASSES.index(class_name)


def get_disease_name(index: int) -> str:
    """Get the display name for a disease index."""
    return DISEASE_DISPLAY_NAMES[DISEASE_CLASSES[index]]


def get_severity_name(index: int) -> str:
    """Get the severity class name from index."""
    return SEVERITY_CLASSES[index]


def is_healthy_class(class_name: str) -> bool:
    """Check if a class name represents a healthy plant."""
    return "healthy" in class_name.lower()


def get_recommendations(disease_class: str, severity: str) -> list[str]:
    """Get treatment recommendations for a disease and severity level."""
    # Check disease-specific recommendations first
    specific = DISEASE_SPECIFIC_RECOMMENDATIONS.get(disease_class, [])

    if is_healthy_class(disease_class):
        return TREATMENT_RECOMMENDATIONS["healthy"]["Mild"]

    # Combine disease-specific with severity-based defaults
    severity_recs = TREATMENT_RECOMMENDATIONS["default_diseased"].get(severity, [])
    return specific + severity_recs if specific else severity_recs


def get_device(preferred: str = "cuda") -> torch.device:
    """Select the best available device."""
    if preferred == "cuda" and torch.cuda.is_available():
        device = torch.device("cuda")
        print(f"Using CUDA: {torch.cuda.get_device_name(0)}")
        return device
    elif preferred == "mps" and torch.backends.mps.is_available():
        print("Using Apple MPS")
        return torch.device("mps")
    else:
        print("Using CPU")
        return torch.device("cpu")


def load_config(config_path: str) -> dict[str, Any]:
    """Load YAML configuration file."""
    import yaml

    with open(config_path) as f:
        config = yaml.safe_load(f)
    return config


def ensure_dir(path: str | Path) -> Path:
    """Ensure a directory exists, creating it if necessary."""
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def set_seed(seed: int) -> None:
    """Set random seed for reproducibility."""
    import random

    import numpy as np

    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
