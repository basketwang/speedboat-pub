"""Convert the FastAPI app's OpenAPI spec into a minimal Postman v2.1 collection.

Usage (from repo root):
    python backend/mock-server/export_postman.py > backend/postman-collection.json

We do this without a third-party converter to keep deps minimal. The output
is good enough to import into Postman or Insomnia and start hitting endpoints.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from main import app  # noqa: E402

spec = app.openapi()


def _example_for(schema: dict, defs: dict) -> object:
    """Generate a tiny placeholder example given a JSON schema fragment."""
    if "$ref" in schema:
        ref = schema["$ref"].split("/")[-1]
        return _example_for(defs.get(ref, {}), defs)
    t = schema.get("type")
    if "enum" in schema:
        return schema["enum"][0]
    if t == "string":
        return schema.get("example") or schema.get("default") or "string"
    if t == "integer":
        return schema.get("example") or schema.get("default") or 1
    if t == "number":
        return schema.get("example") or schema.get("default") or 1.0
    if t == "boolean":
        return schema.get("example") or schema.get("default") or False
    if t == "array":
        return [_example_for(schema.get("items", {}), defs)]
    if t == "object" or "properties" in schema:
        out: dict = {}
        for name, sub in (schema.get("properties") or {}).items():
            out[name] = _example_for(sub, defs)
        return out
    if "anyOf" in schema:
        return _example_for(schema["anyOf"][0], defs)
    return None


def _request_body_example(op: dict, defs: dict):
    body = op.get("requestBody")
    if not body:
        return None
    content = body.get("content", {}).get("application/json")
    if not content:
        return None
    schema = content.get("schema") or {}
    return _example_for(schema, defs)


def _build_url(path: str, params: list[dict]) -> dict:
    raw = "{{base_url}}" + path
    query = [
        {"key": p["name"], "value": "", "disabled": True}
        for p in params
        if p.get("in") == "query"
    ]
    return {
        "raw": raw + ("?" + "&".join(f"{q['key']}=" for q in query) if query else ""),
        "host": ["{{base_url}}"],
        "path": [seg for seg in path.split("/") if seg],
        "query": query or None,
    }


def to_postman(spec: dict) -> dict:
    defs = spec.get("components", {}).get("schemas", {})
    items_by_tag: dict[str, list] = {}

    for path, methods in spec["paths"].items():
        common_params = methods.get("parameters", [])
        for method, op in methods.items():
            if method.lower() not in {
                "get",
                "post",
                "put",
                "patch",
                "delete",
                "options",
            }:
                continue
            tags = op.get("tags") or ["default"]
            params = common_params + (op.get("parameters") or [])
            url = _build_url(path, params)
            req: dict = {
                "name": op.get("summary") or f"{method.upper()} {path}",
                "request": {
                    "method": method.upper(),
                    "header": [
                        {
                            "key": "Authorization",
                            "value": "Bearer {{api_key}}",
                            "type": "text",
                        }
                    ],
                    "url": url,
                    "description": op.get("description") or "",
                },
            }
            body_ex = _request_body_example(op, defs)
            if body_ex is not None:
                req["request"]["header"].append(
                    {"key": "Content-Type", "value": "application/json", "type": "text"}
                )
                req["request"]["body"] = {
                    "mode": "raw",
                    "raw": json.dumps(body_ex, indent=2),
                    "options": {"raw": {"language": "json"}},
                }
            items_by_tag.setdefault(tags[0], []).append(req)

    items = [
        {"name": tag, "item": entries}
        for tag, entries in sorted(items_by_tag.items())
    ]

    return {
        "info": {
            "name": spec["info"]["title"],
            "description": spec["info"].get("description", ""),
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "variable": [
            {"key": "base_url", "value": "http://localhost:3001"},
            {"key": "api_key", "value": "psk-mock-mockkey"},
        ],
        "item": items,
    }


json.dump(to_postman(spec), sys.stdout, indent=2)
