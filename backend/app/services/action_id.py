from __future__ import annotations

import hashlib
import json
from typing import Any, Dict


def _strip_nonsemantic_fields(obj: Any) -> Any:
    """Remove fields that should not affect action identity.

    Strong opinion:
    - We strip any key named 'notes' at any depth.
    - We also strip common UI/annotation keys if they appear later.

    This is the core lever preventing silent action drift.
    """

    if isinstance(obj, dict):
        out: Dict[str, Any] = {}
        for k, v in obj.items():
            if k in {
                "notes",
                "ui",
                "ui_state",
                "debug",
            }:
                continue
            out[k] = _strip_nonsemantic_fields(v)
        return out

    if isinstance(obj, list):
        return [_strip_nonsemantic_fields(x) for x in obj]

    return obj


def _canonical_json_bytes(obj: Any) -> bytes:
    """Canonical JSON encoding suitable for hashing.

    - Stable key order
    - No whitespace
    - UTF-8
    """

    return json.dumps(
        obj,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


def normalized_action_object(planned_workout: Any) -> Any:
    """Return the normalized object used for action_id hashing."""

    return _strip_nonsemantic_fields(planned_workout)


def compute_action_id(planned_workout: Any) -> str:
    """Compute canonical action_id from a planned_workout JSON.

    Returns a stable hex digest string.
    """

    canonical_obj = _strip_nonsemantic_fields(planned_workout)
    digest = hashlib.sha256(_canonical_json_bytes(canonical_obj)).hexdigest()
    return digest
