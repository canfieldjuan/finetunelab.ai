#!/usr/bin/env python3
"""
Convert output/faq.jsonl (question/answer pairs) into chat JSONL for SFT.
- Produces messages array compatible with chat models (e.g., Qwen, Llama).
- Basic quality filters to keep signal and reduce noise.
- Optionally cap the number of examples.

Defaults:
  input:  output/faq.jsonl
  output: lib/training/logs/datasets/repo_faq_chat.jsonl

Usage:
  python3 scripts/convert_faq_to_chat_jsonl.py [--input path] [--output path] [--max 500]
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "output" / "faq.jsonl"
DEFAULT_OUTPUT = ROOT / "lib" / "training" / "logs" / "datasets" / "repo_faq_chat.jsonl"

# Heuristics to drop low-signal questions
BASE_DROP_QUESTION_PATTERNS = [
    r"^Where is the source file for \/",  # path locator Qs
    r"^Which HTTP methods are implemented for \/",  # trivial method listing
    r"^What tags classify ",
    r"^Can you describe \w+ \/",  # often duplicative of main summary
]

DEFAULT_MIN_ANSWER_CHARS = 40
DEFAULT_MAX_ANSWER_CHARS = 3000  # keep swagger blobs under control

SYSTEM_PROMPT = (
    "You are a helpful assistant specialized in this web-ui repository. "
    "Answer precisely using the project\'s APIs, training server endpoints, and code behavior. "
    "Prefer concise explanations and include concrete route paths or file names when relevant."
)

def keep_example(q: str, a: str, *,
                 drop_q_regexes: list[re.Pattern],
                 min_answer_chars: int,
                 max_answer_chars: int) -> bool:
    if not q or not a:
        return False
    a_stripped = a.strip()
    if len(a_stripped) < min_answer_chars:
        return False
    if len(a_stripped) > max_answer_chars:
        return False
    for rx in drop_q_regexes:
        if rx.search(q):
            return False
    return True


def convert(input_path: Path, output_path: Path, max_examples: int | None = None,
            *, min_answer_chars: int = DEFAULT_MIN_ANSWER_CHARS,
            max_answer_chars: int = DEFAULT_MAX_ANSWER_CHARS,
            keep_describe: bool = False,
            keep_tags: bool = False,
            keep_methods: bool = False) -> int:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    seen_q = set()
    written = 0

    drop_patterns = list(BASE_DROP_QUESTION_PATTERNS)
    if keep_describe:
        drop_patterns = [p for p in drop_patterns if not p.startswith(r"^Can you describe ")]
    if keep_tags:
        drop_patterns = [p for p in drop_patterns if not p.startswith(r"^What tags classify ")]
    if keep_methods:
        drop_patterns = [p for p in drop_patterns if not p.startswith(r"^Which HTTP methods are implemented for \/")]
    drop_q_regexes = [re.compile(p) for p in drop_patterns]

    with input_path.open("r", encoding="utf-8") as fin, output_path.open("w", encoding="utf-8") as fout:
        for line in fin:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            q = (obj.get("question") or "").strip()
            a = (obj.get("answer") or "").strip()

            if q in seen_q:
                continue
            if not keep_example(q, a, drop_q_regexes=drop_q_regexes,
                               min_answer_chars=min_answer_chars,
                               max_answer_chars=max_answer_chars):
                continue

            example = {
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": q},
                    {"role": "assistant", "content": a},
                ]
            }
            fout.write(json.dumps(example, ensure_ascii=False) + "\n")
            seen_q.add(q)
            written += 1
            if max_examples is not None and written >= max_examples:
                break
    return written


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=str, default=str(DEFAULT_INPUT))
    parser.add_argument("--output", type=str, default=str(DEFAULT_OUTPUT))
    parser.add_argument("--max", type=int, default=None, help="Cap number of examples")
    parser.add_argument("--min-answer-chars", type=int, default=DEFAULT_MIN_ANSWER_CHARS)
    parser.add_argument("--max-answer-chars", type=int, default=DEFAULT_MAX_ANSWER_CHARS)
    parser.add_argument("--keep-describe", action="store_true")
    parser.add_argument("--keep-tags", action="store_true")
    parser.add_argument("--keep-methods", action="store_true")
    args = parser.parse_args()

    n = convert(
        Path(args.input),
        Path(args.output),
        args.max,
        min_answer_chars=args.min_answer_chars,
        max_answer_chars=args.max_answer_chars,
        keep_describe=args.keep_describe,
        keep_tags=args.keep_tags,
        keep_methods=args.keep_methods,
    )
    print(f"Wrote {n} chat examples to {args.output}")


if __name__ == "__main__":
    main()
