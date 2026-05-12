"""Print the FastAPI app's OpenAPI spec as YAML to stdout.

Usage (from repo root):
    python backend/mock-server/export_openapi.py > backend/openapi.yaml
"""
from __future__ import annotations

import sys
from pathlib import Path

import yaml

# Allow `import main` regardless of the working directory the user runs from.
sys.path.insert(0, str(Path(__file__).parent))

from main import app  # noqa: E402

spec = app.openapi()
yaml.safe_dump(spec, sys.stdout, sort_keys=False, allow_unicode=True)
