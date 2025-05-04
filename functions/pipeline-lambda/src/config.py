import yaml
from typing import Any, Dict
from pathlib import Path


def load_yaml_config(path: Path) -> Dict[str, Any]:
    """
    Reads a YAML file and returns its contents as a dict.
    Expects a top-level key "config" whose value is a list of mappings:
      config:
        - BuildFromTag:
            url: …
            method: POST
            headers: …
        - AnotherPipeline:
            …
    """
    try:
        with open(path, "r") as f:
            cfg = yaml.safe_load(f) or {}
    except FileNotFoundError:
        raise RuntimeError(f"Config file not found: {path}")
    except yaml.YAMLError as e:
        raise RuntimeError(f"YAML parsing error in {path}: {e}")

    raw = cfg.get("config", [])
    pipelines: Dict[str, Any] = {}
    for entry in raw:
        if isinstance(entry, dict):
            pipelines.update(entry)
    return pipelines
