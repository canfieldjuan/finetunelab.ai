#!/usr/bin/env python3
"""
Build knowledge base from FEATURES_ADDENDUM.md
"""

from pathlib import Path

def build_knowledge_base():
    """Extract features knowledge from addendum"""

    addendum_path = Path("/home/juan-canfield/Desktop/web-ui-docs/finetune-lab/FEATURES_ADDENDUM.md")
    content = addendum_path.read_text()

    kb = []
    kb.append("="*80)
    kb.append("FINETUNE LAB - ADDITIONAL FEATURES KNOWLEDGE BASE")
    kb.append("="*80)
    kb.append("")
    kb.append(content)

    return "\n".join(kb)

def main():
    print("="*80)
    print("BUILDING FEATURES ADDENDUM KNOWLEDGE BASE")
    print("="*80)
    print()

    kb = build_knowledge_base()

    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/features_addendum_kb.txt")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    output_path.write_text(kb)

    print(f"✅ Knowledge base created!")
    print(f"📁 Location: {output_path}")
    print(f"📊 Size: {len(kb):,} characters ({len(kb.split()):,} words)")
    print(f"📄 Lines: {len(kb.splitlines()):,}")
    print()

if __name__ == "__main__":
    main()
