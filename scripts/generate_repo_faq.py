#!/usr/bin/env python3
"""
Generate repo-specific Q&A from source code:
- Scans Next.js API routes under app/api/**/route.ts
- Scans FastAPI endpoints in lib/training/training_server.py
- Adds a curated entry for the realtime hook
Outputs:
- docs/RepoFAQ.md (human-friendly)
- output/faq.jsonl (one QA per line)
"""
import re
import json
from pathlib import Path
from typing import List, Dict, Tuple

ROOT = Path(__file__).resolve().parents[1]
ROUTES_DIR = ROOT / "app" / "api"
TRAINING_SERVER = ROOT / "lib" / "training" / "training_server.py"
FAQ_MD = ROOT / "docs" / "RepoFAQ.md"
FAQ_JSONL = ROOT / "output" / "faq.jsonl"

TS_ROUTE_METHOD_RE = re.compile(r"export\s+async\s+function\s+(GET|POST|PUT|DELETE)")
FASTAPI_ROUTE_RE = re.compile(r"@app\.(get|post|put|delete)\(\"([^\"]+)\"\)")


def _find_main_comment_block(text: str) -> str:
    """Return the largest /** */ comment block content if present (cleaned)."""
    blocks = list(re.finditer(r"/\*\*([\s\S]*?)\*/", text))
    if not blocks:
        return ""
    # Pick the largest block
    block = max(blocks, key=lambda m: len(m.group(1)))
    cleaned = re.sub(r"\s*\*\s?", "", block.group(1))
    return cleaned.strip()


def discover_next_routes() -> List[Tuple[str, List[str], str, str, str]]:
    """Return list of (route_path, methods, summary, comment_block, rel_path) for Next.js routes."""
    results: List[Tuple[str, List[str], str, str, str]] = []
    if not ROUTES_DIR.exists():
        return results

    for route_file in ROUTES_DIR.rglob("route.ts"):
        rel = route_file.relative_to(ROOT)
        # Convert path app/api/foo/bar/route.ts -> /api/foo/bar
        route_path = "/" + "/".join(rel.parts[1:-1])  # drop leading 'app' and trailing 'route.ts'
        # Read file
        text = route_file.read_text(encoding="utf-8", errors="ignore")
        methods = TS_ROUTE_METHOD_RE.findall(text)
        # Try to get leading comment block as summary
        comment_block = _find_main_comment_block(text)
        summary = ""
        if comment_block:
            # Attempt to extract a one-line summary from swagger-like content
            sm = re.search(r"summary:\s*(.+)", comment_block)
            summary = sm.group(1).strip() if sm else comment_block[:280]
        elif len(text) > 0:
            summary = f"Next.js API route implemented in {rel}"
        results.append((route_path, sorted(set(methods)), summary, comment_block, str(rel)))
    return results


def discover_fastapi_routes() -> List[Tuple[str, List[str], str]]:
    results: List[Tuple[str, List[str], str]] = []
    if not TRAINING_SERVER.exists():
        return results
    text = TRAINING_SERVER.read_text(encoding="utf-8", errors="ignore")
    for m in FASTAPI_ROUTE_RE.finditer(text):
        method, path = m.group(1).upper(), m.group(2)
        # Try to find a docstring/comment right after decorator
        # Look ahead a bit from match position
        snippet = text[m.end(): m.end()+400]
        doc = ""
        dm = re.search(r'"""([\s\S]*?)"""', snippet)
        if dm:
            doc = dm.group(1).strip()
        results.append((path, [method], doc or f"FastAPI endpoint defined in training_server.py"))
    # Merge duplicates with multiple methods
    merged: Dict[str, Tuple[List[str], str]] = {}
    for path, methods, doc in results:
        if path in merged:
            old_methods, old_doc = merged[path]
            merged[path] = (sorted(set(old_methods + methods)), old_doc or doc)
        else:
            merged[path] = (methods, doc)
    return [(p, m, d) for p, (m, d) in merged.items()]


def curated_entries() -> List[Dict]:
    # Hand-authored facts for critical pieces we know about from the repo
    return [
        {
            "question": "How does the training jobs realtime hook keep the UI updated?",
            "answer": (
                "The hook `lib/hooks/useTrainingJobsRealtime.ts` subscribes to Supabase Postgres changes "
                "on the `local_training_jobs` table (INSERT/UPDATE/DELETE) filtered by the current user_id. "
                "It performs an initial fetch, then maintains a live channel. If the channel errors, times out, or closes, "
                "it falls back to polling every 30s and schedules exponential backoff reconnect attempts (up to ~30s). "
                "It also clears channels when the auth token changes to prevent stale connections."
            )
        }
    ]


SECTION_KEYS = ["requestBody:", "parameters:", "responses:", "security:", "description:", "tags:"]


def extract_section_blocks(comment_block: str) -> Dict[str, str]:
    """Extract coarse swagger-like sections from a comment block by string slicing.
    Returns dict of section_name -> text chunk.
    """
    sections: Dict[str, str] = {}
    if not comment_block:
        return sections
    lower = comment_block
    for key in SECTION_KEYS:
        pos = lower.find(key)
        if pos == -1:
            continue
        # find the next section key after current pos
        next_positions = [lower.find(k, pos + 1) for k in SECTION_KEYS if k != key and lower.find(k, pos + 1) != -1]
        next_pos = min(next_positions) if next_positions else -1
        chunk = lower[pos: next_pos] if next_pos != -1 else lower[pos:]
        sections[key.rstrip(":")] = chunk.strip()
    return sections


def build_qas() -> List[Dict]:
    qas: List[Dict] = []

    # Next.js routes
    for route_path, methods, summary, comment_block, rel_path in discover_next_routes():
        methods = methods or ["GET", "POST"]  # default guess
        sections = extract_section_blocks(comment_block)

        # Per-method primary QAs
        for mth in methods:
            q = f"What does {mth} {route_path} do?"
            a = summary or f"Implements {mth} handler for {route_path}."
            qas.append({"question": q, "answer": a})

            # Expand with request body/parameters/responses/auth if available
            if "requestBody" in sections:
                qas.append({
                    "question": f"What is the request body for {mth} {route_path}?",
                    "answer": sections["requestBody"]
                })
            if "parameters" in sections:
                qas.append({
                    "question": f"Which parameters does {mth} {route_path} accept?",
                    "answer": sections["parameters"]
                })
            if "responses" in sections:
                qas.append({
                    "question": f"What responses does {mth} {route_path} return?",
                    "answer": sections["responses"]
                })
            if "security" in sections:
                qas.append({
                    "question": f"Does {mth} {route_path} require authentication?",
                    "answer": sections["security"]
                })
            if "description" in sections:
                qas.append({
                    "question": f"Can you describe {mth} {route_path}?",
                    "answer": sections["description"]
                })
            if "tags" in sections:
                qas.append({
                    "question": f"What tags classify {mth} {route_path}?",
                    "answer": sections["tags"]
                })

        # Route-level utility QAs
        qas.append({
            "question": f"Which HTTP methods are implemented for {route_path}?",
            "answer": ", ".join(methods)
        })
        qas.append({
            "question": f"Where is the source file for {route_path}?",
            "answer": rel_path
        })

    # FastAPI routes
    for path, methods, doc in discover_fastapi_routes():
        # primary
        q = f"What does {', '.join(methods)} {path} in the training server do?"
        a = doc or f"Endpoint implemented in lib/training/training_server.py for {path}."
        qas.append({"question": q, "answer": a})
        # Expand with additional angles if doc is present
        if doc:
            # Heuristic splits: look for Args/Returns sections common in our docstrings
            if "Args:" in doc or "Parameters:" in doc:
                qas.append({
                    "question": f"What parameters does {', '.join(methods)} {path} accept?",
                    "answer": doc
                })
            if "Returns:" in doc or "responses" in doc.lower():
                qas.append({
                    "question": f"What does {', '.join(methods)} {path} return?",
                    "answer": doc
                })

    # Curated
    qas.extend(curated_entries())
    return qas


def write_outputs(qas: List[Dict]):
    FAQ_MD.parent.mkdir(parents=True, exist_ok=True)
    FAQ_JSONL.parent.mkdir(parents=True, exist_ok=True)

    # Markdown
    lines = ["# Project FAQ (auto-generated)", "", "> Derived from source routes and server endpoints.", ""]
    for i, qa in enumerate(qas, 1):
        lines.append(f"## {i}. {qa['question']}")
        lines.append("")
        lines.append(qa['answer'])
        lines.append("")
    FAQ_MD.write_text("\n".join(lines), encoding="utf-8")

    # JSONL
    with FAQ_JSONL.open("w", encoding="utf-8") as f:
        for qa in qas:
            f.write(json.dumps(qa, ensure_ascii=False) + "\n")


def main():
    qas = build_qas()
    write_outputs(qas)
    print(f"Wrote {len(qas)} Q&A to {FAQ_MD} and {FAQ_JSONL}")


if __name__ == "__main__":
    main()
