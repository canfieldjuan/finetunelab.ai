#!/usr/bin/env python3
"""Categorize/tag Alpaca-style records and split into datasets.

Supports either JSONL (one JSON object per line) or a JSON array file.

Outputs (in out_dir):
- tagged.jsonl: every record with added _meta labels
- coding.jsonl: records with code-like responses
- general.jsonl: non-coding records (broad)
- concise.jsonl: non-coding records filtered for concise target behavior
- stats.json: aggregate counts

Usage:
  python3 datasets/categorize_alpaca.py \
    --input "/path/alpaca-cleaned.jsonl" \
    --out-dir "/path/out" \
    --concise-max-chars 800
"""

from __future__ import annotations

import argparse
import json
import os
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Iterator, List, Optional, Tuple


TEXT_KEYS = {
    "instruction",
    "input",
    "output",
    "prompt",
    "completion",
    "response",
    "text",
    "chosen",
    "rejected",
    "assistant",
    "user",
}

RE_CODE = re.compile(
    r"(^|\n)\s*(def |class |import |from |#include|public |private |function |SELECT |WITH |CREATE |INSERT |UPDATE |DELETE )",
    re.M,
)
CODE_MARKERS = [
    "```",
    "import ",
    "from ",
    "def ",
    "class ",
    "function ",
    "console.",
    "#include",
    "SELECT ",
    "CREATE TABLE",
    "INSERT INTO",
]

RE_BULLETS = re.compile(r"(^|\n)\s*(\d+\.|[-*])\s+", re.M)
RE_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
RE_TOKEN_SPLIT = re.compile(r"\S+")

CONCISE_FORBIDDEN_MARKERS = (
    "because",
    "therefore",
    "thus",
    "to do so",
    "we can",
    "step ",
    "steps",
)

RE_HANGUL = re.compile(r"[\uac00-\ud7af]")
RE_CJK = re.compile(r"[\u4e00-\u9fff]")
RE_ARABIC = re.compile(r"[\u0600-\u06ff]")
RE_CYRILLIC = re.compile(r"[\u0400-\u04ff]")


@dataclass(frozen=True)
class Buckets:
    short_max: int = 200
    medium_max: int = 800
    long_max: int = 2000

    def bucket(self, n: int) -> str:
        if n < self.short_max:
            return "short"
        if n <= self.medium_max:
            return "medium"
        if n <= self.long_max:
            return "long"
        return "very_long"


def _safe_mkdir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def iter_json_records(path: str) -> Iterator[Tuple[int, Dict[str, Any]]]:
    """Yield (index, obj) for either JSONL or JSON array."""
    with open(path, "rb") as f:
        raw = f.read()

    # Detect format from first non-whitespace byte
    first = None
    for b in raw:
        if b in b" \t\r\n":
            continue
        first = b
        break

    if first == ord("["):
        data = json.loads(raw.decode("utf-8"))
        if not isinstance(data, list):
            raise ValueError("JSON file begins with '[' but is not a list")
        for i, obj in enumerate(data):
            if not isinstance(obj, dict):
                continue
            yield i + 1, obj
        return

    # JSONL
    i = 0
    for line in raw.splitlines():
        i += 1
        if not line.strip():
            continue
        obj = json.loads(line.decode("utf-8"))
        if not isinstance(obj, dict):
            continue
        yield i, obj


def extract_prompt_response(obj: Dict[str, Any]) -> Tuple[str, str, List[str]]:
    """Return (prompt, response, fields_present)."""
    fields_present: List[str] = []

    instruction = obj.get("instruction")
    input_ = obj.get("input")
    output = obj.get("output")

    if isinstance(instruction, str):
        fields_present.append("instruction")
    if isinstance(input_, str):
        fields_present.append("input")
    if isinstance(output, str):
        fields_present.append("output")

    # Alpaca-style
    if isinstance(instruction, str) and isinstance(output, str):
        prompt = instruction.strip()
        if isinstance(input_, str) and input_.strip():
            prompt = f"{prompt}\n\n{input_.strip()}"
        return prompt, output, fields_present

    # Common alternatives
    for pk in ("prompt", "user", "input", "text"):
        pv = obj.get(pk)
        if isinstance(pv, str) and pv.strip():
            fields_present.append(pk)
            prompt = pv
            break
    else:
        prompt = ""

    for rk in ("completion", "response", "assistant", "output", "text"):
        rv = obj.get(rk)
        if isinstance(rv, str) and rv.strip():
            fields_present.append(rk)
            response = rv
            break
    else:
        response = ""

    return prompt, response, fields_present


def detect_language_flags(s: str) -> List[str]:
    flags: List[str] = []
    if RE_HANGUL.search(s):
        flags.append("hangul")
    if RE_CJK.search(s):
        flags.append("cjk")
    if RE_ARABIC.search(s):
        flags.append("arabic")
    if RE_CYRILLIC.search(s):
        flags.append("cyrillic")

    if s:
        non_ascii = sum(1 for ch in s if ord(ch) > 127)
        if non_ascii / max(1, len(s)) > 0.30 and len(s) > 40:
            flags.append("high_non_ascii_ratio")

    return flags


def detect_answer_style(prompt: str, response: str) -> List[str]:
    tags: List[str] = []

    r = response.strip()
    if not r:
        return ["empty"]

    if "i cannot" in r.lower() or "i can't" in r.lower() or "i am sorry" in r.lower():
        tags.append("refusal_or_cant_answer")

    if RE_BULLETS.search(r):
        tags.append("listicle")

    # Direct answer: short-ish, starts with an answer-like statement.
    # This intentionally includes 1-3 sentence factual replies.
    sentences = [s for s in RE_SENTENCE_SPLIT.split(r) if s.strip()]
    first_sentence = sentences[0].strip() if sentences else r
    if (
        len(r) <= 450
        and len(first_sentence) <= 220
        and not RE_BULLETS.search(r)
        and "```" not in r
    ):
        tags.append("direct_answer")

    if "therefore" in r.lower() or "to do so" in r.lower() or "we can" in r.lower() or "to solve" in r.lower():
        tags.append("multi_step_explanation")

    # Creative-ish heuristics
    if re.search(r"\n\s*person 1:|\n\s*person 2:", r.lower()):
        tags.append("creative_dialogue")
    if re.search(r"\n\s*[a-z].+\n\s*[a-z].+\n", r.lower()) and ("poem" in prompt.lower() or "poetry" in prompt.lower()):
        tags.append("creative_poem")
    if "once upon a time" in r.lower() or "she sat" in r.lower() or "he sat" in r.lower():
        tags.append("creative_story")

    # Roleplay / persona responses (common in Alpaca)
    if any(k in prompt.lower() for k in ("pretend you are", "act as", "roleplay", "you are a")):
        tags.append("roleplay")

    return sorted(set(tags))


def count_tokens(text: str) -> int:
    # Cheap, model-agnostic approximation: whitespace-separated tokens.
    # Good enough to enforce a hard upper bound like 1024.
    return len(RE_TOKEN_SPLIT.findall(text))


def count_sentences(text: str) -> int:
    t = text.strip()
    if not t:
        return 0
    # Treat newlines as additional structure (often multi-part answers)
    if "\n" in t:
        # still count punctuation sentences, but nudge upward for multi-line
        base = len([s for s in RE_SENTENCE_SPLIT.split(t) if s.strip()])
        return max(base, 2)
    return len([s for s in RE_SENTENCE_SPLIT.split(t) if s.strip()])


def detect_technical(response: str) -> List[str]:
    tags: List[str] = []
    r = response

    codeish = False
    if "```" in r:
        codeish = True
    if RE_CODE.search(r):
        codeish = True
    if any(m in r for m in CODE_MARKERS) and ("\n" in r or len(r) > 200):
        codeish = True

    if codeish:
        tags.append("code_block")
        # code-only vs code+explanation (simple)
        stripped = r.strip()
        if stripped.startswith("```") and stripped.endswith("```") and len(stripped) < 1400:
            tags.append("code_only")
        else:
            # if it contains both code markers and lots of prose
            if len(re.sub(r"[^A-Za-z ]+", "", r)) > 200:
                tags.append("code_plus_explanation")

        # language guess
        low = r.lower()
        if "def " in low or "import " in low:
            tags.append("lang_python")
        elif "console." in low or "function " in low:
            tags.append("lang_js")
        elif "select " in low or "create table" in low:
            tags.append("lang_sql")

    # Non-code technical explainer
    if "algorithm" in response.lower() or "cpu" in response.lower() or "motherboard" in response.lower():
        tags.append("technical_explanation")

    return sorted(set(tags))


def detect_task(prompt: str, response: str) -> List[str]:
    p = prompt.lower()
    r = response.lower()
    tags: List[str] = []

    if "translate" in p or "translation" in p:
        tags.append("translation_or_language_learning")

    if "summary" in p or "summarize" in p:
        tags.append("summarization")

    if "how" in p and ("step" in r or RE_BULLETS.search(response)):
        tags.append("how_to_instructions")

    if "write" in p and ("poem" in p or "story" in p or "dialogue" in p):
        tags.append("creative")

    if "solve" in p or "equation" in p or "sqrt" in p or re.search(r"\b\d+\s*[+\-*/]\s*\d+", p):
        tags.append("math")

    if "history" in p or "assassinated" in r or "century" in r:
        tags.append("history_bio")

    if "climate" in p or "pollution" in p:
        tags.append("environment")

    return sorted(set(tags))


def build_meta(
    *,
    source_file: str,
    line_no: int,
    prompt: str,
    response: str,
    fields_present: List[str],
    buckets: Buckets,
) -> Dict[str, Any]:
    prompt_chars = len(prompt)
    response_chars = len(response)
    prompt_tokens = count_tokens(prompt)
    response_tokens = count_tokens(response)
    response_sentences = count_sentences(response)
    response_has_forbidden_markers = any(m in response.lower() for m in CONCISE_FORBIDDEN_MARKERS)

    answer_style = detect_answer_style(prompt, response)
    technical = detect_technical(response)
    task = detect_task(prompt, response)

    reasoning: List[str] = []
    if "multi_step_explanation" in answer_style:
        reasoning.append("has_multi_step_reasoning")
    if re.search(r"\btherefore\b|\bthus\b|\bwe get\b|=", response.lower()) and len(response) > 200:
        reasoning.append("math_derivation")

    lang_flags = detect_language_flags(prompt + "\n" + response)

    return {
        "id": f"{os.path.basename(source_file)}:{line_no}",
        "source": {"file": os.path.basename(source_file), "line": line_no},
        "fields_present": sorted(set(fields_present)),
        "prompt": {
            "chars": prompt_chars,
            "tokens": prompt_tokens,
            "bucket": buckets.bucket(prompt_chars),
        },
        "response": {
            "chars": response_chars,
            "tokens": response_tokens,
            "sentences": response_sentences,
            "has_forbidden_markers": response_has_forbidden_markers,
            "bucket": buckets.bucket(response_chars),
        },
        "labels": {
            "answer_style": answer_style,
            "reasoning": sorted(set(reasoning)),
            "technical": technical,
            "task": task,
            "language": lang_flags,
        },
    }


def is_coding(meta: Dict[str, Any]) -> bool:
    return "code_block" in (meta.get("labels", {}).get("technical", []) or [])


def is_concise_candidate(meta: Dict[str, Any], concise_max_chars: int, max_tokens: int) -> bool:
    labels = meta.get("labels", {})
    resp_chars = int(meta.get("response", {}).get("chars", 0))
    resp_tokens = int(meta.get("response", {}).get("tokens", 0))
    prompt_tokens = int(meta.get("prompt", {}).get("tokens", 0))
    resp_sentences = int(meta.get("response", {}).get("sentences", 0))
    response_bucket = (meta.get("response", {}) or {}).get("bucket")
    has_forbidden_markers = bool((meta.get("response", {}) or {}).get("has_forbidden_markers", False))

    # Hard length caps (token-based)
    if prompt_tokens > max_tokens or resp_tokens > max_tokens:
        return False

    if resp_chars > concise_max_chars:
        return False
    if is_coding(meta):
        return False

    # Forbid listicles entirely in concise.
    answer_style = set(labels.get("answer_style", []) or [])
    if "listicle" in answer_style:
        return False

    # Forbid explicit reasoning markers (because/therefore/etc) in concise.
    if has_forbidden_markers:
        return False

    if "multi_step_explanation" in answer_style:
        return False

    # Enforce: answer-only (<=1 sentence total)
    if resp_sentences > 1:
        return False

    if "creative_story" in answer_style or "creative_poem" in answer_style or "creative_dialogue" in answer_style:
        return False

    # Extra guardrail: avoid multi-paragraph medium/long responses even if not caught above.
    if response_bucket in {"long", "very_long"}:
        return False

    return True


def write_jsonl(path: str, records: Iterable[Dict[str, Any]]) -> None:
    with open(path, "w", encoding="utf-8") as out:
        for obj in records:
            out.write(json.dumps(obj, ensure_ascii=False) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--concise-max-chars", type=int, default=800)
    ap.add_argument("--max-tokens", type=int, default=1024)
    ap.add_argument("--short-max", type=int, default=200)
    ap.add_argument("--medium-max", type=int, default=800)
    ap.add_argument("--long-max", type=int, default=2000)
    args = ap.parse_args()

    in_path = args.input
    out_dir = args.out_dir
    _safe_mkdir(out_dir)

    buckets = Buckets(short_max=args.short_max, medium_max=args.medium_max, long_max=args.long_max)

    tagged_path = os.path.join(out_dir, "tagged.jsonl")
    coding_path = os.path.join(out_dir, "coding.jsonl")
    general_path = os.path.join(out_dir, "general.jsonl")
    concise_path = os.path.join(out_dir, "concise.jsonl")
    stats_path = os.path.join(out_dir, "stats.json")

    counters = Counter()
    label_counters: Dict[str, Counter] = defaultdict(Counter)

    # Stream-write outputs
    tagged_f = open(tagged_path, "w", encoding="utf-8")
    coding_f = open(coding_path, "w", encoding="utf-8")
    general_f = open(general_path, "w", encoding="utf-8")
    concise_f = open(concise_path, "w", encoding="utf-8")

    try:
        for line_no, obj in iter_json_records(in_path):
            prompt, response, fields_present = extract_prompt_response(obj)
            meta = build_meta(
                source_file=in_path,
                line_no=line_no,
                prompt=prompt,
                response=response,
                fields_present=fields_present,
                buckets=buckets,
            )

            out_obj = dict(obj)
            out_obj["_meta"] = meta

            tagged_f.write(json.dumps(out_obj, ensure_ascii=False) + "\n")

            counters["total"] += 1
            counters[f"prompt_bucket:{meta['prompt']['bucket']}"] += 1
            counters[f"response_bucket:{meta['response']['bucket']}"] += 1

            for group, vals in meta.get("labels", {}).items():
                if not isinstance(vals, list):
                    continue
                for v in vals:
                    label_counters[group][v] += 1

            if is_coding(meta):
                coding_f.write(json.dumps(out_obj, ensure_ascii=False) + "\n")
                counters["coding"] += 1
                continue  # keep coding separate (exclude from general/concise)

            # non-coding
            general_f.write(json.dumps(out_obj, ensure_ascii=False) + "\n")
            counters["general"] += 1

            if is_concise_candidate(meta, args.concise_max_chars, args.max_tokens):
                concise_f.write(json.dumps(out_obj, ensure_ascii=False) + "\n")
                counters["concise"] += 1

    finally:
        tagged_f.close()
        coding_f.close()
        general_f.close()
        concise_f.close()

    stats = {
        "input": os.path.abspath(in_path),
        "out_dir": os.path.abspath(out_dir),
        "counts": dict(counters),
        "label_counts": {k: dict(v) for k, v in label_counters.items()},
        "settings": {
            "concise_max_chars": args.concise_max_chars,
            "buckets": {"short_max": args.short_max, "medium_max": args.medium_max, "long_max": args.long_max},
        },
    }

    with open(stats_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    print("WROTE", tagged_path)
    print("WROTE", coding_path)
    print("WROTE", general_path)
    print("WROTE", concise_path)
    print("WROTE", stats_path)
    print("TOTAL", counters["total"], "CODING", counters["coding"], "GENERAL", counters["general"], "CONCISE", counters["concise"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
