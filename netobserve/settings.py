from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

MODEL_FEATURES = [
    "dur", "sbytes", "dbytes", "sload", "dload", "spkts", "dpkts"
]

DEVICES = (
    [f"Router-{i}" for i in range(1, 8)] +
    [f"Switch-{i}" for i in range(1, 5)] +
    [f"Server-{i}" for i in range(1, 4)]
)

TOPOLOGY_EDGES = [
    {"source": "Router-1", "target": "Switch-1"},
    {"source": "Router-2", "target": "Switch-1"},
    {"source": "Router-3", "target": "Switch-2"},
    {"source": "Router-4", "target": "Switch-2"},
    {"source": "Router-5", "target": "Switch-3"},
    {"source": "Router-6", "target": "Switch-3"},
    {"source": "Router-7", "target": "Switch-4"},
    {"source": "Switch-1", "target": "Server-1"},
    {"source": "Switch-2", "target": "Server-2"},
    {"source": "Switch-3", "target": "Server-3"},
    {"source": "Switch-4", "target": "Server-1"},
]
