#!/usr/bin/env python3
"""
Convert Databricks Dolly 15k to chat JSONL suitable for Qwen SFT.

Usage:
  python scripts/convert_dolly_to_chat_jsonl.py [--split train] [--out <path.jsonl>]

If no output path is provided, writes to lib/training/logs/datasets/dolly_chat.jsonl

Each line format:
{"messages": [{"role":"user","content":"..."},{"role":"assistant","content":"..."}]}
"""
import argparse
import json
import os
from pathlib import Path

try:
    from datasets import load_dataset  # type: ignore
except Exception as e:
    print("[convert_dolly] Missing dependency: datasets. Install with: pip install datasets")
    raise

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "lib" / "training" / "logs" / "datasets" / "dolly_chat.jsonl"


def to_chat_row(r: dict) -> dict | None:
    instr = (r.get("instruction") or "").strip()
    resp = (r.get("response") or "").strip()
    ctx = (r.get("context") or "").strip()
    if not instr or not resp:
        return None
    user_msg = instr
    if ctx:
        user_msg = f"{instr}\n\nContext:\n{ctx}"
    return {
        "messages": [
            {"role": "user", "content": user_msg},
            {"role": "assistant", "content": resp},
        ]
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", default="train")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    ds = load_dataset("databricks/databricks-dolly-15k", split=args.split)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    count_in = 0
    count_out = 0

    with out_path.open("w", encoding="utf-8") as f:
        for r in ds:
            count_in += 1
            row = to_chat_row(r)
            if not row:
                continue
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            count_out += 1

    print(f"[convert_dolly] Wrote {count_out} examples to {out_path} (from {count_in} rows)")


if __name__ == "__main__":
    main()
