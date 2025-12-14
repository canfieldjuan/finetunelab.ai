"""Predictions Validators

Optional, config-driven validation of model outputs during training.

Design goals:
- Off by default (only runs when configured)
- Cheap + safe validators for common developer workflows
- Structured error payloads for persistence
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class ValidationResult:
    passed: bool
    kind: Optional[str]
    errors: Optional[List[Dict[str, Any]]]


def validate_prediction_output(prediction_text: str, config: Optional[dict]) -> ValidationResult:
    """Validate a prediction output according to config.

    Config shape (optional):
      {
        "validators": {
          "json_parse": bool,
                    "json_schema": object | str,
                    "json_schema_path": str
        }
      }

    Returns ValidationResult with:
    - passed: True if all enabled validators passed
    - kind: a short string describing enabled validators
    - errors: structured list of errors (or None)
    """
    if not isinstance(config, dict):
        return ValidationResult(passed=True, kind=None, errors=None)

    validators = config.get('validators')
    if not isinstance(validators, dict) or not validators:
        return ValidationResult(passed=True, kind=None, errors=None)

    json_parse = bool(validators.get('json_parse'))
    json_schema = validators.get('json_schema')
    json_schema_path = validators.get('json_schema_path')
    if json_schema_path is not None and not isinstance(json_schema_path, str):
        json_schema_path = None

    enabled_kinds: List[str] = []
    errors: List[Dict[str, Any]] = []

    parsed_json: Any = None

    if json_parse or json_schema is not None or json_schema_path:
        enabled_kinds.append('json_parse')
        try:
            parsed_json = json.loads(prediction_text)
        except Exception as e:
            errors.append({
                'validator': 'json_parse',
                'message': 'Prediction is not valid JSON',
                'detail': str(e),
            })

    schema: Optional[Dict[str, Any]] = None
    if json_schema is not None:
        enabled_kinds.append('json_schema')
        try:
            if isinstance(json_schema, str):
                schema = json.loads(json_schema)
            elif isinstance(json_schema, dict):
                schema = json_schema
            else:
                raise TypeError('json_schema must be an object or JSON string')
        except Exception as e:
            errors.append({
                'validator': 'json_schema',
                'message': 'Invalid inline JSON schema',
                'detail': str(e),
            })

    if schema is None and json_schema_path:
        enabled_kinds.append('json_schema')
        if parsed_json is None:
            # json_parse already recorded an error; nothing more to do
            pass
        else:
            try:
                # jsonschema is an optional dependency; only import when used.
                import jsonschema  # type: ignore

                with open(json_schema_path, 'r', encoding='utf-8') as f:
                    schema = json.load(f)

                jsonschema.validate(instance=parsed_json, schema=schema)
            except Exception as e:
                errors.append({
                    'validator': 'json_schema',
                    'message': 'JSONSchema validation failed',
                    'detail': str(e),
                    'schema_path': json_schema_path,
                })

    if schema is not None:
        if parsed_json is None:
            # json_parse already recorded an error; nothing more to do
            pass
        else:
            try:
                import jsonschema  # type: ignore

                jsonschema.validate(instance=parsed_json, schema=schema)
            except Exception as e:
                errors.append({
                    'validator': 'json_schema',
                    'message': 'JSONSchema validation failed',
                    'detail': str(e),
                })

    passed = len(errors) == 0
    kind = '+'.join(enabled_kinds) if enabled_kinds else None
    return ValidationResult(passed=passed, kind=kind, errors=errors or None)
